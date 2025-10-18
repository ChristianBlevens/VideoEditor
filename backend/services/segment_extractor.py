"""
Centralized Audio/Video Segment Extraction Service

Provides memory-efficient segment extraction for all processing operations.
Uses FFmpeg to extract specific time ranges without creating temporary files.
"""

import ffmpeg
import numpy as np
import logging
from typing import Optional, Tuple
from pathlib import Path

logger = logging.getLogger(__name__)

class SegmentExtractor:
    """
    Centralized service for extracting audio/video segments from media files.

    All segment extraction goes through this service to ensure:
    1. Only needed portions are processed (not entire files)
    2. No intermediate temp files created
    3. Consistent interface for all processing operations
    """

    def __init__(self):
        logger.info("[SegmentExtractor] Initialized")

    def extract_audio_segment_to_memory(
        self,
        media_path: str,
        start_time: float = None,
        duration: float = None,
        sample_rate: int = 16000
    ) -> np.ndarray:
        """
        Extract audio segment directly to numpy array (no temp files).

        Args:
            media_path: Path to source media file
            start_time: Start time in seconds (None = from beginning)
            duration: Duration in seconds (None = to end)
            sample_rate: Target sample rate (default 16kHz for Whisper)

        Returns:
            numpy array of audio samples (float32, normalized to [-1, 1])

        Example:
            # Extract 10 seconds starting at 30 seconds
            audio = extractor.extract_audio_segment_to_memory(
                "video.mp4", start_time=30.0, duration=10.0
            )
        """
        logger.info(
            f"[SegmentExtractor] Extracting audio segment: {media_path} "
            f"(start={start_time}s, duration={duration}s)"
        )

        try:
            # Build FFmpeg input with time range
            input_kwargs = {}
            if start_time is not None:
                input_kwargs['ss'] = start_time  # Seek to start
            if duration is not None:
                input_kwargs['t'] = duration     # Limit duration

            # Extract audio to stdout as raw PCM
            out, err = (
                ffmpeg
                .input(media_path, **input_kwargs)
                .output(
                    'pipe:',
                    format='s16le',      # 16-bit signed little-endian PCM
                    acodec='pcm_s16le',  # PCM audio codec
                    ac=1,                # Mono channel
                    ar=sample_rate       # Sample rate
                )
                .run(capture_stdout=True, capture_stderr=True)
            )

            # Convert bytes to numpy array
            audio_array = np.frombuffer(out, np.int16).flatten().astype(np.float32) / 32768.0

            duration_extracted = len(audio_array) / sample_rate
            logger.info(
                f"[SegmentExtractor] Successfully extracted {duration_extracted:.2f}s "
                f"({len(audio_array)} samples)"
            )

            return audio_array

        except ffmpeg.Error as e:
            logger.error(f"[SegmentExtractor] FFmpeg error: {e.stderr.decode()}")
            raise Exception(f"Failed to extract audio segment: {e.stderr.decode()}")
        except Exception as e:
            logger.error(f"[SegmentExtractor] Extraction failed: {str(e)}")
            raise

    def extract_audio_segment_to_file(
        self,
        media_path: str,
        output_path: str,
        start_time: float = None,
        duration: float = None,
        audio_codec: str = 'aac',
        audio_bitrate: str = '192k'
    ) -> str:
        """
        Extract audio segment to file (for operations that require file output).

        Args:
            media_path: Path to source media file
            output_path: Path for output file
            start_time: Start time in seconds (None = from beginning)
            duration: Duration in seconds (None = to end)
            audio_codec: Output audio codec (default 'aac')
            audio_bitrate: Output bitrate (default '192k')

        Returns:
            Path to output file

        Example:
            # Extract and encode segment
            output = extractor.extract_audio_segment_to_file(
                "video.mp4", "clip.aac", start_time=30.0, duration=10.0
            )
        """
        logger.info(
            f"[SegmentExtractor] Extracting audio segment to file: {output_path} "
            f"(start={start_time}s, duration={duration}s)"
        )

        try:
            # Build FFmpeg input with time range
            input_kwargs = {}
            if start_time is not None:
                input_kwargs['ss'] = start_time
            if duration is not None:
                input_kwargs['t'] = duration

            # Extract and encode
            (
                ffmpeg
                .input(media_path, **input_kwargs)
                .output(output_path, acodec=audio_codec, audio_bitrate=audio_bitrate)
                .overwrite_output()
                .run(quiet=True)
            )

            logger.info(f"[SegmentExtractor] Segment saved to {output_path}")
            return output_path

        except ffmpeg.Error as e:
            logger.error(f"[SegmentExtractor] FFmpeg error: {e.stderr.decode()}")
            raise Exception(f"Failed to extract audio segment: {e.stderr.decode()}")
        except Exception as e:
            logger.error(f"[SegmentExtractor] Extraction failed: {str(e)}")
            raise

    def apply_processing_to_segment(
        self,
        media_path: str,
        output_path: str,
        start_time: float = None,
        duration: float = None,
        filters: list = None,
        audio_codec: str = 'aac',
        audio_bitrate: str = '192k'
    ) -> str:
        """
        Extract segment and apply FFmpeg filters in one pass (most efficient).

        Args:
            media_path: Path to source media file
            output_path: Path for output file
            start_time: Start time in seconds (None = from beginning)
            duration: Duration in seconds (None = to end)
            filters: List of FFmpeg filter strings (e.g., ['loudnorm=I=-16', 'afftdn=nr=20'])
            audio_codec: Output audio codec
            audio_bitrate: Output bitrate

        Returns:
            Path to output file

        Example:
            # Extract 10s segment and normalize in one operation
            output = extractor.apply_processing_to_segment(
                "video.mp4",
                "normalized.aac",
                start_time=30.0,
                duration=10.0,
                filters=['loudnorm=I=-16:TP=-1.5:LRA=11']
            )
        """
        logger.info(
            f"[SegmentExtractor] Processing segment: {media_path} -> {output_path} "
            f"(start={start_time}s, duration={duration}s, filters={filters})"
        )

        try:
            # Build FFmpeg input with time range
            input_kwargs = {}
            if start_time is not None:
                input_kwargs['ss'] = start_time
            if duration is not None:
                input_kwargs['t'] = duration

            # Build filter chain
            stream = ffmpeg.input(media_path, **input_kwargs)

            if filters:
                for filter_str in filters:
                    stream = stream.filter(filter_str)

            # Output with encoding
            stream = stream.output(
                output_path,
                acodec=audio_codec,
                audio_bitrate=audio_bitrate
            )

            stream.overwrite_output().run(quiet=True)

            logger.info(
                f"[SegmentExtractor] Segment processed and saved to {output_path}"
            )
            return output_path

        except ffmpeg.Error as e:
            logger.error(f"[SegmentExtractor] FFmpeg error: {e.stderr.decode()}")
            raise Exception(f"Failed to process segment: {e.stderr.decode()}")
        except Exception as e:
            logger.error(f"[SegmentExtractor] Processing failed: {str(e)}")
            raise


# Singleton instance
_segment_extractor_instance = None

def get_segment_extractor() -> SegmentExtractor:
    """Get or create segment extractor singleton"""
    global _segment_extractor_instance
    if _segment_extractor_instance is None:
        _segment_extractor_instance = SegmentExtractor()
    return _segment_extractor_instance
