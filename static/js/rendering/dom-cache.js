// ==================== DOM Element Cache ====================
// Cache all frequently accessed DOM elements for performance

export const elements = {
    // Video players
    videoLayer1: document.getElementById('video-layer-1'),
    videoLayer2: document.getElementById('video-layer-2'),
    subtitleOverlay: document.getElementById('subtitle-overlay'),
    videoPlaceholder: document.querySelector('.video-placeholder'),
    // MSE playback elements
    previewVideo: document.getElementById('preview-video'),
    previewCanvas: document.getElementById('preview-canvas'),

    // Playback controls
    playBtn: document.getElementById('play-btn'),
    rewindBtn: document.getElementById('rewind-btn'),
    forwardBtn: document.getElementById('forward-btn'),
    prevFrameBtn: document.getElementById('prev-frame-btn'),
    nextFrameBtn: document.getElementById('next-frame-btn'),
    speedSelector: document.getElementById('speed-selector'),
    currentTimeDisplay: document.getElementById('current-time'),
    totalTimeDisplay: document.getElementById('total-time'),
    volumeSlider: document.querySelector('.volume-slider'),
    volumeLabel: document.querySelector('.volume-label'),
    muteBtn: document.getElementById('mute-btn'),

    // Timeline
    timelineWrapper: document.getElementById('timeline-wrapper'),
    playhead: document.getElementById('playhead'),
    timeMarkers: document.getElementById('time-markers'),
    timeRulerHeader: document.querySelector('.time-ruler-header'),
    zoomLevel: document.getElementById('zoom-level'),
    inPointMarker: document.getElementById('in-point-marker'),
    outPointMarker: document.getElementById('out-point-marker'),

    // Timeline tools
    splitBtn: document.getElementById('split-btn'),
    deleteBtn: document.getElementById('delete-btn'),
    muteClipBtn: document.getElementById('mute-clip-btn'),
    inPointBtn: document.getElementById('in-point-btn'),
    outPointBtn: document.getElementById('out-point-btn'),
    zoomInBtn: document.getElementById('zoom-in-btn'),
    zoomOutBtn: document.getElementById('zoom-out-btn'),
    zoomResetBtn: document.getElementById('zoom-reset-btn'),
    showWaveformsCheckbox: document.getElementById('show-waveforms'),
    snapToGridCheckbox: document.getElementById('snap-to-grid'),

    // Toolbar
    newBtn: document.getElementById('new-btn'),
    openBtn: document.getElementById('open-btn'),
    saveBtn: document.getElementById('save-btn'),
    undoBtn: document.getElementById('undo-btn'),
    redoBtn: document.getElementById('redo-btn'),
    exportBtn: document.getElementById('export-btn'),
    projectName: document.getElementById('project-name'),

    // Sidebar - Project
    importBtn: document.getElementById('import-btn'),
    mediaList: document.getElementById('media-list'),

    // Sidebar - Transcript
    transcribeBtn: document.getElementById('transcribe-btn'),
    whisperModelSelect: document.getElementById('whisper-model-select'),
    modelStatus: document.getElementById('model-status'),
    targetWords: document.getElementById('target-words'),
    isolateTargetsBtn: document.getElementById('isolate-targets-btn'),
    removeTargetsBtn: document.getElementById('remove-targets-btn'),
    transcriptSearch: document.getElementById('transcript-search'),
    searchResults: document.getElementById('search-results'),
    prevMatchBtn: document.getElementById('prev-match-btn'),
    nextMatchBtn: document.getElementById('next-match-btn'),
    transcriptContent: document.getElementById('transcript-content'),
    exportTranscriptBtn: document.getElementById('export-transcript-btn'),
    transcriptFormat: document.getElementById('transcript-format'),

    // Tabs
    tabBtns: document.querySelectorAll('.tab-btn'),
    tabContents: document.querySelectorAll('.tab-content'),

    // Properties Panel
    selectedClipName: document.getElementById('selected-clip-name'),
    clipVolume: document.getElementById('clip-volume'),
    clipVolumeValue: document.getElementById('clip-volume-value'),
    clipSpeed: document.getElementById('clip-speed'),
    clipSpeedValue: document.getElementById('clip-speed-value'),
    clipStart: document.getElementById('clip-start'),
    clipDuration: document.getElementById('clip-duration'),
    clipOpacity: document.getElementById('clip-opacity'),
    clipOpacityValue: document.getElementById('clip-opacity-value'),
    normalizeAudioBtn: document.getElementById('normalize-audio-btn'),
    removeNoiseBtn: document.getElementById('remove-noise-btn'),
    audioDuckingCheckbox: document.getElementById('audio-ducking'),

    // Export Modal
    exportModal: document.getElementById('export-modal'),
    closeExportModal: document.getElementById('close-export-modal'),
    startExportBtn: document.getElementById('start-export-btn'),

    // Marker Modal
    markerModal: document.getElementById('marker-modal'),
    closeMarkerModal: document.getElementById('close-marker-modal'),
    markerCommentInput: document.getElementById('marker-comment-input'),
    cancelMarkerBtn: document.getElementById('cancel-marker-btn'),
    saveMarkerBtn: document.getElementById('save-marker-btn'),
    markersTrackContent: document.getElementById('markers-track-content'),

    // Toast
    progressToast: document.getElementById('progress-toast'),
    progressFill: document.getElementById('progress-fill'),
    progressPercent: document.getElementById('progress-percent')
};
