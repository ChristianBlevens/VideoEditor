// ==================== Entity Rendering ====================
// Unified rendering functions - read from state, update DOM

import { state } from './state.js';
import { getAllClips, groupClipsByTrack, getClipEdits } from './operations.js';
import { updateAllTimelineElements } from './timeline.js';

// ==================== Clip Rendering ====================

/**
 * Render all clips from state
 * This is the single source of truth for clip DOM representation
 */
export async function renderAllClips() {
    // FIRST: Clear ALL clips from tracks to prevent orphaned clips
    // This is critical for undo/redo when clips move between tracks
    // IMPORTANT: Only remove .clip elements, preserve search markers
    document.querySelectorAll('.track .track-content').forEach(trackContent => {
        trackContent.querySelectorAll('.clip').forEach(clip => clip.remove());
    });

    const trackGroups = groupClipsByTrack();

    // Render clips for each track
    trackGroups.forEach((clips, trackId) => {
        const track = document.querySelector(`[data-track-id="${trackId}"]`);
        if (!track) {
            console.warn(`Track not found: ${trackId}`);
            return;
        }

        const trackContent = track.querySelector('.track-content');
        if (!trackContent) return;

        // Render each clip (skip attached-audio clips - they're hidden)
        clips.forEach(clip => {
            if (clip.type === 'attached-audio') {
                // Don't render attached-audio clips visually
                return;
            }
            const clipElement = createClipElement(clip);
            trackContent.appendChild(clipElement);
        });
    });

    // After DOM update, position all clips using timeline system
    updateAllTimelineElements();

    // Re-render all action indicators (they were cleared when clips were removed)
    await rerenderAllActionIndicators();

    // Re-render search markers (they were cleared when clips were removed)
    await rerenderSearchMarkers();
}

/**
 * Re-render all action indicators after clips are re-rendered
 */
async function rerenderAllActionIndicators() {
    const { renderAllTrackActions } = await import('./track-actions.js');
    renderAllTrackActions();
}

/**
 * Re-render search markers after clips are re-rendered
 */
async function rerenderSearchMarkers() {
    const { renderSearchMarkersOnTimeline } = await import('./transcript.js');
    await renderSearchMarkersOnTimeline();
}

/**
 * Render a single clip (update existing or create new)
 * @param {string} clipId
 */
export function renderClip(clipId) {
    const clip = state.project.clips.get(clipId);
    if (!clip) return;

    // Find existing element or create new
    let clipElement = document.querySelector(`[data-clip-id="${clipId}"]`);

    if (clipElement) {
        // Update existing element
        updateClipElement(clipElement, clip);
    } else {
        // Create new element and append to track
        const track = document.querySelector(`[data-track-id="${clip.trackId}"]`);
        if (!track) return;

        const trackContent = track.querySelector('.track-content');
        if (!trackContent) return;

        clipElement = createClipElement(clip);
        trackContent.appendChild(clipElement);
    }

    // Position using timeline system
    updateAllTimelineElements();
}

/**
 * Create a clip DOM element from data
 * @param {Object} clip - Clip data
 * @returns {HTMLElement}
 */
