import { sortGridByPosition, getAverageColor, classifyColor } from "../utils/computer_vision_utils.js";


export class VideoCapture {
    constructor(videoId, canvasId) {
        this.video = document.getElementById(videoId);
        this.canvasId = canvasId;

        // OpenCV objects
        this.cap = null;
        this.src = null;
        this.dst = null;
        this.gray = null;
        this.blurred = null;
        this.edges = null;
        this.contours = null;
        this.hierarchy = null;
        this.approx = null;
        this.clahe = null;

        this.isReady = false;
    }


    start() {
        return new Promise((resolve, reject) => {
            navigator.mediaDevices.getUserMedia({ video: true, audio: false })
                .then((stream) => {
                    this.video.srcObject = stream;
                    this.video.play();
                    
                    this.video.onloadedmetadata = () => {
                        this.initOpenCvObjects();
                        this.isReady = true;
                        resolve();
                    };
                })
                .catch(reject);
        });
    }


    initOpenCvObjects() {
        const width = this.video.videoWidth;
        const height = this.video.videoHeight;

        // Core Mats
        this.cap = new cv.VideoCapture(this.video);
        this.src = new cv.Mat(height, width, cv.CV_8UC4);
        this.dst = new cv.Mat(height, width, cv.CV_8UC4);
        this.clahe = new cv.CLAHE(40.0, new cv.Size(8, 8));

        // Helpers
        this.gray = new cv.Mat();
        this.blurred = new cv.Mat();
        this.edges = new cv.Mat();
        this.contours = new cv.MatVector();
        this.hierarchy = new cv.Mat();
        this.approx = new cv.Mat();
    }


    loop() {
        if (!this.isReady) return null;

        try {
            // Read and Preprocess
            this.cap.read(this.src);
            cv.cvtColor(this.src, this.gray, cv.COLOR_RGBA2GRAY);
            this.clahe.apply(this.gray, this.gray);
            cv.GaussianBlur(this.gray, this.blurred, {width: 9, height: 9}, 0);
            cv.adaptiveThreshold(this.blurred, this.edges, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);

            // Find contours
            cv.findContours(this.edges, this.contours, this.hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);

            // Find and filter candidates rects
            let candidateRects = this.findCandidateRects();
            candidateRects = this.filterRects(candidateRects);

            let faceColors = null;
            
            // If found a valid face
            if (candidateRects.length === 9) {
                let faceRects = sortGridByPosition(candidateRects);
                let rawColors = this.scanFaceColors(faceRects);
                faceColors = rawColors.map(color => classifyColor(color));
            }

            // Display
            cv.imshow(this.canvasId, this.dst);

            return faceColors;

        } catch (err) {
            console.error("OpenCV processing error:", err);
            return null;
        }
    }


    findCandidateRects() {
        this.src.copyTo(this.dst);

        const totalFrameArea = this.src.cols * this.src.rows;
        const maxAllowedArea = totalFrameArea / 12;

        let candidateRects = [];

        for (let i = 0; i < this.contours.size(); ++i) {
            let cnt = this.contours.get(i);
            let area = cv.contourArea(cnt);
            if (area < 1000 || area > maxAllowedArea) continue;

            let peri = cv.arcLength(cnt, true);
            cv.approxPolyDP(cnt, this.approx, 0.05 * peri, true); 
            let rect = cv.boundingRect(this.approx);
            let aspectRatio = rect.width / rect.height;

            if (cv.isContourConvex(this.approx) && 
                this.approx.rows >= 4 && this.approx.rows <= 8 &&
                aspectRatio > 0.8 && aspectRatio < 1.2) {
                
                candidateRects.push({
                    x: rect.x, y: rect.y, w: rect.width, h: rect.height,
                    cx: rect.x + rect.width / 2, cy: rect.y + rect.height / 2,
                    cnt: cnt
                });
            }
        }

        return candidateRects;
    }


    filterRects(rects) {
        rects = this.filterUniqueRects(rects, 30);
        rects = this.filterConsistentRects(rects);
        return rects;
    }


    filterUniqueRects(rects, minDistance = 20) {
        // Sort by Area
        rects.sort((a, b) => (b.w * b.h) - (a.w * a.h));

        const unique = [];

        for (let r of rects) {
            let isDuplicate = false;

            for (let u of unique) {
                // Calculate distance between centers
                let dx = r.cx - u.cx;
                let dy = r.cy - u.cy;
                let distance = Math.sqrt(dx * dx + dy * dy);

                // If this rect is physically too close to an existing one, it's a duplicate
                if (distance < minDistance) {
                    isDuplicate = true;
                    break;
                }
            }

            if (!isDuplicate) unique.push(r);
        }

        return unique;
    }


    filterConsistentRects(rects) {
        if (rects.length < 4) return rects;

        // Calculate Areas
        let areas = rects.map(r => r.w * r.h);
        
        // Find the Median Area
        let sortedAreas = [...areas].sort((a, b) => a - b);
        let mid = Math.floor(sortedAreas.length / 2);
        let median = sortedAreas.length % 2 !== 0 
            ? sortedAreas[mid] 
            : (sortedAreas[mid - 1] + sortedAreas[mid]) / 2;

        // Filter based on deviation
        return rects.filter((r, i) => {
            let area = areas[i];
            return area > (median * 0.5) && area < (median * 1.5);
        });
    }


    scanFaceColors(faceRects) {
        return faceRects.map(rect => getAverageColor(this.src, rect));
    }
}