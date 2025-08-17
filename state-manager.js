// Central State Manager for Parametric Drawing Editor
// Handles coordination between API, Canvas, and JSON interfaces

class CentralStateManager {
    constructor() {
        this.state = {
            version: "1.0",
            units: "grid",
            gridSize: 20,
            origin: [0, 0],
            entities: [],
            constraints: [],
            metadata: {},
            timestamp: new Date().toISOString()
        };
        
        this.listeners = [];
        this.isLoading = false;
        this.isSaving = false;
        this.apiBaseURL = 'http://localhost:3001';
        
        // Polling for external changes
        this.pollInterval = null;
        this.lastKnownState = null;
        this.pollingEnabled = true;
        this.pollIntervalMs = 2000; // Check every 2 seconds
    }

    // Subscribe to state changes
    subscribe(callback) {
        this.listeners.push(callback);
        return () => {
            const index = this.listeners.indexOf(callback);
            if (index > -1) {
                this.listeners.splice(index, 1);
            }
        };
    }

    // Notify all listeners of state changes
    notifyListeners() {
        this.listeners.forEach(callback => {
            try {
                callback(this.getState());
            } catch (error) {
                console.error('State listener error:', error);
            }
        });
    }

    // Get current state (immutable copy)
    getState() {
        return JSON.parse(JSON.stringify(this.state));
    }

    // Update state and notify listeners
    updateState(newState) {
        this.state = {
            ...this.state,
            ...newState,
            timestamp: new Date().toISOString()
        };
        this.notifyListeners();
        console.log(`🔄 State updated: ${this.state.entities.length} entities`);
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
        
        const requiredFields = ['version', 'units', 'gridSize', 'origin', 'entities', 'constraints'];
        for (const field of requiredFields) {
            if (!(field in data)) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        if (!Array.isArray(data.entities)) {
            throw new Error('Entities must be an array');
        }
        
        for (const entity of data.entities) {
            this.validateEntity(entity);
        }

        if (!Array.isArray(data.constraints)) {
            throw new Error('Constraints must be an array');
        }

        return true;
    }

    // Load state from API
    async loadFromAPI() {
        if (this.isLoading) {
            console.log('⚠️ Already loading, skipping...');
            return;
        }
        
        this.isLoading = true;
        try {
            console.log('🔄 Loading state from API...');
            const response = await fetch(`${this.apiBaseURL}/api/editor/data`);
            const result = await response.json();
            
            if (result.success && result.data) {
                this.validateData(result.data);
                this.lastKnownState = result.data; // Set for polling comparison
                this.updateState(result.data);
                console.log(`✅ Loaded ${result.data.entities.length} entities from API`);
            } else {
                throw new Error('API response was not successful');
            }
        } catch (error) {
            console.error('❌ Failed to load from API:', error.message);
            throw error;
        } finally {
            this.isLoading = false;
        }
    }

    // Save state to API
    async saveToAPI(saveToPersistent = false) {
        if (this.isSaving) {
            console.log('⚠️ Already saving, skipping...');
            return;
        }
        
        this.isSaving = true;
        try {
            console.log('🔄 Saving state to API...');
            const response = await fetch(`${this.apiBaseURL}/api/editor/data`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...this.state,
                    save: saveToPersistent
                })
            });
            
