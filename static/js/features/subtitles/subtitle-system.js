// ==================== Subtitle System ====================
// Clip-specific subtitle styling and generation

import { state } from '../../core/state.js';
import { elements } from '../../rendering/dom-cache.js';
import { showToast } from '../../ui/ui-utils.js';
import { getClip } from '../../operations/operations.js';

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
    displayModeSelect: document.getElementById('subtitle-display-mode'),
    maxWordsInput: document.getElementById('subtitle-max-words'),
    maxWordsGroup: document.getElementById('max-words-group'),
    offsetXSlider: document.getElementById('subtitle-offset-x'),
    offsetXValue: document.getElementById('subtitle-offset-x-value'),
    offsetYSlider: document.getElementById('subtitle-offset-y'),
    offsetYValue: document.getElementById('subtitle-offset-y-value'),
    enableCheckbox: document.getElementById('enable-subtitles')
};

// ==================== Clip Subtitle Style Management ====================

/**
 * Get subtitle style for a clip (clip-specific or default)
 * @param {string} clipId - Clip ID
 * @returns {Object} Subtitle style object
 */
function getClipSubtitleStyle(clipId) {
    const clip = getClip(clipId);
    if (!clip) return state.subtitles.style;

    // Return clip-specific style or default
    return clip.subtitleStyle || state.subtitles.style;
}

/**
 * Get subtitle style for the selected clip (first selected clip if multiple)
 * @returns {Object|null} Subtitle style object or null if no clip selected
 */
function getSelectedClipSubtitleStyle() {
    if (state.selection.selectedClips.length === 0) return null;
    return getClipSubtitleStyle(state.selection.selectedClips[0]);
}

/**
 * Update subtitle style for the selected clip(s)
 * @param {Object} updates - Style properties to update
 */
function updateSelectedClipSubtitleStyle(updates) {
    if (state.selection.selectedClips.length === 0) {
        showToast('Please select a clip to configure subtitles', 'warning');
        return;
    }

    // Apply to all selected clips
    state.selection.selectedClips.forEach(clipId => {
        const clip = getClip(clipId);
        if (!clip) return;

        // Initialize subtitle style if it doesn't exist
        if (!clip.subtitleStyle) {
            clip.subtitleStyle = { ...state.subtitles.style };
        }

        // Apply updates
        Object.assign(clip.subtitleStyle, updates);
    });

    // Auto-regenerate subtitles with new settings
    convertTranscriptsToSubtitles();

    // Apply to display
    applySubtitleStyles();
}

/**
 * Load subtitle settings for the selected clip into UI controls
 */
export function loadSubtitleSettingsForSelectedClip() {
    const style = getSelectedClipSubtitleStyle();
    const headerLabel = document.getElementById('subtitles-selected-clip');

    if (!style) {
        // No clip selected - disable controls and show message
        disableSubtitleControls();
        if (headerLabel) {
            headerLabel.textContent = 'Select a clip to configure subtitles';
        }
        return;
    }

    // Enable controls and load values
    enableSubtitleControls();

    // Update header label with clip name or count
    if (headerLabel) {
        const selectedCount = state.selection.selectedClips.length;
        if (selectedCount === 1) {
            const clip = getClip(state.selection.selectedClips[0]);
            if (clip) {
                const clipName = clip.name || `Clip ${clip.id}`;
                headerLabel.textContent = `Subtitles for: ${clipName}`;
            } else {
                headerLabel.textContent = 'Select a clip to configure subtitles';
            }
        } else if (selectedCount > 1) {
            headerLabel.textContent = `${selectedCount} clips selected`;
        }
    }

    if (subtitleElements.fontSelect) {
        subtitleElements.fontSelect.value = style.fontFamily;
    }
    if (subtitleElements.sizeSlider) {
        subtitleElements.sizeSlider.value = style.fontSize;
        subtitleElements.sizeValue.textContent = `${style.fontSize}px`;
    }
    if (subtitleElements.colorInput) {
        subtitleElements.colorInput.value = style.color;
    }
    if (subtitleElements.bgColorInput) {
        subtitleElements.bgColorInput.value = style.backgroundColor;
    }
    if (subtitleElements.bgOpacitySlider) {
        subtitleElements.bgOpacitySlider.value = style.backgroundOpacity;
        subtitleElements.bgOpacityValue.textContent = `${style.backgroundOpacity}%`;
    }
    if (subtitleElements.positionSelect) {
        subtitleElements.positionSelect.value = style.position;
    }
    if (subtitleElements.animationSelect) {
        subtitleElements.animationSelect.value = style.animation;
    }
    if (subtitleElements.displayModeSelect) {
        subtitleElements.displayModeSelect.value = style.displayMode || 'full';
    }
    if (subtitleElements.maxWordsInput) {
        subtitleElements.maxWordsInput.value = style.maxWords || 4;
    }
    if (subtitleElements.offsetXSlider) {
        subtitleElements.offsetXSlider.value = style.offsetX || 0;
        subtitleElements.offsetXValue.textContent = `${style.offsetX || 0}px`;
    }
    if (subtitleElements.offsetYSlider) {
        subtitleElements.offsetYSlider.value = style.offsetY || 0;
        subtitleElements.offsetYValue.textContent = `${style.offsetY || 0}px`;
    }

    // Show/hide max words input based on display mode
    updateMaxWordsVisibility();
}

