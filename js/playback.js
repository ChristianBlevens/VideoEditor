// ==================== Playback Controls ====================
import { state } from './state.js';
import { elements } from './dom-cache.js';
import { updatePlayheadPosition, panTimeline, calculateTimelineBounds } from './timeline.js';
import { showToast } from './ui-utils.js';
import { updateSubtitleDisplay } from './subtitle-system.js';

let playbackInterval = null;
let shouldLoopInOut = false; // Track if we should loop at out point

export function togglePlayback() {
    state.playback.isPlaying = !state.playback.isPlaying;
    const icon = elements.playBtn.querySelector('i');

    if (state.playback.isPlaying) {
        icon.className = 'fas fa-pause';

        // Determine if we should activate in/out looping
        // Only loop if: both points exist AND scrubber is before the out point
        shouldLoopInOut =
            state.selection.inPoint !== null &&
            state.selection.outPoint !== null &&
            state.playback.currentTime < state.selection.outPoint;

        startPlaybackSimulation();
    } else {
        icon.className = 'fas fa-play';
        stopPlaybackSimulation();
    }
}

export function startPlaybackSimulation() {
    playbackInterval = setInterval(() => {
        state.playback.currentTime += (0.1 * state.playback.playbackRate);

        // Check if we've hit the out point (only loop if we started before it)
        if (shouldLoopInOut && state.playback.currentTime >= state.selection.outPoint) {
            // Loop back to in point
            state.playback.currentTime = state.selection.inPoint;
        }
        // Check if we've reached the end of the timeline
        else if (state.playback.currentTime >= state.playback.duration) {
            state.playback.currentTime = 0;
            togglePlayback();
        }

        updateTimeDisplay();
        updatePlayheadPosition();
        syncVideoLayers();
        updateSubtitleDisplay(state.playback.currentTime);
    }, 100);
}

export function stopPlaybackSimulation() {
    if (playbackInterval) {
        clearInterval(playbackInterval);
        playbackInterval = null;
    }
}

export function changePlaybackRate(direction) {
    // Increment by 0.1 in either direction
    state.playback.playbackRate = Math.max(0.1, Math.min(state.playback.playbackRate + (direction * 0.1), 4));
    state.playback.playbackRate = Math.round(state.playback.playbackRate * 10) / 10; // Round to 1 decimal
    elements.speedSelector.value = state.playback.playbackRate;
    showToast(`Playback speed: ${state.playback.playbackRate}x`);
}

export function handleSpeedChange(e) {
    state.playback.playbackRate = parseFloat(e.target.value);
}

export function seekTo(time) {
    state.playback.currentTime = Math.max(0, Math.min(time, state.playback.duration));
    updateTimeDisplay();
    updatePlayheadPosition();
}

export function seekFrames(frames) {
    const frameTime = 1 / 30; // 30fps
    seekTo(state.playback.currentTime + (frames * frameTime));
}

export function updateTimeDisplay() {
    elements.currentTimeDisplay.textContent = formatTimecode(state.playback.currentTime);
    elements.totalTimeDisplay.textContent = formatTimecode(state.playback.duration);
}

