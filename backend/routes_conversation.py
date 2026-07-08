# backend/routes_conversation.py
"""
AI Conversation feature — Aram the Armenian tutor.

Endpoints:
  GET  /conversation/characters       — list available characters
  GET  /conversation/scenarios        — list conversation scenarios
  POST /conversation/turn             — main chat turn (Claude + TTS + SadTalker)
  GET  /conversation/video/{pred_id}  — poll SadTalker prediction status
"""

import base64
import json
import os
import re
import uuid
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

# Load .env file if present (no-op when env vars are already set by the host).
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from auth import get_current_user

router = APIRouter()

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

ELEVEN_API_KEY = (
    os.getenv("ELEVENLABS_API_KEY")
    or os.getenv("ELEVEN_LABS_API_KEY")
    or os.getenv("eleven_labs.io")
    or ""
)
ELEVEN_API_URL = "https://api.elevenlabs.io/v1"
ELEVEN_MODEL_ID = os.getenv("ELEVEN_MODEL_ID", "eleven_turbo_v2_5")
ELEVEN_STT_MODEL = os.getenv("ELEVEN_STT_MODEL", "scribe_v1")

# Voice for Aram (male). Falls back to ELEVEN_MALE_VOICE env var or default.
ARAM_VOICE_ID = os.getenv("ELEVEN_VOICE_ID", os.getenv("ELEVEN_MALE_VOICE", "pNInz6obpgDQGcFmaJgB"))

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN", "")

# Hardcoded SadTalker version (lucataco/sadtalker on Replicate).
SADTALKER_VERSION = "85c698db7c0a66d5011435d0191db323034e1da0"

# Portrait image URL used as SadTalker source_image (must be publicly reachable).
# In production: https://haylingua.am/characters/aram.png
# In local dev:  http://localhost:5173/characters/aram.png (Vite serves public/)
ARAM_PORTRAIT_URL = os.getenv("ARAM_PORTRAIT_URL", "https://haylingua.am/characters/aram.png")

# Persistent HTTP client shared across all requests.
_http = httpx.AsyncClient(
    timeout=httpx.Timeout(connect=5.0, read=60.0, write=15.0, pool=5.0),
    limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
)

# Where to save conversation audio so SadTalker can fetch a public URL.
# main.py mounts this directory at /static/conv-audio.
_UPLOADS_DIR: Optional[str] = None


def _get_uploads_dir() -> str:
    """Mirror of main.py's _uploads_dir() logic — find a writable directory."""
    global _UPLOADS_DIR
    if _UPLOADS_DIR is not None:
        return _UPLOADS_DIR

    candidates = []
    env = os.getenv("UPLOADS_DIR")
    if env:
        candidates.append(env)
    candidates.append("/var/data/uploads")
    candidates.append("uploads")

    for p in candidates:
        try:
            os.makedirs(p, exist_ok=True)
        except (PermissionError, OSError):
            continue
        if os.access(p, os.W_OK):
            _UPLOADS_DIR = p
            return p

    _UPLOADS_DIR = "uploads"
    return _UPLOADS_DIR


def _conv_audio_dir() -> str:
    d = os.path.join(_get_uploads_dir(), "conversation_audio")
    os.makedirs(d, exist_ok=True)
    return d


# ---------------------------------------------------------------------------
# Static data
# ---------------------------------------------------------------------------

CHARACTERS = [
    {
        "id": "aram",
        "name": "Արամ",
        "name_en": "Aram",
        "description": "A friendly 25-year-old from Yerevan",
        "portrait_url": "/characters/aram.png",
        "voice_id": None,  # uses ARAM_VOICE_ID
        "level": "beginner",
    }
]

