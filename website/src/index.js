import { VideoCapture } from "./classes/video_capture.js";
import { VirtualCube } from "./classes/virtual_cube.js";
import { initToggleMenu } from "./utils/menu_utils.js";

const cfg = {isMobile: window.matchMedia("(max-width: 768px)").matches};

const videoCap = new VideoCapture();
const virtualCube = new VirtualCube(cfg);


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


initToggleMenu(virtualCube);