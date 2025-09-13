// ===== CAMERA MODULE FOR INDEX.HTML - ENHANCED VERSION =====

// ===== CAMERA VARIABLES =====
let isCameraActive = false;
let cameraRetryInterval = null;

// ===== CAMERA CONFIGURATION =====
const CAMERA_CONFIG = {
  PI_IP: "10.37.117.213",
  CAMERA_PORT: 5004,
  RETRY_DELAY: 3000,
  CONNECTION_TIMEOUT: 5000
};

// ===== CAMERA FUNCTIONS =====
function setupCamera() {
  console.log("🎥 Setting up camera...");
  
  const startBtn = document.getElementById("startCameraBtn");
  const stopBtn = document.getElementById("stopCameraBtn");
  const cameraFeed = document.getElementById("cameraFeed");
  
  if (!startBtn || !stopBtn || !cameraFeed) {
    console.warn("⚠️ Camera elements not found in DOM");
    return;
  }

  // Set up button click handlers
  startBtn.addEventListener("click", startCamera);
  stopBtn.addEventListener("click", stopCamera);

  // Initial setup
  updateCameraUI(false);
  checkCameraConnection();
  
  console.log("✅ Camera setup complete");
}

async function checkCameraConnection() {
  try {
    const response = await fetch(`http://${CAMERA_CONFIG.PI_IP}:${CAMERA_CONFIG.CAMERA_PORT}/camera/status`, {
      method: 'GET'
    });
    
    if (response.ok) {
      const status = await response.json();
      console.log("🎥 Camera server connected:", status);
      setCameraStatus("📹 Camera server connected");
      return true;
    }
  } catch (error) {
    console.warn("⚠️ Camera server not reachable:", error.message);
    setCameraStatus("❌ Camera server offline");
    return false;
  }
}

async function startCamera() {
  console.log("🎥 Starting camera...");
  setCameraStatus("🔄 Starting camera...");

  const startBtn = document.getElementById("startCameraBtn");
  const cameraFeed = document.getElementById("cameraFeed");
  const cameraPanel = document.getElementById("cameraPanel");

  if (startBtn) startBtn.disabled = true;

  try {
    // Start camera on Pi
    console.log(`Sending start request to http://${CAMERA_CONFIG.PI_IP}:${CAMERA_CONFIG.CAMERA_PORT}/camera/start`);
    
    const startResponse = await fetch(`http://${CAMERA_CONFIG.PI_IP}:${CAMERA_CONFIG.CAMERA_PORT}/camera/start`, {
      method: 'POST'
    });

    if (!startResponse.ok) {
      throw new Error(`Camera start failed: ${startResponse.status}`);
    }

    const startData = await startResponse.json();
    console.log("✅ Camera start response:", startData);

    // Set up video stream
    const streamUrl = `http://${CAMERA_CONFIG.PI_IP}:${CAMERA_CONFIG.CAMERA_PORT}/camera/stream?t=${Date.now()}`;
    console.log("🎥 Setting camera source:", streamUrl);
    
    // Hide placeholder and show feed
    const placeholder = cameraPanel.querySelector('.camera-placeholder');
    if (placeholder) placeholder.style.display = 'none';
    
    cameraFeed.src = streamUrl;
    cameraFeed.style.display = "block";
    cameraFeed.style.transform = "rotate(180deg)";
    cameraFeed.style.webkitTransform = "rotate(180deg)";

    // Handle successful load
    cameraFeed.onload = () => {
      console.log("✅ Camera stream loaded successfully");
      isCameraActive = true;
      updateCameraUI(true);
      setCameraStatus("📹 Camera active");
      
      // 🎯 COMBO MODE: Trigger detection start
      document.dispatchEvent(new Event('camera:start'));
      
      // ✅ INTEGRATION: Add to summary if function exists
      if (typeof addToSummary === 'function') {
        addToSummary("📹 Live camera feed started");
      }
      
      // ✅ INTEGRATION: Update header camera chip
      updateHeaderCameraStatus("Camera: active");
    };

    // Handle errors
    cameraFeed.onerror = () => {
      console.error("❌ Camera stream error");
      handleCameraError();
    };

  } catch (error) {
    console.error("❌ Camera start error:", error);
    setCameraStatus("❌ Camera start failed");
    handleCameraError();
  }
}

