"""
Faster Whisper transcription service
"""

from faster_whisper import WhisperModel
import torch
import logging

logger = logging.getLogger(__name__)

class WhisperService:
    """Optimized Faster Whisper transcription service"""

    def __init__(self, device="cpu"):
        self.model = None
        self.device = device
        self.compute_type = "int8_float16" if device == "cuda" else "int8"
        logger.info(f"WhisperService initialized (device={device})")

    def load_model(self, model_size="base"):
        """
        Load Whisper model

        Model sizes: tiny, base, small, medium, large-v3
        Use 'base' for testing, 'medium' for production
        """
        logger.info(f"Loading Whisper model: {model_size}")

        self.model = WhisperModel(
            model_size,
            device=self.device,
            compute_type=self.compute_type,
            cpu_threads=4,
            num_workers=1
        )

        logger.info("Whisper model loaded successfully")

    def is_loaded(self):
        return self.model is not None

    def transcribe_audio(self, audio_path: str, language="en", start_time: float = None, duration: float = None):
        """
        Transcribe audio with word-level timestamps

        Args:
            audio_path: Path to audio/video file
            language: Language code
            start_time: Start time in seconds (None = from beginning)
            duration: Duration in seconds (None = entire file)
        """
        logger.info(f"Transcribing: {audio_path} (start={start_time}, duration={duration})")

        # Extract segment if time range specified
        if start_time is not None or duration is not None:
            from backend.services.segment_extractor import get_segment_extractor
            extractor = get_segment_extractor()

            # Extract to memory as numpy array
            audio_array = extractor.extract_audio_segment_to_memory(
                audio_path,
                start_time=start_time,
                duration=duration,
                sample_rate=16000
            )

            # Transcribe from array (faster-whisper supports numpy arrays)
            segments, info = self.model.transcribe(
                audio_array,
                language=language,
                word_timestamps=True,
                vad_filter=True
            )
        else:
            # Transcribe entire file
            segments, info = self.model.transcribe(
                audio_path,
                language=language,
                word_timestamps=True,
                vad_filter=True
            )

        result = {
            "segments": [],
            "language": info.language,
            "duration": info.duration
        }

        for segment in segments:
            seg_data = {
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip(),
                "words": []
            }

            # Add word-level timestamps
            if hasattr(segment, 'words') and segment.words:
                for word in segment.words:
                    seg_data["words"].append({
                        "word": word.word,
                        "start": word.start,
                        "end": word.end,
                        "probability": word.probability
                    })

            result["segments"].append(seg_data)

        logger.info(f"Transcription complete: {len(result['segments'])} segments")
        return result

    def transcribe_with_diarization(self, audio_path: str, language: str = "en", num_speakers: int = None, start_time: float = None, duration: float = None):
        """
        Transcribe audio with speaker diarization
        Uses Whisper for transcription + pyannote for speaker detection

        Args:
            audio_path: Path to audio/video file
            language: Language code
            num_speakers: Expected number of speakers (None = auto-detect)
            start_time: Start time in seconds (None = from beginning)
            duration: Duration in seconds (None = entire file)

        Requires:
            - pyannote.audio (installed via requirements.txt)
            - HF_TOKEN environment variable set with Hugging Face access token
            - Accepted conditions at https://huggingface.co/pyannote/speaker-diarization-3.1
        """
        logger.info(f"Transcribing with diarization: {audio_path} (speakers={num_speakers})")

        # Standard transcription first
        result = self.transcribe_audio(audio_path, language, start_time, duration)

        # Get diarization service from app (properly initialized with loaded model)
        from backend.services.diarization_service import align_speakers_to_segments
        from app import get_diarization_service

        diarization_service = get_diarization_service()

        if not diarization_service.is_loaded():
            logger.warning("Diarization model not loaded - returning transcription without speaker labels")
            # Add UNKNOWN speaker labels
            for segment in result['segments']:
                segment['speaker'] = 'UNKNOWN'
                for word in segment.get('words', []):
                    word['speaker'] = 'UNKNOWN'
            return result

        # Run speaker diarization on the audio
        try:
            print("[WHISPER] Starting diarization process", flush=True)
            # If we extracted a segment, we need to diarize that segment
            if start_time is not None or duration is not None:
                print(f"[WHISPER] Extracting segment: start={start_time}, duration={duration}", flush=True)
                # Extract segment to temporary file for diarization
                from backend.services.segment_extractor import get_segment_extractor
                import tempfile
                import os

                extractor = get_segment_extractor()
                temp_audio = tempfile.NamedTemporaryFile(suffix='.wav', delete=False)
                temp_audio_path = temp_audio.name
                temp_audio.close()

                try:
                    # Extract segment to temp file
                    print(f"[WHISPER] Extracting segment to: {temp_audio_path}", flush=True)
                    extractor.extract_audio_segment(
                        audio_path,
                        temp_audio_path,
                        start_time=start_time,
                        duration=duration
                    )

                    print(f"[WHISPER] Running diarization on segment", flush=True)
                    # Run diarization on the segment
                    speaker_segments = diarization_service.diarize(
                        temp_audio_path,
                        num_speakers=num_speakers
                    )
                finally:
                    # Clean up temp file
                    if os.path.exists(temp_audio_path):
                        os.unlink(temp_audio_path)
            else:
                print(f"[WHISPER] Running diarization on full file", flush=True)
                # Diarize entire file
                speaker_segments = diarization_service.diarize(
                    audio_path,
                    num_speakers=num_speakers
                )

            logger.info(f"Diarization found {len(speaker_segments)} speaker segments")

            print("[WHISPER] Aligning speakers to segments", flush=True)
            # Align speaker segments to transcript segments and words
            result['segments'] = align_speakers_to_segments(
                result['segments'],
                speaker_segments
            )

            logger.info("Speaker alignment complete")

        except Exception as e:
            print(f"[WHISPER] Diarization ERROR: {type(e).__name__}: {str(e)}", flush=True)
            import traceback
            print(f"[WHISPER] Traceback:\n{traceback.format_exc()}", flush=True)
            logger.error(f"Diarization failed: {e}")
            # Fallback to UNKNOWN labels
            for segment in result['segments']:
                segment['speaker'] = 'UNKNOWN'
                for word in segment.get('words', []):
                    word['speaker'] = 'UNKNOWN'

        return result
