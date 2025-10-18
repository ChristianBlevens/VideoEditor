/**
 * Transcript Core
 *
 * Core transcript compilation and rendering functionality
 */

import { state } from '../../core/state.js';
import { elements } from '../../rendering/dom-cache.js';
import { getClip } from '../../operations/operations.js';
import { seekTo } from '../playback/playback.js';
import { showToast, updateProgressToast, hideToast } from '../../ui/ui-utils.js';
import { api } from '../../api/api-client.js';
import { fileUploader } from '../project/file-uploader.js';

/**
 * Initialize transcript system
 */
export function initializeTranscript() {
    // Transcripts initialized from state via data-init.js
    renderCompiledTranscript();
}

/**
 * Update transcript tab header for selected clip(s)
 */
export function updateTranscriptForSelectedClip() {
    const headerLabel = document.getElementById('transcript-selected-clip');
    if (!headerLabel) return;

    const selectedCount = state.selection.selectedClips.length;

    if (selectedCount === 0) {
        headerLabel.textContent = 'Select a clip to view transcript';
        return;
    }

    if (selectedCount === 1) {
        const clip = getClip(state.selection.selectedClips[0]);
        if (clip) {
            const clipName = clip.name || `Clip ${clip.id}`;
            headerLabel.textContent = `Transcript for: ${clipName}`;
        } else {
            headerLabel.textContent = 'Select a clip to view transcript';
        }
    } else {
        headerLabel.textContent = `${selectedCount} clips selected`;
    }
}

/**
 * Compile transcripts from selected clips only - DATA DRIVEN
 */
export async function compileTranscriptsFromAllClips() {
    const compiledWords = [];
    const selectedClipIds = state.selection.selectedClips;

    // If no clips selected, return empty
    if (selectedClipIds.length === 0) {
        return [];
    }

    state.project.transcripts.forEach((transcript, transcriptIndex) => {
        // Only include transcripts for selected clips
        if (!selectedClipIds.includes(transcript.clipId)) {
            return;
        }

        const clip = getClip(transcript.clipId);
        if (!clip) {
            console.warn('[COMPILE] Transcript has no valid clip:', transcript.id);
            return;
        }

        // Add each word with absolute timeline position
        if (transcript.words && transcript.words.length > 0) {
            transcript.words.forEach((word, wordIndex) => {
                const absoluteTime = clip.start + word.start;
                compiledWords.push({
                    text: word.word,
                    absoluteTime: absoluteTime,
                    transcriptIndex: transcriptIndex,
                    wordIndex: wordIndex,
                    clipId: clip.id,
                    trackId: clip.trackId,
                    wordData: word
                });
            });
        }
    });

    // Sort by absolute timeline position
    compiledWords.sort((a, b) => a.absoluteTime - b.absoluteTime);

    return compiledWords;
}

/**
 * Render compiled transcript panel - DATA DRIVEN
 */
export async function renderCompiledTranscript() {
    const transcriptContent = document.getElementById('transcript-content');
    transcriptContent.innerHTML = '';

    // Get all words compiled from clips
    const compiledWords = await compileTranscriptsFromAllClips();

    if (compiledWords.length === 0) {
        transcriptContent.innerHTML = '<p style="padding: 20px; text-align: center; color: #888;">No transcript available</p>';
        return;
    }

    // Create a single segment for all words
    const segment = document.createElement('div');
    segment.className = 'transcript-segment';

    const speakerSpan = document.createElement('span');
    speakerSpan.className = 'segment-speaker';
    speakerSpan.textContent = 'Compiled Transcript';
    segment.appendChild(speakerSpan);

    // Group words into time-based segments for display
    let currentTimeSegment = null;
    let currentTimeGroup = [];
    let lastTime = -999;

    compiledWords.forEach((wordObj, idx) => {
        // Start new time segment if gap > 1 second
        if (wordObj.absoluteTime - lastTime > 1.0 || !currentTimeSegment) {
            // Save previous segment if exists
            if (currentTimeSegment && currentTimeGroup.length > 0) {
                renderTimeSegment(currentTimeSegment, currentTimeGroup);
            }

            // Create new time segment
            currentTimeSegment = document.createElement('div');
            currentTimeSegment.className = 'transcript-item';
            currentTimeSegment.setAttribute('data-time', wordObj.absoluteTime);

            const timeSpan = document.createElement('span');
            timeSpan.className = 'transcript-time';
            const minutes = Math.floor(wordObj.absoluteTime / 60);
            const seconds = Math.floor(wordObj.absoluteTime % 60);
            timeSpan.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

            currentTimeSegment.appendChild(timeSpan);
            segment.appendChild(currentTimeSegment);

            currentTimeGroup = [];
        }

        currentTimeGroup.push(wordObj);
        lastTime = wordObj.absoluteTime;
    });

    // Render final segment
    if (currentTimeSegment && currentTimeGroup.length > 0) {
        renderTimeSegment(currentTimeSegment, currentTimeGroup);
    }

    transcriptContent.appendChild(segment);

    // Auto-scroll to current match if exists
    scrollToCurrentMatchWord();
}

