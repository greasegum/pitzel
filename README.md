# sapitzel-draw

A parametric drawing editor with API support for canvas export and LLM chatbot integration.

## Features

- Interactive canvas drawing with multiple shape tools (line, polyline, rectangle, circle, arc)
- JSON-based data representation
- Real-time constraint system
- Export canvas as PNG
- API endpoints for LLM chatbot integration
- Multi-selection and entity manipulation
- Undo/redo functionality

## Installation

```bash
# Install dependencies
npm install
```

## Usage

```bash
# Start the server
npm start

# Or for development with auto-reload
npm run dev
```

The application will be available at `http://localhost:3000`

## API Documentation

### Accessing API Help

The API provides a comprehensive help endpoint that returns documentation for all available endpoints.

#### From Command Line

```bash
# Get API documentation using curl
curl http://localhost:3000/api

# Pretty print JSON response
curl http://localhost:3000/api | python -m json.tool

# Save documentation to file
curl http://localhost:3000/api > api-docs.json

# Using wget
wget -qO- http://localhost:3000/api

# Using httpie (if installed)
http GET localhost:3000/api
```

#### From Browser

Simply navigate to: `http://localhost:3000/api`

### Available Endpoints

- `GET /api` - API help and documentation
- `POST /api/canvas/export` - Export full canvas as PNG
- `POST /api/canvas/extents` - Export canvas extents as PNG
- `GET /api/editor/data` - Read JSON editor data
- `POST /api/editor/data` - Write JSON editor data
- `GET /api/chatbot/canvas-state` - Get canvas state for chatbot
- `POST /api/chatbot/update-canvas` - Update canvas via chatbot
- `POST /api/editor/save` - Save JSON to file
- `GET /api/editor/load/:filename` - Load JSON from file

For detailed API documentation, see [API_DOCUMENTATION.md](API_DOCUMENTATION.md)

## Keyboard Shortcuts

- `?` - Show help/keyboard shortcuts
- `Ctrl+Z` - Undo
- `Ctrl+Y` - Redo
- `Ctrl+C` - Copy entity
- `Ctrl+V` - Paste entity
- `Ctrl+D` - Duplicate entity
- `Ctrl+E` - Export canvas
- `Ctrl+Shift+E` - Export canvas extents
- `Ctrl+Shift+S` - Sync with API
- `D` - Toggle dimensions display
- `Delete` - Delete selected items
- `ESC` - Cancel current operation
- `Space` - Pan view (hold)

## Development

The project consists of:
- `index.html` - Main HTML interface
- `app.js` - Core drawing application logic
- `server.js` - Express API server
- `api-client.js` - Browser API client
- `app-integration.js` - UI/API integration layer
- `styles.css` - Application styles

## Testing

A test interface is available at `http://localhost:3000/test-api.html` for testing API endpoints.

## License

This repository was initialized by Terragon.