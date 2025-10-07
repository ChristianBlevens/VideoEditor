// ==================== Data Initialization ====================
// Extract hardcoded data from HTML into state

import { state } from './state.js';
import { createClip, createMarker, createTranscript } from './operations.js';

/**
 * Initialize state with hardcoded data from HTML
 * This should run before rendering
 */
export function initializeData() {
    // Clear existing data
    state.project.clips.clear();
    state.project.markers = [];
    state.project.transcripts = [];

    // Initialize clips
    initializeClips();

    // Initialize markers
    initializeMarkers();

    // Initialize transcripts
    initializeTranscripts();

    console.log('✅ Data initialized from HTML');
    console.log(`  - ${state.project.clips.size} clips`);
    console.log(`  - ${state.project.markers.length} markers`);
    console.log(`  - ${state.project.transcripts.length} transcripts`);
}

/**
 * Initialize clips from hardcoded HTML data
 */
function initializeClips() {
    // Video Clip 1 (in track-1) - 8 seconds, max 8 seconds from source
    createClip({
        id: 'clip-1',
        type: 'video',
        start: 0,
        duration: 8,
        sourceDuration: 8,  // Max length from source file
        trackId: 'track-1',
        src: ''  // No source - demo clip
    });

    // Attached Audio for Clip 1 (in track-1-audio)
    createClip({
        id: 'clip-1-audio',
        type: 'attached-audio',
        start: 0,
        duration: 8,
        sourceDuration: 8,  // Max length from source file
        trackId: 'track-1-audio',
        parentClipId: 'clip-1'
    });

    // Video Clip 2 (in track-2) - 6 seconds, max 6 seconds from source
    createClip({
        id: 'clip-2',
        type: 'video',
        start: 10,
        duration: 6,
        sourceDuration: 6,  // Max length from source file
        trackId: 'track-2',
        src: ''  // No source - demo clip
    });

    // Attached Audio for Clip 2 (in track-2-audio)
    createClip({
        id: 'clip-2-audio',
        type: 'attached-audio',
        start: 10,
        duration: 6,
        sourceDuration: 6,  // Max length from source file
        trackId: 'track-2-audio',
        parentClipId: 'clip-2'
    });

    // Audio Clip 3 (in track-3) - 10 seconds, max 10 seconds from source
    createClip({
        id: 'clip-3',
        type: 'audio',
        start: 18,
        duration: 10,
        sourceDuration: 10,  // Max length from source file
        trackId: 'track-3',
        src: ''  // No source - demo clip
    });
}

/**
 * Initialize markers from hardcoded HTML data
 */
function initializeMarkers() {
    // No demo markers - start with empty timeline
}

/**
 * Initialize transcripts from hardcoded HTML data
 * With word-level timestamps for precise highlighting and markers
 * NOTE: All transcripts are now attached to specific clips
 */
function initializeTranscripts() {
    // Transcript for clip-1 (8 second video clip at timeline position 0-8s)
    createTranscript({
        clipId: 'clip-1',
        start: 0,  // Relative to clip start
        duration: 8,
        text: 'Hello everyone, welcome to this important tutorial on video editing.',
        words: [
            { word: 'Hello', start: 0.0, end: 0.5 },
            { word: 'everyone,', start: 0.6, end: 1.3 },
            { word: 'welcome', start: 1.4, end: 2.0 },
            { word: 'to', start: 2.1, end: 2.3 },
            { word: 'this', start: 2.4, end: 2.7 },
            { word: 'important', start: 2.8, end: 3.5 },
            { word: 'tutorial', start: 3.6, end: 4.3 },
            { word: 'on', start: 4.4, end: 4.6 },
            { word: 'video', start: 4.7, end: 5.2 },
            { word: 'editing.', start: 5.3, end: 6.0 }
        ]
    });

    // Transcript for clip-2 (6 second video clip at timeline position 10-16s)
    createTranscript({
        clipId: 'clip-2',
        start: 0,  // Relative to clip start
        duration: 6,
        text: 'Now I will demonstrate the powerful editing features.',
        words: [
            { word: 'Now', start: 0.0, end: 0.4 },
            { word: 'I', start: 0.5, end: 0.6 },
            { word: 'will', start: 0.7, end: 1.0 },
            { word: 'demonstrate', start: 1.1, end: 2.0 },
            { word: 'the', start: 2.1, end: 2.3 },
            { word: 'powerful', start: 2.4, end: 3.1 },
            { word: 'editing', start: 3.2, end: 3.8 },
            { word: 'features.', start: 3.9, end: 4.6 }
        ]
    });

    // Transcript for clip-3 (10 second audio clip at timeline position 18-28s)
    createTranscript({
        clipId: 'clip-3',
        start: 0,  // Relative to clip start
        duration: 10,
        text: 'Background music and sound effects enhance the viewing experience.',
        words: [
            { word: 'Background', start: 0.0, end: 0.7 },
            { word: 'music', start: 0.8, end: 1.3 },
            { word: 'and', start: 1.4, end: 1.6 },
            { word: 'sound', start: 1.7, end: 2.2 },
            { word: 'effects', start: 2.3, end: 3.0 },
            { word: 'enhance', start: 3.1, end: 3.7 },
            { word: 'the', start: 3.8, end: 4.0 },
            { word: 'viewing', start: 4.1, end: 4.7 },
            { word: 'experience.', start: 4.8, end: 5.6 }
        ]
    });
}
