// ==================== Timeline System (Viewport-Based, Adaptive Length) ====================
import { state } from '../../core/state.js';
import { elements } from '../../rendering/dom-cache.js';
import { showToast } from '../../ui/ui-utils.js';

/**
 * Calculate timeline bounds purely from clip positions
 * Timeline length = combination of clips within it
 * Rate-limited when shrinking to prevent acceleration during drag
 */
export function calculateTimelineBounds() {
    let minStart = Infinity;
    let maxEnd = -Infinity;

    // Check all clips for absolute bounds
    document.querySelectorAll('.clip[data-start][data-duration]').forEach(clip => {
        const start = parseFloat(clip.getAttribute('data-start'));
        const duration = parseFloat(clip.getAttribute('data-duration'));
        const end = start + duration;

        if (start < minStart) minStart = start;
        if (end > maxEnd) maxEnd = end;
    });

    // NOTE: Transcripts are now attached to clips, not on a separate track

    // Check markers
    document.querySelectorAll('.marker[data-time]').forEach(marker => {
        const time = parseFloat(marker.getAttribute('data-time'));
        if (time < minStart) minStart = time;
        if (time > maxEnd) maxEnd = time;
    });

    // If no content, return default (10 seconds when empty)
    if (minStart === Infinity || maxEnd === -Infinity) {
        return {
            start: 0,
            end: 10,
            duration: 10
        };
    }

    // Raw bounds from actual clip positions
    const rawBounds = {
        start: minStart,
        end: maxEnd,
        duration: maxEnd - minStart
    };

    // Apply rate limiting when bounds are shrinking
    const now = Date.now();
    const lastBounds = state.timeline.lastBounds;
    const lastUpdateTime = state.timeline.lastBoundsUpdateTime;
    const elapsedSeconds = (now - lastUpdateTime) / 1000;

    // Maximum shrink rate: 30 seconds per second of real time (matches drag speed)
    const maxShrinkRate = 30; // seconds/second
    const maxDeltaStart = maxShrinkRate * elapsedSeconds; // Max increase in start
    const maxDeltaEnd = maxShrinkRate * elapsedSeconds; // Max decrease in end

    let finalStart = rawBounds.start;
    let finalEnd = rawBounds.end;

    // If start is moving right (timeline shrinking from left), rate limit it
    if (rawBounds.start > lastBounds.start) {
        const delta = rawBounds.start - lastBounds.start;
        if (delta > maxDeltaStart) {
            finalStart = lastBounds.start + maxDeltaStart;
        }
    } else {
        // Growing or staying same - no rate limit
        finalStart = rawBounds.start;
    }

    // If end is moving left (timeline shrinking from right), rate limit it
    if (rawBounds.end < lastBounds.end) {
        const delta = lastBounds.end - rawBounds.end;
        if (delta > maxDeltaEnd) {
            finalEnd = lastBounds.end - maxDeltaEnd;
        }
    } else {
        // Growing or staying same - no rate limit
        finalEnd = rawBounds.end;
    }

    const finalBounds = {
        start: finalStart,
        end: finalEnd,
        duration: finalEnd - finalStart
    };

    // Update state with new bounds and time
    state.timeline.lastBounds = finalBounds;
    state.timeline.lastBoundsUpdateTime = now;

    return finalBounds;
}

/**
 * Reset timeline bounds to actual clip positions (no rate limiting)
 * Call this after drag/resize ends to snap bounds to final positions
 */
export function resetTimelineBounds() {
    let minStart = Infinity;
    let maxEnd = -Infinity;

    // Check all clips for absolute bounds
    document.querySelectorAll('.clip[data-start][data-duration]').forEach(clip => {
        const start = parseFloat(clip.getAttribute('data-start'));
        const duration = parseFloat(clip.getAttribute('data-duration'));
        const end = start + duration;

        if (start < minStart) minStart = start;
        if (end > maxEnd) maxEnd = end;
    });

    // NOTE: Transcripts are now attached to clips, not on a separate track

    // Check markers
    document.querySelectorAll('.marker[data-time]').forEach(marker => {
        const time = parseFloat(marker.getAttribute('data-time'));
        if (time < minStart) minStart = time;
        if (time > maxEnd) maxEnd = time;
    });

    // If no content, use default (10 seconds when empty)
    if (minStart === Infinity || maxEnd === -Infinity) {
        minStart = 0;
        maxEnd = 10;
    }

    // Update state directly with actual bounds (no rate limiting)
    state.timeline.lastBounds = {
        start: minStart,
        end: maxEnd,
        duration: maxEnd - minStart
    };
    state.timeline.lastBoundsUpdateTime = Date.now();
}

