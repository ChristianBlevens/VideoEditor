// ==================== Entity Operations (CRUD) ====================
// Data-driven operations - update state only, never touch DOM

import { state } from './state.js';

/**
 * Generate unique ID for entities
 */
function generateId(prefix = 'entity') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// ==================== Clip Operations ====================

/**
 * Create a new clip
 * @param {Object} clipData - Clip data (type, start, duration, trackId, etc.)
 * @returns {string} - The created clip ID
 */
export function createClip(clipData) {
    // Use provided id or generate a new one
    const clipId = clipData.id || generateId('clip');

    const clip = {
        id: clipId,
        type: 'video',
        start: 0,
        duration: 10,
        trackId: 'video-1',
        isMuted: false,
        ...clipData
    };

    state.project.clips.set(clip.id, clip);
    console.log('[CREATE] Created clip:', clip.id, 'Type:', clip.type);
    return clip.id;
}

/**
 * Get a clip by ID
 * @param {string} clipId
 * @returns {Object|null}
 */
export function getClip(clipId) {
    return state.project.clips.get(clipId) || null;
}

/**
 * Get all clips, optionally filtered by track
 * @param {string} [trackId] - Optional track ID to filter by
 * @returns {Array<Object>}
 */
export function getAllClips(trackId = null) {
    const clips = Array.from(state.project.clips.values());
    if (trackId) {
        return clips.filter(clip => clip.trackId === trackId);
    }
    return clips;
}

/**
 * Update a clip
 * @param {string} clipId
 * @param {Object} updates - Properties to update
 * @returns {boolean} - Success status
 */
export function updateClip(clipId, updates) {
    const clip = state.project.clips.get(clipId);
    if (!clip) return false;

    Object.assign(clip, updates);
    return true;
}

/**
 * Delete a clip
 * @param {string} clipId
 * @returns {boolean} - Success status
 */
export function deleteClip(clipId) {
    // Also delete any attached audio clips
    const clip = state.project.clips.get(clipId);
    if (clip && clip.type === 'video') {
        // Find and delete attached audio
        const attachedAudio = Array.from(state.project.clips.values())
            .find(c => c.type === 'attached-audio' && c.parentClipId === clipId);
        if (attachedAudio) {
            state.project.clips.delete(attachedAudio.id);
        }
    }

    // Delete associated transcripts
    const transcriptsToDelete = state.project.transcripts.filter(t => t.clipId === clipId);
    transcriptsToDelete.forEach(transcript => {
        const index = state.project.transcripts.findIndex(t => t.id === transcript.id);
        if (index !== -1) {
            state.project.transcripts.splice(index, 1);
            console.log('[DELETE] Deleted transcript:', transcript.id, 'with clip:', clipId);
        }
    });

    // Delete the clip
    const success = state.project.clips.delete(clipId);

    // Clear selection if this was selected
    if (state.selection.selectedClip === clipId) {
        state.selection.selectedClip = null;
    }

    return success;
}

/**
 * Group clips by track ID
 * @returns {Map<string, Array<Object>>}
 */
export function groupClipsByTrack() {
    const groups = new Map();

    state.project.clips.forEach(clip => {
        if (!groups.has(clip.trackId)) {
            groups.set(clip.trackId, []);
        }
        groups.get(clip.trackId).push(clip);
    });

    // Sort clips within each track by start time
    groups.forEach(clips => {
        clips.sort((a, b) => a.start - b.start);
    });

    return groups;
}

// ==================== Marker Operations ====================

/**
 * Create a new marker
 * @param {number} time - Time position in seconds
 * @param {string} comment - Marker comment
 * @returns {string} - The created marker ID
 */
export function createMarker(time, comment) {
    const marker = {
        id: generateId('marker'),
        time,
        comment
    };

    state.project.markers.push(marker);
    return marker.id;
}

/**
 * Get a marker by ID
 * @param {string} markerId
 * @returns {Object|null}
 */
export function getMarker(markerId) {
    return state.project.markers.find(m => m.id === markerId) || null;
}

