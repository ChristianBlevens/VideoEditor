/**
 * Project Media Management
 *
 * Handles media library in left sidebar - files that can be dragged to timeline
 */

import { api } from '../../api/api-client.js';
import { state } from '../../core/state.js';
import { elements } from '../../rendering/dom-cache.js';
import { showToast } from '../../ui/ui-utils.js';
import { createClip } from '../../operations/operations.js';
import { renderAllClips } from '../../rendering/rendering.js';
import { loadTimelineForPlayback } from '../playback/playback.js';
import { resetTimelineBounds, updateViewportRange, generateTimeMarkers, updateAllTimelineElements, updatePlayheadPosition } from '../timeline/timeline.js';

// ==================== Load Media from Backend ====================

/**
 * Load all media files from uploads folder on startup
 */
export async function loadProjectMedia() {
    try {
        const mediaFiles = await api.listMediaFiles();

        // Store in state
        state.project.mediaItems = mediaFiles.map(file => ({
            filename: file.filename,
            path: file.path,
            size: file.size,
            type: file.type,
            createdAt: file.created_at
        }));

        // Render media list
        renderProjectMedia();

    } catch (error) {
        console.error('[Project Media] Failed to load media:', error);
        // Don't show error toast - might be first startup with no files
    }
}

/**
 * Add a newly uploaded file to project media
 */
export function addMediaItem(uploadResult, fileType) {
    const mediaItem = {
        filename: extractFilename(uploadResult.path),
        path: uploadResult.path,
        size: uploadResult.size,
        type: fileType,
        createdAt: Date.now() / 1000
    };

    // Add to beginning (newest first)
    state.project.mediaItems.unshift(mediaItem);

    // Re-render
    renderProjectMedia();
}

/**
 * Extract filename from path
 */
function extractFilename(path) {
    return path.split('/').pop();
}

// ==================== Render Media List ====================

/**
 * Render all media items in the project media panel
 */
export function renderProjectMedia() {
    const mediaList = document.getElementById('media-list');
    if (!mediaList) return;

    // Clear existing items
    mediaList.innerHTML = '';

    if (state.project.mediaItems.length === 0) {
        mediaList.innerHTML = '<p style="padding: 20px; text-align: center; color: #888;">No media files<br>Drag files here or click Import</p>';
        return;
    }

    // Render each media item
    state.project.mediaItems.forEach(item => {
        const itemEl = createMediaItemElement(item);
        mediaList.appendChild(itemEl);
    });
}

/**
 * Create a media item DOM element
 */
function createMediaItemElement(mediaItem) {
    const item = document.createElement('div');
    item.className = 'media-item';
    item.draggable = true;
    item.dataset.filename = mediaItem.filename;
    item.dataset.path = mediaItem.path;
    item.dataset.type = mediaItem.type;

    // Icon based on type
    const icon = mediaItem.type === 'video'
        ? '<i class="fas fa-film"></i>'
        : '<i class="fas fa-music"></i>';

    // Format file size
    const sizeStr = formatFileSize(mediaItem.size);

    item.innerHTML = `
        ${icon}
        <div class="media-item-info">
            <div class="media-item-name">${escapeHtml(extractOriginalName(mediaItem.filename))}</div>
            <div class="media-item-size">${sizeStr}</div>
        </div>
        <button class="media-item-delete" title="Delete file">
            <i class="fas fa-trash"></i>
        </button>
    `;

    // Add drag-drop handlers
    item.addEventListener('dragstart', handleMediaDragStart);

    // Add delete handler
    const deleteBtn = item.querySelector('.media-item-delete');
    deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        deleteMediaItem(mediaItem.filename);
    });

    return item;
}

/**
 * Try to extract original filename from UUID filename
 * Since we don't store original name, we'll just show the UUID
 */
function extractOriginalName(filename) {
    // Could store original names in future, for now just show filename
    return filename;
}

/**
 * Format file size for display
 */
function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== Delete Media ====================

/**
 * Delete a media item from project and backend
 */
