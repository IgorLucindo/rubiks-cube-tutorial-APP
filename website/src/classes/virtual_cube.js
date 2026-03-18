import { getSolverMoves } from "../utils/solver_utils.js";


export class VirtualCube {
    constructor(cfg) {
        this.cfg = cfg;
        this.container = document.getElementById('threeContainer');
        this.cubeState = { U: null, D: null, F: null, B: null, L: null, R: null };
        
        this.colorFace = {
            'white': 'D', 
            'yellow': 'U', 
            'green': 'F', 
            'blue': 'B', 
            'orange': 'R',
            'red': 'L'
        };
        this.faceColor = Object.fromEntries(Object.entries(this.colorFace).map(([k, v]) => [v, k]));

        const styles = getComputedStyle(document.documentElement);
        this.cssColors = {
            'white': styles.getPropertyValue('--cube-white').trim(),
            'yellow': styles.getPropertyValue('--cube-yellow').trim(),
            'green': styles.getPropertyValue('--cube-green').trim(),
            'blue': styles.getPropertyValue('--cube-blue').trim(),
            'orange': styles.getPropertyValue('--cube-orange').trim(),
            'red': styles.getPropertyValue('--cube-red').trim()
        };

        // Animation & Interaction State
        this.scaleState = {
            active: false,
            startTime: 0,
            duration: 600,
            baseScale: 1.0,
            maxScale: 1.15
        };
        this.rotationState = {
            active: false,
            startTime: 0,
            duration: 800,
            start: {x:0,y:0,z:0},
            end: {x:0,y:0,z:0},
            delayBeforeNext: 1200
        };
        this.dragState = {
            active: false,
            previous: { x: 0, y: 0 },
            sensitivity: 0.005
        };
        this.moveAnim = {
            active: false,
            startTime: 0,
            duration: 400,
            cubies: [],
            axis: null,
            totalAngle: 0,
            accumulated: 0
        };

        this.isScanning = true;
        this.nextMoveTimeout = null;
        this.pendingStepDirection = 0;
        this.pendingMoveAfterRotate = null;
        this.firstScanDone = false;
        this.currentExpectedFaceId = null;
        this.lastScannedFaceId = null;
        this.currentScanRotation = 0;
        this.scanHistory = [];
        this.scanOrder = [];
        this.solutionMoves = [];
        this.currentMoveIdx = -1;
        this.isSolvedMode = false;
        this.isAutoSolving = false;

        // Three.js State
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.cubeGroup = null;
        this.cubies = [];

        this.initThreeJS();
        this.initDragControls();
        window.addEventListener('resize', () => this.handleResize());
        
        window._prevMove = () => this.prevMove();
        window._nextMove = () => this.nextMove();
        window._undoScan = () => this.undoLastScan();
    }


    initThreeJS() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
        const camera_posz = 7 ? 7.7 : this.cfg.isMobile;
        this.camera.position.set(0, 0, camera_posz); 

        this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        this.container.appendChild(this.renderer.domElement);

        this.cubeGroup = new THREE.Group();
        this.scene.add(this.cubeGroup);
        
