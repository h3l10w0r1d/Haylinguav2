"""
backend/routes_audio.py
Audio management for exercises - supports TTS generation, custom uploads, and browser recordings
"""
import os
from typing import Optional, Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.engine import Connection

from database import get_db

router = APIRouter()


@router.get("/cms/audio/config")

def get_audio_config():
    """Non-sensitive audio/TTS configuration for the CMS UI."""
    return {
        "tts_enabled": bool(ELEVEN_API_KEY),
        "provider": "elevenlabs",
        "model_id": ELEVEN_MODEL_ID,
        "male_voice_id": MALE_VOICE_ID,
        "female_voice_id": FEMALE_VOICE_ID,
    }


# ElevenLabs configuration
ELEVEN_API_KEY = (
    os.getenv("ELEVENLABS_API_KEY")
    or os.getenv("ELEVEN_LABS_API_KEY")
    or os.getenv("eleven_labs.io")
    or ""
)
ELEVEN_API_URL = "https://api.elevenlabs.io/v1"

# ElevenLabs TTS defaults (override via Render env vars)
# Model IDs are defined by ElevenLabs; as of Feb 2026, Eleven v3 uses `eleven_v3`.
ELEVEN_MODEL_ID = os.getenv("ELEVEN_MODEL_ID", "eleven_v3")

def _env_float(name: str, default: float) -> float:
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    try:
        return float(raw)
    except Exception:
        return default

def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "y", "on"}

ELEVEN_STABILITY = _env_float("ELEVEN_STABILITY", 0.5)
ELEVEN_SIMILARITY_BOOST = _env_float("ELEVEN_SIMILARITY_BOOST", 0.75)
ELEVEN_STYLE = _env_float("ELEVEN_STYLE", 0.0)
ELEVEN_USE_SPEAKER_BOOST = _env_bool("ELEVEN_USE_SPEAKER_BOOST", True)

# Default voice IDs
MALE_VOICE_ID = os.getenv("ELEVEN_MALE_VOICE", "pNInz6obpgDQGcFmaJgB")
FEMALE_VOICE_ID = os.getenv("ELEVEN_FEMALE_VOICE", "EXAVITQu4vr4xnSDxMaL")

MAX_AUDIO_SIZE = 10 * 1024 * 1024  # 10MB


class GenerateTTSRequest(BaseModel):
    exercise_id: int
    text: str
    voice_type: Literal["male", "female"]


class GenerateTargetTTSRequest(BaseModel):
    exercise_id: int
    target_key: str
    text: str
    voice_type: Literal["male", "female"]


async def generate_elevenlabs_tts(text: str, voice_id: str) -> bytes:
    if not ELEVEN_API_KEY:
        raise HTTPException(status_code=400, detail="ElevenLabs API key not configured")
    
    url = f"{ELEVEN_API_URL}/text-to-speech/{voice_id}"
    headers = {"xi-api-key": ELEVEN_API_KEY, "Content-Type": "application/json"}
    payload = {
        "text": text,
        "model_id": ELEVEN_MODEL_ID,
        "voice_settings": {
            "stability": ELEVEN_STABILITY,
            "similarity_boost": ELEVEN_SIMILARITY_BOOST,
            "style": ELEVEN_STYLE,
            "use_speaker_boost": ELEVEN_USE_SPEAKER_BOOST,
        },
    }
    
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(url, headers=headers, json=payload)

        # If the API key belongs to a different workspace/account, a hard-coded voice_id
        # can become invalid -> ElevenLabs responds 404 (voice not found).
        # We try to recover by selecting the first available voice for that API key.
        if response.status_code == 404:
            try:
                voices_resp = await client.get(f"{ELEVEN_API_URL}/voices", headers=headers)
                if voices_resp.status_code == 200:
                    voices_data = voices_resp.json() or {}
                    voices = voices_data.get("voices") or []
                    if voices:
                        fallback_voice_id = voices[0].get("voice_id") or voices[0].get("id")
                        if fallback_voice_id and fallback_voice_id != voice_id:
                            url2 = f"{ELEVEN_API_URL}/text-to-speech/{fallback_voice_id}"
                            response = await client.post(url2, headers=headers, json=payload)
            except Exception:
                # If recovery fails, we'll return the original error below.
                pass

        if response.status_code != 200:
            # keep it short, but useful (Eleven can return HTML on errors sometimes)
            body = (response.text or "").strip()
            if len(body) > 600:
                body = body[:600] + "…"
            raise HTTPException(
                response.status_code,
                f"ElevenLabs error ({response.status_code}). voice_id={voice_id}. body={body}",
            )

        return response.content


