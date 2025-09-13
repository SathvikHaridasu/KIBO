// camera.js - Basic camera module stub


// Camera state
let cameraStream = null;
let cameraActive = false;

// Start the camera and display video in a given element
async function startCamera(videoElementId = 'cameraVideo') {
  if (cameraActive) {
    console.log('Camera already active');
    return;
  }
  try {
    const constraints = { video: true, audio: false };
    cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    const video = document.getElementById(videoElementId);
    if (video) {
      video.srcObject = cameraStream;
      video.play();
    }
    cameraActive = true;
    console.log('Camera started');
  } catch (err) {
    console.error('Camera error:', err);
  }
}

// Stop the camera
function stopCamera(videoElementId = 'cameraVideo') {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
    cameraActive = false;
    const video = document.getElementById(videoElementId);
    if (video) {
      video.srcObject = null;
    }
    console.log('Camera stopped');
  }
}

// Take a snapshot from the video stream
function takeSnapshot(videoElementId = 'cameraVideo', canvasElementId = 'cameraSnapshot') {
  const video = document.getElementById(videoElementId);
  const canvas = document.getElementById(canvasElementId);
  if (video && canvas) {
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    console.log('Snapshot taken');
    return canvas.toDataURL('image/png');
  }
  return null;
}

// Utility: check if camera is active
function isCameraActive() {
  return cameraActive;
}
