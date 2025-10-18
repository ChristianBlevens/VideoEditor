// ==================== Media Source Extensions Playback Engine ====================
// Core MSE implementation for gapless multi-clip playback

import { state } from '../../core/state.js';
import { segmentLoader } from './segment-loader.js';
import { timelineToMediaSourceTime, mediaSourceToTimelineTime, getTotalMediaSourceDuration } from './time-mapper.js';

/**
 * MSE Playback Engine
 * Manages MediaSource, SourceBuffer, and gapless playback
 */
export class MSEPlaybackEngine {
    constructor(videoElement) {
        this.videoElement = videoElement;
        this.mediaSource = null;
        this.sourceBuffer = null;
        this.audioSourceBuffer = null;
        this.isInitialized = false;
        this.isUpdating = false;
        this.pendingSegments = [];
        this.appendedClips = new Set();
        this.codecString = 'video/mp4; codecs="avc1.42E01E,mp4a.40.2"'; // H.264 + AAC
    }

    /**
     * Initialize MediaSource and attach to video element
     *
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.isInitialized) {
            console.warn('[MSE] Already initialized');
            return;
        }

        console.log('[MSE] Initializing MediaSource...');

        return new Promise((resolve, reject) => {
            try {
                // Create MediaSource
                this.mediaSource = new MediaSource();

                // Attach to video element
                this.videoElement.src = URL.createObjectURL(this.mediaSource);

                // Wait for source to open
                this.mediaSource.addEventListener('sourceopen', async () => {
                    try {
                        console.log('[MSE] MediaSource opened, creating SourceBuffer...');

                        // Check if codec is supported
                        if (!MediaSource.isTypeSupported(this.codecString)) {
                            console.error(`[MSE] Codec not supported: ${this.codecString}`);
                            console.log('[MSE] Trying alternative codec...');

                            // Try alternative codec
                            const altCodec = 'video/mp4; codecs="avc1.64001E,mp4a.40.2"';
                            if (MediaSource.isTypeSupported(altCodec)) {
                                this.codecString = altCodec;
                                console.log(`[MSE] Using alternative codec: ${altCodec}`);
                            } else {
                                throw new Error('No supported video codec found');
                            }
                        }

                        console.log(`[MSE] Using codec: ${this.codecString}`);

                        // Create SourceBuffer
                        this.sourceBuffer = this.mediaSource.addSourceBuffer(this.codecString);

                        // Handle updateend event
                        this.sourceBuffer.addEventListener('updateend', () => {
                            this.isUpdating = false;
                            this.processNextSegment();
                        });

                        // Handle errors
                        this.sourceBuffer.addEventListener('error', (e) => {
                            console.error('[MSE] SourceBuffer error:', e);
                            console.error('[MSE] SourceBuffer state:', {
                                buffered: this.sourceBuffer.buffered,
                                updating: this.sourceBuffer.updating,
                                mode: this.sourceBuffer.mode
                            });
                        });

                        this.isInitialized = true;
                        console.log('[MSE] Initialization complete');
                        resolve();
                    } catch (error) {
                        console.error('[MSE] Failed to create SourceBuffer:', error);
                        reject(error);
                    }
                }, { once: true });

                // Handle errors
                this.mediaSource.addEventListener('error', (e) => {
                    console.error('[MSE] MediaSource error:', e);
                    reject(new Error('MediaSource error'));
                });

            } catch (error) {
                console.error('[MSE] Initialization error:', error);
                reject(error);
            }
        });
    }

    /**
     * Load timeline into MediaSource
     * Appends all video clips in sequence for gapless playback
     *
     * @returns {Promise<void>}
     */
    async loadTimeline() {
        if (!this.isInitialized) {
            await this.initialize();
        }

        console.log('[MSE] Loading timeline...');

        // Get all video clips in order
        const videoClips = Array.from(state.project.clips.values())
            .filter(clip => clip.type === 'video')
            .sort((a, b) => a.start - b.start);

        if (videoClips.length === 0) {
            console.warn('[MSE] No video clips to load');
            return;
        }

        console.log(`[MSE] Loading ${videoClips.length} video clips...`);

        // Clear previously appended clips
        this.appendedClips.clear();

        // Queue all clips for appending
        for (const clip of videoClips) {
            try {
                const buffer = await segmentLoader.fetchClip(clip);
                this.queueSegment(buffer, clip.id);
            } catch (error) {
                console.error(`[MSE] Failed to load clip ${clip.id}:`, error);
            }
        }

        console.log('[MSE] Timeline loaded');
    }

    /**
     * Queue a video segment for appending to SourceBuffer
     *
     * @param {ArrayBuffer} buffer - Video data
     * @param {string} clipId - Clip ID for tracking
     */
    queueSegment(buffer, clipId) {
        this.pendingSegments.push({ buffer, clipId });
        this.processNextSegment();
    }

