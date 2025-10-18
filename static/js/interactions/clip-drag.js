/**
 * Clip Dragging System
 *
 * Handles clip dragging with cross-track support and auto-panning
 */

import { state } from '../core/state.js';
import { updateClip, getClip } from '../operations/operations.js';
import { updateAllTimelineElements, resetTimelineBounds, updateViewportRange, generateTimeMarkers, updatePlayheadPosition, updateInOutMarkers } from '../features/timeline/timeline.js';
import { startAutoPan, stopAutoPan, updateAutoPan } from './auto-pan.js';
import { normalizeTimelinePositions } from './position-normalizer.js';

/**
 * Drag clip start - initialize drag state for cross-track dragging
 */
export function dragClipStart(event) {
    const target = event.target;

    // Mark as being dragged to prevent position updates during drag
    target.setAttribute('data-dragging', 'true');

    // Store original parent for reference
    const trackContent = target.parentElement;
    target.setAttribute('data-original-parent', trackContent.parentElement.getAttribute('data-track-id'));

    // Break stacking context by setting overflow:visible on ALL track-content elements
    document.querySelectorAll('.track-content').forEach(tc => {
        tc.setAttribute('data-original-overflow', tc.style.overflow || '');
        tc.style.overflow = 'visible';
    });

    // Increase z-index to show above ALL tracks
    target.style.zIndex = '1000';
    target.style.pointerEvents = 'none'; // Prevent interfering with track detection
    target.style.position = 'relative'; // Ensure transform works correctly
}

/**
 * Drag clip move - enable cross-track dragging with cursor following
 */
export async function dragClipMove(event) {
    const target = event.target;

    // STEP 1: Apply CSS transform to move clip with cursor (enables cross-track dragging)
    const x = (parseFloat(target.getAttribute('data-drag-x')) || 0) + event.dx;
    const y = (parseFloat(target.getAttribute('data-drag-y')) || 0) + event.dy;

    target.style.transform = `translate(${x}px, ${y}px)`;
    target.setAttribute('data-drag-x', x);
    target.setAttribute('data-drag-y', y);

    // STEP 2: Calculate timeline position from cursor X position
    const trackContent = target.parentElement;
    const trackWidth = trackContent.offsetWidth;
    const trackRect = trackContent.getBoundingClientRect();

    // Calculate grab offset as percentage (where in the clip did we grab it?)
    if (!target.hasAttribute('data-drag-offset-pct')) {
        const clipRect = target.getBoundingClientRect();
        const grabX = event.clientX - clipRect.left;
        const clipWidth = clipRect.width;
        const grabOffsetPct = grabX / clipWidth;
        target.setAttribute('data-drag-offset-pct', grabOffsetPct);
    }

    const grabOffsetPct = parseFloat(target.getAttribute('data-drag-offset-pct')) || 0;
    const duration = parseFloat(target.getAttribute('data-duration')) || 0;
    const grabOffsetTime = grabOffsetPct * duration;

    // Calculate timeline position from cursor
    const mouseX = event.clientX - trackRect.left;
    const viewportDuration = state.timeline.viewportEnd - state.timeline.viewportStart;
    const cursorDisplayTime = state.timeline.viewportStart + (mouseX / trackWidth) * viewportDuration;

    let clipStartTime = cursorDisplayTime - grabOffsetTime;

    // Apply snap to grid if enabled
    if (state.timeline.snapToGrid) {
        const gridSize = 1.0;
        clipStartTime = Math.round(clipStartTime / gridSize) * gridSize;
    }

    // Update clip's timeline position data
    target.setAttribute('data-start', clipStartTime);

    // STEP 3: Check if cursor near viewport edges AND clip extends beyond viewport
    const clipDisplayEnd = clipStartTime + duration;
    const cursorX = event.clientX - trackRect.left; // Pixel position in track
    const cursorPositionInViewport = cursorX / trackWidth; // 0-1 position in viewport

    // 30% edge zones for panning, 40% dead zone in middle
    const leftEdgeZone = 0.30;
    const rightEdgeZone = 0.70; // 1 - 0.30

    let panDirection = 0;
    let panSpeed = 0;
    const baseSpeed = viewportDuration * 0.004;

    // Pan left: cursor in left 30% AND clip start extends beyond left viewport edge
    if (cursorPositionInViewport < leftEdgeZone && clipStartTime < state.timeline.viewportStart) {
        const distanceFromEdge = cursorPositionInViewport / leftEdgeZone; // 0 at edge, 1 at boundary
        panDirection = -1;
        panSpeed = baseSpeed * (1 - distanceFromEdge);
    }
    // Pan right: cursor in right 30% AND clip end extends beyond right viewport edge
    else if (cursorPositionInViewport > rightEdgeZone && clipDisplayEnd > state.timeline.viewportEnd) {
        const distanceFromEdge = (1 - cursorPositionInViewport) / (1 - rightEdgeZone); // 0 at edge, 1 at boundary
        panDirection = 1;
        panSpeed = baseSpeed * (1 - distanceFromEdge);
    }

    updateAutoPan(panDirection, panSpeed);
}

