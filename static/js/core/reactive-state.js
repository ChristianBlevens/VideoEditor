/**
 * Reactive State Management
 *
 * Wraps the application state with Proxy-based change detection.
 * Automatically emits events when state changes occur.
 */

import { eventBus, Events } from './event-bus.js';

/**
 * Create a reactive proxy around an object
 * @param {Object} target - The object to make reactive
 * @param {string} path - The path to this object in the state tree
 * @param {Function} onChange - Callback when changes occur
 * @returns {Proxy} Reactive proxy
 */
function createReactiveProxy(target, path = '', onChange) {
    // Don't proxy primitives or already-proxied objects
    if (typeof target !== 'object' || target === null || target.__isProxy) {
        return target;
    }

    // Special handling for Map
    if (target instanceof Map) {
        return createReactiveMap(target, path, onChange);
    }

    // Special handling for Array
    if (Array.isArray(target)) {
        return createReactiveArray(target, path, onChange);
    }

    const proxy = new Proxy(target, {
        get(obj, prop) {
            // Mark as proxy
            if (prop === '__isProxy') {
                return true;
            }

            // Return original target
            if (prop === '__target') {
                return obj;
            }

            const value = obj[prop];

            // Make nested objects reactive
            if (typeof value === 'object' && value !== null && !value.__isProxy) {
                const nestedPath = path ? `${path}.${String(prop)}` : String(prop);
                obj[prop] = createReactiveProxy(value, nestedPath, onChange);
                return obj[prop];
            }

            return value;
        },

        set(obj, prop, value) {
            const oldValue = obj[prop];

            // Only trigger if value actually changed
            if (oldValue === value) {
                return true;
            }

            // Make new value reactive if it's an object
            if (typeof value === 'object' && value !== null && !value.__isProxy) {
                const nestedPath = path ? `${path}.${String(prop)}` : String(prop);
                value = createReactiveProxy(value, nestedPath, onChange);
            }

            obj[prop] = value;

            // Notify change
            const changePath = path ? `${path}.${String(prop)}` : String(prop);
            onChange(changePath, value, oldValue);

            return true;
        },

        deleteProperty(obj, prop) {
            const oldValue = obj[prop];
            delete obj[prop];

            // Notify change
            const changePath = path ? `${path}.${String(prop)}` : String(prop);
            onChange(changePath, undefined, oldValue);

            return true;
        }
    });

    return proxy;
}

/**
 * Create a reactive Map
 */
function createReactiveMap(map, path, onChange) {
    const reactiveMap = new Map(map);

    // Store original methods
    const originalSet = reactiveMap.set.bind(reactiveMap);
    const originalDelete = reactiveMap.delete.bind(reactiveMap);
    const originalClear = reactiveMap.clear.bind(reactiveMap);

    // Override set method
    reactiveMap.set = function(key, value) {
        const oldValue = reactiveMap.get(key);
        const isNew = !reactiveMap.has(key);

        // Make value reactive if it's an object
        if (typeof value === 'object' && value !== null && !value.__isProxy) {
            const nestedPath = `${path}[${key}]`;
            value = createReactiveProxy(value, nestedPath, onChange);
        }

        originalSet(key, value);

        // Notify change
        onChange(`${path}[${key}]`, value, oldValue, isNew ? 'add' : 'update');

        return reactiveMap;
    };

    // Override delete method
    reactiveMap.delete = function(key) {
        const oldValue = reactiveMap.get(key);
        const result = originalDelete(key);

        if (result) {
            onChange(`${path}[${key}]`, undefined, oldValue, 'delete');
        }

        return result;
    };

    // Override clear method
    reactiveMap.clear = function() {
        const oldEntries = new Map(reactiveMap);
        originalClear();

        for (const [key, value] of oldEntries) {
            onChange(`${path}[${key}]`, undefined, value, 'delete');
        }
    };

    // Mark as proxy
    reactiveMap.__isProxy = true;

    return reactiveMap;
}

/**
 * Create a reactive Array
 */
function createReactiveArray(array, path, onChange) {
    return createReactiveProxy(array, path, onChange);
}

/**
 * ReactiveState class manages reactive state and change notifications
 */
class ReactiveState {
    constructor(initialState) {
        this.subscribers = new Map();
        this.batchedChanges = [];
        this.batchTimeout = null;
        this.batchDelay = 10; // ms

        // Create reactive proxy
        this.state = createReactiveProxy(
            initialState,
            'state',
            this.handleChange.bind(this)
        );
    }

