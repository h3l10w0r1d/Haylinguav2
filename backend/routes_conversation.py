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
# eleven_v3 is ElevenLabs' latest flagship model with the strongest multilingual quality.
ELEVEN_MODEL_ID = os.getenv("ELEVEN_MODEL_ID", "eleven_v3")
ELEVEN_STT_MODEL = os.getenv("ELEVEN_STT_MODEL", "scribe_v1")

# Voice for Aram (male). Falls back to ELEVEN_MALE_VOICE env var or default.
ARAM_VOICE_ID = os.getenv("ELEVEN_VOICE_ID", os.getenv("ELEVEN_MALE_VOICE", "TX3LPaxmHKxFdv7VOQHJ"))

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# hispeech.ai — primary STT provider (replaces Replicate Whisper). Its
# "conversational" model transcribes exactly what's heard, which is what we
# want for grading spoken exercise answers and AI Conversation turns — not a
# cleaned-up/formalized transcript. ElevenLabs Scribe stays wired as a
# fallback (see _transcribe_hispeech callers) since it's already paid for
# and configured for TTS.
HISPEECH_API_KEY = os.getenv("HISPEECH_API_KEY", "")
HISPEECH_API_BASE = "https://api.hispeech.ai/api/v1"
HISPEECH_STT_MODEL = "model-23012026"

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


def _is_armenian(text: str) -> bool:
    """Return True if text contains at least a few Armenian characters."""
    return sum(1 for c in text if 'Ա' <= c <= '֏') >= 3


def _api_base_url() -> str:
    """Return the base URL that the outside world uses to reach this backend."""
    env = os.getenv("API_BASE_URL", "").rstrip("/")
    if env:
        return env
    render = os.getenv("RENDER_EXTERNAL_URL", "").rstrip("/")
    if render:
        return render
    return "http://localhost:8000"