function createClipElement(clip) {
    const el = document.createElement('div');
    el.className = 'clip';

    // Add type-specific classes
    if (clip.type === 'video') {
        el.classList.add('video-clip');
    } else if (clip.type === 'audio') {
        el.classList.add('audio-clip');
    } else if (clip.type === 'attached-audio') {
        el.classList.add('audio-clip', 'attached-audio-clip');
    }

    // Add muted state (red tint)
    if (clip.isMuted) {
        el.classList.add('muted');
    }

    // Add selection state
    if (state.selection.selectedClip === clip.id) {
        el.classList.add('selected');
    }

    // Store data in attributes (timeline system reads these)
    el.setAttribute('data-clip-id', clip.id);
    el.setAttribute('data-start', clip.start);
    el.setAttribute('data-duration', clip.duration);

    // For attached audio, store parent reference
    if (clip.parentClipId) {
        el.setAttribute('data-parent-clip', clip.parentClipId);
    }

    // Build content structure
    const content = document.createElement('div');
    content.className = 'clip-content';

    // Clip name/label
    const name = document.createElement('span');
    name.className = 'clip-name';
    const defaultName = clip.type === 'video' ? 'Video Clip' :
                        clip.type === 'audio' ? 'Audio Clip' :
                        'Audio';
    name.textContent = clip.name || defaultName;

    content.appendChild(name);

    // Video-specific elements
    if (clip.type === 'video') {
        const filmstrip = document.createElement('div');
        filmstrip.className = 'clip-filmstrip';

        // Add waveform inside filmstrip for video clips
        const waveform = document.createElement('div');
        waveform.className = 'waveform';
        waveform.style.display = state.timeline.showWaveforms ? 'block' : 'none';
        filmstrip.appendChild(waveform);

        content.appendChild(filmstrip);

        const highlights = document.createElement('div');
        highlights.className = 'clip-highlights';
        content.appendChild(highlights);
    }

    // Audio clips - same structure as video clips (filmstrip with waveform)
    if (clip.type === 'audio' || clip.type === 'attached-audio') {
        const filmstrip = document.createElement('div');
        filmstrip.className = 'clip-filmstrip';

        const waveform = document.createElement('div');
        waveform.className = 'waveform';
        waveform.style.display = state.timeline.showWaveforms ? 'block' : 'none';
        filmstrip.appendChild(waveform);

        content.appendChild(filmstrip);
    }

    el.appendChild(content);

    // Resize handles as siblings to content (not for attached audio)
    if (clip.type !== 'attached-audio') {
        const leftHandle = document.createElement('div');
        leftHandle.className = 'clip-handle clip-handle-left';
        el.appendChild(leftHandle);

        const rightHandle = document.createElement('div');
        rightHandle.className = 'clip-handle clip-handle-right';
        el.appendChild(rightHandle);
    }

    // Render edits for this clip
    renderClipEdits(clip.id, content);

    return el;
}

/**
 * Update an existing clip element with new data
 * @param {HTMLElement} element
 * @param {Object} clip
 */
function updateClipElement(element, clip) {
    // Update data attributes
    element.setAttribute('data-start', clip.start);
    element.setAttribute('data-duration', clip.duration);

    // Update muted state
    element.classList.toggle('muted', clip.isMuted === true);

    // Update selection state
    element.classList.toggle('selected', state.selection.selectedClip === clip.id);

    // Update name if needed
    const name = element.querySelector('.clip-name');
    if (name) {
        const defaultName = clip.type === 'video' ? 'Video Clip' :
                            clip.type === 'audio' ? 'Audio Clip' :
                            'Audio';
        name.textContent = clip.name || defaultName;
    }

    // Update edits
    const content = element.querySelector('.clip-content');
    if (content) {
        renderClipEdits(clip.id, content);
    }
}

/**
 * Render edit indicators for a clip
 * @param {string} clipId
 * @param {HTMLElement} contentElement
 */
function renderClipEdits(clipId, contentElement) {
    // Remove existing indicators
    const existing = contentElement.querySelector('.edit-indicators');
    if (existing) existing.remove();

    // Get edits from state
    const edits = getClipEdits(clipId);
    if (edits.length === 0) return;

    // Create container
    const container = document.createElement('div');
    container.className = 'edit-indicators';

    // Create indicator for each edit
    edits.forEach(edit => {
        const indicator = createEditIndicator(edit);
        container.appendChild(indicator);
    });

    contentElement.appendChild(container);
}

/**
 * Create an edit indicator element
 * @param {Object} edit
 * @returns {HTMLElement}
 */
function createEditIndicator(edit) {
    const indicator = document.createElement('div');
    indicator.className = `edit-indicator edit-${edit.type}`;
    indicator.setAttribute('data-edit-id', edit.id);

    // Icon based on type
    const iconMap = {
        'cut': 'fa-cut',
        'delete': 'fa-times',
        'move': 'fa-arrows-alt',
        'mute': 'fa-volume-mute',
        'isolate': 'fa-filter'
    };
    const icon = iconMap[edit.type] || 'fa-edit';

    indicator.innerHTML = `
        <i class="fas ${icon}"></i>
        <span class="edit-indicator-tooltip">${edit.description} - Click to undo</span>
    `;

    return indicator;
}

