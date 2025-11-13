
// Pose-based outfit overlay using TensorFlow MoveNet.
// Designed for mobile browsers. Mirrors video (like front camera).
// The outfit image is positioned based on shoulders and hips keypoints.
// If detection is weak, the outfit fades out.

const video = document.getElementById('video');
const outfit = document.getElementById('outfit');

let detector = null;
let rafId = null;

async function initCamera() {
  const constraints = {
    audio: false,
    video: {
      facingMode: 'user',
      width: { ideal: 1280 },
      height: { ideal: 720 }
    }
  };
  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  video.srcObject = stream;
  await video.play();
  // adjust video size to fill screen
  outfit.style.opacity = 0;
}

async function createDetector(){
  const model = poseDetection.SupportedModels.MoveNet;
  const detectorConfig = { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING };
  detector = await poseDetection.createDetector(model, detectorConfig);
}

function getKeypoint(pose, name) {
  const kp = pose.keypoints.find(k => k.name === name || k.part === name);
  return kp || null;
}

function lerp(a,b,t){ return a + (b-a)*t; }

async function predictLoop(){
  const poses = await detector.estimatePoses(video, { maxPoses: 1, flipHorizontal: true });
  if(poses && poses.length>0){
    const pose = poses[0];
    // prefer 'left_shoulder','right_shoulder','left_hip','right_hip'
    const ls = getKeypoint(pose, 'left_shoulder') || getKeypoint(pose, 'leftShoulder');
    const rs = getKeypoint(pose, 'right_shoulder') || getKeypoint(pose, 'rightShoulder');
    const lh = getKeypoint(pose, 'left_hip') || getKeypoint(pose, 'leftHip');
    const rh = getKeypoint(pose, 'right_hip') || getKeypoint(pose, 'rightHip');

    if(ls && rs && lh && rh){
      const shoulderMid = { x:(ls.x+rs.x)/2, y:(ls.y+rs.y)/2 };
      const hipMid = { x:(lh.x+rh.x)/2, y:(lh.y+rh.y)/2 };

      // compute scale: distance between shoulders and hips
      const bodyHeight = Math.hypot(shoulderMid.x - hipMid.x, shoulderMid.y - hipMid.y);
      // compute width: distance between shoulders
      const shoulderWidth = Math.hypot(ls.x - rs.x, ls.y - rs.y);

      // onscreen coordinates: the pose keypoints are in image coordinates (video.width, video.height)
      // We need to map to CSS pixels. The video is full screen with object-fit:cover. So compute scale factors.
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const sw = video.clientWidth;
      const sh = video.clientHeight;

      // compute offsets due to cover scaling
      const scale = Math.max(sw / vw, sh / vh);
      const scaledWidth = vw * scale;
      const scaledHeight = vh * scale;
      // top-left of video content relative to viewport
      const dx = (sw - scaledWidth) / 2;
      const dy = (sh - scaledHeight) / 2;

      // map pose coords to viewport coords
      const mapX = (ptX) => ptX * scale + dx;
      const mapY = (ptY) => ptY * scale + dy;

      const midX = mapX((ls.x+rs.x+lh.x+rh.x)/4);
      const midY = mapY((ls.y+rs.y+lh.y+rh.y)/4);

      // compute rotation angle from shoulders
      const angleRad = Math.atan2(rs.y - ls.y, rs.x - ls.x);
      const angleDeg = angleRad * 180 / Math.PI;

      // desired outfit width: proportional to shoulder width in viewport
      const targetWidth = Math.max(shoulderWidth * scale * 1.6, 120);
      // desired outfit height: proportional to bodyHeight * scale * factor
      const targetHeight = Math.max(bodyHeight * scale * 3.0, targetWidth * 1.4);

      // apply transform with smoothing
      const prev = outfit._prev || {x:midX, y:midY, w:targetWidth, h:targetHeight, a:angleDeg, o:0};
      const smooth = 0.2;
      const curX = lerp(prev.x, midX, smooth);
      const curY = lerp(prev.y, midY, smooth);
      const curW = lerp(prev.w, targetWidth, smooth);
      const curH = lerp(prev.h, targetHeight, smooth);
      const curA = lerp(prev.a, angleDeg, smooth);
      const curO = 1.0;

      outfit.style.width = curW + 'px';
      outfit.style.height = curH + 'px';
      // position center
      outfit.style.left = (curX - curW/2) + 'px';
      outfit.style.top = (curY - curH/2) + 'px';
      outfit.style.transform = `rotate(${curA}deg) translateZ(0) scaleX(-1)`;
      outfit.style.opacity = curO;
      outfit._prev = {x:curX,y:curY,w:curW,h:curH,a:curA,o:curO};
    } else {
      // not enough keypoints
      outfit.style.opacity = 0;
    }
  } else {
    outfit.style.opacity = 0;
  }
  rafId = requestAnimationFrame(predictLoop);
}

async function main(){
  try {
    await initCamera();
  } catch(e){
    alert('Camera access is required to try the outfit. Please allow camera permission and reload the page.');
    console.error(e);
    return;
  }
  await createDetector();
  predictLoop();
}

main();
