"""
Waveform generation endpoint
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import List

from backend.services.waveform_service import WaveformService

router = APIRouter()

class WaveformResponse(BaseModel):
    peaks: List[float]
    duration: float
    sample_rate: int

@router.get("/waveform", response_model=WaveformResponse)
async def generate_waveform(
    path: str = Query(..., description="Path to audio file"),
    width: int = Query(1000, description="Number of peaks to generate")
):
    """
    Generate waveform data for audio visualization

    Returns peak values for rendering waveform in timeline
    """
    try:
        waveform_service = WaveformService()
        result = waveform_service.generate_waveform(path, width)

        return WaveformResponse(**result)

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
