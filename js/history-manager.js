// ==================== History Manager (Undo/Redo) ====================
// Data-driven history management using state snapshots

import { state } from './state.js';
import { renderAll } from './rendering.js';
import { renderAllTrackControls } from './track-controls.js';
import { renderClipProperties } from './clip-properties.js';
import { showToast } from './ui-utils.js';

// ==================== State Snapshot ====================

/**
 * Create a deep copy snapshot of current state
 * @returns {Object} - State snapshot
 */
function createSnapshot() {
    // Deep copy clips Map by converting to array, cloning each clip, then back to Map
    const clipsArray = Array.from(state.project.clips.entries()).map(([id, clip]) => {
        return [id, { ...clip }]; // Shallow copy of each clip object
    });
    const clipsMap = new Map(clipsArray);

    return {
        project: {
            name: state.project.name,
            clips: clipsMap,
            markers: JSON.parse(JSON.stringify(state.project.markers)),
            transcripts: JSON.parse(JSON.stringify(state.project.transcripts)),
            edits: JSON.parse(JSON.stringify(state.project.edits))
        },
        selection: {
            selectedClip: state.selection.selectedClip,
            inPoint: state.selection.inPoint,
            outPoint: state.selection.outPoint
        },
        timeline: {
            viewportDuration: state.timeline.viewportDuration,
            snapToGrid: state.timeline.snapToGrid,
            showWaveforms: state.timeline.showWaveforms,
            showMarkers: state.timeline.showMarkers,
            showTranscripts: state.timeline.showTranscripts,
            viewportStart: state.timeline.viewportStart,
            viewportEnd: state.timeline.viewportEnd
        },
        tracks: JSON.parse(JSON.stringify(state.tracks)),
        subtitles: JSON.parse(JSON.stringify(state.subtitles)),
        trackActions: state.trackActions ? JSON.parse(JSON.stringify(state.trackActions)) : []
    };
}

/**
 * Restore state from snapshot
 * @param {Object} snapshot - State snapshot
 */
async function restoreSnapshot(snapshot) {
    // Restore project data
    state.project.name = snapshot.project.name;

    // Deep copy clips Map from snapshot
    const clipsArray = Array.from(snapshot.project.clips.entries()).map(([id, clip]) => {
        return [id, { ...clip }]; // Shallow copy of each clip object
    });
    state.project.clips = new Map(clipsArray);

    state.project.markers = JSON.parse(JSON.stringify(snapshot.project.markers));
    state.project.transcripts = JSON.parse(JSON.stringify(snapshot.project.transcripts));
    state.project.edits = JSON.parse(JSON.stringify(snapshot.project.edits));

    // Restore selection
    state.selection.selectedClip = snapshot.selection.selectedClip;
    state.selection.inPoint = snapshot.selection.inPoint;
    state.selection.outPoint = snapshot.selection.outPoint;

    // Restore timeline state
    state.timeline.viewportDuration = snapshot.timeline.viewportDuration;
    state.timeline.snapToGrid = snapshot.timeline.snapToGrid;
    state.timeline.showWaveforms = snapshot.timeline.showWaveforms;
    state.timeline.showMarkers = snapshot.timeline.showMarkers;
    state.timeline.showTranscripts = snapshot.timeline.showTranscripts;
    state.timeline.viewportStart = snapshot.timeline.viewportStart;
    state.timeline.viewportEnd = snapshot.timeline.viewportEnd;

    // Restore track states
    state.tracks = JSON.parse(JSON.stringify(snapshot.tracks));

    // Restore subtitle state
    state.subtitles = JSON.parse(JSON.stringify(snapshot.subtitles));

    // Restore track actions
    state.trackActions = snapshot.trackActions ? JSON.parse(JSON.stringify(snapshot.trackActions)) : [];

    // Re-render everything
    renderAll();
    renderAllTrackControls();
    renderClipProperties();

    // Re-render track actions
    const { renderAllTrackActions } = await import('./track-actions.js');
    renderAllTrackActions();

    // Re-compile transcript panel (state may have changed)
    const { renderCompiledTranscript } = await import('./transcript.js');
    renderCompiledTranscript();
}

// ==================== History Operations ====================

/**
 * Push current state to undo stack
 * Call this BEFORE making a state-changing operation
 */
export function pushToHistory() {
    const snapshot = createSnapshot();

    // Add to undo stack
    state.history.undoStack.push(snapshot);

    // Limit stack size
    if (state.history.undoStack.length > state.history.maxStackSize) {
        state.history.undoStack.shift(); // Remove oldest
    }

    // Clear redo stack when new action is performed
    state.history.redoStack = [];
}

/**
 * Undo last action
 */
export async function undo() {
    if (state.history.undoStack.length === 0) {
        showToast('Nothing to undo', 'info');
        return;
    }

    // Save current state to redo stack
    const currentSnapshot = createSnapshot();
    state.history.redoStack.push(currentSnapshot);

    // Pop from undo stack and restore
    const previousSnapshot = state.history.undoStack.pop();
    await restoreSnapshot(previousSnapshot);

    showToast('Undo');
}

/**
 * Redo last undone action
 */
export async function redo() {
    if (state.history.redoStack.length === 0) {
        showToast('Nothing to redo', 'info');
        return;
    }

    // Save current state to undo stack
    const currentSnapshot = createSnapshot();
    state.history.undoStack.push(currentSnapshot);

    // Pop from redo stack and restore
    const nextSnapshot = state.history.redoStack.pop();
    await restoreSnapshot(nextSnapshot);

    showToast('Redo');
}

/**
 * Clear history stacks
 */
export function clearHistory() {
    state.history.undoStack = [];
    state.history.redoStack = [];
}

/**
 * Get history stack sizes (for debugging/UI)
 */
export function getHistoryInfo() {
    return {
        undoCount: state.history.undoStack.length,
        redoCount: state.history.redoStack.length,
        maxSize: state.history.maxStackSize
    };
}