async def _transcribe_hispeech(audio_bytes: bytes, filename: str = "speech.webm") -> str:
    """Transcribe via hispeech.ai's synchronous upload endpoint. Takes raw
    audio bytes directly (no need to host the file at a public URL, unlike
    Whisper). Returns "" on any failure so callers can fall through to
    ElevenLabs Scribe."""
    if not HISPEECH_API_KEY:
        return ""
    try:
        async with httpx.AsyncClient(timeout=60) as c:
            resp = await c.post(
                f"{HISPEECH_API_BASE}/transcriptions/upload",
                headers={"x-auth-token": HISPEECH_API_KEY},
                params={"stt_model": HISPEECH_STT_MODEL, "wait_for_result": "true"},
                files={"file": (filename, audio_bytes, "audio/webm")},
            )
    except Exception as exc:
        print(f"[hispeech] request failed: {exc}")
        return ""

    if resp.status_code != 200:
        print(f"[hispeech] HTTP {resp.status_code}: {resp.text[:200]}")
        return ""

    data = resp.json()
    if not data.get("success", True):
        print(f"[hispeech] error: {data.get('error')}")
        return ""
    return (data.get("transcription") or "").strip()




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
    if not OPENAI_API_KEY:
        raise HTTPException(
            status_code=503,
            detail="AI conversation is not available: OPENAI_API_KEY is not configured.",
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
        try:
            audio_bytes = base64.b64decode(body.user_audio_b64)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid base64 audio data.")

        transcription = ""

        # Primary: hispeech.ai (conversational model — transcribes exactly
        # what's heard, ideal for grading spoken Armenian)
        if HISPEECH_API_KEY:
            transcription = await _transcribe_hispeech(audio_bytes, "speech.webm")

        # Fallback: ElevenLabs Scribe
        if not transcription and ELEVEN_API_KEY:
            try:
                files = {"file": ("speech.webm", audio_bytes, "audio/webm")}
                form_data = {"model_id": ELEVEN_STT_MODEL, "language_code": "hye"}
                stt_resp = await _http.post(
                    f"{ELEVEN_API_URL}/speech-to-text",
                    headers={"xi-api-key": ELEVEN_API_KEY},
                    data=form_data,
                    files=files,
                )
                if stt_resp.status_code == 200:
                    stt_data = stt_resp.json() if stt_resp.content else {}
                    transcription = (stt_data.get("text") or "").strip()
            except Exception as exc:
                print(f"[stt fallback] ElevenLabs error: {exc}")

        user_transcription = transcription
        user_text = transcription

    # ------------------------------------------------------------------ #
    # 2. Build Claude messages (keep last 10)
    # ------------------------------------------------------------------ #
    beginner_note = "Use only extremely simple, everyday Armenian words. Short sentences." if body.user_level == "beginner" else ""
    system_prompt = f"""You are Aram (Արամ), a friendly 25-year-old from Yerevan helping someone practice Armenian.
Scenario: "{scenario_title_en}" — Goal: {scenario_goal}

⚠️ ABSOLUTE RULE: Your response text MUST be written ONLY in Armenian (Eastern Armenian / հայերեն script).
NEVER write Chinese, English, Russian, or ANY other language in the response body.
If you don't know a word in Armenian, use a simpler Armenian word instead.
Violation of this rule is not acceptable under any circumstances.

Style: {beginner_note} Keep responses to 1-2 sentences maximum. Be warm and encouraging.
Stay in character and in the scenario at all times.
If the user sends an empty or greeting message, naturally open the scenario as Aram.

FORMAT — output exactly these three lines, nothing else:
<your 1-2 sentence Armenian response — Armenian script ONLY>
[EN: English translation of what you said]
[CORRECT: one short English correction of the user's Armenian, or "none"]"""

    # Trim to last 10 messages
    recent_messages = list(body.messages)[-10:]

    # Append the new user message (if any)
    messages_for_claude = list(recent_messages)
    if user_text:
        messages_for_claude.append({"role": "user", "content": user_text})
    elif not messages_for_claude:
        # First turn — nudge Aram to open the conversation
        messages_for_claude.append({"role": "user", "content": "Բարև"})

    # Build OpenAI messages (system + history)
    openai_messages = [{"role": "system", "content": system_prompt}] + messages_for_claude

    try:
        gpt_resp = await _http.post(
            "https://api.openai.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENAI_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": "gpt-4o",
                "max_tokens": 256,
                "temperature": 0.7,
                "messages": openai_messages,
            },
            timeout=30,
        )
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"OpenAI request failed: {exc}")

    if gpt_resp.status_code != 200:
        body_text = (gpt_resp.text or "")[:400]
        raise HTTPException(status_code=gpt_resp.status_code, detail=f"OpenAI error: {body_text}")

    gpt_data = gpt_resp.json()
    full_response = (gpt_data.get("choices") or [{}])[0].get("message", {}).get("content", "")
    armenian_text, english_translation, corrections = _parse_claude_response(full_response)

    # Guard: if the extracted text doesn't look Armenian, the model drifted languages.
    # Return a safe fallback so we don't TTS Chinese/Russian/etc. to the user.
    if armenian_text and not _is_armenian(armenian_text):
        print(f"[conv] language drift detected — got non-Armenian text: {armenian_text[:80]}")
        armenian_text = "Կներեք, եկեք նորից սկսենք:"
        english_translation = "Sorry, let's start again."
        corrections = []

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
        tts_params = {"output_format": "mp3_44100_128"}  # ElevenLabs takes this as a query param, not body
        tts_payload = {
            "text": armenian_text,
            "model_id": ELEVEN_MODEL_ID,
            # Kept in sync with routes.py's _DEFAULT_TTS_VOICE_SETTINGS — style=0.0
            # (the old value) disables all expressive inflection, which reads as
            # flat/robotic; a modest style weight sounds far more natural.
            "voice_settings": {
                "stability": 0.45,
                "similarity_boost": 0.8,
                "style": 0.25,
                "use_speaker_boost": True,
            },
        }
        try:
            tts_resp = await _http.post(tts_url, headers=tts_headers, params=tts_params, json=tts_payload)

            # Recover from invalid voice_id (404) by using first available voice.
            if tts_resp.status_code == 404:
                voices_resp = await _http.get(f"{ELEVEN_API_URL}/voices", headers=tts_headers)
                if voices_resp.status_code == 200:
                    voices = (voices_resp.json() or {}).get("voices") or []
                    if voices:
                        fallback_id = voices[0].get("voice_id") or voices[0].get("id")
                        if fallback_id:
                            tts_url2 = f"{ELEVEN_API_URL}/text-to-speech/{fallback_id}"
                            tts_resp = await _http.post(tts_url2, headers=tts_headers, params=tts_params, json=tts_payload)

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

    return ConversationTurnResponse(
        assistant_text=armenian_text,
        assistant_text_latin=None,
        translation=english_translation,
        user_transcription=user_transcription,
        video_url=None,
        video_prediction_id=None,
        audio_url=audio_url,
        is_complete=is_complete,
        corrections=corrections,
    )


@router.get("/conversation/video/{prediction_id}")
async def poll_video(prediction_id: str, user=Depends(get_current_user)):
    """Video generation has been replaced with in-browser audio animation. Always returns failed."""
    return {"status": "failed", "video_url": None}
