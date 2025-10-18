/**
 * Auto-Pan System
 *
 * Handles smooth auto-panning when dragging clips near viewport edges
 */

import { panTimeline } from '../features/timeline/timeline.js';
import { updateAllTimelineElements, updatePlayheadPosition, updateInOutMarkers } from '../features/timeline/timeline.js';

// Auto-pan state
const autoPanState = {
    active: false,
    direction: 0, // -1 = left, 1 = right, 0 = none
    speed: 0,
    animationFrame: null
};

/**
 * Smooth auto-pan loop using requestAnimationFrame
 */
export function startAutoPan() {
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
export function stopAutoPan() {
    autoPanState.active = false;
    autoPanState.direction = 0;
    autoPanState.speed = 0;

    if (autoPanState.animationFrame) {
        cancelAnimationFrame(autoPanState.animationFrame);
        autoPanState.animationFrame = null;
    }
}

/**
 * Update auto-pan based on cursor position
 */
export function updateAutoPan(direction, speed) {
    if (direction !== 0) {
        autoPanState.direction = direction;
        autoPanState.speed = speed;
        startAutoPan();
    } else {
        stopAutoPan();
    }
}

/**
 * Get auto-pan state
 */
export function getAutoPanState() {
    return { ...autoPanState };
}