SCENARIOS = [
    {
        "id": "cafe",
        "title": "Սրճարանում",
        "title_en": "At the café",
        "goal": "Order a coffee and ask for the bill",
        "icon": "☕",
    },
    {
        "id": "market",
        "title": "Շուկայում",
        "title_en": "At the market",
        "goal": "Buy fruit and negotiate the price",
        "icon": "🍎",
    },
    {
        "id": "directions",
        "title": "Ճանապարհ",
        "title_en": "Asking for directions",
        "goal": "Find the nearest metro station",
        "icon": "🗺️",
    },
    {
        "id": "meeting",
        "title": "Ծանոթություն",
        "title_en": "Meeting someone",
        "goal": "Introduce yourself and learn about them",
        "icon": "👋",
    },
]

_SCENARIO_MAP = {s["id"]: s for s in SCENARIOS}

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------


class ConversationTurnRequest(BaseModel):
    session_id: str
    character_id: str = "aram"
    scenario_id: str = "cafe"
    messages: list[dict]  # [{role: "user"|"assistant", content: str}]
    user_text: Optional[str] = None
    user_audio_b64: Optional[str] = None
    user_level: str = "beginner"
    generate_video: bool = True


class ConversationTurnResponse(BaseModel):
    assistant_text: str
    assistant_text_latin: Optional[str] = None
    translation: str
    user_transcription: Optional[str] = None
    video_url: Optional[str] = None
    video_prediction_id: Optional[str] = None
    audio_url: Optional[str] = None
    is_complete: bool = False
    corrections: list[str] = []


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _parse_claude_response(full_text: str) -> tuple[str, str, list[str]]:
    """
    Parse Claude's structured response.

    Expected format:
        <Armenian text>
        [EN: English translation]
        [CORRECT: correction or "none"]

    Returns (armenian_text, english_translation, corrections_list).
    """
    armenian_text = full_text
    english_translation = ""
    corrections: list[str] = []

    # Extract [EN: ...]
    en_match = re.search(r"\[EN:\s*(.*?)\]", full_text, re.IGNORECASE | re.DOTALL)
    if en_match:
        english_translation = en_match.group(1).strip()
        armenian_text = full_text[: en_match.start()].strip()

    # Extract [CORRECT: ...]
    corr_match = re.search(r"\[CORRECT:\s*(.*?)\]", full_text, re.IGNORECASE | re.DOTALL)
    if corr_match:
        corr_text = corr_match.group(1).strip()
        if corr_text.lower() not in ("none", "n/a", ""):
            corrections = [corr_text]
        # Strip [CORRECT: ...] from armenian_text in case it leaked in
        armenian_text = re.sub(r"\[CORRECT:.*?\]", "", armenian_text, flags=re.IGNORECASE | re.DOTALL).strip()

    # Clean any remaining brackets from the Armenian text
    armenian_text = re.sub(r"\[EN:.*?\]", "", armenian_text, flags=re.IGNORECASE | re.DOTALL).strip()

    return armenian_text, english_translation, corrections


def _api_base_url() -> str:
    """Return the base URL that the outside world uses to reach this backend."""
    env = os.getenv("API_BASE_URL", "").rstrip("/")
    if env:
        return env
    # Render sets RENDER_EXTERNAL_URL for web services.
    render = os.getenv("RENDER_EXTERNAL_URL", "").rstrip("/")
    if render:
        return render
    return "http://localhost:8000"


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/conversation/characters")
async def list_characters():
    return {"characters": CHARACTERS}


@router.get("/conversation/scenarios")
async def list_scenarios():
    return {"scenarios": SCENARIOS}


