/**
 * Interact.js Setup
 *
 * Main initialization for all interactions (drag, resize, click, etc.)
 */

import { dragClipStart, dragClipMove, dragClipEnd } from './clip-drag.js';
import { resizeClipMove, resizeClipEnd } from './clip-resize.js';
import { handleClipTap, handleClipDoubleTap } from './clip-selection.js';
import { dragInPointMove, dragInPointEnd, dragOutPointMove, dragOutPointEnd } from './markers-interaction.js';

// Re-export normalizeTimelinePositions for backward compatibility
export { normalizeTimelinePositions } from './position-normalizer.js';

/**
 * Initialize all Interact.js interactions
 */
export function initializeInteract() {
    // Draggable and resizable clips (excluding attached audio clips)
    interact('.clip:not(.attached-audio-clip)')
        .draggable({
            listeners: {
                start: dragClipStart,
                move: dragClipMove,
                end: dragClipEnd
            },
            modifiers: [],
            inertia: false
        })
        .resizable({
            edges: { left: '.clip-handle-left', right: '.clip-handle-right' },
            listeners: {
                move: resizeClipMove,
                end: resizeClipEnd
            },
            modifiers: [
                interact.modifiers.restrictSize({
                    min: { width: 50 }
                })
            ]
        })
        .on('tap', handleClipTap)
        .on('doubletap', handleClipDoubleTap);

    // Draggable in/out points
    interact('#in-point-marker').draggable({
        axis: 'x',
        listeners: {
            move: dragInPointMove,
            end: dragInPointEnd
        }
    });

    interact('#out-point-marker').draggable({
        axis: 'x',
        listeners: {
            move: dragOutPointMove,
            end: dragOutPointEnd
        }
    });
}