        const geometry = new THREE.BoxGeometry(0.95, 0.95, 0.95);
        const baseMaterial = new THREE.MeshBasicMaterial({ color: 0x444444, transparent: true, opacity: 0.85 });
        const outlineMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });

        // Generate 3x3x3 Cube
        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                for (let z = -1; z <= 1; z++) {
                    const materials = Array(6).fill(null).map(() => baseMaterial.clone());
                    const mesh = new THREE.Mesh(geometry, materials);
                    mesh.position.set(x, y, z);
                    
                    const edges = new THREE.EdgesGeometry(geometry);
                    mesh.add(new THREE.LineSegments(edges, outlineMaterial));
                    
                    this.cubeGroup.add(mesh);
                    this.cubies.push({ mesh, x, y, z });
                }
            }
        }
        this.handleResize();
    }


    handleResize() {
        if (!this.container) return;
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        if (width === 0 || height === 0) return;
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }


    initDragControls() {
        const handleStart = (clientX, clientY, target) => {
            if (target?.closest && target.closest('.controls')) return;

            this.dragState.active = true;
            this.dragState.previous = { x: clientX, y: clientY };
            
            if (this.rotationState.active) {
                this.dragState.startRotation = { ...this.rotationState.end };
            } else {
                this.dragState.startRotation = { 
                    x: this.cubeGroup.rotation.x, 
                    y: this.cubeGroup.rotation.y, 
                    z: this.cubeGroup.rotation.z 
                };
            }
            
            this.rotationState.active = false;
            if (this.nextMoveTimeout) clearTimeout(this.nextMoveTimeout);
            document.body.classList.add('grabbing');
        };

        const handleMove = (clientX, clientY) => {
            if (!this.dragState.active) return;
            const deltaX = clientX - this.dragState.previous.x;
            const deltaY = clientY - this.dragState.previous.y;
            this.cubeGroup.rotation.y += deltaX * this.dragState.sensitivity;
            this.cubeGroup.rotation.x += deltaY * this.dragState.sensitivity;
            this.dragState.previous = { x: clientX, y: clientY };
        };

        const handleEnd = () => {
            if (this.dragState.active) {
                this.dragState.active = false;
                document.body.classList.remove('grabbing');
                if (this.dragState.startRotation) {
                    this.rotationState.duration = 1000;
                    this.setTargetRotation(this.dragState.startRotation);
                }
            }
        };

        // --- Mouse Events ---
        this.container.addEventListener('mousedown', (e) => handleStart(e.clientX, e.clientY, e.target));
        window.addEventListener('mousemove', (e) => handleMove(e.clientX, e.clientY));
        window.addEventListener('mouseup', handleEnd);

        // --- Touch Events ---
        this.container.addEventListener('touchstart', (e) => {
            if (e.touches.length > 0) {
                handleStart(e.touches[0].clientX, e.touches[0].clientY, e.target);
            }
        }, { passive: false });
        
        window.addEventListener('touchmove', (e) => {
            if (this.dragState.active && e.touches.length > 0) {
                handleMove(e.touches[0].clientX, e.touches[0].clientY);
            }
        }, { passive: false });
        
        window.addEventListener('touchend', handleEnd);
        window.addEventListener('touchcancel', handleEnd);
    }

    _mod4(n) {
        return ((n % 4) + 4) % 4;
    }

    _rotateGrid(grid, rotations) {
        const times = this._mod4(rotations);
        if (times === 0) return [...grid];

        let newGrid = [...grid];
        for (let k = 0; k < times; k++) {
            const temp = [...newGrid];
            newGrid[0] = temp[6]; newGrid[1] = temp[3]; newGrid[2] = temp[0];
            newGrid[3] = temp[7]; newGrid[4] = temp[4]; newGrid[5] = temp[1];
            newGrid[6] = temp[8]; newGrid[7] = temp[5]; newGrid[8] = temp[2];
        }
        return newGrid;
    }

    _getUDScanRotationForYaw(faceId, yawRadians) {
        // Quantize yaw to nearest 90° and compute grid rotation needed so that
        // U/D are stored in a consistent orientation regardless of approach side.
        const quarterTurns = Math.round(yawRadians / (Math.PI / 2));
        if (faceId === 'U') return this._mod4(-quarterTurns);
        if (faceId === 'D') return this._mod4(quarterTurns);
        return 0;
    }


    loop(faceColors) {
        this.animateScale();
        this.animateRotation();
        this.updateMoveAnimation();
        this.renderer.render(this.scene, this.camera);
        this.handleCompletion();

        if (!faceColors || !this.isScanning) return;

        const faceId = this.addFace(faceColors);
        
        if (faceId) {
            const storedColors = this.cubeState[faceId].map(c => this.faceColor[c]);
            this.update3DColors(faceId, storedColors);

            this.scaleState.active = true;
            this.scaleState.startTime = Date.now();

            if (!this.firstScanDone) {
                this.firstScanDone = true;
                const targetRot = this.getRotationForFace(faceId);
                this.cubeGroup.rotation.set(targetRot.x, targetRot.y, targetRot.z);
                this.currentExpectedFaceId = faceId;
                this.fillAllCenters();
            }

            if (!this.isComplete()) {
                if (this.nextMoveTimeout) clearTimeout(this.nextMoveTimeout);
                this.nextMoveTimeout = setTimeout(() => {
                    this.guideToNextFace();
                }, this.rotationState.delayBeforeNext);
            }
        }
    }


    guideToNextFace() {
        const missing = this.getMissingFaces();
        if (missing.length === 0) return;

        if (this.scanOrder.length === 0) {
            const scannedFaces = Object.keys(this.cubeState).filter(k => this.cubeState[k] !== null);
            const startFace = scannedFaces[0] || 'F';
            const ring = ['F', 'R', 'B', 'L'];
            if (ring.includes(startFace)) {
                const idx = ring.indexOf(startFace);
                for (let i = 1; i <= 3; i++) this.scanOrder.push(ring[(idx + i) % 4]);
                this.scanOrder.push('U', 'D');
            } else {
                // Fallback if they somehow started with U/D (should be blocked now)
                this.scanOrder = ['F', 'R', 'B', 'L', 'U', 'D'].filter(f => f !== startFace);
            }
        }

        let next = this.scanOrder.find(f => missing.includes(f)) || missing[0];
        this.currentExpectedFaceId = next;

        let target = { x: 0, y: 0, z: 0 };

        if (next === 'U') {
            target.x = Math.PI / 2;
            const currentY = this.cubeGroup.rotation.y;
            target.y = (Math.PI / 2) * Math.round(currentY / (Math.PI / 2));
            target.z = 0; 
        } 
        else if (next === 'D') {
             target.x = -Math.PI / 2;
             const currentY = this.cubeGroup.rotation.y;
             target.y = (Math.PI / 2) * Math.round(currentY / (Math.PI / 2));
             target.z = 0;
        } 
        else {
            target = this.getRotationForFace(next);
            const currentY = this.cubeGroup.rotation.y;
            const PI2 = Math.PI * 2;
            const cycle = Math.round((currentY - target.y) / PI2);
            target.y = target.y + (cycle * PI2);
            target.z = 0;
        }

        this.rotationState.duration = 1500;
        this.setTargetRotation(target);
    }


    addFace(faceColors) {
        const centerColor = faceColors[4];
        const faceId = this.colorFace[centerColor];

        if (!faceId) return null;
        if (!this.firstScanDone && (faceId === 'U' || faceId === 'D')) {
            console.warn("Please start with a side face (Green, Red, Blue, Orange).");
            return null;
        }

        if (faceId === 'U' || faceId === 'D') {
            this.currentScanRotation = this._getUDScanRotationForYaw(faceId, this.cubeGroup.rotation.y);
        } else {
            this.currentScanRotation = 0;
        }

        const normalizedColors = this._rotateGrid(faceColors, -this.currentScanRotation);
        const stickers = normalizedColors.map(color => this.colorFace[color]);
        this.cubeState[faceId] = stickers;
        this.lastScannedFaceId = faceId;
        this.scanHistory.push(faceId);
        this.updateUndoButton();
        return faceId;
    }

    updateUndoButton() {
        const btn = document.getElementById('undoScanBtn');
        if (!btn) return;
        btn.disabled = this.scanHistory.length === 0;
    }

    resetFace3DColors(faceId) {
        const faceMap = {
            'F': { axis: 'z', val: 1 },  'B': { axis: 'z', val: -1 },
            'U': { axis: 'y', val: 1 },  'D': { axis: 'y', val: -1 },
            'R': { axis: 'x', val: 1 },  'L': { axis: 'x', val: -1 }
        };
        const matIdxMap = { 'R': 0, 'L': 1, 'U': 2, 'D': 3, 'F': 4, 'B': 5 };
        const sortRules = {
            'F': (a, b) => (b.y - a.y) || (a.x - b.x),
            'B': (a, b) => (b.y - a.y) || (b.x - a.x),
            'R': (a, b) => (b.y - a.y) || (b.z - a.z),
            'L': (a, b) => (b.y - a.y) || (a.z - b.z),
            'U': (a, b) => (a.z - b.z) || (a.x - b.x),
            'D': (a, b) => (b.z - a.z) || (a.x - b.x)
        };

        const target = faceMap[faceId];
        if (!target) return;

        const faceCubies = this.cubies
            .filter(c => c[target.axis] === target.val)
            .sort(sortRules[faceId]);

        const matIndex = matIdxMap[faceId];
        faceCubies.forEach((cubie) => {
            cubie.mesh.material[matIndex].color.set(0x444444);
            cubie.mesh.material[matIndex].opacity = 0.85;
        });
    }

    rebuild3DFromState() {
        // Clear all faces to base
        ['U', 'D', 'F', 'R', 'B', 'L'].forEach(faceId => this.resetFace3DColors(faceId));

        // Re-apply scanned faces
        Object.keys(this.cubeState).forEach(faceId => {
            const stickers = this.cubeState[faceId];
            if (!stickers) return;
            const visualColors = stickers.map(id => this.faceColor[id]);
            this.update3DColors(faceId, visualColors);
        });

        if (this.firstScanDone) this.fillAllCenters();
    }

    undoLastScan() {
        if (this.scanHistory.length === 0) return;

        const faceId = this.scanHistory.pop();
        this.cubeState[faceId] = null;
        this.lastScannedFaceId = this.scanHistory[this.scanHistory.length - 1] || null;

        // If we undid the very first scan, reset scan flow.
        if (this.scanHistory.length === 0) {
            this.firstScanDone = false;
            this.currentExpectedFaceId = null;
            this.scanOrder = [];
            
            // Rotate back to default F view
            this.rotationState.duration = 800;
            this.setTargetRotation({ x: 0, y: 0, z: 0 });
        } else {
            this.currentExpectedFaceId = faceId;
            // Let the cube guide the user back to the face we just undid
            this.guideToNextFace();
        }

        // If we already completed scanning/solving, go back to scanning mode.
        this.isSolvedMode = false;
        this.isScanning = true;
        this.solutionMoves = [];
        this.currentMoveIdx = -1;
        
        document.body.classList.remove('scan-complete');
        setTimeout(() => window.dispatchEvent(new Event('resize')), 400);

        const controls = document.getElementById('solutionControls');
        if (controls) controls.style.display = 'none';
        this.updateSolutionButtons();

        this.rebuild3DFromState();
        this.updateUndoButton();

        const status = document.getElementById('status');
        if (status) status.innerHTML = "Undo last scan. Re-scan the face.";
    }


    update3DColors(faceId, colors) {
        const faceMap = {
            'F': { axis: 'z', val: 1 },  'B': { axis: 'z', val: -1 },
            'U': { axis: 'y', val: 1 },  'D': { axis: 'y', val: -1 },
            'R': { axis: 'x', val: 1 },  'L': { axis: 'x', val: -1 }
        };
        const matIdxMap = { 'R': 0, 'L': 1, 'U': 2, 'D': 3, 'F': 4, 'B': 5 };
        const sortRules = {
            'F': (a, b) => (b.y - a.y) || (a.x - b.x),
            'B': (a, b) => (b.y - a.y) || (b.x - a.x),
            'R': (a, b) => (b.y - a.y) || (b.z - a.z),
            'L': (a, b) => (b.y - a.y) || (a.z - b.z),
            'U': (a, b) => (a.z - b.z) || (a.x - b.x),
            'D': (a, b) => (b.z - a.z) || (a.x - b.x)
        };

        const target = faceMap[faceId];
        if (!target) return;

        // Filter and Sort
        const faceCubies = this.cubies
            .filter(c => c[target.axis] === target.val)
            .sort(sortRules[faceId]);

        // Apply Colors
        const matIndex = matIdxMap[faceId];
        faceCubies.forEach((cubie, i) => {
            const colorStr = this.cssColors[colors[i]] || '#555555';
            cubie.mesh.material[matIndex].color.set(colorStr);
            cubie.mesh.material[matIndex].opacity = 1.0; 
        });
    }


    getRotationForFace(faceId) {
        switch (faceId) {
            case 'F': return { x: 0, y: 0, z: 0 };
            case 'B': return { x: 0, y: -Math.PI, z: 0 };
            case 'R': return { x: 0, y: -Math.PI/2, z: 0 };
            case 'L': return { x: 0, y: -Math.PI * 1.5, z: 0 };
            case 'U': return { x: Math.PI/2, y: -Math.PI * 2, z: 0 };
            case 'D': return { x: -Math.PI/2, y: -Math.PI * 2, z: 0 };
        }
        return { x: 0, y: 0, z: 0 };
    }


    getMissingFaces() {
        return Object.keys(this.cubeState).filter(key => this.cubeState[key] === null);
    }


    isComplete() {
        return this.getMissingFaces().length === 0;
    }
    

    handleCompletion() {
        if (!this.isComplete() || this.isSolvedMode) return;
        this.isSolvedMode = true; 
        this.isScanning = false;
        this.currentExpectedFaceId = null;

        console.log("Scanning Complete. Solving...");
        const moves = getSolverMoves(this.cubeState);

        if (moves && !moves.error) {
            this.setSolution(moves.moves);
            const controls = document.getElementById('solutionControls');
            const status = document.getElementById('status');
            if (controls) controls.style.display = 'flex';
            if (status) status.innerHTML = "SOLVED! <br> Follow the moves on screen.";
            this.updateSolutionButtons();
            
            // Layout animation toggle
            document.body.classList.add('scan-complete');
            setTimeout(() => window.dispatchEvent(new Event('resize')), 400);
        } else {
            const status = document.getElementById('status');
            if (status) status.innerHTML = moves?.error || "Solver Error.";
        }

        console.log("Cube Solved.");
    }


    forceUnsolvedState() {
        this.isSolvedMode = false;
        this.solutionMoves = [];
        this.currentMoveIdx = -1;

        document.body.classList.remove('scan-complete');
        setTimeout(() => window.dispatchEvent(new Event('resize')), 400);

        // Reset geometry
        let idx = 0;
        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                for (let z = -1; z <= 1; z++) {
                    const cubie = this.cubies[idx++];
                    cubie.mesh.position.set(x, y, z);
                    cubie.mesh.rotation.set(0, 0, 0);
                    cubie.x = x; cubie.y = y; cubie.z = z;
                }
            }
        }

        this.cubeState = {
            'U': ['L', 'D', 'F', 'U', 'U', 'R', 'L', 'L', 'B'],
            'D': ['B', 'L', 'B', 'F', 'D', 'F', 'U', 'F', 'U'],
            'F': ['D', 'B', 'R', 'L', 'F', 'D', 'L', 'F', 'R'],
            'R': ['D', 'U', 'D', 'L', 'R', 'B', 'U', 'D', 'R'],
            'B': ['R', 'R', 'D', 'R', 'B', 'B', 'F', 'R', 'F'],
            'L': ['F', 'B', 'B', 'D', 'L', 'U', 'L', 'U', 'U'],
        };

        // Render
        Object.keys(this.cubeState).forEach(faceId => {
            const visualColors = this.cubeState[faceId].map(id => this.faceColor[id]);
            this.update3DColors(faceId, visualColors);
        });
    }

    
    autoSolve() {
        if (this.isAutoSolving || this.solutionMoves.length === 0) return;
        this.isAutoSolving = true;

        const interval = setInterval(() => {
            if (this.currentMoveIdx >= this.solutionMoves.length - 1 || this.solutionMoves.length === 0) {
                clearInterval(interval);
                this.isAutoSolving = false;
                console.log("Auto-solve finished.");
                return;
            }

            if (!this.moveAnim.active) {
                this.nextMove();
            }
        }, 50); 
    }


    fillAllCenters() {
        const faceMap = { 'F': 'z', 'B': 'z', 'U': 'y', 'D': 'y', 'R': 'x', 'L': 'x' };
        const valMap = { 'F':1, 'B':-1, 'U':1, 'D':-1, 'R':1, 'L':-1 };
        const matIdxMap = { 'R': 0, 'L': 1, 'U': 2, 'D': 3, 'F': 4, 'B': 5 };

        Object.entries(this.faceColor).forEach(([faceId, colorName]) => {
            const axis = faceMap[faceId];
            const val = valMap[faceId];
            const matIndex = matIdxMap[faceId];
            const colorStr = this.cssColors[colorName] || '#555555';
            const centerCubie = this.cubies.find(c => {
                if (c[axis] !== val) return false;
                const otherAxes = ['x', 'y', 'z'].filter(a => a !== axis);
                return c[otherAxes[0]] === 0 && c[otherAxes[1]] === 0;
            });
            if (centerCubie) {
                centerCubie.mesh.material[matIndex].color.set(colorStr);
                centerCubie.mesh.material[matIndex].opacity = 1.0;
            }
        });
    }


    animateScale() {
        if (!this.scaleState.active) return;
        const elapsed = Date.now() - this.scaleState.startTime;
        const progress = Math.min(elapsed / this.scaleState.duration, 1);
        const pulse = Math.sin(progress * Math.PI);
        const s = this.scaleState.baseScale + (pulse * (this.scaleState.maxScale - this.scaleState.baseScale));
        this.cubeGroup.scale.set(s, s, s);
        if (progress === 1) {
            this.scaleState.active = false;
            this.cubeGroup.scale.set(1, 1, 1);
        }
    }


    animateRotation() {
        if (!this.rotationState.active) return;
        const elapsed = Date.now() - this.rotationState.startTime;
        const progress = Math.min(elapsed / this.rotationState.duration, 1);
        const ease = 1 - Math.pow(1 - progress, 3);
        const { start, end } = this.rotationState;
        this.cubeGroup.rotation.set(
            start.x + (end.x - start.x) * ease,
            start.y + (end.y - start.y) * ease,
            start.z + (end.z - start.z) * ease
        );
        if (progress === 1) {
            this.rotationState.active = false;
            if (this.pendingMoveAfterRotate) {
                const move = this.pendingMoveAfterRotate;
                this.pendingMoveAfterRotate = null;
                this.animateMove(move);
                return;
            }
            if (this.pendingStepDirection !== 0) {
                const dir = this.pendingStepDirection;
                this.pendingStepDirection = 0;
                if (dir > 0) this.nextMove();
                else this.prevMove();
            }
        }
    }


    setTargetRotation(target) {
        this.rotationState.start = { x: this.cubeGroup.rotation.x, y: this.cubeGroup.rotation.y, z: this.cubeGroup.rotation.z };
        this.rotationState.end = target;
        this.rotationState.startTime = Date.now();
        this.rotationState.active = true;
    }


    updateMoveAnimation() {
        if (!this.moveAnim.active) return;

        const now = Date.now();
        const elapsed = now - this.moveAnim.startTime;
        let progress = elapsed / this.moveAnim.duration;
        
        if (progress >= 1) {
            progress = 1;
            this.moveAnim.active = false;
        }

        const ease = t => t * (2 - t);
        const currentTargetAngle = this.moveAnim.totalAngle * ease(progress);
        const delta = currentTargetAngle - this.moveAnim.accumulated;
        
        this.moveAnim.cubies.forEach(cubie => {
            cubie.mesh.position.applyAxisAngle(this.moveAnim.axis, delta);
            cubie.mesh.rotateOnWorldAxis(this.moveAnim.axis, delta);
        });

        this.moveAnim.accumulated = currentTargetAngle;

        if (!this.moveAnim.active) {
            this.finalizeMove();
        }
    }


    finalizeMove() {
        this.moveAnim.cubies.forEach(cubie => {
            cubie.mesh.position.x = Math.round(cubie.mesh.position.x);
            cubie.mesh.position.y = Math.round(cubie.mesh.position.y);
            cubie.mesh.position.z = Math.round(cubie.mesh.position.z);
            
            cubie.x = Math.round(cubie.mesh.position.x);
            cubie.y = Math.round(cubie.mesh.position.y);
            cubie.z = Math.round(cubie.mesh.position.z);
        });
    }


    animateMove(move) {
        if (this.moveAnim.active) return;

        let modifier = "";
        if (move.endsWith("'")) modifier = "'";
        else if (move.endsWith("2")) modifier = "2";
        let base = move.substring(0, move.length - modifier.length);
        if (['f','b','r','l','u','d'].includes(base)) base = base.toUpperCase();

        let isDouble = modifier === "2";
        let clockwise = modifier !== "'";

        const moveDefinitions = {
            'R': { axis: 'x', filter: c => c.x > 0.1,  angle: -1 },
            'L': { axis: 'x', filter: c => c.x < -0.1, angle: 1 },
            'U': { axis: 'y', filter: c => c.y > 0.1,  angle: -1 },
            'D': { axis: 'y', filter: c => c.y < -0.1, angle: 1 },
            'F': { axis: 'z', filter: c => c.z > 0.1,  angle: -1 },
            'B': { axis: 'z', filter: c => c.z < -0.1, angle: 1 },
            'M': { axis: 'x', filter: c => Math.abs(c.x) < 0.1, angle: 1 }, 
            'E': { axis: 'y', filter: c => Math.abs(c.y) < 0.1, angle: 1 },
            'S': { axis: 'z', filter: c => Math.abs(c.z) < 0.1, angle: -1 },
            'x': { axis: 'x', filter: c => true, angle: -1 },
            'y': { axis: 'y', filter: c => true, angle: -1 },
            'z': { axis: 'z', filter: c => true, angle: -1 },
        };

        const def = moveDefinitions[base];
        if (!def) {
            console.warn(`Skipping unsupported move: ${move}`);
            if (this.isAutoSolving) this.currentMoveIdx++;
            return;
        }

        let angle = Math.PI / 2 * def.angle;
        if (!clockwise) angle *= -1;
        if (isDouble) angle *= 2;

        const axisVector = new THREE.Vector3(
            def.axis === 'x' ? 1 : 0,
            def.axis === 'y' ? 1 : 0,
            def.axis === 'z' ? 1 : 0
        );

        this.moveAnim = {
            active: true,
            startTime: Date.now(),
            duration: 400,
            cubies: this.cubies.filter(def.filter),
            axis: axisVector,
            totalAngle: angle,
            accumulated: 0
        };
    }


    getExpectedCenterColor() {
        if (!this.firstScanDone || !this.currentExpectedFaceId) return null;
        return this.faceColor[this.currentExpectedFaceId];
    }


    setSolution(moves) {
        this.solutionMoves = moves; this.currentMoveIdx = -1;
        this.updateSolutionButtons();
    }

    updateSolutionButtons() {
        const prevBtn = document.getElementById('prevMoveBtn');
        const nextBtn = document.getElementById('nextMoveBtn');
        if (!prevBtn || !nextBtn) return;

        const atStart = this.currentMoveIdx < 0;
        const atEnd = this.solutionMoves.length === 0 || this.currentMoveIdx >= this.solutionMoves.length - 1;
        prevBtn.disabled = atStart;
        nextBtn.disabled = atEnd;
    }


    getSmartRotation(move) {
        let base = move.charAt(0).toUpperCase();
        const HOME_VIEW = { x: 0.4, y: -0.6, z: 0 }; 

        if (['F', 'R', 'U', 'M', 'E', 'S'].includes(base)) return HOME_VIEW;
        if (base === 'B') return { x: 0.4, y: -Math.PI + 0.6, z: 0 };
        if (base === 'L') return { x: 0.4, y: 0.6, z: 0 };
        if (base === 'D') return { x: -0.8, y: -0.6, z: 0 };
        
        return HOME_VIEW;
    }


    shouldRotate(target) {
        const current = this.cubeGroup.rotation;
        const THRESHOLD = 0.2;
        
        return Math.abs(current.x - target.x) > THRESHOLD ||
               Math.abs(current.y - target.y) > THRESHOLD ||
               Math.abs(current.z - target.z) > THRESHOLD;
    }
    

    nextMove() {
        if (this.rotationState.active) {
            this.pendingStepDirection = 1;
            return;
        }
        if (this.moveAnim.active) return;
        if (this.currentMoveIdx >= this.solutionMoves.length - 1) return;

        this.currentMoveIdx++;
        const move = this.solutionMoves[this.currentMoveIdx];
        const smartRot = this.getSmartRotation(move);
        this.updateSolutionButtons();
        
        if (smartRot && this.shouldRotate(smartRot)) {
            this.rotationState.duration = 450;
            this.setTargetRotation(smartRot);
            this.pendingMoveAfterRotate = move;
        } else {
            this.animateMove(move);
        }
    }


    prevMove() {
        if (this.rotationState.active) {
            this.pendingStepDirection = -1;
            return;
        }
        if (this.moveAnim.active || this.currentMoveIdx < 0) return;

        const move = this.solutionMoves[this.currentMoveIdx];
        const inverse = this.invertMove(move);
        const smartRot = this.getSmartRotation(inverse);

        this.currentMoveIdx--;
        this.updateSolutionButtons();

        if (smartRot && this.shouldRotate(smartRot)) {
            this.rotationState.duration = 450;
            this.setTargetRotation(smartRot);
            this.pendingMoveAfterRotate = inverse;
        } else {
            this.animateMove(inverse);
        }
    }


    invertMove(move) {
        if (move.includes("'")) return move.replace("'", "");
        if (move.includes("2")) return move;
        return move + "'";
    }


    rotateLayer(face, clockwise) {
        const filters = {
            'R': c => c.x > 0.1,  'L': c => c.x < -0.1,
            'U': c => c.y > 0.1,  'D': c => c.y < -0.1,
            'F': c => c.z > 0.1,  'B': c => c.z < -0.1
        };
        const axes = {
            'R': new THREE.Vector3(1, 0, 0), 'L': new THREE.Vector3(1, 0, 0),
            'U': new THREE.Vector3(0, 1, 0), 'D': new THREE.Vector3(0, 1, 0),
            'F': new THREE.Vector3(0, 0, 1), 'B': new THREE.Vector3(0, 0, 1)
        };
        const selection = this.cubies.filter(filters[face]);
        const axis = axes[face];
        let angle = Math.PI / 2; 
        if (face === 'R' || face === 'U' || face === 'F') angle *= -1; 
        if (!clockwise) angle *= -1;
        selection.forEach(cubie => {
            cubie.mesh.position.applyAxisAngle(axis, angle);
            cubie.mesh.rotateOnWorldAxis(axis, angle);
            cubie.x = Math.round(cubie.mesh.position.x);
            cubie.y = Math.round(cubie.mesh.position.y);
            cubie.z = Math.round(cubie.mesh.position.z);
        });
    }
}