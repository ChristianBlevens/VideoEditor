/**
 * History Panel
 *
 * Visual timeline of all edit operations with preview capability
 */

import { state } from '../core/state.js';
import { historyManager } from '../operations/history-manager.js';
import { showToast } from './ui-utils.js';

/**
 * Initialize history panel
 */
export function initializeHistoryPanel() {
    const panel = document.getElementById('history-panel');
    if (!panel) return;

    // Update panel when history changes
    document.addEventListener('history-changed', renderHistoryPanel);

    // Initial render
    renderHistoryPanel();
}

/**
 * Render history panel with all commands
 */
export function renderHistoryPanel() {
    renderHistorySidebar();
    renderHistoryTimeline();
}

/**
 * Render history sidebar panel
 */
function renderHistorySidebar() {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;

    historyList.innerHTML = '';

    const history = historyManager.getHistory();
    const currentIndex = historyManager.getCurrentIndex();

    if (history.length === 0) {
        historyList.innerHTML = '<div class="history-empty">No edit history yet</div>';
        return;
    }

    history.forEach((command, index) => {
        const item = createHistoryItem(command, index, currentIndex);
        historyList.appendChild(item);
    });

    // Scroll to current item
    const currentItem = historyList.querySelector('.history-item.current');
    if (currentItem) {
        currentItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

/**
 * Render history timeline track (horizontal bar under markers)
 */
function renderHistoryTimeline() {
    const historyTrack = document.getElementById('history-track-content');
    if (!historyTrack) return;

    historyTrack.innerHTML = '';

    const history = historyManager.getHistory();
    const currentIndex = historyManager.getCurrentIndex();

    if (history.length === 0) {
        return;
    }

    history.forEach((command, index) => {
        const action = createHistoryAction(command, index, currentIndex);
        historyTrack.appendChild(action);
    });
}

/**
 * Create history action element for timeline
 */
function createHistoryAction(command, index, currentIndex) {
    const action = document.createElement('div');
    action.className = 'history-action';

    // Mark current position
    if (index === currentIndex) {
        action.classList.add('current-action');
    }

    // Mark future states (after current)
    if (index > currentIndex) {
        action.classList.add('future-action');
    }

    const icon = getCommandIcon(command.type);
    const description = command.description || command.type;

    action.innerHTML = `
        <i class="fas ${icon} history-action-icon"></i>
        <div class="history-action-label">${getShortLabel(command.type)}</div>
        <div class="history-action-tooltip">${description}</div>
    `;

    // Click to jump to this state
    action.addEventListener('click', () => {
        jumpToHistoryState(index);
    });

    return action;
}

/**
 * Get short label for command type
 */
function getShortLabel(commandType) {
    const labels = {
        'add': 'Add',
        'delete': 'Delete',
        'split': 'Split',
        'move': 'Move',
        'resize': 'Resize',
        'update': 'Edit',
        'group': 'Group'
    };

    return labels[commandType] || 'Edit';
}

/**
 * Create history item element
 */
function createHistoryItem(command, index, currentIndex) {
    const item = document.createElement('div');
    item.className = 'history-item';

    // Mark current position
    if (index === currentIndex) {
        item.classList.add('current');
    }

    // Mark future states (after current)
    if (index > currentIndex) {
        item.classList.add('future');
    }

    const icon = getCommandIcon(command.type);
    const timestamp = new Date(command.timestamp).toLocaleTimeString();

    item.innerHTML = `
        <div class="history-item-icon">
            <i class="fas ${icon}"></i>
        </div>
        <div class="history-item-content">
            <div class="history-item-title">${command.description || command.type}</div>
            <div class="history-item-time">${timestamp}</div>
        </div>
        <div class="history-item-actions">
            <button class="btn-icon-sm history-goto-btn" title="Jump to this state">
                <i class="fas fa-arrow-right"></i>
            </button>
        </div>
    `;

    // Click to jump to this state
    const gotoBtn = item.querySelector('.history-goto-btn');
    gotoBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        jumpToHistoryState(index);
    });

    return item;
}

/**
 * Get icon for command type
 */
function getCommandIcon(commandType) {
    const icons = {
        'add': 'fa-plus',
        'delete': 'fa-trash',
        'split': 'fa-cut',
        'move': 'fa-arrows-alt',
        'resize': 'fa-arrows-alt-h',
        'update': 'fa-edit',
        'group': 'fa-layer-group'
    };

    return icons[commandType] || 'fa-pen';
}

/**
 * Jump to specific history state
 */
function jumpToHistoryState(targetIndex) {
    const currentIndex = historyManager.getCurrentIndex();

    if (targetIndex === currentIndex) {
        return; // Already at this state
    }

    try {
        if (targetIndex < currentIndex) {
            // Go backwards
            const steps = currentIndex - targetIndex;
            for (let i = 0; i < steps; i++) {
                historyManager.undo();
            }
        } else {
            // Go forwards
            const steps = targetIndex - currentIndex;
            for (let i = 0; i < steps; i++) {
                historyManager.redo();
            }
        }

        showToast(`Jumped to history state #${targetIndex + 1}`, 'success');
        renderHistoryPanel();

    } catch (error) {
        console.error('[History] Failed to jump to state:', error);
        showToast('Failed to restore history state', 'error');
    }
}

/**
 * Clear all history
 */
export function clearHistory() {
    if (!confirm('Clear all edit history? This cannot be undone.')) {
        return;
    }

    historyManager.clear();
    renderHistoryPanel();
    showToast('History cleared');
}