async function stopCamera() {
  console.log("🛑 Stopping camera...");
  setCameraStatus("🔄 Stopping camera...");

  const stopBtn = document.getElementById("stopCameraBtn");
  const cameraFeed = document.getElementById("cameraFeed");
  const cameraPanel = document.getElementById("cameraPanel");

  if (stopBtn) stopBtn.disabled = true;

  try {
    // Stop camera on Pi
    const stopResponse = await fetch(`http://${CAMERA_CONFIG.PI_IP}:${CAMERA_CONFIG.CAMERA_PORT}/camera/stop`, {
      method: 'POST'
    });

    // Clear video stream
    if (cameraFeed) {
      cameraFeed.src = "";
      cameraFeed.style.display = "none";
    }

    // Show placeholder again
    const placeholder = cameraPanel.querySelector('.camera-placeholder');
    if (placeholder) placeholder.style.display = 'flex';

    // Clear retry interval
    if (cameraRetryInterval) {
      clearInterval(cameraRetryInterval);
      cameraRetryInterval = null;
    }

    isCameraActive = false;

    // 🎯 COMBO MODE: Trigger detection stop
    document.dispatchEvent(new Event('camera:stop'));

    updateCameraUI(false);
    setCameraStatus("📹 Camera stopped");

    // ✅ INTEGRATION: Add to summary if function exists
    if (typeof addToSummary === 'function') {
      addToSummary("📹 Camera feed stopped");
    }

    // ✅ INTEGRATION: Update header camera chip
    updateHeaderCameraStatus("Camera: inactive");

    console.log("✅ Camera stopped successfully");

  } catch (error) {
    console.error("❌ Camera stop error:", error);
    setCameraStatus("⚠️ Camera stop error");
    updateCameraUI(false);
  }
}

function handleCameraError() {
  const cameraFeed = document.getElementById("cameraFeed");
  const cameraPanel = document.getElementById("cameraPanel");
  
  isCameraActive = false;
  updateCameraUI(false);
  setCameraStatus("❌ Camera error");
  
  if (cameraFeed) {
    cameraFeed.style.display = "none";
  }
  
  // Show placeholder again
  const placeholder = cameraPanel.querySelector('.camera-placeholder');
  if (placeholder) placeholder.style.display = 'flex';
  
  // ✅ INTEGRATION: Add to summary if function exists
  if (typeof addToSummary === 'function') {
    addToSummary("❌ Camera connection error");
  }
  
  // ✅ INTEGRATION: Update header camera chip
  updateHeaderCameraStatus("Camera: error");
}

function updateCameraUI(active) {
  const startBtn = document.getElementById("startCameraBtn");
  const stopBtn = document.getElementById("stopCameraBtn");
  const cameraPanel = document.getElementById("cameraPanel");

  if (startBtn && stopBtn) {
    if (active) {
      startBtn.style.display = "none";
      stopBtn.style.display = "inline-block";
      stopBtn.disabled = false;
    } else {
      startBtn.style.display = "inline-block";
      stopBtn.style.display = "none";
      startBtn.disabled = false;
    }
  }

  if (cameraPanel) {
    cameraPanel.classList.toggle("active", active);
  }
}

function setCameraStatus(status) {
  const statusElement = document.getElementById("piCameraStatus");
  if (statusElement) {
    statusElement.textContent = status;
  }
  console.log("📹", status);
}

// ✅ NEW: Update header camera chip status
function updateHeaderCameraStatus(status) {
  const headerCameraStatus = document.getElementById("cameraStatus");
  if (headerCameraStatus) {
    const span = headerCameraStatus.querySelector("span");
    if (span) {
      span.textContent = status;
    }
  }
}

// ✅ NEW: Integration with navigation system
function onNavigationStart() {
  console.log("🚀 Navigation started - camera will remain active for safety");
  if (isCameraActive && typeof addToSummary === 'function') {
    addToSummary("👁️ Camera providing navigation assistance");
  }
}

function onNavigationEnd() {
  console.log("🏁 Navigation ended - camera available for manual control");
}

// ✅ NEW: Listen for navigation events
document.addEventListener('navigation:start', onNavigationStart);
document.addEventListener('navigation:end', onNavigationEnd);

// ✅ AUTO-SETUP WHEN DOM LOADS (unchanged)
document.addEventListener('DOMContentLoaded', () => {
  console.log("🎥 DOM loaded, setting up camera...");
  setTimeout(setupCamera, 1000); // Wait for other systems to load
});

// ✅ NEW: Make camera functions globally available for other modules
window.startCamera = startCamera;
window.stopCamera = stopCamera;
window.isCameraActive = () => isCameraActive;