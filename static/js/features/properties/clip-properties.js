// ==================== Clip Properties Management ====================
// Data-driven clip property operations and rendering

import { state } from '../../core/state.js';
import { elements } from '../../rendering/dom-cache.js';
import { getClip, updateClip } from '../../operations/operations.js';
import { renderClip } from '../../rendering/rendering.js';
import { showToast } from '../../ui/ui-utils.js';
import { api } from '../../api/api-client.js';

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
 * Render clip properties panel from selected clip(s) state
 */
export function renderClipProperties() {
    const selectedCount = state.selection.selectedClips.length;

    if (selectedCount === 0) {
        // No clip selected
        elements.selectedClipName.value = 'No clip selected';
        elements.selectedClipName.readOnly = true;
        disablePropertyInputs();
        return;
    }

    if (selectedCount > 1) {
        // Multiple clips selected
        elements.selectedClipName.value = `${selectedCount} clips selected`;
        elements.selectedClipName.readOnly = true;
        enablePropertyInputs();
        // Show properties of first clip
        const firstClip = getClip(state.selection.selectedClips[0]);
        if (firstClip) {
            loadClipProperties(firstClip);
        }
        return;
    }

    // Single clip selected
    const clip = getClip(state.selection.selectedClips[0]);
    if (!clip) {
        elements.selectedClipName.value = 'No clip selected';
        elements.selectedClipName.readOnly = true;
        disablePropertyInputs();
        return;
    }

    // Enable inputs
    enablePropertyInputs();

    // Update clip name (show clip.name or default) and make editable
    const clipName = clip.name || `Clip ${clip.id}`;
    elements.selectedClipName.value = clipName;
    elements.selectedClipName.readOnly = false;

    loadClipProperties(clip);
}

/**
 * Load clip properties into UI controls
 */