/**
 * Initialize timeline on app load
 */
export function initializeTimeline() {
    resetTimelineBounds(); // Initialize bounds state

    // Set viewport to 100% (show entire timeline) on startup
    const bounds = calculateTimelineBounds();
    state.timeline.viewportDuration = bounds.duration;
    state.timeline.viewportStart = bounds.start;

    updateViewportRange();
    generateTimeMarkers();
    updateZoomLevel();
    updateAllTimelineElements();
    updateInOutMarkers();
}

/**
 * Update viewport range based on timeline bounds and viewport duration
 * Viewport duration is stored directly, not calculated from zoom multiplier
 */
export function updateViewportRange() {
    const bounds = calculateTimelineBounds();
    const timelineStart = bounds.start;
    const timelineEnd = bounds.end;
    const timelineDuration = bounds.duration;

    // Check if timeline shrank and we're at 100% (showing entire timeline)
    const wasShowingEntireTimeline = state.timeline.viewportDuration >= state.timeline.lastBounds.duration;

    if (wasShowingEntireTimeline && timelineDuration < state.timeline.lastBounds.duration) {
        // Timeline shrank and we were at 100% - shrink viewport to match
        state.timeline.viewportDuration = timelineDuration;
    }

    // Clamp viewport duration to timeline bounds
    // Max: entire timeline, Min: 1 second (or timeline duration if shorter)
    const minViewportDuration = Math.min(1, timelineDuration);
    state.timeline.viewportDuration = Math.max(minViewportDuration, Math.min(state.timeline.viewportDuration, timelineDuration));

    // Calculate viewport end
    state.timeline.viewportEnd = state.timeline.viewportStart + state.timeline.viewportDuration;

    // STRICT BOUNDS ENFORCEMENT - viewport cannot exceed timeline bounds
    // Viewport start cannot be before timeline start
    if (state.timeline.viewportStart < timelineStart) {
        state.timeline.viewportStart = timelineStart;
    }

    // Viewport end cannot exceed timeline end
    if (state.timeline.viewportEnd > timelineEnd) {
        state.timeline.viewportEnd = timelineEnd;
        state.timeline.viewportStart = Math.max(timelineStart, timelineEnd - state.timeline.viewportDuration);
    }

    // Recalculate end to ensure consistency
    state.timeline.viewportEnd = state.timeline.viewportStart + state.timeline.viewportDuration;

    // Final clamp: ensure viewport end doesn't exceed timeline end
    if (state.timeline.viewportEnd > timelineEnd) {
        state.timeline.viewportEnd = timelineEnd;
        state.timeline.viewportStart = Math.max(timelineStart, timelineEnd - state.timeline.viewportDuration);
    }
}

/**
 * Pan timeline viewport (instant, no throttling)
 * @param {number} deltaSeconds - Seconds to pan (+ = right, - = left)
 */
export function panTimeline(deltaSeconds) {
    // Get timeline bounds
    const bounds = calculateTimelineBounds();
    const timelineStart = bounds.start;
    const timelineEnd = bounds.end;

    // Update viewport
    state.timeline.viewportStart += deltaSeconds;

    // Enforce left boundary (cannot go before timeline start)
    if (state.timeline.viewportStart < timelineStart) {
        state.timeline.viewportStart = timelineStart;
    }

    // Enforce right boundary (cannot pan past timeline end)
    if (state.timeline.viewportStart + state.timeline.viewportDuration > timelineEnd) {
        state.timeline.viewportStart = Math.max(timelineStart, timelineEnd - state.timeline.viewportDuration);
    }

    // Update viewport end
    state.timeline.viewportEnd = state.timeline.viewportStart + state.timeline.viewportDuration;

    // Final clamp to timeline bounds
    if (state.timeline.viewportEnd > timelineEnd) {
        state.timeline.viewportEnd = timelineEnd;
        state.timeline.viewportStart = Math.max(timelineStart, timelineEnd - state.timeline.viewportDuration);
    }

    // Update time markers
    generateTimeMarkers();
}

/**
 * Update all timeline elements (unified, synchronous, identical method)
 * No offset system - everything is 0-based
 */
