// ==================== Interact.js Integration (Adaptive Timeline) ====================
import { selectClip } from './clip-operations.js';
import { state } from './state.js';
import { elements } from './dom-cache.js';
import { panTimeline, updateAllTimelineElements, calculateTimelineBounds, updatePlayheadPosition, updateInOutMarkers, resetTimelineBounds } from './timeline.js';
import { updateClip, updateMarker, updateTranscript, getAllClips, getAllMarkers, getAllTranscripts, getClip } from './operations.js';
import { startClipRename } from './rendering.js';

// Auto-pan state
let autoPanState = {
    active: false,
    direction: 0, // -1 = left, 1 = right, 0 = none
    speed: 0,
    animationFrame: null
};

/**
 * Smooth auto-pan loop using requestAnimationFrame
 */
function startAutoPan() {
    if (autoPanState.active) return; // Already running

    autoPanState.active = true;

    function autoPanLoop() {
        if (!autoPanState.active) {
            autoPanState.animationFrame = null;
            return;
        }

        if (autoPanState.direction !== 0) {
            const panAmount = autoPanState.speed * autoPanState.direction;
            panTimeline(panAmount);

            // Update all elements in real-time (bounds-aware)
            updateAllTimelineElements();
            updatePlayheadPosition();
            updateInOutMarkers();
        }

        autoPanState.animationFrame = requestAnimationFrame(autoPanLoop);
    }

    autoPanLoop();
}

/**
 * Stop auto-pan
 */
function stopAutoPan() {
    autoPanState.active = false;
    autoPanState.direction = 0;
    autoPanState.speed = 0;

    if (autoPanState.animationFrame) {
        cancelAnimationFrame(autoPanState.animationFrame);
        autoPanState.animationFrame = null;
    }
}

export function initializeInteract() {
    // Draggable and resizable clips (excluding attached audio clips)
    interact('.clip:not(.attached-audio-clip)').draggable({
        listeners: {
            start: dragClipStart,
            move: dragClipMove,
            end: dragClipEnd
        },
        // Allow free dragging in any direction
        modifiers: [],
        inertia: false
    }).resizable({
        edges: { left: '.clip-handle-left', right: '.clip-handle-right' },
        listeners: {
            move: resizeClipMove,
            end: resizeClipEnd
        },
        modifiers: [
            interact.modifiers.restrictSize({
                min: { width: 50 }
            })
        ]
    }).on('tap', (event) => {
        // Don't select clip if clicking on an action indicator
        if (event.target.closest('.clip-action-indicator')) {
            console.log('[INTERACT] Ignoring tap on action indicator');
            return;
        }

        // Don't select clip if clicking on the clip name (for rename functionality)
        if (event.target.classList.contains('clip-name')) {
            console.log('[INTERACT] Ignoring tap on clip name');
            return;
        }

        // Find the clip element (event.target might be a child element)
        const clipElement = event.target.closest('.clip');
        if (clipElement) {
            selectClip(clipElement);
        }
    }).on('doubletap', (event) => {
        // Check if double-tapping on clip name
        if (event.target.classList.contains('clip-name')) {
            const clipElement = event.target.closest('.clip');
            if (clipElement) {
                const clipId = clipElement.getAttribute('data-clip-id');
                startClipRename(clipId, event.target);
            }
        }
    });

    // Draggable in/out points
    interact('#in-point-marker').draggable({
        axis: 'x',
        listeners: {
            move: dragInPointMove,
            end: dragInPointEnd
        }
    });

    interact('#out-point-marker').draggable({
        axis: 'x',
        listeners: {
            move: dragOutPointMove,
            end: dragOutPointEnd
        }
    });
}

/**
 * Drag clip start - initialize drag state for cross-track dragging
 */
