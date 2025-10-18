// ==================== Subtitle Canvas Renderer ====================
// Renders subtitles on canvas with advanced styling and effects

import { state } from '../../core/state.js';
import { getDefaultSubtitleStyle } from './subtitle-presets.js';

/**
 * Text measurement cache for performance
 */
const textMeasurementCache = new Map();

/**
 * Off-screen canvas cache for complex subtitles
 */
const subtitleCache = new Map();

/**
 * Find the active subtitle at the current playback time
 *
 * @param {number} currentTime - Current timeline time (seconds)
 * @returns {Object|null} - Active subtitle or null
 */
export function getActiveSubtitle(currentTime) {
    if (!state.project.subtitles || state.project.subtitles.length === 0) {
        return null;
    }

    return state.project.subtitles.find(sub =>
        currentTime >= sub.start && currentTime < sub.end
    );
}

/**
 * Render subtitle text on canvas with styling
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} subtitle - Subtitle object with text and style
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 * @param {number} currentTime - Current time for animations (optional)
 */
export function renderSubtitle(ctx, subtitle, canvasWidth, canvasHeight, currentTime = null) {
    if (!subtitle || !subtitle.text) {
        return;
    }

    const style = subtitle.style || getDefaultSubtitleStyle();

    // Apply fade in/out if currentTime provided
    if (currentTime !== null && style.fadeTime) {
        const opacity = calculateFadeOpacity(subtitle, currentTime, style.fadeTime);
        if (opacity <= 0) {
            return;
        }
        ctx.save();
        ctx.globalAlpha = opacity;
    }

    // Check if subtitle has word-level timestamps (karaoke mode)
    if (subtitle.words && subtitle.words.length > 0 && currentTime !== null) {
        renderKaraokeSubtitle(ctx, subtitle, canvasWidth, canvasHeight, currentTime);
    } else {
        renderPlainSubtitle(ctx, subtitle, canvasWidth, canvasHeight);
    }

    if (currentTime !== null && style.fadeTime) {
        ctx.restore();
    }
}

/**
 * Render plain subtitle (no word-level highlighting)
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} subtitle - Subtitle object
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 */
function renderPlainSubtitle(ctx, subtitle, canvasWidth, canvasHeight) {
    const style = subtitle.style || getDefaultSubtitleStyle();

    // Set text properties
    const fontString = `${style.fontWeight || 'bold'} ${style.fontSize || 32}px ${style.fontFamily || 'Arial'}`;
    ctx.font = fontString;
    ctx.textAlign = style.alignment || 'center';
    ctx.textBaseline = 'middle';

    // Calculate text dimensions with word wrapping
    const lines = wrapText(ctx, subtitle.text, canvasWidth * 0.9, fontString);
    const lineHeight = (style.fontSize || 32) * 1.2;
    const totalHeight = lines.length * lineHeight;

    // Calculate Y position based on style.position
    let y = calculateYPosition(style, canvasHeight, totalHeight);

    // Calculate X position
    const baseOffsetX = style.offsetX || 0;
    let x;
    if (style.alignment === 'left') {
        x = canvasWidth * 0.05 + baseOffsetX;
    } else if (style.alignment === 'right') {
        x = canvasWidth * 0.95 + baseOffsetX;
    } else {
        x = canvasWidth / 2 + baseOffsetX;
    }

    // Draw background box (optional)
    if (style.backgroundColor && style.backgroundColor !== 'transparent') {
        drawBackground(ctx, lines, x, y, lineHeight, totalHeight, style, canvasWidth);
    }

    // Draw text with stroke (outline)
    if (style.strokeWidth && style.strokeColor && style.strokeColor !== 'transparent') {
        ctx.strokeStyle = style.strokeColor;
        ctx.lineWidth = style.strokeWidth;

        lines.forEach((line, i) => {
            const lineY = y - totalHeight / 2 + i * lineHeight + lineHeight / 2;
            ctx.strokeText(line, x, lineY);
        });
    }

    // Draw text fill
    ctx.fillStyle = style.color || '#FFFFFF';
    lines.forEach((line, i) => {
        const lineY = y - totalHeight / 2 + i * lineHeight + lineHeight / 2;
        ctx.fillText(line, x, lineY);
    });
}

