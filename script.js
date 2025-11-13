import * as posedetection from "https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection";
import "@tensorflow/tfjs-backend-webgl";

const video = document.getElementById("camera");
const outfit = document.getElementById("outfit");

// Start camera
async function startCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user" },
  });
  video.srcObject = stream;
  await video.play();
}

// Setup pose detection
async function initPose() {
  const detector = await posedetection.createDetector(
    posedetection.SupportedModels.MoveNet,
    { modelType: posedetection.movenet.modelType.SINGLEPOSE_LIGHTNING }
  );

  async function detectPose() {
    const poses = await detector.estimatePoses(video);
    if (poses.length > 0) {
      const keypoints = poses[0].keypoints;
      const leftShoulder = keypoints[5];
      const rightShoulder = keypoints[6];
      const leftHip = keypoints[11];
      const rightHip = keypoints[12];

      // Only update if confidence is high enough
      if (
        leftShoulder.score > 0.4 &&
        rightShoulder.score > 0.4 &&
        leftHip.score > 0.4 &&
        rightHip.score > 0.4
      ) {
        const centerX = (leftShoulder.x + rightShoulder.x) / 2;
        const centerY = (leftShoulder.y + leftHip.y) / 2;

        const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);
        const torsoHeight = Math.abs(leftHip.y - leftShoulder.y);

        // Resize and position outfit dynamically
        outfit.style.left = `${centerX}px`;
        outfit.style.top = `${centerY - torsoHeight / 2}px`;
        outfit.style.width = `${shoulderWidth * 2.2}px`;
        outfit.style.height = `${torsoHeight * 1.6}px`;
        outfit.style.transform = "translate(-50%, -50%)";
      }
    }
    requestAnimationFrame(detectPose);
  }

  detectPose();
}

// Wait for user click
document.body.addEventListener(
  "click",
  async () => {
    await startCamera();
    await initPose();
  },
  { once: true }
);
