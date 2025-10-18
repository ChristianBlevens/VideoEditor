/**
 * Markers Interaction System
 *
 * Handles dragging of In/Out point markers
 */

import { state } from '../core/state.js';
import { updateAllTimelineElements } from '../features/timeline/timeline.js';

/**
 * Drag In Point Move
 */
export function dragInPointMove(event) {
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

/**
 * Drag In Point End
 */
export function dragInPointEnd(event) {
    // Snap to grid if enabled
    if (state.timeline.snapToGrid && state.selection.inPoint !== null) {
        const gridSize = 1.0;
        state.selection.inPoint = Math.round(state.selection.inPoint / gridSize) * gridSize;
        updateAllTimelineElements();
    }
}

/**
 * Drag Out Point Move
 */
export function dragOutPointMove(event) {
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

/**
 * Drag Out Point End
 */
export function dragOutPointEnd(event) {
    // Snap to grid if enabled
    if (state.timeline.snapToGrid && state.selection.outPoint !== null) {
        const gridSize = 1.0;
        state.selection.outPoint = Math.round(state.selection.outPoint / gridSize) * gridSize;
        updateAllTimelineElements();
    }
}