@router.get("/cms/exercises/{exercise_id}/audio")
def get_exercise_audio_list(exercise_id: int, db: Connection = Depends(get_db)):
    rows = db.execute(
        text("""
            SELECT id, voice_type, source_type, audio_format, audio_size,
                   duration_seconds, tts_text IS NOT NULL as has_tts_text, created_at
            FROM exercise_audio WHERE exercise_id = :exercise_id
            ORDER BY voice_type, source_type
        """),
        {"exercise_id": exercise_id}
    ).mappings().all()
    
    return {"audio_recordings": [dict(r) for r in rows]}


# ------------------------------
# Target audio (Duolingo-like)
# ------------------------------


@router.get("/cms/audio/targets/{exercise_id}")
def cms_list_audio_targets(
    exercise_id: int,
    target_key: Optional[str] = None,
    db: Connection = Depends(get_db),
):
    """List stored audio for an exercise (optionally filtered by target_key)."""
    rows = db.execute(
        text(
            """
            SELECT id, exercise_id, target_key, voice_type, source_type,
                   audio_format, audio_size, file_path,
                   created_at, updated_at
            FROM exercise_audio_targets
            WHERE exercise_id = :exercise_id
              AND (:target_key IS NULL OR target_key = :target_key)
            ORDER BY target_key ASC, voice_type ASC;
            """
        ),
        {"exercise_id": exercise_id, "target_key": target_key},
    ).mappings().all()
    return {"targets": [dict(r) for r in rows]}


@router.post("/cms/audio/targets/generate-tts")
async def cms_generate_target_tts(payload: GenerateTargetTTSRequest, db: Connection = Depends(get_db)):
    exercise_id = int(payload.exercise_id or 0)
    target_key = (payload.target_key or "").strip()
    text_value = (payload.text or "").strip()
    voice_type = (payload.voice_type or "").strip().lower()

    if not exercise_id or not target_key or not text_value:
        raise HTTPException(status_code=400, detail="exercise_id, target_key and text are required")
    if voice_type not in ("male", "female"):
        raise HTTPException(status_code=400, detail="voice_type must be male or female")

    voice_id = MALE_VOICE_ID if voice_type == "male" else FEMALE_VOICE_ID
    audio_data = await generate_elevenlabs_tts(text_value, voice_id)

    result = db.execute(
        text(
            """
            INSERT INTO exercise_audio_targets (
                exercise_id, target_key, voice_type, source_type,
                tts_text, tts_voice_id,
                audio_data, audio_format, audio_size,
                created_at, updated_at
            ) VALUES (
                :exercise_id, :target_key, :voice_type, 'tts',
                :tts_text, :voice_id,
                :audio_data, 'mp3', :audio_size,
                NOW(), NOW()
            )
            ON CONFLICT (exercise_id, target_key, voice_type) DO UPDATE SET
                source_type='tts',
                tts_text=EXCLUDED.tts_text,
                tts_voice_id=EXCLUDED.tts_voice_id,
                audio_data=EXCLUDED.audio_data,
                audio_format=EXCLUDED.audio_format,
                audio_size=EXCLUDED.audio_size,
                file_path=NULL,
                updated_at=NOW()
            RETURNING id, audio_size;
            """
        ),
        {
            "exercise_id": exercise_id,
            "target_key": target_key,
            "voice_type": voice_type,
            "tts_text": text_value,
            "voice_id": voice_id,
            "audio_data": audio_data,
            "audio_size": len(audio_data),
        },
    ).mappings().first()
    return {
        "success": True,
        "audio_id": result["id"],
        "voice_type": voice_type,
        "audio_size": result["audio_size"],
        "target_key": target_key,
    }


