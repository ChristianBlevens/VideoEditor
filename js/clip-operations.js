// ==================== Clip Operations ====================
// Data-driven clip operations using building blocks

import { state } from './state.js';
import { showToast } from './ui-utils.js';
import {
    selectClip as selectClipData,
    deleteClip,
    getSelectedClip,
    updateClip,
    createEdit,
    createClip,
    getClipTranscripts,
    createTranscript,
    splitTranscript,
    updateTranscript
} from './operations.js';
import { renderAllClips, renderClip } from './rendering.js';
import { renderClipProperties } from './clip-properties.js';
import { pushToHistory } from './history-manager.js';
import { addTrackAction } from './track-actions.js';

/**
 * Select a clip by element or ID
 * @param {HTMLElement|string} clipElementOrId - DOM element or clip ID
 */
export async function selectClip(clipElementOrId) {
    let clipId;

    if (typeof clipElementOrId === 'string') {
        // Already have ID
        clipId = clipElementOrId;
    } else {
        // Get ID from element
        clipId = clipElementOrId.getAttribute('data-clip-id');
    }

    // Update data
    selectClipData(clipId);

    // Render all clips to update selection state
    await renderAllClips();

    // Render clip properties panel
    renderClipProperties();

    console.log('Selected clip:', clipId);
}

/**
 * Split clip at playhead position
 * If clip has transcripts, split will snap to word boundaries
 */
export async function splitClipAtPlayhead() {
    const playheadTime = state.playback.currentTime;

    // Always find clip at playhead time (ignore selection for split)
    const clipToSplit = findClipAtTime(playheadTime);

    if (!clipToSplit) {
        showToast('No clip at playhead position', 'warning');
        return;
    }

    // Check if track is locked
    const trackState = state.tracks[clipToSplit.trackId];
    if (trackState && trackState.locked) {
        showToast('Cannot split clip on locked track', 'warning');
        return;
    }

    // Check if playhead is within clip bounds
    const clipEnd = clipToSplit.start + clipToSplit.duration;
    if (playheadTime <= clipToSplit.start || playheadTime >= clipEnd) {
        showToast('Playhead must be within clip bounds', 'warning');
        return;
    }

    // Push to history before making changes
    pushToHistory();

    // Save the current history stack size to associate actions with this operation
    const historyIndex = state.history.undoStack.length;

    // Calculate split point relative to clip start (before any snapping)
    let splitPoint = playheadTime - clipToSplit.start;
    let snappedToWordBoundary = false;

    // Check if clip has transcripts - if so, snap to word boundary
    const clipTranscripts = getClipTranscripts(clipToSplit.id);
    if (clipTranscripts.length > 0) {
        // Find the earliest word boundary snap position across all transcripts
        let earliestSnapTime = null;

        for (const transcript of clipTranscripts) {
            if (!transcript.words || transcript.words.length === 0) continue;

            const relativePlayheadTime = splitPoint;

            // Find if we're in the middle of a word
            for (let i = 0; i < transcript.words.length; i++) {
                const word = transcript.words[i];

                // If playhead is in middle of a word, snap to end of word
                if (relativePlayheadTime >= word.start && relativePlayheadTime < word.end) {
                    if (earliestSnapTime === null || word.end < earliestSnapTime) {
                        earliestSnapTime = word.end;
                        snappedToWordBoundary = true;
                    }
                    break;
                }
            }
        }

        // Apply snap if we found one
        if (earliestSnapTime !== null) {
            splitPoint = earliestSnapTime;
        }
    }

    // Create first clip (before split) - exclude id to generate new one
    const firstClipDuration = splitPoint;
    const { id: _omit1, ...clipDataWithoutId } = clipToSplit;
    const firstClipId = createClip({
        ...clipDataWithoutId,
        duration: firstClipDuration,
        start: clipToSplit.start
    });

    // Create second clip (after split) - exclude id to generate new one
    const secondClipDuration = clipToSplit.duration - splitPoint;
    const secondClipStart = clipToSplit.start + splitPoint;
    const { id: _omit2, ...clipDataWithoutId2 } = clipToSplit;
    const secondClipId = createClip({
        ...clipDataWithoutId2,
        duration: secondClipDuration,
        start: secondClipStart,
        startOffset: (clipToSplit.startOffset || 0) + splitPoint // Preserve trimming
    });

    // If this was a video clip with attached audio, split that too
    if (clipToSplit.type === 'video') {
        const allClips = Array.from(state.project.clips.values());
        const attachedAudio = allClips.find(c =>
            c.type === 'attached-audio' && c.parentClipId === clipToSplit.id
        );

        if (attachedAudio) {
            // Split attached audio - exclude id to generate new ones
            const { id: _omit3, ...audioDataWithoutId } = attachedAudio;
            createClip({
                ...audioDataWithoutId,
                duration: firstClipDuration,
                start: clipToSplit.start,
                parentClipId: firstClipId
            });

            const { id: _omit4, ...audioDataWithoutId2 } = attachedAudio;
            createClip({
                ...audioDataWithoutId2,
                duration: secondClipDuration,
                start: secondClipStart,
                parentClipId: secondClipId,
                startOffset: (attachedAudio.startOffset || 0) + splitPoint
            });

            // Delete original attached audio
            deleteClip(attachedAudio.id);
        }
    }

    // Split associated transcripts
    if (clipTranscripts.length > 0) {
        clipTranscripts.forEach(transcript => {
            const splitResult = splitTranscript(transcript.id, splitPoint);

            if (splitResult) {
                // Update the two new transcripts to point to the correct new clips
                updateTranscript(splitResult.firstTranscriptId, { clipId: firstClipId });
                updateTranscript(splitResult.secondTranscriptId, { clipId: secondClipId });
            }
        });
    }

    // Delete original clip (transcripts already handled above)
    deleteClip(clipToSplit.id);

    // Select the second clip
    selectClipData(secondClipId);

    // Re-render all clips
    await renderAllClips();
    renderClipProperties();

    // Transfer search markers to new clips instead of clearing them
    if (state.search.matches && state.search.matches.length > 0) {
        // Update matches that belonged to the split clip
        state.search.matches.forEach(match => {
            if (match.clipId === clipToSplit.id) {
                // Determine which new clip this match belongs to based on word time
                if (match.wordTime < splitPoint) {
                    // Match is in first clip - update clipId only
                    match.clipId = firstClipId;
                } else {
                    // Match is in second clip - update clipId and adjust wordTime
                    match.clipId = secondClipId;
                    match.wordTime = match.wordTime - splitPoint;
                }
            }
        });

        // Re-render search markers on timeline with updated positions
        const { renderSearchMarkersOnTimeline } = await import('./transcript.js');
        await renderSearchMarkersOnTimeline();
    }

    // Add action indicators to both new clips AFTER rendering
    // First clip gets indicator on the right (where split occurred)
    // Second clip gets indicator on the left (where split occurred)
    // Both share the same historyIndex since they're from the same operation
    const finalSplitTime = clipToSplit.start + splitPoint;
    addTrackAction(clipToSplit.trackId, finalSplitTime, 'split', firstClipId, 'right', historyIndex);
    addTrackAction(clipToSplit.trackId, finalSplitTime, 'split', secondClipId, 'left', historyIndex);

    // Update viewport to fit new timeline bounds
    const { updateViewportRange, generateTimeMarkers, updatePlayheadPosition, updateInOutMarkers } = await import('./timeline.js');
    updateViewportRange();
    generateTimeMarkers();
    updatePlayheadPosition();
    updateInOutMarkers();

    // Show appropriate toast message
    if (snappedToWordBoundary) {
        showToast(`Split adjusted to word boundary at ${splitPoint.toFixed(2)}s`);
    } else {
        showToast('Clip split successfully');
    }
}