/**
 * Update visibility of max words input based on display mode
 */
function updateMaxWordsVisibility() {
    if (!subtitleElements.maxWordsGroup || !subtitleElements.displayModeSelect) return;

    const displayMode = subtitleElements.displayModeSelect.value;
    if (displayMode === 'max-words') {
        subtitleElements.maxWordsGroup.style.display = 'block';
    } else {
        subtitleElements.maxWordsGroup.style.display = 'none';
    }
}

/**
 * Disable subtitle controls when no clip is selected
 */
function disableSubtitleControls() {
    Object.values(subtitleElements).forEach(el => {
        if (el && el.tagName !== 'SPAN') {
            el.disabled = true;
        }
    });
}

/**
 * Enable subtitle controls when a clip is selected
 */
function enableSubtitleControls() {
    Object.values(subtitleElements).forEach(el => {
        if (el && el.tagName !== 'SPAN') {
            el.disabled = false;
        }
    });
}

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
    updateSelectedClipSubtitleStyle({ fontFamily: e.target.value });
}

/**
 * Handle font size change
 */
export function handleSubtitleSizeChange(e) {
    const size = parseInt(e.target.value);
    subtitleElements.sizeValue.textContent = `${size}px`;
    updateSelectedClipSubtitleStyle({ fontSize: size });
}

/**
 * Handle text color change
 */
export function handleSubtitleColorChange(e) {
    updateSelectedClipSubtitleStyle({ color: e.target.value });
}

/**
 * Handle background color change
 */
export function handleSubtitleBgColorChange(e) {
    updateSelectedClipSubtitleStyle({ backgroundColor: e.target.value });
}

/**
 * Handle background opacity change
 */
export function handleSubtitleBgOpacityChange(e) {
    const opacity = parseInt(e.target.value);
    subtitleElements.bgOpacityValue.textContent = `${opacity}%`;
    updateSelectedClipSubtitleStyle({ backgroundOpacity: opacity });
}

/**
 * Handle position change
 */
export function handleSubtitlePositionChange(e) {
    updateSelectedClipSubtitleStyle({ position: e.target.value });
}

/**
 * Handle animation change
 */
export function handleSubtitleAnimationChange(e) {
    updateSelectedClipSubtitleStyle({ animation: e.target.value });
}

/**
 * Handle display mode change
 */
export function handleSubtitleDisplayModeChange(e) {
    updateSelectedClipSubtitleStyle({ displayMode: e.target.value });
    updateMaxWordsVisibility();
}

/**
 * Handle max words change
 */
export function handleSubtitleMaxWordsChange(e) {
    const maxWords = parseInt(e.target.value);
    updateSelectedClipSubtitleStyle({ maxWords });
}

/**
 * Handle X offset change
 */
export function handleSubtitleOffsetXChange(e) {
    const offsetX = parseInt(e.target.value);
    subtitleElements.offsetXValue.textContent = `${offsetX}px`;
    updateSelectedClipSubtitleStyle({ offsetX });
}

/**
 * Handle Y offset change
 */
export function handleSubtitleOffsetYChange(e) {
    const offsetY = parseInt(e.target.value);
    subtitleElements.offsetYValue.textContent = `${offsetY}px`;
    updateSelectedClipSubtitleStyle({ offsetY });
}

/**
 * Handle enable/disable subtitles toggle
 */
export function handleEnableSubtitles(e) {
    const isEnabled = e.target.checked;

    // Set both flags to ensure consistency
    state.subtitles.enabled = isEnabled;
    state.playback.subtitlesEnabled = isEnabled;

    if (isEnabled) {
        // Convert transcripts to subtitles before enabling
        convertTranscriptsToSubtitles();
        console.log('[Subtitles] Enabled with', state.project.subtitles.length, 'subtitles');
    }

    // Update display immediately
    updateSubtitleDisplay(state.playback.currentTime);

    const status = isEnabled ? 'enabled' : 'disabled';
    showToast(`Subtitles ${status}`);
}