@router.post("/cms/audio/generate-tts")
async def generate_tts_audio(payload: GenerateTTSRequest, db: Connection = Depends(get_db)):
    voice_id = MALE_VOICE_ID if payload.voice_type == "male" else FEMALE_VOICE_ID
    audio_data = await generate_elevenlabs_tts(payload.text, voice_id)
    
    result = db.execute(
        text("""
            INSERT INTO exercise_audio (
                exercise_id, voice_type, source_type, tts_text, tts_voice_id,
                audio_data, audio_format, audio_size, created_at, updated_at
            ) VALUES (
                :exercise_id, :voice_type, 'tts', :tts_text, :voice_id,
                :audio_data, 'mp3', :audio_size, NOW(), NOW()
            )
            ON CONFLICT (exercise_id, voice_type) DO UPDATE SET
                source_type='tts', tts_text=EXCLUDED.tts_text, tts_voice_id=EXCLUDED.tts_voice_id,
                audio_data=EXCLUDED.audio_data, audio_size=EXCLUDED.audio_size, updated_at=NOW()
            RETURNING id, audio_size
        """),
        {
            "exercise_id": payload.exercise_id, "voice_type": payload.voice_type,
            "tts_text": payload.text, "voice_id": voice_id,
            "audio_data": audio_data, "audio_size": len(audio_data)
        }
    ).mappings().first()
    
    return {
        "success": True, "audio_id": result["id"],
        "voice_type": payload.voice_type, "audio_size": result["audio_size"]
    }


@router.post("/cms/audio/upload")
async def upload_custom_audio(
    exercise_id: int = Form(...),
    voice_type: str = Form(...),
    audio_file: UploadFile = File(...),
    db: Connection = Depends(get_db)
):
    audio_data = await audio_file.read()
    
    if len(audio_data) > MAX_AUDIO_SIZE:
        raise HTTPException(400, f"File too large. Max: {MAX_AUDIO_SIZE/1024/1024}MB")
    
    format_map = {'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 
                  'audio/ogg': 'ogg', 'audio/webm': 'webm'}
    audio_format = format_map.get(audio_file.content_type, 'mp3')
    
    result = db.execute(
        text("""
            INSERT INTO exercise_audio (
                exercise_id, voice_type, source_type, audio_data, audio_format, audio_size,
                created_at, updated_at
            ) VALUES (
                :exercise_id, :voice_type, 'custom', :audio_data, :audio_format, :audio_size,
                NOW(), NOW()
            )
            ON CONFLICT (exercise_id, voice_type) DO UPDATE SET
                source_type='custom', audio_data=EXCLUDED.audio_data,
                audio_format=EXCLUDED.audio_format, audio_size=EXCLUDED.audio_size, updated_at=NOW()
            RETURNING id
        """),
        {
            "exercise_id": exercise_id, "voice_type": voice_type,
            "audio_data": audio_data, "audio_format": audio_format, "audio_size": len(audio_data)
        }
    ).mappings().first()
    
    return {"success": True, "audio_id": result["id"], "voice_type": voice_type}


@router.post("/cms/audio/save-recording")
async def save_browser_recording(
    exercise_id: int = Form(...),
    voice_type: str = Form(...),
    audio_file: UploadFile = File(...),
    db: Connection = Depends(get_db)
):
    audio_data = await audio_file.read()
    
    format_map = {'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/wav': 'wav'}
    audio_format = format_map.get(audio_file.content_type, 'webm')
    
    result = db.execute(
        text("""
            INSERT INTO exercise_audio (
                exercise_id, voice_type, source_type, audio_data, audio_format, audio_size,
                created_at, updated_at
            ) VALUES (
                :exercise_id, :voice_type, 'recording', :audio_data, :audio_format, :audio_size,
                NOW(), NOW()
            )
            ON CONFLICT (exercise_id, voice_type) DO UPDATE SET
                source_type='recording', audio_data=EXCLUDED.audio_data,
                audio_format=EXCLUDED.audio_format, audio_size=EXCLUDED.audio_size, updated_at=NOW()
            RETURNING id
        """),
        {
            "exercise_id": exercise_id, "voice_type": voice_type,
            "audio_data": audio_data, "audio_format": audio_format, "audio_size": len(audio_data)
        }
    ).mappings().first()
    
    return {"success": True, "audio_id": result["id"]}


