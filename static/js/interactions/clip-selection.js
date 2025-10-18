/**
 * Clip Selection System
 *
 * Handles clip selection, multi-selection, and click/tap events
 */

import { selectClip } from '../operations/clip-operations.js';
import { startClipRename } from '../rendering/rendering.js';

/**
 * Handle clip tap (single click)
 */
export async function handleClipTap(event) {
    // Don't select clip if clicking on an action indicator
    if (event.target.closest('.clip-action-indicator')) {
        console.log('[INTERACT] Ignoring tap on action indicator');
        return;
    }

    // Don't select clip if clicking on the clip name (for rename functionality)
    if (event.target.classList.contains('clip-name')) {
        console.log('[INTERACT] Ignoring tap on clip name');
        return;
    }

    // Find the clip element (event.target might be a child element)
    const clipElement = event.target.closest('.clip');
    if (clipElement) {
        const clipId = clipElement.getAttribute('data-clip-id');

        // Check if Ctrl/Cmd key is held for multi-select
        if (event.ctrlKey || event.metaKey) {
            // Multi-select: toggle this clip in selection
            const { toggleClipSelection } = await import('../operations/operations.js');
            const { renderAllClips } = await import('../rendering/rendering.js');
            const { renderClipProperties } = await import('../features/properties/clip-properties.js');

            toggleClipSelection(clipId);
            await renderAllClips();
            renderClipProperties();
        } else {
            // Normal click: replace selection with this clip
            selectClip(clipElement);
        }
    }
}

/**
 * Handle clip double-tap (double click)
 */
export function handleClipDoubleTap(event) {
    // Check if double-tapping on clip name
    if (event.target.classList.contains('clip-name')) {
        const clipElement = event.target.closest('.clip');
        if (clipElement) {
            const clipId = clipElement.getAttribute('data-clip-id');
            startClipRename(clipId, event.target);
        }
    }
}
