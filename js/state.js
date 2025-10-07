// ==================== Application State ====================
export const state = {
    project: {
        name: 'Untitled Project',
        clips: new Map(),          // Map<clipId, Clip>
        markers: [],               // Array<Marker>
        transcripts: [],           // Array<Transcript>
        edits: []                  // Array<Edit>
    },
    playback: {
        isPlaying: false,
        currentTime: 0,
        duration: 120, // Simulated duration (2 minutes)
        playbackRate: 1,
        volume: 100,
        isMuted: false
    },
    timeline: {
        viewportDuration: 10, // Duration of viewport in seconds (replaces zoom multiplier)
        snapToGrid: true,
        showWaveforms: true,
        showMarkers: true,
        showTranscripts: true,
        pixelsPerSecond: 50,
        viewportStart: 0, // Start time visible in viewport
        viewportEnd: 10, // End time visible in viewport (calculated from viewportStart + viewportDuration)
        lastBounds: { start: 0, end: 10, duration: 10 }, // Previous bounds for rate limiting
        lastBoundsUpdateTime: Date.now() // Track when bounds were last updated
    },
    selection: {
        selectedClip: null,
        inPoint: null,
        outPoint: null
    },
    clipboard: {
        clip: null // Copied clip data
    },
    cursor: {
        timelineTime: 0, // Time position of cursor on timeline
        trackId: null, // Track ID cursor is currently over
        lastMouseX: 0, // Last mouse X position for zoom centering
        lastMouseY: 0 // Last mouse Y position
    },
    search: {
        matches: [],
        currentMatchIndex: -1
    },
    ui: {
        activeTab: 'transcript',
        exportModalOpen: false
    },
    tracks: {
        'track-1': { locked: false, visible: true, muted: false, solo: false, volume: 100 },
        'track-2': { locked: false, visible: true, muted: false, solo: false, volume: 100 },
        'track-1-audio': { locked: false, visible: true, muted: false, solo: false },
        'track-2-audio': { locked: false, visible: true, muted: false, solo: false },
        'track-3': { locked: false, visible: true, muted: false, solo: false, volume: 80 },
        'track-4': { locked: false, visible: true, muted: false, solo: false, volume: 100 }
    },
    history: {
        undoStack: [],
        redoStack: [],
        maxStackSize: 50
    },
    subtitles: {
        enabled: false,
        style: {
            fontFamily: 'Impact',
            fontSize: 32,
            color: '#ffffff',
            backgroundColor: '#000000',
            backgroundOpacity: 70,
            position: 'bottom',
            animation: 'none'
        }
    },
    export: {
        quality: 'hd',
        codec: 'auto',
        range: 'full',
        includeSubtitles: false
    }
};

// ==================== Entity Type Definitions ====================
// These are reference schemas - not enforced at runtime but document the structure

/**
 * Clip Schema
 * @typedef {Object} Clip
 * @property {string} id - Unique identifier (e.g., 'clip-1')
 * @property {string} type - Type of clip: 'video' | 'audio' | 'attached-audio'
 * @property {number} start - Start time in seconds
 * @property {number} duration - Duration in seconds
 * @property {string} trackId - ID of the track this clip belongs to
 * @property {string} [src] - Source file path (if any)
 * @property {number} [sourceDuration] - Maximum duration based on source file (clips cannot be stretched beyond this)
 * @property {string} [parentClipId] - For attached-audio, the parent video clip ID
 * @property {boolean} [isMuted] - Whether the clip is muted
 * @property {number} [volume] - Volume level 0-200 (100 = normal, 200 = 2x gain)
 * @property {number} [speed] - Playback speed 25-400 (100 = normal, 200 = 2x speed)
 * @property {number} [opacity] - Opacity 0-100 (video clips only)
 * @property {number} [startOffset] - Trim from start in seconds
 * @property {number} [endOffset] - Trim from end in seconds
 */

/**
 * Marker Schema
 * @typedef {Object} Marker
 * @property {string} id - Unique identifier (e.g., 'marker-1')
 * @property {number} time - Time position in seconds
 * @property {string} comment - Marker comment/description
 */

/**
 * Transcript Schema
 * @typedef {Object} Transcript
 * @property {string} id - Unique identifier (e.g., 'trans-1')
 * @property {string} clipId - ID of the clip this transcript belongs to
 * @property {number} start - Start time in seconds (relative to clip start)
 * @property {number} duration - Duration in seconds
 * @property {string} text - Full transcript text
 * @property {Array<Word>} [words] - Individual words with timing (relative to clip start)
 */

/**
 * Word Schema (for transcript word-level timing)
 * @typedef {Object} Word
 * @property {string} word - The word text
 * @property {number} start - Start time in seconds (relative to clip start)
 * @property {number} end - End time in seconds (relative to clip start)
 */

/**
 * Edit Schema
 * @typedef {Object} Edit
 * @property {string} id - Unique identifier (e.g., 'edit-1')
 * @property {string} type - Edit type: 'cut' | 'delete' | 'move' | 'mute' | 'isolate'
 * @property {string} clipId - ID of affected clip
 * @property {string} description - Human-readable description
 * @property {number} timestamp - When edit was created
 * @property {Object} [metadata] - Type-specific metadata
 */