@router.post("/cms/audio/targets/upload")
async def upload_target_audio(
    exercise_id: int = Form(...),
    target_key: str = Form(...),
    voice_type: str = Form(...),
    audio_file: UploadFile = File(...),
    db: Connection = Depends(get_db),
):
    target_key = (target_key or "").strip()
    voice_type = (voice_type or "").strip().lower()
    if not target_key:
        raise HTTPException(400, "target_key is required")
    if voice_type not in ("male", "female"):
        raise HTTPException(400, "voice_type must be male or female")

    audio_data = await audio_file.read()
    if not audio_data:
        raise HTTPException(400, "Empty file")
    if len(audio_data) > MAX_AUDIO_SIZE:
        raise HTTPException(400, f"File too large. Max: {MAX_AUDIO_SIZE/1024/1024}MB")

    format_map = {
        'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav',
        'audio/ogg': 'ogg', 'audio/webm': 'webm'
    }
    audio_format = format_map.get(audio_file.content_type, 'mp3')

    result = db.execute(
        text(
            """
            INSERT INTO exercise_audio_targets (
                exercise_id, target_key, voice_type, source_type,
                audio_data, audio_format, audio_size,
                tts_text, tts_voice_id,
                created_at, updated_at
            ) VALUES (
                :exercise_id, :target_key, :voice_type, 'recording',
                :audio_data, :audio_format, :audio_size,
                NULL, NULL,
                NOW(), NOW()
            )
            ON CONFLICT (exercise_id, target_key, voice_type) DO UPDATE SET
                source_type='recording',
                audio_data=EXCLUDED.audio_data,
                audio_format=EXCLUDED.audio_format,
                audio_size=EXCLUDED.audio_size,
                tts_text=NULL,
                tts_voice_id=NULL,
                file_path=NULL,
                updated_at=NOW()
            RETURNING id
            """
        ),
        {
            "exercise_id": exercise_id,
            "target_key": target_key,
            "voice_type": voice_type,
            "audio_data": audio_data,
            "audio_format": audio_format,
            "audio_size": len(audio_data),
        },
    ).mappings().first()

    return {"success": True, "audio_id": result["id"], "voice_type": voice_type, "target_key": target_key}