function dragClipStart(event) {
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
 * Drag clip move - COMPLETE REWRITE: enable cross-track dragging with cursor following
 */
async function dragClipMove(event) {
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

    if (panDirection !== 0) {
        autoPanState.direction = panDirection;
        autoPanState.speed = panSpeed;
        startAutoPan();
    } else {
        stopAutoPan();
    }
}

/**
 * Drag clip end - sync final position to state and detect final track
 */
async function dragClipEnd(event) {
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
    // (This may shift the clip if it was dragged to negative time)
    normalizeTimelinePositions();

    // Calculate new CSS position BEFORE removing transform to prevent flash
    // (Use data-start AFTER normalization)
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

    // Reset visual state (transform removal won't cause flash since CSS position is already correct)
    target.style.transform = '';
    target.style.zIndex = '';
    target.style.pointerEvents = '';
    target.style.position = '';
    target.removeAttribute('data-drag-x');
    target.removeAttribute('data-drag-y');
    target.removeAttribute('data-drag-offset-pct');
    target.removeAttribute('data-dragging'); // Allow position updates again
    target.removeAttribute('data-original-parent');

    // Reset bounds to actual positions (no rate limiting after drag ends)
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
            // Allow clips to move to any regular track (not transcript/marker tracks)
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

        // Record to history before making any changes
        const { pushToHistory } = await import('./history-manager.js');
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

        // Add current position to movement history (before update)
        const positionChanged = trackChanged || Math.abs(clip.start - finalStart) > 0.01;
        if (positionChanged) {
            // Check if this position is already in history
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
        // Check if there's already a move action for this clip
        const existingMoveAction = state.trackActions?.find(a => a.clipId === clipId && a.type === 'move');
        if (!existingMoveAction && positionChanged) {
            const { addTrackAction } = await import('./track-actions.js');
            const originalStart = parseFloat(target.getAttribute('data-original-start'));
            const originalTrack = target.getAttribute('data-original-track');
            const trackId = trackChanged ? newTrackId : clip.trackId;
            addTrackAction(trackId, finalStart, 'move', clipId, 'center', null, originalStart, originalTrack);
        }
    }

    // Update all elements (this will recalculate timeline bounds dynamically)
    updateAllTimelineElements();

    // Re-enforce viewport bounds after drag (in case we panned past bounds during drag)
    const { updateViewportRange, generateTimeMarkers, updatePlayheadPosition, updateInOutMarkers } = await import('./timeline.js');
    updateViewportRange();
    generateTimeMarkers();
    updatePlayheadPosition();
    updateInOutMarkers();

    // Re-compile transcript panel (clips may have moved)
    const { renderCompiledTranscript, renderSearchMarkersOnTimeline } = await import('./transcript.js');
    renderCompiledTranscript();

    // Re-render search markers to correct positions after clip move
    await renderSearchMarkersOnTimeline();
}

/**
 * Normalize timeline - ensure earliest content is ALWAYS at 0
 * This is TRUE recalculation - timeline expands/contracts dynamically
 */
export function normalizeTimelinePositions() {
    let minTime = Infinity;

    // Find earliest time across all content
    document.querySelectorAll('.clip[data-start]').forEach(clip => {
        const start = parseFloat(clip.getAttribute('data-start'));
        if (start < minTime) minTime = start;
    });

    document.querySelectorAll('.transcript-segment-marker[data-start]').forEach(segment => {
        const start = parseFloat(segment.getAttribute('data-start'));
        if (start < minTime) minTime = start;
    });

    document.querySelectorAll('.marker[data-time]').forEach(marker => {
        const time = parseFloat(marker.getAttribute('data-time'));
        if (time < minTime) minTime = time;
    });

    // If no content, nothing to normalize
    if (minTime === Infinity) return;

    // Calculate shift needed to make earliest content = 0
    // Negative minTime → shift right (expand left)
    // Positive minTime → shift left (contract from left)
    const shift = -minTime;

    // Only shift if needed (earliest is not already at 0)
    if (Math.abs(shift) > 0.001) {
        // Shift all clips in STATE
        getAllClips().forEach(clip => {
            updateClip(clip.id, {
                start: clip.start + shift
            });
        });

        // Shift all markers in STATE
        getAllMarkers().forEach(marker => {
            updateMarker(marker.id, {
                time: marker.time + shift
            });
        });

        // Shift all transcripts in STATE
        getAllTranscripts().forEach(transcript => {
            updateTranscript(transcript.id, {
                start: transcript.start + shift
            });
        });

        // Shift all clips in DOM
        document.querySelectorAll('.clip[data-start]').forEach(clip => {
            const currentStart = parseFloat(clip.getAttribute('data-start'));
            clip.setAttribute('data-start', currentStart + shift);
        });

        // Shift all transcript segments in DOM
        document.querySelectorAll('.transcript-segment-marker[data-start]').forEach(segment => {
            const currentStart = parseFloat(segment.getAttribute('data-start'));
            segment.setAttribute('data-start', currentStart + shift);
        });

        // Shift all markers in DOM
        document.querySelectorAll('.marker[data-time]').forEach(marker => {
            const currentTime = parseFloat(marker.getAttribute('data-time'));
            marker.setAttribute('data-time', currentTime + shift);
        });

        // Shift playback position
        if (state.playback.currentTime !== undefined) {
            state.playback.currentTime = Math.max(0, state.playback.currentTime + shift);
        }

        // Shift in/out points
        if (state.selection.inPoint !== null) {
            state.selection.inPoint = Math.max(0, state.selection.inPoint + shift);
        }
        if (state.selection.outPoint !== null) {
            state.selection.outPoint = Math.max(0, state.selection.outPoint + shift);
        }

        // Shift viewport to maintain visual continuity
        // IMPORTANT: Maintain viewport duration (zoom level) when shifting
        const viewportDuration = state.timeline.viewportEnd - state.timeline.viewportStart;

        state.timeline.viewportStart += shift;
        state.timeline.viewportEnd += shift;

        // If viewport start goes negative, clamp it but maintain duration
        if (state.timeline.viewportStart < 0) {
            state.timeline.viewportStart = 0;
            state.timeline.viewportEnd = viewportDuration; // Maintain duration, not shift
        }

        // Reset bounds after shifting to ensure they're accurate
        resetTimelineBounds();
    }
}

/**
 * Resize clip move - BASE BEHAVIOR: cursor position = edge time, viewport shifts to accommodate
 */
async function resizeClipMove(event) {
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

    // Update attached audio (clipId already declared at top of function)
    if (clipId) {
        const attachedAudio = document.querySelector(`.attached-audio-clip[data-parent-clip="${clipId}"]`);
        if (attachedAudio) {
            attachedAudio.setAttribute('data-start', target.getAttribute('data-start'));
            attachedAudio.setAttribute('data-duration', target.getAttribute('data-duration'));
        }
    }

    // Update all elements in real-time (bounds-aware, allows negative times during resize)
    updateAllTimelineElements();
    updatePlayheadPosition();
    updateInOutMarkers();
}

/**
 * Resize clip end - sync final size to state
 */
async function resizeClipEnd(event) {
    const target = event.target;
    const clipId = target.getAttribute('data-clip-id');

    // If any content is at negative time, shift EVERYTHING right to make earliest clip 0
    normalizeTimelinePositions();

    // Reset bounds to actual positions (no rate limiting after resize ends)
    resetTimelineBounds();

    // Record to history before making any changes (makes resize undoable)
    const { pushToHistory } = await import('./history-manager.js');
    pushToHistory();

    // After normalization, sync final dimensions to state
    if (clipId) {
        const finalStart = parseFloat(target.getAttribute('data-start'));
        const finalDuration = parseFloat(target.getAttribute('data-duration'));

        updateClip(clipId, {
            start: finalStart,
            duration: finalDuration
        });

        // Also update attached audio if this is a video clip
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

    // Re-enforce viewport bounds after resize (in case we panned past bounds during resize)
    const { updateViewportRange, generateTimeMarkers, updatePlayheadPosition, updateInOutMarkers } = await import('./timeline.js');
    updateViewportRange();
    generateTimeMarkers();
    updatePlayheadPosition();
    updateInOutMarkers();

    // Re-compile transcript panel (clips may have moved/resized)
    const { renderCompiledTranscript, renderSearchMarkersOnTimeline } = await import('./transcript.js');
    renderCompiledTranscript();

    // Re-render search markers to correct positions after clip resize
    await renderSearchMarkersOnTimeline();
}

// ==================== In/Out Point Drag Handlers ====================

function dragInPointMove(event) {
    const timeMarkers = document.querySelector('.time-markers');
    const rect = timeMarkers.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const trackWidth = rect.width;

    // Calculate time from viewport position
    const viewportDuration = state.timeline.viewportEnd - state.timeline.viewportStart;
    const time = state.timeline.viewportStart + (mouseX / trackWidth) * viewportDuration;

    // Update state
    state.selection.inPoint = Math.max(0, time);

    // Update visual position
    updateAllTimelineElements();
}

function dragInPointEnd(event) {
    // Snap to grid if enabled
    if (state.timeline.snapToGrid && state.selection.inPoint !== null) {
        const gridSize = 1.0;
        state.selection.inPoint = Math.round(state.selection.inPoint / gridSize) * gridSize;
        updateAllTimelineElements();
    }
}

function dragOutPointMove(event) {
    const timeMarkers = document.querySelector('.time-markers');
    const rect = timeMarkers.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const trackWidth = rect.width;

    // Calculate time from viewport position
    const viewportDuration = state.timeline.viewportEnd - state.timeline.viewportStart;
    const time = state.timeline.viewportStart + (mouseX / trackWidth) * viewportDuration;

    // Update state
    state.selection.outPoint = Math.max(0, time);

    // Update visual position
    updateAllTimelineElements();
}

function dragOutPointEnd(event) {
    // Snap to grid if enabled
    if (state.timeline.snapToGrid && state.selection.outPoint !== null) {
        const gridSize = 1.0;
        state.selection.outPoint = Math.round(state.selection.outPoint / gridSize) * gridSize;
        updateAllTimelineElements();
    }
}