export function updateAllTimelineElements() {
    const viewportDuration = state.timeline.viewportEnd - state.timeline.viewportStart;

    // Unified positioning function - ALL elements use this exact same method
    const positionTimelineElement = (element, start, duration = 0) => {
        const end = start + duration;

        // Calculate position as percentage of viewport (identical for all elements)
        const leftPercent = ((start - state.timeline.viewportStart) / viewportDuration) * 100;
        const widthPercent = duration > 0 ? (duration / viewportDuration) * 100 : 0;

        // Visibility check (identical for all elements)
        const isVisible = duration > 0
            ? (end >= state.timeline.viewportStart && start <= state.timeline.viewportEnd)
            : (start >= state.timeline.viewportStart && start <= state.timeline.viewportEnd);

        // Apply styles (identical method for all elements)
        if (!isVisible) {
            element.style.display = 'none';
        } else {
            element.style.display = '';
            element.style.left = `${leftPercent}%`;
            if (duration > 0) {
                element.style.width = `${widthPercent}%`;
            }
        }
    };

    // Position all clips (using unified method)
    document.querySelectorAll('.clip[data-start][data-duration]').forEach(clip => {
        // Skip clips being dragged - they use transform positioning
        if (clip.hasAttribute('data-dragging')) return;

        const start = parseFloat(clip.getAttribute('data-start'));
        const duration = parseFloat(clip.getAttribute('data-duration'));
        positionTimelineElement(clip, start, duration);

        // Update attached audio (uses exact same values)
        const clipId = clip.getAttribute('data-clip-id');
        if (clipId) {
            const attachedAudio = document.querySelector(`.attached-audio-clip[data-parent-clip="${clipId}"]`);
            if (attachedAudio) {
                positionTimelineElement(attachedAudio, start, duration);
            }
        }
    });

    // NOTE: Transcripts are now attached to clips, not on a separate track

    // Position markers (exact same method, duration = 0)
    document.querySelectorAll('.marker[data-time]').forEach(marker => {
        const time = parseFloat(marker.getAttribute('data-time'));
        positionTimelineElement(marker, time, 0);
    });

    // Position track action indicators (exact same method, duration = 0)
    document.querySelectorAll('.track-action-indicator[data-time]').forEach(indicator => {
        const time = parseFloat(indicator.getAttribute('data-time'));
        positionTimelineElement(indicator, time, 0);
    });

    // Position search markers on transcript track (exact same method, duration = 0)
    document.querySelectorAll('.search-marker[data-time]').forEach(marker => {
        const time = parseFloat(marker.getAttribute('data-time'));
        positionTimelineElement(marker, time, 0);
    });
}

/**
 * Generate time markers based on viewport
 */
export function generateTimeMarkers() {
    const viewportDuration = state.timeline.viewportEnd - state.timeline.viewportStart;
    const interval = 5; // 5 second intervals

    elements.timeMarkers.innerHTML = '';

    // Start from first interval visible in viewport
    const startInterval = Math.floor(state.timeline.viewportStart / interval) * interval;

    for (let time = startInterval; time <= state.timeline.viewportEnd; time += interval) {
        const position = ((time - state.timeline.viewportStart) / viewportDuration) * 100;

        const marker = document.createElement('div');
        marker.className = 'time-marker';
        marker.style.cssText = `
            position: absolute;
            left: ${position}%;
            height: 100%;
            border-left: 1px solid var(--border-color);
            font-size: 10px;
            color: var(--text-secondary);
            padding-left: 4px;
            padding-top: 4px;
        `;
        marker.textContent = formatTime(time);
        elements.timeMarkers.appendChild(marker);
    }
}

/**
 * Format time as MM:SS
 */
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Zoom timeline by adjusting viewport duration
 * Zoom in = decrease viewport duration (see less time, more detail)
 * Zoom out = increase viewport duration (see more time, less detail)
 * @param {string} direction - 'in' or 'out'
 * @param {number} [centerTime] - Time to center zoom on (defaults to viewport center)
 */
export function zoomTimeline(direction, centerTime = null) {
    const bounds = calculateTimelineBounds();
    const timelineDuration = bounds.duration;

    // Min viewport: 1 second (or timeline duration if shorter)
    const minViewportDuration = Math.min(1, timelineDuration);
    // Max viewport: entire timeline (100%)
    const maxViewportDuration = timelineDuration;

    // Calculate center point before zoom
    const oldViewportDuration = state.timeline.viewportDuration;
    const oldViewportStart = state.timeline.viewportStart;

    // If no center time specified, use center of current viewport
    if (centerTime === null) {
        centerTime = oldViewportStart + (oldViewportDuration / 2);
    }

    // Calculate where centerTime is positioned in current viewport (0-1)
    const centerPosition = (centerTime - oldViewportStart) / oldViewportDuration;

    if (direction === 'in') {
        // Zoom IN = decrease viewport duration by 20%
        state.timeline.viewportDuration = Math.max(state.timeline.viewportDuration / 1.2, minViewportDuration);
    } else {
        // Zoom OUT = increase viewport duration by 20%
        state.timeline.viewportDuration = Math.min(state.timeline.viewportDuration * 1.2, maxViewportDuration);
    }

    // Adjust viewport start to keep centerTime at same visual position
    const newViewportDuration = state.timeline.viewportDuration;
    state.timeline.viewportStart = centerTime - (centerPosition * newViewportDuration);

    updateZoomLevel();
    updateViewportRange();
    generateTimeMarkers();
    updateAllTimelineElements();
    updatePlayheadPosition();
    updateInOutMarkers();
}