/**
 * Render karaoke-style subtitle with word-level highlighting
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} subtitle - Subtitle with words array
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 * @param {number} currentTime - Current timeline time
 */
function renderKaraokeSubtitle(ctx, subtitle, canvasWidth, canvasHeight, currentTime) {
    const style = subtitle.style || getDefaultSubtitleStyle();
    const words = subtitle.words;

    // Set text properties
    const fontString = `${style.fontWeight || 'bold'} ${style.fontSize || 32}px ${style.fontFamily || 'Arial'}`;
    ctx.font = fontString;
    ctx.textBaseline = 'middle';

    const lineHeight = (style.fontSize || 32) * 1.2;
    const y = calculateYPosition(style, canvasHeight, lineHeight);

    // Calculate total width of all words
    const totalWidth = words.reduce((sum, w) =>
        sum + getCachedTextMetrics(ctx, w.word + ' ', fontString).width, 0
    );

    // Start X position (centered with offset)
    const baseOffsetX = style.offsetX || 0;
    let x = (canvasWidth - totalWidth) / 2 + baseOffsetX;

    // Draw background if needed
    if (style.backgroundColor && style.backgroundColor !== 'transparent') {
        const padding = style.padding || 10;
        ctx.fillStyle = style.backgroundColor;
        ctx.fillRect(
            x - padding,
            y - lineHeight / 2 - padding,
            totalWidth + padding * 2,
            lineHeight + padding * 2
        );
    }

    // Draw each word
    words.forEach(wordObj => {
        const isActive = currentTime >= wordObj.start && currentTime < wordObj.end;
        const wordText = wordObj.word + ' ';

        // Set colors based on active state
        const fillColor = isActive ? (style.highlightColor || '#FFD700') : (style.color || '#FFFFFF');
        const strokeColor = isActive ? (style.highlightStroke || '#000000') : (style.strokeColor || '#000000');
        const strokeWidth = isActive ? (style.highlightStrokeWidth || 3) : (style.strokeWidth || 2);

        // Draw stroke
        if (strokeWidth && strokeColor && strokeColor !== 'transparent') {
            ctx.strokeStyle = strokeColor;
            ctx.lineWidth = strokeWidth;
            ctx.strokeText(wordText, x, y);
        }

        // Draw fill
        ctx.fillStyle = fillColor;
        ctx.fillText(wordText, x, y);

        // Move to next word position
        x += getCachedTextMetrics(ctx, wordText, fontString).width;
    });
}

/**
 * Calculate Y position based on subtitle position style
 *
 * @param {Object} style - Subtitle style
 * @param {number} canvasHeight - Canvas height
 * @param {number} totalHeight - Total subtitle height
 * @returns {number} - Y position
 */
function calculateYPosition(style, canvasHeight, totalHeight) {
    const baseOffsetY = style.offsetY || 0;

    if (style.position === 'top') {
        return 60 + totalHeight / 2 + baseOffsetY;
    } else if (style.position === 'middle' || style.position === 'center') {
        return canvasHeight / 2 + baseOffsetY;
    } else { // 'bottom' (default)
        return canvasHeight - 60 + baseOffsetY;
    }
}

/**
 * Draw background box for subtitle
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Array<string>} lines - Text lines
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {number} lineHeight - Line height
 * @param {number} totalHeight - Total height
 * @param {Object} style - Subtitle style
 * @param {number} canvasWidth - Canvas width
 */
function drawBackground(ctx, lines, x, y, lineHeight, totalHeight, style, canvasWidth) {
    const padding = style.padding || 10;

    // Find widest line
    const maxWidth = Math.max(...lines.map(line => ctx.measureText(line).width));

    // Calculate background rectangle
    let bgX, bgWidth;
    if (style.alignment === 'left') {
        bgX = x - padding;
        bgWidth = maxWidth + padding * 2;
    } else if (style.alignment === 'right') {
        bgX = x - maxWidth - padding;
        bgWidth = maxWidth + padding * 2;
    } else {
        bgX = (canvasWidth - maxWidth) / 2 - padding;
        bgWidth = maxWidth + padding * 2;
    }

    ctx.fillStyle = style.backgroundColor;
    ctx.fillRect(
        bgX,
        y - totalHeight / 2 - padding,
        bgWidth,
        totalHeight + padding * 2
    );
}

