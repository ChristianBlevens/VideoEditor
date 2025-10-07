// ==================== Real-Time Video Editor - Modular Architecture ====================
import { state } from './state.js';
import { elements } from './dom-cache.js';
import { initializeData } from './data-init.js';
import { renderAll } from './rendering.js';
import { initializeTimeline } from './timeline.js';
import { initializeEventListeners } from './event-listeners.js';
import { initializeInteract } from './interact-setup.js';
import { initializeTabs } from './tabs.js';
import { initializeTranscript } from './transcript.js';
import { updateTimeDisplay } from './playback.js';
import { updateProjectName, renderRecentProjects, initializeProjectNameEditing } from './project.js';
import { updateTimelineContainerHeight, autoGrowTextarea } from './ui-utils.js';
import { renderAllTrackControls } from './track-controls.js';
import { renderClipProperties } from './clip-properties.js';
import { initializeSubtitleSystem } from './subtitle-system.js';

// ==================== Initialization ====================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎬 Real-Time Video Editor - Initializing...');
    console.log('📊 Data-Driven Architecture');

    // Phase 1: Initialize data from HTML
    initializeData();

    // Phase 2: Render everything from state
    renderAll();
    renderAllTrackControls();
    renderClipProperties();

    // Phase 3: Initialize systems
    initializeEventListeners();
    initializeInteract();
    initializeTabs();
    initializeTimeline();
    initializeTranscript();
    initializeSubtitleSystem();
    updateTimeDisplay();
    updateProjectName();
    initializeProjectNameEditing();
    renderRecentProjects();

    // Set initial timeline container height and textarea height
    setTimeout(() => {
        updateTimelineContainerHeight();
        autoGrowTextarea(elements.targetWords);
    }, 100);

    console.log('✅ Video Editor Ready (Data-Driven Mode)');
    console.log('📚 Loaded Libraries: WaveSurfer.js, Interact.js');
});

// ==================== Export for Console Access ====================
window.VideoEditor = {
    state,
    elements,
    // Expose for debugging
    modules: {
        timeline: () => import('./timeline.js'),
        playback: () => import('./playback.js'),
        clips: () => import('./clip-operations.js'),
        transcript: () => import('./transcript.js'),
        project: () => import('./project.js'),
        markers: () => import('./markers.js'),
        operations: () => import('./operations.js'),
        rendering: () => import('./rendering.js')
    }
};

console.log('🎯 VideoEditor API exposed as window.VideoEditor');
console.log('📖 Access state: VideoEditor.state');
console.log('📖 Access elements: VideoEditor.elements');
console.log('📖 Access operations: await VideoEditor.modules.operations()');
console.log('📖 Access rendering: await VideoEditor.modules.rendering()');
