import { getSolverMoves } from "../utils/solver_utils.js";


export class VirtualCube {
    constructor() {
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

        this.opposites = {
            'green': 'blue', 'blue': 'green',
            'red': 'orange', 'orange': 'red',
            'white': 'yellow', 'yellow': 'white'
        };
        this.standardRight = {
            'green': 'orange',
            'orange': 'blue',
            'blue': 'red',
            'red': 'green'
        };

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

        // Scanning State
        this.isScanning = true;
        this.nextMoveTimeout = null;
        this.firstScanDone = false;
        this.currentExpectedFaceId = null;
        this.lastScannedFaceId = 'F'; 
        this.currentScanRotation = 0; 
        this.orientationLocked = false;
        
        this.scanOrder = [];
        this.solutionMoves = [];
        this.currentMoveIdx = -1;
        this.isSolvedMode = false;

        // Three.js State
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.cubeGroup = null;
        this.cubies = [];

        this.initThreeJS();
        this.initMouseControls();
        window.addEventListener('resize', () => this.handleResize());
    }


    initThreeJS() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
        this.camera.position.set(0, 0, 9); 

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


    initMouseControls() {
        this.container.addEventListener('mousedown', (e) => {
            this.dragState.active = true;
            this.dragState.previous = { x: e.clientX, y: e.clientY };
            
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
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.dragState.active) return;
            const deltaX = e.clientX - this.dragState.previous.x;
            const deltaY = e.clientY - this.dragState.previous.y;
            this.cubeGroup.rotation.y += deltaX * this.dragState.sensitivity;
            this.cubeGroup.rotation.x += deltaY * this.dragState.sensitivity;
            this.dragState.previous = { x: e.clientX, y: e.clientY };
        });