// ==================== Helper Functions ====================

/**
 * Convert transcripts to subtitles for canvas rendering
 * Transcripts are relative to clips, subtitles are in timeline coordinates
 * Each subtitle inherits the style from its parent clip
 */
export function convertTranscriptsToSubtitles() {
    const subtitles = [];
    let subtitleIdCounter = 0;

    for (const transcript of state.project.transcripts) {
        // Find the clip this transcript belongs to
        const clip = state.project.clips.get(transcript.clipId);
        if (!clip) {
            console.warn(`[Subtitles] Clip not found for transcript: ${transcript.clipId}`);
            continue;
        }

        // Get clip-specific subtitle style (or use defaults)
        const style = getClipSubtitleStyle(transcript.clipId);

        // Create base style object
        const styleObj = {
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            color: style.color,
            backgroundColor: style.backgroundColor,
            backgroundOpacity: style.backgroundOpacity,
            position: style.position,
            animation: style.animation,
            offsetX: style.offsetX || 0,
            offsetY: style.offsetY || 0
        };

        const displayMode = style.displayMode || 'full';

        if (displayMode === 'max-words' && transcript.words && transcript.words.length > 0) {
            // Group words into chunks of maxWords size
            const maxWords = style.maxWords || 4;
            const words = transcript.words;

            for (let i = 0; i < words.length; i += maxWords) {
                const chunk = words.slice(i, i + maxWords);
                const text = chunk.map(w => w.word).join(' ');
                const wordObjs = chunk.map(w => ({
                    word: w.word,
                    start: clip.start + w.start,
                    end: clip.start + w.end
                }));

                const subtitle = {
                    id: `${transcript.id}-g${subtitleIdCounter++}`,
                    start: clip.start + chunk[0].start,
                    end: clip.start + chunk[chunk.length - 1].end,
                    text: text,
                    words: wordObjs,
                    style: { ...styleObj }
                };
                subtitles.push(subtitle);
            }
        } else {
            // Full sentence mode (default)
            const timelineStart = clip.start + transcript.start;

            // Calculate duration from transcript's start/end or use last word's end time
            let duration;
            if (transcript.words && transcript.words.length > 0) {
                const lastWord = transcript.words[transcript.words.length - 1];
                duration = lastWord.end - transcript.start;
            } else {
                duration = (transcript.end || 0) - transcript.start;
            }
            const timelineEnd = timelineStart + duration;

            const subtitle = {
                id: transcript.id,
                start: timelineStart,
                end: timelineEnd,
                text: transcript.text,
                words: transcript.words ? transcript.words.map(w => ({
                    word: w.word,
                    start: clip.start + w.start,
                    end: clip.start + w.end
                })) : undefined,
                style: { ...styleObj }
            };
            subtitles.push(subtitle);
        }
    }

    // Update state
    state.project.subtitles = subtitles;

    // Log only on enable, not on every style change
    // console.log(`[Subtitles] Converted ${state.project.transcripts.length} transcripts to ${subtitles.length} subtitles`);

    return subtitles;
}

/**
 * Get active subtitle at given time (for canvas rendering)
 * This is exported for use by subtitle-renderer.js
 */
export function getActiveSubtitleForTime(time) {
    return state.project.subtitles.find(sub =>
        time >= sub.start && time < sub.end
    );
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
    if (subtitleElements.enableCheckbox) {
        subtitleElements.enableCheckbox.addEventListener('change', handleEnableSubtitles);
    }
    if (subtitleElements.displayModeSelect) {
        subtitleElements.displayModeSelect.addEventListener('change', handleSubtitleDisplayModeChange);
    }
    if (subtitleElements.maxWordsInput) {
        subtitleElements.maxWordsInput.addEventListener('change', handleSubtitleMaxWordsChange);
    }
    if (subtitleElements.offsetXSlider) {
        subtitleElements.offsetXSlider.addEventListener('input', handleSubtitleOffsetXChange);
    }
    if (subtitleElements.offsetYSlider) {
        subtitleElements.offsetYSlider.addEventListener('input', handleSubtitleOffsetYChange);
    }

    // Apply initial styles and visibility
    applySubtitleStyles();
    updateMaxWordsVisibility();
}
