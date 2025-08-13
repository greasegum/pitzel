class ParametricDrawingApp {
    constructor() {
        this.canvas = document.getElementById('drawing-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.jsonEditor = document.getElementById('json-editor');
        
        this.gridSize = 20;
        this.snapThreshold = 10;
        this.currentTool = 'select';
        this.isDrawing = false;
        this.tempShape = null;
        this.selectedEntity = null;
        this.hoveredEntity = null;
        this.hoveredSegmentId = null;
        this.selectedSegment = null;
        
        // Multi-selection
        this.selectedItems = []; // Array of {entityId, segmentIndex?}
        this.isMultiSelecting = false;
        this.isDragging = false;
        this.dragStart = null;
        this.dragEntity = null;
        
        this.entities = [];
        this.constraints = [];
        this.idCounter = 1;
        
        this.mousePos = { x: 0, y: 0 };
        this.gridPos = { x: 0, y: 0 };
        this.snapIndicator = null;
        
        this.polylinePoints = [];
        this.isDrawingPolyline = false;
        
        this.origin = { x: 0, y: 0 };
        this.settingOrigin = false;
        
        this.defaultColors = ['#00ff88', '#ff6b6b', '#4ecdc4', '#ffe66d', '#a8e6cf', '#ffd3b6', '#ffaaa5', '#ff8b94'];
        this.colorIndex = 0;
        
        // Undo/Redo
        this.undoStack = [];
        this.redoStack = [];
        this.maxUndoSteps = 50;
        
        // Zoom and Pan
        this.zoom = 1;
        this.panOffset = { x: 0, y: 0 };
        this.isPanning = false;
        this.panStart = null;
        
        // Clipboard
        this.clipboard = null;
        
        // Display options
        this.showDimensions = true;
        this.showGrid = true;
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.render();
        this.updateJSON();
        this.displayShortcuts();
    }
    
    setupCanvas() {
        const resizeCanvas = () => {
            const rect = this.canvas.parentElement.getBoundingClientRect();
            this.canvas.width = rect.width;
            this.canvas.height = rect.height - 80;
            this.render();
        };
        
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
    }
    
    setupEventListeners() {
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('dblclick', this.handleDoubleClick.bind(this));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setTool(btn.dataset.tool);
            });
        });
        
        document.getElementById('clear-btn').addEventListener('click', () => {
            this.saveState();
            this.clearDrawing();
        });
        
        document.getElementById('export-btn').addEventListener('click', () => {
            this.exportDrawing();
        });
        
        document.getElementById('format-json').addEventListener('click', () => {
            this.formatJSON();
        });
        
        document.getElementById('validate-json').addEventListener('click', () => {
            this.validateJSON();
        });
        
        document.getElementById('add-constraint').addEventListener('click', () => {
            this.showAdvancedConstraintDialog();
        });
        
        document.getElementById('origin-btn').addEventListener('click', () => {
            this.settingOrigin = true;
            document.getElementById('tool-status').textContent = 'Setting Origin';
        });
        
        document.getElementById('add-metadata-field').addEventListener('click', () => {
            this.addMetadataField();
        });
        
        this.jsonEditor.addEventListener('input', () => {
            this.handleJSONEdit();
        });
        
        this.jsonEditor.addEventListener('mousemove', (e) => {
            this.handleJSONHover(e);
        });
        
        this.jsonEditor.addEventListener('mouseleave', () => {
            this.hoveredEntity = null;
            this.hoveredSegmentId = null;
            this.render();
        });
        
        this.jsonEditor.addEventListener('click', (e) => {
            this.handleJSONClick(e);
        });
        
        this.setTool('select');
    }
    
    handleWheel(e) {
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.min(Math.max(this.zoom * zoomDelta, 0.1), 5);
        
        // Zoom towards mouse position
        const worldX = (x - this.panOffset.x) / this.zoom;
        const worldY = (y - this.panOffset.y) / this.zoom;
        
        this.zoom = newZoom;
        
        this.panOffset.x = x - worldX * this.zoom;
        this.panOffset.y = y - worldY * this.zoom;
        
        this.render();
    }
    
    saveState() {
        const state = {
            entities: JSON.parse(JSON.stringify(this.entities)),
            constraints: JSON.parse(JSON.stringify(this.constraints)),
            idCounter: this.idCounter
        };
        
        this.undoStack.push(state);
        if (this.undoStack.length > this.maxUndoSteps) {
            this.undoStack.shift();
        }
        this.redoStack = [];
    }
    
    undo() {
        if (this.undoStack.length > 0) {
            const currentState = {
                entities: JSON.parse(JSON.stringify(this.entities)),
                constraints: JSON.parse(JSON.stringify(this.constraints)),
                idCounter: this.idCounter
            };
            this.redoStack.push(currentState);
            
            const previousState = this.undoStack.pop();
            this.entities = previousState.entities;
            this.constraints = previousState.constraints;
            this.idCounter = previousState.idCounter;
            
            this.updateJSON();
            this.render();
        }
    }
    
    redo() {
        if (this.redoStack.length > 0) {
            this.saveState();
            const nextState = this.redoStack.pop();
            this.entities = nextState.entities;
            this.constraints = nextState.constraints;
            this.idCounter = nextState.idCounter;
            
            this.updateJSON();
            this.render();
        }
    }
    
    copyEntity() {
        if (this.selectedEntity) {
            const entity = this.entities.find(e => e.id === this.selectedEntity);
            if (entity) {
                this.clipboard = JSON.parse(JSON.stringify(entity));
                this.showNotification('Entity copied');
            }
        }
    }
    
    pasteEntity() {
        if (this.clipboard) {
            this.saveState();
            const newEntity = JSON.parse(JSON.stringify(this.clipboard));
            newEntity.id = `entity_${this.idCounter++}`;
            
            // Offset the pasted entity
            const offset = 2; // Grid units
            switch (newEntity.type) {
                case 'line':
                    newEntity.start[0] += offset;
                    newEntity.start[1] += offset;
                    newEntity.end[0] += offset;
                    newEntity.end[1] += offset;
                    break;
                case 'rectangle':
                    newEntity.topLeft[0] += offset;
                    newEntity.topLeft[1] += offset;
                    newEntity.bottomRight[0] += offset;
                    newEntity.bottomRight[1] += offset;
                    break;
                case 'circle':
                case 'arc':
                    newEntity.center[0] += offset;
                    newEntity.center[1] += offset;
                    break;
                case 'polyline':
                    newEntity.points = newEntity.points.map(p => [p[0] + offset, p[1] + offset]);
                    if (newEntity.segments) {
                        newEntity.segments = newEntity.segments.map((seg, i) => ({
                            ...seg,
                            id: `${newEntity.id}_seg_${i}`
                        }));
                    }
                    break;
            }
            
            this.entities.push(newEntity);
            this.selectedEntity = newEntity.id;
            this.updateJSON();
            this.render();
            this.showNotification('Entity pasted');
        }
    }
    
    duplicateEntity() {
        if (this.selectedEntity) {
            this.copyEntity();
            this.pasteEntity();
        }
    }
    
    showNotification(message) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #0088ff;
            color: white;
            padding: 10px 20px;
            border-radius: 5px;
            z-index: 1000;
            animation: fadeIn 0.3s, fadeOut 0.3s 1.7s;
        `;
        document.body.appendChild(notification);
        setTimeout(() => notification.remove(), 2000);
    }
    
    displayShortcuts() {
        const shortcuts = [
            'Ctrl+Z: Undo',
            'Ctrl+Y: Redo',
            'Ctrl+C: Copy',
            'Ctrl+V: Paste',
            'Ctrl+D: Duplicate',
            'Delete: Delete',
            'G: Toggle Grid',
            'D: Toggle Dimensions',
            'ESC: Cancel',
            'C (in polyline): Close',
            'Space: Pan (hold)',
            'Scroll: Zoom'
        ];
        
        // Add shortcuts info to status bar
        const statusBar = document.querySelector('.status-bar');
        if (statusBar && !document.getElementById('shortcuts-hint')) {
            const shortcutsHint = document.createElement('span');
            shortcutsHint.id = 'shortcuts-hint';
            shortcutsHint.style.cssText = 'margin-left: auto; font-size: 11px; opacity: 0.7;';
            shortcutsHint.textContent = 'Press H for shortcuts';
            statusBar.appendChild(shortcutsHint);
        }
    }
    
    handleJSONHover(e) {
        const rect = this.jsonEditor.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Calculate line based on cursor position
        const lineHeight = parseInt(window.getComputedStyle(this.jsonEditor).lineHeight) || 20;
        const paddingTop = parseInt(window.getComputedStyle(this.jsonEditor).paddingTop) || 15;
        const scrollTop = this.jsonEditor.scrollTop;
        const charHeight = this.jsonEditor.scrollHeight / this.jsonEditor.value.split('\n').length;
        const approximateLine = Math.floor((y - paddingTop + scrollTop) / charHeight);
        
        const text = this.jsonEditor.value;
        const lines = text.split('\n');
        
        if (approximateLine < 0 || approximateLine >= lines.length) {
            this.hoveredEntity = null;
            this.hoveredSegmentId = null;
            this.render();
            return;
        }
        
        // Search for entity or segment ID in surrounding lines
        let entityId = null;
        let segmentId = null;
        const searchRadius = 10;
        
        for (let offset = 0; offset <= searchRadius; offset++) {
            for (let dir of [-1, 1]) {
                if (offset === 0 && dir === -1) continue;
                const lineIdx = approximateLine + (offset * dir);
                if (lineIdx >= 0 && lineIdx < lines.length) {
                    const line = lines[lineIdx];
                    
                    // Check for segment ID first (more specific)
                    const segmentMatch = line.match(/"id"\s*:\s*"(entity_\d+_seg_\d+)"/);
                    if (segmentMatch) {
                        segmentId = segmentMatch[1];
                        entityId = segmentMatch[1].split('_seg_')[0];
                        break;
                    }
                    
                    // Check for entity ID
                    const entityMatch = line.match(/"id"\s*:\s*"(entity_\d+)"/);
                    if (entityMatch && !entityMatch[1].includes('_seg_')) {
                        entityId = entityMatch[1];
                        break;
                    }
                }
            }
            if (entityId) break;
        }
        
        if (entityId !== this.hoveredEntity || segmentId !== this.hoveredSegmentId) {
            this.hoveredEntity = entityId;
            this.hoveredSegmentId = segmentId;
            this.render();
        }
    }
    
    handleJSONClick(e) {
        if (this.hoveredEntity) {
            const entity = this.entities.find(e => e.id === this.hoveredEntity);
            if (entity) {
                this.selectEntity(entity);
                
                if (this.hoveredSegmentId) {
                    const segmentMatch = this.hoveredSegmentId.match(/_seg_(\d+)$/);
                    if (segmentMatch) {
                        this.selectedSegment = parseInt(segmentMatch[1]);
                        this.updateSegmentMetadataEditor(entity, this.selectedSegment);
                    }
                }
            }
        }
    }
    
    setTool(tool) {
        this.currentTool = tool;
        this.isDrawingPolyline = false;
        this.polylinePoints = [];
        this.selectedSegment = null;
        
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === tool);
        });
        
        document.getElementById('tool-status').textContent = 
            tool.charAt(0).toUpperCase() + tool.slice(1);
        
        this.canvas.style.cursor = tool === 'select' ? 'default' : 'crosshair';
    }
    
    snapToGrid(x, y) {
        // Apply zoom and pan inverse
        const worldX = (x - this.panOffset.x) / this.zoom;
        const worldY = (y - this.panOffset.y) / this.zoom;
        
        return {
            x: Math.round(worldX / this.gridSize) * this.gridSize,
            y: Math.round(worldY / this.gridSize) * this.gridSize
        };
    }
    
    normalizeCoordinates(x, y) {
        return {
            x: Math.round((x - this.origin.x) / this.gridSize),
            y: Math.round((y - this.origin.y) / this.gridSize)
        };
    }
    
    denormalizeCoordinates(x, y) {
        return {
            x: x * this.gridSize + this.origin.x,
            y: y * this.gridSize + this.origin.y
        };
    }
    
    recalculateCoordinates(oldOrigin) {
        this.entities.forEach(entity => {
            switch (entity.type) {
                case 'line':
                    const oldStart = this.denormalizeWithOrigin(entity.start[0], entity.start[1], oldOrigin);
                    const oldEnd = this.denormalizeWithOrigin(entity.end[0], entity.end[1], oldOrigin);
                    const newStart = this.normalizeCoordinates(oldStart.x, oldStart.y);
                    const newEnd = this.normalizeCoordinates(oldEnd.x, oldEnd.y);
                    entity.start = [newStart.x, newStart.y];
                    entity.end = [newEnd.x, newEnd.y];
                    break;
                    
                case 'rectangle':
                    const oldTL = this.denormalizeWithOrigin(entity.topLeft[0], entity.topLeft[1], oldOrigin);
                    const oldBR = this.denormalizeWithOrigin(entity.bottomRight[0], entity.bottomRight[1], oldOrigin);
                    const newTL = this.normalizeCoordinates(oldTL.x, oldTL.y);
                    const newBR = this.normalizeCoordinates(oldBR.x, oldBR.y);
                    entity.topLeft = [newTL.x, newTL.y];
                    entity.bottomRight = [newBR.x, newBR.y];
                    break;
                    
                case 'circle':
                    const oldCenter = this.denormalizeWithOrigin(entity.center[0], entity.center[1], oldOrigin);
                    const newCenter = this.normalizeCoordinates(oldCenter.x, oldCenter.y);
                    entity.center = [newCenter.x, newCenter.y];
                    entity.radius = entity.radius * this.gridSize;
                    break;
                    
                case 'polyline':
                    entity.points = entity.points.map(p => {
                        const oldPoint = this.denormalizeWithOrigin(p[0], p[1], oldOrigin);
                        const newPoint = this.normalizeCoordinates(oldPoint.x, oldPoint.y);
                        return [newPoint.x, newPoint.y];
                    });
                    // Ensure correct segment count based on closed state
                    const expectedSegmentCount = entity.closed ? entity.points.length : entity.points.length - 1;
                    if (!entity.segments) {
                        entity.segments = [];
                    }
                    
                    // Adjust segment array if needed
                    if (entity.segments.length !== expectedSegmentCount) {
                        const oldSegments = [...entity.segments];
                        entity.segments = [];
                        for (let i = 0; i < expectedSegmentCount; i++) {
                            if (oldSegments[i]) {
                                entity.segments.push(oldSegments[i]);
                            } else {
                                entity.segments.push({
                                    id: `${entity.id}_seg_${i}`,
                                    metadata: {}
                                });
                            }
                        }
                    }
                    break;
            }
        });
        this.updateJSON();
    }
    
    denormalizeWithOrigin(x, y, origin) {
        return {
            x: x * this.gridSize + origin.x,
            y: y * this.gridSize + origin.y
        };
    }
    
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const gridPos = this.snapToGrid(x, y);
        
        // Check for space bar panning
        if (this.isPanning) {
            this.panStart = { x: e.clientX, y: e.clientY };
            this.panStartOffset = { ...this.panOffset };
            return;
        }
        
        if (this.settingOrigin) {
            const oldOrigin = { ...this.origin };
            this.origin = { ...gridPos };
            this.settingOrigin = false;
            this.saveState();
            this.recalculateCoordinates(oldOrigin);
            this.setTool('select');
            this.render();
            return;
        }
        
        if (this.currentTool === 'select') {
            const worldX = (x - this.panOffset.x) / this.zoom;
            const worldY = (y - this.panOffset.y) / this.zoom;
            const entity = this.getEntityAt(worldX, worldY);
            
            if (entity) {
                if (this.isMultiSelecting) {
                    // Multi-selection with Shift
                    if (entity.type === 'polyline') {
                        const segment = this.getSegmentAt(worldX, worldY, entity);
                        if (segment !== null) {
                            this.addToSelection(entity.id, segment);
                        } else {
                            this.addToSelection(entity.id, null);
                        }
                    } else {
                        this.addToSelection(entity.id, null);
                    }
                } else {
                    // Single selection
                    if (this.selectedEntity === entity.id && entity.type === 'polyline') {
                        const segment = this.getSegmentAt(worldX, worldY, entity);
                        if (segment !== null) {
                            this.selectedSegment = segment;
                            this.selectedItems = [{entityId: entity.id, segmentIndex: segment}];
                            this.updateSegmentMetadataEditor(entity, segment);
                        }
                    } else {
                        this.selectEntity(entity);
                        this.selectedSegment = null;
                        this.selectedItems = [{entityId: entity.id, segmentIndex: null}];
                    }
                    
                    this.isDragging = true;
                    this.dragStart = { ...gridPos };
                    this.dragEntity = entity;
                    this.canvas.style.cursor = 'move';
                }
            } else {
                if (!this.isMultiSelecting) {
                    this.selectEntity(null);
                    this.selectedSegment = null;
                    this.selectedItems = [];
                }
            }
        } else if (this.currentTool === 'polyline') {
            if (!this.isDrawingPolyline) {
                this.isDrawingPolyline = true;
                this.polylinePoints = [gridPos];
            } else {
                this.polylinePoints.push(gridPos);
            }
        } else {
            this.isDrawing = true;
            this.startPos = gridPos;
            this.tempShape = {
                type: this.currentTool,
                start: gridPos,
                end: gridPos
            };
        }
    }
    
    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Handle panning
        if (this.isPanning && this.panStart) {
            this.panOffset.x = this.panStartOffset.x + (e.clientX - this.panStart.x);
            this.panOffset.y = this.panStartOffset.y + (e.clientY - this.panStart.y);
            this.render();
            return;
        }
        
        this.mousePos = { x, y };
        this.gridPos = this.snapToGrid(x, y);
        
        const worldX = Math.round((this.gridPos.x - this.origin.x) / this.gridSize);
        const worldY = Math.round((this.gridPos.y - this.origin.y) / this.gridSize);
        document.getElementById('coords').textContent = `${worldX}, ${worldY}`;
        
        if (this.isDragging && this.dragEntity) {
            const dx = (this.gridPos.x - this.dragStart.x) / this.gridSize;
            const dy = (this.gridPos.y - this.dragStart.y) / this.gridSize;
            
            if (dx !== 0 || dy !== 0) {
                this.moveEntity(this.dragEntity, dx, dy);
                this.dragStart = { ...this.gridPos };
                this.updateJSON();
                this.render();
            }
        } else if (this.isDrawing && this.tempShape) {
            this.tempShape.end = this.gridPos;
        } else if (this.currentTool === 'select' && !this.isDragging) {
            const worldX = (x - this.panOffset.x) / this.zoom;
            const worldY = (y - this.panOffset.y) / this.zoom;
            const entity = this.getEntityAt(worldX, worldY);
            this.canvas.style.cursor = entity ? 'move' : 'default';
        }
        
        const worldMouseX = (x - this.panOffset.x) / this.zoom;
        const worldMouseY = (y - this.panOffset.y) / this.zoom;
        const dist = Math.sqrt(
            Math.pow(this.gridPos.x - worldMouseX, 2) + 
            Math.pow(this.gridPos.y - worldMouseY, 2)
        );
        this.snapIndicator = dist < this.snapThreshold ? this.gridPos : null;
        
        this.render();
    }
    
    handleMouseUp(e) {
        if (this.isPanning) {
            this.panStart = null;
            return;
        }
        
        if (this.isDragging) {
            this.isDragging = false;
            this.dragEntity = null;
            this.canvas.style.cursor = this.currentTool === 'select' ? 'default' : 'crosshair';
        } else if (this.isDrawing && this.tempShape) {
            this.isDrawing = false;
            
            if (this.currentTool !== 'polyline') {
                this.saveState();
                this.addEntity(this.tempShape);
            }
            
            this.tempShape = null;
        }
    }
    
    handleDoubleClick(e) {
        if (this.currentTool === 'polyline' && this.isDrawingPolyline) {
            if (this.polylinePoints.length > 1) {
                this.saveState();
                this.addEntity({
                    type: 'polyline',
                    points: [...this.polylinePoints],
                    closed: false
                });
            }
            this.isDrawingPolyline = false;
            this.polylinePoints = [];
        }
    }
    
    handleKeyDown(e) {
        // Track shift key for multi-selection
        this.isMultiSelecting = e.shiftKey;
        
        // Prevent default for our shortcuts
        if ((e.ctrlKey || e.metaKey) && ['z', 'y', 'c', 'v', 'd'].includes(e.key.toLowerCase())) {
            e.preventDefault();
        }
        
        if (e.key === ' ') {
            e.preventDefault();
            this.isPanning = true;
            this.canvas.style.cursor = 'grab';
        } else if (e.key === 'Escape') {
            this.isDrawingPolyline = false;
            this.polylinePoints = [];
            this.isDrawing = false;
            this.tempShape = null;
            this.render();
        } else if (e.key === 'Delete') {
            if (this.selectedItems.length > 0) {
                this.saveState();
                this.selectedItems.forEach(item => {
                    this.deleteEntity(item.entityId);
                });
                this.selectedItems = [];
            } else if (this.selectedEntity) {
                this.saveState();
                this.deleteEntity(this.selectedEntity);
            }
        } else if (e.key === 'c' && this.currentTool === 'polyline' && this.isDrawingPolyline) {
            if (this.polylinePoints.length > 2) {
                this.saveState();
                this.addEntity({
                    type: 'polyline',
                    points: [...this.polylinePoints],
                    closed: true
                });
                this.isDrawingPolyline = false;
                this.polylinePoints = [];
            }
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
            this.undo();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
            this.redo();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
            this.copyEntity();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
            this.pasteEntity();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
            this.duplicateEntity();
        } else if (e.key === 'g' || e.key === 'G') {
            this.showGrid = !this.showGrid;
            this.render();
        } else if (e.key === 'd' || e.key === 'D') {
            if (!e.ctrlKey && !e.metaKey) {
                this.showDimensions = !this.showDimensions;
                this.render();
            }
        } else if (e.key === 'h' || e.key === 'H') {
            this.showShortcutsDialog();
        }
    }
    
    handleKeyUp(e) {
        if (e.key === 'Shift') {
            this.isMultiSelecting = false;
        }
        if (e.key === ' ') {
            this.isPanning = false;
            this.panStart = null;
            this.canvas.style.cursor = this.currentTool === 'select' ? 'default' : 'crosshair';
        }
    }
    
    showShortcutsDialog() {
        const shortcuts = `
