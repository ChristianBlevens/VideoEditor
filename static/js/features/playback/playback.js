// ==================== Playback Controls ====================
import { state } from '../../core/state.js';
import { elements } from '../../rendering/dom-cache.js';
import { updatePlayheadPosition, panTimeline, calculateTimelineBounds } from '../timeline/timeline.js';
import { showToast } from '../../ui/ui-utils.js';
import { updateSubtitleDisplay } from '../subtitles/subtitle-system.js';
import { MSEPlaybackEngine } from './playback-engine-mse.js';
import { AudioMixer } from '../audio/audio-mixer.js';
import { renderSubtitle, getActiveSubtitle } from '../subtitles/subtitle-renderer.js';
import { applyDucking, calculateDuckingAtTime } from '../audio/audio-ducking.js';

let playbackInterval = null;
let shouldLoopInOut = false; // Track if we should loop at out point
let canvasRenderLoop = null; // requestVideoFrameCallback handle

// ==================== MSE Playback Initialization ====================

/**
 * Initialize MSE playback system
 * Call this once when the application loads
 */
export async function initializeMSEPlayback() {
    try {
        console.log('[Playback] Initializing MSE playback system...');

        // Get video element and canvas
        const videoElement = elements.previewVideo || document.querySelector('#preview-video');
        const canvas = elements.previewCanvas || document.querySelector('#preview-canvas');

        if (!videoElement) {
            console.warn('[Playback] No video element found, skipping MSE initialization');
            return;
        }

        // Create MSE playback engine
        state.playback.mseEngine = new MSEPlaybackEngine(videoElement);

        // Create audio mixer
        state.playback.audioMixer = new AudioMixer(videoElement);

        // Set up canvas if available
        if (canvas && state.playback.canvasEnabled) {
            setupCanvasRendering(videoElement, canvas);
        }

        // Listen to video timeupdate to sync timeline
        videoElement.addEventListener('timeupdate', handleVideoTimeUpdate);
        videoElement.addEventListener('play', () => {
            state.playback.isPlaying = true;
            updatePlayButton();
        });
        videoElement.addEventListener('pause', () => {
            state.playback.isPlaying = false;
            updatePlayButton();
        });
        videoElement.addEventListener('ended', () => {
            state.playback.isPlaying = false;
            state.playback.currentTime = 0;
            updatePlayButton();
            updateTimeDisplay();
        });

        console.log('[Playback] MSE playback system initialized');
    } catch (error) {
        console.error('[Playback] Failed to initialize MSE playback:', error);
        showToast('Playback initialization failed', 'error');
    }
}

/**
 * Load timeline into playback engine
 */
export async function loadTimelineForPlayback() {
    if (!state.playback.mseEngine) {
        console.warn('[Playback] MSE engine not initialized');
        return;
    }

    try {
        showToast('Loading timeline...', 'info', 2000);
        await state.playback.mseEngine.loadTimeline();
        showToast('Timeline loaded', 'success', 2000);
    } catch (error) {
        console.error('[Playback] Failed to load timeline:', error);
        showToast('Failed to load timeline', 'error');
    }
}

/**
 * Handle video element time updates
 */
function handleVideoTimeUpdate() {
    if (!state.playback.mseEngine) return;

    const timelineTime = state.playback.mseEngine.getCurrentTimelineTime();
    state.playback.currentTime = timelineTime;

    updateTimeDisplay();
    updatePlayheadPosition();
    updateSubtitleDisplay(timelineTime);

    // Update audio mixer
    if (state.playback.audioMixer) {
        state.playback.audioMixer.updateAudioClips(timelineTime);

        // Apply audio ducking if enabled on any clips
        const hasDuckingEnabled = Array.from(state.project.clips.values())
            .some(clip => clip.audioDucking === true);

        if (hasDuckingEnabled) {
            // Get audio context and nodes from mixer
            const audioContext = state.playback.audioMixer.audioContext;
            const sourceNodes = state.playback.audioMixer.sourceNodes;
            const gainNodes = state.playback.audioMixer.gainNodes;

            if (audioContext && gainNodes) {
                applyDucking(audioContext, sourceNodes, gainNodes, timelineTime);
            }
        }
    }
}

/**
 * Update play button icon
 */
