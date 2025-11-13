// // ==== Select elements ====
// const video = document.getElementById("camera");
// const outfit = document.getElementById("outfit");

// // ==== Load TensorFlow.js + MoveNet ====
// let detector;

// async function loadPoseDetection() {
//   try {
//     detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
//       modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
//     });
//     console.log("✅ MoveNet loaded");
//   } catch (error) {
//     console.error("❌ Error loading MoveNet:", error);
//   }
// }

// // ==== Start camera ====
// async function startCamera() {
//   try {
//     const stream = await navigator.mediaDevices.getUserMedia({
//       video: { facingMode: "user" }, // use "environment" for back camera on phone
//     });
//     video.srcObject = stream;
//     await video.play();
//     console.log("📸 Camera started");
//   } catch (error) {
//     console.error("Camera error:", error);
//     alert("Please allow camera access and reload.");
//   }
// }

// // ==== Detect and track ====
// async function detectPose() {
//   if (!detector) return;

//   try {
//     const poses = await detector.estimatePoses(video);
//     if (poses.length > 0) {
//       const keypoints = poses[0].keypoints;

//       // Neck/shoulder anchor point (average of shoulders)
//       const leftShoulder = keypoints.find(k => k.name === "left_shoulder");
//       const rightShoulder = keypoints.find(k => k.name === "right_shoulder");

//    if (leftShoulder && rightShoulder) {
//   if (leftShoulder.score > 0.3 && rightShoulder.score > 0.3) {
//     const centerX = (leftShoulder.x + rightShoulder.x) / 2;
//     const centerY = (leftShoulder.y + rightShoulder.y) / 2;

//     // Width between shoulders = scale reference
//     const shoulderWidth = Math.abs(rightShoulder.x - leftShoulder.x);

//     // Scale outfit to match shoulder width
//     const scale = shoulderWidth / 180;
//     // Smooth and show
//     outfit.style.opacity = "1";
//     outfit.style.transition = "transform 0.15s linear";
//     outfit.style.transform = `
//       translate(-50%, -50%)
//       translate(${centerX}px, ${centerY + 80}px)
//       scale(${scale})
//     `;
//   }
// } else {
//   // fallback center
//   outfit.style.opacity = "1";
//   outfit.style.transform = "translate(-50%, -50%) translate(50vw, 50vh) scale(1)";
// }

//     }
//   } catch (error) {
//     console.error("Pose detection error:", error);
//   }

//   requestAnimationFrame(detectPose);
// }

// // ==== Initialize ====
// (async () => {
//   await startCamera();

//   // Load TensorFlow.js library dynamically
//   const script = document.createElement("script");
//   script.src = "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@3.21.0/dist/tf.min.js";
//   script.onload = async () => {
//     const poseScript = document.createElement("script");
//     poseScript.src = "https://cdn.jsdelivr.net/npm/@tensorflow-models/pose-detection";
//     poseScript.onload = async () => {
//       await loadPoseDetection();
//       detectPose();
//     };
//     document.body.appendChild(poseScript);
//   };
//   document.body.appendChild(script);
// })();

// Segmentation + Pose Try-On
// Uses: @tensorflow-models/pose-detection (MoveNet) + @tensorflow-models/body-pix
// Make sure index.html loads the tfjs and both model scripts before this file (defer script tags used)

const video = document.getElementById('video');
const outfit = document.getElementById('outfit');
const msg = document.getElementById('msg');
const maskCanvas = document.getElementById('maskCanvas');
const maskCtx = maskCanvas.getContext('2d');

let detector = null;
let segmenter = null;
let started = false;
let smoothing = { x: 0, y: 0, h: 0, w: 0 };

// -------- Camera init ----------
async function initCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false
    });
    video.srcObject = stream;
    await new Promise(r => (video.onloadedmetadata = r));
    video.play();
    return true;
  } catch (e) {
    console.error('Camera error', e);
    alert('Camera access is required. Please allow camera permission and reload.');
    return false;
  }
}

// -------- Load models ----------
async function loadModels() {
  // Pose detector (MoveNet)
  detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
    modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
  });

  // BodyPix segmentation (good compromise of speed/quality)
  segmenter = await bodyPix.load({
    architecture: 'MobileNetV1',
    outputStride: 16,
    multiplier: 0.75,
    quantBytes: 2
  });

  console.log('Models loaded');
}

// -------- Create person mask (BodyPix) --------
// returns a dataURL of the mask (person pixels opaque, background transparent)
async function createMaskDataURL() {
  // for speed, use small internal resolution and then upscale mask to CSS size
  const segmentation = await segmenter.segmentPerson(video, {
    internalResolution: 'medium', // options: 'low' 'medium' 'high'
    segmentationThreshold: 0.6,
  });

  // draw mask to canvas; person pixels -> opaque white; background -> transparent
  const width = segmentation.width;
  const height = segmentation.height;
  maskCanvas.width = width;
  maskCanvas.height = height;

  const imageData = maskCtx.createImageData(width, height);
  const data = imageData.data;
  const seg = segmentation.data; // array of 0/1 indicating person

  for (let i = 0; i < seg.length; i++) {
    const offset = i * 4;
    if (seg[i] === 1) {
      data[offset] = 255;     // R
      data[offset + 1] = 255; // G
      data[offset + 2] = 255; // B
      data[offset + 3] = 255; // A (opaque for person)
    } else {
      // transparent for background
      data[offset] = 0;
      data[offset + 1] = 0;
      data[offset + 2] = 0;
      data[offset + 3] = 0;
    }
  }
  maskCtx.putImageData(imageData, 0, 0);

  return maskCanvas.toDataURL('image/png');
}

