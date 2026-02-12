import { VideoCapture } from "./classes/video_capture.js";
import { VirtualCube } from "./classes/virtual_cube.js";


const DEBUG = true;
const videoCap = new VideoCapture();
const virtualCube = new VirtualCube();


function mainLoop() {
    // Get State from Cube
    const expectedColor = virtualCube.getExpectedCenterColor();
    const isComplete = virtualCube.isComplete();

    // Run loops
    const faceColors = videoCap.loop(expectedColor, isComplete);
    virtualCube.loop(faceColors);

    requestAnimationFrame(mainLoop);
}


// Startup Sequence
window.cvReady.then(() => {
    console.log("OpenCV Ready. Initializing...");
    videoCap.start()
        .then(() => {
            console.log("Camera Started. Beginning Global Loop.");
            mainLoop();
        })
        .catch(err => {
            console.error("Camera failed to start (Virtual Mode only):", err);
            mainLoop();
        });
});

// Debug menu
if (DEBUG) {
    const forceBtn = document.getElementById('forceCubeBtn');
    const autoBtn = document.getElementById('autoSolveBtn');

    forceBtn.style.display = 'block';
    forceBtn.addEventListener('click', () => {
        virtualCube.forceUnsolvedState();
    });
    autoBtn.style.display = 'block';
    autoBtn.addEventListener('click', () => {
        virtualCube.autoSolve();
    });
}