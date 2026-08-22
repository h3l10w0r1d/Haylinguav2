# backend/routes_emotes.py
"""Friends-only emote sending, built on the same instance-owned user_items
inventory as trading (routes_trades.py) — an emote is just another 'emote'
category item_definitions row (see ensure_schema.py), owned but never
equipped. Firing one at a friend writes a row to emote_sends; the recipient
sees it via GET /me/emotes/inbox.

Trust gate: same as trading — can only send to an existing friend (checked
against the `friends` table), which bounds the stranger-spam surface.
"""
from typing import Any, Dict, Optional

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.engine import Connection

from database import get_db
from routes import _get_user_id_from_bearer, _check_rate_limit
from routes_trades import _are_friends

router = APIRouter()


class SendEmoteIn(BaseModel):
    item_id: int


@router.post("/friends/{friend_id}/emote")
def send_emote(
    friend_id: int,
    body: SendEmoteIn,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    if friend_id == user_id:
        raise HTTPException(status_code=400, detail="Can't send an emote to yourself")
    if not _are_friends(db, user_id, friend_id):
        raise HTTPException(status_code=403, detail="You can only send emotes to friends")

    _check_rate_limit("emote_send", user_id, limit=30, window_seconds=60)

    owned = db.execute(
        text(
            "SELECT 1 FROM user_items WHERE user_id = :u AND item_id = :i AND category = 'emote'"
        ),
        {"u": user_id, "i": body.item_id},
    ).first()
    if not owned:
        raise HTTPException(status_code=403, detail="You don't own this emote")

    db.execute(
        text(
            "INSERT INTO emote_sends (sender_id, recipient_id, item_id) "
            "VALUES (:s, :r, :i)"
        ),
        {"s": user_id, "r": friend_id, "i": body.item_id},
    )
    return {"ok": True}


@router.get("/me/emotes/inbox")
def emotes_inbox(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """Recent emotes received from friends, newest first."""
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    rows = db.execute(
        text(
            """
            SELECT es.id, es.created_at, es.seen_at,
                   es.sender_id, COALESCE(u.display_name, u.username) AS sender_name,
                   u.avatar_url AS sender_avatar_url,
                   idf.title, idf.render_key, idf.rarity
            FROM emote_sends es
            JOIN users u ON u.id = es.sender_id
            JOIN item_definitions idf ON idf.id = es.item_id
            WHERE es.recipient_id = :u
            ORDER BY es.created_at DESC
            LIMIT 30
            """
        ),
        {"u": user_id},
    ).mappings().all()
    return {"emotes": [dict(r) for r in rows]}


@router.post("/me/emotes/inbox/seen")
def emotes_inbox_mark_seen(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    db.execute(
        text(
            "UPDATE emote_sends SET seen_at = NOW() "
            "WHERE recipient_id = :u AND seen_at IS NULL"
        ),
        {"u": user_id},
    )
    return {"ok": True}
