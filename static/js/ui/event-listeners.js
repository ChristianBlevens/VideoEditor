// ==================== Event Listeners ====================
import { state } from '../core/state.js';
import { elements } from '../rendering/dom-cache.js';
import {
    togglePlayback,
    changePlaybackRate,
    handleSpeedChange,
    seekFrames,
    handleVolumeChange,
    toggleMute,
    startPlayheadDrag,
    handleTimeRulerMouseDown,
    seekTo
} from '../features/playback/playback.js';
import { zoomTimeline, resetZoom, setInPoint, setOutPoint, updateInOutMarkers, panTimeline, updateAllTimelineElements, updatePlayheadPosition } from '../features/timeline/timeline.js';
import { splitClipAtPlayhead, deleteSelectedClip, toggleClipMute } from '../operations/clip-operations.js';
import {
    transcribeSelectedClip,
    handleWhisperModelChange,
    handleTargetWordsChange,
    isolateTargets,
    removeTargets,
    performTranscriptSearch,
    navigateMatch,
    exportTranscript,
    handleMediaDragStart,
    handleTrackDragOver,
    handleTrackDrop,
    importMedia
} from '../features/transcripts/transcript.js';
import { newProject, openProject, saveProject, undo, redo } from '../features/project/project.js';
import { selectAllClips } from '../operations/operations.js';
import { renderAllClips } from '../rendering/rendering.js';
import {
    openExportModal,
    closeExportModal,
    startExport,
    handleWaveformToggle,
    handleMarkersToggle,
    handleTimelineScroll,
    showToast
} from './ui-utils.js';
import { handleMarkerTrackClick, closeMarkerModal, saveNewMarker } from '../features/timeline/markers.js';
import { handleKeyboardShortcuts } from './keyboard-shortcuts.js';
import {
    handleClipVolumeChange,
    handleClipSpeedChange,
    handleClipStartChange,
    handleClipDurationChange,
    handleClipOpacityChange,
    handleNormalizeAudio,
    handleRemoveNoise,
    handleAudioDucking
} from '../features/properties/clip-properties.js';
import {
    handleTrackLockToggle,
    handleTrackVisibilityToggle,
    handleTrackMuteToggle,
    handleTrackSoloToggle,
    handleTrackVolumeChange
} from '../features/timeline/track-controls.js';

