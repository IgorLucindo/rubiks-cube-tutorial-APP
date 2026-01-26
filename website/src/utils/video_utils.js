export function onOpenCvReady() {
    document.getElementById('status').innerHTML = "OpenCV Ready! Starting Camera...";
    startCamera();
}


function startCamera() {
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(function(stream) {
            video.srcObject = stream;
            video.play();
            
            // Wait for video to be ready before processing
            video.onloadedmetadata = function(e) {
                setTimeout(startProcessing, 500); // Small delay to ensure size is set
            };
        })
        .catch(function(err) {
            document.getElementById('status').innerHTML = "Error: " + err;
        });
}


function startProcessing() {
    document.getElementById('status').innerHTML = "Running... Show your cube!";
    
    // 1. Initialize Objects
    cap = new cv.VideoCapture(video);
    src = new cv.Mat(video.height, video.width, cv.CV_8UC4);
    dst = new cv.Mat(video.height, video.width, cv.CV_8UC4);
    
    // Initialize helpers
    gray = new cv.Mat();
    blurred = new cv.Mat();
    edges = new cv.Mat();
    contours = new cv.MatVector();
    hierarchy = new cv.Mat();
    approx = new cv.Mat();

    // 2. Start the loop
    requestAnimationFrame(processVideo);
}


function processVideo() {
    try {
        if (!src) return; // Stop if objects aren't ready

        // --- BEGIN IMAGE PROCESSING ---
        
        // 1. Read frame from video
        cap.read(src);
        
        // 2. Convert to Gray & Blur (Reduce noise)
        cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
        cv.GaussianBlur(gray, blurred, {width: 5, height: 5}, 0);

        // 3. Canny Edge Detection
        cv.Canny(blurred, edges, 75, 200);

        // 4. Find Contours
        cv.findContours(edges, contours, hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);

        // 5. Filter and Draw
        // We copy src to dst so we draw on the real image, not the black/white edge image
        src.copyTo(dst); 

        for (let i = 0; i < contours.size(); ++i) {
            let cnt = contours.get(i);
            let peri = cv.arcLength(cnt, true);
            
            // Simplify the shape
            cv.approxPolyDP(cnt, approx, 0.02 * peri, true);

            // Filter: Must be square-ish (4 corners), convex, and large enough
            if (approx.rows === 4 && cv.isContourConvex(approx) && cv.contourArea(approx) > 1000) {
                
                // Draw red outline
                cv.drawContours(dst, contours, i, [255, 0, 0, 255], 3);
                
                // Optional: Draw vertices (corners) in Green
                // for(let j=0; j<4; j++) {
                //     cv.circle(dst, {x: approx.data32S[j*2], y: approx.data32S[j*2+1]}, 5, [0, 255, 0, 255], -1);
                // }
            }
        }

        // 6. Show result on Canvas
        cv.imshow('canvasOutput', dst);

        // --- END IMAGE PROCESSING ---

        // Schedule next frame
        requestAnimationFrame(processVideo);

    } catch (err) {
        console.error(err);
    }
}