# backend/routes_trades.py
"""Friends-only peer-to-peer cosmetic trading, built on the instance-owned
user_items inventory (see ensure_schema.py's marketplace section). Split out
of routes.py the same way routes_social.py was, since this is a self-
contained feature surface.

Trust gate: a trade can only be proposed to an existing friend (checked
against the `friends` table friends_request_accept already populates
bidirectionally) — this bounds the stranger-scam exploit surface for v1.

Every state-changing endpoint re-validates ownership/balance at the moment
of the guarded UPDATE, never trusting propose-time state — item ownership
and equip status can change between propose and accept (the item could be
re-traded, or in a future stage un-equipped/re-equipped), so accept()
re-checks everything inside the same transaction that performs the swap.
"""
from datetime import datetime
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Header
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.engine import Connection

from database import get_db
from routes import _get_user_id_from_bearer, _check_rate_limit

router = APIRouter()

MAX_ITEMS_PER_SIDE = 12
MAX_PENDING_OUTGOING = 20


class ProposeTradeIn(BaseModel):
    recipient_id: int
    offered_item_ids: List[int] = []
    offered_gems: int = 0
    requested_item_ids: List[int] = []
    requested_gems: int = 0


def _are_friends(db: Connection, a: int, b: int) -> bool:
    row = db.execute(
        text("SELECT 1 FROM friends WHERE user_id = :a AND friend_id = :b LIMIT 1"),
        {"a": a, "b": b},
    ).first()
    return bool(row)


def _user_owns_items(db: Connection, user_id: int, user_item_ids: List[int]) -> bool:
    if not user_item_ids:
        return True
    ids = list({int(i) for i in user_item_ids})
    rows = db.execute(
        text(
            "SELECT id FROM user_items WHERE id = ANY(:ids) AND user_id = :u "
            "AND id IN (SELECT ui.id FROM user_items ui JOIN item_definitions idf ON idf.id = ui.item_id WHERE idf.tradeable)"
        ),
        {"ids": ids, "u": user_id},
    ).scalars().all()
    return len(set(rows)) == len(ids)


def _offer_out(db: Connection, offer_row) -> dict:
    items = db.execute(
        text(
            """
            SELECT toi.side, toi.user_item_id, ui.item_id, idf.title, idf.icon, idf.rarity,
                   idf.render_key, idf.category
            FROM trade_offer_items toi
            JOIN user_items ui ON ui.id = toi.user_item_id
            JOIN item_definitions idf ON idf.id = ui.item_id
            WHERE toi.offer_id = :id
            """
        ),
        {"id": offer_row["id"]},
    ).mappings().all()
    proposer_items = [dict(i) for i in items if i["side"] == "proposer"]
    recipient_items = [dict(i) for i in items if i["side"] == "recipient"]

    names = db.execute(
        text("SELECT id, username, name, avatar_url FROM users WHERE id = ANY(:ids)"),
        {"ids": [offer_row["proposer_id"], offer_row["recipient_id"]]},
    ).mappings().all()
    by_id = {int(r["id"]): r for r in names}
    proposer = by_id.get(int(offer_row["proposer_id"])) or {}
    recipient = by_id.get(int(offer_row["recipient_id"])) or {}

    return {
        "id": int(offer_row["id"]),
        "status": offer_row["status"],
        "proposer_id": int(offer_row["proposer_id"]),
        "proposer_name": proposer.get("name") or proposer.get("username"),
        "proposer_username": proposer.get("username"),
        "proposer_avatar_url": proposer.get("avatar_url"),
        "recipient_id": int(offer_row["recipient_id"]),
        "recipient_name": recipient.get("name") or recipient.get("username"),
        "recipient_username": recipient.get("username"),
        "recipient_avatar_url": recipient.get("avatar_url"),
        "proposer_gems": int(offer_row["proposer_gems"]),
        "recipient_gems": int(offer_row["recipient_gems"]),
        "proposer_items": proposer_items,
        "recipient_items": recipient_items,
        "parent_offer_id": offer_row["parent_offer_id"],
        "created_at": offer_row["created_at"].isoformat() if offer_row["created_at"] else None,
        "responded_at": offer_row["responded_at"].isoformat() if offer_row["responded_at"] else None,
        "expires_at": offer_row["expires_at"].isoformat() if offer_row["expires_at"] else None,
    }


