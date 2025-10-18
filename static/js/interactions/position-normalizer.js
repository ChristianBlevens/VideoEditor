/**
 * Position Normalizer
 *
 * Ensures earliest content is always at time 0 by shifting all content
 */

import { state } from '../core/state.js';
import { updateClip, updateMarker, updateTranscript, getAllClips, getAllMarkers, getAllTranscripts } from '../operations/operations.js';
import { resetTimelineBounds } from '../features/timeline/timeline.js';

/**
 * Normalize timeline - ensure earliest content is ALWAYS at 0
 * This is TRUE recalculation - timeline expands/contracts dynamically
 */
export function normalizeTimelinePositions() {
    let minTime = Infinity;

    // Find earliest time across all content
    document.querySelectorAll('.clip[data-start]').forEach(clip => {
        const start = parseFloat(clip.getAttribute('data-start'));
        if (start < minTime) minTime = start;
    });

    document.querySelectorAll('.transcript-segment-marker[data-start]').forEach(segment => {
        const start = parseFloat(segment.getAttribute('data-start'));
        if (start < minTime) minTime = start;
    });

    document.querySelectorAll('.marker[data-time]').forEach(marker => {
        const time = parseFloat(marker.getAttribute('data-time'));
        if (time < minTime) minTime = time;
    });

    // If no content, nothing to normalize
    if (minTime === Infinity) return;

    // Calculate shift needed to make earliest content = 0
    const shift = -minTime;

    // Only shift if needed (earliest is not already at 0)
    if (Math.abs(shift) > 0.001) {
        // Shift all clips in STATE
        getAllClips().forEach(clip => {
            updateClip(clip.id, {
                start: clip.start + shift
            });
        });

        // Shift all markers in STATE
        getAllMarkers().forEach(marker => {
            updateMarker(marker.id, {
                time: marker.time + shift
            });
        });

        // Shift all transcripts in STATE
        getAllTranscripts().forEach(transcript => {
            updateTranscript(transcript.id, {
                start: transcript.start + shift
            });
        });

        // Shift all clips in DOM
        document.querySelectorAll('.clip[data-start]').forEach(clip => {
            const currentStart = parseFloat(clip.getAttribute('data-start'));
            clip.setAttribute('data-start', currentStart + shift);
        });

        // Shift all transcript segments in DOM
        document.querySelectorAll('.transcript-segment-marker[data-start]').forEach(segment => {
            const currentStart = parseFloat(segment.getAttribute('data-start'));
            segment.setAttribute('data-start', currentStart + shift);
        });

        // Shift all markers in DOM
        document.querySelectorAll('.marker[data-time]').forEach(marker => {
            const currentTime = parseFloat(marker.getAttribute('data-time'));
            marker.setAttribute('data-time', currentTime + shift);
        });

        // Shift playback position
        if (state.playback.currentTime !== undefined) {
            state.playback.currentTime = Math.max(0, state.playback.currentTime + shift);
        }

        // Shift in/out points
        if (state.selection.inPoint !== null) {
            state.selection.inPoint = Math.max(0, state.selection.inPoint + shift);
        }
        if (state.selection.outPoint !== null) {
            state.selection.outPoint = Math.max(0, state.selection.outPoint + shift);
        }

        // Shift viewport to maintain visual continuity
        const viewportDuration = state.timeline.viewportEnd - state.timeline.viewportStart;

        state.timeline.viewportStart += shift;
        state.timeline.viewportEnd += shift;

        // If viewport start goes negative, clamp it but maintain duration
        if (state.timeline.viewportStart < 0) {
            state.timeline.viewportStart = 0;
            state.timeline.viewportEnd = viewportDuration;
        }

        // Reset bounds after shifting to ensure they're accurate
        resetTimelineBounds();
    }
}
