// ==================== Web Audio API Multi-Track Mixer ====================
// Mixes multiple audio tracks (video audio + separate audio clips)

import { state } from '../../core/state.js';

/**
 * Audio Mixer using Web Audio API
 * Handles mixing multiple audio sources with individual volume controls
 */
export class AudioMixer {
    constructor(videoElement) {
        this.videoElement = videoElement;
        this.audioContext = null;
        this.videoSource = null;
        this.audioSources = new Map(); // clipId -> {element, source, gainNode}
        this.masterGain = null;
        this.isInitialized = false;
    }

    /**
     * Initialize Web Audio API context and connect video element
     *
     * @returns {Promise<void>}
     */
    async initialize() {
        if (this.isInitialized) {
            console.warn('[AudioMixer] Already initialized');
            return;
        }

        console.log('[AudioMixer] Initializing Web Audio API...');

        try {
            // Create AudioContext
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Create master gain node
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = state.playback.volume || 1.0;
            this.masterGain.connect(this.audioContext.destination);

            // Connect video element audio
            this.videoSource = this.audioContext.createMediaElementSource(this.videoElement);
            this.videoSource.connect(this.masterGain);

            this.isInitialized = true;
            console.log('[AudioMixer] Initialized successfully');
        } catch (error) {
            console.error('[AudioMixer] Initialization error:', error);
            throw error;
        }
    }

    /**
     * Add an audio clip to the mix
     *
     * @param {Object} clip - Audio clip object with id, src, start, duration
     * @returns {Promise<void>}
     */
    async addAudioClip(clip) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        if (this.audioSources.has(clip.id)) {
            console.warn(`[AudioMixer] Audio clip already added: ${clip.id}`);
            return;
        }

        console.log(`[AudioMixer] Adding audio clip: ${clip.id}`);

        // Create audio element
        const audioElement = new Audio(clip.src);
        audioElement.loop = false;
        audioElement.preload = 'auto';

        // Create nodes
        const source = this.audioContext.createMediaElementSource(audioElement);
        const gainNode = this.audioContext.createGain();

        // Set initial volume
        gainNode.gain.value = clip.volume !== undefined ? clip.volume : 1.0;

        // Connect: source -> gain -> master
        source.connect(gainNode);
        gainNode.connect(this.masterGain);

        // Store references
        this.audioSources.set(clip.id, {
            element: audioElement,
            source,
            gainNode
        });

        // Load audio
        await audioElement.load();

