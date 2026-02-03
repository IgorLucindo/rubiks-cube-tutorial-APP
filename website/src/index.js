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

// UI Listeners for the solution buttons still live here
document.getElementById('nextBtn').addEventListener('click', () => {
    const move = virtualCube.nextMove();
    if (move) document.getElementById('solutionText').innerText = `Move: ${move}`;
    else if (virtualCube.isSolvedMode) document.getElementById('solutionText').innerText = "Solved!";
});
document.getElementById('prevBtn').addEventListener('click', () => {
    const move = virtualCube.prevMove();
    if (move) document.getElementById('solutionText').innerText = `Back to: ${move}`;
});
if (DEBUG) {
    const btn = document.getElementById('debugBtn');
    if (btn) {
        btn.style.display = 'block';
        btn.addEventListener('click', () => {
            virtualCube.forceUnsolvedState();
        });
    }
}