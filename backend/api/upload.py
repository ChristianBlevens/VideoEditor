"""
File upload endpoint
"""

from fastapi import APIRouter, UploadFile, File, HTTPException
from pydantic import BaseModel
from pathlib import Path
from typing import List
import shutil
import uuid
import os

router = APIRouter()

UPLOAD_DIR = Path("data/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

class UploadResponse(BaseModel):
    filename: str
    path: str
    size: int
    content_type: str

class MediaFile(BaseModel):
    filename: str
    path: str
    size: int
    type: str  # 'video' or 'audio'
    created_at: float

class DeleteResponse(BaseModel):
    success: bool
    message: str

@router.post("/upload", response_model=UploadResponse)
async def upload_file(file: UploadFile = File(...)):
    """
    Upload media file

    Accepts video and audio files
    Returns file path for backend processing
    """
    try:
        # Generate unique filename
        file_ext = Path(file.filename).suffix
        unique_filename = f"{uuid.uuid4()}{file_ext}"
        file_path = UPLOAD_DIR / unique_filename

        # Save file
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        return UploadResponse(
            filename=file.filename,
            path=str(file_path),
            size=file_path.stat().st_size,
            content_type=file.content_type
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.get("/list", response_model=List[MediaFile])
async def list_media_files():
    """
    List all uploaded media files
    """
    try:
        media_files = []

        if not UPLOAD_DIR.exists():
            return []

        for file_path in UPLOAD_DIR.iterdir():
            if file_path.is_file():
                # Determine file type
                file_ext = file_path.suffix.lower()
                video_exts = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v']
                audio_exts = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.flac']

                if file_ext in video_exts:
                    file_type = 'video'
                elif file_ext in audio_exts:
                    file_type = 'audio'
                else:
                    continue  # Skip non-media files

                media_files.append(MediaFile(
                    filename=file_path.name,
                    path=str(file_path),
                    size=file_path.stat().st_size,
                    type=file_type,
                    created_at=file_path.stat().st_ctime
                ))

        # Sort by creation time (newest first)
        media_files.sort(key=lambda x: x.created_at, reverse=True)

        return media_files

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list media files: {str(e)}")

@router.delete("/delete/{filename}")
async def delete_media_file(filename: str):
    """
    Delete a media file from uploads folder
    """
    try:
        file_path = UPLOAD_DIR / filename

        # Security check - ensure file is within uploads directory
        if not str(file_path.resolve()).startswith(str(UPLOAD_DIR.resolve())):
            raise HTTPException(status_code=400, detail="Invalid file path")

        if not file_path.exists():
            raise HTTPException(status_code=404, detail="File not found")

        # Delete the file
        os.remove(file_path)

        return DeleteResponse(
            success=True,
            message=f"File {filename} deleted successfully"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")
