# VideoEditor - AI-Powered Video Editing Platform

Professional browser-based video editor with AI transcription and processing.

## Quick Start

### Prerequisites
- Docker Desktop installed and running

### Run the Application

```bash
# Build and start the container
docker-compose up --build

# Access the application
# Open browser to: http://localhost:5000
```

### Stop the Application

```bash
docker-compose down
```

## Development

The application runs with hot reload enabled. Edit files and they'll automatically update:

- **Backend**: Edit `app.py` or files in `backend/` → changes apply immediately
- **Frontend**: Edit files in `static/` → refresh browser

### View Logs

```bash
docker-compose logs -f videoeditor
```

### Access API Documentation

- Swagger UI: http://localhost:5000/docs
- ReDoc: http://localhost:5000/redoc

## Project Structure

```
VideoEditor/
├── index.html                    # Frontend HTML
├── static/                       # Frontend assets
│   ├── styles.css
│   └── js/                       # JavaScript modules
├── app.py                        # FastAPI application
├── backend/                      # Backend modules
│   ├── api/                      # API endpoints
│   ├── services/                 # Business logic
│   ├── models/                   # Data models
│   └── utils/                    # Utilities
├── data/                         # Persistent data (created at runtime)
│   ├── uploads/
│   ├── cache/
│   └── exports/
├── Dockerfile
├── docker-compose.yml
└── requirements.txt
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Frontend UI |
| `/api/health` | GET | Health check |
| `/api/upload` | POST | Upload media file |
| `/api/transcribe` | POST | AI transcription |
| `/api/waveform` | GET | Generate waveform |
| `/ws` | WebSocket | Real-time updates |

## Features

### Current
- ✅ Professional timeline editor
- ✅ Multi-track editing (video, audio)
- ✅ Waveform visualization
- ✅ AI transcription (Faster Whisper)
- ✅ File upload
- ✅ Real-time WebSocket updates

### Coming Soon
- Export compilation
- Video processing effects
- Subtitle generation
- Advanced audio processing

## Testing

### Health Check
```bash
curl http://localhost:5000/api/health
```

Expected response:
```json
{
  "status": "ready",
  "message": "Backend is ready to process requests",
  "gpu_available": false,
  "version": "1.0.0"
}
```

### Upload File
```bash
curl -X POST "http://localhost:5000/api/upload" \
  -F "file=@/path/to/video.mp4"
```

## Troubleshooting

### Container won't start
```bash
# View logs
docker-compose logs videoeditor

# Check if port 5000 is in use
netstat -an | grep 5000

# Rebuild container
docker-compose up --build --force-recreate
```

### Model download takes long
- Faster Whisper downloads models on first use
- Base model: ~150MB (recommended for testing)
- Medium model: ~1.5GB (better accuracy)

### Hot reload not working
```bash
# Restart container
docker-compose restart
```

## Documentation

See `TECHNICAL_IMPLEMENTATION_SIMPLE.md` for detailed implementation guide.

## License

MIT