function updatePlayButton() {
    if (elements.playBtn) {
        const icon = elements.playBtn.querySelector('i');
        if (icon) {
            icon.className = state.playback.isPlaying ? 'fas fa-pause' : 'fas fa-play';
        }
    }
}

/**
 * Setup canvas rendering for subtitles and effects
 */
function setupCanvasRendering(videoElement, canvas) {
    console.log('[Playback] Setting up canvas rendering...');

    // Match canvas size to video
    function updateCanvasSize() {
        canvas.width = videoElement.videoWidth || 1920;
        canvas.height = videoElement.videoHeight || 1080;
    }

    videoElement.addEventListener('loadedmetadata', updateCanvasSize);
    updateCanvasSize();

    // Start render loop
    startCanvasRenderLoop(videoElement, canvas);
}

/**
 * Start canvas rendering loop
 */
function startCanvasRenderLoop(videoElement, canvas) {
    const ctx = canvas.getContext('2d');

    function renderFrame() {
        // ALWAYS draw video frame (even when paused for subtitles to show)
        ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

        // Render subtitle overlay
        if (state.playback.subtitlesEnabled && state.playback.canvasEnabled) {
            const activeSubtitle = getActiveSubtitle(state.playback.currentTime);
            // console.log('[Canvas] Rendering frame - time:', state.playback.currentTime, 'subtitlesEnabled:', state.playback.subtitlesEnabled, 'activeSubtitle:', activeSubtitle, 'totalSubtitles:', state.project.subtitles.length);
            if (activeSubtitle) {
                // console.log('[Canvas] Drawing subtitle:', activeSubtitle.text);
                renderSubtitle(ctx, activeSubtitle, canvas.width, canvas.height, state.playback.currentTime);
            }
        }

        // Continue loop
        canvasRenderLoop = videoElement.requestVideoFrameCallback(renderFrame);
    }

    // Start loop
    canvasRenderLoop = videoElement.requestVideoFrameCallback(renderFrame);

    console.log('[Playback] Canvas render loop started');
}

// ==================== Playback Controls ====================

export function togglePlayback() {
    if (state.playback.mseEngine) {
        // Use MSE playback
        if (state.playback.isPlaying) {
            pause();
        } else {
            play();
        }
    } else {
        // Fallback to simulation mode
        state.playback.isPlaying = !state.playback.isPlaying;
        const icon = elements.playBtn.querySelector('i');

        if (state.playback.isPlaying) {
            icon.className = 'fas fa-pause';
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
}

/**
 * Play video using MSE
 */
export function play() {
    if (!state.playback.mseEngine) {
        console.warn('[Playback] MSE engine not initialized');
        return;
    }

    state.playback.mseEngine.play();

    if (state.playback.audioMixer) {
        state.playback.audioMixer.play();
    }

    state.playback.isPlaying = true;
    updatePlayButton();
}

/**
 * Pause video using MSE
 */
export function pause() {
    if (!state.playback.mseEngine) {
        console.warn('[Playback] MSE engine not initialized');
        return;
    }

    state.playback.mseEngine.pause();

    if (state.playback.audioMixer) {
        state.playback.audioMixer.pause();
    }

    state.playback.isPlaying = false;
    updatePlayButton();
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
    // Get timeline bounds and clamp time
    const bounds = calculateTimelineBounds();
    const minTime = 0; // Always start at 0
    const maxTime = bounds.end; // End of last clip
    const clampedTime = Math.max(minTime, Math.min(time, maxTime));

    if (state.playback.mseEngine) {
        // Use MSE seek
        state.playback.mseEngine.seek(clampedTime);
        state.playback.currentTime = clampedTime;
    } else {
        // Fallback to simulation
        state.playback.currentTime = clampedTime;
    }

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
    const volumePercent = parseInt(e.target.value);
    const volumeNormalized = volumePercent / 100; // 0.0 to 1.0

    state.playback.volume = volumeNormalized;
    elements.volumeLabel.textContent = `${volumePercent}%`;

    // Update audio mixer
    if (state.playback.audioMixer) {
        state.playback.audioMixer.setMasterVolume(volumeNormalized);
    }

    updateVolumeIcon();
}

export function toggleMute() {
    state.playback.isMuted = !state.playback.isMuted;

    // Update audio mixer
    if (state.playback.audioMixer) {
        state.playback.audioMixer.setMuted(state.playback.isMuted);
    }

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