/**
 * Calculate fade opacity based on subtitle timing
 *
 * @param {Object} subtitle - Subtitle object
 * @param {number} currentTime - Current time
 * @param {number} fadeTime - Fade duration (seconds)
 * @returns {number} - Opacity (0.0 to 1.0)
 */
function calculateFadeOpacity(subtitle, currentTime, fadeTime = 0.3) {
    const timeSinceStart = currentTime - subtitle.start;
    const timeUntilEnd = subtitle.end - currentTime;

    let opacity = 1.0;

    if (timeSinceStart < fadeTime) {
        opacity = timeSinceStart / fadeTime; // Fade in
    } else if (timeUntilEnd < fadeTime) {
        opacity = timeUntilEnd / fadeTime; // Fade out
    }

    return Math.max(0, Math.min(1, opacity));
}

/**
 * Word-wrap text to fit within maxWidth
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} text - Text to wrap
 * @param {number} maxWidth - Maximum width
 * @param {string} font - Font string for caching
 * @returns {Array<string>} - Array of wrapped lines
 */
function wrapText(ctx, text, maxWidth, font) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
        const testLine = currentLine + ' ' + words[i];
        const metrics = getCachedTextMetrics(ctx, testLine, font);

        if (metrics.width > maxWidth) {
            lines.push(currentLine);
            currentLine = words[i];
        } else {
            currentLine = testLine;
        }
    }
    lines.push(currentLine);

    return lines;
}

/**
 * Get cached text metrics for performance
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {string} text - Text to measure
 * @param {string} font - Font string
 * @returns {TextMetrics} - Text metrics
 */
function getCachedTextMetrics(ctx, text, font) {
    const key = `${font}:${text}`;

    if (!textMeasurementCache.has(key)) {
        ctx.font = font;
        textMeasurementCache.set(key, ctx.measureText(text));
    }

    return textMeasurementCache.get(key);
}

/**
 * Get cached subtitle canvas for complex subtitles (performance optimization)
 *
 * @param {Object} subtitle - Subtitle object
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 * @returns {HTMLCanvasElement} - Pre-rendered subtitle canvas
 */
export function getCachedSubtitleCanvas(subtitle, canvasWidth, canvasHeight) {
    if (subtitleCache.has(subtitle.id)) {
        return subtitleCache.get(subtitle.id);
    }

    // Create off-screen canvas
    const offscreen = document.createElement('canvas');
    offscreen.width = canvasWidth;
    offscreen.height = canvasHeight;
    const offCtx = offscreen.getContext('2d');

    // Render subtitle to off-screen canvas
    renderPlainSubtitle(offCtx, subtitle, canvasWidth, canvasHeight);

    // Cache the result
    subtitleCache.set(subtitle.id, offscreen);

    return offscreen;
}

/**
 * Clear subtitle cache (call when subtitles change)
 */
export function clearSubtitleCache() {
    subtitleCache.clear();
    textMeasurementCache.clear();
}

/**
 * Render subtitle with fade effect
 * Wrapper function for backward compatibility
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas context
 * @param {Object} subtitle - Subtitle object
 * @param {number} canvasWidth - Canvas width
 * @param {number} canvasHeight - Canvas height
 * @param {number} currentTime - Current time
 */
export function renderSubtitleWithFade(ctx, subtitle, canvasWidth, canvasHeight, currentTime) {
    if (!subtitle) {
        return;
    }

    // Ensure style has fadeTime
    const style = subtitle.style || getDefaultSubtitleStyle();
    style.fadeTime = style.fadeTime || 0.3;

    renderSubtitle(ctx, subtitle, canvasWidth, canvasHeight, currentTime);
}
