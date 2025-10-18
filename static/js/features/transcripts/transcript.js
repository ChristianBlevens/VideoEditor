/**
 * Transcript Management
 *
 * Main module that coordinates all transcript functionality
 * Re-exports from specialized modules for backward compatibility
 */

// Re-export core functions
export {
    initializeTranscript,
    updateTranscriptForSelectedClip,
    compileTranscriptsFromAllClips,
    renderCompiledTranscript,
    handleWhisperModelChange,
    transcribeSelectedClip,
    exportTranscript
} from './transcript-core.js';

// Re-export search functions
export {
    performTranscriptSearch,
    navigateMatch,
    clearSearchMarkers,
    renderSearchMarkersOnTimeline
} from './transcript-search.js';

// Local imports for remaining functionality
import { state } from '../../core/state.js';
import { elements } from '../../rendering/dom-cache.js';
import { showToast, autoGrowTextarea } from '../../ui/ui-utils.js';
import { createEdit, getSelectedClip } from '../../operations/operations.js';
import { renderClip } from '../../rendering/rendering.js';
import { fileUploader } from '../project/file-uploader.js';

// ==================== Target Words Management ====================
export function addFillerWordsToTargets() {
    const fillerWords = 'um, uh, like, you know, basically, actually';
    addToTargets(fillerWords);
    showToast('Filler words added to targets');
}

export function addProfanityToTargets() {
    showToast('Scanning for profanity...');
    setTimeout(() => {
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

    if (targets.length > 0) {
        console.log('Timeline highlights updated for targets:', targets);
    }
}

export function parseTargets() {
    const text = elements.targetWords.value.trim();
    if (!text) return [];

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

    createEdit(
        selectedClip.id,
        'isolate',
        'Isolated targets',
        { targets: targets }
    );

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

    createEdit(
        selectedClip.id,
        'delete',
        'Removed targets',
        { targets: targets }
    );

    renderClip(selectedClip.id);
    showToast(`Removing ${targets.length} target(s) (non-destructive)`);
}

export function addEditIndicator(type, description) {
    const selectedClip = getSelectedClip();
    if (!selectedClip) {
        console.warn('Cannot add edit indicator: no clip selected');
        return;
    }

    createEdit(selectedClip.id, type, description);
    renderClip(selectedClip.id);
}

export function undoEdit(indicator, description) {
    showToast(`Undo not yet implemented: ${description}`, 'warning');
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

    // Check if this is a media item from project media
    const mediaFilename = e.dataTransfer.getData('media-filename');

    if (mediaFilename) {
        const mediaPath = e.dataTransfer.getData('media-path');
        const mediaType = e.dataTransfer.getData('media-type');

        const trackContent = e.target.closest('.track-content');
        if (!trackContent) return;

        const trackElement = trackContent.closest('[data-track-id]');
        if (!trackElement) return;
        const trackId = trackElement.getAttribute('data-track-id');

        // Calculate drop timeline position
        const rect = trackContent.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const trackWidth = rect.width;
        const viewportDuration = state.timeline.viewportEnd - state.timeline.viewportStart;
        const dropTime = state.timeline.viewportStart + (mouseX / trackWidth) * viewportDuration;

        // Check if this is the first clip on the timeline
        const hasExistingClips = state.project.clips.size > 0;

        // Apply snap to grid if enabled (but not for first clip)
        let startTime = dropTime;
        if (!hasExistingClips) {
            // First clip always starts at 0 to define timeline start
            startTime = 0;
        } else if (state.timeline.snapToGrid) {
            const gridSize = 1.0;
            startTime = Math.round(startTime / gridSize) * gridSize;
        }

        // Ensure no negative values
        startTime = Math.max(0, startTime);

        // Import handler from project-media.js
        const { handleMediaDropOnTimeline } = await import('../project/project-media.js');
        await handleMediaDropOnTimeline(mediaFilename, mediaPath, mediaType, trackId, startTime);
        return;
    }

    // Legacy drag-drop handler
    const dataText = e.dataTransfer.getData('text/plain');
    if (!dataText) return;

    const data = JSON.parse(dataText);
    const trackContent = e.target.closest('.track-content');
    const acceptType = trackContent.getAttribute('data-accept');

    if (acceptType && acceptType !== data.type) {
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

    // Check if this is the first clip on the timeline
    const hasExistingClips = state.project.clips.size > 0;

    // Apply snap to grid if enabled (but not for first clip)
    let startTime = dropTime;
    if (!hasExistingClips) {
        // First clip always starts at 0 to define timeline start
        startTime = 0;
    } else if (state.timeline.snapToGrid) {
        const gridSize = 1.0;
        startTime = Math.round(startTime / gridSize) * gridSize;
    }

    // Ensure no negative values
    startTime = Math.max(0, startTime);

    // Create new clip
    const { createClip } = await import('../../operations/operations.js');
    const { renderAllClips } = await import('../../rendering/rendering.js');
    const { pushToHistory } = await import('../../operations/history-manager.js');

    pushToHistory();

    const clipId = createClip({
        type: data.type,
        start: startTime,
        duration: 10,
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
    fileUploader.selectFiles();
}
