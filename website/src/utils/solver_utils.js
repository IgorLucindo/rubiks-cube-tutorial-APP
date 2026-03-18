function adjustCubeState(cubeState) {
    function rotate180(arr) {
        if (!arr) return null;
        return [arr[8], arr[7], arr[6], arr[5], arr[4], arr[3], arr[2], arr[1], arr[0]];
    }

    function mapStickerZ2(s) {
        const map = { 'U': 'D', 'D': 'U', 'R': 'L', 'L': 'R', 'F': 'F', 'B': 'B' };
        return map[s] || s;
    }

    const adjustedCubeState = {
        'U': rotate180(cubeState['D']).map(mapStickerZ2),
        'D': rotate180(cubeState['U']).map(mapStickerZ2),
        'F': rotate180(cubeState['F']).map(mapStickerZ2),
        'B': rotate180(cubeState['B']).map(mapStickerZ2),
        'L': rotate180(cubeState['R']).map(mapStickerZ2),
        'R': rotate180(cubeState['L']).map(mapStickerZ2)
    };
    return adjustedCubeState;
}


export function getSolverMoves(cubeState) {
    const validationError = validateState(cubeState);
    if (validationError) {
        console.warn(validationError);
        return { error: validationError };
    }

    const typeMap = { 'F': 'f', 'R': 'r', 'U': 'u', 'D': 'd', 'L': 'l', 'B': 'b' };
    const adjustedCubeState = adjustCubeState(cubeState);

    // STRICT ORDER: Required by library to avoid crashes
    const faceOrder = ['F', 'R', 'U', 'D', 'L', 'B'];
    let cubeString = '';

    try {
        faceOrder.forEach(face => {
            const stickers = adjustedCubeState[face];
            stickers.forEach(stickerId => {
                cubeString += typeMap[stickerId];
            });
        });

        if (typeof window.rubiksCubeSolver === 'undefined') {
            return { error: "Solver library not loaded." };
        }

        // CFOP Mode: Solves the U face first (which is White in our rotated state)
        const result = window.rubiksCubeSolver(cubeString, { partitioned: true });
        
        if (!result || !result.cross) {
            return { error: "Impossible Cube State." };
        }

        const parts = [result.cross, result.f2l, result.oll, result.pll];
        let allMovesRaw = parts.map(part => {
            if (Array.isArray(part)) return part.join(' ');
            return part || '';
        }).join(' ');

        // Clean up
        const cleaned = allMovesRaw.replace(/prime/g, "'").replace(/\s+/g, ' ');
        const tokens = cleaned.split(' ').filter(m => m.trim().length > 0);
        
        // Map moves back to the original cube using the same z2 rotation mapping
        const moveMap = {
            'U': 'D', 'D': 'U',
            'F': 'F', 'B': 'B',
            'L': 'R', 'R': 'L',
            'u': 'd', 'd': 'u',
            'f': 'f', 'b': 'b',
            'l': 'r', 'r': 'l'
        };

        const moves = [];
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            
            // Map the base move
            const baseMove = token.charAt(0);
            const mappedBase = moveMap[baseMove] || baseMove;
            const mappedToken = mappedBase + token.substring(1);

            if ((mappedToken === "'" || mappedToken === "2") && moves.length > 0) {
                moves[moves.length - 1] += mappedToken;
            } else {
                moves.push(mappedToken);
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