Keyboard Shortcuts:
━━━━━━━━━━━━━━━━━━
Ctrl+Z    Undo
Ctrl+Y    Redo  
Ctrl+C    Copy entity
Ctrl+V    Paste entity
Ctrl+D    Duplicate entity
Delete    Delete selected
G         Toggle grid
D         Toggle dimensions
Space     Pan view (hold)
Scroll    Zoom in/out
ESC       Cancel operation
C         Close polyline (while drawing)
H         Show this help
        `;
        alert(shortcuts);
    }
    
    getEntityAt(x, y) {
        for (let i = this.entities.length - 1; i >= 0; i--) {
            const entity = this.entities[i];
            if (this.isPointNearEntity(x, y, entity)) {
                return entity;
            }
        }
        return null;
    }
    
    getSegmentAt(x, y, entity) {
        if (entity.type !== 'polyline') return null;
        
        const threshold = 5 / this.zoom;
        for (let i = 0; i < entity.points.length - 1; i++) {
            const p1 = this.denormalizeCoordinates(entity.points[i][0], entity.points[i][1]);
            const p2 = this.denormalizeCoordinates(entity.points[i + 1][0], entity.points[i + 1][1]);
            if (this.distanceToLine(x, y, p1, p2) < threshold) {
                return i;
            }
        }
        
        if (entity.closed && entity.points.length > 2) {
            const first = this.denormalizeCoordinates(entity.points[0][0], entity.points[0][1]);
            const last = this.denormalizeCoordinates(
                entity.points[entity.points.length - 1][0],
                entity.points[entity.points.length - 1][1]
            );
            if (this.distanceToLine(x, y, last, first) < threshold) {
                return entity.points.length - 1;
            }
        }
        
        return null;
    }
    
    moveEntity(entity, dx, dy) {
        switch (entity.type) {
            case 'line':
                entity.start[0] += dx;
                entity.start[1] += dy;
                entity.end[0] += dx;
                entity.end[1] += dy;
                break;
                
            case 'rectangle':
                entity.topLeft[0] += dx;
                entity.topLeft[1] += dy;
                entity.bottomRight[0] += dx;
                entity.bottomRight[1] += dy;
                break;
                
            case 'circle':
            case 'arc':
                entity.center[0] += dx;
                entity.center[1] += dy;
                break;
                
            case 'polyline':
                entity.points.forEach(point => {
                    point[0] += dx;
                    point[1] += dy;
                });
                break;
        }
    }
    
    addEntity(shape) {
        const entity = {
            id: `entity_${this.idCounter++}`,
            type: shape.type,
            metadata: {
                color: this.defaultColors[this.colorIndex % this.defaultColors.length]
            }
        };
        this.colorIndex++;
        
        switch (shape.type) {
            case 'line':
                const startNorm = this.normalizeCoordinates(shape.start.x, shape.start.y);
                const endNorm = this.normalizeCoordinates(shape.end.x, shape.end.y);
                entity.start = [startNorm.x, startNorm.y];
                entity.end = [endNorm.x, endNorm.y];
                break;
                
            case 'rectangle':
                const topLeft = this.normalizeCoordinates(
                    Math.min(shape.start.x, shape.end.x),
                    Math.min(shape.start.y, shape.end.y)
                );
                const bottomRight = this.normalizeCoordinates(
                    Math.max(shape.start.x, shape.end.x),
                    Math.max(shape.start.y, shape.end.y)
                );
                entity.topLeft = [topLeft.x, topLeft.y];
                entity.bottomRight = [bottomRight.x, bottomRight.y];
                break;
                
            case 'circle':
                const center = this.normalizeCoordinates(shape.start.x, shape.start.y);
                const radius = Math.sqrt(
                    Math.pow(shape.end.x - shape.start.x, 2) + 
                    Math.pow(shape.end.y - shape.start.y, 2)
                );
                entity.center = [center.x, center.y];
                entity.radius = radius / this.gridSize;
                break;
                
            case 'arc':
                const arcCenter = this.normalizeCoordinates(shape.start.x, shape.start.y);
                const arcRadius = Math.sqrt(
                    Math.pow(shape.end.x - shape.start.x, 2) + 
                    Math.pow(shape.end.y - shape.start.y, 2)
                );
                const startAngle = 0;
                const endAngle = Math.PI / 2;
                entity.center = [arcCenter.x, arcCenter.y];
                entity.radius = arcRadius / this.gridSize;
                entity.startAngle = startAngle;
                entity.endAngle = endAngle;
                break;
                
            case 'polyline':
                entity.points = shape.points.map(p => {
                    const norm = this.normalizeCoordinates(p.x, p.y);
                    return [norm.x, norm.y];
                });
                entity.closed = shape.closed;
                
                // Generate segment IDs based on closed state
                const segmentCount = entity.closed ? entity.points.length : entity.points.length - 1;
                entity.segments = [];
                for (let i = 0; i < segmentCount; i++) {
                    entity.segments.push({
                        id: `${entity.id}_seg_${i}`,
                        metadata: {}
                    });
                }
                break;
        }
        
        this.entities.push(entity);
        this.updateJSON();
        this.render();
    }
    
    selectEntity(entity) {
        if (entity) {
            this.selectedEntity = entity.id;
            this.highlightEntityInJSON(entity.id);
            this.updateMetadataEditor(entity);
        } else {
            this.selectedEntity = null;
            this.clearJSONHighlight();
            this.clearMetadataEditor();
        }
        this.render();
    }
    
    addToSelection(entityId, segmentIndex) {
        // Check if already selected
        const existingIndex = this.selectedItems.findIndex(item => 
            item.entityId === entityId && item.segmentIndex === segmentIndex
        );
        
        if (existingIndex >= 0) {
            // Remove from selection
            this.selectedItems.splice(existingIndex, 1);
        } else {
            // Add to selection
            this.selectedItems.push({ entityId, segmentIndex });
        }
        
        // Update UI to show multi-selection
        this.updateMultiSelectionUI();
        this.render();
    }
    
    updateMultiSelectionUI() {
        const container = document.getElementById('entity-metadata');
        const addButton = document.getElementById('add-metadata-field');
        
        if (this.selectedItems.length === 0) {
            this.clearMetadataEditor();
        } else if (this.selectedItems.length === 1) {
            const item = this.selectedItems[0];
            const entity = this.entities.find(e => e.id === item.entityId);
            if (entity) {
                if (item.segmentIndex !== null && item.segmentIndex !== undefined) {
                    this.updateSegmentMetadataEditor(entity, item.segmentIndex);
                } else {
                    this.updateMetadataEditor(entity);
                }
            }
        } else {
            // Multiple items selected
            container.innerHTML = `
                <div class="metadata-field">
                    <label>Selection</label>
                    <input type="text" value="${this.selectedItems.length} items selected" readonly style="opacity: 0.7">
                </div>
                <div class="metadata-field">
                    <button id="create-constraint-btn" style="width: 100%; padding: 8px; background: #0066cc; border: none; color: white; border-radius: 4px; cursor: pointer;">
                        Create Constraint
                    </button>
                </div>
                <div class="metadata-field">
                    <label>Selected Items:</label>
                    <div style="max-height: 150px; overflow-y: auto; background: #2a2a2a; padding: 5px; border-radius: 3px; font-size: 11px;">
                        ${this.selectedItems.map(item => {
                            const entity = this.entities.find(e => e.id === item.entityId);
                            if (item.segmentIndex !== null && item.segmentIndex !== undefined) {
                                return `<div>${item.entityId} - Segment ${item.segmentIndex}</div>`;
                            } else {
                                return `<div>${item.entityId} (${entity?.type})</div>`;
                            }
                        }).join('')}
                    </div>
                </div>
            `;
            
            addButton.style.display = 'none';
            
            // Add constraint button listener
            document.getElementById('create-constraint-btn')?.addEventListener('click', () => {
                this.showAdvancedConstraintDialog();
            });
        }
    }
    
    highlightEntityInJSON(entityId) {
        try {
            const text = this.jsonEditor.value;
            const lines = text.split('\n');
            let entityStartLine = -1;
            let entityEndLine = -1;
            let braceCount = 0;
            let foundId = false;
            
            for (let i = 0; i < lines.length; i++) {
                if (!foundId && lines[i].includes(`"id": "${entityId}"`)) {
                    foundId = true;
                    let j = i;
                    while (j > 0 && !lines[j].trim().startsWith('{')) {
                        j--;
                    }
                    entityStartLine = j;
                    braceCount = 1;
                    i = j + 1;
                } else if (foundId) {
                    for (let char of lines[i]) {
                        if (char === '{') braceCount++;
                        if (char === '}') {
                            braceCount--;
                            if (braceCount === 0) {
                                entityEndLine = i;
                                break;
                            }
                        }
                    }
                    if (entityEndLine !== -1) break;
                }
            }
            
            if (entityStartLine !== -1 && entityEndLine !== -1) {
                let startPos = 0;
                for (let i = 0; i < entityStartLine; i++) {
                    startPos += lines[i].length + 1;
                }
                
                let endPos = 0;
                for (let i = 0; i <= entityEndLine; i++) {
                    endPos += lines[i].length + 1;
                }
                
                this.jsonEditor.focus();
                this.jsonEditor.setSelectionRange(startPos, endPos - 1);
                
                const lineHeight = this.jsonEditor.scrollHeight / lines.length;
                this.jsonEditor.scrollTop = entityStartLine * lineHeight - 50;
            }
        } catch (e) {
            console.error('Error highlighting JSON:', e);
        }
    }
    
    clearJSONHighlight() {
        const pos = this.jsonEditor.selectionStart;
        this.jsonEditor.setSelectionRange(pos, pos);
    }
    
    updateMetadataEditor(entity) {
        const container = document.getElementById('entity-metadata');
        const addButton = document.getElementById('add-metadata-field');
        
        container.innerHTML = `
            <div class="metadata-field">
                <label>Entity ID</label>
                <input type="text" value="${entity.id}" readonly style="opacity: 0.7">
            </div>
            <div class="metadata-field">
                <label>Type</label>
                <input type="text" value="${entity.type}" readonly style="opacity: 0.7">
            </div>
            <div class="metadata-field">
                <label>Color</label>
                <div class="color-input-wrapper">
                    <input type="color" id="color-picker" value="${entity.metadata?.color || '#00ff88'}">
                    <input type="text" id="color-text" value="${entity.metadata?.color || '#00ff88'}" 
                           placeholder="#hex or color name">
                </div>
            </div>
        `;
        
        // Add closed checkbox for polylines
        if (entity.type === 'polyline') {
            const closedField = document.createElement('div');
            closedField.className = 'metadata-field';
            closedField.innerHTML = `
                <label>Closed</label>
                <input type="checkbox" id="closed-checkbox" ${entity.closed ? 'checked' : ''} style="width: auto; margin: 0;">
            `;
            container.appendChild(closedField);
        }
        
        // Add dimension info
        if (this.showDimensions) {
            const dimInfo = this.getEntityDimensions(entity);
            if (dimInfo) {
                const dimField = document.createElement('div');
                dimField.className = 'metadata-field';
                dimField.innerHTML = `
                    <label>Dimensions</label>
                    <input type="text" value="${dimInfo}" readonly style="opacity: 0.7; font-size: 11px">
                `;
                container.appendChild(dimField);
            }
        }
        
        Object.keys(entity.metadata || {}).forEach(key => {
            if (key !== 'color') {
                const field = document.createElement('div');
                field.className = 'metadata-field';
                field.innerHTML = `
                    <label>${key}</label>
                    <input type="text" data-field="${key}" value="${entity.metadata[key]}">
                `;
                container.appendChild(field);
            }
        });
        
        addButton.style.display = 'block';
        
        document.getElementById('color-picker').addEventListener('input', (e) => {
            this.updateEntityColor(entity.id, e.target.value);
            document.getElementById('color-text').value = e.target.value;
        });
        
        document.getElementById('color-text').addEventListener('change', (e) => {
            this.updateEntityColor(entity.id, e.target.value);
            if (e.target.value.startsWith('#')) {
                document.getElementById('color-picker').value = e.target.value;
            }
        });
        
        // Add closed checkbox listener for polylines
        if (entity.type === 'polyline') {
            document.getElementById('closed-checkbox').addEventListener('change', (e) => {
                this.updateEntityClosed(entity.id, e.target.checked);
            });
        }
        
        container.querySelectorAll('input[data-field]').forEach(input => {
            input.addEventListener('change', (e) => {
                const fieldName = e.target.dataset.field;
                this.updateEntityMetadata(entity.id, fieldName, e.target.value);
            });
        });
    }
    
    getEntityDimensions(entity) {
        switch (entity.type) {
            case 'line':
                const length = Math.sqrt(
                    Math.pow(entity.end[0] - entity.start[0], 2) +
                    Math.pow(entity.end[1] - entity.start[1], 2)
                );
                return `Length: ${length.toFixed(1)} units`;
                
            case 'rectangle':
                const width = Math.abs(entity.bottomRight[0] - entity.topLeft[0]);
                const height = Math.abs(entity.bottomRight[1] - entity.topLeft[1]);
                return `${width} × ${height} units`;
                
            case 'circle':
                return `Radius: ${entity.radius.toFixed(1)} units`;
                
            case 'polyline':
                let totalLength = 0;
                for (let i = 0; i < entity.points.length - 1; i++) {
                    const segLength = Math.sqrt(
                        Math.pow(entity.points[i + 1][0] - entity.points[i][0], 2) +
                        Math.pow(entity.points[i + 1][1] - entity.points[i][1], 2)
                    );
                    totalLength += segLength;
                }
                if (entity.closed && entity.points.length > 2) {
                    const lastSegLength = Math.sqrt(
                        Math.pow(entity.points[0][0] - entity.points[entity.points.length - 1][0], 2) +
                        Math.pow(entity.points[0][1] - entity.points[entity.points.length - 1][1], 2)
                    );
                    totalLength += lastSegLength;
                }
                const closedStatus = entity.closed ? 'closed' : 'open';
                return `Total: ${totalLength.toFixed(1)} units, ${entity.points.length} points (${closedStatus})`;
                
            default:
                return null;
        }
    }
    
    updateSegmentMetadataEditor(entity, segmentIndex) {
        const container = document.getElementById('entity-metadata');
        
        if (!entity.segments) {
            entity.segments = [];
        }
        if (!entity.segments[segmentIndex]) {
            entity.segments[segmentIndex] = { 
                id: `${entity.id}_seg_${segmentIndex}`,
                metadata: {} 
            };
        }
        
        const segment = entity.segments[segmentIndex];
        
        const p1 = entity.points[segmentIndex];
        const p2 = entity.points[(segmentIndex + 1) % entity.points.length];
        const segmentLength = Math.sqrt(
            Math.pow(p2[0] - p1[0], 2) + Math.pow(p2[1] - p1[1], 2)
        );
        
        container.innerHTML = `
            <div class="metadata-field">
                <label>Entity ID</label>
                <input type="text" value="${entity.id}" readonly style="opacity: 0.7">
            </div>
            <div class="metadata-field">
                <label>Segment ID</label>
                <input type="text" value="${segment.id}" readonly style="opacity: 0.7">
            </div>
            <div class="metadata-field">
                <label>Segment Index</label>
                <input type="text" value="${segmentIndex}" readonly style="opacity: 0.7">
            </div>
            <div class="metadata-field">
                <label>Points</label>
                <input type="text" value="[${p1}] → [${p2}]" readonly style="opacity: 0.7; font-size: 11px">
            </div>
            <div class="metadata-field">
                <label>Length</label>
                <input type="text" value="${segmentLength.toFixed(2)} units" readonly style="opacity: 0.7">
            </div>
            <div class="metadata-field">
                <label>Segment Color</label>
                <div class="color-input-wrapper">
                    <input type="color" id="segment-color-picker" value="${segment.metadata?.color || entity.metadata?.color || '#00ff88'}">
                    <input type="text" id="segment-color-text" value="${segment.metadata?.color || entity.metadata?.color || '#00ff88'}">
                </div>
            </div>
        `;
        
        Object.keys(segment.metadata || {}).forEach(key => {
            if (key !== 'color') {
                const field = document.createElement('div');
                field.className = 'metadata-field';
                field.innerHTML = `
                    <label>${key}</label>
                    <input type="text" data-segment-field="${key}" value="${segment.metadata[key]}">
                `;
                container.appendChild(field);
            }
        });
        
        document.getElementById('segment-color-picker').addEventListener('input', (e) => {
            this.updateSegmentColor(entity.id, segmentIndex, e.target.value);
            document.getElementById('segment-color-text').value = e.target.value;
        });
        
        document.getElementById('segment-color-text').addEventListener('change', (e) => {
            this.updateSegmentColor(entity.id, segmentIndex, e.target.value);
            if (e.target.value.startsWith('#')) {
                document.getElementById('segment-color-picker').value = e.target.value;
            }
        });
        
        container.querySelectorAll('input[data-segment-field]').forEach(input => {
            input.addEventListener('change', (e) => {
                const fieldName = e.target.dataset.segmentField;
                this.updateSegmentMetadata(entity.id, segmentIndex, fieldName, e.target.value);
            });
        });
    }
    
    updateSegmentColor(entityId, segmentIndex, color) {
        const entity = this.entities.find(e => e.id === entityId);
        if (entity) {
            if (!entity.segments) entity.segments = [];
            if (!entity.segments[segmentIndex]) {
                entity.segments[segmentIndex] = { 
                    id: `${entity.id}_seg_${segmentIndex}`,
                    metadata: {} 
                };
            }
            entity.segments[segmentIndex].metadata.color = color;
            this.updateJSON();
            this.render();
        }
    }
    
    updateSegmentMetadata(entityId, segmentIndex, field, value) {
        const entity = this.entities.find(e => e.id === entityId);
        if (entity) {
            if (!entity.segments) entity.segments = [];
            if (!entity.segments[segmentIndex]) {
                entity.segments[segmentIndex] = { 
                    id: `${entity.id}_seg_${segmentIndex}`,
                    metadata: {} 
                };
            }
            entity.segments[segmentIndex].metadata[field] = value;
            this.updateJSON();
        }
    }
    
    clearMetadataEditor() {
        const container = document.getElementById('entity-metadata');
        const addButton = document.getElementById('add-metadata-field');
        
        container.innerHTML = '<div class="no-selection">Select an entity to edit metadata</div>';
        addButton.style.display = 'none';
    }
    
    updateEntityColor(entityId, color) {
        const entity = this.entities.find(e => e.id === entityId);
        if (entity) {
            if (!entity.metadata) entity.metadata = {};
            entity.metadata.color = color;
            this.updateJSON();
            this.render();
        }
    }
    
    updateEntityMetadata(entityId, field, value) {
        const entity = this.entities.find(e => e.id === entityId);
        if (entity) {
            if (!entity.metadata) entity.metadata = {};
            entity.metadata[field] = value;
            this.updateJSON();
        }
    }
    
    updateEntityClosed(entityId, closed) {
        const entity = this.entities.find(e => e.id === entityId);
        if (entity && entity.type === 'polyline') {
            const wasClosed = entity.closed;
            entity.closed = closed;
            
            // Update segments array for closed/open state
            if (closed && !wasClosed) {
                // Adding closing segment
                if (!entity.segments) entity.segments = [];
                const newSegmentIndex = entity.points.length - 1;
                if (!entity.segments[newSegmentIndex]) {
                    entity.segments[newSegmentIndex] = {
                        id: `${entity.id}_seg_${newSegmentIndex}`,
                        metadata: {}
                    };
                }
            } else if (!closed && wasClosed) {
                // Removing closing segment
                if (entity.segments && entity.segments.length === entity.points.length) {
                    entity.segments.pop();
                }
            }
            
            this.updateJSON();
            this.render();
        }
    }
    
    addMetadataField() {
        if (!this.selectedEntity) return;
        
        const fieldName = prompt('Enter field name:');
        if (fieldName && fieldName.trim()) {
            if (this.selectedSegment !== null) {
                const entity = this.entities.find(e => e.id === this.selectedEntity);
                if (entity && entity.type === 'polyline') {
                    if (!entity.segments) entity.segments = [];
                    if (!entity.segments[this.selectedSegment]) {
                        entity.segments[this.selectedSegment] = { 
                            id: `${entity.id}_seg_${this.selectedSegment}`,
                            metadata: {} 
                        };
                    }
                    entity.segments[this.selectedSegment].metadata[fieldName] = '';
                    this.updateJSON();
                    this.updateSegmentMetadataEditor(entity, this.selectedSegment);
                }
            } else {
                const entity = this.entities.find(e => e.id === this.selectedEntity);
                if (entity) {
                    if (!entity.metadata) entity.metadata = {};
                    entity.metadata[fieldName] = '';
                    this.updateJSON();
                    this.updateMetadataEditor(entity);
                }
            }
        }
    }
    
    isPointNearEntity(x, y, entity) {
        const threshold = 5 / this.zoom;
        
        switch (entity.type) {
            case 'line':
                const start = this.denormalizeCoordinates(entity.start[0], entity.start[1]);
                const end = this.denormalizeCoordinates(entity.end[0], entity.end[1]);
                return this.distanceToLine(x, y, start, end) < threshold;
                
            case 'rectangle':
                const tl = this.denormalizeCoordinates(entity.topLeft[0], entity.topLeft[1]);
                const br = this.denormalizeCoordinates(entity.bottomRight[0], entity.bottomRight[1]);
                return x >= tl.x - threshold && x <= br.x + threshold &&
                       y >= tl.y - threshold && y <= br.y + threshold;
                
            case 'circle':
                const center = this.denormalizeCoordinates(entity.center[0], entity.center[1]);
                const radius = entity.radius * this.gridSize;
                const dist = Math.sqrt(Math.pow(x - center.x, 2) + Math.pow(y - center.y, 2));
                return Math.abs(dist - radius) < threshold;
                
            case 'polyline':
                for (let i = 0; i < entity.points.length - 1; i++) {
                    const p1 = this.denormalizeCoordinates(entity.points[i][0], entity.points[i][1]);
                    const p2 = this.denormalizeCoordinates(entity.points[i + 1][0], entity.points[i + 1][1]);
                    if (this.distanceToLine(x, y, p1, p2) < threshold) {
                        return true;
                    }
                }
                if (entity.closed && entity.points.length > 2) {
                    const first = this.denormalizeCoordinates(entity.points[0][0], entity.points[0][1]);
                    const last = this.denormalizeCoordinates(
                        entity.points[entity.points.length - 1][0],
                        entity.points[entity.points.length - 1][1]
                    );
                    return this.distanceToLine(x, y, last, first) < threshold;
                }
                return false;
                
            default:
                return false;
        }
    }
    
    distanceToLine(px, py, p1, p2) {
        const A = px - p1.x;
        const B = py - p1.y;
        const C = p2.x - p1.x;
        const D = p2.y - p1.y;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        
        if (lenSq !== 0) {
            param = dot / lenSq;
        }
        
        let xx, yy;
        
        if (param < 0) {
            xx = p1.x;
            yy = p1.y;
        } else if (param > 1) {
            xx = p2.x;
            yy = p2.y;
        } else {
            xx = p1.x + param * C;
            yy = p1.y + param * D;
        }
        
        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    deleteEntity(entityId) {
        this.entities = this.entities.filter(e => e.id !== entityId);
        this.constraints = this.constraints.filter(c => 
            !c.entities.includes(entityId)
        );
        this.selectedEntity = null;
        this.selectedSegment = null;
        this.updateJSON();
        this.render();
    }
    
    clearDrawing() {
        this.entities = [];
        this.constraints = [];
        this.selectedEntity = null;
        this.selectedSegment = null;
        this.selectedItems = [];
        this.idCounter = 1;
        this.updateJSON();
        this.render();
    }
    
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.save();
        this.ctx.translate(this.panOffset.x, this.panOffset.y);
        this.ctx.scale(this.zoom, this.zoom);
        
        if (this.showGrid) {
            this.drawGrid();
        }
        this.drawOrigin();
        this.drawEntities();
        
        if (this.tempShape) {
            this.drawTempShape();
        }
        
        if (this.isDrawingPolyline && this.polylinePoints.length > 0) {
            this.drawTempPolyline();
        }
        
        if (this.snapIndicator) {
            this.drawSnapIndicator();
        }
        
        if (this.settingOrigin) {
            this.drawOriginCursor();
        }
        
        if (this.showDimensions) {
            this.drawDimensions();
        }
        
        this.ctx.restore();
        
        // Draw zoom indicator
        this.drawZoomIndicator();
    }
    
    drawZoomIndicator() {
        if (this.zoom !== 1) {
            this.ctx.fillStyle = '#aaa';
            this.ctx.font = '12px sans-serif';
            this.ctx.fillText(`Zoom: ${(this.zoom * 100).toFixed(0)}%`, 10, this.canvas.height - 10);
        }
    }
    
    drawDimensions() {
        this.ctx.font = '10px sans-serif';
        this.ctx.fillStyle = '#888';
        
        this.entities.forEach(entity => {
            const isSelected = entity.id === this.selectedEntity;
            if (!isSelected) return;
            
            switch (entity.type) {
                case 'line':
                    const start = this.denormalizeCoordinates(entity.start[0], entity.start[1]);
                    const end = this.denormalizeCoordinates(entity.end[0], entity.end[1]);
                    const midX = (start.x + end.x) / 2;
                    const midY = (start.y + end.y) / 2;
                    const length = Math.sqrt(
                        Math.pow(entity.end[0] - entity.start[0], 2) +
                        Math.pow(entity.end[1] - entity.start[1], 2)
                    );
                    this.ctx.fillText(length.toFixed(1), midX + 5, midY - 5);
                    break;
                    
                case 'rectangle':
                    const tl = this.denormalizeCoordinates(entity.topLeft[0], entity.topLeft[1]);
                    const br = this.denormalizeCoordinates(entity.bottomRight[0], entity.bottomRight[1]);
                    const width = Math.abs(entity.bottomRight[0] - entity.topLeft[0]);
                    const height = Math.abs(entity.bottomRight[1] - entity.topLeft[1]);
                    this.ctx.fillText(`${width} × ${height}`, tl.x + 5, tl.y - 5);
                    break;
                    
                case 'circle':
                    const center = this.denormalizeCoordinates(entity.center[0], entity.center[1]);
                    this.ctx.fillText(`r=${entity.radius.toFixed(1)}`, center.x + 5, center.y - entity.radius * this.gridSize - 5);
                    break;
            }
        });
    }
    
    drawOrigin() {
        this.ctx.strokeStyle = '#ff0000';
        this.ctx.lineWidth = 2 / this.zoom;
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.origin.x - 10, this.origin.y);
        this.ctx.lineTo(this.origin.x + 10, this.origin.y);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.origin.x, this.origin.y - 10);
        this.ctx.lineTo(this.origin.x, this.origin.y + 10);
        this.ctx.stroke();
    }
    
    drawSnapIndicator() {
        this.ctx.fillStyle = '#ffff00';
        this.ctx.strokeStyle = '#ffff00';
        this.ctx.lineWidth = 2 / this.zoom;
        
        this.ctx.beginPath();
        this.ctx.arc(this.snapIndicator.x, this.snapIndicator.y, 5 / this.zoom, 0, Math.PI * 2);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.arc(this.snapIndicator.x, this.snapIndicator.y, 2 / this.zoom, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    drawOriginCursor() {
        this.ctx.strokeStyle = '#ff00ff';
        this.ctx.lineWidth = 2 / this.zoom;
        this.ctx.setLineDash([5, 5]);
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.gridPos.x - 15, this.gridPos.y);
        this.ctx.lineTo(this.gridPos.x + 15, this.gridPos.y);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.gridPos.x, this.gridPos.y - 15);
        this.ctx.lineTo(this.gridPos.x, this.gridPos.y + 15);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
        
        this.ctx.fillStyle = '#ff00ff';
        this.ctx.font = `${12 / this.zoom}px sans-serif`;
        this.ctx.fillText('Click to set origin', this.gridPos.x + 20, this.gridPos.y - 5);
    }
    
    drawGrid() {
        const startX = Math.floor(-this.panOffset.x / this.zoom / this.gridSize) * this.gridSize - this.gridSize;
        const endX = Math.ceil((this.canvas.width - this.panOffset.x) / this.zoom / this.gridSize) * this.gridSize + this.gridSize;
        const startY = Math.floor(-this.panOffset.y / this.zoom / this.gridSize) * this.gridSize - this.gridSize;
        const endY = Math.ceil((this.canvas.height - this.panOffset.y) / this.zoom / this.gridSize) * this.gridSize + this.gridSize;
        
        this.ctx.strokeStyle = '#3a3a3a';
        this.ctx.lineWidth = 0.5 / this.zoom;
        
        for (let x = startX; x <= endX; x += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, startY);
            this.ctx.lineTo(x, endY);
            this.ctx.stroke();
        }
        
        for (let y = startY; y <= endY; y += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(endX, y);
            this.ctx.stroke();
        }
        
        this.ctx.strokeStyle = '#4a4a4a';
        this.ctx.lineWidth = 1 / this.zoom;
        
        for (let x = startX; x <= endX; x += this.gridSize * 5) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, startY);
            this.ctx.lineTo(x, endY);
            this.ctx.stroke();
        }
        
        for (let y = startY; y <= endY; y += this.gridSize * 5) {
            this.ctx.beginPath();
            this.ctx.moveTo(startX, y);
            this.ctx.lineTo(endX, y);
            this.ctx.stroke();
        }
    }
    
    drawEntities() {
        this.entities.forEach(entity => {
            const isSelected = entity.id === this.selectedEntity;
            const isHovered = entity.id === this.hoveredEntity;
            const isInMultiSelection = this.selectedItems.some(item => item.entityId === entity.id);
            
            if (entity.type === 'polyline' && entity.segments && (isSelected || isInMultiSelection || this.hoveredSegmentId?.startsWith(entity.id))) {
                this.drawPolylineWithSegments(entity, isHovered);
            } else {
                const color = entity.metadata?.color || '#00ff88';
                this.ctx.strokeStyle = isInMultiSelection ? '#ff00ff' : (isSelected ? '#0088ff' : (isHovered ? '#ffaa00' : color));
                this.ctx.lineWidth = (isSelected || isHovered || isInMultiSelection) ? 2 / this.zoom : 1 / this.zoom;
                this.drawEntity(entity);
            }
        });
    }
    
    drawPolylineWithSegments(entity, isHovered) {
        for (let i = 0; i < entity.points.length - 1; i++) {
            const p1 = this.denormalizeCoordinates(entity.points[i][0], entity.points[i][1]);
            const p2 = this.denormalizeCoordinates(entity.points[i + 1][0], entity.points[i + 1][1]);
            
            let segmentColor = entity.metadata?.color || '#00ff88';
            if (entity.segments && entity.segments[i] && entity.segments[i].metadata?.color) {
                segmentColor = entity.segments[i].metadata.color;
            }
            
            const isSegmentSelected = this.selectedSegment === i && this.selectedEntity === entity.id;
            const isSegmentHovered = this.hoveredSegmentId === `${entity.id}_seg_${i}`;
            const isInMultiSelection = this.selectedItems.some(item => 
                item.entityId === entity.id && item.segmentIndex === i
            );
            
            this.ctx.strokeStyle = isInMultiSelection ? '#ff00ff' :
                                  (isSegmentSelected ? '#0088ff' : 
                                  (isSegmentHovered ? '#ff8800' :
                                  (isHovered ? '#ffaa00' : segmentColor)));
            this.ctx.lineWidth = (isSegmentSelected || isSegmentHovered || isInMultiSelection) ? 3 / this.zoom : 2 / this.zoom;
            
            this.ctx.beginPath();
            this.ctx.moveTo(p1.x, p1.y);
            this.ctx.lineTo(p2.x, p2.y);
            this.ctx.stroke();
        }
        
        if (entity.closed && entity.points.length > 2) {
            const first = this.denormalizeCoordinates(entity.points[0][0], entity.points[0][1]);
            const last = this.denormalizeCoordinates(
                entity.points[entity.points.length - 1][0],
                entity.points[entity.points.length - 1][1]
            );
            
            let segmentColor = entity.metadata?.color || '#00ff88';
            const lastIndex = entity.points.length - 1;
            if (entity.segments && entity.segments[lastIndex] && entity.segments[lastIndex].metadata?.color) {
                segmentColor = entity.segments[lastIndex].metadata.color;
            }
            
            const isSegmentSelected = this.selectedSegment === lastIndex;
            const isSegmentHovered = this.hoveredSegmentId === `${entity.id}_seg_${lastIndex}`;
            
            this.ctx.strokeStyle = isSegmentSelected ? '#ff00ff' : 
                                  (isSegmentHovered ? '#ff8800' :
                                  (isHovered ? '#ffaa00' : segmentColor));
            this.ctx.lineWidth = (isSegmentSelected || isSegmentHovered) ? 3 / this.zoom : 2 / this.zoom;
            
            this.ctx.beginPath();
            this.ctx.moveTo(last.x, last.y);
            this.ctx.lineTo(first.x, first.y);
            this.ctx.stroke();
        }
    }
    
    drawEntity(entity) {
        switch (entity.type) {
            case 'line':
                const start = this.denormalizeCoordinates(entity.start[0], entity.start[1]);
                const end = this.denormalizeCoordinates(entity.end[0], entity.end[1]);
                this.ctx.beginPath();
                this.ctx.moveTo(start.x, start.y);
                this.ctx.lineTo(end.x, end.y);
                this.ctx.stroke();
                break;
                
            case 'rectangle':
                const tl = this.denormalizeCoordinates(entity.topLeft[0], entity.topLeft[1]);
                const br = this.denormalizeCoordinates(entity.bottomRight[0], entity.bottomRight[1]);
                this.ctx.beginPath();
                this.ctx.rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
                this.ctx.stroke();
                break;
                
            case 'circle':
                const center = this.denormalizeCoordinates(entity.center[0], entity.center[1]);
                const radius = entity.radius * this.gridSize;
                this.ctx.beginPath();
                this.ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
                this.ctx.stroke();
                break;
                
            case 'arc':
                const arcCenter = this.denormalizeCoordinates(entity.center[0], entity.center[1]);
                const arcRadius = entity.radius * this.gridSize;
                this.ctx.beginPath();
                this.ctx.arc(arcCenter.x, arcCenter.y, arcRadius, 
                    entity.startAngle, entity.endAngle);
                this.ctx.stroke();
                break;
                
            case 'polyline':
                if (entity.points.length > 0) {
                    this.ctx.beginPath();
                    const firstPoint = this.denormalizeCoordinates(
                        entity.points[0][0], entity.points[0][1]
                    );
                    this.ctx.moveTo(firstPoint.x, firstPoint.y);
                    
                    for (let i = 1; i < entity.points.length; i++) {
                        const point = this.denormalizeCoordinates(
                            entity.points[i][0], entity.points[i][1]
                        );
                        this.ctx.lineTo(point.x, point.y);
                    }
                    
                    if (entity.closed) {
                        this.ctx.closePath();
                    }
                    this.ctx.stroke();
                }
                break;
        }
    }
    
    drawTempShape() {
        this.ctx.strokeStyle = '#ffaa00';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.setLineDash([5 / this.zoom, 5 / this.zoom]);
        
        switch (this.tempShape.type) {
            case 'line':
                this.ctx.beginPath();
                this.ctx.moveTo(this.tempShape.start.x, this.tempShape.start.y);
                this.ctx.lineTo(this.tempShape.end.x, this.tempShape.end.y);
                this.ctx.stroke();
                break;
                
            case 'rectangle':
                const x = Math.min(this.tempShape.start.x, this.tempShape.end.x);
                const y = Math.min(this.tempShape.start.y, this.tempShape.end.y);
                const w = Math.abs(this.tempShape.end.x - this.tempShape.start.x);
                const h = Math.abs(this.tempShape.end.y - this.tempShape.start.y);
                this.ctx.beginPath();
                this.ctx.rect(x, y, w, h);
                this.ctx.stroke();
                break;
                
            case 'circle':
                const radius = Math.sqrt(
                    Math.pow(this.tempShape.end.x - this.tempShape.start.x, 2) + 
                    Math.pow(this.tempShape.end.y - this.tempShape.start.y, 2)
                );
                this.ctx.beginPath();
                this.ctx.arc(this.tempShape.start.x, this.tempShape.start.y, radius, 0, Math.PI * 2);
                this.ctx.stroke();
                break;
                
            case 'arc':
                const arcRadius = Math.sqrt(
                    Math.pow(this.tempShape.end.x - this.tempShape.start.x, 2) + 
                    Math.pow(this.tempShape.end.y - this.tempShape.start.y, 2)
                );
                this.ctx.beginPath();
                this.ctx.arc(this.tempShape.start.x, this.tempShape.start.y, 
                    arcRadius, 0, Math.PI / 2);
                this.ctx.stroke();
                break;
        }
        
        this.ctx.setLineDash([]);
    }
    
    drawTempPolyline() {
        this.ctx.strokeStyle = '#ffaa00';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.setLineDash([5 / this.zoom, 5 / this.zoom]);
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.polylinePoints[0].x, this.polylinePoints[0].y);
        
        for (let i = 1; i < this.polylinePoints.length; i++) {
            this.ctx.lineTo(this.polylinePoints[i].x, this.polylinePoints[i].y);
        }
        
        this.ctx.lineTo(this.gridPos.x, this.gridPos.y);
        this.ctx.stroke();
        
        this.ctx.setLineDash([]);
    }
    
    updateJSON() {
        const data = {
            version: "1.0",
            units: "grid",
            gridSize: this.gridSize,
            origin: [Math.round(this.origin.x / this.gridSize), Math.round(this.origin.y / this.gridSize)],
            entities: this.entities,
            constraints: this.constraints
        };
        
        this.jsonEditor.value = JSON.stringify(data, null, 2);
        this.updateConstraintsList();
    }
    
    formatJSON() {
        try {
            const data = JSON.parse(this.jsonEditor.value);
            this.jsonEditor.value = JSON.stringify(data, null, 2);
        } catch (e) {
            alert('Invalid JSON format');
        }
    }
    
    validateJSON() {
        try {
            const data = JSON.parse(this.jsonEditor.value);
            
            if (!data.entities || !Array.isArray(data.entities)) {
                throw new Error('Missing or invalid entities array');
            }
            
            if (!data.constraints || !Array.isArray(data.constraints)) {
                throw new Error('Missing or invalid constraints array');
            }
            
            alert('JSON is valid!');
        } catch (e) {
            alert(`JSON validation error: ${e.message}`);
        }
    }
    
    handleJSONEdit() {
        try {
            const data = JSON.parse(this.jsonEditor.value);
            
            if (data.entities && Array.isArray(data.entities)) {
                this.entities = data.entities;
                
                let maxId = 0;
                this.entities.forEach(entity => {
                    const match = entity.id.match(/entity_(\d+)/);
                    if (match) {
                        maxId = Math.max(maxId, parseInt(match[1]));
                    }
                    
                    // Ensure polylines have segment IDs and correct count
                    if (entity.type === 'polyline') {
                        const expectedSegmentCount = entity.closed ? entity.points.length : entity.points.length - 1;
                        
                        if (!entity.segments) {
                            entity.segments = [];
                        }
                        
                        // Adjust segment array to match expected count
                        if (entity.segments.length !== expectedSegmentCount) {
                            // Preserve existing segments where possible
                            const oldSegments = [...entity.segments];
                            entity.segments = [];
                            
                            for (let i = 0; i < expectedSegmentCount; i++) {
                                if (oldSegments[i]) {
                                    entity.segments.push(oldSegments[i]);
                                    if (!oldSegments[i].id) {
                                        oldSegments[i].id = `${entity.id}_seg_${i}`;
                                    }
                                } else {
                                    entity.segments.push({
                                        id: `${entity.id}_seg_${i}`,
                                        metadata: {}
                                    });
                                }
                            }
                        } else {
                            // Ensure all segments have IDs
                            entity.segments.forEach((seg, i) => {
                                if (!seg.id) {
                                    seg.id = `${entity.id}_seg_${i}`;
                                }
                            });
                        }
                    }
                });
                this.idCounter = maxId + 1;
            }
            
            if (data.constraints && Array.isArray(data.constraints)) {
                this.constraints = data.constraints;
            }
            
            if (data.origin && Array.isArray(data.origin)) {
                this.origin = {
                    x: data.origin[0] * this.gridSize,
                    y: data.origin[1] * this.gridSize
                };
            }
            
            this.render();
            this.updateConstraintsList();
        } catch (e) {
            // Invalid JSON, ignore for now
        }
    }
    
    showConstraintDialog() {
        // Legacy constraint dialog - kept for compatibility
        this.showAdvancedConstraintDialog();
    }
    
    showAdvancedConstraintDialog() {
        if (this.selectedItems.length === 0) {
            alert('Please select one or more entities/segments first.\nUse Shift+Click for multi-selection.');
            return;
        }
        
        // Create modal dialog
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: #2a2a2a;
            border: 2px solid #444;
            border-radius: 8px;
            padding: 20px;
            min-width: 400px;
            max-width: 600px;
            color: #e0e0e0;
        `;
        
        // Build selected items summary
        const itemsSummary = this.selectedItems.map(item => {
            const entity = this.entities.find(e => e.id === item.entityId);
            if (item.segmentIndex !== null && item.segmentIndex !== undefined) {
                return `${item.entityId} (Segment ${item.segmentIndex})`;
            }
            return `${item.entityId} (${entity?.type})`;
        }).join(', ');
        
        dialog.innerHTML = `
            <h3 style="margin: 0 0 15px 0; color: #0088ff;">Create Constraint</h3>
            <div style="margin-bottom: 15px; padding: 10px; background: #1a1a1a; border-radius: 4px;">
                <strong>Selected:</strong> ${itemsSummary}
            </div>
            
            <div style="margin-bottom: 15px;">
                <label style="display: block; margin-bottom: 5px; font-size: 12px;">Constraint Type:</label>
                <select id="constraint-type" style="width: 100%; padding: 8px; background: #333; border: 1px solid #555; color: #e0e0e0; border-radius: 4px;">
                    <option value="">Select a constraint type...</option>
                    <option value="coincident">Coincident - Points/lines occupy same position</option>
                    <option value="parallel">Parallel - Lines maintain same angle</option>
                    <option value="perpendicular">Perpendicular - Lines at 90°</option>
                    <option value="distance">Distance - Fixed distance between</option>
                    <option value="angle">Angle - Fixed angle between</option>
                    <option value="ratio">Ratio - Proportional relationship</option>
                    <option value="horizontal">Horizontal - Force horizontal</option>
                    <option value="vertical">Vertical - Force vertical</option>
                    <option value="equal">Equal - Same length/radius</option>
                </select>
            </div>
            
            <div id="constraint-value-div" style="margin-bottom: 15px; display: none;">
                <label style="display: block; margin-bottom: 5px; font-size: 12px;">Value:</label>
                <input id="constraint-value" type="number" step="any" style="width: 100%; padding: 8px; background: #333; border: 1px solid #555; color: #e0e0e0; border-radius: 4px;">
            </div>
            
            <div id="constraint-description" style="margin-bottom: 15px; padding: 10px; background: #1a1a1a; border-radius: 4px; font-size: 12px; color: #888; display: none;">
            </div>
            
            <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="cancel-constraint" style="padding: 8px 20px; background: #444; border: 1px solid #555; color: #e0e0e0; border-radius: 4px; cursor: pointer;">Cancel</button>
                <button id="create-constraint" style="padding: 8px 20px; background: #0066cc; border: none; color: white; border-radius: 4px; cursor: pointer;">Create</button>
            </div>
        `;
        
        modal.appendChild(dialog);
        document.body.appendChild(modal);
        
        // Event handlers
        const typeSelect = document.getElementById('constraint-type');
        const valueDiv = document.getElementById('constraint-value-div');
        const descDiv = document.getElementById('constraint-description');
        
        typeSelect.addEventListener('change', () => {
            const type = typeSelect.value;
            if (['distance', 'angle', 'ratio'].includes(type)) {
                valueDiv.style.display = 'block';
                document.getElementById('constraint-value').placeholder = 
                    type === 'distance' ? 'Distance in grid units' :
                    type === 'angle' ? 'Angle in degrees' :
                    'Ratio (e.g., 2.5)';
            } else {
                valueDiv.style.display = 'none';
            }
            
            // Show description
            const descriptions = {
                coincident: 'Forces selected points or lines to share the same position.',
                parallel: 'Maintains parallel relationship between selected lines.',
                perpendicular: 'Forces lines to maintain 90° angle.',
                distance: 'Sets a fixed distance between selected entities.',
                angle: 'Sets a fixed angle between selected lines.',
                ratio: 'Maintains proportional relationship between lengths.',
                horizontal: 'Forces line(s) to be horizontal.',
                vertical: 'Forces line(s) to be vertical.',
                equal: 'Makes selected entities have equal dimensions.'
            };
            
            if (descriptions[type]) {
                descDiv.style.display = 'block';
                descDiv.textContent = descriptions[type];
            } else {
                descDiv.style.display = 'none';
            }
        });
        
        document.getElementById('cancel-constraint').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        document.getElementById('create-constraint').addEventListener('click', () => {
            const type = typeSelect.value;
            if (!type) {
                alert('Please select a constraint type');
                return;
            }
            
            const constraint = {
                id: `constraint_${Date.now()}`,
                type: type,
                items: this.selectedItems.map(item => ({
                    entityId: item.entityId,
                    segmentIndex: item.segmentIndex,
                    segmentId: item.segmentIndex !== null && item.segmentIndex !== undefined ? 
                        this.entities.find(e => e.id === item.entityId)?.segments?.[item.segmentIndex]?.id : null
                }))
            };
            
            if (['distance', 'angle', 'ratio'].includes(type)) {
                const value = parseFloat(document.getElementById('constraint-value').value);
                if (isNaN(value)) {
                    alert('Please enter a valid number');
                    return;
                }
                constraint.value = value;
            }
            
            this.constraints.push(constraint);
            this.updateJSON();
            document.body.removeChild(modal);
            this.showNotification(`Constraint created: ${type}`);
        });
        
        // Focus on type select
        typeSelect.focus();
    }
    
    updateConstraintsList() {
        const list = document.getElementById('constraints-list');
        list.innerHTML = '';
        
        this.constraints.forEach(constraint => {
            const item = document.createElement('div');
            item.className = 'constraint-item';
            
            let text = `${constraint.type}: `;
            
            // Handle new format with items array
            if (constraint.items && constraint.items.length > 0) {
                const itemDescriptions = constraint.items.map(item => {
                    if (item.segmentId) {
                        return item.segmentId;
                    } else if (item.segmentIndex !== null && item.segmentIndex !== undefined) {
                        return `${item.entityId}_seg_${item.segmentIndex}`;
                    }
                    return item.entityId;
                });
                text += itemDescriptions.join(', ');
            } else if (constraint.entities) {
                // Handle legacy format
                text += constraint.entities.join(', ');
                if (constraint.segmentId) {
                    text += ` (${constraint.segmentId})`;
                } else if (constraint.segment !== undefined) {
                    text += ` (segment ${constraint.segment + 1})`;
                }
            }
            
            if (constraint.value !== undefined) {
                const unit = constraint.type === 'angle' ? '°' : 
                            constraint.type === 'ratio' ? 'x' : ' units';
                text += ` = ${constraint.value}${unit}`;
            }
            
            item.innerHTML = `
                <span style="font-size: 11px;">${text}</span>
                <button onclick="app.removeConstraint('${constraint.id}')">Remove</button>
            `;
            
            item.addEventListener('mouseenter', () => {
                this.highlightConstraintItems(constraint);
            });
            
            item.addEventListener('mouseleave', () => {
                this.clearConstraintHighlight();
            });
            
            list.appendChild(item);
        });
    }
    
    highlightConstraintItems(constraint) {
        if (constraint.items) {
            this.selectedItems = constraint.items.map(item => ({
                entityId: item.entityId,
                segmentIndex: item.segmentIndex
            }));
        } else if (constraint.entities) {
            this.selectedItems = constraint.entities.map(entityId => ({
                entityId: entityId,
                segmentIndex: constraint.segmentIndex || null
            }));
        }
        this.render();
    }
    
    clearConstraintHighlight() {
        this.selectedItems = [];
        this.render();
    }
    
    removeConstraint(constraintId) {
        this.constraints = this.constraints.filter(c => c.id !== constraintId);
        this.updateJSON();
    }
    
    exportDrawing() {
        const data = {
            version: "1.0",
            units: "grid",
            gridSize: this.gridSize,
            origin: [Math.round(this.origin.x / this.gridSize), Math.round(this.origin.y / this.gridSize)],
            entities: this.entities,
            constraints: this.constraints,
            metadata: {
                created: new Date().toISOString(),
                canvasSize: {
                    width: this.canvas.width,
                    height: this.canvas.height
                }
            }
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], 
            { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `drawing_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

// Add keyup listener for space bar
document.addEventListener('keyup', (e) => {
    if (e.key === ' ' && window.app) {
        window.app.handleKeyUp(e);
    }
});

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
}
@keyframes fadeOut {
    from { opacity: 1; }
    to { opacity: 0; }
}
`;
document.head.appendChild(style);

const app = new ParametricDrawingApp();
window.app = app;