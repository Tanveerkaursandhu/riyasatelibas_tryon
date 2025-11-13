// ==== Select elements ====
const video = document.getElementById("camera");
const outfit = document.getElementById("outfit");

// ==== Load TensorFlow.js + MoveNet ====
let detector;

async function loadPoseDetection() {
  try {
    detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
      modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
    });
    console.log("✅ MoveNet loaded");
  } catch (error) {
    console.error("❌ Error loading MoveNet:", error);
  }
}

// ==== Start camera ====
async function startCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" }, // use "environment" for back camera on phone
    });
    video.srcObject = stream;
    await video.play();
    console.log("📸 Camera started");
  } catch (error) {
    console.error("Camera error:", error);
    alert("Please allow camera access and reload.");
  }
}

// ==== Detect and track ====
async function detectPose() {
  if (!detector) return;

  try {
    const poses = await detector.estimatePoses(video);
    if (poses.length > 0) {
      const keypoints = poses[0].keypoints;

      // Neck/shoulder anchor point (average of shoulders)
      const leftShoulder = keypoints.find(k => k.name === "left_shoulder");
      const rightShoulder = keypoints.find(k => k.name === "right_shoulder");

   if (leftShoulder && rightShoulder) {
  if (leftShoulder.score > 0.3 && rightShoulder.score > 0.3) {
    const centerX = (leftShoulder.x + rightShoulder.x) / 2;
    const centerY = (leftShoulder.y + rightShoulder.y) / 2;

    // Width between shoulders = scale reference
    const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);

    // Scale outfit to match shoulder width
    const scale = shoulderWidth / 250; // Adjust 250 for your outfit proportion

    // Smooth and show
    outfit.style.opacity = "1";
    outfit.style.transition = "transform 0.15s linear";
    outfit.style.transform = `
      translate(-50%, -50%)
      translate(${centerX}px, ${centerY + 80}px)
      scale(${scale})
    `;
  }
} else {
  // fallback center
  outfit.style.opacity = "1";
  outfit.style.transform = "translate(-50%, -50%) translate(50vw, 50vh) scale(1)";
}

    }
  } catch (error) {
    console.error("Pose detection error:", error);
  }

  requestAnimationFrame(detectPose);
}

// ==== Initialize ====
(async () => {
  await startCamera();

  // Load TensorFlow.js library dynamically
  const script = document.createElement("script");
  script.src = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.21.0/dist/tf.min.js";
  script.onload = async () => {
    const poseScript = document.createElement("script");
    poseScript.src = "https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection";
    poseScript.onload = async () => {
      await loadPoseDetection();
      detectPose();
    };
    document.body.appendChild(poseScript);
  };
  document.body.appendChild(script);
})();

