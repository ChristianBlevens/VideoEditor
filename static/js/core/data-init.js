// ==================== Data Initialization ====================
// Extract hardcoded data from HTML into state

import { state } from './state.js';
import { createClip, createMarker, createTranscript } from '../operations/operations.js';

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
    // No demo clips - start with empty timeline
    // Clips will be added via file import
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
    // No demo transcripts - start with empty timeline
    // Transcripts will be generated via backend AI transcription
}