@router.post("/cms/audio/targets/save-recording")
async def save_target_recording(
    exercise_id: int = Form(...),
    target_key: str = Form(...),
    voice_type: str = Form(...),
    audio_file: UploadFile = File(...),
    db: Connection = Depends(get_db),
):
    # Same as upload, but keeps browser format mapping defaulting to webm.
    format_map = {'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/wav': 'wav', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3'}
    audio_data = await audio_file.read()
    if not audio_data:
        raise HTTPException(400, "Empty recording")
    audio_format = format_map.get(audio_file.content_type, 'webm')
    # Reuse upload logic by creating a fake UploadFile isn't worth it; upsert directly.
    target_key = (target_key or "").strip()
    voice_type = (voice_type or "").strip().lower()
    if not target_key:
        raise HTTPException(400, "target_key is required")
    if voice_type not in ("male", "female"):
        raise HTTPException(400, "voice_type must be male or female")

    result = db.execute(
        text(
            """
            INSERT INTO exercise_audio_targets (
                exercise_id, target_key, voice_type, source_type,
                audio_data, audio_format, audio_size,
                created_at, updated_at
            ) VALUES (
                :exercise_id, :target_key, :voice_type, 'recording',
                :audio_data, :audio_format, :audio_size,
                NOW(), NOW()
            )
            ON CONFLICT (exercise_id, target_key, voice_type) DO UPDATE SET
                source_type='recording',
                audio_data=EXCLUDED.audio_data,
                audio_format=EXCLUDED.audio_format,
                audio_size=EXCLUDED.audio_size,
                tts_text=NULL,
                tts_voice_id=NULL,
                file_path=NULL,
                updated_at=NOW()
            RETURNING id
            """
        ),
        {
            "exercise_id": exercise_id,
            "target_key": target_key,
            "voice_type": voice_type,
            "audio_data": audio_data,
            "audio_format": audio_format,
            "audio_size": len(audio_data),
        },
    ).mappings().first()
    return {"success": True, "audio_id": result["id"], "target_key": target_key}


@router.delete("/cms/audio/targets/{audio_id}")
def delete_target_audio(audio_id: int, db: Connection = Depends(get_db)):
    db.execute(text("DELETE FROM exercise_audio_targets WHERE id = :id"), {"id": audio_id})
    return {"success": True}


@router.get("/cms/audio/targets/{audio_id}/preview")
def preview_target_audio(audio_id: int, db: Connection = Depends(get_db)):
    row = db.execute(
        text("SELECT audio_data, audio_format FROM exercise_audio_targets WHERE id = :id"),
        {"id": audio_id},
    ).mappings().first()
    if not row:
        raise HTTPException(404, "Audio not found")
    content_types = {'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg', 'webm': 'audio/webm'}
    content_type = content_types.get(row["audio_format"], 'audio/mpeg')
    return Response(content=bytes(row["audio_data"]), media_type=content_type)


@router.get("/cms/audio/{audio_id}/preview")
def preview_audio(audio_id: int, db: Connection = Depends(get_db)):
    row = db.execute(
        text("SELECT audio_data, audio_format FROM exercise_audio WHERE id = :id"),
        {"id": audio_id}
    ).mappings().first()
    
    if not row:
        raise HTTPException(404, "Audio not found")
    
    content_types = {'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg', 'webm': 'audio/webm'}
    content_type = content_types.get(row["audio_format"], 'audio/mpeg')
    
    return Response(content=bytes(row["audio_data"]), media_type=content_type)


@router.delete("/cms/audio/{audio_id}")
def delete_audio(audio_id: int, db: Connection = Depends(get_db)):
    result = db.execute(
        text("DELETE FROM exercise_audio WHERE id = :id RETURNING id"),
        {"id": audio_id}
    ).mappings().first()
    
    if not result:
        raise HTTPException(404, "Audio not found")
    
    return {"success": True}


@router.get("/audio/exercise/{exercise_id}")
def get_exercise_audio_for_playback(
    exercise_id: int,
    voice: str = "female",
    db: Connection = Depends(get_db)
):
    row = db.execute(
        text("""
            SELECT audio_data, audio_format FROM exercise_audio
            WHERE exercise_id = :exercise_id AND voice_type = :voice LIMIT 1
        """),
        {"exercise_id": exercise_id, "voice": voice}
    ).mappings().first()
    
    if not row:
        raise HTTPException(404, f"No {voice} audio found")
    
    content_types = {'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg', 'webm': 'audio/webm'}
    return Response(
        content=bytes(row["audio_data"]),
        media_type=content_types.get(row["audio_format"], 'audio/mpeg'),
        headers={"Cache-Control": "public, max-age=31536000"}
    )


@router.get("/audio/target/{exercise_id}")
def get_target_audio_for_playback(
    exercise_id: int,
    key: str,
    voice: str = "female",
    db: Connection = Depends(get_db),
):
    """Serve stored per-target audio. Returns 404 when missing."""
    key = (key or "").strip()
    voice = (voice or "").strip().lower()
    if not key:
        raise HTTPException(400, "key is required")
    if voice not in ("male", "female"):
        voice = "female"

    row = db.execute(
        text(
            """
            SELECT audio_data, audio_format
            FROM exercise_audio_targets
            WHERE exercise_id = :exercise_id
              AND target_key = :target_key
              AND voice_type = :voice
            LIMIT 1
            """
        ),
        {"exercise_id": exercise_id, "target_key": key, "voice": voice},
    ).mappings().first()
    if not row:
        raise HTTPException(404, "No audio found")

    content_types = {'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'ogg': 'audio/ogg', 'webm': 'audio/webm'}
    return Response(
        content=bytes(row["audio_data"]),
        media_type=content_types.get(row["audio_format"], 'audio/mpeg'),
        headers={"Cache-Control": "public, max-age=31536000"},
    )


@router.post("/cms/audio/batch-generate")
async def batch_generate_tts(
    lesson_id: int,
    voice_types: list[str],
    db: Connection = Depends(get_db)
):
    exercises = db.execute(
        text("""
            SELECT id, prompt FROM exercises
            WHERE lesson_id = :lesson_id AND prompt IS NOT NULL AND prompt != ''
            ORDER BY "order"
        """),
        {"lesson_id": lesson_id}
    ).mappings().all()
    
    generated, errors = [], []
    
    for exercise in exercises:
        for voice_type in voice_types:
            try:
                result = await generate_tts_audio(
                    GenerateTTSRequest(
                        exercise_id=exercise["id"],
                        text=exercise["prompt"],
                        voice_type=voice_type
                    ),
                    db=db
                )
                generated.append({"exercise_id": exercise["id"], "voice_type": voice_type})
            except Exception as e:
                errors.append({"exercise_id": exercise["id"], "voice_type": voice_type, "error": str(e)})
    
    return {"success": True, "generated": len(generated), "errors": errors if errors else None}
