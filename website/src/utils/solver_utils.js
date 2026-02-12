export function getSolverMoves(cubeState) {
    const validationError = validateState(cubeState);
    if (validationError) {
        console.warn(validationError);
        return { error: validationError };
    }

    const typeMap = { 'F': 'f', 'R': 'r', 'U': 'u', 'D': 'd', 'L': 'l', 'B': 'b' };
    
    // STRICT ORDER: Required by library to avoid crashes
    const faceOrder = ['F', 'R', 'U', 'D', 'L', 'B'];
    let cubeString = '';

    try {
        faceOrder.forEach(face => {
            const stickers = cubeState[face];
            stickers.forEach(stickerId => {
                cubeString += typeMap[stickerId];
            });
        });

        if (typeof window.rubiksCubeSolver === 'undefined') {
            return { error: "Solver library not loaded." };
        }

        // CFOP Mode: Solves White Cross first
        const result = window.rubiksCubeSolver(cubeString, { partitioned: true });
        
        const parts = [result.cross, result.f2l, result.oll, result.pll];
        let allMovesRaw = parts.map(part => {
            if (Array.isArray(part)) return part.join(' ');
            return part || '';
        }).join(' ');

        // Clean up
        const cleaned = allMovesRaw.replace(/prime/g, "'").replace(/\s+/g, ' ');
        const tokens = cleaned.split(' ').filter(m => m.trim().length > 0);
        
        const moves = [];
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if ((token === "'" || token === "2") && moves.length > 0) {
                moves[moves.length - 1] += token;
            } else {
                moves.push(token);
            }
        }

        return { moves: moves };

    } catch (e) {
        console.error("Solver Logic Crash:", e);
        return { error: "Impossible Cube State." };
    }
}


function validateState(cubeState) {
    const counts = {};
    const colors = ['F', 'R', 'U', 'D', 'L', 'B'];
    colors.forEach(c => counts[c] = 0);
    Object.values(cubeState).forEach(faceStickers => {
        if (!faceStickers) return;
        faceStickers.forEach(s => { if (counts[s] !== undefined) counts[s]++; });
    });
    for (const color of colors) {
        if (counts[color] !== 9) return `Scan Error: Invalid sticker count for ${color}`;
    }
    return null;
}