/**
 * Transcript Search
 *
 * Search functionality for transcripts
 */

import { state } from '../../core/state.js';
import { elements } from '../../rendering/dom-cache.js';
import { getClip } from '../../operations/operations.js';
import { showToast } from '../../ui/ui-utils.js';
import { seekTo } from '../playback/playback.js';
import { renderCompiledTranscript } from './transcript-core.js';

/**
 * Perform transcript search - DATA DRIVEN
 */
export async function performTranscriptSearch() {
    const query = elements.transcriptSearch.value.trim();

    if (!query) {
        // Update state
        state.search.matches = [];
        state.search.currentMatchIndex = -1;
        elements.searchResults.style.display = 'none';

        // Re-render from state (no highlights)
        renderCompiledTranscript();
        clearSearchMarkers();
        return;
    }

    // Search transcripts and build matches array
    const matches = [];
    const transcripts = state.project.transcripts;

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
    state.search.matches = matches;
    state.search.currentMatchIndex = matches.length > 0 ? 0 : -1;

    // Update UI from state (DATA DRIVEN)
    if (matches.length > 0) {
        elements.searchResults.style.display = 'flex';
        elements.searchResults.querySelector('.result-count').textContent =
            `${state.search.currentMatchIndex + 1} of ${matches.length}`;

        // Re-render compiled transcript from state (with highlights)
        renderCompiledTranscript();

        // Render timeline markers from state
        renderSearchMarkersOnTimeline();
    } else {
        elements.searchResults.style.display = 'none';
        renderCompiledTranscript();
        clearSearchMarkers();
        showToast('No matches found');
    }
}

/**
 * Navigate to next/previous match - DATA DRIVEN
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

    // Re-render compiled transcript from state
    renderCompiledTranscript();

    // Render timeline markers
    renderSearchMarkersOnTimeline();
}

/**
 * Clear search markers from timeline
 */
export function clearSearchMarkers() {
    document.querySelectorAll('.search-marker').forEach(el => el.remove());
}

/**
 * Render search result markers on timeline - DATA DRIVEN
 */
export async function renderSearchMarkersOnTimeline() {
    clearSearchMarkers();

    if (!state.search.matches || state.search.matches.length === 0) return;

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
