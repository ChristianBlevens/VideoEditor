/**
 * Incremental Rendering System
 *
 * Provides efficient incremental DOM updates instead of recreating everything.
 * Tracks which clips have changed and only updates those elements.
 */

import { eventBus, Events } from '../core/event-bus.js';

/**
 * ClipRenderer - manages rendering of individual clips
 */
export class IncrementalRenderer {
    constructor() {
        this.renderedClips = new Map(); // clipId -> DOMElement
        this.pendingUpdates = new Set(); // Set of clipIds that need re-rendering
        this.renderScheduled = false;
        this.renderCallbacks = new Map(); // clipType -> render function

        // Subscribe to state changes
        this.setupStateSubscriptions();
    }

    /**
     * Setup subscriptions to state changes
     */
    setupStateSubscriptions() {
        // Listen for clip changes
        eventBus.on(Events.STATE_CLIP_ADDED, ({ clipId, clip }) => {
            this.scheduleClipRender(clipId);
        });

        eventBus.on(Events.STATE_CLIP_UPDATED, ({ clipId, clip }) => {
            this.scheduleClipRender(clipId);
        });

        eventBus.on(Events.STATE_CLIP_DELETED, ({ clipId }) => {
            this.removeClip(clipId);
        });

        // Listen for timeline changes that affect all clips
        eventBus.on(Events.TIMELINE_ZOOM, () => {
            this.scheduleFullRender();
        });
    }

    /**
     * Register a render callback for a clip type
     * @param {string} clipType - Type of clip ('video', 'audio', etc.)
     * @param {Function} callback - Render function (clip) => HTMLElement
     */
    registerRenderer(clipType, callback) {
        this.renderCallbacks.set(clipType, callback);
    }

    /**
     * Schedule a single clip for re-rendering
     * @param {string} clipId - ID of clip to render
     */
    scheduleClipRender(clipId) {
        this.pendingUpdates.add(clipId);
        this.scheduleRender();
    }

    /**
     * Schedule all clips for re-rendering
     */
    scheduleFullRender() {
        // Will be populated with all clips during render
        this.pendingUpdates.clear();
        this.pendingUpdates.add('__FULL_RENDER__');
        this.scheduleRender();
    }

    /**
     * Schedule a render on the next animation frame
     */
    scheduleRender() {
        if (this.renderScheduled) return;

        this.renderScheduled = true;
        requestAnimationFrame(() => {
            this.render();
            this.renderScheduled = false;
        });
    }

    /**
     * Perform the actual rendering
     */
    render() {
        if (this.pendingUpdates.size === 0) return;

        // Check if full render is needed
        const fullRender = this.pendingUpdates.has('__FULL_RENDER__');

        if (fullRender) {
            this.renderAll();
        } else {
            // Incremental render: only update changed clips
            for (const clipId of this.pendingUpdates) {
                this.renderClip(clipId);
            }
        }

        this.pendingUpdates.clear();

        // Emit render complete event
        eventBus.emit(Events.RENDER_COMPLETE);
    }

    /**
     * Render a single clip
     * @param {string} clipId - ID of clip to render
     */
    renderClip(clipId, clip, state) {
        // Get clip from state if not provided
        if (!clip && state) {
            clip = state.project.clips.get(clipId);
        }

        if (!clip) {
            console.warn(`[IncrementalRenderer] Clip ${clipId} not found`);
            return;
        }

        // Get renderer for this clip type
        const renderer = this.renderCallbacks.get(clip.type);
        if (!renderer) {
            console.warn(`[IncrementalRenderer] No renderer for clip type "${clip.type}"`);
            return;
        }

        // Get or create clip element
        let clipElement = this.renderedClips.get(clipId);
        const isNew = !clipElement;

        if (isNew) {
            // Create new element
            clipElement = renderer(clip);
            clipElement.dataset.clipId = clipId;
            this.renderedClips.set(clipId, clipElement);

            // Insert into DOM
            this.insertClipIntoDOM(clip, clipElement);
        } else {
            // Update existing element
            const newElement = renderer(clip);

            // Copy attributes and content
            this.updateElement(clipElement, newElement);

            // Check if clip moved to different track
            if (clipElement.parentElement?.dataset.trackId !== clip.trackId) {
                this.insertClipIntoDOM(clip, clipElement);
            }
        }

        return clipElement;
    }

