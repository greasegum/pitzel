// API Client for Parametric Drawing Editor
class DrawingAPIClient {
    constructor(baseURL = 'https://pitzel.up.railway.app') {
        this.baseURL = baseURL;
    }

    // Export canvas as PNG
    async exportCanvas(canvas, metadata = {}) {
        try {
            const imageData = canvas.toDataURL('image/png');
            const bounds = this.getCanvasBounds(canvas);
            
            const response = await fetch(`${this.baseURL}/api/canvas/export`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    imageData,
                    bounds,
                    metadata
                })
            });
            
            return await response.json();
        } catch (error) {
            console.error('Error exporting canvas:', error);
            throw error;
        }
    }

    // Export specific canvas extents as PNG
    async exportCanvasExtents(canvas, x, y, width, height, metadata = {}) {
        try {
            // Create a temporary canvas for the cropped area
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = width;
            tempCanvas.height = height;
            const tempCtx = tempCanvas.getContext('2d');
            
            // Draw the cropped area
            tempCtx.drawImage(canvas, x, y, width, height, 0, 0, width, height);
            
            const imageData = tempCanvas.toDataURL('image/png');
            
            const response = await fetch(`${this.baseURL}/api/canvas/extents`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    imageData,
                    x,
                    y,
                    width,
                    height,
                    metadata
                })
            });
            
            return await response.json();
        } catch (error) {
            console.error('Error exporting canvas extents:', error);
            throw error;
        }
    }

    // Get JSON editor data
    async getEditorData() {
        try {
            const response = await fetch(`${this.baseURL}/api/editor/data`);
            return await response.json();
        } catch (error) {
            console.error('Error getting editor data:', error);
            throw error;
        }
    }

    // Update JSON editor data
    async updateEditorData(entities, constraints, metadata) {
        try {
            const response = await fetch(`${this.baseURL}/api/editor/data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    entities,
                    constraints,
                    metadata
                })
            });
            
            return await response.json();
        } catch (error) {
            console.error('Error updating editor data:', error);
            throw error;
        }
    }

    // Get canvas state for chatbot
    async getChatbotCanvasState() {
        try {
            const response = await fetch(`${this.baseURL}/api/chatbot/canvas-state`);
            return await response.json();
        } catch (error) {
            console.error('Error getting canvas state:', error);
            throw error;
        }
    }

    // Update canvas via chatbot action
    async chatbotUpdateCanvas(action, data) {
        try {
            const response = await fetch(`${this.baseURL}/api/chatbot/update-canvas`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    action,
                    data
                })
            });
            
            return await response.json();
        } catch (error) {
            console.error('Error updating canvas via chatbot:', error);
            throw error;
        }
    }

    // Save drawing to file
    async saveDrawing(data, filename) {
        try {
            const response = await fetch(`${this.baseURL}/api/editor/save`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    data,
                    filename
                })
            });
            
            return await response.json();
        } catch (error) {
            console.error('Error saving drawing:', error);
            throw error;
        }
    }

    // Load drawing from file
    async loadDrawing(filename) {
        try {
            const response = await fetch(`${this.baseURL}/api/editor/load/${filename}`);
            return await response.json();
        } catch (error) {
            console.error('Error loading drawing:', error);
            throw error;
        }
    }

    // Helper method to get canvas bounds
    getCanvasBounds(canvas) {
        // This would need to be implemented based on the actual drawn content
        // For now, return the full canvas dimensions
        return {
            x: 0,
            y: 0,
            width: canvas.width,
            height: canvas.height
        };
    }

    // Helper method to calculate actual drawing bounds from entities
    calculateDrawingBounds(entities) {
        if (!entities || entities.length === 0) {
            return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
        }

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        entities.forEach(entity => {
            if (entity.type === 'line' || entity.type === 'polyline') {
                const points = entity.points || [];
                points.forEach(point => {
                    minX = Math.min(minX, point.x);
                    minY = Math.min(minY, point.y);
                    maxX = Math.max(maxX, point.x);
                    maxY = Math.max(maxY, point.y);
                });
            } else if (entity.type === 'rectangle') {
                minX = Math.min(minX, entity.x);
                minY = Math.min(minY, entity.y);
                maxX = Math.max(maxX, entity.x + entity.width);
                maxY = Math.max(maxY, entity.y + entity.height);
            } else if (entity.type === 'circle') {
                minX = Math.min(minX, entity.center.x - entity.radius);
                minY = Math.min(minY, entity.center.y - entity.radius);
                maxX = Math.max(maxX, entity.center.x + entity.radius);
                maxY = Math.max(maxY, entity.center.y + entity.radius);
            } else if (entity.type === 'arc') {
                // Simplified bounds for arc
                minX = Math.min(minX, entity.center.x - entity.radius);
                minY = Math.min(minY, entity.center.y - entity.radius);
                maxX = Math.max(maxX, entity.center.x + entity.radius);
                maxY = Math.max(maxY, entity.center.y + entity.radius);
            }
        });

        return {
            minX: minX === Infinity ? 0 : minX,
            minY: minY === Infinity ? 0 : minY,
            maxX: maxX === -Infinity ? 100 : maxX,
            maxY: maxY === -Infinity ? 100 : maxY,
            width: maxX - minX,
            height: maxY - minY
        };
    }
}

// Create global instance
window.drawingAPI = new DrawingAPIClient();

// Integration with existing app
if (typeof ParametricDrawingApp !== 'undefined') {
    // Add API methods to the existing app prototype
    ParametricDrawingApp.prototype.exportCanvasToAPI = async function(metadata = {}) {
        try {
            const result = await window.drawingAPI.exportCanvas(this.canvas, metadata);
            return result;
        } catch (error) {
            console.error('Failed to export canvas:', error);
            alert('Failed to export canvas. Make sure the Railway API is accessible at https://pitzel.up.railway.app');
        }
    };

    ParametricDrawingApp.prototype.exportCanvasExtentsToAPI = async function(x, y, width, height, metadata = {}) {
        try {
            const result = await window.drawingAPI.exportCanvasExtents(this.canvas, x, y, width, height, metadata);
            return result;
        } catch (error) {
            console.error('Failed to export canvas extents:', error);
            alert('Failed to export canvas extents. Make sure the Railway API is accessible at https://pitzel.up.railway.app');
        }
    };

    ParametricDrawingApp.prototype.syncWithAPI = async function() {
        try {
            const result = await window.drawingAPI.updateEditorData(
                this.entities,
                this.constraints,
                { timestamp: new Date().toISOString() }
            );
            
            return result;
        } catch (error) {
            console.error('Failed to sync with API:', error);
        }
    };

    ParametricDrawingApp.prototype.loadFromAPI = async function() {
        try {
            const result = await window.drawingAPI.getEditorData();
            if (result.success && result.data) {
                this.entities = result.data.entities || [];
                this.constraints = result.data.constraints || [];
                this.render();
                this.updateJSON();
            }
            return result;
        } catch (error) {
            console.error('Failed to load from API:', error);
        }
    };


}