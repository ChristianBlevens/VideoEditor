// ==================== Video Segment Loader ====================
// Handles fetching and buffering video segments for MSE playback

import { state } from '../../core/state.js';
import { api } from '../../api/api-client.js';

/**
 * Segment loader manages video clip fetching and buffering
 */
export class SegmentLoader {
    constructor() {
        this.cache = new Map(); // clipId -> ArrayBuffer
        this.loading = new Set(); // clipIds currently being fetched
        this.bufferWindow = 30; // Seconds to buffer ahead of playhead
    }

    /**
     * Fetch a video clip as ArrayBuffer
     *
     * @param {Object} clip - Clip object with src property
     * @returns {Promise<ArrayBuffer>} - Video data
     */
    async fetchClip(clip) {
        // Check cache first
        if (this.cache.has(clip.id)) {
            console.log(`[SegmentLoader] Using cached clip: ${clip.id}`);
            return this.cache.get(clip.id);
        }

        // Check if already loading
        if (this.loading.has(clip.id)) {
            console.log(`[SegmentLoader] Already loading clip: ${clip.id}`);
            return this.waitForLoad(clip.id);
        }

        console.log(`[SegmentLoader] Fetching clip: ${clip.id} (${clip.src})`);
        this.loading.add(clip.id);

        try {
            // Fetch from backend API
            const url = `${api.baseURL}/api/video/segment/${encodeURIComponent(clip.src)}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`Failed to fetch clip: ${response.statusText}`);
            }

            const arrayBuffer = await response.arrayBuffer();

            // Cache the result
            this.cache.set(clip.id, arrayBuffer);
            this.loading.delete(clip.id);

            console.log(`[SegmentLoader] Loaded clip: ${clip.id} (${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);

            return arrayBuffer;
        } catch (error) {
            this.loading.delete(clip.id);
            console.error(`[SegmentLoader] Error loading clip ${clip.id}:`, error);
            throw error;
        }
    }

    /**
     * Wait for a clip that's currently loading
     *
     * @param {string} clipId - Clip ID
     * @returns {Promise<ArrayBuffer>} - Video data
     */
    async waitForLoad(clipId) {
        // Poll until clip is loaded or loading fails
        return new Promise((resolve, reject) => {
            const checkInterval = setInterval(() => {
                if (this.cache.has(clipId)) {
                    clearInterval(checkInterval);
                    resolve(this.cache.get(clipId));
                } else if (!this.loading.has(clipId)) {
                    // Loading failed or was cancelled
                    clearInterval(checkInterval);
                    reject(new Error(`Clip ${clipId} failed to load`));
                }
            }, 100);

            // Timeout after 30 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                reject(new Error(`Clip ${clipId} load timeout`));
            }, 30000);
        });
    }

    /**
     * Preload clips that are coming up in the timeline
     *
     * @param {number} currentTime - Current timeline time (seconds)
     */
    async preloadUpcoming(currentTime) {
        const videoClips = Array.from(state.project.clips.values())
            .filter(clip => clip.type === 'video')
            .sort((a, b) => a.start - b.start);

        for (const clip of videoClips) {
            const clipEnd = clip.start + clip.duration;

            // Preload clips within buffer window
            if (clip.start <= currentTime + this.bufferWindow && clipEnd >= currentTime) {
                if (!this.cache.has(clip.id) && !this.loading.has(clip.id)) {
                    // Non-blocking preload
                    this.fetchClip(clip).catch(err => {
                        console.warn(`[SegmentLoader] Failed to preload ${clip.id}:`, err);
                    });
                }
            }
        }
    }

    /**
     * Clear old clips from cache that are outside the buffer window
     *
     * @param {number} currentTime - Current timeline time (seconds)
     */
    clearOldSegments(currentTime) {
        const videoClips = Array.from(state.project.clips.values())
            .filter(clip => clip.type === 'video');

        for (const clip of videoClips) {
            const clipEnd = clip.start + clip.duration;

            // Remove clips more than bufferWindow seconds behind playhead
            if (clipEnd < currentTime - this.bufferWindow) {
                if (this.cache.has(clip.id)) {
                    console.log(`[SegmentLoader] Removing old clip from cache: ${clip.id}`);
                    this.cache.delete(clip.id);
                }
            }
        }
    }

    /**
     * Get cache statistics
     *
     * @returns {Object} - Cache stats
     */
    getStats() {
        const cachedSize = Array.from(this.cache.values())
            .reduce((sum, buffer) => sum + buffer.byteLength, 0);

        return {
            cachedClips: this.cache.size,
            loadingClips: this.loading.size,
            cachedSizeMB: (cachedSize / 1024 / 1024).toFixed(2)
        };
    }

    /**
     * Clear entire cache
     */
    clearCache() {
        console.log('[SegmentLoader] Clearing entire cache');
        this.cache.clear();
        this.loading.clear();
    }
}

// Export singleton instance
export const segmentLoader = new SegmentLoader();
