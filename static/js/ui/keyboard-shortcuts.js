// ==================== Keyboard Shortcuts ====================
import { state } from '../core/state.js';
import { togglePlayback, changePlaybackRate, seekFrames, toggleMute, seekTo } from '../features/playback/playback.js';
import { splitClipAtPlayhead, deleteSelectedClip, copyClip, pasteClip } from '../operations/clip-operations.js';
import { setInPoint, setOutPoint, zoomTimeline } from '../features/timeline/timeline.js';
import { newProject, saveProject, openProject, undo, redo } from '../features/project/project.js';
import { renderClip } from '../rendering/rendering.js';
import { elements } from '../rendering/dom-cache.js';

// ==================== Shortcuts Definition ====================

const shortcuts = {
    // Playback
    'Space': {
        action: () => togglePlayback(),
        description: 'Play/Pause',
        category: 'playback'
    },
    'j': {
        action: (e) => {
            if (e.shiftKey) {
                decreasePlaybackSpeed();
            } else {
                changePlaybackRate(-1);
            }
        },
        description: 'Rewind playback (Shift: slower speed)',
        category: 'playback'
    },
    'k': {
        action: () => {
            if (state.playback.isPlaying) togglePlayback();
        },
        description: 'Pause playback',
        category: 'playback'
    },
    'l': {
        action: (e) => {
            if (e.shiftKey) {
                increasePlaybackSpeed();
            } else {
                changePlaybackRate(1);
            }
        },
        description: 'Fast forward (Shift: faster speed)',
        category: 'playback'
    },
    'm': {
        action: () => toggleMute(),
        description: 'Toggle mute',
        category: 'playback'
    },
    'ArrowLeft': {
        action: () => seekFrames(-1),
        description: 'Previous frame',
        category: 'playback'
    },
    'ArrowRight': {
        action: () => seekFrames(1),
        description: 'Next frame',
        category: 'playback'
    },

    // Markers
    'i': {
        action: () => setInPoint(),
        description: 'Mark In Point',
        category: 'markers'
    },
    'o': {
        action: (e) => {
            if (e.ctrlKey || e.metaKey) {
                openProject();
            } else {
                setOutPoint();
            }
        },
        description: 'Mark Out Point (Ctrl: Open Project)',
        category: 'markers'
    },

    // Editing
    's': {
        action: (e) => {
            if (e.ctrlKey || e.metaKey) {
                saveProject();
            } else {
                splitClipAtPlayhead();
            }
        },
        description: 'Split clip at playhead (Ctrl: Save)',
        category: 'editing'
    },
    'Delete': {
        action: () => {
            if (state.selection.selectedClips.length > 0) {
                deleteSelectedClip();
            }
        },
        description: 'Delete selected clips',
        category: 'editing'
    },
    'Backspace': {
        action: () => {
            if (state.selection.selectedClips.length > 0) {
                deleteSelectedClip();
            }
        },
        description: 'Delete selected clips',
        category: 'editing'
    },

    // Selection
    'a': {
        action: (e) => {
            if (e.ctrlKey || e.metaKey) {
                selectAllClips();
            }
        },
        description: 'Select all clips',
        category: 'selection',
        requiresCtrl: true
    },
    'Escape': {
        action: () => deselectAll(),
        description: 'Deselect all',
        category: 'selection'
    },

    // Clipboard
    'c': {
        action: (e) => {
            if (e.ctrlKey || e.metaKey) {
                copyClip();
            }
        },
        description: 'Copy clip',
        category: 'editing',
        requiresCtrl: true
    },
    'v': {
        action: (e) => {
            if (e.ctrlKey || e.metaKey) {
                pasteClip();
            }
        },
        description: 'Paste clip',
        category: 'editing',
        requiresCtrl: true
    },

    // Edit History
    'z': {
        action: (e) => {
            if (e.ctrlKey || e.metaKey) {
                undo();
            }
        },
        description: 'Undo',
        category: 'edit',
        requiresCtrl: true
    },
    'y': {
        action: (e) => {
            if (e.ctrlKey || e.metaKey) {
                redo();
            }
        },
        description: 'Redo',
        category: 'edit',
        requiresCtrl: true
    },

    // Project
    'n': {
        action: (e) => {
            if (e.ctrlKey || e.metaKey) {
                newProject();
            }
        },
        description: 'New project',
        category: 'project',
        requiresCtrl: true
    },

    // Zoom
    '=': {
        action: () => zoomInAtMouse(),
        description: 'Zoom in timeline',
        category: 'view'
    },
    '-': {
        action: () => zoomOutAtMouse(),
        description: 'Zoom out timeline',
        category: 'view'
    },

    // Help
    '?': {
        action: () => showShortcutsHelp(),
        description: 'Show keyboard shortcuts',
        category: 'help'
    }
};