            const result = await response.json();
            if (result.success) {
                this.lastKnownState = this.state; // Update for polling comparison
                console.log('✅ State saved to API successfully');
                return result;
            } else {
                throw new Error('API save was not successful');
            }
        } catch (error) {
            console.error('❌ Failed to save to API:', error.message);
            throw error;
        } finally {
            this.isSaving = false;
        }
    }

    // Add entity
    async addEntity(entity, saveToPersistent = false) {
        try {
            this.validateEntity(entity);
            
            // Check for duplicate ID
            if (this.state.entities.some(e => e.id === entity.id)) {
                throw new Error(`Entity with ID '${entity.id}' already exists`);
            }
            
            // Update local state
            const newEntities = [...this.state.entities, entity];
            this.updateState({ entities: newEntities });
            
            // Save to API
            await this.saveToAPI(saveToPersistent);
            
            console.log(`✅ Entity added: ${entity.id}`);
            return entity;
        } catch (error) {
            console.error('❌ Failed to add entity:', error.message);
            throw error;
        }
    }

    // Remove entity
    async removeEntity(entityId, saveToPersistent = false) {
        try {
            const index = this.state.entities.findIndex(e => e.id === entityId);
            if (index === -1) {
                throw new Error(`Entity with ID '${entityId}' not found`);
            }
            
            const removed = this.state.entities[index];
            const newEntities = this.state.entities.filter(e => e.id !== entityId);
            
            // Update local state
            this.updateState({ entities: newEntities });
            
            // Save to API
            await this.saveToAPI(saveToPersistent);
            
            console.log(`✅ Entity removed: ${entityId}`);
            return removed;
        } catch (error) {
            console.error('❌ Failed to remove entity:', error.message);
            throw error;
        }
    }

    // Update entity
    async updateEntity(entityId, updates, saveToPersistent = false) {
        try {
            const index = this.state.entities.findIndex(e => e.id === entityId);
            if (index === -1) {
                throw new Error(`Entity with ID '${entityId}' not found`);
            }
            
            const newEntities = [...this.state.entities];
            newEntities[index] = { ...newEntities[index], ...updates };
            
            // Update local state
            this.updateState({ entities: newEntities });
            
            // Save to API
            await this.saveToAPI(saveToPersistent);
            
            console.log(`✅ Entity updated: ${entityId}`);
            return newEntities[index];
        } catch (error) {
            console.error('❌ Failed to update entity:', error.message);
            throw error;
        }
    }

    // Clear all entities
    async clearEntities(saveToPersistent = false) {
        try {
            // Update local state
            this.updateState({ entities: [] });
            
            // Save to API
            await this.saveToAPI(saveToPersistent);
            
            console.log('✅ All entities cleared');
        } catch (error) {
            console.error('❌ Failed to clear entities:', error.message);
            throw error;
        }
    }

    // Replace entire state
    async replaceState(newState, saveToPersistent = false) {
        try {
            this.validateData(newState);
            
            // Update local state
            this.updateState(newState);
            
            // Save to API
            await this.saveToAPI(saveToPersistent);
            
            console.log(`✅ State replaced: ${newState.entities.length} entities`);
        } catch (error) {
            console.error('❌ Failed to replace state:', error.message);
            throw error;
        }
    }

    // Get entity by ID
    getEntity(entityId) {
        return this.state.entities.find(e => e.id === entityId);
    }

    // Check if entity exists
    hasEntity(entityId) {
        return this.state.entities.some(e => e.id === entityId);
    }

    // Get entity count
    getEntityCount() {
        return this.state.entities.length;
    }

    // Generate unique entity ID
    generateEntityId() {
        return `entity_${Math.random().toString(36).substr(2, 4)}`;
    }

    // Initialize state manager
    async initialize() {
        try {
            console.log('🚀 Initializing Central State Manager...');
            await this.loadFromAPI();
            this.startPolling();
            console.log('✅ Central State Manager initialized');
        } catch (error) {
            console.error('❌ Failed to initialize state manager:', error.message);
            // Continue with default state
        }
    }
    
    // Start polling for external changes
    startPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
        }
        
        this.pollInterval = setInterval(async () => {
            if (this.pollingEnabled && !this.isLoading && !this.isSaving) {
                await this.checkForExternalChanges();
            }
        }, this.pollIntervalMs);
        
        console.log(`🔄 Started polling for external changes every ${this.pollIntervalMs}ms`);
    }
    
    // Stop polling
    stopPolling() {
        if (this.pollInterval) {
            clearInterval(this.pollInterval);
            this.pollInterval = null;
            console.log('⏹️ Stopped polling for external changes');
        }
    }
    
    // Check for external changes
    async checkForExternalChanges() {
        try {
            const response = await fetch(`${this.apiBaseURL}/api/editor/data`);
            const result = await response.json();
            
            if (result.success && result.data) {
                const currentStateHash = JSON.stringify(result.data.entities);
                const lastStateHash = this.lastKnownState ? JSON.stringify(this.lastKnownState.entities) : null;
                
                if (currentStateHash !== lastStateHash) {
                    console.log('🔄 External changes detected, updating state...');
                    this.lastKnownState = result.data;
                    this.updateState(result.data);
                }
            }
        } catch (error) {
            // Silently ignore polling errors to avoid spam
        }
    }
}

// Create global instance
window.centralStateManager = new CentralStateManager();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.centralStateManager.initialize();
});

console.log('📦 Central State Manager loaded'); 