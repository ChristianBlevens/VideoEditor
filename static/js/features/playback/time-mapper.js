// ==================== Timeline ↔ MediaSource Time Mapping ====================
// Maps between timeline time (with gaps) and MediaSource time (continuous)

import { state } from '../../core/state.js';

/**
 * Convert timeline time to MediaSource time
 * Timeline time includes gaps between clips, MediaSource time is continuous
 *
 * @param {number} timelineTime - Time in timeline coordinates (seconds)
 * @returns {number} - Time in MediaSource coordinates (seconds)
 */
export function timelineToMediaSourceTime(timelineTime) {
    const videoClips = getVideoClipsInOrder();

    if (videoClips.length === 0) {
        return 0;
    }

    let mediaSourceOffset = 0;

    for (const clip of videoClips) {
        const clipEnd = clip.start + clip.duration;

        // If timeline time is within this clip
        if (timelineTime >= clip.start && timelineTime < clipEnd) {
            const offsetIntoClip = timelineTime - clip.start;
            return mediaSourceOffset + offsetIntoClip;
        }

        // If timeline time is in a gap before this clip, clamp to previous clip end
        if (timelineTime < clip.start) {
            return mediaSourceOffset;
        }

        // Move to next clip
        mediaSourceOffset += clip.duration;
    }

    // If timeline time is after all clips, return total MediaSource duration
    return mediaSourceOffset;
}

/**
 * Convert MediaSource time to timeline time
 *
 * @param {number} mediaSourceTime - Time in MediaSource coordinates (seconds)
 * @returns {number} - Time in timeline coordinates (seconds)
 */
export function mediaSourceToTimelineTime(mediaSourceTime) {
    const videoClips = getVideoClipsInOrder();

    if (videoClips.length === 0) {
        return 0;
    }

    let mediaSourceOffset = 0;

    for (const clip of videoClips) {
        const nextOffset = mediaSourceOffset + clip.duration;

        // If mediaSource time is within this clip
        if (mediaSourceTime >= mediaSourceOffset && mediaSourceTime < nextOffset) {
            const offsetIntoClip = mediaSourceTime - mediaSourceOffset;
            return clip.start + offsetIntoClip;
        }

        mediaSourceOffset = nextOffset;
    }

    // If mediaSource time is after all clips, return last clip end
    const lastClip = videoClips[videoClips.length - 1];
    return lastClip.start + lastClip.duration;
}

/**
 * Get all video clips sorted by timeline start position
 *
 * @returns {Array} - Sorted array of video clips
 */
function getVideoClipsInOrder() {
    const clips = Array.from(state.project.clips.values())
        .filter(clip => clip.type === 'video')
        .sort((a, b) => a.start - b.start);

    return clips;
}

/**
 * Get total MediaSource duration (sum of all video clip durations)
 *
 * @returns {number} - Total duration in seconds
 */
export function getTotalMediaSourceDuration() {
    const videoClips = getVideoClipsInOrder();
    return videoClips.reduce((total, clip) => total + clip.duration, 0);
}

/**
 * Get the clip that contains the given timeline time
 *
 * @param {number} timelineTime - Time in timeline coordinates (seconds)
 * @returns {Object|null} - Clip object or null if no clip at that time
 */
export function getClipAtTime(timelineTime) {
    return Array.from(state.project.clips.values()).find(clip =>
        timelineTime >= clip.start && timelineTime < clip.start + clip.duration
    );
}

/**
 * Get the MediaSource time range for a specific clip
 *
 * @param {string} clipId - Clip ID
 * @returns {Object|null} - {start, end} in MediaSource time, or null if not found
 */
export function getClipMediaSourceRange(clipId) {
    const clip = state.project.clips.get(clipId);
    if (!clip || clip.type !== 'video') {
        return null;
    }

    const videoClips = getVideoClipsInOrder();
    let mediaSourceOffset = 0;

    for (const c of videoClips) {
        if (c.id === clipId) {
            return {
                start: mediaSourceOffset,
                end: mediaSourceOffset + c.duration
            };
        }
        mediaSourceOffset += c.duration;
    }

    return null;
}
