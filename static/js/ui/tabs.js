// ==================== Tab Management ====================
// Data-driven tabs with unified rendering

import { state } from '../core/state.js';
import { elements } from '../rendering/dom-cache.js';

export function initializeTabs() {
    elements.tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.getAttribute('data-tab');
            switchTab(tabName);
        });
    });

    // Initial render
    renderTabs();
}

/**
 * Switch active tab
 * @param {string} tabName
 */
export function switchTab(tabName) {
    // Update state
    state.ui.activeTab = tabName;

    // Render from state
    renderTabs();
}

/**
 * Render tabs from state (unified rendering)
 */
function renderTabs() {
    const activeTab = state.ui.activeTab;

    // Update button states
    elements.tabBtns.forEach(btn => {
        const isActive = btn.getAttribute('data-tab') === activeTab;
        btn.classList.toggle('active', isActive);
    });

    // Update content states
    elements.tabContents.forEach(content => {
        const contentId = content.id.replace('-panel', '');
        const isActive = contentId === activeTab;
        content.classList.toggle('active', isActive);
    });
}
