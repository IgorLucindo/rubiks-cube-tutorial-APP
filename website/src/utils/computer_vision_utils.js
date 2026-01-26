export function applyContrast(mat, alpha, beta) {
    // alpha: Contrast control (1.0-3.0)
    // beta: Brightness control (0-100)
    mat.convertTo(mat, -1, alpha, beta);
}


export function applySmartBrightness(mat) {
    let mean = cv.mean(mat);
    let brightness = mean[0]; 

    // Default (Good Lighting)
    let alpha = 1.0; 
    let beta = 0;
    let adaptiveC = 2; 

    // Tier 1: Dim Room
    if (brightness < 100) {
        alpha = 1.5; 
        beta = 20;
        adaptiveC = 0;
    }
    
    // Tier 2: Dark Room
    if (brightness < 50) {
        alpha = 2.5; 
        beta = 50;
        adaptiveC = -2; 
    }

    // Apply the chosen parameters
    if (alpha !== 1.0) mat.convertTo(mat, -1, alpha, beta);

    return adaptiveC
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


export function getAverageColor(mat, x, y) {
    // Create a 10x10 sample area around the center
    let region = new cv.Rect(x - 5, y - 5, 10, 10);
    
    // Safety check to avoid crashing if the box is on the edge of the screen
    if (x < 5 || y < 5 || x + 5 > mat.cols || y + 5 > mat.rows) return [0,0,0];

    let roi = mat.roi(region);
    let mean = cv.mean(roi); // Returns [R, G, B, Alpha]
    roi.delete(); 

    return [mean[0], mean[1], mean[2]];
}