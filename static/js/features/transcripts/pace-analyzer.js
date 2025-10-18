/**
 * Pace Analysis & Optimization
 *
 * Analyze speaking pace (words per minute) and identify fast/slow sections
 */

import { state } from '../../core/state.js';
import { showToast } from '../../ui/ui-utils.js';
import { renderAllClips } from '../../rendering/rendering.js';

/**
 * Calculate words per minute for a transcript segment
 */
export function calculateWPM(transcript) {
    if (!transcript.words || transcript.words.length === 0) {
        return 0;
    }

    const duration = transcript.duration || (transcript.end - transcript.start);
    const wordCount = transcript.words.length;

    // WPM = (words / seconds) * 60
    return (wordCount / duration) * 60;
}

/**
 * Analyze pace across selected clips only
 */
export function analyzePace() {
    const paceData = [];
    const selectedClipIds = state.selection.selectedClips;

    // If no clips selected, return empty
    if (selectedClipIds.length === 0) {
        return [];
    }

    state.project.transcripts.forEach((transcript, index) => {
        // Only include transcripts for selected clips
        if (!selectedClipIds.includes(transcript.clipId)) {
            return;
        }

        const wpm = calculateWPM(transcript);
        const clip = state.project.clips.get(transcript.clipId);

        paceData.push({
            transcriptIndex: index,
            clipId: transcript.clipId,
            clipName: clip?.name || `Clip ${transcript.clipId}`,
            start: transcript.start,
            duration: transcript.duration,
            wpm: wpm,
            wordCount: transcript.words?.length || 0,
            category: categorizePace(wpm)
        });
    });

    return paceData;
}

/**
 * Categorize pace as slow/normal/fast
 */
function categorizePace(wpm) {
    if (wpm < 120) return 'slow';
    if (wpm > 180) return 'fast';
    return 'normal';
}

/**
 * Show pace analysis visualization in transcript tab
 */
export function showPaceAnalysis() {
    const paceData = analyzePace();

    if (paceData.length === 0) {
        hidePaceResults();
        return;
    }

    // Calculate statistics
    const avgWPM = paceData.reduce((sum, p) => sum + p.wpm, 0) / paceData.length;
    const slowSections = paceData.filter(p => p.category === 'slow').length;
    const fastSections = paceData.filter(p => p.category === 'fast').length;

    // Render results in transcript tab
    renderPaceResults(paceData, avgWPM, slowSections, fastSections);
}

/**
 * Hide pace analysis results
 */
function hidePaceResults() {
    const resultsContainer = document.getElementById('pace-analysis-results');
    if (resultsContainer) {
        resultsContainer.style.display = 'none';
    }
}

/**
 * Render pace analysis results in transcript tab
 */
function renderPaceResults(paceData, avgWPM, slowCount, fastCount) {
    const resultsContainer = document.getElementById('pace-analysis-results');
    if (!resultsContainer) return;

    resultsContainer.innerHTML = `
        <div class="pace-stats" style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 15px;">
            <div class="pace-stat" style="background: #2a2a2a; padding: 12px; border-radius: 6px; text-align: center;">
                <div class="pace-stat-value" style="font-size: 24px; font-weight: bold; color: #4CAF50;">${Math.round(avgWPM)}</div>
                <div class="pace-stat-label" style="font-size: 11px; color: #888; margin-top: 4px;">Avg WPM</div>
            </div>
            <div class="pace-stat pace-slow" style="background: #2a2a2a; padding: 12px; border-radius: 6px; text-align: center;">
                <div class="pace-stat-value" style="font-size: 24px; font-weight: bold; color: #FF9800;">${slowCount}</div>
                <div class="pace-stat-label" style="font-size: 11px; color: #888; margin-top: 4px;">Slow Sections</div>
            </div>
            <div class="pace-stat pace-fast" style="background: #2a2a2a; padding: 12px; border-radius: 6px; text-align: center;">
                <div class="pace-stat-value" style="font-size: 24px; font-weight: bold; color: #f44336;">${fastCount}</div>
                <div class="pace-stat-label" style="font-size: 11px; color: #888; margin-top: 4px;">Fast Sections</div>
            </div>
        </div>
        <div class="pace-segments-list" style="max-height: 200px; overflow-y: auto; background: #1a1a1a; border-radius: 6px; padding: 10px;">
            ${renderPaceSegmentsList(paceData)}
        </div>
    `;

    resultsContainer.style.display = 'block';
}

