/**
 * Clip Resizing System
 *
 * Handles clip resizing with source duration constraints and auto-panning
 */

import { state } from '../core/state.js';
import { updateClip, getClip } from '../operations/operations.js';
import { panTimeline, updateAllTimelineElements, resetTimelineBounds, updateViewportRange, generateTimeMarkers, updatePlayheadPosition, updateInOutMarkers } from '../features/timeline/timeline.js';
import { normalizeTimelinePositions } from './position-normalizer.js';

/**
 * Resize clip move - cursor position determines edge time with viewport panning
 */
export async function resizeClipMove(event) {
    const target = event.target;
    const clipId = target.getAttribute('data-clip-id');
    const clip = getClip(clipId);
    const trackContent = target.parentElement;
    const trackRect = trackContent.getBoundingClientRect();
    const trackWidth = trackContent.offsetWidth;

    const viewportDuration = state.timeline.viewportEnd - state.timeline.viewportStart;

    // Get max duration from source file (if available)
    const maxDuration = clip?.sourceDuration || Infinity;

    if (event.edges.left) {
        // Resizing left edge - cursor position determines new start time
        const mouseX = event.clientX - trackRect.left;
        const cursorTime = state.timeline.viewportStart + (mouseX / trackWidth) * viewportDuration;

        // Update start time, keep end time same (duration changes)
        const currentEnd = parseFloat(target.getAttribute('data-start')) + parseFloat(target.getAttribute('data-duration'));
        const newDuration = currentEnd - cursorTime;

        // Enforce max duration constraint
        if (newDuration > maxDuration) {
            // Clamp to max duration
            const clampedStart = currentEnd - maxDuration;
            target.setAttribute('data-start', clampedStart);
            target.setAttribute('data-duration', maxDuration);
        } else {
            target.setAttribute('data-start', cursorTime);
            target.setAttribute('data-duration', newDuration);
        }

        // Check if left edge near viewport left edge - allow panning into negative times
        const edgeThreshold = viewportDuration * 0.1;
        const panSpeed = viewportDuration * 0.005; // Half speed for control

        if (cursorTime < state.timeline.viewportStart + edgeThreshold) {
            panTimeline(-panSpeed);
        }
    } else if (event.edges.right) {
        // Resizing right edge - cursor position determines new end time
        const mouseX = event.clientX - trackRect.left;
        const cursorTime = state.timeline.viewportStart + (mouseX / trackWidth) * viewportDuration;

        // Update duration, keep start time same
        const currentStart = parseFloat(target.getAttribute('data-start'));
        let newDuration = cursorTime - currentStart;

        // Enforce max duration constraint
        if (newDuration > maxDuration) {
            newDuration = maxDuration;
        }

        target.setAttribute('data-duration', newDuration);

        // Check if right edge near viewport right edge
        const edgeThreshold = viewportDuration * 0.1;
        const panSpeed = viewportDuration * 0.005; // Half speed for control

        if (cursorTime > state.timeline.viewportEnd - edgeThreshold) {
            panTimeline(panSpeed);
        }
    }

    // Update attached audio
    if (clipId) {
        const attachedAudio = document.querySelector(`.attached-audio-clip[data-parent-clip="${clipId}"]`);
        if (attachedAudio) {
            attachedAudio.setAttribute('data-start', target.getAttribute('data-start'));
            attachedAudio.setAttribute('data-duration', target.getAttribute('data-duration'));
        }
    }

    // Update all elements in real-time
    updateAllTimelineElements();
    updatePlayheadPosition();
    updateInOutMarkers();
}

/**
 * Resize clip end - sync final size to state
 */
export async function resizeClipEnd(event) {
    const target = event.target;
    const clipId = target.getAttribute('data-clip-id');

    // Normalize timeline positions
    normalizeTimelinePositions();

    // Reset bounds to actual positions
    resetTimelineBounds();

    // Record to history
    const { pushToHistory } = await import('../operations/history-manager.js');
    pushToHistory();

    // Sync final dimensions to state
    if (clipId) {
        const finalStart = parseFloat(target.getAttribute('data-start'));
        const finalDuration = parseFloat(target.getAttribute('data-duration'));

        updateClip(clipId, {
            start: finalStart,
            duration: finalDuration
        });

        // Also update attached audio
        const attachedAudio = document.querySelector(`.attached-audio-clip[data-parent-clip="${clipId}"]`);
        if (attachedAudio) {
            const audioClipId = attachedAudio.getAttribute('data-clip-id');
            if (audioClipId) {
                updateClip(audioClipId, {
                    start: finalStart,
                    duration: finalDuration
                });
            }
        }
    }

    // Update all elements
    updateAllTimelineElements();

    // Re-enforce viewport bounds
    updateViewportRange();
    generateTimeMarkers();
    updatePlayheadPosition();
    updateInOutMarkers();

    // Re-compile transcript panel
    const { renderCompiledTranscript, renderSearchMarkersOnTimeline } = await import('../features/transcripts/transcript.js');
    renderCompiledTranscript();
    await renderSearchMarkersOnTimeline();
}
