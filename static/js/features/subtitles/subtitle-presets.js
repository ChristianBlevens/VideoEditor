// ==================== Subtitle Style Presets ====================
// Common subtitle styling presets for different use cases

/**
 * Subtitle style presets
 * Each preset defines the default styling for subtitle rendering
 */
export const SUBTITLE_PRESETS = {
    youtube: {
        name: 'YouTube',
        fontFamily: 'Roboto, Arial, sans-serif',
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFFFFF',
        strokeColor: '#000000',
        strokeWidth: 2,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        padding: 8,
        position: 'bottom',
        alignment: 'center',
        offsetY: 60
    },

    netflix: {
        name: 'Netflix',
        fontFamily: 'Netflix Sans, Arial, sans-serif',
        fontSize: 32,
        fontWeight: 'normal',
        color: '#FFFFFF',
        strokeColor: '#000000',
        strokeWidth: 2.5,
        backgroundColor: 'transparent',
        padding: 0,
        position: 'bottom',
        alignment: 'center',
        offsetY: 80
    },

    classic: {
        name: 'Classic',
        fontFamily: 'Times New Roman, serif',
        fontSize: 30,
        fontWeight: 'normal',
        color: '#FFFF00',
        strokeColor: '#000000',
        strokeWidth: 1,
        backgroundColor: 'transparent',
        padding: 0,
        position: 'bottom',
        alignment: 'center',
        offsetY: 50
    },

    minimal: {
        name: 'Minimal',
        fontFamily: 'Arial, sans-serif',
        fontSize: 24,
        fontWeight: 'normal',
        color: '#FFFFFF',
        strokeColor: 'transparent',
        strokeWidth: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        padding: 12,
        position: 'bottom',
        alignment: 'center',
        offsetY: 40
    },

    karaoke: {
        name: 'Karaoke',
        fontFamily: 'Arial, sans-serif',
        fontSize: 32,
        fontWeight: 'bold',
        color: '#FFFFFF',
        strokeColor: '#000000',
        strokeWidth: 3,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        padding: 10,
        position: 'bottom',
        alignment: 'center',
        offsetY: 70,
        // Karaoke-specific
        highlightColor: '#FFD700',
        highlightStroke: '#000000',
        highlightStrokeWidth: 4
    },

    broadcast: {
        name: 'Broadcast',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: 36,
        fontWeight: 'bold',
        color: '#FFFFFF',
        strokeColor: '#000000',
        strokeWidth: 3,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 15,
        position: 'bottom',
        alignment: 'center',
        offsetY: 100
    },

    accessibility: {
        name: 'Accessibility (High Contrast)',
        fontFamily: 'Arial, sans-serif',
        fontSize: 34,
        fontWeight: 'bold',
        color: '#FFFFFF',
        strokeColor: '#000000',
        strokeWidth: 4,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        padding: 20,
        position: 'bottom',
        alignment: 'center',
        offsetY: 80
    },

    top: {
        name: 'Top Position',
        fontFamily: 'Arial, sans-serif',
        fontSize: 28,
        fontWeight: 'bold',
        color: '#FFFFFF',
        strokeColor: '#000000',
        strokeWidth: 2,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        padding: 8,
        position: 'top',
        alignment: 'center',
        offsetY: 60
    },

    bottom_left: {
        name: 'Bottom Left',
        fontFamily: 'Arial, sans-serif',
        fontSize: 26,
        fontWeight: 'normal',
        color: '#FFFFFF',
        strokeColor: '#000000',
        strokeWidth: 2,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        padding: 10,
        position: 'bottom',
        alignment: 'left',
        offsetY: 50
    }
};

/**
 * Get default subtitle style
 *
 * @returns {Object} - Default subtitle style
 */
export function getDefaultSubtitleStyle() {
    return { ...SUBTITLE_PRESETS.youtube };
}

/**
 * Get list of preset names for UI
 *
 * @returns {Array<string>} - Array of preset keys
 */
export function getPresetNames() {
    return Object.keys(SUBTITLE_PRESETS);
}

/**
 * Get preset by name
 *
 * @param {string} presetName - Preset key
 * @returns {Object|null} - Preset style or null if not found
 */
export function getPreset(presetName) {
    return SUBTITLE_PRESETS[presetName] ? { ...SUBTITLE_PRESETS[presetName] } : null;
}

/**
 * Merge custom style with preset
 *
 * @param {string} presetName - Preset key
 * @param {Object} customStyle - Custom style overrides
 * @returns {Object} - Merged style
 */
export function mergeWithPreset(presetName, customStyle = {}) {
    const preset = getPreset(presetName) || getDefaultSubtitleStyle();
    return { ...preset, ...customStyle };
}