def _insert_offer_items(db: Connection, offer_id: int, item_ids: List[int], side: str):
    for uid in item_ids:
        db.execute(
            text("INSERT INTO trade_offer_items (offer_id, user_item_id, side) VALUES (:o, :i, :s)"),
            {"o": offer_id, "i": uid, "s": side},
        )


@router.post("/trades/propose")
def propose_trade(
    body: ProposeTradeIn,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    _check_rate_limit("trade_propose", user_id, limit=10, window_seconds=3600)

    recipient_id = int(body.recipient_id)
    if recipient_id == user_id:
        raise HTTPException(status_code=400, detail="You can't trade with yourself")
    if not _are_friends(db, user_id, recipient_id):
        raise HTTPException(status_code=403, detail="You can only trade with friends")

    offered = list({int(i) for i in (body.offered_item_ids or [])})
    requested = list({int(i) for i in (body.requested_item_ids or [])})
    if len(offered) > MAX_ITEMS_PER_SIDE or len(requested) > MAX_ITEMS_PER_SIDE:
        raise HTTPException(status_code=400, detail=f"A trade can include at most {MAX_ITEMS_PER_SIDE} items per side")
    if not offered and not requested and not body.offered_gems and not body.requested_gems:
        raise HTTPException(status_code=400, detail="Offer at least one item or some gems")

    offered_gems = max(0, int(body.offered_gems or 0))
    requested_gems = max(0, int(body.requested_gems or 0))

    if not _user_owns_items(db, user_id, offered):
        raise HTTPException(status_code=400, detail="You don't own one of the offered items (or it isn't tradeable)")
    if not _user_owns_items(db, recipient_id, requested):
        raise HTTPException(status_code=400, detail="Your friend doesn't own one of the requested items (or it isn't tradeable)")

    gems = db.execute(text("SELECT COALESCE(gems, 0) FROM users WHERE id = :u"), {"u": user_id}).scalar() or 0
    if offered_gems > int(gems):
        raise HTTPException(status_code=400, detail="You don't have enough gems for this offer")

    pending_count = db.execute(
        text("SELECT COUNT(*) FROM trade_offers WHERE proposer_id = :u AND status = 'pending'"),
        {"u": user_id},
    ).scalar() or 0
    if pending_count >= MAX_PENDING_OUTGOING:
        raise HTTPException(status_code=400, detail="You have too many pending trade offers outstanding")

    offer_id = db.execute(
        text(
            """
            INSERT INTO trade_offers (proposer_id, recipient_id, proposer_gems, recipient_gems)
            VALUES (:p, :r, :pg, :rg) RETURNING id
            """
        ),
        {"p": user_id, "r": recipient_id, "pg": offered_gems, "rg": requested_gems},
    ).scalar_one()
    _insert_offer_items(db, offer_id, offered, "proposer")
    _insert_offer_items(db, offer_id, requested, "recipient")

    row = db.execute(text("SELECT * FROM trade_offers WHERE id = :id"), {"id": offer_id}).mappings().first()
    return {"ok": True, "offer": _offer_out(db, row)}


def _load_offer_for_actor(db: Connection, offer_id: int, user_id: int, actor_field: str):
    row = db.execute(text("SELECT * FROM trade_offers WHERE id = :id"), {"id": offer_id}).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Trade offer not found")
    if int(row[actor_field]) != user_id:
        raise HTTPException(status_code=403, detail="Not your trade offer")
    return row


@router.post("/trades/{offer_id}/accept")
def accept_trade(
    offer_id: int,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    # Step 1: claim the offer atomically — the guarded UPDATE's rowcount is
    # what serializes concurrent accept/decline/cancel attempts on this row.
    claimed = db.execute(
        text(
            "UPDATE trade_offers SET status = 'accepted', responded_at = NOW() "
            "WHERE id = :id AND status = 'pending' AND recipient_id = :me"
        ),
        {"id": offer_id, "me": user_id},
    )
    if claimed.rowcount == 0:
        existing = db.execute(text("SELECT recipient_id, status FROM trade_offers WHERE id = :id"), {"id": offer_id}).mappings().first()
        if not existing:
            raise HTTPException(status_code=404, detail="Trade offer not found")
        if int(existing["recipient_id"]) != user_id:
            raise HTTPException(status_code=403, detail="Not your trade offer")
        raise HTTPException(status_code=409, detail=f"This offer is no longer pending (status: {existing['status']})")

    offer = db.execute(text("SELECT * FROM trade_offers WHERE id = :id"), {"id": offer_id}).mappings().first()
    proposer_id = int(offer["proposer_id"])
    recipient_id = int(offer["recipient_id"])

    items = db.execute(
        text("SELECT id, side, user_item_id FROM trade_offer_items WHERE offer_id = :id"),
        {"id": offer_id},
    ).mappings().all()
    proposer_item_ids = [int(i["user_item_id"]) for i in items if i["side"] == "proposer"]
    recipient_item_ids = [int(i["user_item_id"]) for i in items if i["side"] == "recipient"]

    # Step 2: re-validate current ownership — never trust propose-time state.
    if not _user_owns_items(db, proposer_id, proposer_item_ids):
        raise HTTPException(status_code=409, detail="The proposer no longer owns one of the offered items")
    if not _user_owns_items(db, recipient_id, recipient_item_ids):
        raise HTTPException(status_code=409, detail="You no longer own one of the requested items")

    # Step 3: move gems both directions via guarded UPDATEs.
    proposer_gems = int(offer["proposer_gems"])
    recipient_gems = int(offer["recipient_gems"])
    if proposer_gems > 0:
        r = db.execute(
            text("UPDATE users SET gems = gems - :amt WHERE id = :u AND gems >= :amt"),
            {"amt": proposer_gems, "u": proposer_id},
        )
        if r.rowcount == 0:
            raise HTTPException(status_code=409, detail="The proposer no longer has enough gems")
        db.execute(text("UPDATE users SET gems = gems + :amt WHERE id = :u"), {"amt": proposer_gems, "u": recipient_id})
    if recipient_gems > 0:
        r = db.execute(
            text("UPDATE users SET gems = gems - :amt WHERE id = :u AND gems >= :amt"),
            {"amt": recipient_gems, "u": recipient_id},
        )
        if r.rowcount == 0:
            raise HTTPException(status_code=409, detail="You don't have enough gems for this trade")
        db.execute(text("UPDATE users SET gems = gems + :amt WHERE id = :u"), {"amt": recipient_gems, "u": proposer_id})

    # Step 4: flip ownership per item — guarded, any failure rolls back the
    # entire transaction (gems included), so the swap is all-or-nothing.
    for uid in proposer_item_ids:
        r = db.execute(
            text("UPDATE user_items SET user_id = :new_owner, equipped = FALSE WHERE id = :item AND user_id = :expected"),
            {"new_owner": recipient_id, "item": uid, "expected": proposer_id},
        )
        if r.rowcount != 1:
            raise HTTPException(status_code=409, detail="One of the offered items changed hands before this trade completed")
    for uid in recipient_item_ids:
        r = db.execute(
            text("UPDATE user_items SET user_id = :new_owner, equipped = FALSE WHERE id = :item AND user_id = :expected"),
            {"new_owner": proposer_id, "item": uid, "expected": recipient_id},
        )
        if r.rowcount != 1:
            raise HTTPException(status_code=409, detail="One of the requested items changed hands before this trade completed")

    # An avatar_frame item that was equipped and just moved away needs the
    # active_frame denormalized cache cleared on whichever side lost it —
    # equipped was force-cleared above, but the old-owner's cache column
    # would otherwise keep pointing at an item they no longer own.
    for owner_id in (proposer_id, recipient_id):
        stale = db.execute(
            text(
                "SELECT active_frame FROM users WHERE id = :u AND active_frame IS NOT NULL "
                "AND active_frame NOT IN (SELECT 'cosmetic_' || item_id FROM user_items WHERE user_id = :u AND category = 'avatar_frame')"
            ),
            {"u": owner_id},
        ).first()
        if stale:
            db.execute(text("UPDATE users SET active_frame = NULL WHERE id = :u"), {"u": owner_id})

    row = db.execute(text("SELECT * FROM trade_offers WHERE id = :id"), {"id": offer_id}).mappings().first()
    return {"ok": True, "offer": _offer_out(db, row)}


@router.post("/trades/{offer_id}/decline")
def decline_trade(
    offer_id: int,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    r = db.execute(
        text(
            "UPDATE trade_offers SET status = 'declined', responded_at = NOW() "
            "WHERE id = :id AND status = 'pending' AND recipient_id = :me"
        ),
        {"id": offer_id, "me": user_id},
    )
    if r.rowcount == 0:
        existing = db.execute(text("SELECT recipient_id, status FROM trade_offers WHERE id = :id"), {"id": offer_id}).mappings().first()
        if not existing:
            raise HTTPException(status_code=404, detail="Trade offer not found")
        if int(existing["recipient_id"]) != user_id:
            raise HTTPException(status_code=403, detail="Not your trade offer")
        raise HTTPException(status_code=409, detail=f"This offer is no longer pending (status: {existing['status']})")
    return {"ok": True, "status": "declined"}


@router.post("/trades/{offer_id}/cancel")
def cancel_trade(
    offer_id: int,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    r = db.execute(
        text(
            "UPDATE trade_offers SET status = 'cancelled', responded_at = NOW() "
            "WHERE id = :id AND status = 'pending' AND proposer_id = :me"
        ),
        {"id": offer_id, "me": user_id},
    )
    if r.rowcount == 0:
        existing = db.execute(text("SELECT proposer_id, status FROM trade_offers WHERE id = :id"), {"id": offer_id}).mappings().first()
        if not existing:
            raise HTTPException(status_code=404, detail="Trade offer not found")
        if int(existing["proposer_id"]) != user_id:
            raise HTTPException(status_code=403, detail="Not your trade offer")
        raise HTTPException(status_code=409, detail=f"This offer is no longer pending (status: {existing['status']})")
    return {"ok": True, "status": "cancelled"}


@router.post("/trades/{offer_id}/counter")
def counter_trade(
    offer_id: int,
    body: ProposeTradeIn,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")

    original = db.execute(text("SELECT * FROM trade_offers WHERE id = :id"), {"id": offer_id}).mappings().first()
    if not original:
        raise HTTPException(status_code=404, detail="Trade offer not found")
    if int(original["recipient_id"]) != user_id:
        raise HTTPException(status_code=403, detail="Not your trade offer")

    r = db.execute(
        text("UPDATE trade_offers SET status = 'countered', responded_at = NOW() WHERE id = :id AND status = 'pending'"),
        {"id": offer_id},
    )
    if r.rowcount == 0:
        raise HTTPException(status_code=409, detail=f"This offer is no longer pending (status: {original['status']})")

    # Roles swap: the original recipient becomes the new proposer.
    recipient_id = int(original["proposer_id"])
    if not _are_friends(db, user_id, recipient_id):
        raise HTTPException(status_code=403, detail="You can only trade with friends")

    offered = list({int(i) for i in (body.offered_item_ids or [])})
    requested = list({int(i) for i in (body.requested_item_ids or [])})
    if len(offered) > MAX_ITEMS_PER_SIDE or len(requested) > MAX_ITEMS_PER_SIDE:
        raise HTTPException(status_code=400, detail=f"A trade can include at most {MAX_ITEMS_PER_SIDE} items per side")
    if not _user_owns_items(db, user_id, offered):
        raise HTTPException(status_code=400, detail="You don't own one of the offered items (or it isn't tradeable)")
    if not _user_owns_items(db, recipient_id, requested):
        raise HTTPException(status_code=400, detail="Your friend doesn't own one of the requested items (or it isn't tradeable)")

    offered_gems = max(0, int(body.offered_gems or 0))
    requested_gems = max(0, int(body.requested_gems or 0))
    gems = db.execute(text("SELECT COALESCE(gems, 0) FROM users WHERE id = :u"), {"u": user_id}).scalar() or 0
    if offered_gems > int(gems):
        raise HTTPException(status_code=400, detail="You don't have enough gems for this offer")

    new_id = db.execute(
        text(
            """
            INSERT INTO trade_offers (proposer_id, recipient_id, proposer_gems, recipient_gems, parent_offer_id)
            VALUES (:p, :r, :pg, :rg, :parent) RETURNING id
            """
        ),
        {"p": user_id, "r": recipient_id, "pg": offered_gems, "rg": requested_gems, "parent": offer_id},
    ).scalar_one()
    _insert_offer_items(db, new_id, offered, "proposer")
    _insert_offer_items(db, new_id, requested, "recipient")

    row = db.execute(text("SELECT * FROM trade_offers WHERE id = :id"), {"id": new_id}).mappings().first()
    return {"ok": True, "offer": _offer_out(db, row)}


@router.get("/trades/friends/{friend_id}/inventory")
def friend_inventory(
    friend_id: int,
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    """Tradeable inventory of a friend, so a proposer can pick what to
    request — restricted to friends only, same trust gate as propose."""
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    if not _are_friends(db, user_id, friend_id):
        raise HTTPException(status_code=403, detail="You can only view a friend's inventory")

    rows = db.execute(
        text(
            """
            SELECT ui.id AS user_item_id, ui.item_id, ui.category, ui.equipped,
                   idf.title, idf.icon, idf.rarity, idf.render_key
            FROM user_items ui
            JOIN item_definitions idf ON idf.id = ui.item_id
            WHERE ui.user_id = :f AND idf.tradeable
            ORDER BY ui.acquired_at DESC
            """
        ),
        {"f": friend_id},
    ).mappings().all()
    return {"items": [dict(r) for r in rows]}


@router.get("/trades/incoming")
def list_incoming_trades(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    rows = db.execute(
        text("SELECT * FROM trade_offers WHERE recipient_id = :u AND status = 'pending' ORDER BY created_at DESC"),
        {"u": user_id},
    ).mappings().all()
    return {"offers": [_offer_out(db, r) for r in rows]}


@router.get("/trades/outgoing")
def list_outgoing_trades(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    rows = db.execute(
        text("SELECT * FROM trade_offers WHERE proposer_id = :u AND status = 'pending' ORDER BY created_at DESC"),
        {"u": user_id},
    ).mappings().all()
    return {"offers": [_offer_out(db, r) for r in rows]}


@router.get("/trades/history")
def list_trade_history(
    authorization: Optional[str] = Header(default=None),
    db: Connection = Depends(get_db),
):
    user_id = _get_user_id_from_bearer(authorization, db)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    rows = db.execute(
        text(
            "SELECT * FROM trade_offers WHERE (proposer_id = :u OR recipient_id = :u) AND status != 'pending' "
            "ORDER BY responded_at DESC NULLS LAST, created_at DESC LIMIT 50"
        ),
        {"u": user_id},
    ).mappings().all()
    return {"offers": [_offer_out(db, r) for r in rows]}
