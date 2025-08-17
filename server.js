const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;
const PERSISTENCE_FILE = 'persistent_data.json';

// Enable CORS
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static('.'));

// State Management Class
class EditorStateManager {
  constructor() {
    this.data = {
      version: "1.0",
      units: "grid", 
      gridSize: 20,
      origin: [0, 0],
      entities: [],
      constraints: [],
      metadata: {},
      timestamp: new Date().toISOString()
    };
    this.isLoading = false;
    this.isSaving = false;
  }

  // Validate entity structure
  validateEntity(entity) {
    if (!entity || typeof entity !== 'object') {
      throw new Error('Entity must be an object');
    }
    if (!entity.id || typeof entity.id !== 'string') {
      throw new Error('Entity must have a valid string id');
    }
    if (!entity.type || typeof entity.type !== 'string') {
      throw new Error('Entity must have a valid string type');
    }
    return true;
  }

  // Validate complete data structure
  validateData(data) {
    if (!data || typeof data !== 'object') {
      throw new Error('Data must be an object');
    }
    
    // Validate required fields
    const requiredFields = ['version', 'units', 'gridSize', 'origin', 'entities', 'constraints'];
    for (const field of requiredFields) {
      if (!(field in data)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    // Validate entities array
    if (!Array.isArray(data.entities)) {
      throw new Error('Entities must be an array');
    }
    
    // Validate each entity
    for (const entity of data.entities) {
      this.validateEntity(entity);
    }

    // Validate constraints array
    if (!Array.isArray(data.constraints)) {
      throw new Error('Constraints must be an array');
    }

    return true;
  }

  // Update state with validation
  updateState(newData) {
    try {
      // Validate the new data
      this.validateData(newData);
      
      // Update the state
      this.data = {
        ...this.data,
        ...newData,
        timestamp: new Date().toISOString()
      };
      
      console.log(`✅ State updated: ${this.data.entities.length} entities`);
      return true;
    } catch (error) {
      console.error('❌ State update failed:', error.message);
      throw error;
    }
  }

  // Get current state
  getState() {
    return { ...this.data };
  }

  // Load state from file
  async loadFromFile() {
    if (this.isLoading) {
      console.log('⚠️ Already loading, skipping...');
      return;
    }
    
    this.isLoading = true;
    try {
      const data = await fs.readFile(PERSISTENCE_FILE, 'utf8');
      const parsedData = JSON.parse(data);
      
      // Validate loaded data
      this.validateData(parsedData);
      
      // Update state
      this.data = parsedData;
      console.log('📁 State loaded from file successfully');
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('📁 No persistent file found, using default state');
      } else {
        console.error('❌ Failed to load state from file:', error.message);
        throw error;
      }
    } finally {
      this.isLoading = false;
    }
  }

  // Save state to file
  async saveToFile() {
    if (this.isSaving) {
      console.log('⚠️ Already saving, skipping...');
      return;
    }
    
    this.isSaving = true;
    try {
      await fs.writeFile(PERSISTENCE_FILE, JSON.stringify(this.data, null, 2));
      console.log('💾 State saved to file successfully');
    } catch (error) {
      console.error('❌ Failed to save state to file:', error.message);
      throw error;
    } finally {
      this.isSaving = false;
    }
  }

  // Add entity
  addEntity(entity) {
    try {
      this.validateEntity(entity);
      
      // Check for duplicate ID
      if (this.data.entities.some(e => e.id === entity.id)) {
        throw new Error(`Entity with ID '${entity.id}' already exists`);
      }
      
      this.data.entities.push(entity);
      this.data.timestamp = new Date().toISOString();
      
      console.log(`✅ Entity added: ${entity.id}`);
      return entity;
    } catch (error) {
      console.error('❌ Failed to add entity:', error.message);
      throw error;
    }
  }

  // Remove entity
  removeEntity(entityId) {
    const index = this.data.entities.findIndex(e => e.id === entityId);
    if (index === -1) {
      throw new Error(`Entity with ID '${entityId}' not found`);
    }
    
    const removed = this.data.entities.splice(index, 1)[0];
    this.data.timestamp = new Date().toISOString();
    
    console.log(`✅ Entity removed: ${entityId}`);
    return removed;
  }

  // Update entity
  updateEntity(entityId, updates) {
    const index = this.data.entities.findIndex(e => e.id === entityId);
    if (index === -1) {
      throw new Error(`Entity with ID '${entityId}' not found`);
    }
    
    this.data.entities[index] = { ...this.data.entities[index], ...updates };
    this.data.timestamp = new Date().toISOString();
    
    console.log(`✅ Entity updated: ${entityId}`);
    return this.data.entities[index];
  }

  // Clear all entities
  clearEntities() {
    this.data.entities = [];
    this.data.timestamp = new Date().toISOString();
    console.log('✅ All entities cleared');
  }
}

// Create state manager instance
const stateManager = new EditorStateManager();

// Initialize server
async function initializeServer() {
  try {
    await stateManager.loadFromFile();
    console.log('🚀 Server ready - State management initialized');
  } catch (error) {
    console.error('❌ Server initialization failed:', error.message);
    process.exit(1);
  }
}

initializeServer();

// API Help endpoint - lists all available endpoints
app.get('/api', (req, res) => {
  res.json({
    name: 'Parametric Drawing Editor API',
    version: '1.0.0',
    description: 'API for canvas export and JSON editor integration with LLM chatbots',
    endpoints: {
      help: {
        method: 'GET',
        path: '/api',
        description: 'This help endpoint - lists all available API endpoints'
      },
      canvas: {
        export: {
          method: 'POST',
          path: '/api/canvas/export',
          description: 'Export full canvas as PNG',
          body: {
            imageData: 'base64 encoded PNG data',
            bounds: '{ x, y, width, height }',
            metadata: 'optional metadata object'
          }
        },
        extents: {
          method: 'POST',
          path: '/api/canvas/extents',
          description: 'Export specific canvas area as PNG',
          body: {
            imageData: 'base64 encoded PNG data',
            x: 'number - left position',
            y: 'number - top position',
            width: 'number - area width',
            height: 'number - area height',
            metadata: 'optional metadata object'
          }
        }
      },
      editor: {
        getData: {
          method: 'GET',
          path: '/api/editor/data',
          description: 'Get current JSON editor data (entities, constraints, metadata)'
        },
        setData: {
          method: 'POST',
          path: '/api/editor/data',
          description: 'Update JSON editor data',
          body: {
            entities: 'array of drawing entities',
            constraints: 'array of constraints',
            metadata: 'metadata object'
          }
        },
        save: {
          method: 'POST',
          path: '/api/editor/save',
          description: 'Save drawing to JSON file',
          body: {
            data: 'drawing data object',
            filename: 'optional filename'
          }
        },
        load: {
          method: 'GET',
          path: '/api/editor/load/:filename',
          description: 'Load drawing from JSON file',
          params: {
            filename: 'name of the file to load'
          }
        }
      },
      chatbot: {
        getState: {
          method: 'GET',
          path: '/api/chatbot/canvas-state',
          description: 'Get current canvas state for chatbot integration'
        },
        updateCanvas: {
          method: 'POST',
          path: '/api/chatbot/update-canvas',
          description: 'Update canvas via chatbot commands',
          body: {
            action: 'add_entity | remove_entity | update_entity | add_constraint | clear_canvas',
            data: 'action-specific data object'
          },
          examples: {
            add_entity: {
              action: 'add_entity',
              data: {
                entity: '{ id, type, ...properties }'
              }
            },
            remove_entity: {
              action: 'remove_entity',
              data: {
                entityId: 'entity_id_to_remove'
              }
            },
            update_entity: {
              action: 'update_entity',
              data: {
                entityId: 'entity_id_to_update',
                updates: '{ ...properties_to_update }'
              }
            }
          }
        }
      }
    },
    entityTypes: ['line', 'polyline', 'rectangle', 'circle', 'arc'],
    staticRoutes: {
      exports: '/exports/:filename - Access exported PNG files',
      saves: '/saves/:filename - Access saved JSON files'
    }
  });
});

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
      data: stateManager.getState(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error reading editor data:', error);
    res.status(500).json({ error: 'Failed to read editor data', details: error.message });
  }
});