    /**
     * Handle a state change
     */
    handleChange(path, newValue, oldValue, operation = 'update') {
        const change = { path, newValue, oldValue, operation, timestamp: Date.now() };

        // Add to batched changes
        this.batchedChanges.push(change);

        // Emit specific events based on path
        this.emitSpecificEvents(change);

        // Batch emit general state change event
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }

        this.batchTimeout = setTimeout(() => {
            this.emitBatchedChanges();
        }, this.batchDelay);
    }

    /**
     * Emit specific events based on the change path
     */
    emitSpecificEvents(change) {
        const { path, newValue, oldValue, operation } = change;

        // Emit specific events for common state changes
        if (path.startsWith('state.project.clips[')) {
            const clipId = path.match(/\[([^\]]+)\]/)?.[1];

            if (operation === 'add') {
                eventBus.emit(Events.STATE_CLIP_ADDED, { clipId, clip: newValue });
            } else if (operation === 'delete') {
                eventBus.emit(Events.STATE_CLIP_DELETED, { clipId, clip: oldValue });
            } else if (operation === 'update') {
                eventBus.emit(Events.STATE_CLIP_UPDATED, { clipId, clip: newValue, oldClip: oldValue });
            }
        } else if (path.includes('project.transcripts')) {
            eventBus.emit(Events.STATE_TRANSCRIPT_UPDATED, { transcripts: this.state.project.transcripts });
        } else if (path.includes('project.subtitles')) {
            eventBus.emit(Events.STATE_SUBTITLE_UPDATED, { subtitles: this.state.project.subtitles });
        } else if (path.includes('project.markers')) {
            eventBus.emit(Events.STATE_MARKER_ADDED, { markers: this.state.project.markers });
        } else if (path === 'state.playback.currentTime') {
            eventBus.emit(Events.PLAYBACK_TIME_UPDATE, { time: newValue });
        } else if (path === 'state.playback.isPlaying') {
            const event = newValue ? Events.PLAYBACK_PLAY : Events.PLAYBACK_PAUSE;
            eventBus.emit(event, { isPlaying: newValue });
        } else if (path === 'state.playback.playbackRate') {
            eventBus.emit(Events.PLAYBACK_RATE_CHANGE, { rate: newValue });
        } else if (path.includes('timeline.viewportDuration') || path.includes('timeline.viewportStart')) {
            eventBus.emit(Events.TIMELINE_ZOOM, {
                viewportStart: this.state.timeline.viewportStart,
                viewportDuration: this.state.timeline.viewportDuration
            });
        }
    }

    /**
     * Emit batched changes
     */
    emitBatchedChanges() {
        if (this.batchedChanges.length > 0) {
            eventBus.emit(Events.STATE_CHANGED, {
                changes: [...this.batchedChanges],
                state: this.state
            });

            // Notify path-specific subscribers
            for (const change of this.batchedChanges) {
                this.notifySubscribers(change);
            }

            this.batchedChanges = [];
        }
        this.batchTimeout = null;
    }

    /**
     * Notify subscribers for a specific path
     */
    notifySubscribers(change) {
        for (const [subscribedPath, callbacks] of this.subscribers) {
            if (change.path.startsWith(subscribedPath)) {
                for (const callback of callbacks) {
                    try {
                        callback(change);
                    } catch (error) {
                        console.error(`[ReactiveState] Error in subscriber for "${subscribedPath}":`, error);
                    }
                }
            }
        }
    }

    /**
     * Subscribe to changes on a specific path
     * @param {string} path - Path to watch (e.g., 'state.playback.currentTime')
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribe(path, callback) {
        if (!this.subscribers.has(path)) {
            this.subscribers.set(path, new Set());
        }

        this.subscribers.get(path).add(callback);

        // Return unsubscribe function
        return () => {
            const callbacks = this.subscribers.get(path);
            if (callbacks) {
                callbacks.delete(callback);
                if (callbacks.size === 0) {
                    this.subscribers.delete(path);
                }
            }
        };
    }

    /**
     * Get the current state (returns the reactive proxy)
     */
    getState() {
        return this.state;
    }

    /**
     * Get a snapshot of the current state (plain object, not reactive)
     */
    getSnapshot() {
        return JSON.parse(JSON.stringify(this.state));
    }

    /**
     * Batch multiple state updates (prevents multiple render cycles)
     */
    batch(fn) {
        const originalDelay = this.batchDelay;
        this.batchDelay = 0; // Disable batching during function execution

        try {
            fn();
        } finally {
            this.batchDelay = originalDelay;

            // Flush any pending changes immediately
            if (this.batchTimeout) {
                clearTimeout(this.batchTimeout);
                this.emitBatchedChanges();
            }
        }
    }
}

export { ReactiveState, createReactiveProxy };