export function formatTimecode(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const frames = Math.floor((seconds % 1) * 30); // 30fps
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`;
}

// ==================== Volume Controls ====================
export function handleVolumeChange(e) {
    state.playback.volume = parseInt(e.target.value);
    elements.volumeLabel.textContent = `${state.playback.volume}%`;
    updateVolumeIcon();
}

export function toggleMute() {
    state.playback.isMuted = !state.playback.isMuted;
    updateVolumeIcon();
}

export function updateVolumeIcon() {
    const icon = elements.muteBtn.querySelector('i');
    if (state.playback.isMuted || state.playback.volume === 0) {
        icon.className = 'fas fa-volume-mute';
    } else if (state.playback.volume < 50) {
        icon.className = 'fas fa-volume-down';
    } else {
        icon.className = 'fas fa-volume-up';
    }
}

// ==================== Playhead Dragging ====================
let isDraggingPlayhead = false;

export function startPlayheadDrag(e) {
    isDraggingPlayhead = true;
    document.addEventListener('mousemove', handlePlayheadDrag);
    document.addEventListener('mouseup', stopPlayheadDrag);
}

export function handlePlayheadDrag(e) {
    if (!isDraggingPlayhead) return;

    const rect = elements.timelineWrapper.getBoundingClientRect();
    const clickX = e.clientX - rect.left - 140;
    const viewportDuration = state.timeline.viewportEnd - state.timeline.viewportStart;
    const trackWidth = rect.width - 140;
    const time = state.timeline.viewportStart + (clickX / trackWidth) * viewportDuration;

    // Check if near viewport edges - pan instantly (bounds-limited)
    const edgeThreshold = viewportDuration * 0.1; // 10% of viewport
    const bounds = calculateTimelineBounds();

    if (time < state.timeline.viewportStart + edgeThreshold && state.timeline.viewportStart > 0) {
        // Near left edge and not at timeline start - pan left
        const panAmount = -viewportDuration * 0.2;
        panTimeline(panAmount);
    } else if (time > state.timeline.viewportEnd - edgeThreshold && state.timeline.viewportEnd < bounds.duration) {
        // Near right edge and not at timeline end - pan right
        const panAmount = viewportDuration * 0.2;
        panTimeline(panAmount);
    }

    seekTo(time);
}

export function stopPlayheadDrag() {
    isDraggingPlayhead = false;
    document.removeEventListener('mousemove', handlePlayheadDrag);
    document.removeEventListener('mouseup', stopPlayheadDrag);
}

// ==================== Time Ruler Interaction ====================
let isDraggingTimeRuler = false;

export function handleTimeRulerMouseDown(e) {
    isDraggingTimeRuler = true;
    seekFromTimeRuler(e);
    document.addEventListener('mousemove', handleTimeRulerDrag);
    document.addEventListener('mouseup', stopTimeRulerDrag);
}

export function handleTimeRulerDrag(e) {
    if (isDraggingTimeRuler) {
        seekFromTimeRuler(e);
    }
}

export function stopTimeRulerDrag() {
    isDraggingTimeRuler = false;
    document.removeEventListener('mousemove', handleTimeRulerDrag);
    document.removeEventListener('mouseup', stopTimeRulerDrag);
}

export function seekFromTimeRuler(e) {
    const rect = elements.timeMarkers.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const trackWidth = rect.width;
    const viewportDuration = state.timeline.viewportEnd - state.timeline.viewportStart;
    const time = state.timeline.viewportStart + (clickX / trackWidth) * viewportDuration;

    seekTo(time);
}

// ==================== Video Layer Sync ====================

/**
 * Sync video layers with current playback time
 * Finds clips at current time and updates video element sources
 */
export function syncVideoLayers() {
    const time = state.playback.currentTime;
    const allClips = Array.from(state.project.clips.values());

    // Find video clips at current time for each track
    const track1Clip = allClips.find(clip =>
        clip.type === 'video' &&
        clip.trackId === 'video-1' &&
        time >= clip.start &&
        time < (clip.start + clip.duration)
    );

    const track2Clip = allClips.find(clip =>
        clip.type === 'video' &&
        clip.trackId === 'video-2' &&
        time >= clip.start &&
        time < (clip.start + clip.duration)
    );

    // Update video layer 1
    if (track1Clip && elements.videoLayer1) {
        // Only update if source changed and src is not empty
        const newSrc = track1Clip.src || '';
        if (newSrc && elements.videoLayer1.src !== newSrc) {
            elements.videoLayer1.src = newSrc;
        }
        // Seek to correct position within clip (only if we have a valid source)
        if (newSrc) {
            const clipRelativeTime = time - track1Clip.start + (track1Clip.startOffset || 0);
            if (Math.abs(elements.videoLayer1.currentTime - clipRelativeTime) > 0.5) {
                elements.videoLayer1.currentTime = clipRelativeTime;
            }
            elements.videoLayer1.style.display = 'block';
        } else {
            elements.videoLayer1.style.display = 'none';
        }

        // Apply opacity if specified
        if (track1Clip.opacity !== undefined) {
            elements.videoLayer1.style.opacity = track1Clip.opacity / 100;
        }
    } else if (elements.videoLayer1) {
        elements.videoLayer1.style.display = 'none';
    }

    // Update video layer 2
    if (track2Clip && elements.videoLayer2) {
        const newSrc = track2Clip.src || '';
        if (newSrc && elements.videoLayer2.src !== newSrc) {
            elements.videoLayer2.src = newSrc;
        }
        // Seek to correct position within clip (only if we have a valid source)
        if (newSrc) {
            const clipRelativeTime = time - track2Clip.start + (track2Clip.startOffset || 0);
            if (Math.abs(elements.videoLayer2.currentTime - clipRelativeTime) > 0.5) {
                elements.videoLayer2.currentTime = clipRelativeTime;
            }
            elements.videoLayer2.style.display = 'block';
        } else {
            elements.videoLayer2.style.display = 'none';
        }

        if (track2Clip.opacity !== undefined) {
            elements.videoLayer2.style.opacity = track2Clip.opacity / 100;
        }
    } else if (elements.videoLayer2) {
        elements.videoLayer2.style.display = 'none';
    }
}
