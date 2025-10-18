"""
VideoEditor Backend
FastAPI application for video/audio processing and AI transcription
"""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import torch

# Import API routers
from backend.api import health, upload, transcription, waveform, websocket, video_segment, audio

# Import services
from backend.services.whisper_service import WhisperService
from backend.services.audio_service import AudioService
from backend.services.video_service import VideoService
from backend.services.waveform_service import WaveformService
from backend.services.transcoding_service import TranscodingService
from backend.services.diarization_service import DiarizationService

# Setup logging with stdout handler for Docker
import sys
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    stream=sys.stdout,
    force=True
)
logger = logging.getLogger(__name__)

# Service instances (initialized at startup)
whisper_service: WhisperService = None
audio_service: AudioService = None
video_service: VideoService = None
waveform_service: WaveformService = None
transcoding_service: TranscodingService = None
diarization_service: DiarizationService = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown logic"""
    global whisper_service, audio_service, video_service, waveform_service, transcoding_service, diarization_service

    logger.info("VideoEditor Backend Starting...")

    # Check GPU availability
    gpu_available = torch.cuda.is_available()
    if gpu_available:
        gpu_name = torch.cuda.get_device_name(0)
        logger.info(f"GPU detected: {gpu_name}")
    else:
        logger.info("No GPU detected - running in CPU mode")

    # Initialize services
    logger.info("Loading Whisper model...")
    whisper_service = WhisperService(device="cuda" if gpu_available else "cpu")
    whisper_service.load_model("base")  # Use 'base' for faster loading during testing

    logger.info("Initializing speaker diarization...")
    diarization_service = DiarizationService(device="cuda" if gpu_available else "cpu")
    try:
        diarization_service.load_model("pyannote/speaker-diarization-3.1")
        logger.info("Speaker diarization model loaded successfully")
    except Exception as e:
        logger.warning(f"Speaker diarization model failed to load: {e}")
        logger.warning("Diarization features will not be available. Set HF_TOKEN environment variable and accept model conditions.")

    logger.info("Initializing processing services...")
    audio_service = AudioService()
    video_service = VideoService()
    waveform_service = WaveformService()
    transcoding_service = TranscodingService()

    logger.info("Backend ready!")

    yield  # Application runs

    # Cleanup
    logger.info("Shutting down backend...")

# Create FastAPI app
app = FastAPI(
    title="VideoEditor API",
    description="AI-powered video editing backend",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routers
app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(transcription.router, prefix="/api", tags=["transcription"])
app.include_router(waveform.router, prefix="/api", tags=["waveform"])
app.include_router(video_segment.router, prefix="/api", tags=["video"])
app.include_router(audio.router, prefix="/api/audio", tags=["audio"])

# WebSocket endpoint
app.include_router(websocket.router)

# Serve static files (CSS, JS)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Root endpoint serves index.html
@app.get("/")
async def root():
    return FileResponse("index.html")

# Dependency injection for services
def get_whisper_service() -> WhisperService:
    return whisper_service

def get_audio_service() -> AudioService:
    return audio_service

def get_video_service() -> VideoService:
    return video_service

def get_waveform_service() -> WaveformService:
    return waveform_service

def get_transcoding_service() -> TranscodingService:
    return transcoding_service

def get_diarization_service() -> DiarizationService:
    return diarization_service