/**
 * Render a time segment with word highlighting
 */
function renderTimeSegment(segmentDiv, words) {
    const textP = document.createElement('p');
    textP.className = 'transcript-text';

    words.forEach((wordObj, idx) => {
        // Check if this word matches any search result
        let matchType = null; // null, 'blue', or 'green'

        if (state.search.matches && state.search.matches.length > 0) {
            state.search.matches.forEach((match, matchIdx) => {
                // Check if this word is part of the match
                if (match.transcriptIndex === wordObj.transcriptIndex &&
                    match.wordIndex === wordObj.wordIndex) {
                    // Determine if current match (green) or other match (blue)
                    if (state.search.currentMatchIndex === matchIdx) {
                        matchType = 'green';
                    } else if (!matchType) {
                        matchType = 'blue';
                    }
                }
            });
        }

        // Create word span
        const wordSpan = document.createElement('span');
        wordSpan.textContent = wordObj.text;
        wordSpan.setAttribute('data-transcript-index', wordObj.transcriptIndex);
        wordSpan.setAttribute('data-word-index', wordObj.wordIndex);
        wordSpan.setAttribute('data-absolute-time', wordObj.absoluteTime);

        if (matchType === 'green') {
            wordSpan.className = 'word-match current-match';
        } else if (matchType === 'blue') {
            wordSpan.className = 'word-match';
        }

        // Click to seek
        wordSpan.style.cursor = 'pointer';
        wordSpan.addEventListener('click', () => {
            seekTo(wordObj.absoluteTime);
        });

        textP.appendChild(wordSpan);

        // Add space between words
        if (idx < words.length - 1) {
            textP.appendChild(document.createTextNode(' '));
        }
    });

    segmentDiv.appendChild(textP);
}

/**
 * Scroll to current match word in compiled transcript
 */
function scrollToCurrentMatchWord() {
    if (state.search.currentMatchIndex === -1 || !state.search.matches.length) return;

    const currentMatch = state.search.matches[state.search.currentMatchIndex];

    // Find the word span with matching transcript and word index
    const wordSpan = document.querySelector(
        `span[data-transcript-index="${currentMatch.transcriptIndex}"][data-word-index="${currentMatch.wordIndex}"]`
    );

    if (wordSpan) {
        wordSpan.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Seek to absolute word time on timeline
    seekTo(currentMatch.absoluteTime);
}

/**
 * Handle whisper model selection change
 */
export async function handleWhisperModelChange(e) {
    const modelSize = e.target.value;

    // Disable transcribe button while loading
    elements.transcribeBtn.disabled = true;
    elements.whisperModelSelect.disabled = true;
    elements.modelStatus.textContent = `Loading ${modelSize} model...`;
    elements.modelStatus.style.color = '#ff9800';

    try {
        const result = await api.changeWhisperModel(modelSize);

        if (result.success) {
            elements.modelStatus.textContent = `Model: ${modelSize} (ready)`;
            elements.modelStatus.style.color = '#4caf50';
            showToast(`Whisper ${modelSize} model loaded successfully`, 'success');
        } else {
            throw new Error('Model change failed');
        }
    } catch (error) {
        console.error('[WHISPER MODEL] Error:', error);
        elements.modelStatus.textContent = `Error loading model`;
        elements.modelStatus.style.color = '#f44336';
        showToast(`Failed to load ${modelSize} model: ${error.message}`, 'error');
    } finally {
        // Re-enable controls
        elements.transcribeBtn.disabled = false;
        elements.whisperModelSelect.disabled = false;
    }
}

/**
 * Transcribe selected clip
 */
export async function transcribeSelectedClip() {
    if (state.selection.selectedClips.length === 0) {
        showToast('No clip selected', 'warning');
        return;
    }

    // Transcribe the first selected clip
    const clip = state.project.clips.get(state.selection.selectedClips[0]);
    if (!clip) {
        showToast('Clip not found', 'error');
        return;
    }

    if (!clip.src) {
        showToast('Clip has no source file', 'error');
        return;
    }

    // Use fileUploader's transcription method
    try {
        await fileUploader.transcribeClip(clip.id, clip.src);
    } catch (error) {
        showToast(`Transcription failed: ${error.message}`, 'error');
    }
}

/**
 * Export transcript
 */
export function exportTranscript() {
    const format = elements.transcriptFormat.value;
    showToast(`Exporting transcript as ${format.toUpperCase()}...`);
}
