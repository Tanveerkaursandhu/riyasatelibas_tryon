
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
  const ctx = document.createElement('canvas');
  const interval = 100;

  setInterval(async () => {
    const predictions = await model.estimateFaces(video, false);
    if (predictions.length > 0) {
      const face = predictions[0];
      const [x, y, width, height] = face.topLeft.concat(face.bottomRight);
      const faceCenterX = (x + width) / 2;
      const faceCenterY = (y + height) / 2;

      outfit.style.opacity = 1;
      text.style.opacity = 0;

      // Follow face smoothly
      outfit.style.top = `${faceCenterY + height * 0.6}px`;
      outfit.style.transform = `translateX(-50%) scale(${1 + height / 400})`;
    } else {
      outfit.style.opacity = 0;
      text.style.opacity = 1;
    }
  }, interval);
}

main();
