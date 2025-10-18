"""
Video Segment API Endpoint
Serves video segments for MSE playback
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
import logging
from pathlib import Path
from urllib.parse import unquote

from backend.services.transcoding_service import get_transcoding_service, TranscodingService

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/video/segment/{file_path:path}")
async def get_video_segment(
    file_path: str,
    transcoding_service: TranscodingService = Depends(get_transcoding_service)
):
    """
    Serve video segment for MSE playback
    Automatically transcodes to web-compatible format if needed

    Args:
        file_path: Path to video file (URL-encoded)

    Returns:
        Video file as MP4 (H.264 + AAC)
    """
    # Decode URL-encoded path
    file_path = unquote(file_path)

    logger.info(f"Video segment requested: {file_path}")

    # Resolve path (handle both absolute and relative paths)
    video_path = Path(file_path)

    if not video_path.exists():
        # Try relative to uploads directory
        upload_path = Path("data/uploads") / file_path
        if upload_path.exists():
            video_path = upload_path
        else:
            logger.error(f"Video file not found: {file_path}")
            raise HTTPException(status_code=404, detail=f"Video file not found: {file_path}")

    # Check if video is already web-compatible
    if transcoding_service.is_web_compatible(str(video_path)):
        logger.info(f"Serving original file (already web-compatible): {video_path}")
        return FileResponse(
            path=str(video_path),
            media_type="video/mp4",
            headers={
                "Accept-Ranges": "bytes",
                "Cache-Control": "public, max-age=3600"
            }
        )

    # Transcode to web-compatible format
    try:
        logger.info(f"Transcoding video to web format: {video_path}")
        transcoded_path = transcoding_service.normalize_for_web(str(video_path))

        return FileResponse(
            path=transcoded_path,
            media_type="video/mp4",
            headers={
                "Accept-Ranges": "bytes",
                "Cache-Control": "public, max-age=3600"
            }
        )

    except Exception as e:
        logger.error(f"Transcoding failed: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to transcode video: {str(e)}")


@router.get("/video/info/{file_path:path}")
async def get_video_info(
    file_path: str,
    transcoding_service: TranscodingService = Depends(get_transcoding_service)
):
    """
    Get video file information

    Args:
        file_path: Path to video file (URL-encoded)

    Returns:
        Video metadata (duration, codecs, dimensions, etc.)
    """
    file_path = unquote(file_path)

    logger.info(f"Video info requested: {file_path}")

    video_path = Path(file_path)
    if not video_path.exists():
        upload_path = Path("data/uploads") / file_path
        if upload_path.exists():
            video_path = upload_path
        else:
            raise HTTPException(status_code=404, detail=f"Video file not found: {file_path}")

    try:
        info = transcoding_service.get_video_info(str(video_path))
        info['is_web_compatible'] = transcoding_service.is_web_compatible(str(video_path))

        return info

    except Exception as e:
        logger.error(f"Failed to get video info: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get video info: {str(e)}")


@router.post("/video/clear-cache")
async def clear_transcode_cache(
    transcoding_service: TranscodingService = Depends(get_transcoding_service)
):
    """
    Clear transcode cache
    Useful for freeing up disk space
    """
    try:
        transcoding_service.clear_cache()
        return {"message": "Transcode cache cleared"}

    except Exception as e:
        logger.error(f"Failed to clear cache: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to clear cache: {str(e)}")
