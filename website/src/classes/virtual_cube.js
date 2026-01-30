export class VirtualCube {
    constructor() {
        this.cubeState = { U: null, D: null, F: null, B: null, L: null, R: null };
        this.colorFace = {
            'white': 'U', 'yellow': 'D', 'green': 'F', 
            'blue': 'B', 'orange': 'L', 'red': 'R'
        };

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
            start: { x: 0, y: 0, z: 0 },
            end: { x: 0, y: 0, z: 0 },
            delayBeforeNext: 1200
        };
        
        this.scan_delay = 1000;
        this.lastScanTime = 0;
        this.isScanning = true;
        this.nextMoveTimeout = null;

        // --- 3D RENDERER STATE ---
        this.container = document.getElementById('threeContainer');
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.cubeGroup = null;
        this.cubies = [];

        this.initThreeJS();
        
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

        for (let x = -1; x <= 1; x++) {
            for (let y = -1; y <= 1; y++) {
                for (let z = -1; z <= 1; z++) {
                    // Create array of 6 independent materials for this cubie
                    const materials = [];
                    for (let i = 0; i < 6; i++) {
                        materials.push(baseMaterial.clone());
                    }

                    const mesh = new THREE.Mesh(geometry, materials);
                    mesh.position.set(x, y, z);
                    
                    const edges = new THREE.EdgesGeometry(geometry);
                    const line = new THREE.LineSegments(edges, outlineMaterial);
                    mesh.add(line);
                    
                    this.cubeGroup.add(mesh);
                    this.cubies.push({ mesh, x, y, z });
                }
            }
        }

        // Start showing Back face (or any default)
        this.cubeGroup.rotation.y = Math.PI;

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

    
    loop(faceColors) {
        this.animateScale();
        this.animateRotation();
        this.renderer.render(this.scene, this.camera);

        if (!faceColors || !this.isScanning) return;

        const now = Date.now();
        if (now - this.lastScanTime > this.scan_delay) {
            const faceId = this.addFace(faceColors);
            if (faceId) {
                this.lastScanTime = now;
                this.update3DColors(faceId, faceColors);

                // Trigger animation
                this.scaleState.active = true;
                this.scaleState.startTime = Date.now();
                this.rotationState.duration = 800;
                this.setTargetRotation(this.getRotationForFace(faceId));

                if (this.isComplete()) {
                    console.log("CUBE COMPLETE!");
                } else {
                    // Wait for the pulse/confirmation before moving
                    if (this.nextMoveTimeout) clearTimeout(this.nextMoveTimeout);
                    
                    this.nextMoveTimeout = setTimeout(() => {
                        this.rotationState.duration = 1500;
                        this.guideToNextFace();
                    }, this.rotationState.delayBeforeNext); 
                }
            }
        }
    }


    animateScale() {
        if (!this.scaleState.active) return;

        const elapsed = Date.now() - this.scaleState.startTime;
        const progress = Math.min(elapsed / this.scaleState.duration, 1);

        // Sine wave for a smooth "up and down" pulse
        // Math.sin goes from 0 to 1 back to 0 over PI
        const pulse = Math.sin(progress * Math.PI);
        const currentScale = this.scaleState.baseScale + (pulse * (this.scaleState.maxScale - this.scaleState.baseScale));
        
        this.cubeGroup.scale.set(currentScale, currentScale, currentScale);

        if (progress === 1) {
            this.scaleState.active = false;
            this.cubeGroup.scale.set(1, 1, 1);
        }
    }


    animateRotation() {
        if (!this.rotationState.active) return;

        const elapsed = Date.now() - this.rotationState.startTime;
        const progress = Math.min(elapsed / this.rotationState.duration, 1);

        // Ease-out cubic function for a smooth finish
        const ease = 1 - Math.pow(1 - progress, 3);

        this.cubeGroup.rotation.x = this.rotationState.start.x + (this.rotationState.end.x - this.rotationState.start.x) * ease;
        this.cubeGroup.rotation.y = this.rotationState.start.y + (this.rotationState.end.y - this.rotationState.start.y) * ease;
        this.cubeGroup.rotation.z = this.rotationState.start.z + (this.rotationState.end.z - this.rotationState.start.z) * ease;

        if (progress === 1) {
            this.rotationState.active = false;
        }
    }


    setTargetRotation(target) {
        this.rotationState.start = {
            x: this.cubeGroup.rotation.x,
            y: this.cubeGroup.rotation.y,
            z: this.cubeGroup.rotation.z
        };
        this.rotationState.end = target;
        this.rotationState.startTime = Date.now();
        this.rotationState.active = true;
    }


    guideToNextFace() {
        const missing = this.getMissingFaces();
        if (missing.length === 0) return;

        // Suggested scanning order
        const order = ['B', 'R', 'F', 'L', 'U', 'D'];
        const next = order.find(f => missing.includes(f));
        if (!next) return;

        const target = this.getRotationForFace(next);
        this.rotationState.duration = 1200; 
        this.setTargetRotation(target);
    }
    

    addFace(faceColors) {
        const stickers = faceColors.map(color => this.colorFace[color]);
        const faceId = stickers[4]; 
        this.cubeState[faceId] = stickers;
        return faceId;
    }


    update3DColors(faceId, colors) {
        const faceMap = {
            'F': { axis: 'z', val: 1 },
            'B': { axis: 'z', val: -1 },
            'U': { axis: 'y', val: 1 },
            'D': { axis: 'y', val: -1 },
            'R': { axis: 'x', val: 1 },
            'L': { axis: 'x', val: -1 }
        };

        const materialIndexMap = {
            'R': 0, 'L': 1, 'U': 2, 'D': 3, 'F': 4, 'B': 5
        };

        const target = faceMap[faceId];
        const matIndex = materialIndexMap[faceId];

        if (!target || matIndex === undefined) return;

        let faceCubies = this.cubies.filter(c => c[target.axis] === target.val);
        
        faceCubies.sort((a, b) => {
            if (Math.abs(b.y - a.y) > 0.1) return b.y - a.y; 
            if (faceId === 'B') return b.x - a.x; 
            return a.x - b.x; 
        });

        faceCubies.forEach((cubie, i) => {
            const hex = this.getHexColor(colors[i]);
            cubie.mesh.material[matIndex].color.setHex(hex);
            cubie.mesh.material[matIndex].opacity = 1.0; 
        });
    }


    // Helper to get standard viewing rotation for a specific face
    getRotationForFace(faceId) {
        switch (faceId) {
            case 'F': return { x: 0, y: 0, z: 0 }; 
            case 'B': return { x: 0, y: Math.PI, z: 0 }; 
            case 'R': return { x: 0, y: -Math.PI/2, z: 0 }; 
            case 'L': return { x: 0, y: Math.PI/2, z: 0 }; 
            case 'U': return { x: Math.PI/2, y: 0, z: 0 }; 
            case 'D': return { x: -Math.PI/2, y: 0, z: 0 }; 
        }
        return { x: 0, y: 0, z: 0 };
    }


    getHexColor(name) {
        const palette = {
            'white': 0xffffff, 'yellow': 0xffff00,
            'green': 0x00aa00, 'blue': 0x0000ff,
            'orange': 0xffa500, 'red': 0xff0000
        };
        return palette[name] || 0x555555;
    }


    getMissingFaces() {
        return Object.keys(this.cubeState).filter(key => this.cubeState[key] === null);
    }

    
    isComplete() {
        return this.getMissingFaces().length === 0;
    }
}