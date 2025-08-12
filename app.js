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
        
        this.jsonEditor.addEventListener('input', () => {
            this.handleJSONEdit();
        });
        
        this.setTool('select');
    }
    
    setTool(tool) {
        this.currentTool = tool;
        this.isDrawingPolyline = false;
        this.polylinePoints = [];
        
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
            x: (x - this.origin.x) / this.canvas.width,
            y: (y - this.origin.y) / this.canvas.height
        };
    }
    
    denormalizeCoordinates(x, y) {
        return {
            x: x * this.canvas.width + this.origin.x,
            y: y * this.canvas.height + this.origin.y
        };
    }
    
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const gridPos = this.snapToGrid(x, y);
        
        if (this.settingOrigin) {
            this.origin = { ...gridPos };
            this.settingOrigin = false;
            this.setTool('select');
            this.render();
            return;
        }
        
        if (this.currentTool === 'select') {
            this.selectEntity(x, y);
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
        
        const worldX = this.gridPos.x - this.origin.x;
        const worldY = this.gridPos.y - this.origin.y;
        document.getElementById('coords').textContent = 
            `${Math.round(worldX)}, ${Math.round(worldY)}`;
        
        if (this.isDrawing && this.tempShape) {
            this.tempShape.end = this.gridPos;
        }
        
        const dist = Math.sqrt(
            Math.pow(this.gridPos.x - x, 2) + 
            Math.pow(this.gridPos.y - y, 2)
        );
        this.snapIndicator = dist < this.snapThreshold ? this.gridPos : null;
        
        this.render();
    }
    
    handleMouseUp(e) {
        if (this.isDrawing && this.tempShape) {
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
    
    addEntity(shape) {
        const entity = {
            id: `entity_${this.idCounter++}`,
            type: shape.type,
            metadata: {}
        };
        
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
                entity.radius = radius / Math.min(this.canvas.width, this.canvas.height);
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
                entity.radius = arcRadius / Math.min(this.canvas.width, this.canvas.height);
                entity.startAngle = startAngle;
                entity.endAngle = endAngle;
                break;
                
            case 'polyline':
                entity.points = shape.points.map(p => {
                    const norm = this.normalizeCoordinates(p.x, p.y);
                    return [norm.x, norm.y];
                });
                entity.closed = shape.closed;
                break;
        }
        
        this.entities.push(entity);
        this.updateJSON();
        this.render();
    }
    
    selectEntity(x, y) {
        this.selectedEntity = null;
        
        for (let i = this.entities.length - 1; i >= 0; i--) {
            const entity = this.entities[i];
            if (this.isPointNearEntity(x, y, entity)) {
                this.selectedEntity = entity.id;
                this.highlightEntityInJSON(entity.id);
                break;
            }
        }
        
        if (!this.selectedEntity) {
            this.clearJSONHighlight();
        }
        
        this.render();
    }
    
    highlightEntityInJSON(entityId) {
        try {
            const data = JSON.parse(this.jsonEditor.value);
            const entityIndex = data.entities.findIndex(e => e.id === entityId);
            
            if (entityIndex !== -1) {
                const lines = this.jsonEditor.value.split('\n');
                let currentLine = 0;
                let entityStartLine = -1;
                let entityEndLine = -1;
                let inEntity = false;
                let braceCount = 0;
                
                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].includes(`"id": "${entityId}"`) || 
                        lines[i].includes(`"id":"${entityId}"`)) {
                        entityStartLine = i;
                        while (entityStartLine > 0 && !lines[entityStartLine].includes('{')) {
                            entityStartLine--;
                        }
                        inEntity = true;
                        braceCount = 1;
                    }
                    
                    if (inEntity) {
                        for (let char of lines[i]) {
                            if (char === '{') braceCount++;
                            if (char === '}') braceCount--;
                        }
                        
                        if (braceCount === 0) {
                            entityEndLine = i;
                            break;
                        }
                    }
                }
                
                if (entityStartLine !== -1 && entityEndLine !== -1) {
                    const start = lines.slice(0, entityStartLine).join('\n').length + entityStartLine;
                    const end = lines.slice(0, entityEndLine + 1).join('\n').length + entityEndLine;
                    
                    this.jsonEditor.focus();
                    this.jsonEditor.setSelectionRange(start, end);
                    
                    const scrollRatio = entityStartLine / lines.length;
                    this.jsonEditor.scrollTop = scrollRatio * this.jsonEditor.scrollHeight;
                }
            }
        } catch (e) {
            console.error('Error highlighting JSON:', e);
        }
    }
    
    clearJSONHighlight() {
        const pos = this.jsonEditor.selectionStart;
        this.jsonEditor.setSelectionRange(pos, pos);
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
                const radius = entity.radius * Math.min(this.canvas.width, this.canvas.height);
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
        this.updateJSON();
        this.render();
    }
    
    clearDrawing() {
        this.entities = [];
        this.constraints = [];
        this.selectedEntity = null;
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
            this.ctx.strokeStyle = isSelected ? '#0088ff' : '#00ff88';
            this.ctx.lineWidth = isSelected ? 2 : 1;
            
            this.drawEntity(entity);
        });
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
                const radius = entity.radius * Math.min(this.canvas.width, this.canvas.height);
                this.ctx.beginPath();
                this.ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
                this.ctx.stroke();
                break;
                
            case 'arc':
                const arcCenter = this.denormalizeCoordinates(entity.center[0], entity.center[1]);
                const arcRadius = entity.radius * Math.min(this.canvas.width, this.canvas.height);
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
            units: "normalized",
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
                });
                this.idCounter = maxId + 1;
            }
            
            if (data.constraints && Array.isArray(data.constraints)) {
                this.constraints = data.constraints;
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
            units: "normalized",
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