function loadClipProperties(clip) {
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
 * Handle clip volume change (applies to all selected clips)
 */
export function handleClipVolumeChange(e) {
    if (state.selection.selectedClips.length === 0) return;

    const volume = parseInt(e.target.value);

    // Apply to all selected clips
    state.selection.selectedClips.forEach(clipId => {
        updateClip(clipId, { volume });
    });

    elements.clipVolumeValue.textContent = `${volume}%`;

    // No need to re-render clip visually for volume
    // Would affect playback only
}

/**
 * Handle clip speed change (applies to all selected clips)
 */
export function handleClipSpeedChange(e) {
    if (state.selection.selectedClips.length === 0) return;

    const speed = parseInt(e.target.value);

    // Apply to all selected clips
    state.selection.selectedClips.forEach(clipId => {
        updateClip(clipId, { speed });
    });

    elements.clipSpeedValue.textContent = `${(speed / 100).toFixed(1)}x`;

    // No need to re-render clip visually for speed
    // Would affect playback only
}

/**
 * Handle clip start time change (only affects first selected clip)
 */
export function handleClipStartChange(e) {
    if (state.selection.selectedClips.length === 0) return;

    const timecode = e.target.value;
    const newStart = parseTimecode(timecode);

    if (newStart < 0) {
        showToast('Start time cannot be negative', 'warning');
        renderClipProperties(); // Reset to current value
        return;
    }

    // Only update first selected clip
    const clipId = state.selection.selectedClips[0];
    updateClip(clipId, { start: newStart });
    renderClip(clipId);

    const msg = state.selection.selectedClips.length > 1 ? 'First clip start time updated' : 'Clip start time updated';
    showToast(msg);
}

/**
 * Handle clip duration change (only affects first selected clip)
 */
export function handleClipDurationChange(e) {
    if (state.selection.selectedClips.length === 0) return;

    const timecode = e.target.value;
    const newDuration = parseTimecode(timecode);

    if (newDuration <= 0) {
        showToast('Duration must be greater than 0', 'warning');
        renderClipProperties(); // Reset to current value
        return;
    }

    // Only update first selected clip
    const clipId = state.selection.selectedClips[0];
    updateClip(clipId, { duration: newDuration });
    renderClip(clipId);

    const msg = state.selection.selectedClips.length > 1 ? 'First clip duration updated' : 'Clip duration updated';
    showToast(msg);
}

/**
 * Handle clip opacity change (applies to all selected video clips)
 */
export function handleClipOpacityChange(e) {
    if (state.selection.selectedClips.length === 0) return;

    const opacity = parseInt(e.target.value);

    // Apply to all selected video clips
    state.selection.selectedClips.forEach(clipId => {
        const clip = getClip(clipId);
        if (clip && clip.type === 'video') {
            updateClip(clipId, { opacity });
        }
    });

    elements.clipOpacityValue.textContent = `${opacity}%`;

    // Opacity would affect video preview during playback
}

/**
 * Handle normalize audio button (works on first selected clip)
 */
export async function handleNormalizeAudio() {
    if (state.selection.selectedClips.length === 0) {
        showToast('No clip selected', 'warning');
        return;
    }

    // Work on first selected clip
    const clip = getClip(state.selection.selectedClips[0]);
    if (!clip || !clip.src) {
        showToast('Clip has no audio source', 'warning');
        return;
    }

    try {
        showToast('Normalizing audio...', 'info');
        // Pass clip timing for segment extraction
        const result = await api.normalizeAudio(
            clip.src,
            clip.start,      // Clip start time
            clip.duration    // Clip duration
        );

        if (result.success && result.output_path) {
            updateClip(state.selection.selectedClips[0], { src: result.output_path });
            showToast('Audio normalized successfully');
        } else {
            showToast('Audio normalization failed', 'error');
        }
    } catch (error) {
        console.error('[NORMALIZE AUDIO] Error:', error);
        showToast(`Audio normalization failed: ${error.message}`, 'error');
    }
}

/**
 * Handle remove noise button (works on first selected clip)
 */
export async function handleRemoveNoise() {
    if (state.selection.selectedClips.length === 0) {
        showToast('No clip selected', 'warning');
        return;
    }

    // Work on first selected clip
    const clip = getClip(state.selection.selectedClips[0]);
    if (!clip || !clip.src) {
        showToast('Clip has no audio source', 'warning');
        return;
    }

    try {
        showToast('Removing background noise...', 'info');
        // Pass clip timing for segment extraction
        const result = await api.removeNoise(
            clip.src,
            'medium',
            clip.start,      // Clip start time
            clip.duration    // Clip duration
        );

        if (result.success && result.output_path) {
            updateClip(state.selection.selectedClips[0], { src: result.output_path });
            showToast('Background noise removed successfully');
        } else {
            showToast('Noise removal failed', 'error');
        }
    } catch (error) {
        console.error('[REMOVE NOISE] Error:', error);
        showToast(`Noise removal failed: ${error.message}`, 'error');
    }
}

/**
 * Handle audio ducking toggle
 *
 * Audio ducking is a timeline-based feature that automatically lowers
 * the volume of background tracks when speech is detected.
 */
export function handleAudioDucking(e) {
    const enabled = e.target.checked;

    if (state.selection.selectedClips.length === 0) {
        showToast('No clip selected', 'warning');
        e.target.checked = false;
        return;
    }

    // Show/hide ducking settings
    const duckingSettings = document.getElementById('ducking-settings');
    const duckingMethod = document.getElementById('ducking-method');
    if (duckingSettings && duckingMethod) {
        duckingSettings.style.display = enabled ? 'block' : 'none';
        duckingMethod.style.display = enabled ? 'block' : 'none';
    }

    // Update clip metadata
    state.selection.selectedClips.forEach(clipId => {
        const clip = getClip(clipId);
        if (clip) {
            updateClip(clipId, { audioDucking: enabled });
        }
    });

    const status = enabled ? 'enabled' : 'disabled';
    showToast(`Auto Duck ${status} - Other tracks will be lowered during speech`, 'info');
}

/**
 * Handle ducking reduction amount change
 */
export function handleDuckingReductionChange(e) {
    const reductionDb = parseInt(e.target.value);
    const valueDisplay = document.getElementById('ducking-reduction-value');
    if (valueDisplay) {
        valueDisplay.textContent = `${reductionDb} dB`;
    }

    // Update ducking configuration
    import('../audio/audio-ducking.js').then(module => {
        module.setDuckingConfig({ reductionDb });
    });
}

/**
 * Handle ducking detection method change
 */
export function handleDuckingMethodChange(e) {
    const method = e.target.value;
    showToast(`Ducking detection: ${method}`, 'info');
    // Method is read by isSpeechAtTime() in audio-ducking.js
}

// ==================== Initialization ====================

/**
 * Handle clip name change
 */
export function handleClipNameChange(e) {
    if (state.selection.selectedClips.length !== 1) return;

    const newName = e.target.value.trim();
    if (!newName) {
        // Don't allow empty names
        renderClipProperties();
        return;
    }

    const clipId = state.selection.selectedClips[0];
    const clip = getClip(clipId);
    if (!clip) return;

    // Check if name actually changed
    if (clip.name === newName) return;

    updateClip(clipId, { name: newName });

    // Update the clip rendering in viewport
    import('../../rendering/rendering.js').then(({ renderClip }) => {
        renderClip(clipId);
    });

    // Update other tabs that show the clip name
    import('../transcripts/transcript.js').then(({ updateTranscriptForSelectedClip }) => {
        updateTranscriptForSelectedClip();
    });
    import('../subtitles/subtitle-system.js').then(({ loadSubtitleSettingsForSelectedClip }) => {
        loadSubtitleSettingsForSelectedClip();
    });

    showToast(`Clip renamed to: ${newName}`, 'success', 1500);
}

/**
 * Initialize clip properties event listeners
 */
export function initializeClipProperties() {
    // Clip name editing
    if (elements.selectedClipName) {
        elements.selectedClipName.addEventListener('change', handleClipNameChange);
        // Also handle blur to save name when clicking away
        elements.selectedClipName.addEventListener('blur', handleClipNameChange);
    }

    // Volume
    if (elements.clipVolume) {
        elements.clipVolume.addEventListener('input', handleClipVolumeChange);
    }

    // Speed
    if (elements.clipSpeed) {
        elements.clipSpeed.addEventListener('input', handleClipSpeedChange);
    }

    // Start time
    if (elements.clipStart) {
        elements.clipStart.addEventListener('change', handleClipStartChange);
    }

    // Duration
    if (elements.clipDuration) {
        elements.clipDuration.addEventListener('change', handleClipDurationChange);
    }

    // Opacity
    if (elements.clipOpacity) {
        elements.clipOpacity.addEventListener('input', handleClipOpacityChange);
    }

    // Normalize Audio button
    if (elements.normalizeAudioBtn) {
        elements.normalizeAudioBtn.addEventListener('click', handleNormalizeAudio);
    }

    // Remove Noise button
    if (elements.removeNoiseBtn) {
        elements.removeNoiseBtn.addEventListener('click', handleRemoveNoise);
    }

    // Audio Ducking checkbox
    if (elements.audioDuckingCheckbox) {
        elements.audioDuckingCheckbox.addEventListener('change', handleAudioDucking);
    }

    // Ducking reduction slider
    const duckingReductionSlider = document.getElementById('ducking-reduction');
    if (duckingReductionSlider) {
        duckingReductionSlider.addEventListener('input', handleDuckingReductionChange);
    }

    // Ducking detection method
    const duckingMethodSelect = document.getElementById('ducking-detect-method');
    if (duckingMethodSelect) {
        duckingMethodSelect.addEventListener('change', handleDuckingMethodChange);
    }

    // Initialize property panel display
    renderClipProperties();
}
