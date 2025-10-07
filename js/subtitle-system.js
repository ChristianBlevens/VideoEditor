// ==================== Subtitle System ====================
// Data-driven subtitle styling and generation

import { state } from './state.js';
import { elements } from './dom-cache.js';
import { showToast } from './ui-utils.js';

// ==================== DOM Cache for Subtitle Controls ====================
const subtitleElements = {
    fontSelect: document.getElementById('subtitle-font'),
    sizeSlider: document.getElementById('subtitle-size'),
    sizeValue: document.getElementById('subtitle-size-value'),
    colorInput: document.getElementById('subtitle-color'),
    bgColorInput: document.getElementById('subtitle-bg-color'),
    bgOpacitySlider: document.getElementById('subtitle-bg-opacity'),
    bgOpacityValue: document.getElementById('subtitle-bg-opacity-value'),
    positionSelect: document.getElementById('subtitle-position'),
    animationSelect: document.getElementById('subtitle-animation'),
    generateBtn: document.getElementById('generate-subtitles-btn'),
    burnCheckbox: document.getElementById('burn-subtitles')
};

// ==================== Rendering ====================

/**
 * Apply subtitle styles to overlay
 */
export function applySubtitleStyles() {
    if (!elements.subtitleOverlay) return;

    const overlay = elements.subtitleOverlay;
    const textEl = overlay.querySelector('.subtitle-text');
    if (!textEl) return;

    const style = state.subtitles.style;

    // Apply font
    textEl.style.fontFamily = style.fontFamily;
    textEl.style.fontSize = `${style.fontSize}px`;
    textEl.style.color = style.color;

    // Apply background
    const bgOpacity = style.backgroundOpacity / 100;
    const bgColor = hexToRgba(style.backgroundColor, bgOpacity);
    textEl.style.backgroundColor = bgColor;
    textEl.style.padding = '10px 20px';
    textEl.style.borderRadius = '5px';

    // Apply position
    overlay.style.top = '';
    overlay.style.bottom = '';
    overlay.style.transform = '';

    if (style.position === 'top') {
        overlay.style.top = '20px';
    } else if (style.position === 'center') {
        overlay.style.top = '50%';
        overlay.style.transform = 'translateY(-50%)';
    } else { // bottom
        overlay.style.bottom = '20px';
    }

    // Animation class
    overlay.className = 'subtitle-overlay';
    if (style.animation !== 'none') {
        overlay.classList.add(`subtitle-${style.animation}`);
    }
}

/**
 * Update subtitle display with current playback time
 */
export function updateSubtitleDisplay(time) {
    if (!elements.subtitleOverlay) return;
    if (!state.subtitles.enabled) {
        elements.subtitleOverlay.style.display = 'none';
        return;
    }

    const textEl = elements.subtitleOverlay.querySelector('.subtitle-text');
    if (!textEl) return;

    // Find transcript at current time
    const transcript = state.project.transcripts.find(t => {
        return time >= t.start && time < (t.start + t.duration);
    });

    if (transcript) {
        textEl.textContent = transcript.text;
        elements.subtitleOverlay.style.display = 'flex';
    } else {
        elements.subtitleOverlay.style.display = 'none';
    }
}

// ==================== Utilities ====================

/**
 * Convert hex color to rgba
 */
function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ==================== Event Handlers ====================

/**
 * Handle font family change
 */
export function handleSubtitleFontChange(e) {
    state.subtitles.style.fontFamily = e.target.value;
    applySubtitleStyles();
}

/**
 * Handle font size change
 */
export function handleSubtitleSizeChange(e) {
    const size = parseInt(e.target.value);
    state.subtitles.style.fontSize = size;
    subtitleElements.sizeValue.textContent = `${size}px`;
    applySubtitleStyles();
}

/**
 * Handle text color change
 */
export function handleSubtitleColorChange(e) {
    state.subtitles.style.color = e.target.value;
    applySubtitleStyles();
}

/**
 * Handle background color change
 */
export function handleSubtitleBgColorChange(e) {
    state.subtitles.style.backgroundColor = e.target.value;
    applySubtitleStyles();
}

/**
 * Handle background opacity change
 */
export function handleSubtitleBgOpacityChange(e) {
    const opacity = parseInt(e.target.value);
    state.subtitles.style.backgroundOpacity = opacity;
    subtitleElements.bgOpacityValue.textContent = `${opacity}%`;
    applySubtitleStyles();
}

/**
 * Handle position change
 */
export function handleSubtitlePositionChange(e) {
    state.subtitles.style.position = e.target.value;
    applySubtitleStyles();
}

/**
 * Handle animation change
 */
export function handleSubtitleAnimationChange(e) {
    state.subtitles.style.animation = e.target.value;
    applySubtitleStyles();
}

/**
 * Generate subtitles from transcripts
 */
export function generateSubtitles() {
    if (state.project.transcripts.length === 0) {
        showToast('No transcripts available', 'warning');
        return;
    }

    // Enable subtitles
    state.subtitles.enabled = true;

    // Apply current style
    applySubtitleStyles();

    // Update display
    updateSubtitleDisplay(state.playback.currentTime);

    showToast(`Subtitles generated from ${state.project.transcripts.length} transcript segments`);
}

/**
 * Handle burn subtitles checkbox (for export)
 */
export function handleBurnSubtitles(e) {
    state.export.burnSubtitles = e.target.checked;
    if (e.target.checked) {
        showToast('Burning subtitles into video requires backend service', 'info');
        e.target.checked = false;
    }
}

// ==================== Initialization ====================

/**
 * Initialize subtitle system event listeners
 */
export function initializeSubtitleSystem() {
    if (subtitleElements.fontSelect) {
        subtitleElements.fontSelect.addEventListener('change', handleSubtitleFontChange);
    }
    if (subtitleElements.sizeSlider) {
        subtitleElements.sizeSlider.addEventListener('input', handleSubtitleSizeChange);
    }
    if (subtitleElements.colorInput) {
        subtitleElements.colorInput.addEventListener('change', handleSubtitleColorChange);
    }
    if (subtitleElements.bgColorInput) {
        subtitleElements.bgColorInput.addEventListener('change', handleSubtitleBgColorChange);
    }
    if (subtitleElements.bgOpacitySlider) {
        subtitleElements.bgOpacitySlider.addEventListener('input', handleSubtitleBgOpacityChange);
    }
    if (subtitleElements.positionSelect) {
        subtitleElements.positionSelect.addEventListener('change', handleSubtitlePositionChange);
    }
    if (subtitleElements.animationSelect) {
        subtitleElements.animationSelect.addEventListener('change', handleSubtitleAnimationChange);
    }
    if (subtitleElements.generateBtn) {
        subtitleElements.generateBtn.addEventListener('click', generateSubtitles);
    }
    if (subtitleElements.burnCheckbox) {
        subtitleElements.burnCheckbox.addEventListener('change', handleBurnSubtitles);
    }

    // Apply initial styles
    applySubtitleStyles();
}
