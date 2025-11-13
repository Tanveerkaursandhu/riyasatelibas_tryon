const video = document.getElementById('camera');
const outfit = document.getElementById('outfit');
const text = document.querySelector('.instructions');

async function initCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({ video: true });
  video.srcObject = stream;
  return new Promise((resolve) => (video.onloadedmetadata = resolve));
}

async function main() {
  await initCamera();
  const model = await blazeface.load();
  detectFace(model);
}

async function detectFace(model) {
  const interval = 100;
  setInterval(async () => {
    const predictions = await model.estimateFaces(video, false);
    if (predictions.length > 0) {
      const face = predictions[0];
      const [x1, y1] = face.topLeft;
      const [x2, y2] = face.bottomRight;
      const faceCenterX = (x1 + x2) / 2;
      const faceCenterY = (y1 + y2) / 2;
      const faceHeight = y2 - y1;

      outfit.style.opacity = 1;
      text.style.opacity = 0;
      outfit.style.top = `${faceCenterY + faceHeight * 0.5}px`;
      outfit.style.transform = `translateX(-50%) scale(${1 + faceHeight / 400})`;
    } else {
      outfit.style.opacity = 0;
      text.style.opacity = 1;
    }
  }, interval);
}

main();
