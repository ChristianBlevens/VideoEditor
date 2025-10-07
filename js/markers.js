// ==================== Markers Management ====================
// Data-driven markers using building blocks

import { state } from './state.js';
import { elements } from './dom-cache.js';
import { showToast } from './ui-utils.js';
import { createMarker, deleteMarker } from './operations.js';
import { renderAllMarkers } from './rendering.js';
import { calculateTimelineBounds } from './timeline.js';

// Temp state for new marker (time-based, not percentage)
let pendingMarker = {
    time: null,
    comment: ''
};

/**
 * Handle click on marker track to create new marker
 * @param {Event} e
 */
export function handleMarkerTrackClick(e) {
    // Don't create marker if clicking on existing marker
    if (e.target.closest('.marker')) {
        handleMarkerClick(e);
        return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const parentWidth = rect.width;

    // Calculate time from viewport position (not percentage!)
    const viewportDuration = state.timeline.viewportEnd - state.timeline.viewportStart;
    const displayTime = state.timeline.viewportStart + (clickX / parentWidth) * viewportDuration;

    // Convert to absolute time
    const bounds = calculateTimelineBounds();
    const offset = bounds.start || 0;
    const absoluteTime = displayTime;

    // Store time and open modal
    pendingMarker.time = absoluteTime;
    openMarkerModal();
}

/**
 * Handle click on existing marker (for deletion)
 * @param {Event} e
 */
function handleMarkerClick(e) {
    const markerEl = e.target.closest('.marker');
    if (!markerEl) return;

    if (confirm('Delete this marker?')) {
        const time = parseFloat(markerEl.getAttribute('data-time'));

        // Find marker by time
        const marker = state.project.markers.find(m => Math.abs(m.time - time) < 0.01);
        if (marker) {
            deleteMarker(marker.id);
            renderAllMarkers();
            showToast('Marker deleted');
        }
    }
}

/**
 * Open marker creation modal
 */
export function openMarkerModal() {
    elements.markerModal.classList.add('active');
    elements.markerCommentInput.value = '';
    elements.markerCommentInput.focus();
}

/**
 * Close marker creation modal
 */
export function closeMarkerModal() {
    elements.markerModal.classList.remove('active');
    pendingMarker.time = null;
    pendingMarker.comment = '';
}

/**
 * Save new marker (data-driven)
 */
export function saveNewMarker() {
    const comment = elements.markerCommentInput.value.trim();

    if (!comment) {
        showToast('Please enter a comment', 'warning');
        return;
    }

    if (pendingMarker.time === null) {
        showToast('Invalid marker position', 'warning');
        return;
    }

    // Create marker in state
    createMarker(pendingMarker.time, comment);

    // Render all markers from state
    renderAllMarkers();

    closeMarkerModal();
    showToast('Marker created');
}
