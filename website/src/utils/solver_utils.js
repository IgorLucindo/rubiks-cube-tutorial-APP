export function getSolverMoves(cubeState) {
    // --- STEP 1: VALIDATION ---
    const validationError = validateState(cubeState);
    if (validationError) {
        console.warn(validationError);
        return { error: validationError };
    }

    // Map internal Face IDs (F, R, U...) to Solver Characters (f, r, u...)
    // Library strictly expects: Front=Green, Up=White
    const typeMap = {
        'F': 'f', 'R': 'r', 'U': 'u', 
        'D': 'd', 'L': 'l', 'B': 'b'
    };
    
    // Library expects order: Front, Right, Up, Down, Left, Back
    const faceOrder = ['F', 'R', 'U', 'D', 'L', 'B'];
    let cubeString = '';

    try {
        faceOrder.forEach(face => {
            const stickers = cubeState[face];
            stickers.forEach(stickerId => {
                cubeString += typeMap[stickerId];
            });
        });

        // Solve
        if (typeof window.rubiksCubeSolver === 'undefined') {
            return { error: "Solver library not loaded. Check internet." };
        }

        // 'partitioned: true' gives us the CFOP stages
        const result = window.rubiksCubeSolver(cubeString, { partitioned: true });
        
        const moves = [
            ...result.cross, 
            ...result.f2l, 
            ...result.oll, 
            ...result.pll
        ];

        return { moves: moves };

    } catch (e) {
        console.error("Solver Logic Crash:", e);
        return { error: "Impossible Cube State. Please rescan." };
    }
}

function validateState(cubeState) {
    const counts = {};
    const colors = ['F', 'R', 'U', 'D', 'L', 'B']; // Using Face IDs as proxy for colors

    // Initialize counts
    colors.forEach(c => counts[c] = 0);

    // Count every sticker
    Object.values(cubeState).forEach(faceStickers => {
        if (!faceStickers) return;
        faceStickers.forEach(s => {
            if (counts[s] !== undefined) counts[s]++;
        });
    });

    // Check if any color has != 9 stickers
    for (const color of colors) {
        if (counts[color] !== 9) {
            const map = {'F':'Green', 'R':'Red', 'U':'White', 'D':'Yellow', 'L':'Orange', 'B':'Blue'};
            return `Scan Error: Found ${counts[color]} ${map[color]} stickers (need 9).`;
        }
    }
    return null; // No errors
}