/**
 * Find clip at specific time position
 * @param {number} time - Time in seconds
 * @returns {Object|null} - Clip object or null
 */
function findClipAtTime(time) {
    const allClips = Array.from(state.project.clips.values());

    // First try to get the selected clip if it's at this time
    if (state.selection.selectedClip) {
        const selectedClip = state.project.clips.get(state.selection.selectedClip);
        if (selectedClip && selectedClip.type !== 'attached-audio') {
            const clipEnd = selectedClip.start + selectedClip.duration;
            if (time >= selectedClip.start && time < clipEnd) {
                return selectedClip;
            }
        }
    }

    // Otherwise find any clip at this time (prefer video clips over audio)
    const clipsAtTime = allClips.filter(clip => {
        const clipEnd = clip.start + clip.duration;
        return time >= clip.start && time < clipEnd && clip.type !== 'attached-audio';
    });

    // Prefer video clips if multiple clips at this time
    const videoClip = clipsAtTime.find(c => c.type === 'video');
    return videoClip || clipsAtTime[0] || null;
}

/**
 * Delete the currently selected clip
 */
export async function deleteSelectedClip() {
    const selectedClip = getSelectedClip();
    if (!selectedClip) {
        showToast('No clip selected', 'warning');
        return;
    }

    // Check if track is locked
    const trackState = state.tracks[selectedClip.trackId];
    if (trackState && trackState.locked) {
        showToast('Cannot delete clip on locked track', 'warning');
        return;
    }

    // Don't allow deleting attached-audio directly (delete parent video instead)
    if (selectedClip.type === 'attached-audio') {
        showToast('Delete the parent video clip to remove attached audio', 'warning');
        return;
    }

    // Push to history before making changes
    pushToHistory();

    // Delete from data
    const success = deleteClip(selectedClip.id);

    if (success) {
        // Re-render all clips
        await renderAllClips();

        // Clear properties panel
        renderClipProperties();

        // Reset timeline bounds and update viewport to fit new timeline
        const { resetTimelineBounds, updateViewportRange, generateTimeMarkers, updatePlayheadPosition, updateInOutMarkers, updateZoomLevel } = await import('./timeline.js');
        resetTimelineBounds();
        updateViewportRange();
        updateZoomLevel();
        generateTimeMarkers();
        updatePlayheadPosition();
        updateInOutMarkers();

        showToast('Clip deleted');
    } else {
        showToast('Failed to delete clip', 'error');
    }
}