/**
 * Reset zoom to 100% (fit entire timeline in viewport)
 */
export function resetZoom() {
    const bounds = calculateTimelineBounds();
    const timelineDuration = bounds.duration;

    // Set viewport to show entire timeline
    state.timeline.viewportDuration = timelineDuration;
    state.timeline.viewportStart = bounds.start;

    updateZoomLevel();
    updateViewportRange();
    generateTimeMarkers();
    updateAllTimelineElements();
    updatePlayheadPosition();
    updateInOutMarkers();
    showToast('Fit timeline (100%)');
}

/**
 * Update zoom level display - shows actual timeline coverage percentage
 */
export function updateZoomLevel() {
    const bounds = calculateTimelineBounds();
    const timelineDuration = bounds.duration;

    // Calculate actual percentage of timeline visible
    const coveragePercent = timelineDuration > 0
        ? Math.round((state.timeline.viewportDuration / timelineDuration) * 100)
        : 100;

    elements.zoomLevel.textContent = `${coveragePercent}%`;
}

/**
 * Update playhead position (no offset - everything is 0-based)
 */
export function updatePlayheadPosition() {
    const currentTime = state.playback.currentTime;
    const viewportDuration = state.timeline.viewportEnd - state.timeline.viewportStart;
    const positionPercent = ((currentTime - state.timeline.viewportStart) / viewportDuration) * 100;
    const trackWidth = elements.timelineWrapper.clientWidth - (elements.timeRulerHeader?.offsetWidth || 140);
    const leftPixels = (positionPercent / 100) * trackWidth + (elements.timeRulerHeader?.offsetWidth || 140);

    if (currentTime < state.timeline.viewportStart || currentTime > state.timeline.viewportEnd) {
        elements.playhead.style.display = 'none';
    } else {
        elements.playhead.style.display = 'block';
        elements.playhead.style.left = `${leftPixels}px`;
    }
}

/**
 * Set In point at current time
 */
export function setInPoint() {
    state.selection.inPoint = state.playback.currentTime;
    updateInOutMarkers();
    showToast('In point set');
}

/**
 * Set Out point at current time
 */
export function setOutPoint() {
    state.selection.outPoint = state.playback.currentTime;
    updateInOutMarkers();
    showToast('Out point set');
}

/**
 * Update In/Out markers (no offset - everything is 0-based)
 */
export function updateInOutMarkers() {
    const viewportDuration = state.timeline.viewportEnd - state.timeline.viewportStart;

    // In marker
    if (state.selection.inPoint !== null) {
        const inTime = state.selection.inPoint;
        const positionPercent = ((inTime - state.timeline.viewportStart) / viewportDuration) * 100;
        const trackWidth = elements.timelineWrapper.clientWidth - (elements.timeRulerHeader?.offsetWidth || 140);
        const leftPixels = (positionPercent / 100) * trackWidth + (elements.timeRulerHeader?.offsetWidth || 140);

        if (inTime >= state.timeline.viewportStart && inTime <= state.timeline.viewportEnd) {
            elements.inPointMarker.style.display = 'block';
            elements.inPointMarker.style.left = `${leftPixels}px`;
        } else {
            elements.inPointMarker.style.display = 'none';
        }
    } else {
        elements.inPointMarker.style.display = 'none';
    }

    // Out marker
    if (state.selection.outPoint !== null) {
        const outTime = state.selection.outPoint;
        const positionPercent = ((outTime - state.timeline.viewportStart) / viewportDuration) * 100;
        const trackWidth = elements.timelineWrapper.clientWidth - (elements.timeRulerHeader?.offsetWidth || 140);
        const leftPixels = (positionPercent / 100) * trackWidth + (elements.timeRulerHeader?.offsetWidth || 140);

        if (outTime >= state.timeline.viewportStart && outTime <= state.timeline.viewportEnd) {
            elements.outPointMarker.style.display = 'block';
            elements.outPointMarker.style.left = `${leftPixels}px`;
        } else {
            elements.outPointMarker.style.display = 'none';
        }
    } else {
        elements.outPointMarker.style.display = 'none';
    }
}

/**
 * Format time display (used by playback.js)
 */
export function formatTimeDisplay(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30); // 30fps
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
}
