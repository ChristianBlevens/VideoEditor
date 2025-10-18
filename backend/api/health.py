"""
Health check endpoint
"""

from fastapi import APIRouter
from pydantic import BaseModel
import torch

router = APIRouter()

class HealthResponse(BaseModel):
    status: str
    message: str
    gpu_available: bool
    version: str

@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint
    Returns backend status and GPU availability
    """
    gpu_available = torch.cuda.is_available()

    return HealthResponse(
        status="ready",
        message="Backend is ready to process requests",
        gpu_available=gpu_available,
        version="1.0.0"
    )
