import { sortGridByPosition, getAverageColor, classifyColor } from "../utils/computer_vision_utils.js";


export class VideoCapture {
    constructor(videoId, canvasId) {
        this.video = document.getElementById(videoId);
        this.canvasId = canvasId;

        const styles = getComputedStyle(document.documentElement);
        this.cssColors = {
            'white': styles.getPropertyValue('--cube-white').trim(),
            'yellow': styles.getPropertyValue('--cube-yellow').trim(),
            'green': styles.getPropertyValue('--cube-green').trim(),
            'blue': styles.getPropertyValue('--cube-blue').trim(),
            'orange': styles.getPropertyValue('--cube-orange').trim(),
            'red': styles.getPropertyValue('--cube-red').trim()
        };

        this.hsvRanges = {
            'white':  { h: [0, 180], s: [0, 40],   v: [100, 255] },
            'yellow': { h: [20, 35],  s: [100, 255], v: [100, 255] },
            'green':  { h: [40, 95], s: [80, 255], v: [50, 255] },
            'blue':   { h: [95, 145], s: [50, 255], v: [20, 255] },
            'orange': { h: [10, 18],  s: [100, 255], v: [100, 255] },
            'red':    { h: [0, 8],    s: [100, 255], v: [50, 255] } 
        };

        this.animationState = {
            active: false,
            startTime: 0,
            duration: 500,
            rects: [],
            faceId: '',
            statusMessage: ''
        };
        
        this.stickerMemory = Array.from({ length: 9 }, () => []);
        this.isReady = false;
        this.scanCooldown = 2000;
        this.lastSuccessTime = 0;

        // OpenCV objects
        this.src = null;
        this.dst = null;
        this.gray = null;
        this.blurred = null;
        this.edges = null;
        this.contours = null;
        this.hierarchy = null;
        this.approx = null;
        this.clahe = null;
        this.helperCanvas = null;
        this.helperCtx = null;
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
        
        // Setup Shadow Canvas
        this.helperCanvas = document.createElement('canvas');
        this.helperCanvas.width = width;
        this.helperCanvas.height = height;
        this.helperCtx = this.helperCanvas.getContext('2d', { willReadFrequently: true });

        // Core Mats
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
        this.lab = new cv.Mat();
        this.labChannels = new cv.MatVector();
        this.srcClahe = new cv.Mat();
    }


    loop(expectedCenterColor, isComplete) {
        if (!this.isReady) return null;

        try {
            // Read
            this.helperCtx.drawImage(this.video, 0, 0, this.src.cols, this.src.rows);
            const imageData = this.helperCtx.getImageData(0, 0, this.src.cols, this.src.rows);
            this.src.data.set(imageData.data);
            
            // Preprocess 
            this.preprocessMats();

            // Find and filter candidates rects
            cv.findContours(this.edges, this.contours, this.hierarchy, cv.RETR_TREE, cv.CHAIN_APPROX_SIMPLE);
            let candidateRects = this.findCandidateRects();
            candidateRects = this.filterRects(candidateRects);

            // Process candidates rects and get face colors
            const faceColors = this.processFaceCandidates(candidateRects, expectedCenterColor);

            // Render
            this.renderFaceHighlight();
            cv.imshow(this.canvasId, this.dst);
            this.updateStatusText(expectedCenterColor, isComplete);

            return faceColors;

        } catch (err) {
            console.error("OpenCV processing error:", err);
            return null;
        }
    }