// ==================== Marker Rendering ====================

/**
 * Render all markers from state
 */
export function renderAllMarkers() {
    const container = document.getElementById('markers-track-content');
    if (!container) return;

    // Clear existing
    container.innerHTML = '';

    // Render each marker
    state.project.markers.forEach(marker => {
        const markerElement = createMarkerElement(marker);
        container.appendChild(markerElement);
    });

    // Position using timeline system
    updateAllTimelineElements();
}

/**
 * Create a marker DOM element from data
 * @param {Object} marker
 * @returns {HTMLElement}
 */
function createMarkerElement(marker) {
    const el = document.createElement('div');
    el.className = 'marker';
    el.setAttribute('data-time', marker.time);
    el.setAttribute('data-comment', marker.comment);

    el.innerHTML = `
        <i class="fas fa-flag"></i>
        <span class="marker-comment">${marker.comment}</span>
    `;

    return el;
}

// ==================== Transcript Rendering ====================

/**
 * Render all transcript segments from state
 */
export function renderAllTranscripts() {
    const container = document.querySelector('.transcript-track .track-content');
    if (!container) return;

    // Clear existing
    container.innerHTML = '';

    // Render each segment
    state.project.transcripts.forEach(segment => {
        const segmentElement = createTranscriptElement(segment);
        container.appendChild(segmentElement);
    });

    // Position using timeline system
    updateAllTimelineElements();
}

/**
 * Create a transcript segment DOM element from data
 * @param {Object} transcript
 * @returns {HTMLElement}
 */
function createTranscriptElement(transcript) {
    const el = document.createElement('div');
    el.className = 'transcript-segment-marker';
    el.setAttribute('data-start', transcript.start);
    el.setAttribute('data-duration', transcript.duration);
    el.setAttribute('data-text', transcript.text);
    el.title = transcript.text;

    const textSpan = document.createElement('span');
    textSpan.className = 'segment-text';
    textSpan.textContent = transcript.text.substring(0, 50) + (transcript.text.length > 50 ? '...' : '');

    el.appendChild(textSpan);

    return el;
}

// ==================== Unified Render All ====================

/**
 * Render everything from state
 * Use this after major state changes or loading a project
 */
export function renderAll() {
    renderAllClips();
    renderAllMarkers();
    // NOTE: Transcripts are now attached to clips, not rendered on a separate track
}

// ==================== Clip Renaming ====================

/**
 * Start renaming a clip
 * @param {string} clipId
 * @param {HTMLElement} nameElement
 */
export async function startClipRename(clipId, nameElement) {
    const { getClip, updateClip } = await import('./operations.js');
    const clip = getClip(clipId);
    if (!clip) return;

    const currentName = nameElement.textContent;

    // Create input field
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'clip-name-input';
    input.style.cssText = `
        font-size: 12px;
        font-weight: 700;
        color: white;
        background: rgba(0, 0, 0, 0.5);
        border: 1px solid var(--accent-primary);
        border-radius: 3px;
        padding: 2px 4px;
        width: 100%;
        outline: none;
    `;

    // Replace name with input
    nameElement.style.display = 'none';
    nameElement.parentElement.insertBefore(input, nameElement);

    // Select all text
    input.focus();
    input.select();

    // Save function
    const saveName = () => {
        const newName = input.value.trim();
        if (newName && newName !== currentName) {
            updateClip(clipId, { name: newName });
            nameElement.textContent = newName;
        } else {
            nameElement.textContent = currentName;
        }

        // Remove input and show name
        input.remove();
        nameElement.style.display = '';
    };

    // Save on Enter or blur
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveName();
        } else if (e.key === 'Escape') {
            input.value = currentName;
            saveName();
        }
    });

    input.addEventListener('blur', saveName);
}
