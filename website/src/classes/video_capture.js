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


    applyContrast(mat, alpha, beta) {
        // alpha: Contrast control (1.0-3.0)
        // beta: Brightness control (0-100)
        mat.convertTo(mat, -1, alpha, beta);
    }


    adjustBrightness(mat) {
        let mean = cv.mean(mat);
        let brightness = mean[0]; 

        // Default (Good Lighting)
        let contrastParams = { alpha: 1.0, beta: 0 };
        let adaptiveC = 2; 

        if (brightness < 100) {
            // Tier 1: Dim Room
            contrastParams.alpha = 1.5; 
            contrastParams.beta = 20;
            adaptiveC = 0;
        }
        else if (brightness < 50) {
            // Tier 2: Dark Room
            contrastParams.alpha = 2.5;
            contrastParams.beta = 50;
            adaptiveC = -2; 
        }

        // Apply the chosen parameters
        if (contrastParams.alpha !== 1.0) {
            this.applyContrast(mat, contrastParams.alpha, contrastParams.beta);
        }

        return adaptiveC
    }


    processLoop() {
        if (!this.isRunning) return;

        try {
            // Capture Frame
            this.cap.read(this.src);

            // Pre-process
            cv.cvtColor(this.src, this.gray, cv.COLOR_RGBA2GRAY);
            
            // Adjust brightness levels
            let adaptiveC = this.adjustBrightness(this.gray);

            // Blur (Noise Reduction)
            cv.GaussianBlur(this.gray, this.blurred, {width: 9, height: 9}, 0);

            // Adaptive Threshold with DYNAMIC 'C' value
            cv.adaptiveThreshold(this.blurred, this.edges, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, adaptiveC);

            // Find Contours
            cv.findContours(this.edges, this.contours, this.hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);

            // Draw on output
            this.src.copyTo(this.dst);

            for (let i = 0; i < this.contours.size(); ++i) {
                let cnt = this.contours.get(i);
                let area = cv.contourArea(cnt);

                if (area < 1000) continue;

                let peri = cv.arcLength(cnt, true);
                cv.approxPolyDP(cnt, this.approx, 0.05 * peri, true); 

                let rect = cv.boundingRect(this.approx);
                let aspectRatio = rect.width / rect.height;

                if (cv.isContourConvex(this.approx) && 
                    this.approx.rows >= 4 && this.approx.rows <= 8 &&
                    aspectRatio > 0.8 && aspectRatio < 1.2) {
                    
                    // Draw contour in Green
                    cv.drawContours(this.dst, this.contours, i, [0, 255, 0, 255], 3);
                }
            }

            // 7. Display
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