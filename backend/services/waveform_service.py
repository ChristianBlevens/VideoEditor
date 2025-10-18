"""
Waveform generation service
"""

import numpy as np
from pydub import AudioSegment
import logging

logger = logging.getLogger(__name__)

class WaveformService:
    """Generate waveform peak data for visualization"""

    def generate_waveform(self, audio_path: str, width: int = 1000):
        """
        Generate waveform peaks with accurate representation

        Returns array of peak values for rendering
        """
        logger.info(f"Generating waveform: {audio_path} (width={width})")

        try:
            # Load audio
            audio = AudioSegment.from_file(audio_path)

            # Get samples
            samples = np.array(audio.get_array_of_samples())

            # Convert to mono if stereo
            if audio.channels == 2:
                # Reshape to (samples, channels) and average
                samples = samples.reshape((-1, 2))
                samples = np.mean(samples, axis=1)

            # Normalize to [-1, 1]
            samples = samples.astype(np.float32) / (2**15)

            # Calculate exact chunk size (use float division for accuracy)
            num_samples = len(samples)
            chunk_size = num_samples / width

            # Generate peaks using proper averaging
            peaks = []
            for i in range(width):
                # Use floating point indexing for accurate chunk boundaries
                start = int(i * chunk_size)
                end = int((i + 1) * chunk_size)

                # Ensure we don't go out of bounds
                end = min(end, num_samples)

                chunk = samples[start:end]
                if len(chunk) > 0:
                    # Use max absolute value for peak
                    peak = float(np.max(np.abs(chunk)))
                    peaks.append(peak)
                else:
                    peaks.append(0.0)

            duration = len(audio) / 1000.0  # Convert ms to seconds

            return {
                "peaks": peaks,
                "duration": duration,
                "sample_rate": audio.frame_rate
            }

        except Exception as e:
            logger.error(f"Waveform generation failed: {e}")
            raise
