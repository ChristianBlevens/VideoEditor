"""
Speaker Diarization Service using pyannote.audio

Provides speaker diarization capabilities to identify and label different speakers in audio.
"""

import logging
import os
from typing import Optional, Dict, List, Tuple
import numpy as np

logger = logging.getLogger(__name__)

class DiarizationService:
    """
    Speaker diarization using pyannote.audio

    Requires Hugging Face access token to download models.
    Set HF_TOKEN environment variable or pass token to constructor.
    """

    def __init__(self, hf_token: Optional[str] = None, device: str = "cpu"):
        self.pipeline = None
        self.device = device
        self.hf_token = hf_token or os.getenv("HF_TOKEN")

        if not self.hf_token:
            logger.warning(
                "No Hugging Face token provided. Speaker diarization will not work. "
                "Set HF_TOKEN environment variable or pass token to constructor. "
                "Get token at: https://huggingface.co/settings/tokens"
            )

        logger.info(f"DiarizationService initialized (device={device}, token={'set' if self.hf_token else 'not set'})")

    def load_model(self, model_name: str = "pyannote/speaker-diarization-3.1"):
        """
        Load speaker diarization model from Hugging Face

        Args:
            model_name: Hugging Face model identifier

        Before using, you must accept user conditions at:
        - https://huggingface.co/pyannote/speaker-diarization-3.1
        - https://huggingface.co/pyannote/segmentation
        """
        if not self.hf_token:
            raise ValueError(
                "Hugging Face token required. "
                "Visit https://huggingface.co/settings/tokens to create one."
            )

        try:
            from pyannote.audio import Pipeline
            import torch

            logger.info(f"Loading diarization model: {model_name}")

            self.pipeline = Pipeline.from_pretrained(
                model_name,
                token=self.hf_token
            )

            # Move to GPU if available
            if self.device == "cuda" and torch.cuda.is_available():
                self.pipeline.to(torch.device("cuda"))
                logger.info("Diarization pipeline moved to CUDA")

            logger.info("Diarization model loaded successfully")

        except ImportError:
            raise ImportError(
                "pyannote.audio not installed. "
                "Install with: pip install pyannote.audio"
            )
        except Exception as e:
            logger.error(f"Failed to load diarization model: {e}")
            raise

    def is_loaded(self) -> bool:
        """Check if diarization model is loaded"""
        return self.pipeline is not None

    def diarize(
        self,
        audio_path: str,
        num_speakers: Optional[int] = None,
        min_speakers: Optional[int] = None,
        max_speakers: Optional[int] = None
    ) -> List[Dict]:
        """
        Perform speaker diarization on audio file

        Args:
            audio_path: Path to audio file
            num_speakers: Exact number of speakers (if known)
            min_speakers: Minimum number of speakers
            max_speakers: Maximum number of speakers

        Returns:
            List of speaker segments with format:
            [
                {"start": 0.5, "end": 1.5, "speaker": "SPEAKER_00"},
                {"start": 1.5, "end": 3.2, "speaker": "SPEAKER_01"},
                ...
            ]
        """
        if not self.is_loaded():
            raise RuntimeError("Diarization model not loaded. Call load_model() first.")

        logger.info(f"Running diarization on: {audio_path}")

        # Build parameters
        params = {}
        if num_speakers is not None:
            params["num_speakers"] = num_speakers
        if min_speakers is not None:
            params["min_speakers"] = min_speakers
        if max_speakers is not None:
            params["max_speakers"] = max_speakers

        # Run diarization
        diarization = self.pipeline(audio_path, **params)

        # Convert to list format
        segments = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            segments.append({
                "start": turn.start,
                "end": turn.end,
                "speaker": speaker
            })

        logger.info(f"Diarization complete: {len(segments)} speaker segments")
        return segments

    def diarize_from_memory(
        self,
        waveform: np.ndarray,
        sample_rate: int,
        num_speakers: Optional[int] = None,
        min_speakers: Optional[int] = None,
        max_speakers: Optional[int] = None
    ) -> List[Dict]:
        """
        Perform speaker diarization on audio waveform in memory

        Args:
            waveform: Audio waveform (numpy array)
            sample_rate: Audio sample rate
            num_speakers: Exact number of speakers (if known)
            min_speakers: Minimum number of speakers
            max_speakers: Maximum number of speakers

        Returns:
            List of speaker segments
        """
        if not self.is_loaded():
            raise RuntimeError("Diarization model not loaded. Call load_model() first.")

        logger.info("Running diarization on in-memory audio")

        # Build parameters
        params = {}
        if num_speakers is not None:
            params["num_speakers"] = num_speakers
        if min_speakers is not None:
            params["min_speakers"] = min_speakers
        if max_speakers is not None:
            params["max_speakers"] = max_speakers

        # Prepare audio input
        audio_input = {
            "waveform": waveform,
            "sample_rate": sample_rate
        }

        # Run diarization
        diarization = self.pipeline(audio_input, **params)

        # Convert to list format
        segments = []
        for turn, _, speaker in diarization.itertracks(yield_label=True):
            segments.append({
                "start": turn.start,
                "end": turn.end,
                "speaker": speaker
            })

        logger.info(f"Diarization complete: {len(segments)} speaker segments")
        return segments


