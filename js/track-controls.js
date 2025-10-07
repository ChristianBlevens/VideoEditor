// ==================== Track Controls Management ====================
// Data-driven track control operations and rendering

import { state } from './state.js';
import { showToast } from './ui-utils.js';

// ==================== Operations ====================

/**
 * Update a track property
 * @param {string} trackId - Track ID
 * @param {string} property - Property name
 * @param {*} value - New value
 */
export function updateTrackProperty(trackId, property, value) {
    if (!state.tracks[trackId]) {
        state.tracks[trackId] = {
            locked: false,
            visible: true,
            muted: false,
            solo: false
        };
    }

    state.tracks[trackId][property] = value;
    return true;
}

/**
 * Get track state
 * @param {string} trackId - Track ID
 * @returns {Object|null}
 */
export function getTrackState(trackId) {
    return state.tracks[trackId] || null;
}

// ==================== Rendering ====================

/**
 * Render track control button state
 * @param {string} trackId - Track ID
 */
export function renderTrackControls(trackId) {
    const track = document.querySelector(`[data-track-id="${trackId}"]`);
    if (!track) return;

    const trackState = getTrackState(trackId);
    if (!trackState) return;

    // Lock button
    const lockBtn = track.querySelector('.track-lock-btn');
    if (lockBtn) {
        const lockIcon = lockBtn.querySelector('i');
        if (lockIcon) {
            lockIcon.className = trackState.locked ? 'fas fa-lock' : 'fas fa-lock-open';
        }
        lockBtn.classList.toggle('active', trackState.locked);
        lockBtn.title = trackState.locked ? 'Unlock Track' : 'Lock Track';
    }

    // Visible button
    const visibleBtn = track.querySelector('.track-visible-btn');
    if (visibleBtn) {
        const visibleIcon = visibleBtn.querySelector('i');
        if (visibleIcon) {
            visibleIcon.className = trackState.visible ? 'fas fa-eye' : 'fas fa-eye-slash';
        }
        visibleBtn.classList.toggle('active', !trackState.visible);
        visibleBtn.title = trackState.visible ? 'Hide Track' : 'Show Track';
    }

    // Mute button
    const muteBtn = track.querySelector('.track-mute-btn');
    if (muteBtn) {
        const muteIcon = muteBtn.querySelector('i');
        if (muteIcon) {
            muteIcon.className = trackState.muted ? 'fas fa-volume-mute' : 'fas fa-volume-up';
        }
        muteBtn.classList.toggle('active', trackState.muted);
        muteBtn.title = trackState.muted ? 'Unmute Track' : 'Mute Track';
    }

    // Solo button (audio tracks only)
    const soloBtn = track.querySelector('.track-solo-btn');
    if (soloBtn) {
        soloBtn.classList.toggle('active', trackState.solo);
        soloBtn.title = trackState.solo ? 'Unsolo Track' : 'Solo Track';
    }

    // Track content visibility
    const trackContent = track.querySelector('.track-content');
    if (trackContent) {
        trackContent.style.display = trackState.visible ? '' : 'none';
    }

    // Track volume slider
    const volumeSlider = track.querySelector('.track-volume');
    if (volumeSlider && trackState.volume !== undefined) {
        volumeSlider.value = trackState.volume;
    }
}

/**
 * Render all track controls
 */
export function renderAllTrackControls() {
    Object.keys(state.tracks).forEach(trackId => {
        renderTrackControls(trackId);
    });
}

// ==================== Event Handlers ====================

/**
 * Handle track lock toggle
 */
export function handleTrackLockToggle(e) {
    const track = e.target.closest('.track');
    if (!track) return;

    const trackId = track.getAttribute('data-track-id');
    const trackState = getTrackState(trackId);
    const currentlyLocked = trackState?.locked || false;

    updateTrackProperty(trackId, 'locked', !currentlyLocked);
    renderTrackControls(trackId);

    showToast(`Track ${!currentlyLocked ? 'locked' : 'unlocked'}`);
}

/**
 * Handle track visibility toggle
 */
export function handleTrackVisibilityToggle(e) {
    const track = e.target.closest('.track');
    if (!track) return;

    const trackId = track.getAttribute('data-track-id');
    const trackState = getTrackState(trackId);
    const currentlyVisible = trackState?.visible !== false;

    updateTrackProperty(trackId, 'visible', !currentlyVisible);
    renderTrackControls(trackId);

    showToast(`Track ${!currentlyVisible ? 'shown' : 'hidden'}`);
}

/**
 * Handle track mute toggle
 */
export function handleTrackMuteToggle(e) {
    const track = e.target.closest('.track');
    if (!track) return;

    const trackId = track.getAttribute('data-track-id');
    const trackState = getTrackState(trackId);
    const currentlyMuted = trackState?.muted || false;

    updateTrackProperty(trackId, 'muted', !currentlyMuted);
    renderTrackControls(trackId);

    showToast(`Track ${!currentlyMuted ? 'muted' : 'unmuted'}`);
}

/**
 * Handle track solo toggle
 */
export function handleTrackSoloToggle(e) {
    const track = e.target.closest('.track');
    if (!track) return;

    const trackId = track.getAttribute('data-track-id');
    const trackState = getTrackState(trackId);
    const currentlySolo = trackState?.solo || false;

    updateTrackProperty(trackId, 'solo', !currentlySolo);
    renderTrackControls(trackId);

    showToast(`Track ${!currentlySolo ? 'soloed' : 'unsoloed'}`);
}

/**
 * Handle track volume change
 */
export function handleTrackVolumeChange(e) {
    const track = e.target.closest('.track');
    if (!track) return;

    const trackId = track.getAttribute('data-track-id');
    const volume = parseInt(e.target.value);

    updateTrackProperty(trackId, 'volume', volume);

    // Volume changes don't need visual re-render
    // Would affect playback only
}
