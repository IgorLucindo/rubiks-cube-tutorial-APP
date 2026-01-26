import { VideoCapture } from "./classes/video_capture.js";
import { VirtualCube } from "./classes/virtual_cube.js";


const videoCap = new VideoCapture('videoInput', 'canvasOutput');
const virtualCube = new VirtualCube();


function mainLoop() {
    // Detects and return face colors of cube
    const faceColors = videoCap.loop();

    // Process face colors and construct virtual cube
    virtualCube.loop(faceColors);

    requestAnimationFrame(mainLoop);
}


// Startup Sequence
window.cvReady.then(() => {
    console.log("OpenCV Ready. Initializing...");
    videoCap.start().then(() => {
        console.log("Camera Started. Beginning Global Loop.");
        mainLoop();
    }).catch(err => {
        console.error("Failed to start camera:", err);
    });
});