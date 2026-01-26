import { onOpenCvReady } from "./utils/video_utils.js";


let video = document.getElementById('videoInput');
let cap = null; // Video Capture object
let src = null; // Source Matrix
let dst = null; // Destination Matrix (for display)

// Helper Matrices (Allocated once to save memory)
let gray, blurred, edges, contours, hierarchy, approx;

window._onOpenCvReady = () => onOpenCvReady();



// Optional: Cleanup on page unload (though browser handles this mostly)
window.onunload = () => {
    src.delete(); dst.delete(); gray.delete(); blurred.delete();
    edges.delete(); contours.delete(); hierarchy.delete(); approx.delete();
};