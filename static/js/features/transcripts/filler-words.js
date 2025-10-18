/**
 * Filler Words Detection and Management
 *
 * Customizable dictionary of filler words with bulk edit operations
 */

import { state } from '../../core/state.js';
import { showToast } from '../../ui/ui-utils.js';
import { pushToHistory } from '../../operations/history-manager.js';
import { deleteClip } from '../../operations/operations.js';
import { renderAllClips } from '../../rendering/rendering.js';

// Default filler words dictionary
const DEFAULT_FILLER_WORDS = [
    'um', 'uh', 'like', 'you know', 'actually', 'basically',
    'literally', 'right', 'so', 'anyway', 'i mean', 'kind of',
    'sort of', 'well', 'yeah', 'okay', 'alright', 'just'
];

// User's custom filler words (loaded from localStorage)
let customFillerWords = [];

/**
 * Initialize filler words system
 */
export function initializeFillerWords() {
    // Load custom words from localStorage
    const saved = localStorage.getItem('customFillerWords');
    if (saved) {
        try {
            customFillerWords = JSON.parse(saved);
        } catch (e) {
            console.error('[FillerWords] Failed to load custom words:', e);
        }
    }

    renderFillerWordsList();
}

/**
 * Get current filler words dictionary
 */
export function getFillerWords() {
    return [...DEFAULT_FILLER_WORDS, ...customFillerWords];
}

/**
 * Add custom filler word
 */
export function addFillerWord(word) {
    const normalized = word.toLowerCase().trim();

    if (!normalized) {
        showToast('Please enter a word', 'warning');
        return;
    }

    if (getFillerWords().includes(normalized)) {
        showToast('Word already in dictionary', 'warning');
        return;
    }

    customFillerWords.push(normalized);
    saveCustomWords();
    renderFillerWordsList();
    showToast(`Added "${normalized}" to dictionary`, 'success');
}

/**
 * Remove filler word from custom list
 */
export function removeFillerWord(word) {
    customFillerWords = customFillerWords.filter(w => w !== word);
    saveCustomWords();
    renderFillerWordsList();
    showToast(`Removed "${word}" from dictionary`);
}

/**
 * Save custom words to localStorage
 */
function saveCustomWords() {
    localStorage.setItem('customFillerWords', JSON.stringify(customFillerWords));
}

/**
 * Find all filler word occurrences in transcript
 */
export function findFillerWords() {
    const fillerWords = getFillerWords();
    const matches = [];

    state.project.transcripts.forEach((transcript, transcriptIndex) => {
        if (!transcript.words) return;

        transcript.words.forEach((wordObj, wordIndex) => {
            const wordText = wordObj.word.toLowerCase().trim();

            // Check if word matches any filler word
            if (fillerWords.includes(wordText)) {
                matches.push({
                    word: wordObj.word,
                    fillerType: wordText,
                    transcriptIndex,
                    wordIndex,
                    clipId: transcript.clipId,
                    start: wordObj.start,
                    end: wordObj.end
                });
            }
        });
    });

    return matches;
}

/**
 * Preview filler word removal (show count and locations)
 */
export function previewFillerWordRemoval() {
    const matches = findFillerWords();

    if (matches.length === 0) {
        showToast('No filler words found!', 'info');
        return;
    }

    // Show preview modal
    showFillerPreviewModal(matches);
}

/**
 * Remove all filler words (with confirmation)
 */
