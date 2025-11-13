const video = document.getElementById('camera');
const outfit = document.getElementById('outfit');
const info = document.querySelector('.instructions');
let detector;

// start camera
async function initCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
  video.srcObject = stream;
  await new Promise(r => video.onloadedmetadata = r);
}

// create pose detector
async function loadModel() {
  const model = poseDetection.SupportedModels.MoveNet;
  detector = await poseDetection.createDetector(model, {
    modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
  });
}

async function detectPose() {
  const poses = await detector.estimatePoses(video, { flipHorizontal: true });
  if (poses.length > 0) {
    const left = poses[0].keypoints.find(k => k.name === 'left_shoulder');
    const right = poses[0].keypoints.find(k => k.name === 'right_shoulder');
    if (left.score > 0.5 && right.score > 0.5) {
      const centerX = (left.x + right.x) / 2;
      const centerY = (left.y + right.y) / 2;
      const width = Math.abs(right.x - left.x) * 3;
      outfit.style.left = `${centerX}px`;
      outfit.style.top = `${centerY}px`;
      outfit.style.height = `${width}px`;
      outfit.style.opacity = 1;
    }
  }
  requestAnimationFrame(detectPose);
}

document.body.addEventListener('click', async () => {
  info.textContent = 'Loading camera...';
  await initCamera();
  info.textContent = 'Loading model...';
  await loadModel();
  info.textContent = 'Align with outfit 👗';
  detectPose();
}, { once: true });

