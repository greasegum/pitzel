// Integration script for API functionality
document.addEventListener('DOMContentLoaded', () => {
    // Check if app instance exists
    if (typeof app === 'undefined') {
        console.error('App instance not found. Make sure app.js is loaded first.');
        return;
    }

    // API status indicator
    const apiStatusElement = document.getElementById('api-status');
    
    // Check API connection
    async function checkAPIConnection() {
        try {
            const response = await fetch('https://pitzel.up.railway.app/api/editor/data');
            if (response.ok) {
                apiStatusElement.textContent = 'API: Connected';
                apiStatusElement.style.color = '#4CAF50';
                return true;
            }
        } catch (error) {
            apiStatusElement.textContent = 'API: Disconnected';
            apiStatusElement.style.color = '#888';
            return false;
        }
    }

    // Check connection on load and periodically
    checkAPIConnection();
    setInterval(checkAPIConnection, 5000);

    // Export full canvas as PNG
    document.getElementById('export-canvas-btn').addEventListener('click', async () => {
        try {
            const metadata = {
                entities: app.entities,
                constraints: app.constraints,
                timestamp: new Date().toISOString()
            };
            
            const result = await app.exportCanvasToAPI(metadata);
            
            if (result && result.success) {
                alert(`Canvas exported successfully!\nFile: ${result.filename}\nPath: ${result.path}`);
            }
        } catch (error) {
            console.error('Export failed:', error);
            alert('Failed to export canvas. Make sure the API is accessible at https://pitzel.up.railway.app');
        }
    });

    // Export selected area as PNG
    document.getElementById('export-extents-btn').addEventListener('click', async () => {
        try {
            // Calculate bounds of all entities
            const bounds = window.drawingAPI.calculateDrawingBounds(app.entities);
            
            if (bounds.width === 0 || bounds.height === 0) {
                alert('No entities to export. Please draw something first.');
                return;
            }

            // Add padding
            const padding = 20;
            const x = Math.max(0, bounds.minX - padding);
            const y = Math.max(0, bounds.minY - padding);
            const width = bounds.width + (padding * 2);
            const height = bounds.height + (padding * 2);
            
            const metadata = {
                entities: app.entities,
                bounds: bounds,
                timestamp: new Date().toISOString()
            };
            
            const result = await app.exportCanvasExtentsToAPI(x, y, width, height, metadata);
            
            if (result && result.success) {
                alert(`Canvas extents exported successfully!\nFile: ${result.filename}\nExtents: ${x},${y} ${width}x${height}`);
            }
        } catch (error) {
            console.error('Export extents failed:', error);
            alert('Failed to export canvas extents. Make sure the API is accessible at https://pitzel.up.railway.app');
        }
    });

    // Sync with API
    document.getElementById('sync-api-btn').addEventListener('click', async () => {
        try {
            const result = await app.syncWithAPI();
            
            if (result && result.success) {
                alert('Successfully synced with API!');
                checkAPIConnection();
            }
        } catch (error) {
            console.error('Sync failed:', error);
            alert('Failed to sync with API. Make sure the API is accessible at https://pitzel.up.railway.app');
        }
    });

    // Add keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + E: Export canvas
        if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
            e.preventDefault();
            document.getElementById('export-canvas-btn').click();
        }
        
        // Ctrl/Cmd + Shift + E: Export extents
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'E') {
            e.preventDefault();
            document.getElementById('export-extents-btn').click();
        }
        
        // Ctrl/Cmd + Shift + S: Sync with API
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
            e.preventDefault();
            document.getElementById('sync-api-btn').click();
        }
    });

    // Chatbot integration helper functions
    window.chatbotAPI = {
        // Get current canvas state for chatbot
        getCanvasState: async function() {
            try {
                return await window.drawingAPI.getChatbotCanvasState();
            } catch (error) {
                console.error('Failed to get canvas state:', error);
                return null;
            }
        },

        // Add entity via chatbot
        addEntity: async function(entity) {
            try {
                const result = await window.drawingAPI.chatbotUpdateCanvas('add_entity', { entity });
                if (result.success) {
                    await app.loadFromAPI();
                }
                return result;
            } catch (error) {
                console.error('Failed to add entity:', error);
                return null;
            }
        },

        // Remove entity via chatbot
        removeEntity: async function(entityId) {
            try {
                const result = await window.drawingAPI.chatbotUpdateCanvas('remove_entity', { entityId });
                if (result.success) {
                    await app.loadFromAPI();
                }
                return result;
            } catch (error) {
                console.error('Failed to remove entity:', error);
                return null;
            }
        },

        // Update entity via chatbot
        updateEntity: async function(entityId, updates) {
            try {
                const result = await window.drawingAPI.chatbotUpdateCanvas('update_entity', { entityId, updates });
                if (result.success) {
                    await app.loadFromAPI();
                }
                return result;
            } catch (error) {
                console.error('Failed to update entity:', error);
                return null;
            }
        },

        // Clear canvas via chatbot
        clearCanvas: async function() {
            try {
                const result = await window.drawingAPI.chatbotUpdateCanvas('clear_canvas', {});
                if (result.success) {
                    await app.loadFromAPI();
                }
                return result;
            } catch (error) {
                console.error('Failed to clear canvas:', error);
                return null;
            }
        },

        // Export canvas for chatbot
        exportForChatbot: async function() {
            try {
                const metadata = {
                    source: 'chatbot',
                    entities: app.entities,
                    constraints: app.constraints,
                    timestamp: new Date().toISOString()
                };
                
                return await app.exportCanvasToAPI(metadata);
            } catch (error) {
                console.error('Failed to export for chatbot:', error);
                return null;
            }
        }
    };

    console.log('API integration loaded. Chatbot API available at window.chatbotAPI');
});