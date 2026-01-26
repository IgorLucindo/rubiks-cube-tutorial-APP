export class VirtualCube {
    constructor() {
        this.cubeState = {
            U: null,
            D: null,
            F: null,
            B: null,
            L: null,
            R: null
        };

        this.colorFace = {
            'white': 'U',
            'yellow': 'D',
            'green': 'F',
            'blue': 'B',
            'orange': 'L',
            'red': 'R'
        }

        this.scan_delay = 1000;

        this.solutionMoves = [];
        this.currentMoveIndex = -1;
        this.lastScanTime = 0;
    }


    reset() {
        Object.keys(this.cubeState).forEach(k => this.cubeState[k] = null);
        this.solutionMoves = [];
        this.currentMoveIndex = -1;
    }


    loop(faceColors) {
        if (faceColors) {
            const now = Date.now();
            
            // Simple debounce: Don't spam the VirtualCube every 16ms
            if (now - this.lastScanTime > this.scan_delay) {
                
                // Pass the RGB colors to VirtualCube to classify and store
                const faceId = this.addFace(faceColors);

                if (faceId) {
                    console.log(`Captured Face: ${faceId}`);
                    console.log("Missing Faces:", this.getMissingFaces());
                    this.lastScanTime = now;
                    
                    if (this.isComplete()) {
                        console.log("CUBE COMPLETE! Stopping Scan.");
                        // Optional: Switch mode to 'SOLVING' here
                    }
                }
            }
        }
    }

    
    addFace(faceColors) {
        // Convert colors to sticker notation
        const stickers = faceColors.map(color => this.colorFace[color]);

        // Identify face id
        const faceId = stickers[4];

        // Save to state
        this.cubeState[faceId] = stickers;

        return faceId;
    }

    
    getMissingFaces() {
        return Object.keys(this.cubeState).filter(key => this.cubeState[key] === null);
    }


    isComplete() {
        return this.getMissingFaces().length === 0;
    }

    
    getSolverString() {
        if (!this.isComplete()) return null;

        // Note: The order depends on the specific solver library you choose.
        // This is a standard order (URFDLB).
        const order = ['U', 'R', 'F', 'D', 'L', 'B'];
        let str = "";
        
        order.forEach(face => {
            str += this.cubeState[face].join("");
        });

        return str;
    }


    setSolution(moves) {
        this.solutionMoves = moves;
        this.currentMoveIndex = -1;
    }


    nextMove() {
        if (this.currentMoveIndex < this.solutionMoves.length - 1) {
            this.currentMoveIndex++;
            return this.solutionMoves[this.currentMoveIndex];
        }
        return null;
    }

    
    prevMove() {
        if (this.currentMoveIndex >= 0) {
            const move = this.solutionMoves[this.currentMoveIndex];
            this.currentMoveIndex--;
            return move; 
        }
        return null; // At start
    }
}