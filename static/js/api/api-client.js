/**
 * Backend API Client
 *
 * Handles all HTTP requests and WebSocket connections to backend
 */

class VideoEditorAPI {
    constructor() {
        // Auto-detect backend URL (same host as frontend)
        this.baseURL = `http://${window.location.hostname}:${window.location.port}`;
        this.ws = null;
        this.wsCallbacks = new Map();
    }

    // ==================== Health Check ====================

    async checkHealth() {
        const response = await fetch(`${this.baseURL}/api/health`);
        if (!response.ok) throw new Error('Health check failed');
        return response.json();
    }

    // ==================== File Upload ====================

    async uploadFile(file, onProgress) {
        return new Promise((resolve, reject) => {
            const formData = new FormData();
            formData.append('file', file);

            const xhr = new XMLHttpRequest();

            // Progress tracking
            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable && onProgress) {
                    const percent = (e.loaded / e.total) * 100;
                    onProgress(percent);
                }
            });

            // Completion
            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    reject(new Error(`Upload failed: ${xhr.statusText}`));
                }
            });

            // Error
            xhr.addEventListener('error', () => {
                reject(new Error('Upload failed'));
            });

            xhr.open('POST', `${this.baseURL}/api/upload`);
            xhr.send(formData);
        });
    }

    async listMediaFiles() {
        const response = await fetch(`${this.baseURL}/api/list`);
        if (!response.ok) {
            throw new Error(`Failed to list media files: ${response.statusText}`);
        }
        return response.json();
    }

    async deleteMediaFile(filename) {
        const response = await fetch(`${this.baseURL}/api/delete/${encodeURIComponent(filename)}`, {
            method: 'DELETE'
        });

        if (!response.ok) {
            throw new Error(`Failed to delete file: ${response.statusText}`);
        }

        return response.json();
    }

    // ==================== Transcription ====================

    async changeWhisperModel(modelSize) {
        const response = await fetch(`${this.baseURL}/api/change_model`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model_size: modelSize
            })
        });

        if (!response.ok) {
            throw new Error(`Model change failed: ${response.statusText}`);
        }

        return response.json();
    }

    async transcribeAudio(audioPath, language = 'en', startTime = null, duration = null) {
        const response = await fetch(`${this.baseURL}/api/transcribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                audio_path: audioPath,
                language: language,
                start_time: startTime,  // Clip start time
                duration: duration      // Clip duration
            })
        });

        if (!response.ok) {
            throw new Error(`Transcription failed: ${response.statusText}`);
        }

        return response.json();
    }

    async transcribeWithDiarization(audioPath, language = 'en', numSpeakers = null, startTime = null, duration = null) {
        const response = await fetch(`${this.baseURL}/api/transcribe_with_diarization`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                audio_path: audioPath,
                language: language,
                num_speakers: numSpeakers,  // Expected number of speakers
                start_time: startTime,
                duration: duration
            })
        });

        if (!response.ok) {
            throw new Error(`Diarization failed: ${response.statusText}`);
        }

        return response.json();
    }

    async detectSilence(audioPath, transcriptWords) {
        const response = await fetch(`${this.baseURL}/api/detect_silence`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                audio_path: audioPath,
                transcript_words: transcriptWords
            })
        });

        if (!response.ok) {
            throw new Error(`Silence detection failed: ${response.statusText}`);
        }

        return response.json();
    }

    // ==================== Waveform ====================

    async generateWaveform(audioPath, width = 1000) {
        const url = `${this.baseURL}/api/waveform?` +
                    `path=${encodeURIComponent(audioPath)}&width=${width}`;

        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Waveform generation failed: ${response.statusText}`);
        }

        return response.json();
    }

    // ==================== Audio Processing ====================

    async normalizeAudio(audioPath, startTime = null, duration = null) {
        const response = await fetch(`${this.baseURL}/api/audio/normalize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                audio_path: audioPath,
                start_time: startTime,  // Clip start time
                duration: duration      // Clip duration
            })
        });

        if (!response.ok) {
            throw new Error(`Audio normalization failed: ${response.statusText}`);
        }

        return response.json();
    }

    async removeNoise(audioPath, strength = 'medium', startTime = null, duration = null) {
        const response = await fetch(`${this.baseURL}/api/audio/denoise`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                audio_path: audioPath,
                strength: strength,
                start_time: startTime,  // Clip start time
                duration: duration      // Clip duration
            })
        });

        if (!response.ok) {
            throw new Error(`Noise removal failed: ${response.statusText}`);
        }

        return response.json();
    }

    // ==================== WebSocket ====================

    connectWebSocket(onMessage) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            return; // Already connected
        }

        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        this.ws = new WebSocket(`${wsProtocol}//${window.location.hostname}:${window.location.port}/ws`);

        this.ws.onopen = () => {
            console.log('[API] WebSocket connected');
        };

        this.ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            onMessage(data);

            // Dispatch to specific callbacks
            const type = data.type;
            if (this.wsCallbacks.has(type)) {
                this.wsCallbacks.get(type)(data);
            }
        };

        this.ws.onerror = (error) => {
            console.error('[API] WebSocket error:', error);
        };

        this.ws.onclose = () => {
            console.log('[API] WebSocket disconnected');
            // Auto-reconnect after 5 seconds
            setTimeout(() => this.connectWebSocket(onMessage), 5000);
        };
    }

    onWebSocketMessage(type, callback) {
        this.wsCallbacks.set(type, callback);
    }

    disconnectWebSocket() {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
}

// Export singleton instance
export const api = new VideoEditorAPI();
