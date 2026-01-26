export function applyContrast(mat, alpha, beta) {
    // alpha: Contrast control (1.0-3.0)
    // beta: Brightness control (0-100)
    mat.convertTo(mat, -1, alpha, beta);
}


export function sortGridByPosition(rects) {
    // Sort by Vertical Position (Y)
    rects.sort((a, b) => a.cy - b.cy);

    // Slice into 3 rows and sort each row by Horizontal Position (X)
    const row1 = rects.slice(0, 3).sort((a, b) => a.cx - b.cx);
    const row2 = rects.slice(3, 6).sort((a, b) => a.cx - b.cx);
    const row3 = rects.slice(6, 9).sort((a, b) => a.cx - b.cx);

    return [...row1, ...row2, ...row3];
}


export function getAverageColor(mat, rect) {
    const x = rect.cx;
    const y = rect.cy;

    // Create a 10x10 sample area around the center
    let region = new cv.Rect(x - 5, y - 5, 10, 10);
    
    // Safety check to avoid crashing if the box is on the edge of the screen
    if (x < 5 || y < 5 || x + 5 > mat.cols || y + 5 > mat.rows) return [0,0,0];

    let roi = mat.roi(region);
    let mean = cv.mean(roi); // Returns [R, G, B, Alpha]
    roi.delete(); 

    return [mean[0], mean[1], mean[2]];
}


export function classifyColor(rgb) {
    const palette = {
        'white': [255, 255, 255],
        'yellow': [255, 255, 0],
        'green': [0, 255, 0],
        'blue': [0, 0, 255],
        'orange': [255, 165, 0],
        'red': [255, 0, 0]
    };

    let minDistance = Infinity;
    let bestMatch = null;

    for (const [code, refRGB] of Object.entries(palette)) {
        // Euclidean Distance
        const dist = Math.sqrt(
            Math.pow(rgb[0] - refRGB[0], 2) +
            Math.pow(rgb[1] - refRGB[1], 2) +
            Math.pow(rgb[2] - refRGB[2], 2)
        );

        if (dist < minDistance) {
            minDistance = dist;
            bestMatch = code;
        }
    }
    return bestMatch;
}