/**
 * Get all markers
 * @returns {Array<Object>}
 */
export function getAllMarkers() {
    return [...state.project.markers].sort((a, b) => a.time - b.time);
}

/**
 * Update a marker
 * @param {string} markerId
 * @param {Object} updates - Properties to update
 * @returns {boolean} - Success status
 */
export function updateMarker(markerId, updates) {
    const marker = state.project.markers.find(m => m.id === markerId);
    if (!marker) return false;

    Object.assign(marker, updates);
    return true;
}

/**
 * Delete a marker
 * @param {string} markerId
 * @returns {boolean} - Success status
 */
export function deleteMarker(markerId) {
    const index = state.project.markers.findIndex(m => m.id === markerId);
    if (index === -1) return false;

    state.project.markers.splice(index, 1);
    return true;
}

// ==================== Transcript Operations ====================

/**
 * Create a new transcript segment
 * @param {Object} transcriptData - Transcript data (clipId, start, duration, text, etc.)
 * @returns {string} - The created transcript ID
 */
export function createTranscript(transcriptData) {
    if (!transcriptData.clipId) {
        console.error('[CREATE TRANSCRIPT] clipId is required');
        return null;
    }

    const transcript = {
        id: generateId('trans'),
        clipId: transcriptData.clipId,
        start: 0,
        duration: 1,
        text: '',
        words: [],
        ...transcriptData
    };

    state.project.transcripts.push(transcript);
    console.log('[CREATE] Created transcript:', transcript.id, 'for clip:', transcript.clipId);
    return transcript.id;
}

/**
 * Get a transcript by ID
 * @param {string} transcriptId
 * @returns {Object|null}
 */
export function getTranscript(transcriptId) {
    return state.project.transcripts.find(t => t.id === transcriptId) || null;
}

/**
 * Get all transcripts
 * @returns {Array<Object>}
 */
export function getAllTranscripts() {
    return [...state.project.transcripts].sort((a, b) => a.start - b.start);
}

/**
 * Get all transcripts for a specific clip
 * @param {string} clipId
 * @returns {Array<Object>}
 */
export function getClipTranscripts(clipId) {
    return state.project.transcripts.filter(t => t.clipId === clipId);
}

/**
 * Update a transcript
 * @param {string} transcriptId
 * @param {Object} updates - Properties to update
 * @returns {boolean} - Success status
 */
export function updateTranscript(transcriptId, updates) {
    const transcript = state.project.transcripts.find(t => t.id === transcriptId);
    if (!transcript) return false;

    Object.assign(transcript, updates);
    return true;
}

/**
 * Delete a transcript
 * @param {string} transcriptId
 * @returns {boolean} - Success status
 */
export function deleteTranscript(transcriptId) {
    const index = state.project.transcripts.findIndex(t => t.id === transcriptId);
    if (index === -1) return false;

    state.project.transcripts.splice(index, 1);
    return true;
}

/**
 * Split a transcript at a specific time
 * @param {string} transcriptId - ID of transcript to split
 * @param {number} splitTime - Time to split at (relative to transcript start)
 * @returns {Object|null} - { firstTranscriptId, secondTranscriptId, actualSplitTime } or null if failed
 */