export function initializeEventListeners() {
    // Playback controls
    elements.playBtn.addEventListener('click', togglePlayback);
    elements.rewindBtn.addEventListener('click', () => changePlaybackRate(-1));
    elements.forwardBtn.addEventListener('click', () => changePlaybackRate(1));
    elements.prevFrameBtn.addEventListener('click', () => seekFrames(-1));
    elements.nextFrameBtn.addEventListener('click', () => seekFrames(1));
    elements.speedSelector.addEventListener('change', handleSpeedChange);

    // Volume controls
    elements.volumeSlider.addEventListener('input', handleVolumeChange);
    elements.muteBtn.addEventListener('click', toggleMute);

    // Timeline tools
    elements.splitBtn.addEventListener('click', splitClipAtPlayhead);
    elements.deleteBtn.addEventListener('click', deleteSelectedClip);
    elements.muteClipBtn.addEventListener('click', toggleClipMute);
    elements.inPointBtn.addEventListener('click', setInPoint);
    elements.outPointBtn.addEventListener('click', setOutPoint);
    elements.zoomOutBtn.addEventListener('click', () => zoomTimeline('out', state.playback.currentTime));
    elements.zoomResetBtn.addEventListener('click', resetZoom);
    elements.zoomInBtn.addEventListener('click', () => zoomTimeline('in', state.playback.currentTime));

    // In/Out point marker click handlers (to clear)
    elements.inPointMarker.addEventListener('click', (e) => {
        // Click anywhere on the in point marker to delete it
        state.selection.inPoint = null;
        updateInOutMarkers();
        showToast('In point cleared');
    });
    elements.outPointMarker.addEventListener('click', (e) => {
        // Click anywhere on the out point marker to delete it
        state.selection.outPoint = null;
        updateInOutMarkers();
        showToast('Out point cleared');
    });

    elements.showWaveformsCheckbox.addEventListener('change', handleWaveformToggle);
    elements.snapToGridCheckbox.addEventListener('change', (e) => {
        state.timeline.snapToGrid = e.target.checked;
    });

    // Timeline scroll handling
    elements.timelineWrapper.addEventListener('scroll', handleTimelineScroll);

    // Additional timeline toggles
    const showMarkersCheckbox = document.getElementById('show-markers');

    if (showMarkersCheckbox) {
        showMarkersCheckbox.addEventListener('change', handleMarkersToggle);
    }

    // Toolbar
    elements.newBtn.addEventListener('click', newProject);
    elements.openBtn.addEventListener('click', openProject);
    elements.saveBtn.addEventListener('click', saveProject);
    elements.undoBtn.addEventListener('click', undo);
    elements.redoBtn.addEventListener('click', redo);
    elements.exportBtn.addEventListener('click', openExportModal);

    // Import
    elements.importBtn.addEventListener('click', importMedia);

    // Select All buttons in tabs
    const transcriptSelectAllBtn = document.getElementById('transcript-select-all-btn');
    const subtitlesSelectAllBtn = document.getElementById('subtitles-select-all-btn');
    const propertiesSelectAllBtn = document.getElementById('properties-select-all-btn');

    if (transcriptSelectAllBtn) {
        transcriptSelectAllBtn.addEventListener('click', async () => {
            selectAllClips();
            await renderAllClips();
        });
    }

    if (subtitlesSelectAllBtn) {
        subtitlesSelectAllBtn.addEventListener('click', async () => {
            selectAllClips();
            await renderAllClips();
        });
    }

    if (propertiesSelectAllBtn) {
        propertiesSelectAllBtn.addEventListener('click', async () => {
            selectAllClips();
            await renderAllClips();
        });
    }

    // Transcript
    elements.transcribeBtn.addEventListener('click', transcribeSelectedClip);
    if (elements.whisperModelSelect) {
        elements.whisperModelSelect.addEventListener('change', handleWhisperModelChange);
    }
    elements.targetWords.addEventListener('input', handleTargetWordsChange);
    elements.isolateTargetsBtn.addEventListener('click', isolateTargets);
    elements.removeTargetsBtn.addEventListener('click', removeTargets);

    // Live search on transcript
    elements.transcriptSearch.addEventListener('input', performTranscriptSearch);
    elements.prevMatchBtn.addEventListener('click', () => navigateMatch(-1));
    elements.nextMatchBtn.addEventListener('click', () => navigateMatch(1));
    elements.exportTranscriptBtn.addEventListener('click', exportTranscript);

    // Transcript items - click to seek
    document.querySelectorAll('.transcript-item').forEach(item => {
        item.addEventListener('click', () => {
            const time = parseFloat(item.getAttribute('data-time'));
            seekTo(time);
        });
    });

    // Modal
    elements.closeExportModal.addEventListener('click', closeExportModal);
    elements.startExportBtn.addEventListener('click', startExport);

    // Click outside modal to close
    elements.exportModal.addEventListener('click', (e) => {
        if (e.target === elements.exportModal) closeExportModal();
    });

    // Playhead dragging
    const playheadHandle = document.querySelector('.playhead-handle');
    if (playheadHandle) {
        playheadHandle.addEventListener('mousedown', startPlayheadDrag);
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // File drag from media list
    document.querySelectorAll('.file-item').forEach(item => {
        item.addEventListener('dragstart', handleMediaDragStart);
    });

    // Track drop zones
    document.querySelectorAll('.track-content').forEach(track => {
        track.addEventListener('dragover', handleTrackDragOver);
        track.addEventListener('drop', handleTrackDrop);
    });

    // Time ruler click and drag to seek
    const timeMarkers = document.querySelector('.time-markers');
    if (timeMarkers) {
        timeMarkers.addEventListener('mousedown', handleTimeRulerMouseDown);
    }

    // Marker track click to create marker
    if (elements.markersTrackContent) {
        elements.markersTrackContent.addEventListener('click', handleMarkerTrackClick);
    }

    // Marker modal
    elements.closeMarkerModal.addEventListener('click', closeMarkerModal);
    elements.cancelMarkerBtn.addEventListener('click', closeMarkerModal);
    elements.saveMarkerBtn.addEventListener('click', saveNewMarker);
    elements.markerModal.addEventListener('click', (e) => {
        if (e.target === elements.markerModal) closeMarkerModal();
    });

    // Enter key to save marker
    elements.markerCommentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            saveNewMarker();
        }
    });

    // Track mouse position on timeline for zoom centering
    elements.timelineWrapper.addEventListener('mousemove', (e) => {
        state.cursor.lastMouseX = e.clientX;
        state.cursor.lastMouseY = e.clientY;
    });

    // Timeline scroll wheel support - ctrl+scroll for zoom, scroll for pan
    elements.timelineWrapper.addEventListener('wheel', (e) => {
        // Prevent default immediately to stop browser zoom
        e.preventDefault();
        e.stopPropagation();

        if (e.ctrlKey) {
            // Ctrl + scroll = zoom centered on mouse cursor
            // Scroll up (negative deltaY) = zoom in
            // Scroll down (positive deltaY) = zoom out
            const direction = e.deltaY < 0 ? 'in' : 'out';

            // Calculate mouse cursor time position
            const timeRulerHeader = document.querySelector('.time-ruler-header');
            const headerWidth = timeRulerHeader?.offsetWidth || 140;
            const timelineRect = elements.timelineWrapper.getBoundingClientRect();
            const mouseX = e.clientX - timelineRect.left - headerWidth;
            const trackWidth = elements.timelineWrapper.clientWidth - headerWidth;
            const viewportDuration = state.timeline.viewportEnd - state.timeline.viewportStart;
            const cursorTime = state.timeline.viewportStart + (mouseX / trackWidth) * viewportDuration;

            zoomTimeline(direction, cursorTime);
        } else {
            // Regular scroll = pan
            const scrollAmount = e.deltaX || e.deltaY;
            const viewportDuration = state.timeline.viewportEnd - state.timeline.viewportStart;

            // Convert scroll to time delta (half speed for better control)
            const panSeconds = (scrollAmount / 100) * (viewportDuration * 0.05);

            // Pan timeline (automatically bounds-limited in panTimeline function)
            panTimeline(panSeconds);

            // Update all elements in real-time
            updateAllTimelineElements();
            updatePlayheadPosition();
            updateInOutMarkers();
        }
    }, { passive: false });

    // Clip Properties Panel
    if (elements.clipVolume) {
        elements.clipVolume.addEventListener('input', handleClipVolumeChange);
    }
    if (elements.clipSpeed) {
        elements.clipSpeed.addEventListener('input', handleClipSpeedChange);
    }
    if (elements.clipStart) {
        elements.clipStart.addEventListener('change', handleClipStartChange);
    }
    if (elements.clipDuration) {
        elements.clipDuration.addEventListener('change', handleClipDurationChange);
    }
    if (elements.clipOpacity) {
        elements.clipOpacity.addEventListener('input', handleClipOpacityChange);
    }
    if (elements.normalizeAudioBtn) {
        elements.normalizeAudioBtn.addEventListener('click', handleNormalizeAudio);
    }
    if (elements.removeNoiseBtn) {
        elements.removeNoiseBtn.addEventListener('click', handleRemoveNoise);
    }
    if (elements.audioDuckingCheckbox) {
        elements.audioDuckingCheckbox.addEventListener('change', handleAudioDucking);
    }

    // Track Controls
    document.querySelectorAll('.track-lock-btn').forEach(btn => {
        btn.addEventListener('click', handleTrackLockToggle);
    });
    document.querySelectorAll('.track-visible-btn').forEach(btn => {
        btn.addEventListener('click', handleTrackVisibilityToggle);
    });
    document.querySelectorAll('.track-mute-btn').forEach(btn => {
        btn.addEventListener('click', handleTrackMuteToggle);
    });
    document.querySelectorAll('.track-solo-btn').forEach(btn => {
        btn.addEventListener('click', handleTrackSoloToggle);
    });
    document.querySelectorAll('.track-volume').forEach(slider => {
        slider.addEventListener('input', handleTrackVolumeChange);
    });

    // Cursor position tracking on timeline
    elements.timelineWrapper.addEventListener('mousemove', handleTimelineCursorMove);

    // Prevent browser zoom on Ctrl+wheel globally (in case event bubbles)
    document.addEventListener('wheel', (e) => {
        // Only prevent if over timeline and ctrl is pressed
        const isOverTimeline = e.target.closest('#timeline-wrapper');
        if (isOverTimeline && e.ctrlKey) {
            e.preventDefault();
        }
    }, { passive: false });
}

/**
 * Track cursor position on timeline for paste operations
 */
function handleTimelineCursorMove(e) {
    // Calculate time position from horizontal cursor position
    const rect = elements.timelineWrapper.getBoundingClientRect();
    const timeRulerWidth = elements.timeRulerHeader?.offsetWidth || 140;
    const mouseX = e.clientX - rect.left - timeRulerWidth;
    const trackWidth = rect.width - timeRulerWidth;

    if (mouseX >= 0 && mouseX <= trackWidth) {
        const viewportDuration = state.timeline.viewportEnd - state.timeline.viewportStart;
        const timelineTime = state.timeline.viewportStart + (mouseX / trackWidth) * viewportDuration;
        state.cursor.timelineTime = Math.max(0, timelineTime);
    }

    // Detect which track the cursor is over
    const tracks = document.querySelectorAll('.track[data-track-id]');
    let foundTrack = null;

    for (const track of tracks) {
        const trackRect = track.getBoundingClientRect();
        if (e.clientY >= trackRect.top && e.clientY <= trackRect.bottom) {
            foundTrack = track.getAttribute('data-track-id');
            break;
        }
    }

    state.cursor.trackId = foundTrack;
}
