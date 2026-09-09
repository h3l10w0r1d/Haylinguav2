# backend/routes_typing.py
"""Armenian typing trainer + live multiplayer races.

Public and unauthenticated by design — anyone can practise or race without an
account (they just pick a nickname). A logged-in Haylingua user who passes
their normal Bearer token races under their real display name instead, and
their results are attributed to their user_id.

RACE STATE IS IN-MEMORY, ON PURPOSE, WITH A KNOWN CEILING: `_rooms` below
lives in this process. That is correct for a single web instance (what we run
today) and silently WRONG the moment the service scales to two — players
would land on different instances and never see each other. There is no
Redis in this stack to pub/sub through, and adding one for a typing game
isn't worth it yet. If we ever scale the web service horizontally, this must
move to Redis pub/sub (or the races must be pinned to one instance). Finished
results ARE persisted (typing_results), so leaderboards survive restarts even
though in-flight races don't.
"""
from __future__ import annotations

import asyncio
import json
import random
import time
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, Query, WebSocket, WebSocketDisconnect
from sqlalchemy import text
from sqlalchemy.engine import Connection

from database import get_db, engine

router = APIRouter(tags=["typing"])

# ── Race texts ────────────────────────────────────────────────────────────
# Standard Eastern Armenian. Kept short (a race should last ~30-60s) and
# built from everyday vocabulary the rest of the course already teaches, so
# racing doubles as review rather than throwing unfamiliar words at people.
RACE_TEXTS = [
    "Բարև ձեզ, ինչպես եք այսօր",
    "Ես սովորում եմ հայերեն ամեն օր",
    "Այս գիրքը շատ հետաքրքիր է",
    "Երևանը Հայաստանի մայրաքաղաքն է",
    "Շնորհակալություն օգնության համար",
    "Առավոտյան սուրճ եմ խմում",
    "Իմ ընտանիքը շատ մեծ է",
    "Այսօր եղանակը շատ լավ է",
    "Ես սիրում եմ հայկական երաժշտություն",
    "Դպրոցը գտնվում է քաղաքի կենտրոնում",
    "Մենք միասին ճաշում ենք",
    "Նա գրում է նամակ իր ընկերոջը",
]

# Progressive drills for practice mode: each level introduces a small set of
# letters and only uses letters from its own and earlier levels, so a learner
# builds the layout up gradually instead of hunting all 39 from lesson one.
PRACTICE_LEVELS = [
    {"id": 1, "name": "First letters", "letters": "ա ս դ ֆ", "drills": ["ասդ ֆաս դաս ֆադ", "սաս դադ ֆաֆ ասա", "դաս ֆաս սադ ադա"]},
    {"id": 2, "name": "More basics", "letters": "գ հ յ կ", "drills": ["գահ յակ կահ գայ", "հագ կայ յագ հակ", "գակ հայ կագ յահ"]},
    {"id": 3, "name": "Common consonants", "letters": "մ ն ր լ", "drills": ["մեր ներ լար ման", "նամ լամ րամ մար", "լեն մեն ներ ռամ"]},
    {"id": 4, "name": "Vowels", "letters": "ե ի ո ու", "drills": ["իմ ես ով ուր", "որ ինչ ուրախ երբ", "ոսկի իրիկուն ուժ"]},
    {"id": 5, "name": "Real words", "letters": "all", "drills": ["բարև շնորհակալություն", "ընկեր ուսուցիչ դպրոց", "հաց ջուր կաթ պանիր"]},
    {"id": 6, "name": "Full sentences", "letters": "all", "drills": ["Ես սովորում եմ հայերեն", "Այսօր եղանակը լավ է", "Բարև ձեզ ինչպես եք"]},
]

_MAX_PLAYERS = 5
_COUNTDOWN_SECONDS = 5
_SOLO_START_AFTER = 12  # a lone racer shouldn't wait forever


@router.get("/typing/texts")
def typing_texts():
    """Practice-mode content. Public, no auth."""
    return {"race_texts": RACE_TEXTS, "levels": PRACTICE_LEVELS}


