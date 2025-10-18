// ==================== Real-Time Video Editor - Modular Architecture ====================
import { state } from './state.js';
import { initializeData } from './data-init.js';
import { renderAll } from '../rendering/rendering.js';
import { initializeTimeline } from '../features/timeline/timeline.js';
import { initializeEventListeners } from '../ui/event-listeners.js';
import { initializeInteract } from '../interactions/interact-setup.js';
import { initializeTabs } from '../ui/tabs.js';
import { initializeTranscript } from '../features/transcripts/transcript.js';
import { updateTimeDisplay, initializeMSEPlayback } from '../features/playback/playback.js';
import { updateProjectName, renderRecentProjects, initializeProjectNameEditing } from '../features/project/project.js';
import { updateTimelineContainerHeight, autoGrowTextarea } from '../ui/ui-utils.js';
import { renderAllTrackControls } from '../features/timeline/track-controls.js';
import { renderClipProperties, initializeClipProperties } from '../features/properties/clip-properties.js';
import { initializeSubtitleSystem } from '../features/subtitles/subtitle-system.js';
import { initializeHistoryPanel, clearHistory } from '../ui/history-panel.js';
import { initializeFillerWords, previewFillerWordRemoval, addFillerWord } from '../features/transcripts/filler-words.js';
import { initializeExportPresets } from '../features/project/export-presets.js';
import { showPaceAnalysis } from '../features/transcripts/pace-analyzer.js';

// Backend integration
import { api } from '../api/api-client.js';
import { fileUploader } from '../features/project/file-uploader.js';
import { loadProjectMedia } from '../features/project/project-media.js';

// DOM cache
import { elements } from '../rendering/dom-cache.js';

// ==================== Initialization ====================
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🎬 Real-Time Video Editor - Initializing...');
    console.log('📊 Data-Driven Architecture');

    // Phase 0: Check backend health
    try {
        const health = await api.checkHealth();
        console.log('✅ Backend connected:', health.message);
        console.log('🖥️  GPU Available:', health.gpu_available);
    } catch (error) {
        console.warn('⚠️ Backend not available - running in offline mode');
        console.warn(error);
    }

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
    initializeClipProperties();
    initializeHistoryPanel();
    initializeFillerWords();
    initializeExportPresets();
    updateTimeDisplay();
    updateProjectName();
    initializeProjectNameEditing();
    renderRecentProjects();

    // Phase 4: Initialize backend integrations
    console.log('📡 File uploader ready');

    // Load existing project media from backend
    try {
        await loadProjectMedia();
        console.log('📁 Project media loaded from uploads folder');
    } catch (error) {
        console.warn('⚠️ Failed to load project media:', error);
    }

    // Phase 5: Initialize MSE playback system
    try {
        await initializeMSEPlayback();
        console.log('🎥 MSE Playback system initialized');
    } catch (error) {
        console.error('❌ MSE Playback initialization failed:', error);
        console.warn('⚠️  Playback features may not work correctly');
    }

    // Set initial timeline container height and textarea height
    setTimeout(() => {
        updateTimelineContainerHeight();
        autoGrowTextarea(elements.targetWords);
    }, 100);

    // Add clear history button handler
    document.getElementById('clear-history-btn')?.addEventListener('click', () => {
        clearHistory();
    });

    // Add filler words event handlers
    document.getElementById('preview-filler-removal-btn')?.addEventListener('click', () => {
        previewFillerWordRemoval();
    });

    document.getElementById('manage-filler-words-btn')?.addEventListener('click', () => {
        document.getElementById('filler-dictionary-modal').style.display = 'flex';
    });

    document.getElementById('add-filler-word-btn')?.addEventListener('click', () => {
        const input = document.getElementById('custom-filler-input');
        addFillerWord(input.value);
        input.value = '';
    });

    console.log('✅ Video Editor Ready (Data-Driven Mode)');
    console.log('📚 Loaded Libraries: WaveSurfer.js, Interact.js, Backend API');
});

// ==================== Export for Console Access ====================
window.VideoEditor = {
    state,
    elements,
    api,
    fileUploader,
    // Expose for debugging
    modules: {
        timeline: () => import('../features/timeline/timeline.js'),
        playback: () => import('../features/playback/playback.js'),
        clips: () => import('../operations/clip-operations.js'),
        transcript: () => import('../features/transcripts/transcript.js'),
        project: () => import('../features/project/project.js'),
        markers: () => import('../features/timeline/markers.js'),
        operations: () => import('../operations/operations.js'),
        rendering: () => import('../rendering/rendering.js')
    }
};

console.log('🎯 VideoEditor API exposed as window.VideoEditor');
console.log('📖 Access state: VideoEditor.state');
console.log('📖 Access elements: VideoEditor.elements');
console.log('📖 Access operations: await VideoEditor.modules.operations()');
console.log('📖 Access rendering: await VideoEditor.modules.rendering()');
