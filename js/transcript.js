// ==================== Transcript Management ====================
// Data-driven transcripts using building blocks

import { state } from './state.js';
import { elements } from './dom-cache.js';
import { showToast, updateProgressToast, hideToast, autoGrowTextarea } from './ui-utils.js';
import { createEdit, getSelectedClip } from './operations.js';
import { renderClip } from './rendering.js';
import { seekTo } from './playback.js';

export function initializeTranscript() {
    // Transcripts initialized from state via data-init.js

    // Render compiled transcript from all clips
    renderCompiledTranscript();
}

/**
 * Compile transcripts from all clips - DATA DRIVEN
 * Gets all transcripts, calculates absolute timeline positions, sorts by time
 * @returns {Array} Array of word objects with metadata
 */
async function compileTranscriptsFromAllClips() {
    const { getClip } = await import('./operations.js');
    const compiledWords = [];

    state.project.transcripts.forEach((transcript, transcriptIndex) => {
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
 * Displays all words from all clips in timeline order with highlights
 * Exported for use in clip operations (drag, resize, undo/redo)
 */
export async function renderCompiledTranscript() {
    console.log('  🏗️  renderCompiledTranscript() called');
    console.log('    state.search.matches:', state.search.matches?.length || 0);

    const transcriptContent = document.getElementById('transcript-content');
    transcriptContent.innerHTML = '';

    // Get all words compiled from clips
    const compiledWords = await compileTranscriptsFromAllClips();

    if (compiledWords.length === 0) {
        transcriptContent.innerHTML = '<p style="padding: 20px; text-align: center; color: #888;">No transcript available</p>';
        return;
    }

    console.log('    Compiled', compiledWords.length, 'words from all clips');

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

export function transcribeSelectedClip() {
    if (!state.selection.selectedClip) {
        showToast('No clip selected', 'warning');
        return;
    }

    showToast('Transcribing clip...', 'info');
    simulateTranscriptionProgress();
}

export function simulateTranscriptionProgress() {
    let progress = 0;
    const interval = setInterval(() => {
        progress += 10;
        updateProgressToast(progress);

        if (progress >= 100) {
            clearInterval(interval);
            hideToast();
            showToast('Transcription complete!', 'success');
        }
    }, 300);
}

/**
 * Perform transcript search - DATA DRIVEN
 * Simplified: case-insensitive literal matching only
 * Updates state, then re-renders UI from state
 */
export async function performTranscriptSearch() {
    const query = elements.transcriptSearch.value.trim();
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 SEARCH START - Query:', `"${query}"`);
    console.log('Previous state.search.matches:', state.search.matches?.length || 0);

    if (!query) {
        console.log('❌ Empty query - clearing');
        // Update state
        state.search.matches = [];
        state.search.currentMatchIndex = -1;
        elements.searchResults.style.display = 'none';

        // Re-render from state (no highlights)
        renderCompiledTranscript();
        clearSearchMarkers();
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        return;
    }

    // Search transcripts and build matches array
    const matches = [];
    const transcripts = state.project.transcripts;
    const { getClip } = await import('./operations.js');

    transcripts.forEach((transcript, index) => {
        // Get the clip this transcript belongs to
        const clip = getClip(transcript.clipId);
        if (!clip) {
            console.warn('[SEARCH] Transcript has no valid clip:', transcript.id);
            return;
        }

        const originalText = transcript.text;
        let searchText = originalText.toLowerCase();  // Always case-insensitive
        let queryText = query.toLowerCase();

        let position = 0;
        while (true) {
            // Simple literal string search
            const foundIndex = searchText.indexOf(queryText, position);
            if (foundIndex === -1) break;

            const matchLength = queryText.length;

            // Find word-level timestamp for this match (relative to clip)
            let relativeWordTime = transcript.start;
            let wordIndex = -1;

            if (transcript.words && transcript.words.length > 0) {
                let charCount = 0;
                for (let i = 0; i < transcript.words.length; i++) {
                    const wordData = transcript.words[i];
                    const wordLength = wordData.word.length;
                    if (charCount <= foundIndex && foundIndex < charCount + wordLength) {
                        relativeWordTime = wordData.start;
                        wordIndex = i;
                        break;
                    }
                    charCount += wordLength + 1; // +1 for space
                }
            }

            // Calculate absolute timeline position
            const absoluteTime = clip.start + relativeWordTime;

            matches.push({
                transcriptIndex: index,
                transcript: transcript,
                clipId: clip.id,
                trackId: clip.trackId,
                position: foundIndex,
                length: matchLength,
                wordTime: relativeWordTime,  // Relative to clip
                absoluteTime: absoluteTime,   // Absolute timeline position
                wordIndex: wordIndex,
                matchedText: originalText.substring(foundIndex, foundIndex + matchLength)
            });

            position = foundIndex + 1;
        }
    });

    // Update state
    console.log('📊 Found', matches.length, 'matches');
    matches.forEach((m, i) => {
        console.log(`  Match ${i}:`, {
            transcriptIndex: m.transcriptIndex,
            position: m.position,
            length: m.length,
            text: `"${m.matchedText}"`,
            wordTime: m.wordTime
        });
    });

    state.search.matches = matches;
    state.search.currentMatchIndex = matches.length > 0 ? 0 : -1;

    console.log('✅ State updated - matches:', state.search.matches.length);

    // Update UI from state (DATA DRIVEN)
    if (matches.length > 0) {
        console.log('🎨 Rendering UI from state...');
        elements.searchResults.style.display = 'flex';
        elements.searchResults.querySelector('.result-count').textContent =
            `${state.search.currentMatchIndex + 1} of ${matches.length}`;

        // Re-render compiled transcript from state (with highlights baked in)
        console.log('📝 Calling renderCompiledTranscript()...');
        renderCompiledTranscript();

        // Render timeline markers from state
        console.log('📍 Calling renderSearchMarkersOnTimeline()...');
        renderSearchMarkersOnTimeline();

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    } else {
        elements.searchResults.style.display = 'none';
        renderCompiledTranscript();
        clearSearchMarkers();
        showToast('No matches found');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
}

// ==================== Target Words Management ====================
export function addFillerWordsToTargets() {
    const fillerWords = 'um, uh, like, you know, basically, actually';
    addToTargets(fillerWords);
    showToast('Filler words added to targets');
}

export function addProfanityToTargets() {
    showToast('Scanning for profanity...');
    setTimeout(() => {
        // Simulated - would detect actual profanity
        showToast('No profanity detected');
    }, 1000);
}

export function addPausesToTargets() {
    const duration = parseFloat(elements.pauseDuration.value) || 2.0;
    const pauseTarget = `pause(${duration}s)`;
    addToTargets(pauseTarget);
    showToast(`Added pauses ≥${duration}s to targets`);
}

export function addToTargets(text) {
    const current = elements.targetWords.value.trim();
    if (current) {
        elements.targetWords.value = current + ', ' + text;
    } else {
        elements.targetWords.value = text;
    }
    handleTargetWordsChange();
    autoGrowTextarea(elements.targetWords);
}

export function handleTargetWordsChange() {
    autoGrowTextarea(elements.targetWords);
    updateTimelineHighlights();
}

export function updateTimelineHighlights() {
    const targets = parseTargets();

    // Note: Highlights would be rendered as part of clip rendering
    // For now, just log (full implementation would add highlight data to clips)
    if (targets.length > 0) {
        console.log('Timeline highlights updated for targets:', targets);
        // Future: Store highlight data in clip metadata and re-render affected clips
    }
}

export function parseTargets() {
    const text = elements.targetWords.value.trim();
    if (!text) return [];

    // Split by comma, handle pause() syntax
    return text.split(',').map(t => t.trim()).filter(t => t);
}

export function isolateTargets() {
    const targets = parseTargets();
    if (targets.length === 0) {
        showToast('No targets defined', 'warning');
        return;
    }

    const selectedClip = getSelectedClip();
    if (!selectedClip) {
        showToast('No clip selected', 'warning');
        return;
    }

    // Create edit record in state
    createEdit(
        selectedClip.id,
        'isolate',
        'Isolated targets',
        { targets: targets }
    );

    // Re-render clip to show edit indicator
    renderClip(selectedClip.id);

    showToast(`Isolating ${targets.length} target(s) (non-destructive)`);
}

export function removeTargets() {
    const targets = parseTargets();
    if (targets.length === 0) {
        showToast('No targets defined', 'warning');
        return;
    }

    const selectedClip = getSelectedClip();
    if (!selectedClip) {
        showToast('No clip selected', 'warning');
        return;
    }

    // Create edit record in state
    createEdit(
        selectedClip.id,
        'delete',
        'Removed targets',
        { targets: targets }
    );

    // Re-render clip to show edit indicator
    renderClip(selectedClip.id);

    showToast(`Removing ${targets.length} target(s) (non-destructive)`);
}

/**
 * Add edit indicator (now data-driven via operations/rendering)
 * This function is kept for backwards compatibility but now uses the data layer
 */
export function addEditIndicator(type, description) {
    const selectedClip = getSelectedClip();
    if (!selectedClip) {
        console.warn('Cannot add edit indicator: no clip selected');
        return;
    }

    // Create edit record in state
    createEdit(selectedClip.id, type, description);

    // Re-render clip to show edit indicator
    renderClip(selectedClip.id);
}

/**
 * Undo edit (placeholder - would need edit ID system)
 */
export function undoEdit(indicator, description) {
    // TODO: Implement proper undo via edit ID
    showToast(`Undo not yet implemented: ${description}`, 'warning');
}

// Case-sensitive and regex toggles removed - search is now always case-insensitive literal matching

/**
 * Clear search markers from timeline
 */
function clearSearchMarkers() {
    document.querySelectorAll('.search-marker').forEach(el => el.remove());
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
 * Render search result markers on timeline - DATA DRIVEN
 * Reads from state.search.matches
 * Places markers INSIDE the clip element (parented to clip)
 */
export async function renderSearchMarkersOnTimeline() {
    clearSearchMarkers();

    if (!state.search.matches || state.search.matches.length === 0) return;

    const { getClip } = await import('./operations.js');

    // Create markers from state - place inside each clip element
    state.search.matches.forEach((match, idx) => {
        // Find the clip element for this match
        const clipElement = document.querySelector(`.clip[data-clip-id="${match.clipId}"]`);
        if (!clipElement) {
            console.warn('[SEARCH] Clip not found for match:', match.clipId);
            return;
        }

        const marker = document.createElement('div');
        marker.className = 'search-marker';

        // Store relative time within clip (not absolute timeline time)
        const relativeTime = match.wordTime;  // Already relative to clip start
        marker.setAttribute('data-time', relativeTime);
        marker.setAttribute('data-match-index', idx);
        marker.setAttribute('data-clip-id', match.clipId);

        // Determine if this is the current match for styling
        if (idx === state.search.currentMatchIndex) {
            marker.classList.add('current-match');
        }

        clipElement.appendChild(marker);

        // Position marker relative to clip width
        const clip = getClip(match.clipId);
        if (clip) {
            const position = (relativeTime / clip.duration) * 100;
            marker.style.left = `${position}%`;
        }
    });
}

/**
 * Navigate to next/previous match - DATA DRIVEN
 * Updates state, then re-renders
 */
export function navigateMatch(direction) {
    if (state.search.matches.length === 0) {
        showToast('No search results', 'info');
        return;
    }

    // Update state
    state.search.currentMatchIndex += direction;

    // Wrap around
    if (state.search.currentMatchIndex >= state.search.matches.length) {
        state.search.currentMatchIndex = 0;
    } else if (state.search.currentMatchIndex < 0) {
        state.search.currentMatchIndex = state.search.matches.length - 1;
    }

    // Update result counter
    elements.searchResults.querySelector('.result-count').textContent =
        `${state.search.currentMatchIndex + 1} of ${state.search.matches.length}`;

    // Re-render compiled transcript from state (current match will get .current-match class)
    renderCompiledTranscript();

    // Render timeline markers (in case timeline has changed)
    renderSearchMarkersOnTimeline();
}

export function exportTranscript() {
    const format = elements.transcriptFormat.value;
    showToast(`Exporting transcript as ${format.toUpperCase()}...`);
}

// ==================== Media Import ====================
export function handleMediaDragStart(e) {
    e.dataTransfer.effectAllowed = 'copy';
    const type = e.target.getAttribute('data-type');
    const src = e.target.getAttribute('data-src');
    e.dataTransfer.setData('text/plain', JSON.stringify({ type, src }));
}

export function handleTrackDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
}

export async function handleTrackDrop(e) {
    e.preventDefault();
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
    const trackContent = e.target.closest('.track-content');
    const acceptType = trackContent.getAttribute('data-accept');

    if (acceptType !== data.type) {
        showToast(`This track only accepts ${acceptType} files`, 'warning');
        return;
    }

    // Get track ID
    const track = trackContent.closest('[data-track-id]');
    const trackId = track.getAttribute('data-track-id');

    // Calculate drop position based on mouse position
    const rect = trackContent.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const trackWidth = rect.width;
    const viewportDuration = state.timeline.viewportEnd - state.timeline.viewportStart;
    const dropTime = state.timeline.viewportStart + (mouseX / trackWidth) * viewportDuration;

    // Apply snap to grid if enabled
    let startTime = dropTime;
    if (state.timeline.snapToGrid) {
        const gridSize = 1.0; // 1 second grid
        startTime = Math.round(startTime / gridSize) * gridSize;
    }

    // Create new clip
    const { createClip } = await import('./operations.js');
    const { renderAllClips } = await import('./rendering.js');
    const { pushToHistory } = await import('./history-manager.js');

    pushToHistory();

    const clipId = createClip({
        type: data.type,
        start: startTime,
        duration: 10, // Default duration
        trackId: trackId,
        src: data.src
    });

    // If video, also create attached audio
    if (data.type === 'video') {
        const audioTrackId = trackId + '-audio';
        createClip({
            type: 'attached-audio',
            start: startTime,
            duration: 10,
            trackId: audioTrackId,
            parentClipId: clipId
        });
    }

    await renderAllClips();
    showToast(`${data.type} clip added to timeline`);
}

export function importMedia() {
    showToast('Import media dialog (backend required)');
}
