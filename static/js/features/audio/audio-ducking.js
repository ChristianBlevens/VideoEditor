/**
 * Audio Ducking System
 *
 * Automatically lowers background audio when speech is detected
 * Uses timeline context to coordinate multiple tracks
 */

import { state } from '../../core/state.js';
import { getClip } from '../../operations/operations.js';

/**
 * Audio ducking configuration
 */
const DUCKING_CONFIG = {
    reductionDb: -12,      // How much to lower background (in dB)
    attackTime: 0.05,      // Fade in time (seconds)
    releaseTime: 0.2,      // Fade out time (seconds)
    threshold: -40         // Audio level threshold for speech detection
};

/**
 * Calculate ducking levels for all clips at given time
 *
 * @param {number} currentTime - Current timeline time
 * @returns {Map} Map of clipId -> volumeMultiplier (0.0-1.0)
 */
export function calculateDuckingAtTime(currentTime) {
    const volumeMultipliers = new Map();

    // Find all clips with ducking enabled (voice/speech clips)
    const duckingClips = [];
    const backgroundClips = [];

    state.project.clips.forEach((clip, clipId) => {
        const clipStart = clip.start;
        const clipEnd = clip.start + clip.duration;

        // Skip clips not at current time
        if (currentTime < clipStart || currentTime >= clipEnd) {
            return;
        }

        if (clip.audioDucking) {
            duckingClips.push({ clipId, clip });
        } else if (clip.type === 'audio' || clip.type === 'attached-audio') {
            backgroundClips.push({ clipId, clip });
        }
    });

    // If no ducking clips, all background at full volume
    if (duckingClips.length === 0) {
        backgroundClips.forEach(({ clipId }) => {
            volumeMultipliers.set(clipId, 1.0);
        });
        return volumeMultipliers;
    }

    // Check if speech is currently happening on any ducking clip
    const isSpeechActive = duckingClips.some(({ clipId, clip }) => {
        return isSpeechAtTime(clipId, clip, currentTime);
    });

    // Calculate ducking multiplier
    const duckingMultiplier = isSpeechActive
        ? dbToLinear(DUCKING_CONFIG.reductionDb)
        : 1.0;

    // Apply to all background clips
    backgroundClips.forEach(({ clipId }) => {
        volumeMultipliers.set(clipId, duckingMultiplier);
    });

    // Voice clips always at full volume
    duckingClips.forEach(({ clipId }) => {
        volumeMultipliers.set(clipId, 1.0);
    });

    return volumeMultipliers;
}

/**
 * Check if speech is happening at current time for a clip
 *
 * Uses transcript word timing or VAD-based detection
 */
function isSpeechAtTime(clipId, clip, currentTime) {
    // Method 1: Use transcript word timing (most accurate)
    const transcript = state.project.transcripts.find(t => t.clipId === clipId);

    if (transcript && transcript.words) {
        const clipRelativeTime = currentTime - clip.start;

        // Check if any word is active at this time
        const hasActiveWord = transcript.words.some(word => {
            return clipRelativeTime >= word.start && clipRelativeTime < word.end;
        });

        if (hasActiveWord) {
            return true;
        }
    }

    // Method 2: VAD-based detection (fallback)
    // Check if clip has VAD data
    if (clip.vadSegments) {
        const clipRelativeTime = currentTime - clip.start;

        const hasActiveSpeech = clip.vadSegments.some(segment => {
            return clipRelativeTime >= segment.start && clipRelativeTime < segment.end;
        });

        if (hasActiveSpeech) {
            return true;
        }
    }

    // Method 3: Simple threshold - if clip is playing, assume speech
    // This is the fallback if no transcript/VAD data
    return true; // Conservative: assume speech when clip is active
}

/**
 * Convert dB to linear gain multiplier
 */
function dbToLinear(db) {
    return Math.pow(10, db / 20);
}

/**
 * Apply ducking to audio context during playback
 *
 * This should be called continuously during playback
 *
 * @param {AudioContext} audioContext - Web Audio API context
 * @param {Map} sourceNodes - Map of clipId -> AudioSourceNode
 * @param {Map} gainNodes - Map of clipId -> GainNode
 * @param {number} currentTime - Current timeline time
 */
export function applyDucking(audioContext, sourceNodes, gainNodes, currentTime) {
    const volumeMultipliers = calculateDuckingAtTime(currentTime);

    volumeMultipliers.forEach((multiplier, clipId) => {
        const gainNode = gainNodes.get(clipId);
        if (!gainNode) return;

        const clip = getClip(clipId);
        if (!clip) return;

        // Base volume from clip settings
        const baseVolume = (clip.volume || 100) / 100;

        // Final volume = base * ducking multiplier
        const finalVolume = baseVolume * multiplier;

        // Smooth transition using rampToValueAtTime
        const now = audioContext.currentTime;
        gainNode.gain.cancelScheduledValues(now);
        gainNode.gain.setValueAtTime(gainNode.gain.value, now);
        gainNode.gain.linearRampToValueAtTime(
            finalVolume,
            now + DUCKING_CONFIG.attackTime
        );
    });
}

/**
 * Create ducking visualization overlay
 *
 * Shows when ducking is active on timeline
 */
export function renderDuckingIndicators() {
    const timelineWrapper = document.getElementById('timeline-wrapper');
    if (!timelineWrapper) return;

    // Remove old indicators
    timelineWrapper.querySelectorAll('.ducking-indicator').forEach(el => el.remove());

    // Find all clips with ducking enabled
    state.project.clips.forEach((clip, clipId) => {
        if (!clip.audioDucking) return;

        const clipElement = document.querySelector(`[data-clip-id="${clipId}"]`);
        if (!clipElement) return;

        // Add ducking indicator badge
        const indicator = document.createElement('div');
        indicator.className = 'ducking-indicator';
        indicator.innerHTML = '<i class="fas fa-volume-down"></i>';
        indicator.title = 'Auto Duck Enabled';

        clipElement.appendChild(indicator);
    });
}

/**
 * Update ducking configuration
 */
export function setDuckingConfig(config) {
    Object.assign(DUCKING_CONFIG, config);
}

/**
 * Get current ducking configuration
 */
export function getDuckingConfig() {
    return { ...DUCKING_CONFIG };
}