    preprocessMats() {
        cv.cvtColor(this.src, this.lab, cv.COLOR_RGBA2RGB);
        cv.cvtColor(this.lab, this.lab, cv.COLOR_RGB2Lab);
        cv.split(this.lab, this.labChannels);
        this.clahe.apply(this.labChannels.get(0), this.labChannels.get(0));
        cv.merge(this.labChannels, this.lab);
        cv.cvtColor(this.lab, this.srcClahe, cv.COLOR_Lab2RGB);
        cv.cvtColor(this.src, this.gray, cv.COLOR_RGBA2GRAY);
        this.clahe.apply(this.gray, this.gray);
        cv.GaussianBlur(this.gray, this.blurred, {width: 9, height: 9}, 0);
        cv.adaptiveThreshold(this.blurred, this.edges, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 2);
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


    resolveFaceColors(currentScan) {
        this.updateStickerMemory(currentScan);

        // Calculate probable color based on sticker memory
        const resolvedColors = this.stickerMemory.map(history => {
            const validHistory = history.filter(c => c !== null);
            if (validHistory.length < 5) return null; 
            return validHistory.reduce((a, b, i, arr) =>
                (arr.filter(v => v === a).length >= arr.filter(v => v === b).length ? a : b)
            );
        });

        if (resolvedColors.every(c => c !== null)) return resolvedColors;
        else return null;
    }


    resetStickerMemory() {
        this.stickerMemory.forEach(history => history.length = 0);
    }


    updateStickerMemory(currentScan) {
        currentScan.forEach((color, i) => {
            this.stickerMemory[i].push(color);
            if (this.stickerMemory[i].length > 10) this.stickerMemory[i].shift();
        });
    }


    processFaceCandidates(candidateRects, expectedCenterColor) {
        // Scan cooldown check
        if (Date.now() - this.lastSuccessTime < this.scanCooldown) {
            return null;
        }

        // Check if we simply don't have the right number of stickers
        if (candidateRects.length !== 9) {
            this.animationState.statusMessage = expectedCenterColor 
                ? `PLEASE SCAN ${expectedCenterColor.toUpperCase()} FACE` 
                : "SCAN ANY FACE TO START";
            return null;
        }

        // Sort and Classify
        let faceRects = sortGridByPosition(candidateRects);
        let rawColors = faceRects.map(rect => getAverageColor(this.srcClahe, rect));
        let currentScan = rawColors.map(color => classifyColor(color, this.hsvRanges));

        // Strict Validation (Fail fast if wrong face)
        const centerColor = currentScan[4];
        if (!this.validateExpectedFace(centerColor, expectedCenterColor)) {
            return null; // Status message is already set by validateExpectedFace
        }

        // Memory Resolution
        const faceColors = this.resolveFaceColors(currentScan);
        
        // Success Handling
        if (faceColors) {
            const faceId = faceColors[4];
            this.animationState.statusMessage = `${faceId.toUpperCase()} FACE CAPTURED`;
            this.triggerFaceHighlight(faceRects, faceId);
            this.resetStickerMemory();
            this.lastSuccessTime = Date.now();

            return faceColors;
        }

        return null;
    }

    
    validateExpectedFace(centerColor, expectedColor) {
        if (!expectedColor || centerColor === null || centerColor === expectedColor) {
            return true;
        }

        // Set warning if it is not the expected face
        this.animationState.statusMessage = `SHOW ${expectedColor.toUpperCase()} FACE`;
        return false;
    }


    triggerFaceHighlight(faceRects, faceId) {
        this.animationState.active = true;
        this.animationState.startTime = Date.now();
        this.animationState.rects = faceRects;
        this.animationState.faceId = faceId;
    }


    renderFaceHighlight() {
        if (!this.animationState.active) return;

        const elapsed = Date.now() - this.animationState.startTime;
        const progress = elapsed / this.animationState.duration;

        if (progress >= 1) {
            this.animationState.active = false;
            return;
        }

        // Easing function for smoothness (Ease-Out)
        const fade = 1 - Math.pow(progress, 2);
        const fillAlpha = 0.25 * fade;
        const borderAlpha = 0.6 * fade;

        const faceRects = this.animationState.rects;
        const padding = 15;
        let minX = Math.min(...faceRects.map(r => r.x)) - padding;
        let minY = Math.min(...faceRects.map(r => r.y)) - padding;
        let maxX = Math.max(...faceRects.map(r => r.x + r.w)) + padding;
        let maxY = Math.max(...faceRects.map(r => r.y + r.h)) + padding;

        let point1 = new cv.Point(minX, minY);
        let point2 = new cv.Point(maxX, maxY);

        // Create overlay for transparency
        let overlay = this.dst.clone();
        
        // Solid fill with fading alpha
        cv.rectangle(overlay, point1, point2, [255, 255, 255, 255], -1);
        cv.addWeighted(overlay, fillAlpha, this.dst, 1, 0, this.dst);

        // Smoother Border (draw multiple times for subtle glow or just once with alpha)
        cv.rectangle(this.dst, point1, point2, [255, 255, 255, 255 * borderAlpha], 1, cv.LINE_AA, 0);

        // Fading Text
        const label = `${this.animationState.faceId.toUpperCase()} FACE`;
        cv.putText(this.dst, label, {x: minX, y: minY - 12}, 
                cv.FONT_HERSHEY_SIMPLEX, 0.6, [255, 255, 255, 255 * fade], 2);

        overlay.delete();
    }


    updateStatusText(expectedColor, isComplete) {
        const statusDiv = document.getElementById('status');
        if (!statusDiv) return;

        // Completion
        if (isComplete) {
            statusDiv.innerHTML = "Scanning Complete! SOLVING...";
            statusDiv.style.color = this.cssColors['green'];
            return;
        }

        // Guidance (Strict Mode)
        if (expectedColor) {
            const cssColor = this.cssColors[expectedColor] || '#ffffff';
            statusDiv.innerHTML = `Rotate to <b style="color:${cssColor}">${expectedColor.toUpperCase()}</b> side.<br>Match the screen.`;
        }
    }
}