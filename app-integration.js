// Integration script for API functionality
document.addEventListener('DOMContentLoaded', () => {
    // Check if app instance exists
    if (typeof app === 'undefined') {
        console.error('App instance not found. Make sure app.js is loaded first.');
        return;
    }

    // Export canvas as PNG
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
            alert('Failed to export canvas. Make sure the Railway API is accessible at https://pitzel.up.railway.app');
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
});