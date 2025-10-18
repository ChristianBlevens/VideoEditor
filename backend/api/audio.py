"""
Audio processing endpoints
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import asyncio

router = APIRouter()

class NormalizeRequest(BaseModel):
    audio_path: str
    start_time: Optional[float] = None  # Clip start time
    duration: Optional[float] = None    # Clip duration

class DenoiseRequest(BaseModel):
    audio_path: str
    strength: Optional[str] = 'medium'
    start_time: Optional[float] = None  # Clip start time
    duration: Optional[float] = None    # Clip duration

class AudioProcessResponse(BaseModel):
    success: bool
    output_path: str
    message: str

@router.post("/normalize", response_model=AudioProcessResponse)
async def normalize_audio(request: NormalizeRequest):
    """
    Normalize audio levels using EBU R128 loudness normalization

    Target: -16 LUFS for broadcast-standard levels
    Supports time-range normalization for clips
    """
    try:
        from app import get_audio_service
        audio_service = get_audio_service()

        # Run in thread pool to avoid blocking
        output_path = await asyncio.to_thread(
            audio_service.normalize_audio,
            request.audio_path,
            request.start_time,  # Pass clip timing
            request.duration     # Pass clip duration
        )

        return AudioProcessResponse(
            success=True,
            output_path=output_path,
            message="Audio normalized successfully"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/denoise", response_model=AudioProcessResponse)
async def remove_noise(request: DenoiseRequest):
    """
    Remove background noise using FFT denoiser

    Strength options: 'light', 'medium', 'heavy'
    Supports time-range denoising for clips
    """
    try:
        from app import get_audio_service
        audio_service = get_audio_service()

        # Validate strength
        valid_strengths = ['light', 'medium', 'heavy']
        if request.strength not in valid_strengths:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid strength. Must be one of: {valid_strengths}"
            )

        # Run in thread pool to avoid blocking
        output_path = await asyncio.to_thread(
            audio_service.remove_noise,
            request.audio_path,
            request.strength,
            request.start_time,  # Pass clip timing
            request.duration     # Pass clip duration
        )

        return AudioProcessResponse(
            success=True,
            output_path=output_path,
            message=f"Background noise removed ({request.strength})"
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
