# 🧩 Rubik's Cube Tutorial

[![Open App](https://img.shields.io/badge/OPEN_APP-Rubik's_Cube_Tutorial-2ea44f?style=for-the-badge)](https://igorlucindo.github.io/rubiks-cube-tutorial-APP//)

A web application that utilizes **Computer Vision** to scan a physical Rubik's Cube and visualizes it in real-time using a **3D Virtual Model**. It bridges the physical and digital worlds by mapping the state of a real cube onto a digital twin.

The application features an interactive interface that guides users through the scanning process using **OpenCV.js** for image processing and **Three.js** for 3D rendering.

## ✨ Features

* **Real-Time Scanning:** Detects and extracts cube face colors via webcam using **OpenCV**.
* **3D Digital Twin:** Renders a fully interactive **Virtual Cube** using **Three.js** that mirrors the physical state.
* **Smart Color Classification:** Uses Euclidean distance algorithms to accurately identify sticker colors under varying lighting.
* **Interactive Guidance:** Automatically rotates the 3D model to guide the user on which face to scan next.
* **Responsive Design:** Side-by-side layout optimized for both desktop and mobile devices.

## 🛠️ Tech Stack

This project is built using modern web technologies and powerful libraries located in the **`website/src/` folder**:

* **OpenCV.js:** For video capture, contour detection, and image processing.
* **Three.js:** For rendering the 3D virtual cube and handling animations.
* **Vanilla JavaScript (ES6+):** For state management and application logic.

## 📝 How it works

* **Detection:** The app captures video frames and uses adaptive thresholding and contour detection to find square-like shapes.
* **Filtering:** It applies geometric constraints (area, aspect ratio, convexity) to filter out noise and identify the 9 stickers of a cube face.
* **Color Mapping:** It calculates the average RGB color of each sticker and classifies it into one of the 6 standard cube colors (White, Yellow, Green, Blue, Red, Orange).
* **State Synchronization:** The detected colors are mapped to a 3D internal state, updating the virtual cube's textures in real-time.

## 🚀 Interactive App

To make computer vision accessible to everyone, we provide a web-based tutorial. This interactive tool allows users to scan their own cubes using a standard webcam without installing any software.

[![Open App](https://img.shields.io/badge/OPEN_APP-Rubik's_Cube_Tutorial-2ea44f?style=for-the-badge)](https://igorlucindo.github.io/rubiks-cube-tutorial-APP/)

Users can simply hold their cube up to the camera, and the application will automatically detect the face, lock in the colors, and guide them to the next step of the solution.