def align_speakers_to_words(
    words: List[Dict],
    speaker_segments: List[Dict]
) -> List[Dict]:
    """
    Align speaker labels to word-level timestamps

    Args:
        words: List of word dicts with 'start', 'end', 'word' keys
        speaker_segments: List of speaker segments from diarization

    Returns:
        List of words with 'speaker' field added
    """
    if not speaker_segments:
        # No diarization data, return words unchanged
        return words

    # Sort segments by start time for efficient lookup
    sorted_segments = sorted(speaker_segments, key=lambda x: x['start'])

    # Assign speaker to each word based on maximum overlap
    words_with_speakers = []
    for word in words:
        word_start = word['start']
        word_end = word['end']
        word_duration = word_end - word_start

        best_speaker = None
        max_overlap = 0

        # Find speaker segment with maximum temporal overlap
        for segment in sorted_segments:
            # Calculate overlap
            overlap_start = max(word_start, segment['start'])
            overlap_end = min(word_end, segment['end'])
            overlap = max(0, overlap_end - overlap_start)

            if overlap > max_overlap:
                max_overlap = overlap
                best_speaker = segment['speaker']

        # Add speaker to word
        word_with_speaker = word.copy()
        word_with_speaker['speaker'] = best_speaker if best_speaker else "UNKNOWN"
        words_with_speakers.append(word_with_speaker)

    return words_with_speakers


def align_speakers_to_segments(
    segments: List[Dict],
    speaker_segments: List[Dict]
) -> List[Dict]:
    """
    Align speaker labels to transcript segments

    Args:
        segments: List of transcript segments with 'start', 'end', 'text', 'words' keys
        speaker_segments: List of speaker segments from diarization

    Returns:
        List of segments with 'speaker' field added
    """
    if not speaker_segments:
        return segments

    # Sort segments by start time
    sorted_speaker_segments = sorted(speaker_segments, key=lambda x: x['start'])

    segments_with_speakers = []
    for segment in segments:
        seg_start = segment['start']
        seg_end = segment['end']
        seg_duration = seg_end - seg_start

        # Find dominant speaker for this segment
        speaker_durations = {}

        for spk_seg in sorted_speaker_segments:
            # Calculate overlap
            overlap_start = max(seg_start, spk_seg['start'])
            overlap_end = min(seg_end, spk_seg['end'])
            overlap = max(0, overlap_end - overlap_start)

            if overlap > 0:
                speaker = spk_seg['speaker']
                speaker_durations[speaker] = speaker_durations.get(speaker, 0) + overlap

        # Assign speaker with most overlap
        dominant_speaker = "UNKNOWN"
        if speaker_durations:
            dominant_speaker = max(speaker_durations.items(), key=lambda x: x[1])[0]

        # Create segment copy with speaker
        segment_with_speaker = segment.copy()
        segment_with_speaker['speaker'] = dominant_speaker

        # Also align words if present
        if 'words' in segment and segment['words']:
            segment_with_speaker['words'] = align_speakers_to_words(
                segment['words'],
                speaker_segments
            )

        segments_with_speakers.append(segment_with_speaker)

    return segments_with_speakers


# Singleton instance
_diarization_service = None

def get_diarization_service(device: str = "cpu", hf_token: Optional[str] = None):
    """Get or create singleton diarization service instance"""
    global _diarization_service
    if _diarization_service is None:
        _diarization_service = DiarizationService(hf_token=hf_token, device=device)
    return _diarization_service