        window.addEventListener('mouseup', () => {
            if (this.dragState.active) {
                this.dragState.active = false;
                document.body.classList.remove('grabbing');
                if (this.dragState.startRotation) {
                    this.rotationState.duration = 1000;
                    this.setTargetRotation(this.dragState.startRotation);
                }
            }
        });
    }


    _rotateGrid(grid, rotations) {
        const times = (rotations % 4 + 4) % 4; 
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


    loop(faceColors) {
        this.animateScale();
        this.animateRotation();
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
                this.fillAllCenters();
                const targetRot = this.getRotationForFace(faceId);
                this.cubeGroup.rotation.set(targetRot.x, targetRot.y, targetRot.z);
                this.currentExpectedFaceId = faceId;
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

        const TRANSITION_ROTATIONS = {
            'U': { 'F': 0, 'R': 1, 'B': 2, 'L': 3 },
            'D': { 'F': 0, 'R': 3, 'B': 2, 'L': 1 }
        };

        if (this.scanOrder.length === 0) {
            const scannedFaces = Object.keys(this.cubeState).filter(k => this.cubeState[k] !== null);
            const startFace = scannedFaces[0] || 'F';
            const ring = ['F', 'R', 'B', 'L'];
            if (ring.includes(startFace)) {
                const idx = ring.indexOf(startFace);
                for (let i = 1; i <= 3; i++) this.scanOrder.push(ring[(idx + i) % 4]);
                this.scanOrder.push('U', 'D');
            } else {
                this.scanOrder = ['F', 'R', 'B', 'L', 'U', 'D'].filter(f => f !== startFace);
            }
        }

        let next = this.scanOrder.find(f => missing.includes(f)) || missing[0];
        const prev = this.lastScannedFaceId || 'F';

        const zRoll = TRANSITION_ROTATIONS[next]?.[prev] ?? 0;
        this.currentScanRotation = zRoll;
        this.currentExpectedFaceId = next;

        let target = { x: 0, y: 0, z: 0 };

        if (next === 'U') {
            target.x = Math.PI / 2;
            target.y = this.cubeGroup.rotation.y; 
            target.z = 0; 
        } 
        else if (next === 'D') {
             target.x = -Math.PI / 2;
             target.y = this.cubeGroup.rotation.y;
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

        if (!this.orientationLocked) {
            this.colorFace[centerColor] = 'F';
            const rightColor = this.standardRight[centerColor];
            if (rightColor) {
                this.colorFace[rightColor] = 'R';
                const backColor = this.opposites[centerColor];
                const leftColor = this.opposites[rightColor];
                this.colorFace[backColor] = 'B';
                this.colorFace[leftColor] = 'L';
            }
            this.orientationLocked = true;
            this.faceColor = Object.fromEntries(Object.entries(this.colorFace).map(([k, v]) => [v, k]));
        }

        const normalizedColors = this._rotateGrid(faceColors, -this.currentScanRotation);
        const stickers = normalizedColors.map(color => this.colorFace[color]);
        const faceId = stickers[4];
        this.cubeState[faceId] = stickers;
        this.lastScannedFaceId = faceId;
        return faceId;
    }

    update3DColors(faceId, colors) {
        const faceMap = {
            'F': { axis: 'z', val: 1 },  'B': { axis: 'z', val: -1 },
            'U': { axis: 'y', val: 1 },  'D': { axis: 'y', val: -1 },
            'R': { axis: 'x', val: 1 },  'L': { axis: 'x', val: -1 }
        };
        const matIdxMap = { 'R': 0, 'L': 1, 'U': 2, 'D': 3, 'F': 4, 'B': 5 };

        const target = faceMap[faceId];
        const matIndex = matIdxMap[faceId];
        if (!target) return;

        let faceCubies = this.cubies.filter(c => c[target.axis] === target.val);
        
        faceCubies.sort((a, b) => {
            if (['F', 'B', 'L', 'R'].includes(faceId)) {
                if (Math.abs(b.y - a.y) > 0.1) return b.y - a.y; 
            }
            else if (faceId === 'U') {
                if (Math.abs(a.z - b.z) > 0.1) return a.z - b.z;
            }
            else if (faceId === 'D') {
                if (Math.abs(a.x - b.x) > 0.1) return a.x - b.x;
                return b.z - a.z;
            }
            switch (faceId) {
                case 'F': return a.x - b.x; 
                case 'B': return b.x - a.x; 
                case 'R': return b.z - a.z; 
                case 'L': return a.z - b.z; 
                case 'U': return a.x - b.x; 
                case 'D': return 0;
                default: return 0;
            }
        });

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
        } else {
            const status = document.getElementById('status');
            if (status) status.innerHTML = moves?.error || "Solver Error.";
        }
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
        if (progress === 1) this.rotationState.active = false;
    }


    setTargetRotation(target) {
        this.rotationState.start = { x: this.cubeGroup.rotation.x, y: this.cubeGroup.rotation.y, z: this.cubeGroup.rotation.z };
        this.rotationState.end = target;
        this.rotationState.startTime = Date.now();
        this.rotationState.active = true;
    }


    getExpectedCenterColor() {
        if (!this.firstScanDone || !this.currentExpectedFaceId) return null;
        return this.faceColor[this.currentExpectedFaceId];
    }


    setSolution(moves) { this.solutionMoves = moves; this.currentMoveIdx = -1; }
    

    nextMove() {
        if (this.currentMoveIdx >= this.solutionMoves.length - 1) return null;
        this.currentMoveIdx++;
        const move = this.solutionMoves[this.currentMoveIdx];
        this.performMove(move);
        return move;
    }


    prevMove() {
        if (this.currentMoveIdx < 0) return null;
        const move = this.solutionMoves[this.currentMoveIdx];
        this.currentMoveIdx--;
        this.performMove(this.invertMove(move));
        return this.solutionMoves[this.currentMoveIdx] || "Start";
    }


    invertMove(move) {
        if (move.includes("'")) return move.replace("'", "");
        if (move.includes("2")) return move;
        return move + "'";
    }


    performMove(move) {
        let face = move[0];
        let modifier = move.substring(1);
        let times = modifier === "2" ? 2 : 1;
        let clockwise = modifier !== "'";
        for (let i = 0; i < times; i++) this.rotateLayer(face, clockwise);
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