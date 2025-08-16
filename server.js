const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files (HTML, CSS, JS)
app.use(express.static('.'));

// Store for JSON editor data (in production, use a database)
let editorData = {
  entities: [],
  constraints: [],
  metadata: {},
  timestamp: new Date().toISOString()
};

// API endpoint to export canvas as PNG
app.post('/api/canvas/export', async (req, res) => {
  try {
    const { imageData, bounds, metadata } = req.body;
    
    if (!imageData) {
      return res.status(400).json({ error: 'No image data provided' });
    }
    
    // Remove data URL prefix if present
    const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
    
    // Generate unique filename
    const filename = `canvas_export_${Date.now()}.png`;
    const filepath = path.join(__dirname, 'exports', filename);
    
    // Ensure exports directory exists
    await fs.mkdir(path.join(__dirname, 'exports'), { recursive: true });
    
    // Save the image
    await fs.writeFile(filepath, base64Data, 'base64');
    
    // Return the file info and metadata
    res.json({
      success: true,
      filename: filename,
      path: `/exports/${filename}`,
      bounds: bounds || null,
      metadata: metadata || {},
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error exporting canvas:', error);
    res.status(500).json({ error: 'Failed to export canvas', details: error.message });
  }
});

// API endpoint to get canvas bounds as PNG (for specific area)
app.post('/api/canvas/extents', async (req, res) => {
  try {
    const { imageData, x, y, width, height, metadata } = req.body;
    
    if (!imageData) {
      return res.status(400).json({ error: 'No image data provided' });
    }
    
    // In a real implementation, you would crop the image to the specified bounds
    // For now, we'll save the full image with bounds metadata
    const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
    
    const filename = `canvas_extents_${Date.now()}.png`;
    const filepath = path.join(__dirname, 'exports', filename);
    
    await fs.mkdir(path.join(__dirname, 'exports'), { recursive: true });
    await fs.writeFile(filepath, base64Data, 'base64');
    
    res.json({
      success: true,
      filename: filename,
      path: `/exports/${filename}`,
      extents: { x, y, width, height },
      metadata: metadata || {},
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error getting canvas extents:', error);
    res.status(500).json({ error: 'Failed to get canvas extents', details: error.message });
  }
});

// API endpoint to read JSON editor data
app.get('/api/editor/data', (req, res) => {
  try {
    res.json({
      success: true,
      data: editorData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error reading editor data:', error);
    res.status(500).json({ error: 'Failed to read editor data', details: error.message });
  }
});

// API endpoint to write/update JSON editor data
app.post('/api/editor/data', (req, res) => {
  try {
    const { entities, constraints, metadata } = req.body;
    
    // Update the stored data
    editorData = {
      entities: entities || editorData.entities,
      constraints: constraints || editorData.constraints,
      metadata: metadata || editorData.metadata,
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      message: 'Editor data updated successfully',
      data: editorData
    });
    
  } catch (error) {
    console.error('Error writing editor data:', error);
    res.status(500).json({ error: 'Failed to write editor data', details: error.message });
  }
});

// API endpoint for LLM chatbot integration - Get canvas state
app.get('/api/chatbot/canvas-state', async (req, res) => {
  try {
    res.json({
      success: true,
      canvas: {
        entities: editorData.entities,
        constraints: editorData.constraints,
        metadata: editorData.metadata
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting canvas state:', error);
    res.status(500).json({ error: 'Failed to get canvas state', details: error.message });
  }
});

// API endpoint for LLM chatbot integration - Update canvas
app.post('/api/chatbot/update-canvas', (req, res) => {
  try {
    const { action, data } = req.body;
    
    if (!action) {
      return res.status(400).json({ error: 'No action specified' });
    }
    
    let result = {};
    
    switch (action) {
      case 'add_entity':
        if (data.entity) {
          editorData.entities.push(data.entity);
          result = { message: 'Entity added', entity: data.entity };
        }
        break;
        
      case 'remove_entity':
        if (data.entityId) {
          editorData.entities = editorData.entities.filter(e => e.id !== data.entityId);
          result = { message: 'Entity removed', entityId: data.entityId };
        }
        break;
        
      case 'update_entity':
        if (data.entityId && data.updates) {
          const entityIndex = editorData.entities.findIndex(e => e.id === data.entityId);
          if (entityIndex !== -1) {
            editorData.entities[entityIndex] = { ...editorData.entities[entityIndex], ...data.updates };
            result = { message: 'Entity updated', entity: editorData.entities[entityIndex] };
          }
        }
        break;
        
      case 'add_constraint':
        if (data.constraint) {
          editorData.constraints.push(data.constraint);
          result = { message: 'Constraint added', constraint: data.constraint };
        }
        break;
        
      case 'clear_canvas':
        editorData.entities = [];
        editorData.constraints = [];
        result = { message: 'Canvas cleared' };
        break;
        
      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
    
    res.json({
      success: true,
      action: action,
      result: result,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error updating canvas:', error);
    res.status(500).json({ error: 'Failed to update canvas', details: error.message });
  }
});

// API endpoint to save JSON to file
app.post('/api/editor/save', async (req, res) => {
  try {
    const { data, filename } = req.body;
    
    const saveFilename = filename || `drawing_${Date.now()}.json`;
    const filepath = path.join(__dirname, 'saves', saveFilename);
    
    await fs.mkdir(path.join(__dirname, 'saves'), { recursive: true });
    await fs.writeFile(filepath, JSON.stringify(data, null, 2));
    
    res.json({
      success: true,
      filename: saveFilename,
      path: `/saves/${saveFilename}`,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error saving file:', error);
    res.status(500).json({ error: 'Failed to save file', details: error.message });
  }
});

// API endpoint to load JSON from file
app.get('/api/editor/load/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filepath = path.join(__dirname, 'saves', filename);
    
    const data = await fs.readFile(filepath, 'utf-8');
    const jsonData = JSON.parse(data);
    
    res.json({
      success: true,
      data: jsonData,
      filename: filename,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error loading file:', error);
    res.status(500).json({ error: 'Failed to load file', details: error.message });
  }
});

// Serve exported files
app.use('/exports', express.static(path.join(__dirname, 'exports')));
app.use('/saves', express.static(path.join(__dirname, 'saves')));

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`API endpoints available:`);
  console.log(`  - POST /api/canvas/export - Export full canvas as PNG`);
  console.log(`  - POST /api/canvas/extents - Export canvas extents as PNG`);
  console.log(`  - GET  /api/editor/data - Read JSON editor data`);
  console.log(`  - POST /api/editor/data - Write JSON editor data`);
  console.log(`  - GET  /api/chatbot/canvas-state - Get canvas state for chatbot`);
  console.log(`  - POST /api/chatbot/update-canvas - Update canvas via chatbot`);
  console.log(`  - POST /api/editor/save - Save JSON to file`);
  console.log(`  - GET  /api/editor/load/:filename - Load JSON from file`);
});