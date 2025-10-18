/**
 * File Upload Handler
 *
 * Handles drag-drop and file selection for media import
 */

import { api } from '../../api/api-client.js';
import { showToast, updateProgressToast, hideToast } from '../../ui/ui-utils.js';
import { addMediaItem } from './project-media.js';
import { state } from '../../core/state.js';
import { renderCompiledTranscript } from '../transcripts/transcript.js';

class FileUploader {
    constructor() {
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Note: Import button click handler is registered in event-listeners.js
        // to keep all event listeners centralized

        // Drag and drop on window
        window.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
        });

        window.addEventListener('drop', async (e) => {
            e.preventDefault();
            e.stopPropagation();

            const files = Array.from(e.dataTransfer.files);
            await this.handleFiles(files);
        });
    }

    selectFiles() {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'video/*,audio/*';

        input.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files);
            await this.handleFiles(files);
        });

        input.click();
    }

    async handleFiles(files) {
        for (const file of files) {
            await this.uploadFile(file);
        }
    }

    async uploadFile(file) {
        showToast(`Uploading ${file.name}...`, 'info');

        try {
            // Upload with progress
            const result = await api.uploadFile(file, (percent) => {
                updateProgressToast(percent);
            });

            hideToast();
            showToast(`${file.name} uploaded!`, 'success', 1500);

            // Determine file type
            const isVideo = file.type.startsWith('video/');
            const isAudio = file.type.startsWith('audio/');

            const fileType = isVideo ? 'video' : (isAudio ? 'audio' : 'unknown');

            // Add to project media (not timeline)
            if (isVideo || isAudio) {
                addMediaItem(result, fileType);
                showToast(`${file.name} added to Project Media. Drag to timeline to use.`, 'success', 3000);
            }

        } catch (error) {
            hideToast();
            showToast(`Upload failed: ${error.message}`, 'error');
            console.error('Upload error:', error);
        }
    }

    async transcribeClip(clipId, audioPath) {
        console.log('[TRANSCRIBE] Starting transcription for clip:', clipId, 'path:', audioPath);

        showToast('Transcribing audio with speaker diarization...', 'info');

        try {
            // Get clip to extract timing information
            const { getClip } = await import('../../operations/operations.js');
            const clip = getClip(clipId);

            // Call backend transcription API with speaker diarization
            // Use mediaStart/mediaEnd to specify which portion of the source file to transcribe
            const result = await api.transcribeWithDiarization(
                audioPath,
                'en',
                null,                                   // Auto-detect number of speakers
                clip ? (clip.mediaStart || 0) : null,   // Start time within source media
                clip ? clip.duration : null             // Duration to transcribe
            );

            console.log('[TRANSCRIBE] Transcription completed:', result);
            console.log('[TRANSCRIBE] Segments:', result.segments);
            console.log('[TRANSCRIBE] Segments count:', result.segments?.length || 0);

            // Extract text and words from segments
            let fullText = '';
            let allWords = [];

            if (result.segments && Array.isArray(result.segments)) {
                for (const segment of result.segments) {
                    // Concatenate text
                    if (segment.text) {
                        fullText += (fullText ? ' ' : '') + segment.text;
                    }

                    // Flatten words array
                    if (segment.words && Array.isArray(segment.words)) {
                        allWords.push(...segment.words);
                    }
                }
            }

            console.log('[TRANSCRIBE] Extracted text:', fullText);
            console.log('[TRANSCRIBE] Extracted words count:', allWords.length);

            // Store transcript in state
            const transcript = {
                id: `transcript-${clipId}`,
                clipId: clipId,
                text: fullText,
                language: result.language || 'en',
                words: allWords,
                start: 0,
                duration: clip ? clip.duration : (result.duration || 0),
                end: clip ? clip.duration : (result.duration || 0)
            };

            // Add to state (replace if exists)
            const existingIndex = state.project.transcripts.findIndex(t => t.clipId === clipId);
            if (existingIndex >= 0) {
                state.project.transcripts[existingIndex] = transcript;
            } else {
                state.project.transcripts.push(transcript);
            }

            console.log('[TRANSCRIBE] Transcript stored in state:', transcript);
            console.log('[TRANSCRIBE] Total transcripts in state:', state.project.transcripts.length);

            // Re-render transcript panel
            await renderCompiledTranscript();

            // Auto-regenerate subtitles when transcript is added/updated
            if (state.playback.subtitlesEnabled) {
                const { convertTranscriptsToSubtitles } = await import('../subtitles/subtitle-system.js');
                convertTranscriptsToSubtitles();
            }

            // Automatically analyze and display pace
            console.log('[TRANSCRIBE] Running automatic pace analysis...');
            const { showPaceAnalysis } = await import('../transcripts/pace-analyzer.js');
            showPaceAnalysis();
            console.log('[TRANSCRIBE] Pace analysis complete and displayed');

            // Automatically detect silence
            console.log('[TRANSCRIBE] Running automatic silence detection...');
            try {
                const silenceResult = await api.detectSilence(audioPath, allWords);
                console.log('[TRANSCRIBE] Silence detection complete:', silenceResult);

                // Store silence data in transcript
                transcript.silences = silenceResult.silences || [];

                // Update stored transcript
                const existingIndex = state.project.transcripts.findIndex(t => t.clipId === clipId);
                if (existingIndex >= 0) {
                    state.project.transcripts[existingIndex] = transcript;
                }
            } catch (error) {
                console.error('[TRANSCRIBE] Silence detection failed:', error);
            }

            hideToast();
            showToast('Transcription complete with diarization, pace analysis, and silence detection!', 'success', 3000);

        } catch (error) {
            hideToast();
            showToast(`Transcription failed: ${error.message}`, 'error');
            console.error('[TRANSCRIBE] Error:', error);
            throw error;
        }
    }

}

// Initialize and export
export const fileUploader = new FileUploader();
