// ==================== UI Utilities ====================
import { state } from './state.js';
import { elements } from './dom-cache.js';

// ==================== Toast Notifications ====================
export function showToast(message, type = 'info') {
    const toast = elements.progressToast;
    const messageEl = toast.querySelector('.toast-message');

    messageEl.textContent = message;
    toast.classList.add('active');

    // Auto-hide after 3 seconds for non-progress toasts
    if (!message.includes('...')) {
        setTimeout(() => {
            hideToast();
        }, 3000);
    }
}

export function updateProgressToast(percent, message = 'Processing...') {
    const toast = elements.progressToast;
    const messageEl = toast.querySelector('.toast-message');
    const fill = elements.progressFill;
    const percentEl = elements.progressPercent;

    messageEl.textContent = message;
    fill.style.width = `${percent}%`;
    percentEl.textContent = `${percent}%`;
    toast.classList.add('active');
}

export function hideToast() {
    elements.progressToast.classList.remove('active');
}

export function showNotification(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    showToast(message, type);
}

// ==================== Modal Management ====================
export function openExportModal() {
    elements.exportModal.classList.add('active');
    state.ui.exportModalOpen = true;
}

export function closeExportModal() {
    elements.exportModal.classList.remove('active');
    state.ui.exportModalOpen = false;
}

export function startExport() {
    closeExportModal();
    showToast('Starting export...', 'info');

    let progress = 0;
    const interval = setInterval(() => {
        progress += 5;
        updateProgressToast(progress, 'Exporting video...');

        if (progress >= 100) {
            clearInterval(interval);
            hideToast();
            showToast('Export complete!', 'success');
        }
    }, 200);
}

// ==================== Timeline View Toggles ====================
// Data-driven with unified rendering

/**
 * Handle waveform toggle
 */
export function handleWaveformToggle(e) {
    state.timeline.showWaveforms = e.target.checked;
    renderTrackVisibility();
}

/**
 * Handle markers track toggle
 */
export function handleMarkersToggle(e) {
    state.timeline.showMarkers = e.target.checked;
    renderTrackVisibility();
}

/**
 * Handle transcripts track toggle
 */
export function handleTranscriptsToggle(e) {
    state.timeline.showTranscripts = e.target.checked;
    renderTrackVisibility();
}

/**
 * Render track visibility from state (unified rendering)
 */
function renderTrackVisibility() {
    // Waveforms
    const waveforms = document.querySelectorAll('.waveform');
    waveforms.forEach(wf => {
        wf.style.display = state.timeline.showWaveforms ? 'block' : 'none';
    });

    // Marker track
    const markerTrack = document.querySelector('.marker-track');
    if (markerTrack) {
        markerTrack.style.display = state.timeline.showMarkers ? 'flex' : 'none';
    }

    // Transcript track
    const transcriptTrack = document.querySelector('.transcript-track');
    if (transcriptTrack) {
        transcriptTrack.style.display = state.timeline.showTranscripts ? 'flex' : 'none';
    }

    // Recalculate container height
    updateTimelineContainerHeight();
}

export async function handleTimelineScroll(e) {
    const scrollLeft = e.target.scrollLeft;
    const trackContent = document.querySelector('.track-content');
    if (!trackContent) return;

    // Note: This function may be deprecated in favor of pan/zoom system
    // Keeping for backwards compatibility

    const viewportWidth = elements.timelineWrapper.clientWidth - elements.timeRulerHeader.offsetWidth;

    // Calculate pixels per second from viewport duration
    const pixelsPerSecond = viewportWidth / state.timeline.viewportDuration;

    // Calculate visible time range
    state.timeline.viewportStart = scrollLeft / pixelsPerSecond;
    state.timeline.viewportEnd = state.timeline.viewportStart + state.timeline.viewportDuration;

    // Update all elements in real-time
    const { updateAllTimelineElements, updatePlayheadPosition, updateInOutMarkers, generateTimeMarkers } = await import('./timeline.js');
    updateAllTimelineElements();
    updatePlayheadPosition();
    updateInOutMarkers();
    generateTimeMarkers();
}

export function updateTimelineContainerHeight() {
    // Calculate the total height of all visible tracks
    const timelineContainer = document.querySelector('.timeline-container');
    const timelineToolbar = document.querySelector('.timeline-toolbar');
    const timeRuler = document.querySelector('.time-ruler');
    const tracks = document.querySelectorAll('.track');

    let totalHeight = timelineToolbar.offsetHeight + timeRuler.offsetHeight;

    tracks.forEach(track => {
        if (track.style.display !== 'none') {
            // Use computed style to get actual height
            const trackHeight = track.offsetHeight;
            totalHeight += trackHeight;
        }
    });

    // Add some padding
    totalHeight += 20;

    // Set the timeline container height
    timelineContainer.style.height = `${totalHeight}px`;
}

// ==================== Textarea Auto-Grow ====================
export function autoGrowTextarea(textarea) {
    if (!textarea) return;

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = 'auto';
    // Set height to scrollHeight to fit content
    textarea.style.height = textarea.scrollHeight + 'px';
}
