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
    
    if (x < 5 || y < 5 || x + 5 > mat.cols || y + 5 > mat.rows) return [0,0,0];

    let region = new cv.Rect(x - 5, y - 5, 10, 10);
    let roi = mat.roi(region);
    let mean = cv.mean(roi); // Returns [C1, C2, C3, C4]
    roi.delete(); 

    // Return only the first 3 channels (RGB)
    return [mean[0], mean[1], mean[2]];
}


export function classifyColor(rgb, hsvRanges) {
    let rgbMat = cv.matFromArray(1, 1, cv.CV_8UC3, [rgb[0], rgb[1], rgb[2]]);
    let hsvMat = new cv.Mat();
    cv.cvtColor(rgbMat, hsvMat, cv.COLOR_RGB2HSV);
    
    let h = hsvMat.data[0];
    let s = hsvMat.data[1];
    let v = hsvMat.data[2];

    rgbMat.delete();
    hsvMat.delete();

    // If saturation is very low, classify as white immediately
    const white = hsvRanges['white'];
    if (s <= white.s[1] && v >= white.v[0]) {
        return 'white';
    }

    // check other colors
    for (const [color, range] of Object.entries(hsvRanges)) {
        if (color === 'white') continue;

        const hRanges = Array.isArray(range.h[0]) ? range.h : [range.h];
        
        const hMatch = hRanges.some(r => h >= r[0] && h <= r[1]);
        const sMatch = s >= range.s[0] && s <= range.s[1];
        const vMatch = v >= range.v[0] && v <= range.v[1];

        if (hMatch && sMatch && vMatch) return color;
    }
    
    return null;
}