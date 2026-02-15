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

# ElevenLabs configuration
ELEVEN_API_KEY = os.getenv("ELEVEN_LABS_API_KEY", "")
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


async def generate_elevenlabs_tts(text: str, voice_id: str) -> bytes:
    if not ELEVEN_API_KEY:
        raise HTTPException(500, "ElevenLabs API key not configured")
    
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
    
    if response.status_code != 200:
        raise HTTPException(response.status_code, f"ElevenLabs error: {response.text}")
    
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