/**
 * Toggle mute on selected clip
 */
export function toggleClipMute() {
    const selectedClip = getSelectedClip();
    if (!selectedClip) {
        showToast('No clip selected', 'warning');
        return;
    }

    // Toggle mute state
    const newMuteState = !selectedClip.isMuted;
    updateClip(selectedClip.id, { isMuted: newMuteState });

    // Re-render to show changes
    renderClip(selectedClip.id);

    showToast(newMuteState ? 'Clip muted' : 'Clip unmuted');
}

/**
 * Copy the currently selected clip to clipboard
 * Does NOT push to history (non-destructive operation)
 */
export function copyClip() {
    const selectedClip = getSelectedClip();
    if (!selectedClip) {
        showToast('No clip selected', 'warning');
        return;
    }

    // Don't allow copying attached-audio directly
    if (selectedClip.type === 'attached-audio') {
        showToast('Cannot copy attached audio directly', 'warning');
        return;
    }

    // Store a deep copy of the clip in clipboard
    state.clipboard.clip = { ...selectedClip };

    showToast('Clip copied');
}

/**
 * Paste the copied clip at the cursor position on timeline
 * DOES push to history (creates new clip)
 */
export async function pasteClip() {
    const copiedClip = state.clipboard.clip;
    if (!copiedClip) {
        showToast('No clip in clipboard', 'warning');
        return;
    }

    // Get paste position from cursor
    const pasteTime = state.cursor.timelineTime;
    let pasteTrackId = state.cursor.trackId;

    // Validate track - must be a regular track, not markers/transcripts
    if (!pasteTrackId || pasteTrackId.includes('marker') || pasteTrackId.includes('transcript')) {
        showToast('Cannot paste on this track - hover over a video or audio track', 'warning');
        return;
    }

    // Check if track is locked
    const trackState = state.tracks[pasteTrackId];
    if (trackState && trackState.locked) {
        showToast('Cannot paste on locked track', 'warning');
        return;
    }

    // Determine the appropriate track based on clip type and target track
    // If pasting a video clip on an audio track, or vice versa, use original track type logic
    let targetTrackId = pasteTrackId;
    let shouldCreateAttachedAudio = false;

    if (copiedClip.type === 'video') {
        // If cursor is on an audio track, use the corresponding video track
        if (pasteTrackId.endsWith('-audio')) {
            targetTrackId = pasteTrackId.replace('-audio', '');
        }
        shouldCreateAttachedAudio = true;
    } else if (copiedClip.type === 'audio') {
        // If cursor is on a video track and we're pasting audio, keep the audio track
        if (!pasteTrackId.endsWith('-audio') && pasteTrackId.startsWith('track-')) {
            // Audio clip on video track - paste to corresponding audio track if it exists
            const audioTrackId = pasteTrackId + '-audio';
            const audioTrackExists = document.querySelector(`[data-track-id="${audioTrackId}"]`);
            if (audioTrackExists) {
                targetTrackId = audioTrackId;
            }
        }
    }

    // Push to history before making changes
    pushToHistory();

    // Create new clip at cursor position with copied properties
    const newClipId = createClip({
        ...copiedClip,
        start: pasteTime,
        trackId: targetTrackId,
        // Don't copy the ID - createClip will generate a new one
        // Don't copy parentClipId if it exists
        parentClipId: undefined
    });

    // If the copied clip was a video clip, also paste the attached audio
    if (shouldCreateAttachedAudio) {
        const allClips = Array.from(state.project.clips.values());
        const attachedAudio = allClips.find(c =>
            c.type === 'attached-audio' && c.parentClipId === copiedClip.id
        );

        if (attachedAudio) {
            const audioTrackId = targetTrackId + '-audio';
            createClip({
                ...attachedAudio,
                start: pasteTime,
                parentClipId: newClipId,
                trackId: audioTrackId
            });
        }
    }

    // Copy associated transcripts to the new clip
    const copiedTranscripts = getClipTranscripts(copiedClip.id);
    copiedTranscripts.forEach(transcript => {
        createTranscript({
            ...transcript,
            clipId: newClipId,
            // Don't copy the ID - createTranscript will generate a new one
            id: undefined
        });
    });

    // Select the newly pasted clip
    selectClipData(newClipId);

    // Re-render all clips
    await renderAllClips();
    renderClipProperties();

    // Update viewport to fit new timeline bounds
    const { updateViewportRange, generateTimeMarkers, updatePlayheadPosition, updateInOutMarkers } = await import('./timeline.js');
    updateViewportRange();
    generateTimeMarkers();
    updatePlayheadPosition();
    updateInOutMarkers();

    showToast(`Clip pasted at ${pasteTime.toFixed(2)}s on ${targetTrackId}`);
}
