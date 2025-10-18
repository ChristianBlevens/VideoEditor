// ==================== Project Management ====================
import { state } from '../../core/state.js';
import { elements } from '../../rendering/dom-cache.js';
import { showToast } from '../../ui/ui-utils.js';
import { undo as undoHistory, redo as redoHistory, clearHistory } from '../../operations/history-manager.js';
import { renderAll } from '../../rendering/rendering.js';
import { renderAllTrackControls } from '../timeline/track-controls.js';
import { renderClipProperties } from '../properties/clip-properties.js';

export function newProject() {
    if (confirm('Create new project? Unsaved changes will be lost.')) {
        // Clear all state
        state.project.name = 'Untitled Project';
        state.project.clips.clear();
        state.project.markers = [];
        state.project.transcripts = [];
        state.project.edits = [];
        state.selection.selectedClips = [];
        state.selection.inPoint = null;
        state.selection.outPoint = null;

        // Clear history
        clearHistory();

        // Re-render everything
        renderAll();
        renderAllTrackControls();
        renderClipProperties();
        updateProjectName();

        showToast('New project created');
    }
}

export function openProject() {
    // Create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.vep';

    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            const projectData = JSON.parse(text);

            // Load project data into state
            loadProjectData(projectData);

            // Add to recent projects
            addToRecentProjects(projectData.name || file.name);

            showToast(`Project "${file.name}" loaded`);
        } catch (error) {
            showToast('Failed to load project file', 'error');
            console.error('Load error:', error);
        }
    };

    input.click();
}

export function saveProject() {
    try {
        const projectData = exportProjectToJSON();
        const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${state.project.name || 'project'}.json`;
        a.click();

        URL.revokeObjectURL(url);

        // Add to recent projects
        addToRecentProjects(state.project.name);

        showToast('Project saved');
    } catch (error) {
        showToast('Failed to save project', 'error');
        console.error('Save error:', error);
    }
}

export function exportProjectToJSON() {
    return {
        version: '1.0',
        name: state.project.name,
        clips: Array.from(state.project.clips.values()),
        markers: state.project.markers,
        transcripts: state.project.transcripts,
        edits: state.project.edits,
        tracks: state.tracks,
        timeline: {
            viewportDuration: state.timeline.viewportDuration,
            snapToGrid: state.timeline.snapToGrid,
            showWaveforms: state.timeline.showWaveforms,
            showMarkers: state.timeline.showMarkers
        },
        subtitles: state.subtitles,
        export: state.export
    };
}

export function loadProjectData(projectData) {
    // Load clips
    state.project.clips.clear();
    if (projectData.clips) {
        projectData.clips.forEach(clip => {
            state.project.clips.set(clip.id, clip);
        });
    }

    // Load other data
    state.project.name = projectData.name || 'Untitled Project';
    state.project.markers = projectData.markers || [];
    state.project.transcripts = projectData.transcripts || [];
    state.project.edits = projectData.edits || [];

    // Load track states
    if (projectData.tracks) {
        state.tracks = projectData.tracks;
    }

    // Load timeline settings
    if (projectData.timeline) {
        Object.assign(state.timeline, projectData.timeline);
    }

    // Load subtitle settings
    if (projectData.subtitles) {
        state.subtitles = projectData.subtitles;
    }

    // Load export settings
    if (projectData.export) {
        state.export = projectData.export;
    }

    // Clear history
    clearHistory();

    // Re-render everything
    renderAll();
    renderAllTrackControls();
    renderClipProperties();
    updateProjectName();
}

export function updateProjectName() {
    elements.projectName.textContent = state.project.name;
}

/**
 * Initialize project name editing
 */
export function initializeProjectNameEditing() {
    const projectNameElement = elements.projectName;

    // Make it editable on click
    projectNameElement.setAttribute('contenteditable', 'true');
    projectNameElement.setAttribute('spellcheck', 'false');
    projectNameElement.style.cursor = 'text';

    // Select all text on focus
    projectNameElement.addEventListener('focus', () => {
        const range = document.createRange();
        range.selectNodeContents(projectNameElement);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    });

    // Save on blur
    projectNameElement.addEventListener('blur', () => {
        const newName = projectNameElement.textContent.trim();
        if (newName && newName !== state.project.name) {
            state.project.name = newName;
            console.log('Project renamed to:', newName);
        } else if (!newName) {
            // Revert if empty
            projectNameElement.textContent = state.project.name;
        }
    });

    // Save on Enter key
    projectNameElement.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            projectNameElement.blur();
        }
    });
}

export async function undo() {
    await undoHistory();
}

export async function redo() {
    await redoHistory();
}

// ==================== Recent Projects (localStorage) ====================

const RECENT_PROJECTS_KEY = 'videoEditor_recentProjects';
const MAX_RECENT_PROJECTS = 5;

/**
 * Get recent projects from localStorage
 */
export function getRecentProjects() {
    try {
        const stored = localStorage.getItem(RECENT_PROJECTS_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Error loading recent projects:', error);
        return [];
    }
}

/**
 * Add project to recent projects list
 */
export function addToRecentProjects(projectName, projectPath = null) {
    const recentProjects = getRecentProjects();

    // Create project entry
    const projectEntry = {
        name: projectName,
        path: projectPath,
        timestamp: Date.now()
    };

    // Remove existing entry with same name (if any)
    const filtered = recentProjects.filter(p => p.name !== projectName);

    // Add to front of list
    filtered.unshift(projectEntry);

    // Limit to max size
    const limited = filtered.slice(0, MAX_RECENT_PROJECTS);

    // Save to localStorage
    try {
        localStorage.setItem(RECENT_PROJECTS_KEY, JSON.stringify(limited));
    } catch (error) {
        console.error('Error saving recent projects:', error);
    }

    // Update UI
    renderRecentProjects();
}

/**
 * Render recent projects in UI
 */
export function renderRecentProjects() {
    const recentProjectsList = document.getElementById('recent-projects-list');
    if (!recentProjectsList) return;

    const recentProjects = getRecentProjects();

    if (recentProjects.length === 0) {
        recentProjectsList.innerHTML = '<p style="padding: 10px; color: #888;">No recent projects</p>';
        return;
    }

    recentProjectsList.innerHTML = '';

    recentProjects.forEach(project => {
        const item = document.createElement('div');
        item.className = 'recent-project-item';
        item.innerHTML = `
            <i class="fas fa-file-video"></i>
            <div class="recent-project-info">
                <div class="recent-project-name">${escapeHtml(project.name)}</div>
                <div class="recent-project-date">${formatDate(project.timestamp)}</div>
            </div>
        `;

        item.addEventListener('click', () => {
            if (project.path) {
                // If we have a path, try to load it
                showToast('Recent project loading not fully implemented', 'info');
            } else {
                showToast(`Recent project: ${project.name}`, 'info');
            }
        });

        recentProjectsList.appendChild(item);
    });
}

/**
 * Clear recent projects
 */
export function clearRecentProjects() {
    try {
        localStorage.removeItem(RECENT_PROJECTS_KEY);
        renderRecentProjects();
        showToast('Recent projects cleared');
    } catch (error) {
        console.error('Error clearing recent projects:', error);
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Format timestamp to readable date
 */
function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString();
}
