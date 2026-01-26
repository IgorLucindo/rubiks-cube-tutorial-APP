import { applySmartBrightness, sortGridByPosition, getAverageColor} from "./utils/computer_vision_utils.js";


export class VideoCapture {
    constructor(videoId, canvasId) {
        this.video = document.getElementById(videoId);
        this.canvasId = canvasId;
        
        // State flags
        this.isRunning = false;

        // OpenCV Objects (Initialize as null)
        this.cap = null;
        this.src = null;
        this.dst = null;
        
        // Processing Helpers
        this.gray = null;
        this.blurred = null;
        this.edges = null;
        this.contours = null;
        this.hierarchy = null;
        this.approx = null;

        // Bind the processing loop to 'this' context
        this.processLoop = this.processLoop.bind(this);
    }


    start() {
        document.getElementById('status').innerHTML = "Requesting Camera Access...";
        
        navigator.mediaDevices.getUserMedia({ video: true, audio: false })
            .then((stream) => {
                this.video.srcObject = stream;
                this.video.play();
                
                // Initialize OpenCV objects once video metadata (dimensions) is loaded
                this.video.onloadedmetadata = () => {
                    this.initOpenCvObjects();
                    this.isRunning = true;
                    this.processLoop();
                };
            })
            .catch((err) => {
                console.error("Camera Error:", err);
                document.getElementById('status').innerHTML = "Error: " + err;
            });
    }


    initOpenCvObjects() {
        const width = this.video.videoWidth;
        const height = this.video.videoHeight;

        // Core Mats
        this.cap = new cv.VideoCapture(this.video);
        this.src = new cv.Mat(height, width, cv.CV_8UC4);
        this.dst = new cv.Mat(height, width, cv.CV_8UC4);

        // Helpers
        this.gray = new cv.Mat();
        this.blurred = new cv.Mat();
        this.edges = new cv.Mat();
        this.contours = new cv.MatVector();
        this.hierarchy = new cv.Mat();
        this.approx = new cv.Mat();

        document.getElementById('status').innerHTML = "Running... Show your cube!";
    }


    drawCubeOverlay(candidateRects) {
        if (candidateRects.length === 9) {
            // Sort them into the correct 3x3 Grid
            let sortedRects = sortGridByPosition(candidateRects);

            // Visual Feedback (Green for Success)
            sortedRects.forEach((rect, index) => {
                let pt1 = new cv.Point(rect.x, rect.y);
                let pt2 = new cv.Point(rect.x + rect.w, rect.y + rect.h);
                
                // Draw Green Box
                cv.rectangle(this.dst, pt1, pt2, [0, 255, 0, 255], 3);

                // Draw Index Number (0-8)
                cv.putText(this.dst, "" + index, {x: rect.cx - 10, y: rect.cy + 10}, 
                           cv.FONT_HERSHEY_SIMPLEX, 0.8, [255, 255, 255, 255], 2);
            });
            
            // Return the sorted data so processLoop can use it for color sampling!
            return sortedRects;

        } else {
            // Fallback: Yellow boxes (Searching...)
            candidateRects.forEach(rect => {
                let pt1 = new cv.Point(rect.x, rect.y);
                let pt2 = new cv.Point(rect.x + rect.w, rect.y + rect.h);
                cv.rectangle(this.dst, pt1, pt2, [0, 255, 255, 255], 2); 
            });
            
            return null;
        }
    }


    processLoop() {
        if (!this.isRunning) return;

        try {
            // Capture Frame
            this.cap.read(this.src);

            // Pre-process
            cv.cvtColor(this.src, this.gray, cv.COLOR_RGBA2GRAY);
            
            // Adjust brightness levels
            let adaptiveC = applySmartBrightness(this.gray);

            // Blur & Threshold
            cv.GaussianBlur(this.gray, this.blurred, {width: 9, height: 9}, 0);
            cv.adaptiveThreshold(this.blurred, this.edges, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, adaptiveC);

            // Find Contours
            cv.findContours(this.edges, this.contours, this.hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);

            // Draw on output
            this.src.copyTo(this.dst);

            let candidateRects = [];
            for (let i = 0; i < this.contours.size(); ++i) {
                let cnt = this.contours.get(i);
                let area = cv.contourArea(cnt);

                if (area < 1000) continue;

                let peri = cv.arcLength(cnt, true);
                cv.approxPolyDP(cnt, this.approx, 0.05 * peri, true); 

                let rect = cv.boundingRect(this.approx);
                let aspectRatio = rect.width / rect.height;

                // Robust Checks: Convex + 4-8 corners + Square-ish shape
                if (cv.isContourConvex(this.approx) && 
                    this.approx.rows >= 4 && this.approx.rows <= 8 &&
                    aspectRatio > 0.8 && aspectRatio < 1.2) {
                    
                    // Store valid candidate
                    candidateRects.push({
                        x: rect.x,
                        y: rect.y,
                        w: rect.width,
                        h: rect.height,
                        cx: rect.x + rect.width / 2, // Center X
                        cy: rect.y + rect.height / 2, // Center Y
                        cnt: cnt // Keep reference to draw later
                    });
                }
            }

            // draw and return the sorted grid
            let validGrid = this.drawCubeOverlay(candidateRects);

            if (validGrid) {
                // SUCCESS! 'validGrid' contains the 9 sorted rects.
                // We are now ready to extract colors.
                
                // Example usage for next step:
                // let faceColors = this.scanFaceColors(validGrid);
                // console.log("Scanned Face:", faceColors);
            }

            // Display
            cv.imshow(this.canvasId, this.dst);

            requestAnimationFrame(this.processLoop);

        } catch (err) {
            console.error("OpenCV Error:", err);
            this.isRunning = false;
        }
    }


    stop() {
        this.isRunning = false;
        // Cleanup memory
        if (this.src) this.src.delete();
        if (this.dst) this.dst.delete();
        if (this.gray) this.gray.delete();
        if (this.blurred) this.blurred.delete();
        if (this.edges) this.edges.delete();
        if (this.contours) this.contours.delete();
        if (this.hierarchy) this.hierarchy.delete();
        if (this.approx) this.approx.delete();
    }
}