async function deleteMediaItem(filename) {
    if (!confirm(`Delete ${filename}?`)) {
        return;
    }

    try {
        // Delete from backend
        await api.deleteMediaFile(filename);

        // Remove from state
        state.project.mediaItems = state.project.mediaItems.filter(
            item => item.filename !== filename
        );

        // Re-render
        renderProjectMedia();

        showToast('File deleted', 'success', 1000);

    } catch (error) {
        showToast(`Failed to delete file: ${error.message}`, 'error');
        console.error('[Project Media] Delete failed:', error);
    }
}

// ==================== Drag-Drop to Timeline ====================

/**
 * Handle drag start from media item
 */
function handleMediaDragStart(e) {
    const item = e.currentTarget;

    // Store data for drop
    e.dataTransfer.setData('media-filename', item.dataset.filename);
    e.dataTransfer.setData('media-path', item.dataset.path);
    e.dataTransfer.setData('media-type', item.dataset.type);
    e.dataTransfer.effectAllowed = 'copy';

    // Visual feedback
    item.classList.add('dragging');
    setTimeout(() => item.classList.remove('dragging'), 0);
}

/**
 * Handle drop on timeline track
 * @param {string} filename - Filename of the media item
 * @param {string} path - Path to the media file
 * @param {string} mediaType - Type of media ('video' or 'audio')
 * @param {string} trackId - Track ID where item was dropped
 * @param {number} timelineTime - Timeline time where item was dropped
 */
export async function handleMediaDropOnTimeline(filename, path, mediaType, trackId, timelineTime) {
    if (!filename || !path) {
        return; // Not a media item drag
    }

    try {
        showToast('Adding to timeline...', 'info');

        // Find the media item in state to check for cached waveform
        let mediaItem = state.project.mediaItems.find(item => item.path === path);

        // Generate waveform only if not already cached
        let waveformData;
        if (mediaItem && mediaItem.waveform) {
            console.log('[WAVEFORM] Using cached waveform for:', filename);
            waveformData = mediaItem.waveform;
        } else {
            console.log('[WAVEFORM] Generating new waveform for:', filename);
            waveformData = await api.generateWaveform(path);

            // Cache waveform in media item
            if (mediaItem) {
                mediaItem.waveform = waveformData;
                console.log('[WAVEFORM] Cached waveform for future use');
            }
        }

        // Generate default clip name
        state.project.clipCounter++;
        const defaultClipName = `Clip ${state.project.clipCounter}`;

        if (mediaType === 'video') {
            // Create video clip at drop position
            const clipId = createClip({
                type: 'video',
                name: defaultClipName,
                src: path,
                start: timelineTime,
                duration: waveformData.duration,
                sourceDuration: waveformData.duration,
                mediaStart: 0,  // Start at beginning of source media
                mediaEnd: waveformData.duration,  // Full duration of source
                trackId: trackId,
                waveform: waveformData.peaks
            });

            // Create attached audio (no name needed)
            createClip({
                type: 'attached-audio',
                parentClipId: clipId,
                src: path,
                start: timelineTime,
                duration: waveformData.duration,
                sourceDuration: waveformData.duration,
                mediaStart: 0,
                mediaEnd: waveformData.duration,
                trackId: `${trackId}-audio`,
                waveform: waveformData.peaks
            });

        } else if (mediaType === 'audio') {
            // Create audio clip at drop position
            createClip({
                type: 'audio',
                name: defaultClipName,
                src: path,
                start: timelineTime,
                duration: waveformData.duration,
                sourceDuration: waveformData.duration,
                mediaStart: 0,
                mediaEnd: waveformData.duration,
                trackId: trackId,
                waveform: waveformData.peaks
            });
        }

        // Render
        await renderAllClips();

        // Update timeline bounds and viewport to include new clip
        resetTimelineBounds();
        updateViewportRange();
        generateTimeMarkers();
        updateAllTimelineElements();
        updatePlayheadPosition();

        // Load timeline into MSE playback engine
        if (state.playback.mseEngine) {
            await loadTimelineForPlayback();
        }

        showToast(`${filename} added to timeline!`, 'success', 1500);

    } catch (error) {
        console.error('[Project Media] Failed to add to timeline:', error);
        showToast(`Failed to add to timeline: ${error.message}`, 'error');
    }
}
