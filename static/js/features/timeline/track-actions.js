// ==================== Track Action Indicators ====================
// Visual indicators for where actions occurred on tracks

import { state } from '../../core/state.js';
import { updateAllTimelineElements } from './timeline.js';

// Store track actions in state
if (!state.trackActions) {
    state.trackActions = [];
}

/**
 * Add an action indicator to a track
 * @param {string} trackId - Track ID
 * @param {number} time - Time position where action occurred
 * @param {string} type - Action type: 'split', 'cut', 'move', etc.
 * @param {string} [clipId] - Optional clip ID if action is attached to a clip
 * @param {string} [position] - Position on clip: 'left', 'right', 'center'
 * @param {number} [historyIndex] - Index in undo stack when action was created
 * @param {number} [originalStart] - Original start position (for move actions)
 * @param {string} [originalTrack] - Original track ID (for move actions)
 */
export function addTrackAction(trackId, time, type, clipId = null, position = 'right', historyIndex = null, originalStart = null, originalTrack = null) {
    const action = {
        id: `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        trackId,
        time,
        type,
        clipId, // If set, action is attached to this clip
        position, // Where on the clip the action occurred
        historyIndex: historyIndex !== null ? historyIndex : state.history.undoStack.length, // Which history entry this belongs to
        timestamp: Date.now(),
        originalStart, // For move actions: original start position before first move
        originalTrack // For move actions: original track ID before first move
    };

    state.trackActions.push(action);

    // Render the action indicator
    renderTrackAction(action);
}

/**
 * Render a track action indicator
 * @param {Object} action - Action object
 */
function renderTrackAction(action) {
    // If action is attached to a clip, render it on the clip instead of track
    if (action.clipId) {
        const clipElement = document.querySelector(`[data-clip-id="${action.clipId}"]`);
        if (!clipElement) return;

        // Create indicator element
        const indicator = document.createElement('div');
        indicator.className = `clip-action-indicator clip-action-${action.position} track-action-${action.type}`;
        indicator.setAttribute('data-action-id', action.id);
        indicator.title = `${action.type} - Click to undo`;

        // Icon based on action type
        const iconMap = {
            'split': 'fa-cut',
            'move': 'fa-arrows-alt',
            'trim': 'fa-crop'
        };
        const iconClass = iconMap[action.type] || 'fa-edit';

        indicator.innerHTML = `<i class="fas ${iconClass}"></i>`;

        // Add click handler to undo this action
        indicator.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            console.log('[ACTION] Clicked clip action indicator:', action.id, 'Type:', action.type);
            await undoAction(action.id);
        });

        // Also add mousedown to prevent interact.js from catching it
        indicator.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });

        clipElement.appendChild(indicator);
    } else {
        // Render on track
        const track = document.querySelector(`[data-track-id="${action.trackId}"]`);
        if (!track) return;

        const trackContent = track.querySelector('.track-content');
        if (!trackContent) return;

        // Create indicator element
        const indicator = document.createElement('div');
        indicator.className = `track-action-indicator track-action-${action.type}`;
        indicator.setAttribute('data-action-id', action.id);
        indicator.setAttribute('data-time', action.time);
        indicator.title = `${action.type} at ${action.time.toFixed(2)}s - Click to undo`;

        // Icon based on action type
        const iconMap = {
            'split': 'fa-cut',
            'move': 'fa-arrows-alt',
            'trim': 'fa-crop'
        };
        const iconClass = iconMap[action.type] || 'fa-edit';

        indicator.innerHTML = `<i class="fas ${iconClass}"></i>`;

        // Add click handler to undo this action
        indicator.addEventListener('click', async (e) => {
            e.stopPropagation();
            e.preventDefault();
            console.log('[ACTION] Clicked track action indicator:', action.id, 'Type:', action.type);
            await undoAction(action.id);
        });

        trackContent.appendChild(indicator);

        // Position using timeline system
        updateAllTimelineElements();
    }
}

/**
 * Undo a specific action by clicking its indicator
 * @param {string} actionId - Action ID to undo
 */
async function undoAction(actionId) {
    console.log('[ACTION] Undoing action:', actionId);

    // Find the action
    const action = state.trackActions.find(a => a.id === actionId);
    if (!action) {
        console.log('[ACTION] Action not found');
        return;
    }

    console.log('[ACTION] Action details:', action);

    // For movement actions, move clip back instead of undoing history
    if (action.type === 'move' && action.clipId) {
        await undoMoveAction(action);
        return;
    }

    // For split actions, undo the specific split
    if (action.type === 'split') {
        await undoSplitAction(action);
        return;
    }

    // For other actions, perform regular undo
    const { undo } = await import('../../operations/history-manager.js');

    // Check if there's anything to undo
    if (state.history.undoStack.length === 0) {
        console.log('[ACTION] Nothing to undo');
        return;
    }

    // Perform ONE undo (sequential undo)
    console.log('[ACTION] Performing single undo');
    await undo();

    console.log('[ACTION] Undo complete');
}

/**
 * Undo a split action by fusing the two clips back together
 * @param {Object} action - The split action
 */
async function undoSplitAction(action) {
    const { getClip, deleteClip, createClip, getClipTranscripts, updateTranscript, createTranscript } = await import('../../operations/operations.js');
    const { pushToHistory } = await import('../../operations/history-manager.js');
    const { renderAllClips } = await import('../../rendering/rendering.js');
    const { showToast } = await import('../../ui/ui-utils.js');

    console.log('[ACTION] Fusing split clips, historyIndex:', action.historyIndex);

    // Find the paired split action (same historyIndex)
    const pairedActions = state.trackActions.filter(
        a => a.type === 'split' && a.historyIndex === action.historyIndex
    );

    if (pairedActions.length !== 2) {
        console.error('[ACTION] Expected 2 paired split actions, found:', pairedActions.length);
        showToast('Cannot fuse clips - invalid split state', 'error');
        return;
    }

    console.log('[ACTION] Found paired split actions:', pairedActions);

    // Get both clip IDs (one from each paired action)
    const clipId1 = pairedActions[0].clipId;
    const clipId2 = pairedActions[1].clipId;

    const clip1 = getClip(clipId1);
    const clip2 = getClip(clipId2);

    if (!clip1 || !clip2) {
        console.error('[ACTION] Could not find both clips');
        showToast('Cannot fuse clips - clips not found', 'error');
        return;
    }

    // Determine which clip comes first
    const firstClip = clip1.start < clip2.start ? clip1 : clip2;
    const secondClip = clip1.start < clip2.start ? clip2 : clip1;

    console.log('[ACTION] Fusing clips:', firstClip.id, 'and', secondClip.id);

    // Push to history before making changes
    pushToHistory();

    // Create fused clip
    const fusedDuration = firstClip.duration + secondClip.duration;
    const { id: _omit, ...clipDataWithoutId } = firstClip;
    const fusedClipId = createClip({
        ...clipDataWithoutId,
        start: firstClip.start,
        duration: fusedDuration
    });

    // Handle video clips with attached audio
    if (firstClip.type === 'video') {
        const allClips = Array.from(state.project.clips.values());
        const attachedAudio1 = allClips.find(c =>
            c.type === 'attached-audio' && c.parentClipId === firstClip.id
        );
        const attachedAudio2 = allClips.find(c =>
            c.type === 'attached-audio' && c.parentClipId === secondClip.id
        );

        if (attachedAudio1 && attachedAudio2) {
            const { id: _omit2, ...audioDataWithoutId } = attachedAudio1;
            createClip({
                ...audioDataWithoutId,
                start: firstClip.start,
                duration: fusedDuration,
                parentClipId: fusedClipId
            });
        }
    }

    // Merge transcripts
    const transcripts1 = getClipTranscripts(firstClip.id);
    const transcripts2 = getClipTranscripts(secondClip.id);

    // Copy transcripts from first clip
    transcripts1.forEach(transcript => {
        const { id: _omit3, ...transcriptData } = transcript;
        createTranscript({
            ...transcriptData,
            clipId: fusedClipId
        });
    });

    // Copy transcripts from second clip (adjust their start times)
    transcripts2.forEach(transcript => {
        const { id: _omit4, ...transcriptData } = transcript;
        const adjustedWords = transcript.words?.map(word => ({
            ...word,
            start: word.start + firstClip.duration,
            end: word.end + firstClip.duration
        }));

        createTranscript({
            ...transcriptData,
            clipId: fusedClipId,
            start: transcript.start + firstClip.duration,
            words: adjustedWords
        });
    });

    // Delete the two split clips (and their attached audio and transcripts)
    deleteClip(firstClip.id);
    deleteClip(secondClip.id);

    // Re-render
    await renderAllClips();

    // Merge search markers from both split clips to the fused clip
    if (state.search.matches && state.search.matches.length > 0) {
        state.search.matches.forEach(match => {
            if (match.clipId === firstClip.id) {
                // Marker from first clip - update to fused clip (wordTime stays same)
                match.clipId = fusedClipId;
            } else if (match.clipId === secondClip.id) {
                // Marker from second clip - update to fused clip and adjust wordTime
                match.clipId = fusedClipId;
                match.wordTime = match.wordTime + firstClip.duration;
            }
        });

        // Re-render search markers on timeline with updated positions
        const { renderSearchMarkersOnTimeline } = await import('../transcripts/transcript.js');
        await renderSearchMarkersOnTimeline();
    }

    // Remove split action indicators
    pairedActions.forEach(pairedAction => {
        const actionIndex = state.trackActions.findIndex(a => a.id === pairedAction.id);
        if (actionIndex !== -1) {
            state.trackActions.splice(actionIndex, 1);
        }

        const indicator = document.querySelector(`[data-action-id="${pairedAction.id}"]`);
        if (indicator) {
            indicator.remove();
        }
    });

    showToast('Clips fused back together');
    console.log('[ACTION] Fuse complete');

    // Update viewport to fit new timeline bounds
    const { updateViewportRange, generateTimeMarkers, updatePlayheadPosition, updateInOutMarkers, updateAllTimelineElements } = await import('./timeline.js');
    updateViewportRange();
    generateTimeMarkers();
    updatePlayheadPosition();
    updateInOutMarkers();
    updateAllTimelineElements();

    // Re-compile transcript
    const { renderCompiledTranscript } = await import('../transcripts/transcript.js');
    renderCompiledTranscript();
}

/**
 * Undo a move action by moving clip back to previous position
 * @param {Object} action - The move action
 */
async function undoMoveAction(action) {
    const { getClip, updateClip } = await import('../../operations/operations.js');
    const { pushToHistory } = await import('../../operations/history-manager.js');
    const { renderAllClips } = await import('../../rendering/rendering.js');
    const { showToast } = await import('../../ui/ui-utils.js');

    const clip = getClip(action.clipId);
    if (!clip) {
        console.log('[ACTION] Clip not found');
        return;
    }

    // Initialize movement history if not exists
    if (!clip.movementHistory) {
        clip.movementHistory = [];
    }

    // Get the clip element
    const clipElement = document.querySelector(`[data-clip-id="${action.clipId}"]`);

    // If no movement history, this is the first time - save current position and original position
    if (clip.movementHistory.length === 0) {
        // Push current position to history
        clip.movementHistory.push({
            start: clip.start,
            trackId: clip.trackId
        });

        // Also save the original position if we have it
        if (action.originalStart !== null && action.originalTrack !== null) {
            // The original position should be at the beginning
            clip.movementHistory.unshift({
                start: action.originalStart,
                trackId: action.originalTrack
            });
        }
    }

    // Check if we're already at the original position
    const isAtOriginal =
        action.originalStart !== null &&
        action.originalTrack !== null &&
        Math.abs(clip.start - action.originalStart) < 0.01 &&
        clip.trackId === action.originalTrack;

    if (isAtOriginal) {
        showToast('Clip is already at original position');
        return;
    }

    // Find the previous position in history
    let targetPosition = null;

    // Find current position in history
    const currentIndex = clip.movementHistory.findIndex(
        pos => Math.abs(pos.start - clip.start) < 0.01 && pos.trackId === clip.trackId
    );

    if (currentIndex > 0) {
        // Move to previous position in history
        targetPosition = clip.movementHistory[currentIndex - 1];
    } else if (action.originalStart !== null && action.originalTrack !== null) {
        // Fall back to original position
        targetPosition = {
            start: action.originalStart,
            trackId: action.originalTrack
        };
    }

    if (!targetPosition) {
        showToast('No previous position found');
        return;
    }

    // Save current state for undo
    pushToHistory();

    // Move clip to target position
    updateClip(action.clipId, {
        start: targetPosition.start,
        trackId: targetPosition.trackId
    });

    // Update attached audio if this is a video clip
    if (clip.type === 'video') {
        const attachedAudio = Array.from(state.project.clips.values())
            .find(c => c.type === 'attached-audio' && c.parentClipId === action.clipId);

        if (attachedAudio) {
            const newAudioTrackId = targetPosition.trackId + '-audio';
            updateClip(attachedAudio.id, {
                start: targetPosition.start,
                trackId: newAudioTrackId
            });
        }
    }

    // Re-render
    await renderAllClips();

    // Check if we're back at original position
    const nowAtOriginal =
        Math.abs(targetPosition.start - action.originalStart) < 0.01 &&
        targetPosition.trackId === action.originalTrack;

    if (nowAtOriginal) {
        // Remove action from state
        const actionIndex = state.trackActions.findIndex(a => a.id === action.id);
        if (actionIndex !== -1) {
            state.trackActions.splice(actionIndex, 1);
        }

        // Remove indicator
        const indicator = document.querySelector(`[data-action-id="${action.id}"]`);
        if (indicator) {
            indicator.remove();
        }

        // Clear movement history
        clip.movementHistory = [];

        // Remove attributes from element
        if (clipElement) {
            clipElement.removeAttribute('data-original-start');
            clipElement.removeAttribute('data-original-track');
        }

        showToast('Clip moved back to original position');
    } else {
        showToast('Clip moved to previous position');
    }

    // Update viewport to fit new timeline bounds
    const { updateViewportRange, generateTimeMarkers, updatePlayheadPosition, updateInOutMarkers, updateAllTimelineElements } = await import('./timeline.js');
    updateViewportRange();
    generateTimeMarkers();
    updatePlayheadPosition();
    updateInOutMarkers();
    updateAllTimelineElements();

    // Re-compile transcript
    const { renderCompiledTranscript } = await import('../transcripts/transcript.js');
    renderCompiledTranscript();
}

/**
 * Render all track action indicators
 */
export function renderAllTrackActions() {
    // Clear existing indicators
    document.querySelectorAll('.track-action-indicator').forEach(el => el.remove());

    // Render each action
    if (state.trackActions) {
        state.trackActions.forEach(action => {
            renderTrackAction(action);
        });
    }

    // Position using timeline system
    updateAllTimelineElements();
}

/**
 * Clear all track actions (for new project or undo/redo)
 */
export function clearTrackActions() {
    state.trackActions = [];
    document.querySelectorAll('.track-action-indicator').forEach(el => el.remove());
}
