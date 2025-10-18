"""
Transcription endpoints
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import asyncio

router = APIRouter()

class TranscribeRequest(BaseModel):
    audio_path: str
    language: Optional[str] = "en"
    start_time: Optional[float] = None  # Clip start time
    duration: Optional[float] = None    # Clip duration

class DiarizeRequest(BaseModel):
    audio_path: str
    language: Optional[str] = "en"
    num_speakers: Optional[int] = None  # Number of expected speakers (None = auto)
    start_time: Optional[float] = None
    duration: Optional[float] = None

class SilenceDetectionRequest(BaseModel):
    audio_path: str
    transcript_words: list  # List of word objects with 'start' and 'end' timestamps

class SilenceDetectionResponse(BaseModel):
    silences: list  # List of silence segments with 'start', 'end', 'duration'
    count: int
    total_duration: float

class TranscribeResponse(BaseModel):
    segments: list
    language: str
    duration: float

class ChangeModelRequest(BaseModel):
    model_size: str

class ChangeModelResponse(BaseModel):
    success: bool
    model: str
    message: str

@router.post("/change_model", response_model=ChangeModelResponse)
async def change_whisper_model(request: ChangeModelRequest):
    """
    Change the Whisper model

    Model sizes: tiny, base, small, medium, large-v3
    """
    try:
        # Import service
        from app import get_whisper_service
        whisper = get_whisper_service()

        # Validate model size
        valid_models = ["tiny", "base", "small", "medium", "large-v3"]
        if request.model_size not in valid_models:
            raise HTTPException(status_code=400, detail=f"Invalid model size. Must be one of: {valid_models}")

        # Load new model in thread pool
        await asyncio.to_thread(
            whisper.load_model,
            request.model_size
        )

        return ChangeModelResponse(
            success=True,
            model=request.model_size,
            message=f"Successfully loaded {request.model_size} model"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(request: TranscribeRequest):
    """
    Transcribe audio file with word-level timestamps

    Supports time-range transcription for clips

    Returns complete transcript
    """
    try:
        # Import service (will be properly injected in production)
        from app import get_whisper_service
        whisper = get_whisper_service()

        # Run transcription in thread pool to avoid blocking
        result = await asyncio.to_thread(
            whisper.transcribe_audio,
            request.audio_path,
            request.language,
            request.start_time,    # Pass clip timing
            request.duration       # Pass clip duration
        )

        return TranscribeResponse(**result)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/transcribe_with_diarization", response_model=TranscribeResponse)
async def transcribe_with_diarization(request: DiarizeRequest):
    """
    Transcribe audio with speaker diarization

    Returns transcript with speaker labels for each segment/word

    Note: Currently returns placeholder speaker labels.
    Full implementation requires pyannote.audio library.
    """
    try:
        print(f"[DIARIZATION API] Starting diarization for: {request.audio_path}", flush=True)
        print(f"[DIARIZATION API] Language: {request.language}, Speakers: {request.num_speakers}", flush=True)
        print(f"[DIARIZATION API] Start: {request.start_time}, Duration: {request.duration}", flush=True)

        from app import get_whisper_service
        whisper = get_whisper_service()

        print("[DIARIZATION API] Whisper service obtained, calling transcribe_with_diarization", flush=True)

        # Run diarization in thread pool
        result = await asyncio.to_thread(
            whisper.transcribe_with_diarization,
            request.audio_path,
            request.language,
            request.num_speakers,
            request.start_time,
            request.duration
        )

        print("[DIARIZATION API] Diarization complete", flush=True)

        return TranscribeResponse(**result)

    except Exception as e:
        print(f"[DIARIZATION API] ERROR: {type(e).__name__}: {str(e)}", flush=True)
        import traceback
        print(f"[DIARIZATION API] Traceback:\n{traceback.format_exc()}", flush=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/detect_silence", response_model=SilenceDetectionResponse)
async def detect_silence(request: SilenceDetectionRequest):
    """
    Detect silence using hybrid transcript + VAD approach

    1. Find gaps between transcript words
    2. Verify each gap with Voice Activity Detection
    3. Only gaps that pass both checks count as silence
    """
    try:
        from backend.services.silence_detection_service import get_silence_detection_service

        silence_service = get_silence_detection_service()

        # Run silence detection in thread pool
        silences = await asyncio.to_thread(
            silence_service.detect_silence,
            request.audio_path,
            request.transcript_words
        )

        # Calculate total silence duration
        total_duration = sum(s['duration'] for s in silences)

        return SilenceDetectionResponse(
            silences=silences,
            count=len(silences),
            total_duration=total_duration
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