    /**
     * Process next segment in queue
     */
    processNextSegment() {
        if (this.isUpdating || this.pendingSegments.length === 0) {
            return;
        }

        if (!this.sourceBuffer || this.sourceBuffer.updating) {
            return;
        }

        const { buffer, clipId } = this.pendingSegments.shift();

        try {
            console.log(`[MSE] Appending segment for clip: ${clipId} (${(buffer.byteLength / 1024 / 1024).toFixed(2)} MB)`);

            // Validate buffer before appending
            if (!buffer || buffer.byteLength === 0) {
                console.error(`[MSE] Invalid buffer for ${clipId}: empty or null`);
                this.isUpdating = false;
                this.processNextSegment();
                return;
            }

            this.isUpdating = true;
            this.sourceBuffer.appendBuffer(buffer);
            this.appendedClips.add(clipId);
        } catch (error) {
            console.error(`[MSE] Error appending buffer for ${clipId}:`, error);
            console.error(`[MSE] Buffer size: ${buffer.byteLength} bytes`);
            console.error(`[MSE] SourceBuffer codec: ${this.codecString}`);
            console.error(`[MSE] MediaSource state: ${this.mediaSource.readyState}`);
            this.isUpdating = false;
            this.processNextSegment();
        }
    }

    /**
     * Play the video
     */
    play() {
        if (!this.isInitialized) {
            console.warn('[MSE] Cannot play: not initialized');
            return;
        }

        this.videoElement.play().catch(error => {
            console.error('[MSE] Play error:', error);
        });
    }

    /**
     * Pause the video
     */
    pause() {
        this.videoElement.pause();
    }

    /**
     * Seek to timeline time
     *
     * @param {number} timelineTime - Time in timeline coordinates (seconds)
     */
    seek(timelineTime) {
        if (!this.isInitialized) {
            console.warn('[MSE] Cannot seek: not initialized');
            return;
        }

        const mediaSourceTime = timelineToMediaSourceTime(timelineTime);
        // console.log(`[MSE] Seeking to timeline=${timelineTime}s -> mediaSource=${mediaSourceTime}s`);

        this.videoElement.currentTime = mediaSourceTime;
    }

    /**
     * Get current timeline time
     *
     * @returns {number} - Current time in timeline coordinates
     */
    getCurrentTimelineTime() {
        const mediaSourceTime = this.videoElement.currentTime;
        return mediaSourceToTimelineTime(mediaSourceTime);
    }

    /**
     * Remove buffered segments outside the current window
     *
     * @param {number} currentTime - Current MediaSource time (seconds)
     * @param {number} windowSize - Size of buffer window (seconds)
     */
    cleanupBuffer(currentTime, windowSize = 30) {
        if (!this.sourceBuffer || this.sourceBuffer.updating) {
            return;
        }

        const buffered = this.sourceBuffer.buffered;

        for (let i = 0; i < buffered.length; i++) {
            const start = buffered.start(i);
            const end = buffered.end(i);

            // Remove segments more than windowSize seconds behind playhead
            if (end < currentTime - windowSize) {
                try {
                    console.log(`[MSE] Removing old buffer: ${start}s - ${end}s`);
                    this.sourceBuffer.remove(start, end);
                } catch (error) {
                    console.error('[MSE] Error removing buffer:', error);
                }
            }
        }
    }

    /**
     * Reset and destroy MediaSource
     */
    destroy() {
        console.log('[MSE] Destroying playback engine...');

        if (this.videoElement) {
            this.videoElement.pause();
            this.videoElement.src = '';
        }

        if (this.mediaSource && this.mediaSource.readyState === 'open') {
            this.mediaSource.endOfStream();
        }

        this.sourceBuffer = null;
        this.audioSourceBuffer = null;
        this.mediaSource = null;
        this.isInitialized = false;
        this.pendingSegments = [];
        this.appendedClips.clear();

        console.log('[MSE] Destroyed');
    }

    /**
     * Get playback statistics
     *
     * @returns {Object} - Playback stats
     */
    getStats() {
        const buffered = this.sourceBuffer ? this.sourceBuffer.buffered : null;
        const bufferedRanges = [];

        if (buffered) {
            for (let i = 0; i < buffered.length; i++) {
                bufferedRanges.push({
                    start: buffered.start(i).toFixed(2),
                    end: buffered.end(i).toFixed(2)
                });
            }
        }

        return {
            initialized: this.isInitialized,
            currentTime: this.videoElement.currentTime.toFixed(2),
            timelineTime: this.getCurrentTimelineTime().toFixed(2),
            duration: this.videoElement.duration,
            totalMediaSourceDuration: getTotalMediaSourceDuration(),
            bufferedRanges,
            appendedClips: this.appendedClips.size,
            pendingSegments: this.pendingSegments.length,
            readyState: this.mediaSource ? this.mediaSource.readyState : 'N/A'
        };
    }
}