def _display_name_for_token(authorization: Optional[str]) -> tuple[Optional[int], Optional[str]]:
    """Best-effort identity from a Bearer token. Never raises: an invalid or
    expired token just means 'anonymous', because this feature must keep
    working for logged-out visitors."""
    if not authorization:
        return None, None
    try:
        # Imported lazily — routes.py is heavy and this module is imported at
        # app startup, before that import graph is warm.
        from routes import _get_user_id_from_bearer

        with engine.begin() as conn:
            user_id = _get_user_id_from_bearer(authorization, conn)
            if user_id is None:
                return None, None
            row = conn.execute(
                text("SELECT display_name, username, name FROM users WHERE id = :id"),
                {"id": user_id},
            ).mappings().first()
            if not row:
                return None, None
            name = (row.get("display_name") or row.get("username") or row.get("name") or "").strip()
            return user_id, (name or None)
    except Exception:
        return None, None


def _record_result(user_id: Optional[int], name: str, wpm: float, accuracy: float, mode: str) -> None:
    try:
        with engine.begin() as conn:
            conn.execute(
                text("""
                    INSERT INTO typing_results (user_id, display_name, wpm, accuracy, mode)
                    VALUES (:uid, :name, :wpm, :acc, :mode)
                """),
                {"uid": user_id, "name": name[:40], "wpm": round(wpm, 2), "acc": round(accuracy, 2), "mode": mode},
            )
    except Exception:
        # A dropped score must never break a race or a practice run.
        pass


@router.post("/typing/result")
def submit_result(
    payload: dict,
    authorization: Optional[str] = None,
    db: Connection = Depends(get_db),
):
    """Practice-mode result submission (races persist themselves server-side)."""
    try:
        wpm = float(payload.get("wpm") or 0)
        accuracy = float(payload.get("accuracy") or 0)
    except (TypeError, ValueError):
        return {"ok": False}
    # Reject implausible values rather than letting them poison the board.
    if not (0 < wpm < 300) or not (0 <= accuracy <= 100):
        return {"ok": False}
    name = str(payload.get("name") or "Anonymous")[:40]
    user_id, real_name = _display_name_for_token(authorization)
    _record_result(user_id, real_name or name, wpm, accuracy, "practice")
    return {"ok": True}


@router.get("/typing/leaderboard")
def leaderboard(range: str = Query(default="today"), db: Connection = Depends(get_db)):
    where = "WHERE created_at >= NOW() - INTERVAL '1 day'" if range == "today" else ""
    try:
        rows = db.execute(text(f"""
            SELECT display_name, wpm, accuracy, mode, created_at
            FROM typing_results
            {where}
            ORDER BY wpm DESC
            LIMIT 20
        """)).mappings().all()
        return {"entries": [dict(r) for r in rows]}
    except Exception:
        return {"entries": []}


# ── Live race engine ──────────────────────────────────────────────────────

class Player:
    def __init__(self, ws: WebSocket, name: str, user_id: Optional[int]):
        self.ws = ws
        self.id = uuid.uuid4().hex[:8]
        self.name = name
        self.user_id = user_id
        self.progress = 0.0     # 0..1
        self.wpm = 0.0
        self.accuracy = 100.0
        self.finished_at: Optional[float] = None


class Room:
    def __init__(self):
        self.id = uuid.uuid4().hex[:8]
        self.players: dict[str, Player] = {}
        self.text = random.choice(RACE_TEXTS)
        self.status = "waiting"   # waiting | countdown | racing | done
        self.started_at: Optional[float] = None
        self.created_at = time.time()
        self._task: Optional[asyncio.Task] = None

    def snapshot(self) -> list[dict]:
        ordered = sorted(
            self.players.values(),
            key=lambda p: (p.finished_at is None, p.finished_at or 0, -p.progress),
        )
        return [
            {"id": p.id, "name": p.name, "progress": round(p.progress, 3),
             "wpm": round(p.wpm, 1), "accuracy": round(p.accuracy, 1),
             "finished": p.finished_at is not None}
            for p in ordered
        ]


_rooms: dict[str, Room] = {}
_lock = asyncio.Lock()


async def _broadcast(room: Room, message: dict) -> None:
    dead = []
    payload = json.dumps(message)
    for p in list(room.players.values()):
        try:
            await p.ws.send_text(payload)
        except Exception:
            dead.append(p.id)
    for pid in dead:
        room.players.pop(pid, None)


