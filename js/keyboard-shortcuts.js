// ==================== Keyboard Shortcuts ====================
import { state } from './state.js';
import { togglePlayback, changePlaybackRate, seekFrames, toggleMute } from './playback.js';
import { splitClipAtPlayhead, deleteSelectedClip, copyClip, pasteClip } from './clip-operations.js';
import { setInPoint, setOutPoint, zoomTimeline } from './timeline.js';
import { newProject, saveProject, openProject, undo, redo } from './project.js';
import { elements } from './dom-cache.js';

export function handleKeyboardShortcuts(e) {
    // Ignore if typing in input
    if (e.target.matches('input, textarea')) return;

    switch (e.code) {
        case 'Space':
            e.preventDefault();
            togglePlayback();
            break;
        case 'KeyS':
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                saveProject();
            } else {
                e.preventDefault();
                splitClipAtPlayhead();
            }
            break;
        case 'KeyM':
            e.preventDefault();
            toggleMute();
            break;
        case 'KeyI':
            e.preventDefault();
            setInPoint();
            break;
        case 'KeyO':
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                openProject();
            } else {
                e.preventDefault();
                setOutPoint();
            }
            break;
        case 'KeyJ':
            e.preventDefault();
            changePlaybackRate(-1);
            break;
        case 'KeyK':
            e.preventDefault();
            if (state.playback.isPlaying) togglePlayback();
            break;
        case 'KeyL':
            e.preventDefault();
            changePlaybackRate(1);
            break;
        case 'ArrowLeft':
            e.preventDefault();
            seekFrames(-1);
            break;
        case 'ArrowRight':
            e.preventDefault();
            seekFrames(1);
            break;
        case 'Delete':
        case 'Backspace':
            if (state.selection.selectedClip) {
                e.preventDefault();
                deleteSelectedClip();
            }
            break;
        case 'KeyZ':
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                undo();
            }
            break;
        case 'KeyY':
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                redo();
            }
            break;
        case 'KeyN':
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                newProject();
            }
            break;
        case 'KeyC':
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                copyClip();
            }
            break;
        case 'KeyV':
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                pasteClip();
            }
            break;
        case 'Equal':
        case 'NumpadAdd':
            // Zoom in centered on mouse cursor
            e.preventDefault();
            zoomInAtMouse();
            break;
        case 'Minus':
        case 'NumpadSubtract':
            // Zoom out centered on mouse cursor
            e.preventDefault();
            zoomOutAtMouse();
            break;
    }
}

/**
 * Calculate mouse cursor time on timeline for zoom centering
 */
function getMouseCursorTime() {
    const timeRulerHeader = document.querySelector('.time-ruler-header');
    const headerWidth = timeRulerHeader?.offsetWidth || 140;
    const timelineRect = elements.timelineWrapper.getBoundingClientRect();
    const mouseX = state.cursor.lastMouseX - timelineRect.left - headerWidth;
    const trackWidth = elements.timelineWrapper.clientWidth - headerWidth;
    const viewportDuration = state.timeline.viewportEnd - state.timeline.viewportStart;
    const cursorTime = state.timeline.viewportStart + (mouseX / trackWidth) * viewportDuration;
    return cursorTime;
}

/**
 * Zoom in centered on mouse cursor position
 */
function zoomInAtMouse() {
    const cursorTime = getMouseCursorTime();
    zoomTimeline('in', cursorTime);
}

/**
 * Zoom out centered on mouse cursor position
 */
function zoomOutAtMouse() {
    const cursorTime = getMouseCursorTime();
    zoomTimeline('out', cursorTime);
}
