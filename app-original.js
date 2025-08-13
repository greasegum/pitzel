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
        this.selectedSegment = null;
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
        
        this.init();
    }
    
    init() {
        this.setupCanvas();
        this.setupEventListeners();
        this.render();
        this.updateJSON();
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
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setTool(btn.dataset.tool);
            });
        });
        
        document.getElementById('clear-btn').addEventListener('click', () => {
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
            this.showConstraintDialog();
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
            this.render();
        });
        
        this.setTool('select');
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
        return {
            x: Math.round(x / this.gridSize) * this.gridSize,
            y: Math.round(y / this.gridSize) * this.gridSize
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
                    // Regenerate segment IDs if they don't exist
                    if (!entity.segments || entity.segments.length === 0) {
                        const segmentCount = entity.closed ? entity.points.length : entity.points.length - 1;
                        entity.segments = [];
                        for (let i = 0; i < segmentCount; i++) {
                            entity.segments.push({
                                id: `${entity.id}_seg_${i}`,
                                metadata: {}
                            });
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
        
        if (this.settingOrigin) {
            const oldOrigin = { ...this.origin };
            this.origin = { ...gridPos };
            this.settingOrigin = false;
            this.recalculateCoordinates(oldOrigin);
            this.setTool('select');
            this.render();
            return;
        }
        
        if (this.currentTool === 'select') {
            const entity = this.getEntityAt(x, y);
            if (entity) {
                if (this.selectedEntity === entity.id && entity.type === 'polyline') {
                    const segment = this.getSegmentAt(x, y, entity);
                    if (segment !== null) {
                        this.selectedSegment = segment;
                        this.updateSegmentMetadataEditor(entity, segment);
                    }
                } else {
                    this.selectEntity(entity);
                    this.selectedSegment = null;
                }
                
                this.isDragging = true;
                this.dragStart = { ...gridPos };
                this.dragEntity = entity;
                this.canvas.style.cursor = 'move';
            } else {
                this.selectEntity(null);
                this.selectedSegment = null;
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
            const entity = this.getEntityAt(x, y);
            this.canvas.style.cursor = entity ? 'move' : 'default';
        }
        
        const dist = Math.sqrt(
            Math.pow(this.gridPos.x - x, 2) + 
            Math.pow(this.gridPos.y - y, 2)
        );
        this.snapIndicator = dist < this.snapThreshold ? this.gridPos : null;
        
        this.render();
    }
    
    handleMouseUp(e) {
        if (this.isDragging) {
            this.isDragging = false;
            this.dragEntity = null;
            this.canvas.style.cursor = this.currentTool === 'select' ? 'default' : 'crosshair';
        } else if (this.isDrawing && this.tempShape) {
            this.isDrawing = false;
            
            if (this.currentTool !== 'polyline') {
                this.addEntity(this.tempShape);
            }
            
            this.tempShape = null;
        }
    }
    
    handleDoubleClick(e) {
        if (this.currentTool === 'polyline' && this.isDrawingPolyline) {
            if (this.polylinePoints.length > 1) {
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
        if (e.key === 'Escape') {
            this.isDrawingPolyline = false;
            this.polylinePoints = [];
            this.isDrawing = false;
            this.tempShape = null;
            this.render();
        } else if (e.key === 'Delete' && this.selectedEntity) {
            this.deleteEntity(this.selectedEntity);
        } else if (e.key === 'c' && this.currentTool === 'polyline' && this.isDrawingPolyline) {
            if (this.polylinePoints.length > 2) {
                this.addEntity({
                    type: 'polyline',
                    points: [...this.polylinePoints],
                    closed: true
                });
                this.isDrawingPolyline = false;
                this.polylinePoints = [];
            }
        }
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
        
        const threshold = 5;
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
                
                // Generate segment IDs
                const segmentCount = shape.closed ? entity.points.length : entity.points.length - 1;
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
    
    handleJSONHover(e) {
        const cursorPos = this.jsonEditor.selectionStart;
        const text = this.jsonEditor.value;
        const lines = text.substring(0, cursorPos).split('\n');
        const lineNumber = lines.length - 1;
        const allLines = text.split('\n');
        
        let entityId = null;
        let searchStart = Math.max(0, lineNumber - 10);
        let searchEnd = Math.min(allLines.length, lineNumber + 10);
        
        for (let i = searchStart; i < searchEnd; i++) {
            const line = allLines[i];
            const match = line.match(/"id"\s*:\s*"(entity_\d+)"/);
            if (match) {
                entityId = match[1];
                break;
            }
        }
        
        if (entityId !== this.hoveredEntity) {
            this.hoveredEntity = entityId;
            this.render();
        }
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
        
        container.querySelectorAll('input[data-field]').forEach(input => {
            input.addEventListener('change', (e) => {
                const fieldName = e.target.dataset.field;
                this.updateEntityMetadata(entity.id, fieldName, e.target.value);
            });
        });
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
                <input type="text" value="[${entity.points[segmentIndex]}] → [${entity.points[(segmentIndex + 1) % entity.points.length]}]" readonly style="opacity: 0.7; font-size: 11px">
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
        const threshold = 5;
        
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
        this.idCounter = 1;
        this.updateJSON();
        this.render();
    }
    
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.drawGrid();
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
    }
    
    drawOrigin() {
        this.ctx.strokeStyle = '#ff0000';
        this.ctx.lineWidth = 2;
        
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
        this.ctx.lineWidth = 2;
        
        this.ctx.beginPath();
        this.ctx.arc(this.snapIndicator.x, this.snapIndicator.y, 5, 0, Math.PI * 2);
        this.ctx.stroke();
        
        this.ctx.beginPath();
        this.ctx.arc(this.snapIndicator.x, this.snapIndicator.y, 2, 0, Math.PI * 2);
        this.ctx.fill();
    }
    
    drawOriginCursor() {
        this.ctx.strokeStyle = '#ff00ff';
        this.ctx.lineWidth = 2;
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
        this.ctx.font = '12px sans-serif';
        this.ctx.fillText('Click to set origin', this.gridPos.x + 20, this.gridPos.y - 5);
    }
    
    drawGrid() {
        this.ctx.strokeStyle = '#3a3a3a';
        this.ctx.lineWidth = 0.5;
        
        for (let x = 0; x <= this.canvas.width; x += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y <= this.canvas.height; y += this.gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
        
        this.ctx.strokeStyle = '#4a4a4a';
        this.ctx.lineWidth = 1;
        
        for (let x = 0; x <= this.canvas.width; x += this.gridSize * 5) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y <= this.canvas.height; y += this.gridSize * 5) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }
    
    drawEntities() {
        this.entities.forEach(entity => {
            const isSelected = entity.id === this.selectedEntity;
            const isHovered = entity.id === this.hoveredEntity;
            
            if (entity.type === 'polyline' && entity.segments && isSelected) {
                this.drawPolylineWithSegments(entity, isHovered);
            } else {
                const color = entity.metadata?.color || '#00ff88';
                this.ctx.strokeStyle = isSelected ? '#0088ff' : (isHovered ? '#ffaa00' : color);
                this.ctx.lineWidth = (isSelected || isHovered) ? 2 : 1;
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
            
            const isSegmentSelected = this.selectedSegment === i;
            this.ctx.strokeStyle = isSegmentSelected ? '#ff00ff' : 
                                  (isHovered ? '#ffaa00' : segmentColor);
            this.ctx.lineWidth = isSegmentSelected ? 3 : 2;
            
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
            this.ctx.strokeStyle = isSegmentSelected ? '#ff00ff' : 
                                  (isHovered ? '#ffaa00' : segmentColor);
            this.ctx.lineWidth = isSegmentSelected ? 3 : 2;
            
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
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 5]);
        
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
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([5, 5]);
        
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
                    
                    // Ensure polylines have segment IDs
                    if (entity.type === 'polyline') {
                        if (!entity.segments || entity.segments.length === 0) {
                            const segmentCount = entity.closed ? entity.points.length : entity.points.length - 1;
                            entity.segments = [];
                            for (let i = 0; i < segmentCount; i++) {
                                entity.segments.push({
                                    id: `${entity.id}_seg_${i}`,
                                    metadata: {}
                                });
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
        const selectedEntities = this.entities.filter(e => e.id === this.selectedEntity);
        
        if (selectedEntities.length === 0) {
            alert('Please select an entity first');
            return;
        }
        
        const types = ['coincident', 'parallel', 'perpendicular', 'distance', 'angle', 'ratio'];
        const type = prompt(`Enter constraint type:\n${types.join(', ')}`);
        
        if (type && types.includes(type)) {
            const constraint = {
                id: `constraint_${Date.now()}`,
                type: type,
                entities: [this.selectedEntity]
            };
            
            if (this.selectedSegment !== null) {
                const entity = this.entities.find(e => e.id === this.selectedEntity);
                if (entity && entity.segments && entity.segments[this.selectedSegment]) {
                    constraint.segmentId = entity.segments[this.selectedSegment].id;
                    constraint.segmentIndex = this.selectedSegment;
                }
            }
            
            if (type === 'distance' || type === 'angle' || type === 'ratio') {
                const value = prompt(`Enter ${type} value:`);
                if (value) {
                    constraint.value = parseFloat(value);
                } else {
                    return;
                }
            }
            
            if (type !== 'distance') {
                const otherEntity = prompt('Enter ID of second entity (or leave empty):');
                if (otherEntity && this.entities.find(e => e.id === otherEntity)) {
                    constraint.entities.push(otherEntity);
                }
            }
            
            this.constraints.push(constraint);
            this.updateJSON();
        }
    }
    
    updateConstraintsList() {
        const list = document.getElementById('constraints-list');
        list.innerHTML = '';
        
        this.constraints.forEach(constraint => {
            const item = document.createElement('div');
            item.className = 'constraint-item';
            
            let text = `${constraint.type}: ${constraint.entities.join(', ')}`;
            if (constraint.segmentId) {
                text += ` (${constraint.segmentId})`;
            } else if (constraint.segment !== undefined) {
                text += ` (segment ${constraint.segment + 1})`;
            }
            if (constraint.value !== undefined) {
                text += ` = ${constraint.value}`;
            }
            
            item.innerHTML = `
                <span>${text}</span>
                <button onclick="app.removeConstraint('${constraint.id}')">Remove</button>
            `;
            
            list.appendChild(item);
        });
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

const app = new ParametricDrawingApp();