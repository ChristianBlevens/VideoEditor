"""
Video Transcoding Service
Normalizes video files to web-compatible formats for MSE playback
"""

import os
import subprocess
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class TranscodingService:
    """
    Service for transcoding video files to web-compatible formats
    Uses FFmpeg for H.264 + AAC encoding
    """

    def __init__(self, cache_dir: str = "data/cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def normalize_for_web(self, input_path: str, output_path: str = None) -> str:
        """
        Transcode video to web-compatible format for MSE

        Args:
            input_path: Path to input video file
            output_path: Path to output file (optional, auto-generated if not provided)

        Returns:
            Path to transcoded video file
        """
        input_path = Path(input_path)

        if not input_path.exists():
            raise FileNotFoundError(f"Input file not found: {input_path}")

        # Auto-generate output path if not provided
        if output_path is None:
            output_filename = f"{input_path.stem}_web.mp4"
            output_path = self.cache_dir / output_filename
        else:
            output_path = Path(output_path)

        # Check if already cached
        if output_path.exists():
            logger.info(f"Using cached transcoded video: {output_path}")
            return str(output_path)

        logger.info(f"Transcoding video: {input_path} -> {output_path}")

        # FFmpeg command for MSE-compatible fragmented MP4
        # Uses fragmented MP4 format which is specifically designed for MSE
        cmd = [
            'ffmpeg',
            '-i', str(input_path),
            '-c:v', 'libx264',              # H.264 video codec
            '-profile:v', 'baseline',        # Maximum compatibility (MSE requires baseline or main)
            '-level', '3.0',                 # Baseline level 3.0
            '-pix_fmt', 'yuv420p',           # Pixel format compatible with all browsers
            '-c:a', 'aac',                   # AAC audio codec
            '-ar', '48000',                  # 48kHz sample rate
            '-b:a', '192k',                  # Audio bitrate
            '-movflags', '+frag_keyframe+empty_moov+default_base_moof',  # Fragmented MP4 for MSE
            '-f', 'mp4',                     # Force MP4 format
            '-y',                            # Overwrite output file
            str(output_path)
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True
            )

            logger.info(f"Transcoding complete: {output_path}")
            return str(output_path)

        except subprocess.CalledProcessError as e:
            logger.error(f"Transcoding failed: {e.stderr}")
            raise RuntimeError(f"FFmpeg transcoding failed: {e.stderr}")

    def normalize_for_web_with_gpu(self, input_path: str, output_path: str = None) -> str:
        """
        Transcode video using GPU acceleration (NVIDIA NVENC or AMD AMF)

        Args:
            input_path: Path to input video file
            output_path: Path to output file (optional)

        Returns:
            Path to transcoded video file
        """
        input_path = Path(input_path)

        if not input_path.exists():
            raise FileNotFoundError(f"Input file not found: {input_path}")

        if output_path is None:
            output_filename = f"{input_path.stem}_web.mp4"
            output_path = self.cache_dir / output_filename
        else:
            output_path = Path(output_path)

        if output_path.exists():
            logger.info(f"Using cached transcoded video: {output_path}")
            return str(output_path)

        logger.info(f"Transcoding video with GPU: {input_path} -> {output_path}")

        # Try NVIDIA NVENC first
        cmd_nvenc = [
            'ffmpeg',
            '-hwaccel', 'cuda',
            '-i', str(input_path),
            '-c:v', 'h264_nvenc',            # NVIDIA hardware encoder
            '-preset', 'p4',                 # Performance preset
            '-profile:v', 'baseline',
            '-c:a', 'aac',
            '-ar', '48000',
            '-b:a', '192k',
            '-movflags', '+faststart',
            '-y',
            str(output_path)
        ]

        try:
            subprocess.run(cmd_nvenc, capture_output=True, text=True, check=True)
            logger.info(f"GPU transcoding complete (NVENC): {output_path}")
            return str(output_path)

        except subprocess.CalledProcessError:
            logger.warning("GPU encoding failed, falling back to CPU")
            return self.normalize_for_web(input_path, output_path)

    def get_video_info(self, video_path: str) -> dict:
        """
        Get video file information using ffprobe

        Args:
            video_path: Path to video file

        Returns:
            Dictionary with video metadata
        """
        cmd = [
            'ffprobe',
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            str(video_path)
        ]

        try:
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                check=True
            )

            import json
            info = json.loads(result.stdout)

            # Extract useful information
            video_stream = next(
                (s for s in info.get('streams', []) if s.get('codec_type') == 'video'),
                None
            )

            audio_stream = next(
                (s for s in info.get('streams', []) if s.get('codec_type') == 'audio'),
                None
            )

            return {
                'duration': float(info.get('format', {}).get('duration', 0)),
                'size': int(info.get('format', {}).get('size', 0)),
                'video_codec': video_stream.get('codec_name') if video_stream else None,
                'audio_codec': audio_stream.get('codec_name') if audio_stream else None,
                'width': video_stream.get('width') if video_stream else None,
                'height': video_stream.get('height') if video_stream else None,
                'fps': eval(video_stream.get('r_frame_rate', '0/1')) if video_stream else None
            }

        except subprocess.CalledProcessError as e:
            logger.error(f"ffprobe failed: {e.stderr}")
            raise RuntimeError(f"Failed to get video info: {e.stderr}")

    def is_web_compatible(self, video_path: str) -> bool:
        """
        Check if video is already in web-compatible format

        IMPORTANT: For MSE, we need very specific encoding:
        - H.264 Baseline or Main profile (NOT High profile)
        - AAC audio
        - MP4 container with faststart

        For safety, we ALWAYS transcode to ensure MSE compatibility.

        Args:
            video_path: Path to video file

        Returns:
            False (always transcode for MSE compatibility)
        """
        # Always transcode to ensure MSE compatibility
        # MSE is very picky about codec profiles and container format
        logger.info(f"Video will be transcoded for MSE compatibility: {video_path}")
        return False

    def clear_cache(self):
        """Clear all cached transcoded videos"""
        logger.info("Clearing transcode cache...")

        count = 0
        for file in self.cache_dir.glob("*_web.mp4"):
            file.unlink()
            count += 1

        logger.info(f"Cleared {count} cached files")


# Singleton instance
_transcoding_service = None

def get_transcoding_service() -> TranscodingService:
    """Get singleton transcoding service instance"""
    global _transcoding_service
    if _transcoding_service is None:
        _transcoding_service = TranscodingService()
    return _transcoding_service
