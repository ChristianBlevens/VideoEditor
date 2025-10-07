// ==================== Clip Properties Management ====================
// Data-driven clip property operations and rendering

import { state } from './state.js';
import { elements } from './dom-cache.js';
import { getClip, updateClip } from './operations.js';
import { renderClip } from './rendering.js';
import { showToast } from './ui-utils.js';

// ==================== Utilities ====================

/**
 * Parse timecode string to seconds
 * Format: HH:MM:SS:FF or HH:MM:SS or MM:SS
 */
export function parseTimecode(timecode) {
    const parts = timecode.split(':').map(p => parseFloat(p));

    if (parts.length === 4) {
        // HH:MM:SS:FF (frames at 30fps)
        return parts[0] * 3600 + parts[1] * 60 + parts[2] + parts[3] / 30;
    } else if (parts.length === 3) {
        // HH:MM:SS
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    } else if (parts.length === 2) {
        // MM:SS
        return parts[0] * 60 + parts[1];
    }

    return 0;
}

/**
 * Format seconds to timecode
 * Format: HH:MM:SS:FF
 */
export function formatTimecode(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30);

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
}

// ==================== Rendering ====================

/**
 * Render clip properties panel from selected clip state
 */
export function renderClipProperties() {
    const selectedClipId = state.selection.selectedClip;

    if (!selectedClipId) {
        // No clip selected
        elements.selectedClipName.textContent = 'No clip selected';
        disablePropertyInputs();
        return;
    }

    const clip = getClip(selectedClipId);
    if (!clip) {
        elements.selectedClipName.textContent = 'No clip selected';
        disablePropertyInputs();
        return;
    }

    // Enable inputs
    enablePropertyInputs();

    // Update clip name
    const clipName = clip.type === 'video' ? 'Video Clip' :
                     clip.type === 'audio' ? 'Audio Clip' :
                     'Attached Audio';
    elements.selectedClipName.textContent = `${clipName} (${clip.id})`;

    // Update volume
    const volume = clip.volume !== undefined ? clip.volume : 100;
    elements.clipVolume.value = volume;
    elements.clipVolumeValue.textContent = `${volume}%`;

    // Update speed
    const speed = clip.speed !== undefined ? clip.speed : 100;
    elements.clipSpeed.value = speed;
    elements.clipSpeedValue.textContent = `${(speed / 100).toFixed(1)}x`;

    // Update start time
    elements.clipStart.value = formatTimecode(clip.start);

    // Update duration
    elements.clipDuration.value = formatTimecode(clip.duration);

    // Update opacity (video only)
    if (clip.type === 'video') {
        const opacity = clip.opacity !== undefined ? clip.opacity : 100;
        elements.clipOpacity.value = opacity;
        elements.clipOpacityValue.textContent = `${opacity}%`;
        elements.clipOpacity.disabled = false;
    } else {
        elements.clipOpacity.value = 100;
        elements.clipOpacityValue.textContent = '100%';
        elements.clipOpacity.disabled = true;
    }
}

/**
 * Disable all property inputs
 */
function disablePropertyInputs() {
    elements.clipVolume.disabled = true;
    elements.clipSpeed.disabled = true;
    elements.clipStart.disabled = true;
    elements.clipDuration.disabled = true;
    elements.clipOpacity.disabled = true;
}

/**
 * Enable property inputs
 */
function enablePropertyInputs() {
    elements.clipVolume.disabled = false;
    elements.clipSpeed.disabled = false;
    elements.clipStart.disabled = false;
    elements.clipDuration.disabled = false;
    // Opacity enabled/disabled per clip type (handled in renderClipProperties)
}

// ==================== Event Handlers ====================

/**
 * Handle clip volume change
 */
export function handleClipVolumeChange(e) {
    const selectedClipId = state.selection.selectedClip;
    if (!selectedClipId) return;

    const volume = parseInt(e.target.value);

    updateClip(selectedClipId, { volume });
    elements.clipVolumeValue.textContent = `${volume}%`;

    // No need to re-render clip visually for volume
    // Would affect playback only
}

/**
 * Handle clip speed change
 */
export function handleClipSpeedChange(e) {
    const selectedClipId = state.selection.selectedClip;
    if (!selectedClipId) return;

    const speed = parseInt(e.target.value);

    updateClip(selectedClipId, { speed });
    elements.clipSpeedValue.textContent = `${(speed / 100).toFixed(1)}x`;

    // No need to re-render clip visually for speed
    // Would affect playback only
}

/**
 * Handle clip start time change
 */
export function handleClipStartChange(e) {
    const selectedClipId = state.selection.selectedClip;
    if (!selectedClipId) return;

    const timecode = e.target.value;
    const newStart = parseTimecode(timecode);

    if (newStart < 0) {
        showToast('Start time cannot be negative', 'warning');
        renderClipProperties(); // Reset to current value
        return;
    }

    updateClip(selectedClipId, { start: newStart });
    renderClip(selectedClipId);
    showToast('Clip start time updated');
}

/**
 * Handle clip duration change
 */
export function handleClipDurationChange(e) {
    const selectedClipId = state.selection.selectedClip;
    if (!selectedClipId) return;

    const timecode = e.target.value;
    const newDuration = parseTimecode(timecode);

    if (newDuration <= 0) {
        showToast('Duration must be greater than 0', 'warning');
        renderClipProperties(); // Reset to current value
        return;
    }

    updateClip(selectedClipId, { duration: newDuration });
    renderClip(selectedClipId);
    showToast('Clip duration updated');
}

/**
 * Handle clip opacity change
 */
export function handleClipOpacityChange(e) {
    const selectedClipId = state.selection.selectedClip;
    if (!selectedClipId) return;

    const clip = getClip(selectedClipId);
    if (!clip || clip.type !== 'video') return;

    const opacity = parseInt(e.target.value);

    updateClip(selectedClipId, { opacity });
    elements.clipOpacityValue.textContent = `${opacity}%`;

    // Opacity would affect video preview during playback
}

/**
 * Handle normalize audio button (placeholder - requires backend)
 */
export function handleNormalizeAudio() {
    showToast('Normalize Audio requires backend service (not yet implemented)', 'info');
}

/**
 * Handle remove noise button (placeholder - requires backend)
 */
export function handleRemoveNoise() {
    showToast('Remove Noise requires backend service (not yet implemented)', 'info');
}

/**
 * Handle audio ducking toggle (placeholder - requires backend)
 */
export function handleAudioDucking(e) {
    const enabled = e.target.checked;
    showToast(`Audio Ducking requires backend service (not yet implemented)`, 'info');
    e.target.checked = false; // Uncheck since not implemented
}
