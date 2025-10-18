/**
 * Command Pattern Implementation
 *
 * Provides a command pattern for all state-changing operations.
 * Enables undo/redo, operation history, and better separation of concerns.
 */

import { eventBus, Events } from '../core/event-bus.js';

/**
 * Base Command class
 * All commands must extend this and implement execute() and undo()
 */
export class Command {
    constructor(description = 'Unknown Command') {
        this.description = description;
        this.timestamp = Date.now();
        this.executed = false;
    }

    /**
     * Execute the command
     * @returns {*} Result of the command
     */
    execute() {
        throw new Error('Command.execute() must be implemented');
    }

    /**
     * Undo the command
     * @returns {*} Result of the undo
     */
    undo() {
        throw new Error('Command.undo() must be implemented');
    }

    /**
     * Get a description of this command for history display
     */
    getDescription() {
        return this.description;
    }
}

/**
 * Command Invoker - manages command execution and history
 */
export class CommandInvoker {
    constructor(maxHistorySize = 50) {
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistorySize = maxHistorySize;
        this.isExecuting = false;
    }

    /**
     * Execute a command and add it to history
     * @param {Command} command - Command to execute
     * @returns {*} Result of the command
     */
    async execute(command) {
        if (!(command instanceof Command)) {
            throw new Error('CommandInvoker.execute() requires a Command instance');
        }

        // Prevent recursive command execution during undo/redo
        if (this.isExecuting) {
            console.warn('[CommandInvoker] Command execution blocked during undo/redo');
            return;
        }

        this.isExecuting = true;

        try {
            // Execute the command
            const result = await command.execute();
            command.executed = true;

            // Add to undo stack
            this.undoStack.push(command);

            // Clear redo stack (new actions invalidate redo history)
            this.redoStack = [];

            // Limit history size
            if (this.undoStack.length > this.maxHistorySize) {
                this.undoStack.shift();
            }

            // Emit history change event
            eventBus.emit(Events.HISTORY_STATE_CHANGED, {
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                undoDescription: this.getUndoDescription(),
                redoDescription: this.getRedoDescription()
            });

            return result;
        } catch (error) {
            console.error('[CommandInvoker] Command execution failed:', error);
            throw error;
        } finally {
            this.isExecuting = false;
        }
    }

    /**
     * Undo the last command
     * @returns {*} Result of the undo
     */
    async undo() {
        if (!this.canUndo()) {
            console.warn('[CommandInvoker] Nothing to undo');
            return;
        }

        this.isExecuting = true;

        try {
            const command = this.undoStack.pop();
            const result = await command.undo();

            // Add to redo stack
            this.redoStack.push(command);

            // Emit events
            eventBus.emit(Events.HISTORY_UNDO, {
                command: command.getDescription()
            });

            eventBus.emit(Events.HISTORY_STATE_CHANGED, {
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                undoDescription: this.getUndoDescription(),
                redoDescription: this.getRedoDescription()
            });

            return result;
        } catch (error) {
            console.error('[CommandInvoker] Undo failed:', error);
            throw error;
        } finally {
            this.isExecuting = false;
        }
    }

    /**
     * Redo the last undone command
     * @returns {*} Result of the redo
     */
    async redo() {
        if (!this.canRedo()) {
            console.warn('[CommandInvoker] Nothing to redo');
            return;
        }

        this.isExecuting = true;

        try {
            const command = this.redoStack.pop();
            const result = await command.execute();

            // Add back to undo stack
            this.undoStack.push(command);

            // Emit events
            eventBus.emit(Events.HISTORY_REDO, {
                command: command.getDescription()
            });

            eventBus.emit(Events.HISTORY_STATE_CHANGED, {
                canUndo: this.canUndo(),
                canRedo: this.canRedo(),
                undoDescription: this.getUndoDescription(),
                redoDescription: this.getRedoDescription()
            });

            return result;
        } catch (error) {
            console.error('[CommandInvoker] Redo failed:', error);
            throw error;
        } finally {
            this.isExecuting = false;
        }
    }

    /**
     * Check if undo is available
     */
    canUndo() {
        return this.undoStack.length > 0;
    }

    /**
     * Check if redo is available
     */
    canRedo() {
        return this.redoStack.length > 0;
    }

    /**
     * Get description of the next undo command
     */
    getUndoDescription() {
        if (!this.canUndo()) return null;
        return this.undoStack[this.undoStack.length - 1].getDescription();
    }

    /**
     * Get description of the next redo command
     */
    getRedoDescription() {
        if (!this.canRedo()) return null;
        return this.redoStack[this.redoStack.length - 1].getDescription();
    }

    /**
     * Clear all history
     */
    clear() {
        this.undoStack = [];
        this.redoStack = [];

        eventBus.emit(Events.HISTORY_STATE_CHANGED, {
            canUndo: false,
            canRedo: false,
            undoDescription: null,
            redoDescription: null
        });
    }

    /**
     * Get undo history (for display)
     */
    getUndoHistory() {
        return this.undoStack.map(cmd => ({
            description: cmd.getDescription(),
            timestamp: cmd.timestamp
        }));
    }

    /**
     * Get redo history (for display)
     */
    getRedoHistory() {
        return this.redoStack.map(cmd => ({
            description: cmd.getDescription(),
            timestamp: cmd.timestamp
        }));
    }
}

