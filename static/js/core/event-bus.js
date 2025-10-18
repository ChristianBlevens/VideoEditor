/**
 * Event Bus System
 *
 * Provides a centralized event system for decoupled communication between modules.
 * Implements the Observer/Publisher-Subscriber pattern.
 */

class EventBus {
    constructor() {
        this.listeners = new Map();
        this.debugMode = false;
    }

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @param {Object} options - Options { priority: number, once: boolean }
     * @returns {Function} Unsubscribe function
     */
    on(event, callback, options = {}) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }

        const listener = {
            callback,
            priority: options.priority || 0,
            once: options.once || false
        };

        const listeners = this.listeners.get(event);
        listeners.push(listener);

        // Sort by priority (higher priority first)
        listeners.sort((a, b) => b.priority - a.priority);

        if (this.debugMode) {
            console.log(`[EventBus] Subscribed to "${event}"`, { priority: listener.priority, once: listener.once });
        }

        // Return unsubscribe function
        return () => this.off(event, callback);
    }

    /**
     * Subscribe to an event (fires once then unsubscribes)
     * @param {string} event - Event name
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    once(event, callback) {
        return this.on(event, callback, { once: true });
    }

    /**
     * Unsubscribe from an event
     * @param {string} event - Event name
     * @param {Function} callback - Callback function to remove
     */
    off(event, callback) {
        if (!this.listeners.has(event)) return;

        const listeners = this.listeners.get(event);
        const index = listeners.findIndex(l => l.callback === callback);

        if (index !== -1) {
            listeners.splice(index, 1);

            if (this.debugMode) {
                console.log(`[EventBus] Unsubscribed from "${event}"`);
            }
        }

        // Clean up empty listener arrays
        if (listeners.length === 0) {
            this.listeners.delete(event);
        }
    }

    /**
     * Emit an event
     * @param {string} event - Event name
     * @param {*} data - Event data
     * @param {Object} options - Options { async: boolean }
     */
    emit(event, data, options = {}) {
        if (!this.listeners.has(event)) {
            if (this.debugMode) {
                console.log(`[EventBus] No listeners for "${event}"`);
            }
            return;
        }

        const listeners = [...this.listeners.get(event)];

        if (this.debugMode) {
            console.log(`[EventBus] Emitting "${event}"`, { listeners: listeners.length, data });
        }

        const execute = () => {
            for (const listener of listeners) {
                try {
                    listener.callback(data);
                } catch (error) {
                    console.error(`[EventBus] Error in listener for "${event}":`, error);
                }

                // Remove one-time listeners
                if (listener.once) {
                    this.off(event, listener.callback);
                }
            }
        };

        if (options.async) {
            setTimeout(execute, 0);
        } else {
            execute();
        }
    }

    /**
     * Remove all listeners for an event (or all events if no event specified)
     * @param {string} [event] - Optional event name
     */
    clear(event) {
        if (event) {
            this.listeners.delete(event);
            if (this.debugMode) {
                console.log(`[EventBus] Cleared all listeners for "${event}"`);
            }
        } else {
            this.listeners.clear();
            if (this.debugMode) {
                console.log('[EventBus] Cleared all listeners');
            }
        }
    }

    /**
     * Get listener count for an event
     * @param {string} event - Event name
     * @returns {number} Number of listeners
     */
    listenerCount(event) {
        return this.listeners.has(event) ? this.listeners.get(event).length : 0;
    }

    /**
     * Enable/disable debug mode
     * @param {boolean} enabled - Debug mode enabled
     */
    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`[EventBus] Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }
}

// Create and export singleton instance
export const eventBus = new EventBus();

// Export standard event names as constants to prevent typos
export const Events = {
    // State events
    STATE_CHANGED: 'state:changed',
    STATE_CLIP_ADDED: 'state:clip:added',
    STATE_CLIP_UPDATED: 'state:clip:updated',
    STATE_CLIP_DELETED: 'state:clip:deleted',
    STATE_TRANSCRIPT_ADDED: 'state:transcript:added',
    STATE_TRANSCRIPT_UPDATED: 'state:transcript:updated',
    STATE_SUBTITLE_UPDATED: 'state:subtitle:updated',
    STATE_MARKER_ADDED: 'state:marker:added',
    STATE_MARKER_DELETED: 'state:marker:deleted',

    // Playback events
    PLAYBACK_PLAY: 'playback:play',
    PLAYBACK_PAUSE: 'playback:pause',
    PLAYBACK_TIME_UPDATE: 'playback:time:update',
    PLAYBACK_RATE_CHANGE: 'playback:rate:change',
    PLAYBACK_SEEK: 'playback:seek',

    // Timeline events
    TIMELINE_ZOOM: 'timeline:zoom',
    TIMELINE_SCROLL: 'timeline:scroll',
    TIMELINE_CLIP_MOVED: 'timeline:clip:moved',
    TIMELINE_CLIP_RESIZED: 'timeline:clip:resized',

    // UI events
    UI_PANEL_CHANGED: 'ui:panel:changed',
    UI_TOAST_SHOW: 'ui:toast:show',
    UI_TOAST_HIDE: 'ui:toast:hide',

    // Project events
    PROJECT_LOADED: 'project:loaded',
    PROJECT_SAVED: 'project:saved',
    PROJECT_MEDIA_ADDED: 'project:media:added',

    // Render events
    RENDER_NEEDED: 'render:needed',
    RENDER_COMPLETE: 'render:complete',

    // History events
    HISTORY_UNDO: 'history:undo',
    HISTORY_REDO: 'history:redo',
    HISTORY_STATE_CHANGED: 'history:state:changed'
};
