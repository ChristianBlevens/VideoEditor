/**
 * Export Presets for Social Media
 *
 * Platform-specific export configurations
 */

export const EXPORT_PRESETS = {
    'youtube-hd': {
        name: 'YouTube HD',
        width: 1920,
        height: 1080,
        aspectRatio: '16:9',
        codec: 'h264',
        bitrate: '8M',
        maxLength: null, // No limit
        fps: 30
    },
    'youtube-4k': {
        name: 'YouTube 4K',
        width: 3840,
        height: 2160,
        aspectRatio: '16:9',
        codec: 'h265',
        bitrate: '20M',
        maxLength: null,
        fps: 60
    },
    'youtube-short': {
        name: 'YouTube Shorts',
        width: 1080,
        height: 1920,
        aspectRatio: '9:16',
        codec: 'h264',
        bitrate: '6M',
        maxLength: 60, // 60 seconds max
        fps: 30
    },
    'tiktok': {
        name: 'TikTok',
        width: 1080,
        height: 1920,
        aspectRatio: '9:16',
        codec: 'h264',
        bitrate: '6M',
        maxLength: 600, // 10 minutes max
        fps: 30
    },
    'instagram-feed': {
        name: 'Instagram Feed',
        width: 1080,
        height: 1080,
        aspectRatio: '1:1',
        codec: 'h264',
        bitrate: '5M',
        maxLength: 60,
        fps: 30
    },
    'instagram-story': {
        name: 'Instagram Story',
        width: 1080,
        height: 1920,
        aspectRatio: '9:16',
        codec: 'h264',
        bitrate: '5M',
        maxLength: 60,
        fps: 30
    },
    'instagram-reel': {
        name: 'Instagram Reel',
        width: 1080,
        height: 1920,
        aspectRatio: '9:16',
        codec: 'h264',
        bitrate: '6M',
        maxLength: 90,
        fps: 30
    },
    'twitter': {
        name: 'Twitter/X',
        width: 1280,
        height: 720,
        aspectRatio: '16:9',
        codec: 'h264',
        bitrate: '5M',
        maxLength: 140,
        fps: 30
    },
    'facebook': {
        name: 'Facebook',
        width: 1280,
        height: 720,
        aspectRatio: '16:9',
        codec: 'h264',
        bitrate: '4M',
        maxLength: null,
        fps: 30
    }
};

/**
 * Get preset configuration
 */
export function getPreset(presetId) {
    return EXPORT_PRESETS[presetId] || null;
}

/**
 * Apply preset to export modal UI
 */
export function applyPresetToUI(presetId) {
    const preset = getPreset(presetId);
    if (!preset) {
        // Show custom settings
        document.getElementById('custom-export-settings').style.display = 'block';
        document.getElementById('preset-info').style.display = 'none';
        return;
    }

    // Hide custom settings
    document.getElementById('custom-export-settings').style.display = 'none';

    // Show preset info
    const presetInfo = document.getElementById('preset-info');
    presetInfo.style.display = 'block';

    document.getElementById('preset-resolution').textContent = `${preset.width}×${preset.height}`;
    document.getElementById('preset-aspect').textContent = preset.aspectRatio;
    document.getElementById('preset-length').textContent = preset.maxLength
        ? `${preset.maxLength}s`
        : 'No limit';

    // Update estimate based on preset
    updateExportEstimate(preset);
}

/**
 * Update export estimates
 */
function updateExportEstimate(preset) {
    // Rough estimation based on bitrate and timeline duration
    const timelineDuration = 120; // TODO: Get actual timeline duration

    const fileSizeMB = (preset.bitrate.replace('M', '') * timelineDuration) / 8;
    const estimatedTime = Math.ceil(timelineDuration / 2); // Rough 2x realtime

    document.getElementById('estimate-size').textContent = `~${Math.round(fileSizeMB)} MB`;
    document.getElementById('estimate-time').textContent = `~${estimatedTime} seconds`;
}

/**
 * Initialize export presets
 */
export function initializeExportPresets() {
    const presetSelect = document.getElementById('export-preset');

    if (!presetSelect) {
        console.warn('[ExportPresets] Export preset select not found');
        return;
    }

    presetSelect.addEventListener('change', (e) => {
        const presetId = e.target.value;
        if (presetId === 'custom') {
            applyPresetToUI(null);
        } else {
            applyPresetToUI(presetId);
        }
    });

    // Initial state
    applyPresetToUI(null);
}