/**
 * Macro Command - executes multiple commands as a single operation
 */
export class MacroCommand extends Command {
    constructor(commands, description = 'Multiple Operations') {
        super(description);
        this.commands = commands;
    }

    async execute() {
        const results = [];
        for (const command of this.commands) {
            results.push(await command.execute());
        }
        return results;
    }

    async undo() {
        const results = [];
        // Undo in reverse order
        for (let i = this.commands.length - 1; i >= 0; i--) {
            results.push(await this.commands[i].undo());
        }
        return results;
    }
}

// Create and export singleton invoker
export const commandInvoker = new CommandInvoker();

// ==================== Common Command Implementations ====================

/**
 * Add Clip Command
 */
export class AddClipCommand extends Command {
    constructor(state, clip) {
        super(`Add ${clip.type} clip`);
        this.state = state;
        this.clip = clip;
    }

    execute() {
        this.state.project.clips.set(this.clip.id, this.clip);
        return this.clip;
    }

    undo() {
        this.state.project.clips.delete(this.clip.id);
        return this.clip;
    }
}

/**
 * Delete Clip Command
 */
export class DeleteClipCommand extends Command {
    constructor(state, clipId) {
        super('Delete clip');
        this.state = state;
        this.clipId = clipId;
        this.clip = null;
    }

    execute() {
        this.clip = this.state.project.clips.get(this.clipId);
        if (!this.clip) {
            throw new Error(`Clip ${this.clipId} not found`);
        }
        this.state.project.clips.delete(this.clipId);
        return this.clip;
    }

    undo() {
        this.state.project.clips.set(this.clipId, this.clip);
        return this.clip;
    }
}

/**
 * Update Clip Command
 */
export class UpdateClipCommand extends Command {
    constructor(state, clipId, updates) {
        super('Update clip');
        this.state = state;
        this.clipId = clipId;
        this.updates = updates;
        this.previousValues = {};
    }

    execute() {
        const clip = this.state.project.clips.get(this.clipId);
        if (!clip) {
            throw new Error(`Clip ${this.clipId} not found`);
        }

        // Store previous values for undo
        for (const key in this.updates) {
            this.previousValues[key] = clip[key];
        }

        // Apply updates
        Object.assign(clip, this.updates);

        // Trigger Map update
        this.state.project.clips.set(this.clipId, clip);

        return clip;
    }

    undo() {
        const clip = this.state.project.clips.get(this.clipId);
        if (!clip) {
            throw new Error(`Clip ${this.clipId} not found`);
        }

        // Restore previous values
        Object.assign(clip, this.previousValues);

        // Trigger Map update
        this.state.project.clips.set(this.clipId, clip);

        return clip;
    }
}

/**
 * Move Clip Command
 */
export class MoveClipCommand extends Command {
    constructor(state, clipId, newStart, newTrackId) {
        super('Move clip');
        this.state = state;
        this.clipId = clipId;
        this.newStart = newStart;
        this.newTrackId = newTrackId;
        this.oldStart = null;
        this.oldTrackId = null;
    }

    execute() {
        const clip = this.state.project.clips.get(this.clipId);
        if (!clip) {
            throw new Error(`Clip ${this.clipId} not found`);
        }

        // Store old values
        this.oldStart = clip.start;
        this.oldTrackId = clip.trackId;

        // Apply new values
        clip.start = this.newStart;
        if (this.newTrackId !== undefined) {
            clip.trackId = this.newTrackId;
        }

        // Trigger Map update
        this.state.project.clips.set(this.clipId, clip);

        return clip;
    }

    undo() {
        const clip = this.state.project.clips.get(this.clipId);
        if (!clip) {
            throw new Error(`Clip ${this.clipId} not found`);
        }

        // Restore old values
        clip.start = this.oldStart;
        clip.trackId = this.oldTrackId;

        // Trigger Map update
        this.state.project.clips.set(this.clipId, clip);

        return clip;
    }
}

/**
 * Resize Clip Command
 */
export class ResizeClipCommand extends Command {
    constructor(state, clipId, newStart, newDuration) {
        super('Resize clip');
        this.state = state;
        this.clipId = clipId;
        this.newStart = newStart;
        this.newDuration = newDuration;
        this.oldStart = null;
        this.oldDuration = null;
    }

    execute() {
        const clip = this.state.project.clips.get(this.clipId);
        if (!clip) {
            throw new Error(`Clip ${this.clipId} not found`);
        }

        // Store old values
        this.oldStart = clip.start;
        this.oldDuration = clip.duration;

        // Apply new values
        if (this.newStart !== undefined) clip.start = this.newStart;
        if (this.newDuration !== undefined) clip.duration = this.newDuration;

        // Trigger Map update
        this.state.project.clips.set(this.clipId, clip);

        return clip;
    }

    undo() {
        const clip = this.state.project.clips.get(this.clipId);
        if (!clip) {
            throw new Error(`Clip ${this.clipId} not found`);
        }

        // Restore old values
        clip.start = this.oldStart;
        clip.duration = this.oldDuration;

        // Trigger Map update
        this.state.project.clips.set(this.clipId, clip);

        return clip;
    }
}
