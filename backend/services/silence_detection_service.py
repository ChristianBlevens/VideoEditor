"""
Silence Detection Service

Detects silence using a hybrid approach:
1. Find gaps in transcript word timing
2. Verify with Voice Activity Detection (VAD)
3. Only gaps that pass both checks count as silence
"""

import logging
import numpy as np
from typing import List, Dict, Optional
import webrtcvad
import wave
import contextlib

logger = logging.getLogger(__name__)

class SilenceDetectionService:
    def __init__(self, vad_aggressiveness: int = 3):
        """
        Initialize silence detection service

        Args:
            vad_aggressiveness: VAD aggressiveness (0-3, 3 = most aggressive)
        """
        self.vad = webrtcvad.Vad(vad_aggressiveness)
        logger.info(f"Silence detection service initialized (VAD aggressiveness: {vad_aggressiveness})")

    def detect_silence(self, audio_path: str, transcript_words: List[Dict]) -> List[Dict]:
        """
        Detect silence using hybrid transcript + VAD approach

        Args:
            audio_path: Path to audio file
            transcript_words: List of word objects with 'start' and 'end' timestamps

        Returns:
            List of silence segments: [{'start': float, 'end': float, 'duration': float}, ...]
        """
        logger.info(f"[Silence Detection] Starting for {audio_path}")
        logger.info(f"[Silence Detection] Transcript words count: {len(transcript_words)}")

        # Step 1: Find gaps in transcript timing
        transcript_gaps = self._find_transcript_gaps(transcript_words)
        logger.info(f"[Silence Detection] Found {len(transcript_gaps)} gaps in transcript")

        if not transcript_gaps:
            logger.info("[Silence Detection] No gaps found in transcript")
            return []

        # Step 2: Verify each gap with VAD
        verified_silences = []
        for gap in transcript_gaps:
            if self._verify_silence_with_vad(audio_path, gap['start'], gap['end']):
                verified_silences.append(gap)
                logger.info(f"[Silence Detection] ✓ Verified silence: {gap['start']:.2f}s - {gap['end']:.2f}s ({gap['duration']:.2f}s)")
            else:
                logger.info(f"[Silence Detection] ✗ Rejected gap: {gap['start']:.2f}s - {gap['end']:.2f}s (VAD detected voice)")

        logger.info(f"[Silence Detection] Total verified silences: {len(verified_silences)}")
        return verified_silences

    def _find_transcript_gaps(self, words: List[Dict]) -> List[Dict]:
        """
        Find gaps between words in transcript

        Returns:
            List of gaps: [{'start': float, 'end': float, 'duration': float}, ...]
        """
        if not words or len(words) < 2:
            return []

        gaps = []

        # Sort words by start time
        sorted_words = sorted(words, key=lambda w: w.get('start', 0))

        for i in range(len(sorted_words) - 1):
            current_word = sorted_words[i]
            next_word = sorted_words[i + 1]

            gap_start = current_word.get('end', 0)
            gap_end = next_word.get('start', 0)
            gap_duration = gap_end - gap_start

            # Any gap counts (even tiny ones)
            if gap_duration > 0:
                gaps.append({
                    'start': gap_start,
                    'end': gap_end,
                    'duration': gap_duration
                })

        return gaps

    def _verify_silence_with_vad(self, audio_path: str, start_time: float, end_time: float) -> bool:
        """
        Verify if a time segment is silent using Voice Activity Detection

        Returns:
            True if segment is silent (no voice detected)
            False if segment contains voice
        """
        try:
            # Extract audio segment
            from backend.services.segment_extractor import get_segment_extractor
            import tempfile
            import os

            extractor = get_segment_extractor()

            # Create temporary file for segment
            temp_audio = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
            temp_audio_path = temp_audio.name
            temp_audio.close()

            try:
                # Extract segment as WAV (required for VAD)
                # Note: SegmentExtractor outputs AAC by default, but we need WAV for VAD
                # So we'll use extract_audio_segment_to_file with WAV codec
                extractor.extract_audio_segment_to_file(
                    audio_path,
                    temp_audio_path,
                    start_time=start_time,
                    duration=end_time - start_time,
                    audio_codec='pcm_s16le',  # PCM codec for WAV
                    audio_bitrate='192k'
                )

                # Analyze with VAD
                is_silent = self._analyze_with_vad(temp_audio_path)
                return is_silent

            finally:
                # Clean up temp file
                if os.path.exists(temp_audio_path):
                    os.unlink(temp_audio_path)

        except Exception as e:
            logger.error(f"[Silence Detection] VAD verification failed: {e}")
            # On error, assume it's NOT silent (conservative approach)
            return False

    def _analyze_with_vad(self, wav_path: str) -> bool:
        """
        Analyze WAV file with VAD

        Returns:
            True if silent (no voice activity)
            False if voice detected
        """
        try:
            with contextlib.closing(wave.open(wav_path, 'rb')) as wf:
                sample_rate = wf.getframerate()

                # VAD requires specific sample rates
                if sample_rate not in [8000, 16000, 32000, 48000]:
                    logger.warning(f"[VAD] Unsupported sample rate {sample_rate}Hz, resampling needed")
                    return self._analyze_with_vad_resampled(wav_path)

                # Read audio data
                frames = wf.readframes(wf.getnframes())

                # Process in 30ms chunks (VAD requirement)
                frame_duration_ms = 30
                frame_size = int(sample_rate * frame_duration_ms / 1000) * 2  # 2 bytes per sample (16-bit)

                voice_frames = 0
                total_frames = 0

                for offset in range(0, len(frames), frame_size):
                    chunk = frames[offset:offset + frame_size]

                    # VAD requires exact frame size
                    if len(chunk) < frame_size:
                        # Pad last chunk with silence
                        chunk = chunk + b'\x00' * (frame_size - len(chunk))

                    total_frames += 1

                    # Check if chunk contains voice
                    if self.vad.is_speech(chunk, sample_rate):
                        voice_frames += 1

                # If more than 10% of frames have voice, consider it NOT silent
                if total_frames == 0:
                    return True  # Empty audio = silent

                voice_percentage = (voice_frames / total_frames) * 100
                is_silent = voice_percentage < 10

                logger.debug(f"[VAD] Voice in {voice_percentage:.1f}% of frames, silent={is_silent}")
                return is_silent

        except Exception as e:
            logger.error(f"[VAD] Analysis failed: {e}")
            return False

    def _analyze_with_vad_resampled(self, wav_path: str) -> bool:
        """
        Resample audio and analyze with VAD
        """
        try:
            from pydub import AudioSegment
            import tempfile
            import os

            # Load audio
            audio = AudioSegment.from_wav(wav_path)

            # Resample to 16kHz (standard for VAD)
            audio_resampled = audio.set_frame_rate(16000).set_channels(1)

            # Save to temp file
            temp_resampled = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
            temp_resampled_path = temp_resampled.name
            temp_resampled.close()

            try:
                audio_resampled.export(temp_resampled_path, format='wav')
                return self._analyze_with_vad(temp_resampled_path)
            finally:
                if os.path.exists(temp_resampled_path):
                    os.unlink(temp_resampled_path)

        except Exception as e:
            logger.error(f"[VAD] Resampling failed: {e}")
            return False


# Global instance
_silence_detection_service = None

def get_silence_detection_service():
    """Get or create global silence detection service instance"""
    global _silence_detection_service
    if _silence_detection_service is None:
        _silence_detection_service = SilenceDetectionService()
    return _silence_detection_service