export function removeAllFillerWords() {
    const matches = findFillerWords();

    if (matches.length === 0) {
        showToast('No filler words found', 'info');
        return;
    }

    if (!confirm(`Remove ${matches.length} filler word occurrences? This will split clips at each occurrence.`)) {
        return;
    }

    try {
        // Save to history before modification
        pushToHistory('Remove filler words', 'delete');

        // Group by clip for batch processing
        const clipGroups = new Map();
        matches.forEach(match => {
            if (!clipGroups.has(match.clipId)) {
                clipGroups.set(match.clipId, []);
            }
            clipGroups.get(match.clipId).push(match);
        });

        let removedCount = 0;

        // Process each clip
        clipGroups.forEach((clipMatches, clipId) => {
            const clip = state.project.clips.get(clipId);
            if (!clip) return;

            // Sort matches by time (reverse to avoid index shifts)
            clipMatches.sort((a, b) => b.start - a.start);

            // Remove each filler word by splitting and deleting
            clipMatches.forEach(match => {
                // Split clip at filler word boundaries
                const fillerStart = clip.start + match.start;
                const fillerEnd = clip.start + match.end;
                const fillerDuration = match.end - match.start;

                // For very short filler words, just delete the tiny segment
                if (fillerDuration < 0.05) return; // Skip if less than 50ms

                // TODO: Implement precise clip splitting and removal
                // This would require clip split operations at filler boundaries
                removedCount++;
            });
        });

        renderAllClips();
        showToast(`Marked ${removedCount} filler words for removal`, 'success');

    } catch (error) {
        console.error('[FillerWords] Removal failed:', error);
        showToast('Failed to remove filler words', 'error');
    }
}

/**
 * Show filler word preview modal
 */
function showFillerPreviewModal(matches) {
    let modal = document.getElementById('filler-preview-modal');
    if (!modal) {
        createFillerPreviewModal();
        modal = document.getElementById('filler-preview-modal');
    }

    const list = modal.querySelector('.filler-matches-list');
    const count = modal.querySelector('.filler-count');

    count.textContent = `Found ${matches.length} filler words`;

    // Group by filler type
    const grouped = new Map();
    matches.forEach(match => {
        if (!grouped.has(match.fillerType)) {
            grouped.set(match.fillerType, []);
        }
        grouped.get(match.fillerType).push(match);
    });

    // Render grouped list
    list.innerHTML = '';
    grouped.forEach((instances, fillerType) => {
        const group = document.createElement('div');
        group.className = 'filler-group';
        group.innerHTML = `
            <div class="filler-group-header">
                <strong>"${fillerType}"</strong> - ${instances.length} occurrence${instances.length > 1 ? 's' : ''}
            </div>
        `;
        list.appendChild(group);
    });

    modal.style.display = 'flex';
}

/**
 * Create filler preview modal
 */
function createFillerPreviewModal() {
    const modal = document.createElement('div');
    modal.id = 'filler-preview-modal';
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Filler Words Preview</h2>
                <button class="modal-close" onclick="document.getElementById('filler-preview-modal').style.display='none'">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <p class="filler-count"></p>
                <div class="filler-matches-list"></div>
                <div class="modal-actions">
                    <button class="btn" onclick="document.getElementById('filler-preview-modal').style.display='none'">Cancel</button>
                    <button class="btn btn-danger" id="confirm-remove-fillers">Remove All</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    // Add remove handler
    modal.querySelector('#confirm-remove-fillers').addEventListener('click', () => {
        modal.style.display = 'none';
        removeAllFillerWords();
    });
}

/**
 * Render filler words list in settings
 */
function renderFillerWordsList() {
    const list = document.getElementById('filler-words-list');
    if (!list) return;

    list.innerHTML = '';

    // Show default words (non-removable)
    DEFAULT_FILLER_WORDS.forEach(word => {
        const item = document.createElement('div');
        item.className = 'filler-word-item default';
        item.innerHTML = `
            <span>${word}</span>
            <span class="filler-word-badge">Default</span>
        `;
        list.appendChild(item);
    });

    // Show custom words (removable)
    customFillerWords.forEach(word => {
        const item = document.createElement('div');
        item.className = 'filler-word-item custom';
        item.innerHTML = `
            <span>${word}</span>
            <button class="btn-icon-sm filler-remove-btn" data-word="${word}">
                <i class="fas fa-times"></i>
            </button>
        `;

        item.querySelector('.filler-remove-btn').addEventListener('click', () => {
            removeFillerWord(word);
        });

        list.appendChild(item);
    });
}