export function splitTranscript(transcriptId, splitTime) {
    const transcript = getTranscript(transcriptId);
    if (!transcript) {
        console.error('[SPLIT TRANSCRIPT] Transcript not found:', transcriptId);
        return null;
    }

    // If no words, can't split intelligently - just split at exact time
    if (!transcript.words || transcript.words.length === 0) {
        console.warn('[SPLIT TRANSCRIPT] No words in transcript, splitting at exact time');

        const firstTranscript = createTranscript({
            clipId: transcript.clipId,
            start: transcript.start,
            duration: splitTime,
            text: transcript.text,
            words: []
        });

        const secondTranscript = createTranscript({
            clipId: transcript.clipId,
            start: transcript.start + splitTime,
            duration: transcript.duration - splitTime,
            text: '',
            words: []
        });

        // Delete original
        deleteTranscript(transcriptId);

        return {
            firstTranscriptId: firstTranscript,
            secondTranscriptId: secondTranscript,
            actualSplitTime: splitTime
        };
    }

    // Find word boundary for split
    let splitWordIndex = -1;
    let actualSplitTime = splitTime;

    for (let i = 0; i < transcript.words.length; i++) {
        const word = transcript.words[i];

        // If split time is between words, split here
        if (i > 0 && splitTime >= transcript.words[i - 1].end && splitTime < word.start) {
            splitWordIndex = i;
            actualSplitTime = splitTime;
            break;
        }

        // If split time is in middle of word, snap to end of word (include word in first half)
        if (splitTime >= word.start && splitTime < word.end) {
            splitWordIndex = i + 1;
            actualSplitTime = word.end;
            break;
        }
    }

    // If split time is after last word
    if (splitWordIndex === -1 && splitTime >= transcript.words[transcript.words.length - 1].end) {
        splitWordIndex = transcript.words.length;
        actualSplitTime = splitTime;
    }

    // If split time is before first word
    if (splitWordIndex === -1 && splitTime < transcript.words[0].start) {
        splitWordIndex = 0;
        actualSplitTime = splitTime;
    }

    // Create first half (words 0 to splitWordIndex - 1)
    const firstHalfWords = transcript.words.slice(0, splitWordIndex);
    const firstHalfText = firstHalfWords.map(w => w.word).join(' ');

    const firstTranscript = createTranscript({
        clipId: transcript.clipId,
        start: transcript.start,
        duration: actualSplitTime,
        text: firstHalfText,
        words: firstHalfWords
    });

    // Create second half (words splitWordIndex to end)
    const secondHalfWords = transcript.words.slice(splitWordIndex).map(w => ({
        word: w.word,
        start: w.start - actualSplitTime,  // Adjust timing relative to new clip start
        end: w.end - actualSplitTime
    }));
    const secondHalfText = secondHalfWords.map(w => w.word).join(' ');

    const secondTranscript = createTranscript({
        clipId: transcript.clipId,
        start: 0,  // Relative to new clip start
        duration: transcript.duration - actualSplitTime,
        text: secondHalfText,
        words: secondHalfWords
    });

    // Delete original transcript
    deleteTranscript(transcriptId);

    console.log('[SPLIT TRANSCRIPT] Split at word boundary:', actualSplitTime);

    return {
        firstTranscriptId: firstTranscript,
        secondTranscriptId: secondTranscript,
        actualSplitTime: actualSplitTime
    };
}

// ==================== Edit Operations ====================

/**
 * Create a new edit record
 * @param {string} clipId - ID of affected clip
 * @param {string} type - Edit type
 * @param {string} description - Human-readable description
 * @param {Object} metadata - Additional metadata
 * @returns {string} - The created edit ID
 */
export function createEdit(clipId, type, description, metadata = {}) {
    const edit = {
        id: generateId('edit'),
        clipId,
        type,
        description,
        timestamp: Date.now(),
        ...metadata
    };

    state.project.edits.push(edit);
    return edit.id;
}

/**
 * Get all edits for a clip
 * @param {string} clipId
 * @returns {Array<Object>}
 */
export function getClipEdits(clipId) {
    return state.project.edits.filter(e => e.clipId === clipId);
}

/**
 * Delete an edit
 * @param {string} editId
 * @returns {boolean} - Success status
 */
export function deleteEdit(editId) {
    const index = state.project.edits.findIndex(e => e.id === editId);
    if (index === -1) return false;

    state.project.edits.splice(index, 1);
    return true;
}

// ==================== Selection Operations ====================

/**
 * Select a clip
 * @param {string|null} clipId - Clip ID or null to clear
 */
export function selectClip(clipId) {
    state.selection.selectedClip = clipId;
}

/**
 * Get selected clip
 * @returns {Object|null}
 */
export function getSelectedClip() {
    if (!state.selection.selectedClip) return null;
    return getClip(state.selection.selectedClip);
}