/**
 * Render list of pace segments
 */
function renderPaceSegmentsList(paceData) {
    return paceData.map(segment => {
        const colorClass = segment.category === 'slow' ? '#FF9800'
                         : segment.category === 'fast' ? '#f44336'
                         : '#4CAF50';

        const categoryLabel = segment.category === 'slow' ? 'Slow'
                            : segment.category === 'fast' ? 'Fast'
                            : 'Normal';

        return `
            <div class="pace-segment-item" style="display: flex; justify-content: space-between; align-items: center; padding: 8px; margin-bottom: 6px; background: #2a2a2a; border-radius: 4px; border-left: 3px solid ${colorClass};">
                <div>
                    <div style="font-size: 12px; font-weight: 600; color: #fff;">${segment.clipName}</div>
                    <div style="font-size: 11px; color: #888;">${formatTime(segment.duration)} • ${segment.wordCount} words</div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 14px; font-weight: bold; color: ${colorClass};">${Math.round(segment.wpm)}</div>
                    <div style="font-size: 10px; color: #888;">${categoryLabel}</div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Format time in seconds to MM:SS
 */
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Create pace analysis modal
 */
function showPaceModal(paceData, avgWPM, slowCount, fastCount) {
    let modal = document.getElementById('pace-analysis-modal');

    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'pace-analysis-modal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    modal.innerHTML = `
        <div class="modal-content modal-large">
            <div class="modal-header">
                <h2>Pace Analysis</h2>
                <button class="modal-close" onclick="document.getElementById('pace-analysis-modal').style.display='none'">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="pace-stats">
                    <div class="pace-stat">
                        <div class="pace-stat-value">${Math.round(avgWPM)}</div>
                        <div class="pace-stat-label">Average WPM</div>
                    </div>
                    <div class="pace-stat pace-slow">
                        <div class="pace-stat-value">${slowCount}</div>
                        <div class="pace-stat-label">Slow Sections</div>
                    </div>
                    <div class="pace-stat pace-fast">
                        <div class="pace-stat-value">${fastCount}</div>
                        <div class="pace-stat-label">Fast Sections</div>
                    </div>
                </div>

                <div class="pace-timeline">
                    ${renderPaceTimeline(paceData)}
                </div>

                <div class="modal-actions">
                    <button class="btn" onclick="document.getElementById('pace-analysis-modal').style.display='none'">Close</button>
                    <button class="btn btn-primary" id="auto-balance-pace-btn">
                        <i class="fas fa-magic"></i> Auto-Balance Pace
                    </button>
                </div>
            </div>
        </div>
    `;

    modal.style.display = 'flex';

    // Auto-balance handler
    modal.querySelector('#auto-balance-pace-btn').addEventListener('click', () => autoBalancePace(paceData));
}

/**
 * Render pace timeline visualization
 */
function renderPaceTimeline(paceData) {
    return paceData.map(segment => {
        const colorClass = segment.category === 'slow' ? 'pace-bar-slow'
                         : segment.category === 'fast' ? 'pace-bar-fast'
                         : 'pace-bar-normal';

        return `
            <div class="pace-segment" title="${segment.clipName}: ${Math.round(segment.wpm)} WPM">
                <div class="pace-bar ${colorClass}" style="height: ${Math.min(segment.wpm / 2, 100)}px">
                    <span class="pace-wpm">${Math.round(segment.wpm)}</span>
                </div>
                <div class="pace-label">${segment.clipName}</div>
            </div>
        `;
    }).join('');
}

/**
 * Auto-balance pace by adjusting clip speeds
 */
function autoBalancePace(paceData) {
    const targetWPM = 150; // Target pace

    let adjustedCount = 0;

    paceData.forEach(segment => {
        if (segment.category === 'normal') return;

        const clip = state.project.clips.get(segment.clipId);
        if (!clip) return;

        // Calculate speed adjustment
        const speedMultiplier = segment.wpm / targetWPM;
        const newSpeed = Math.max(50, Math.min(200, clip.speed * speedMultiplier));

        // Update clip speed
        clip.speed = Math.round(newSpeed);
        adjustedCount++;
    });

    renderAllClips();

    showToast(`Adjusted pace for ${adjustedCount} sections`, 'success');
    document.getElementById('pace-analysis-modal').style.display = 'none';
}