// -------- Main loop: pose + segmentation, then position outfit ----------
async function renderLoop() {
  if (!detector || !segmenter) {
    requestAnimationFrame(renderLoop);
    return;
  }

  try {
    // 1) Pose estimation (for shoulders/torso)
    const poses = await detector.estimatePoses(video, { flipHorizontal: true });
    // 2) Segmentation (person mask)
    const maskDataURL = await createMaskDataURL();

    // apply mask as CSS mask for outfit (so outfit shows only where person is)
    outfit.style.webkitMaskImage = `url(${maskDataURL})`;
    outfit.style.maskImage = `url(${maskDataURL})`;
    outfit.style.maskRepeat = 'no-repeat';
    outfit.style.webkitMaskRepeat = 'no-repeat';
    outfit.style.maskSize = 'cover';
    outfit.style.webkitMaskSize = 'cover';

    if (poses && poses.length > 0 && poses[0].keypoints) {
      const kps = poses[0].keypoints;

      // Find shoulders + hips
      // keypoint names vary; some versions provide name strings, others 'part'
      const findKp = (name) => kps.find(k => (k.name === name) || (k.part === name) || (k.part === name.toLowerCase()));
      const lShoulder = findKp('left_shoulder') || findKp('leftShoulder') || kps[5];
      const rShoulder = findKp('right_shoulder') || findKp('rightShoulder') || kps[6];
      const lHip = findKp('left_hip') || findKp('leftHip') || kps[11];
      const rHip = findKp('right_hip') || findKp('rightHip') || kps[12];

      if (lShoulder && rShoulder && lShoulder.score > 0.25 && rShoulder.score > 0.25) {
        // convert video pixel coords to CSS/display coords
        const vw = video.videoWidth, vh = video.videoHeight;
        const cw = video.clientWidth, ch = video.clientHeight;
        const scale = Math.max(cw / vw, ch / vh);
        const scaledW = vw * scale, scaledH = vh * scale;
        const dx = (cw - scaledW) / 2, dy = (ch - scaledH) / 2;

        const toDisplay = (kp) => {
          let x = kp.x, y = kp.y;
          if (x <= 1 && y <= 1) { x = kp.x * vw; y = kp.y * vh; }
          const displayX = x * scale + dx;
          const displayY = y * scale + dy;
          return { x: displayX, y: displayY };
        };

        const L = toDisplay(lShoulder);
        const R = toDisplay(rShoulder);
        const centerX = (L.x + R.x) / 2;
        const centerY = (L.y + R.y) / 2;

        // torso height: use hips if available
        let torsoHeight = (Math.hypot(R.x - L.x, R.y - L.y) * 3.0);
        if (lHip && rHip) {
          const HL = toDisplay(lHip);
          const HR = toDisplay(rHip);
          const hipCenterY = (HL.y + HR.y) / 2;
          torsoHeight = (hipCenterY - centerY) * 0.98;
        }

        // smoothing
        const smooth = 0.18;
        smoothing.x = smoothing.x + smooth * (centerX - smoothing.x);
        smoothing.y = smoothing.y + smooth * (centerY - smoothing.y);
        smoothing.h = smoothing.h + smooth * (torsoHeight - smoothing.h);

        // anchor so neckline sits naturally (offset tweak)
        const anchorTop = smoothing.y + smoothing.h * 0.12;

        // set outfit CSS; translate-by-half to center
        outfit.style.left = `${smoothing.x - (outfit.offsetWidth / 2)}px`;
        outfit.style.top = `${anchorTop}px`;
        outfit.style.height = `${Math.max(120, smoothing.h)}px`;
        outfit.style.opacity = 1;
        msg.style.opacity = 0;
      } else {
        // weak detection: keep outfit visible but not positioned
        msg.style.opacity = 1;
        outfit.style.opacity = 0.9;
      }
    } else {
      // no pose: keep mask applied but hide outfit slightly
      outfit.style.opacity = 0.7;
      msg.style.opacity = 1;
    }
  } catch (e) {
    console.error('Render loop error:', e);
  }

  requestAnimationFrame(renderLoop);
}

// ---------- Start sequence ----------
document.body.addEventListener('click', async () => {
  if (started) return;
  started = true;
  msg.textContent = 'Starting camera...';
  const ok = await initCamera();
  if (!ok) return;
  msg.textContent = 'Loading models (may take a few seconds)...';
  await loadModels();
  msg.textContent = 'Step into the frame — loading mask & tracking...';
  renderLoop();
}, { once: true });
