"""
FFmpeg video processing service
"""

import ffmpeg
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

class VideoService:
    """Direct FFmpeg video processing"""

    def extract_clip(self, video_path: str, start: float, end: float, output_path: str = None):
        """
        Extract video clip using FFmpeg stream copy (no re-encoding)
        ~50x faster than re-encoding
        """
        if not output_path:
            output_path = f"data/cache/{Path(video_path).stem}_clip_{start}_{end}.mp4"

        logger.info(f"Extracting clip: {start}s to {end}s")

        try:
            (
                ffmpeg
                .input(video_path, ss=start, to=end)
                .output(output_path, c='copy', avoid_negative_ts='make_zero')
                .overwrite_output()
                .run(capture_stdout=True, capture_stderr=True)
            )
            return output_path
        except ffmpeg.Error as e:
            logger.error(f"FFmpeg error: {e.stderr.decode()}")
            raise Exception(f"FFmpeg error: {e.stderr.decode()}")