/**
 * Drag clip end - sync final position to state and detect final track
 */
export async function dragClipEnd(event) {
    const target = event.target;
    const clipId = target.getAttribute('data-clip-id');

    // Stop auto-pan
    stopAutoPan();

    // Detect which track the clip is over BEFORE resetting transform
    const clipRect = target.getBoundingClientRect();
    const clipCenterY = clipRect.top + clipRect.height / 2;

    // Find all tracks to detect target track
    const tracks = document.querySelectorAll('.track[data-track-id]');
    let newTrackId = null;

    for (const track of tracks) {
        const trackRect = track.getBoundingClientRect();
        if (clipCenterY >= trackRect.top && clipCenterY <= trackRect.bottom) {
            newTrackId = track.getAttribute('data-track-id');
            break;
        }
    }

    // Get current clip data
    const clip = getClip(clipId);

    // CRITICAL: Move DOM element to new track BEFORE resetting transform
    // This prevents the flash of the clip appearing in wrong track
    const trackChanged = newTrackId && clip && newTrackId !== clip.trackId;
    if (trackChanged) {
        const newTrack = document.querySelector(`.track[data-track-id="${newTrackId}"]`);
        const newTrackContent = newTrack?.querySelector('.track-content');

        if (newTrackContent) {
            // Move the clip DOM element to new track while transform is still active
            newTrackContent.appendChild(target);

            // Move attached audio if this is a video clip
            if (clip.type === 'video') {
                const attachedAudio = document.querySelector(`.attached-audio-clip[data-parent-clip="${clipId}"]`);
                if (attachedAudio) {
                    const newAudioTrackId = newTrackId + '-audio';
                    const newAudioTrack = document.querySelector(`.track[data-track-id="${newAudioTrackId}"]`);
                    const newAudioTrackContent = newAudioTrack?.querySelector('.track-content');
                    if (newAudioTrackContent) {
                        newAudioTrackContent.appendChild(attachedAudio);
                    }
                }
            }
        }
    }

    // Normalize timeline positions BEFORE calculating CSS position
    normalizeTimelinePositions();

    // Calculate new CSS position BEFORE removing transform to prevent flash
    const finalStart = parseFloat(target.getAttribute('data-start'));
    const finalDuration = parseFloat(target.getAttribute('data-duration'));
    const viewportDuration = state.timeline.viewportEnd - state.timeline.viewportStart;
    const leftPercent = ((finalStart - state.timeline.viewportStart) / viewportDuration) * 100;
    const widthPercent = (finalDuration / viewportDuration) * 100;

    // Apply new CSS position while transform is still active
    target.style.left = `${leftPercent}%`;
    target.style.width = `${widthPercent}%`;

    // Also update attached audio position if this is a video clip
    const attachedAudio = document.querySelector(`.attached-audio-clip[data-parent-clip="${clipId}"]`);
    if (attachedAudio) {
        attachedAudio.style.left = `${leftPercent}%`;
        attachedAudio.style.width = `${widthPercent}%`;
    }

    // Restore stacking context by restoring overflow on ALL track-content elements
    document.querySelectorAll('.track-content').forEach(tc => {
        const originalOverflow = tc.getAttribute('data-original-overflow');
        if (originalOverflow !== null) {
            tc.style.overflow = originalOverflow || '';
            tc.removeAttribute('data-original-overflow');
        }
    });

    // Reset visual state
    target.style.transform = '';
    target.style.zIndex = '';
    target.style.pointerEvents = '';
    target.style.position = '';
    target.removeAttribute('data-drag-x');
    target.removeAttribute('data-drag-y');
    target.removeAttribute('data-drag-offset-pct');
    target.removeAttribute('data-dragging');
    target.removeAttribute('data-original-parent');

    // Reset bounds to actual positions
    resetTimelineBounds();

    // After normalization, sync final position to state
    if (clipId && clip) {
        const finalStart = parseFloat(target.getAttribute('data-start'));
        const finalDuration = parseFloat(target.getAttribute('data-duration'));

        const updates = {
            start: finalStart,
            duration: finalDuration
        };

        // Check if track changed and is valid
        const trackChanged = newTrackId && newTrackId !== clip.trackId;
        if (trackChanged) {
            const isValidMove =
                newTrackId.startsWith('track-') &&
                !newTrackId.includes('transcript') &&
                !newTrackId.includes('marker');

            if (isValidMove) {
                updates.trackId = newTrackId;

                // Update attached audio if this is a video clip
                if (clip.type === 'video') {
                    const attachedAudio = document.querySelector(`.attached-audio-clip[data-parent-clip="${clipId}"]`);
                    if (attachedAudio) {
                        const audioClipId = attachedAudio.getAttribute('data-clip-id');
                        if (audioClipId) {
                            const newAudioTrackId = newTrackId + '-audio';
                            updateClip(audioClipId, {
                                start: finalStart,
                                duration: finalDuration,
                                trackId: newAudioTrackId
                            });
                        }
                    }
                }
            }
        }

        // Record to history
        const { pushToHistory } = await import('../operations/history-manager.js');
        pushToHistory();

        // Store original position for this clip if this is the first move
        if (!target.hasAttribute('data-original-start') && !target.hasAttribute('data-original-track')) {
            target.setAttribute('data-original-start', clip.start);
            target.setAttribute('data-original-track', clip.trackId);
        }

        // Track movement history
        if (!clip.movementHistory) {
            clip.movementHistory = [];
        }

        // Add current position to movement history
        const positionChanged = trackChanged || Math.abs(clip.start - finalStart) > 0.01;
        if (positionChanged) {
            const alreadyInHistory = clip.movementHistory.some(
                pos => Math.abs(pos.start - finalStart) < 0.01 && pos.trackId === (trackChanged ? newTrackId : clip.trackId)
            );

            if (!alreadyInHistory) {
                clip.movementHistory.push({
                    start: finalStart,
                    trackId: trackChanged ? newTrackId : clip.trackId
                });
            }
        }

        updateClip(clipId, updates);

        // Add action indicator if this is the first move
        const existingMoveAction = state.trackActions?.find(a => a.clipId === clipId && a.type === 'move');
        if (!existingMoveAction && positionChanged) {
            const { addTrackAction } = await import('../features/timeline/track-actions.js');
            const originalStart = parseFloat(target.getAttribute('data-original-start'));
            const originalTrack = target.getAttribute('data-original-track');
            const trackId = trackChanged ? newTrackId : clip.trackId;
            addTrackAction(trackId, finalStart, 'move', clipId, 'center', null, originalStart, originalTrack);
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