    /**
     * Insert a clip element into the correct track
     */
    insertClipIntoDOM(clip, clipElement) {
        const trackElement = document.querySelector(`[data-track-id="${clip.trackId}"] .track-content`);
        if (!trackElement) {
            console.warn(`[IncrementalRenderer] Track ${clip.trackId} not found`);
            return;
        }

        // Remove from old parent if exists
        if (clipElement.parentElement) {
            clipElement.remove();
        }

        // Insert in correct position (sorted by start time)
        const clips = Array.from(trackElement.querySelectorAll('.clip'));
        let inserted = false;

        for (const existingClip of clips) {
            const existingStart = parseFloat(existingClip.dataset.start || 0);
            if (clip.start < existingStart) {
                trackElement.insertBefore(clipElement, existingClip);
                inserted = true;
                break;
            }
        }

        if (!inserted) {
            trackElement.appendChild(clipElement);
        }
    }

    /**
     * Update an existing element with new content
     */
    updateElement(oldElement, newElement) {
        // Copy all attributes
        for (const attr of newElement.attributes) {
            oldElement.setAttribute(attr.name, attr.value);
        }

        // Copy classes
        oldElement.className = newElement.className;

        // Copy styles
        oldElement.style.cssText = newElement.style.cssText;

        // Update innerHTML if different
        if (oldElement.innerHTML !== newElement.innerHTML) {
            oldElement.innerHTML = newElement.innerHTML;
        }
    }

    /**
     * Remove a clip from rendering
     */
    removeClip(clipId) {
        const clipElement = this.renderedClips.get(clipId);
        if (clipElement) {
            clipElement.remove();
            this.renderedClips.delete(clipId);
        }
    }

    /**
     * Render all clips (full render)
     */
    renderAll(state) {
        if (!state) {
            console.warn('[IncrementalRenderer] Cannot render all: state not provided');
            return;
        }

        // Clear all tracks
        document.querySelectorAll('.track-content').forEach(track => {
            track.innerHTML = '';
        });

        // Clear rendered clips map
        this.renderedClips.clear();

        // Render all clips
        for (const [clipId, clip] of state.project.clips) {
            this.renderClip(clipId, clip, state);
        }
    }

    /**
     * Clear all rendered clips
     */
    clear() {
        for (const clipElement of this.renderedClips.values()) {
            clipElement.remove();
        }
        this.renderedClips.clear();
        this.pendingUpdates.clear();
    }

    /**
     * Get rendered element for a clip
     */
    getClipElement(clipId) {
        return this.renderedClips.get(clipId);
    }

    /**
     * Check if a clip is currently rendered
     */
    isRendered(clipId) {
        return this.renderedClips.has(clipId);
    }
}

/**
 * Utility function to create clip element
 */
export function createClipElement(clip, pixelsPerSecond) {
    const clipElement = document.createElement('div');
    clipElement.className = `clip ${clip.type}-clip`;
    clipElement.dataset.clipId = clip.id;
    clipElement.dataset.start = clip.start;
    clipElement.dataset.duration = clip.duration;
    clipElement.dataset.type = clip.type;

    // Set position and size
    const left = clip.start * pixelsPerSecond;
    const width = clip.duration * pixelsPerSecond;

    clipElement.style.left = `${left}px`;
    clipElement.style.width = `${width}px`;

    // Add clip content
    const clipContent = document.createElement('div');
    clipContent.className = 'clip-content';

    // Add label
    const label = document.createElement('span');
    label.className = 'clip-label';
    label.textContent = clip.src ? clip.src.split('/').pop() : `${clip.type} ${clip.id}`;
    clipContent.appendChild(label);

    clipElement.appendChild(clipContent);

    // Add resize handles
    const leftHandle = document.createElement('div');
    leftHandle.className = 'clip-handle clip-handle-left';
    clipElement.appendChild(leftHandle);

    const rightHandle = document.createElement('div');
    rightHandle.className = 'clip-handle clip-handle-right';
    clipElement.appendChild(rightHandle);

    return clipElement;
}

// Create and export singleton
export const incrementalRenderer = new IncrementalRenderer();