        console.log(`[AudioMixer] Audio clip ready: ${clip.id}`);
    }

    /**
     * Remove an audio clip from the mix
     *
     * @param {string} clipId - Clip ID
     */
    removeAudioClip(clipId) {
        if (!this.audioSources.has(clipId)) {
            return;
        }

        console.log(`[AudioMixer] Removing audio clip: ${clipId}`);

        const { element, source, gainNode } = this.audioSources.get(clipId);

        // Stop and disconnect
        element.pause();
        element.currentTime = 0;
        source.disconnect();
        gainNode.disconnect();

        this.audioSources.delete(clipId);
    }

    /**
     * Update audio clips based on current timeline time
     * Starts/stops audio clips as needed
     *
     * @param {number} currentTime - Current timeline time (seconds)
     */
    updateAudioClips(currentTime) {
        if (!this.isInitialized) {
            return;
        }

        // Get all audio clips
        const audioClips = Array.from(state.project.clips.values())
            .filter(clip => clip.type === 'audio');

        for (const clip of audioClips) {
            const clipStart = clip.start;
            const clipEnd = clip.start + clip.duration;
            const isPlaying = currentTime >= clipStart && currentTime < clipEnd;

            // Add clip if not already in mixer
            if (isPlaying && !this.audioSources.has(clip.id)) {
                this.addAudioClip(clip).catch(err => {
                    console.error(`[AudioMixer] Failed to add clip ${clip.id}:`, err);
                });
            }

            // Update playback state
            if (this.audioSources.has(clip.id)) {
                const { element } = this.audioSources.get(clip.id);
                const offsetIntoClip = currentTime - clipStart;

                if (isPlaying) {
                    // Sync audio element time with timeline
                    if (Math.abs(element.currentTime - offsetIntoClip) > 0.1) {
                        element.currentTime = offsetIntoClip;
                    }

                    if (element.paused && state.playback.isPlaying) {
                        element.play().catch(err => {
                            console.error(`[AudioMixer] Play error for ${clip.id}:`, err);
                        });
                    }
                } else {
                    // Stop audio if outside clip range
                    if (!element.paused) {
                        element.pause();
                    }
                }
            }
        }

        // Remove clips that are no longer needed
        for (const [clipId, { element }] of this.audioSources.entries()) {
            const clip = state.project.clips.get(clipId);
            if (!clip) {
                this.removeAudioClip(clipId);
            }
        }
    }

    /**
     * Set volume for a specific audio clip
     *
     * @param {string} clipId - Clip ID
     * @param {number} volume - Volume (0.0 to 1.0)
     */
    setClipVolume(clipId, volume) {
        if (!this.audioSources.has(clipId)) {
            console.warn(`[AudioMixer] Clip not found: ${clipId}`);
            return;
        }

        const { gainNode } = this.audioSources.get(clipId);
        gainNode.gain.value = Math.max(0, Math.min(1, volume));

        console.log(`[AudioMixer] Set volume for ${clipId}: ${volume}`);
    }

    /**
     * Set master volume
     *
     * @param {number} volume - Volume (0.0 to 1.0)
     */
    setMasterVolume(volume) {
        if (!this.isInitialized) {
            return;
        }

        this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
        state.playback.volume = volume;

        console.log(`[AudioMixer] Master volume: ${volume}`);
    }

    /**
     * Mute/unmute master audio
     *
     * @param {boolean} muted - True to mute
     */
    setMuted(muted) {
        if (!this.isInitialized) {
            return;
        }

        this.masterGain.gain.value = muted ? 0 : (state.playback.volume || 1.0);
        state.playback.isMuted = muted;

        console.log(`[AudioMixer] Muted: ${muted}`);
    }

    /**
     * Play all active audio clips
     */
    play() {
        if (!this.isInitialized) {
            return;
        }

        // Resume AudioContext if suspended
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }

        // Play all active audio clips
        for (const { element } of this.audioSources.values()) {
            if (element.paused) {
                element.play().catch(err => {
                    console.error('[AudioMixer] Play error:', err);
                });
            }
        }
    }

    /**
     * Pause all audio clips
     */
    pause() {
        if (!this.isInitialized) {
            return;
        }

        for (const { element } of this.audioSources.values()) {
            element.pause();
        }
    }

    /**
     * Stop and clear all audio clips
     */
    stopAll() {
        if (!this.isInitialized) {
            return;
        }

        console.log('[AudioMixer] Stopping all audio clips');

        for (const clipId of Array.from(this.audioSources.keys())) {
            this.removeAudioClip(clipId);
        }
    }

    /**
     * Destroy audio mixer and close context
     */
    destroy() {
        console.log('[AudioMixer] Destroying audio mixer...');

        this.stopAll();

        if (this.videoSource) {
            this.videoSource.disconnect();
            this.videoSource = null;
        }

        if (this.masterGain) {
            this.masterGain.disconnect();
            this.masterGain = null;
        }

        if (this.audioContext && this.audioContext.state !== 'closed') {
            this.audioContext.close();
            this.audioContext = null;
        }

        this.isInitialized = false;

        console.log('[AudioMixer] Destroyed');
    }

    /**
     * Get mixer statistics
     *
     * @returns {Object} - Mixer stats
     */
    getStats() {
        return {
            initialized: this.isInitialized,
            audioClips: this.audioSources.size,
            masterVolume: this.masterGain ? this.masterGain.gain.value : 0,
            contextState: this.audioContext ? this.audioContext.state : 'N/A'
        };
    }
}