// ==================== Keyboard Event Handler ====================

export function handleKeyboardShortcuts(e) {
    // Ignore if typing in input
    if (e.target.matches('input, textarea')) return;

    // Convert key code to lowercase key
    let key = e.key;

    // Handle special keys
    if (e.code === 'Space') key = 'Space';
    if (e.code === 'Equal' || e.code === 'NumpadAdd') key = '=';
    if (e.code === 'Minus' || e.code === 'NumpadSubtract') key = '-';

    // Check if shortcut exists
    const shortcut = shortcuts[key];
    if (shortcut) {
        // Check if Ctrl is required
        if (shortcut.requiresCtrl && !(e.ctrlKey || e.metaKey)) {
            return;
        }

        e.preventDefault();
        shortcut.action(e);
    }
}

// ==================== Helper Functions ====================

/**
 * Show keyboard shortcuts help overlay
 */
function showShortcutsHelp() {
    let overlay = document.getElementById('shortcuts-overlay');
    if (!overlay) {
        createShortcutsOverlay();
        overlay = document.getElementById('shortcuts-overlay');
    }
    overlay.style.display = 'flex';
}

/**
 * Create shortcuts help overlay
 */
function createShortcutsOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'shortcuts-overlay';
    overlay.className = 'shortcuts-overlay';

    const categories = {
        playback: 'Playback',
        markers: 'Markers',
        editing: 'Editing',
        selection: 'Selection',
        edit: 'Edit History',
        project: 'Project',
        view: 'View',
        help: 'Help'
    };

    let html = `
        <div class="shortcuts-modal">
            <div class="shortcuts-header">
                <h2>Keyboard Shortcuts</h2>
                <button class="close-shortcuts" onclick="document.getElementById('shortcuts-overlay').style.display='none'">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="shortcuts-content">
    `;

    // Group shortcuts by category
    for (const [categoryKey, categoryName] of Object.entries(categories)) {
        const categoryShortcuts = Object.entries(shortcuts)
            .filter(([_, shortcut]) => shortcut.category === categoryKey);

        if (categoryShortcuts.length > 0) {
            html += `<div class="shortcut-category">`;
            html += `<h3>${categoryName}</h3>`;
            html += `<div class="shortcut-list">`;

            categoryShortcuts.forEach(([key, shortcut]) => {
                let keyDisplay = key === 'Space' ? 'SPACE' : key.toUpperCase();
                if (shortcut.requiresCtrl) {
                    keyDisplay = `Ctrl+${keyDisplay}`;
                }
                html += `
                    <div class="shortcut-item">
                        <kbd>${keyDisplay}</kbd>
                        <span>${shortcut.description}</span>
                    </div>
                `;
            });

            html += `</div></div>`;
        }
    }

    html += `</div></div>`;
    overlay.innerHTML = html;

    // Close on click outside
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.style.display = 'none';
        }
    });

    document.body.appendChild(overlay);
}

/**
 * Playback speed control
 */
function decreasePlaybackSpeed() {
    const speedSelector = document.getElementById('speed-selector');
    if (!speedSelector) return;

    const currentSpeed = parseFloat(speedSelector.value);
    const speeds = [0.25, 0.5, 1, 1.5, 2];
    const currentIndex = speeds.indexOf(currentSpeed);
    if (currentIndex > 0) {
        speedSelector.value = speeds[currentIndex - 1];
        speedSelector.dispatchEvent(new Event('change'));
    }
}

function increasePlaybackSpeed() {
    const speedSelector = document.getElementById('speed-selector');
    if (!speedSelector) return;

    const currentSpeed = parseFloat(speedSelector.value);
    const speeds = [0.25, 0.5, 1, 1.5, 2];
    const currentIndex = speeds.indexOf(currentSpeed);
    if (currentIndex < speeds.length - 1) {
        speedSelector.value = speeds[currentIndex + 1];
        speedSelector.dispatchEvent(new Event('change'));
    }
}

/**
 * Selection helpers
 */
function selectAllClips() {
    const allClipIds = Array.from(state.project.clips.keys());
    state.selection.selectedClips = allClipIds;
    allClipIds.forEach(id => renderClip(id));
}

function deselectAll() {
    state.selection.selectedClips = [];
    const allClipIds = Array.from(state.project.clips.keys());
    allClipIds.forEach(id => renderClip(id));
}

/**
 * Zoom helpers
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

function zoomInAtMouse() {
    const cursorTime = getMouseCursorTime();
    zoomTimeline('in', cursorTime);
}

function zoomOutAtMouse() {
    const cursorTime = getMouseCursorTime();
    zoomTimeline('out', cursorTime);
}
