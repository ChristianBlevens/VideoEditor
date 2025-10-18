"""
FFmpeg audio processing service
"""

import ffmpeg
from pathlib import Path
import logging
import uuid

logger = logging.getLogger(__name__)

class AudioService:
    """Direct FFmpeg audio processing"""

    def __init__(self):
        self.cache_dir = Path("data/cache")
        self.cache_dir.mkdir(parents=True, exist_ok=True)

    def extract_audio(self, video_path: str, output_path: str = None):
        """Extract audio track from video"""
        if not output_path:
            output_path = f"data/cache/{Path(video_path).stem}_audio.aac"

        logger.info(f"Extracting audio from {video_path}")

        (
            ffmpeg
            .input(video_path)
            .output(output_path, vn=None, acodec='copy')
            .overwrite_output()
            .run(quiet=True)
        )

        return output_path

    def normalize_audio(self, audio_path: str, start_time: float = None, duration: float = None):
        """
        Normalize audio levels using FFmpeg loudnorm filter

        Args:
            audio_path: Path to audio file
            start_time: Start time in seconds (None = entire file)
            duration: Duration in seconds (None = to end)

        Uses EBU R128 loudness normalization for broadcast standard levels
        Target: -16 LUFS (Loudness Units relative to Full Scale)
        """
        logger.info(
            f"Normalizing audio: {audio_path} (start={start_time}, duration={duration})"
        )

        # Generate output path
        input_path = Path(audio_path)
        output_path = self.cache_dir / f"{uuid.uuid4()}{input_path.suffix}"

        try:
            # Use segment extractor for efficient processing
            from backend.services.segment_extractor import get_segment_extractor
            extractor = get_segment_extractor()

            extractor.apply_processing_to_segment(
                audio_path,
                str(output_path),
                start_time=start_time,
                duration=duration,
                filters=['loudnorm=I=-16:TP=-1.5:LRA=11'],
                audio_codec='aac',
                audio_bitrate='192k'
            )

            logger.info(f"Audio normalized successfully: {output_path}")
            return str(output_path)

        except Exception as e:
            logger.error(f"Audio normalization failed: {str(e)}")
            raise

    def remove_noise(self, audio_path: str, strength: str = 'medium', start_time: float = None, duration: float = None):
        """
        Remove background noise using FFmpeg's afftdn (FFT denoiser)

        Args:
            audio_path: Path to audio file
            strength: 'light', 'medium', or 'heavy'
            start_time: Start time in seconds (None = entire file)
            duration: Duration in seconds (None = to end)
        """
        logger.info(
            f"Removing noise from audio: {audio_path} (strength: {strength}, start={start_time}, duration={duration})"
        )

        # Generate output path
        input_path = Path(audio_path)
        output_path = self.cache_dir / f"{uuid.uuid4()}{input_path.suffix}"

        # Map strength to noise reduction amount (0-97)
        strength_map = {
            'light': 10,
            'medium': 20,
            'heavy': 35
        }
        nr_amount = strength_map.get(strength, 20)

        try:
            # Use segment extractor for efficient processing
            from backend.services.segment_extractor import get_segment_extractor
            extractor = get_segment_extractor()

            extractor.apply_processing_to_segment(
                audio_path,
                str(output_path),
                start_time=start_time,
                duration=duration,
                filters=[f'afftdn=nr={nr_amount}:nf=-25'],
                audio_codec='aac',
                audio_bitrate='192k'
            )

            logger.info(f"Noise removed successfully: {output_path}")
            return str(output_path)

        except Exception as e:
            logger.error(f"Noise removal failed: {str(e)}")
            raise
