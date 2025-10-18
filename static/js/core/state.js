// ==================== Application State ====================
export const state = {
    project: {
        name: 'Untitled Project',
        clips: new Map(),          // Map<clipId, Clip>
        markers: [],               // Array<Marker>
        transcripts: [],           // Array<Transcript>
        subtitles: [],             // Array<Subtitle> - for playback overlay
        edits: [],                 // Array<Edit>
        mediaItems: [],            // Array<MediaItem> - uploaded files not yet on timeline
        clipCounter: 0             // Counter for default clip names
    },
    playback: {
        isPlaying: false,
        currentTime: 0,
        duration: 120, // Simulated duration (2 minutes)
        playbackRate: 1,
        volume: 1.0, // 0.0 to 1.0
        isMuted: false,
        // MSE playback engine
        mseEngine: null, // MSEPlaybackEngine instance
        audioMixer: null, // AudioMixer instance
        // Canvas rendering
        canvasEnabled: true, // Enable canvas overlay (for subtitles/effects)
        subtitlesEnabled: false, // Show subtitles during playback (off by default)
        lastSubtitleId: null // Track last rendered subtitle for optimization
    },
    timeline: {
        viewportDuration: 10, // Duration of viewport in seconds (replaces zoom multiplier)
        snapToGrid: true,
        showWaveforms: true,
        showMarkers: true,
        pixelsPerSecond: 50,
        viewportStart: 0, // Start time visible in viewport
        viewportEnd: 10, // End time visible in viewport (calculated from viewportStart + viewportDuration)
        lastBounds: { start: 0, end: 10, duration: 10 }, // Previous bounds for rate limiting
        lastBoundsUpdateTime: Date.now() // Track when bounds were last updated
    },
    selection: {
        selectedClips: [],  // Array of selected clip IDs (multi-selection support)
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
        'track-1-audio': { locked: false, visible: true, muted: false, solo: false, volume: 100 },
        'track-2-audio': { locked: false, visible: true, muted: false, solo: false, volume: 100 },
        'track-3': { locked: false, visible: true, muted: false, solo: false, volume: 100 },
        'track-4': { locked: false, visible: true, muted: false, solo: false, volume: 100 },
        'markers': { locked: false, visible: true, muted: false, solo: false, volume: 100 }
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
            animation: 'none',
            displayMode: 'full',  // 'full' | 'max-words'
            maxWords: 4,          // Maximum words per subtitle (for max-words mode)
            offsetX: 0,           // Horizontal offset from center (pixels)
            offsetY: 0            // Vertical offset from position (pixels)
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
 * @property {number} start - Start time on timeline in seconds (where clip appears on timeline)
 * @property {number} duration - Duration in seconds (how long the clip plays)
 * @property {string} trackId - ID of the track this clip belongs to
 * @property {string} [src] - Source file path (if any)
 * @property {number} [sourceDuration] - Maximum duration based on source file (clips cannot be stretched beyond this)
 * @property {number} [mediaStart] - Start position within source media in seconds (which part of source this clip represents)
 * @property {number} [mediaEnd] - End position within source media in seconds (mediaStart + duration by default)
 * @property {string} [parentClipId] - For attached-audio, the parent video clip ID
 * @property {boolean} [isMuted] - Whether the clip is muted
 * @property {number} [volume] - Volume level 0-200 (100 = normal, 200 = 2x gain)
 * @property {number} [speed] - Playback speed 25-400 (100 = normal, 200 = 2x speed)
 * @property {number} [opacity] - Opacity 0-100 (video clips only)
 * @property {number} [startOffset] - DEPRECATED: Use mediaStart instead. Trim from start in seconds
 * @property {number} [endOffset] - DEPRECATED: Use mediaEnd instead. Trim from end in seconds
 * @property {Object} [subtitleStyle] - Subtitle styling for this clip's transcripts
 * @property {string} [subtitleStyle.fontFamily] - Font family
 * @property {number} [subtitleStyle.fontSize] - Font size in pixels
 * @property {string} [subtitleStyle.color] - Text color (hex)
 * @property {string} [subtitleStyle.backgroundColor] - Background color (hex)
 * @property {number} [subtitleStyle.backgroundOpacity] - Background opacity 0-100
 * @property {string} [subtitleStyle.position] - Position 'top' | 'center' | 'bottom'
 * @property {string} [subtitleStyle.animation] - Animation type 'none' | 'fade' | 'typewriter' | 'slide-up'
 * @property {string} [subtitleStyle.displayMode] - Display mode 'full' | 'max-words'
 * @property {number} [subtitleStyle.maxWords] - Maximum words per subtitle (for max-words mode)
 * @property {number} [subtitleStyle.offsetX] - Horizontal offset from center (pixels)
 * @property {number} [subtitleStyle.offsetY] - Vertical offset from position (pixels)
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

/**
 * Subtitle Schema (for playback overlay)
 * @typedef {Object} Subtitle
 * @property {string} id - Unique identifier (e.g., 'sub-1')
 * @property {number} start - Start time in seconds (timeline time)
 * @property {number} end - End time in seconds (timeline time)
 * @property {string} text - Subtitle text
 * @property {Array<Word>} [words] - Word-level timestamps for karaoke mode
 * @property {Object} [style] - Custom styling (overrides default)
 * @property {string} [style.fontFamily] - Font family
 * @property {number} [style.fontSize] - Font size in pixels
 * @property {string} [style.fontWeight] - Font weight ('normal', 'bold')
 * @property {string} [style.color] - Text color (hex or rgba)
 * @property {string} [style.strokeColor] - Stroke/outline color
 * @property {number} [style.strokeWidth] - Stroke width in pixels
 * @property {string} [style.backgroundColor] - Background color (hex or rgba)
 * @property {number} [style.padding] - Background padding in pixels
 * @property {string} [style.position] - Vertical position ('top', 'middle', 'bottom')
 * @property {string} [style.alignment] - Text alignment ('left', 'center', 'right')
 * @property {number} [style.offsetY] - Y offset from position in pixels
 * @property {number} [style.fadeTime] - Fade in/out duration in seconds
 */