async def _open_room() -> Room:
    """The single global matchmaking pool: reuse any room still accepting
    players, otherwise open a new one."""
    for room in _rooms.values():
        if room.status == "waiting" and len(room.players) < _MAX_PLAYERS:
            return room
    room = Room()
    _rooms[room.id] = room
    return room


async def _run_race(room: Room) -> None:
    """Countdown → race → results. One task per room."""
    try:
        # Give a lone player a window for someone else to show up, then start
        # anyway so a quiet moment doesn't mean an empty screen forever.
        waited = 0
        while room.status == "waiting" and len(room.players) < 2 and waited < _SOLO_START_AFTER:
            await asyncio.sleep(1)
            waited += 1
            if not room.players:
                room.status = "done"
                return
        if not room.players:
            room.status = "done"
            return

        room.status = "countdown"
        for n in range(_COUNTDOWN_SECONDS, 0, -1):
            await _broadcast(room, {"type": "countdown", "seconds": n, "text": room.text,
                                    "players": room.snapshot()})
            await asyncio.sleep(1)
            if not room.players:
                room.status = "done"
                return

        room.status = "racing"
        room.started_at = time.time()
        await _broadcast(room, {"type": "start", "text": room.text, "players": room.snapshot()})

        # Tick until everyone finishes or the race times out.
        while room.status == "racing":
            await asyncio.sleep(0.4)
            if not room.players:
                break
            everyone_done = all(p.finished_at is not None for p in room.players.values())
            timed_out = time.time() - (room.started_at or 0) > 180
            await _broadcast(room, {"type": "progress", "players": room.snapshot()})
            if everyone_done or timed_out:
                break

        room.status = "done"
        await _broadcast(room, {"type": "results", "players": room.snapshot()})
    except asyncio.CancelledError:
        raise
    except Exception:
        room.status = "done"
    finally:
        _rooms.pop(room.id, None)


@router.websocket("/ws/typing-race")
async def typing_race(ws: WebSocket):
    await ws.accept()
    room: Optional[Room] = None
    me: Optional[Player] = None
    try:
        # First message must be the join handshake.
        raw = await asyncio.wait_for(ws.receive_text(), timeout=20)
        hello = json.loads(raw)
        name = str(hello.get("name") or "").strip()[:24] or "Anonymous"
        token = hello.get("token")
        user_id, real_name = _display_name_for_token(f"Bearer {token}" if token else None)
        if real_name:
            name = real_name[:24]

        async with _lock:
            room = await _open_room()
            me = Player(ws, name, user_id)
            room.players[me.id] = me
            fresh = room._task is None
            if fresh:
                room._task = asyncio.create_task(_run_race(room))

        await ws.send_text(json.dumps({
            "type": "joined", "raceId": room.id, "youId": me.id,
            "authed": user_id is not None, "players": room.snapshot(),
        }))
        await _broadcast(room, {"type": "lobby", "players": room.snapshot()})

        while True:
            msg = json.loads(await ws.receive_text())
            kind = msg.get("type")
            if kind == "progress" and room.status == "racing":
                try:
                    me.progress = max(0.0, min(1.0, float(msg.get("progress") or 0)))
                    me.wpm = max(0.0, min(300.0, float(msg.get("wpm") or 0)))
                    me.accuracy = max(0.0, min(100.0, float(msg.get("accuracy") or 0)))
                except (TypeError, ValueError):
                    pass
            elif kind == "finish" and me.finished_at is None:
                me.finished_at = time.time()
                me.progress = 1.0
                try:
                    me.wpm = max(0.0, min(300.0, float(msg.get("wpm") or 0)))
                    me.accuracy = max(0.0, min(100.0, float(msg.get("accuracy") or 0)))
                except (TypeError, ValueError):
                    pass
                _record_result(me.user_id, me.name, me.wpm, me.accuracy, "race")
                await _broadcast(room, {"type": "progress", "players": room.snapshot()})
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    except Exception:
        pass
    finally:
        if room and me:
            room.players.pop(me.id, None)
            if room.players:
                try:
                    await _broadcast(room, {"type": "lobby", "players": room.snapshot()})
                except Exception:
                    pass
