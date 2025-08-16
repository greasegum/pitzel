# Parametric Drawing Editor API Documentation

## Overview
This API provides endpoints for integrating the Parametric Drawing Editor with LLM chatbots and external applications. The API supports canvas export, JSON data management, and real-time drawing manipulation.

## Setup

### Installation
```bash
npm install
```

### Starting the Server
```bash
npm start
# or for development with auto-reload
npm run dev
```

The server runs on `http://localhost:3000` by default.

## API Endpoints

### Canvas Export

#### Export Full Canvas as PNG
**POST** `/api/canvas/export`

Exports the entire canvas as a PNG image.

**Request Body:**
```json
{
  "imageData": "data:image/png;base64,..."
  "bounds": {
    "x": 0,
    "y": 0,
    "width": 800,
    "height": 600
  },
  "metadata": {
    "custom": "data"
  }
}
```

**Response:**
```json
{
  "success": true,
  "filename": "canvas_export_1234567890.png",
  "path": "/exports/canvas_export_1234567890.png",
  "bounds": {...},
  "metadata": {...},
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### Export Canvas Extents as PNG
**POST** `/api/canvas/extents`

Exports a specific rectangular area of the canvas.

**Request Body:**
```json
{
  "imageData": "data:image/png;base64,...",
  "x": 100,
  "y": 100,
  "width": 400,
  "height": 300,
  "metadata": {}
}
```

**Response:**
```json
{
  "success": true,
  "filename": "canvas_extents_1234567890.png",
  "path": "/exports/canvas_extents_1234567890.png",
  "extents": {
    "x": 100,
    "y": 100,
    "width": 400,
    "height": 300
  },
  "metadata": {...},
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### JSON Editor Data

#### Read Editor Data
**GET** `/api/editor/data`

Retrieves the current JSON editor data including entities and constraints.

**Response:**
```json
{
  "success": true,
  "data": {
    "entities": [...],
    "constraints": [...],
    "metadata": {...},
    "timestamp": "2024-01-01T00:00:00.000Z"
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### Write Editor Data
**POST** `/api/editor/data`

Updates the JSON editor data.

**Request Body:**
```json
{
  "entities": [
    {
      "id": "entity_abc1",
      "type": "line",
      "points": [
        {"x": 0, "y": 0},
        {"x": 100, "y": 100}
      ]
    }
  ],
  "constraints": [],
  "metadata": {}
}
```

**Response:**
```json
{
  "success": true,
  "message": "Editor data updated successfully",
  "data": {...}
}
```

### LLM Chatbot Integration

#### Get Canvas State
**GET** `/api/chatbot/canvas-state`

Returns the current canvas state for chatbot processing.

**Response:**
```json
{
  "success": true,
  "canvas": {
    "entities": [...],
    "constraints": [...],
    "metadata": {...}
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### Update Canvas via Chatbot
**POST** `/api/chatbot/update-canvas`

Allows chatbots to modify the canvas by performing actions.

**Available Actions:**
- `add_entity` - Add a new entity to the canvas
- `remove_entity` - Remove an entity by ID
- `update_entity` - Update an existing entity
- `add_constraint` - Add a constraint
- `clear_canvas` - Clear all entities and constraints

**Request Body Examples:**

Adding an entity:
```json
{
  "action": "add_entity",
  "data": {
    "entity": {
      "id": "entity_xyz1",
      "type": "rectangle",
      "x": 50,
      "y": 50,
      "width": 200,
      "height": 100,
      "color": "#00ff88"
    }
  }
}
```

Removing an entity:
```json
{
  "action": "remove_entity",
  "data": {
    "entityId": "entity_xyz1"
  }
}
```

Updating an entity:
```json
{
  "action": "update_entity",
  "data": {
    "entityId": "entity_xyz1",
    "updates": {
      "color": "#ff0000",
      "width": 250
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "action": "add_entity",
  "result": {
    "message": "Entity added",
    "entity": {...}
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### File Operations

#### Save Drawing
**POST** `/api/editor/save`

Saves the current drawing to a JSON file.

**Request Body:**
```json
{
  "data": {
    "entities": [...],
    "constraints": [...]
  },
  "filename": "my_drawing.json"
}
```

#### Load Drawing
**GET** `/api/editor/load/:filename`

Loads a previously saved drawing.

**Response:**
```json
{
  "success": true,
  "data": {
    "entities": [...],
    "constraints": [...]
  },
  "filename": "my_drawing.json",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Client-Side Integration

### JavaScript API Client

The application includes a JavaScript API client that can be used in browsers:

```javascript
// Initialize the API client
const api = new DrawingAPIClient('http://localhost:3000');

// Export canvas
const result = await api.exportCanvas(canvas, metadata);

// Get editor data
const data = await api.getEditorData();

// Update via chatbot
const update = await api.chatbotUpdateCanvas('add_entity', {
  entity: { type: 'line', ... }
});
```

### Chatbot Helper Functions

The application provides helper functions for chatbot integration:

```javascript
// Get current canvas state
const state = await window.chatbotAPI.getCanvasState();

// Add entity
await window.chatbotAPI.addEntity({
  type: 'rectangle',
  x: 100,
  y: 100,
  width: 200,
  height: 150
});

// Remove entity
await window.chatbotAPI.removeEntity('entity_abc1');

// Clear canvas
await window.chatbotAPI.clearCanvas();

// Export for chatbot
const exportResult = await window.chatbotAPI.exportForChatbot();
```

## Entity Types

### Line
```json
{
  "type": "line",
  "points": [
    {"x": 0, "y": 0},
    {"x": 100, "y": 100}
  ],
  "color": "#00ff88"
}
```

### Polyline
```json
{
  "type": "polyline",
  "points": [
    {"x": 0, "y": 0},
    {"x": 50, "y": 100},
    {"x": 100, "y": 50}
  ],
  "color": "#00ff88"
}
```

### Rectangle
```json
{
  "type": "rectangle",
  "x": 50,
  "y": 50,
  "width": 200,
  "height": 100,
  "color": "#00ff88"
}
```

### Circle
```json
{
  "type": "circle",
  "center": {"x": 150, "y": 150},
  "radius": 50,
  "color": "#00ff88"
}
```

### Arc
```json
{
  "type": "arc",
  "center": {"x": 150, "y": 150},
  "radius": 50,
  "startAngle": 0,
  "endAngle": Math.PI,
  "color": "#00ff88"
}
```

## Error Handling

All endpoints return errors in the following format:

```json
{
  "error": "Error message",
  "details": "Detailed error information"
}
```

## CORS

The API has CORS enabled by default, allowing requests from any origin. In production, configure CORS appropriately:

```javascript
app.use(cors({
  origin: 'https://your-domain.com'
}));
```

## File Storage

- Exported images are stored in `/exports/` directory
- Saved drawings are stored in `/saves/` directory
- Files are accessible via static routes:
  - Images: `http://localhost:3000/exports/filename.png`
  - Drawings: `http://localhost:3000/saves/filename.json`

## Keyboard Shortcuts (Client-Side)

- `Ctrl/Cmd + E`: Export full canvas
- `Ctrl/Cmd + Shift + E`: Export canvas extents
- `Ctrl/Cmd + Shift + S`: Sync with API

## Example: LLM Chatbot Integration

```python
import requests
import json

# API base URL
API_URL = "http://localhost:3000"

# Get current canvas state
response = requests.get(f"{API_URL}/api/chatbot/canvas-state")
canvas_state = response.json()

# Add a rectangle via chatbot
new_entity = {
    "action": "add_entity",
    "data": {
        "entity": {
            "type": "rectangle",
            "x": 100,
            "y": 100,
            "width": 200,
            "height": 150,
            "color": "#ff0000"
        }
    }
}

response = requests.post(
    f"{API_URL}/api/chatbot/update-canvas",
    json=new_entity
)

result = response.json()
print(f"Entity added: {result}")

# Export canvas as PNG
response = requests.post(
    f"{API_URL}/api/canvas/export",
    json={
        "imageData": "...",  # Get from canvas.toDataURL()
        "metadata": {"source": "chatbot"}
    }
)

export_result = response.json()
print(f"Canvas exported to: {export_result['path']}")
```

## Testing

To test the API endpoints:

1. Start the server: `npm start`
2. Open the drawing editor in a browser: `http://localhost:3000`
3. Draw some shapes
4. Use the API buttons or make direct API calls
5. Check the `/exports` and `/saves` directories for output files