@router.post("/conversation/turn", response_model=ConversationTurnResponse)
async def conversation_turn(
    body: ConversationTurnRequest,
    user=Depends(get_current_user),
):
    # ------------------------------------------------------------------ #
    # 0. Validate
    # ------------------------------------------------------------------ #
    if not ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="AI conversation is not available: ANTHROPIC_API_KEY is not configured.",
        )

    scenario = _SCENARIO_MAP.get(body.scenario_id, SCENARIOS[0])
    scenario_title_en = scenario["title_en"]
    scenario_goal = scenario["goal"]

    user_transcription: Optional[str] = None
    user_text = (body.user_text or "").strip()

    # ------------------------------------------------------------------ #
    # 1. Transcribe audio (if provided)
    # ------------------------------------------------------------------ #
    if body.user_audio_b64:
        if not ELEVEN_API_KEY:
            raise HTTPException(status_code=400, detail="STT is not configured (ELEVENLABS_API_KEY missing).")
        try:
            audio_bytes = base64.b64decode(body.user_audio_b64)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid base64 audio data.")

        files = {"file": ("speech.webm", audio_bytes, "audio/webm")}
        form_data = {"model_id": ELEVEN_STT_MODEL, "language_code": "hye"}
        try:
            stt_resp = await _http.post(
                f"{ELEVEN_API_URL}/speech-to-text",
                headers={"xi-api-key": ELEVEN_API_KEY},
                data=form_data,
                files=files,
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"STT request failed: {exc}")

        if stt_resp.status_code != 200:
            body_text = (stt_resp.text or "")[:300]
            raise HTTPException(status_code=stt_resp.status_code, detail=f"STT error: {body_text}")

        stt_data = stt_resp.json() if stt_resp.content else {}
        user_transcription = (stt_data.get("text") or "").strip()
        user_text = user_transcription

    # ------------------------------------------------------------------ #
    # 2. Build Claude messages (keep last 10)
    # ------------------------------------------------------------------ #
    system_prompt = f"""You are Aram (Արամ), a friendly 25-year-old Armenian from Yerevan.
You are helping someone learn Armenian through a conversation scenario: "{scenario_title_en}".

Rules:
- Speak ONLY in Armenian (Eastern Armenian / հայերեն)
- Keep responses SHORT: 1-2 sentences maximum
- If the user makes a mistake in Armenian, gently correct them at the end of your message in parentheses in English
- Match the user's level: {body.user_level} (beginner = very simple words, lots of patience)
- For beginners: use very common everyday words only
- Scenario goal: {scenario_goal}
- Always stay in character and in the scenario
- If the user sends an empty message, start the conversation naturally as Aram

After your Armenian response (on a new line), write:
[EN: English translation of what you just said]
[CORRECT: any correction of user Armenian, or "none"]"""

    # Trim to last 10 messages
    recent_messages = list(body.messages)[-10:]

    # Append the new user message (if any)
    messages_for_claude = list(recent_messages)
    if user_text:
        messages_for_claude.append({"role": "user", "content": user_text})
    elif not messages_for_claude:
        # First turn — nudge Aram to open the conversation
        messages_for_claude.append({"role": "user", "content": "Բարև"})

    try:
        claude_resp = await _http.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-haiku-4-5-20251001",
                "max_tokens": 256,
                "system": system_prompt,
                "messages": messages_for_claude,
            },
            timeout=30,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Claude request failed: {exc}")

    if claude_resp.status_code != 200:
        body_text = (claude_resp.text or "")[:400]
        raise HTTPException(status_code=claude_resp.status_code, detail=f"Claude error: {body_text}")

    claude_data = claude_resp.json()
    full_response = (claude_data.get("content") or [{}])[0].get("text", "")
    armenian_text, english_translation, corrections = _parse_claude_response(full_response)

    # Simple heuristic: consider conversation complete if Aram's reply contains
    # keywords that suggest the goal was achieved.
    is_complete = any(
        kw in full_response.lower()
        for kw in ["շնորհակալություն", "հաջողություն", "ցտեսություն", "well done", "completed", "goal achieved"]
    )

    # ------------------------------------------------------------------ #
    # 3. Generate TTS audio
    # ------------------------------------------------------------------ #
    audio_url: Optional[str] = None
    audio_file_path: Optional[str] = None

    if ELEVEN_API_KEY and armenian_text:
        tts_url = f"{ELEVEN_API_URL}/text-to-speech/{ARAM_VOICE_ID}"
        tts_headers = {"xi-api-key": ELEVEN_API_KEY, "Content-Type": "application/json"}
        tts_payload = {
            "text": armenian_text,
            "model_id": ELEVEN_MODEL_ID,
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
                "style": 0.0,
                "use_speaker_boost": True,
            },
        }
        try:
            tts_resp = await _http.post(tts_url, headers=tts_headers, json=tts_payload)

            # Recover from invalid voice_id (404) by using first available voice.
            if tts_resp.status_code == 404:
                voices_resp = await _http.get(f"{ELEVEN_API_URL}/voices", headers=tts_headers)
                if voices_resp.status_code == 200:
                    voices = (voices_resp.json() or {}).get("voices") or []
                    if voices:
                        fallback_id = voices[0].get("voice_id") or voices[0].get("id")
                        if fallback_id:
                            tts_url2 = f"{ELEVEN_API_URL}/text-to-speech/{fallback_id}"
                            tts_resp = await _http.post(tts_url2, headers=tts_headers, json=tts_payload)

            if tts_resp.status_code == 200:
                audio_bytes = tts_resp.content
                audio_filename = f"{uuid.uuid4().hex}.mp3"
                audio_dir = _conv_audio_dir()
                audio_file_path = os.path.join(audio_dir, audio_filename)
                with open(audio_file_path, "wb") as f:
                    f.write(audio_bytes)
                audio_url = f"{_api_base_url()}/static/conv-audio/{audio_filename}"
        except Exception as exc:
            # TTS failure is non-fatal; conversation still works without audio.
            print(f"[conv TTS] error: {exc}")

    # ------------------------------------------------------------------ #
    # 4. Generate SadTalker video (async, return prediction_id for polling)
    # ------------------------------------------------------------------ #
    video_prediction_id: Optional[str] = None

    if body.generate_video and REPLICATE_API_TOKEN and audio_url:
        try:
            async with httpx.AsyncClient(timeout=30) as c:
                pred_resp = await c.post(
                    "https://api.replicate.com/v1/predictions",
                    headers={
                        "Authorization": f"Token {REPLICATE_API_TOKEN}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "version": SADTALKER_VERSION,
                        "input": {
                            "source_image": ARAM_PORTRAIT_URL,
                            "driven_audio": audio_url,
                            "preprocess": "crop",
                            "still_mode": True,
                            "use_enhancer": False,
                            "size": 256,
                        },
                    },
                )
            if pred_resp.status_code in (200, 201):
                prediction = pred_resp.json()
                video_prediction_id = prediction.get("id")
            else:
                print(f"[sadtalker] prediction start HTTP {pred_resp.status_code}: {pred_resp.text[:200]}")
        except Exception as exc:
            print(f"[sadtalker] prediction start failed: {exc}")

    return ConversationTurnResponse(
        assistant_text=armenian_text,
        assistant_text_latin=None,
        translation=english_translation,
        user_transcription=user_transcription,
        video_url=None,  # not yet — client polls /conversation/video/{id}
        video_prediction_id=video_prediction_id,
        audio_url=audio_url,
        is_complete=is_complete,
        corrections=corrections,
    )


@router.get("/conversation/video/{prediction_id}")
async def poll_video(prediction_id: str, user=Depends(get_current_user)):
    """Poll SadTalker prediction status."""
    if not REPLICATE_API_TOKEN:
        raise HTTPException(status_code=503, detail="REPLICATE_API_TOKEN not configured.")

    # Basic validation — Replicate IDs are alphanumeric.
    if not re.match(r"^[a-zA-Z0-9]+$", prediction_id):
        raise HTTPException(status_code=400, detail="Invalid prediction_id.")

    try:
        async with httpx.AsyncClient(timeout=10) as c:
            resp = await c.get(
                f"https://api.replicate.com/v1/predictions/{prediction_id}",
                headers={"Authorization": f"Token {REPLICATE_API_TOKEN}"},
            )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Replicate poll failed: {exc}")

    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Failed to fetch prediction.")

    data = resp.json()
    status = data.get("status")  # "starting" | "processing" | "succeeded" | "failed"
    output = data.get("output")
    # SadTalker output can be a string URL or a list; normalise to a single URL.
    video_url: Optional[str] = None
    if status == "succeeded" and output:
        if isinstance(output, list):
            video_url = output[0] if output else None
        else:
            video_url = str(output)

    return {"status": status, "video_url": video_url}