// API endpoint to write/update JSON editor data
app.post('/api/editor/data', async (req, res) => {
  try {
    const { version, units, gridSize, origin, entities, constraints, metadata, save = false } = req.body;
    
    // Update the stored data
    stateManager.updateState({
      version: version || stateManager.data.version,
      units: units || stateManager.data.units,
      gridSize: gridSize || stateManager.data.gridSize,
      origin: origin || stateManager.data.origin,
      entities: entities || stateManager.data.entities,
      constraints: constraints || stateManager.data.constraints,
      metadata: metadata || stateManager.data.metadata,
      timestamp: new Date().toISOString()
    });
    
    // Only save if explicitly requested
    if (save) {
      await stateManager.saveToFile();
    }
    
    res.json({
      success: true,
      message: 'Editor data updated successfully',
      data: stateManager.getState()
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
      canvas: stateManager.getState(),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting canvas state:', error);
    res.status(500).json({ error: 'Failed to get canvas state', details: error.message });
  }
});

// API endpoint for LLM chatbot integration - Update canvas
app.post('/api/chatbot/update-canvas', async (req, res) => {
  try {
    const { action, data } = req.body;
    
    if (!action) {
      return res.status(400).json({ error: 'No action specified' });
    }
    
    let result = {};
    
    switch (action) {
      case 'add_entity':
        if (data.entity) {
          stateManager.addEntity(data.entity);
          result = { message: 'Entity added', entity: data.entity };
        }
        break;
        
      case 'remove_entity':
        if (data.entityId) {
          stateManager.removeEntity(data.entityId);
          result = { message: 'Entity removed', entityId: data.entityId };
        }
        break;
        
      case 'update_entity':
        if (data.entityId && data.updates) {
          stateManager.updateEntity(data.entityId, data.updates);
          result = { message: 'Entity updated', entity: stateManager.getState().entities.find(e => e.id === data.entityId) };
        }
        break;
        
      case 'add_constraint':
        if (data.constraint) {
          // Assuming constraints are added to the stateManager's data.constraints
          // This part needs to be implemented in the stateManager class
          // For now, we'll just log and return a placeholder
          console.log('add_constraint action received, but constraint logic not fully implemented in stateManager');
          result = { message: 'Constraint added (placeholder)', constraint: data.constraint };
        }
        break;
        
      case 'clear_canvas':
        stateManager.clearEntities();
        result = { message: 'Canvas cleared' };
        break;
        
      default:
        return res.status(400).json({ error: 'Unknown action' });
    }
    
    // Only save if explicitly requested in the request body
    if (req.body.save) {
      await stateManager.saveToFile();
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

// API endpoint to save current editor data to persistent storage
app.post('/api/editor/save-persistent', async (req, res) => {
  try {
    await stateManager.saveToFile();
    
    res.json({
      success: true,
      message: 'Editor data saved to persistent storage',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error saving persistent data:', error);
    res.status(500).json({ error: 'Failed to save persistent data', details: error.message });
  }
});

// API endpoint to reload data from persistent storage
app.post('/api/editor/reload-persistent', async (req, res) => {
  try {
    await stateManager.loadFromFile();
    
    res.json({
      success: true,
      message: 'Editor data reloaded from persistent storage',
      data: stateManager.getState(),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error reloading persistent data:', error);
    res.status(500).json({ error: 'Failed to reload persistent data', details: error.message });
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
  console.log(`📁 Persistent storage enabled: ${PERSISTENCE_FILE}`);
  console.log(`\nAPI Help: GET /api - Get detailed API documentation\n`);
  console.log(`API endpoints available:`);
  console.log(`  - GET  /api - API help and documentation`);
  console.log(`  - POST /api/canvas/export - Export full canvas as PNG`);
  console.log(`  - POST /api/canvas/extents - Export canvas extents as PNG`);
  console.log(`  - GET  /api/editor/data - Read JSON editor data`);
  console.log(`  - POST /api/editor/data - Write JSON editor data`);
  console.log(`  - GET  /api/chatbot/canvas-state - Get canvas state for chatbot`);
  console.log(`  - POST /api/chatbot/update-canvas - Update canvas via chatbot`);
  console.log(`  - POST /api/editor/save - Save JSON to file`);
  console.log(`  - GET  /api/editor/load/:filename - Load JSON from file`);
});