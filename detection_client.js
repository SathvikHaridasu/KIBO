// ===== AUTO-START COMBO: CAMERA + OBSTACLE DETECTION (ALL OBJECTS MODE) =====

// Detection configuration
const DETECTION_CONFIG = {
  PI_IP: "10.37.117.213",
  DETECTION_PORT: 5005, // ✅ CHANGED: Was 5003, now 5005
  CHECK_INTERVAL: 300, 
  DANGER_THRESHOLD: 1.2
};

let detectionActive = false;
let detectionInterval = null;
let detectionPanel = null;

// Initialize detection system (called automatically)
async function initializeDetection() {
  console.log("🔍 Initializing COMBO Detection System (ALL OBJECTS MODE)...");
  
  // Create visual panel
  createDetectionPanel();
  
  try {
    const response = await fetch(`http://${DETECTION_CONFIG.PI_IP}:${DETECTION_CONFIG.DETECTION_PORT}/health`);
    
    if (response.ok) {
      const data = await response.json();
      console.log("✅ Detection server ready for combo mode:", data);
      updateDetectionPanel("🔍 Detection Ready - Detects ALL Objects", "success");
      return true;
    }
  } catch (error) {
    console.warn("⚠️ Detection server not available:", error);
    updateDetectionPanel("❌ Detection Server Offline", "error");
    return false;
  }
}

// AUTO-START: Start obstacle detection (called when camera starts)
async function startObstacleDetectionAuto() {
  if (detectionActive) return;
  
  console.log("🚀 COMBO MODE ACTIVATED: Camera + ALL-OBJECT Detection!");
  updateDetectionPanel("🔄 Activating universal object detection...", "info");
  
  try {
    const response = await fetch(`http://${DETECTION_CONFIG.PI_IP}:${DETECTION_CONFIG.DETECTION_PORT}/detection/start`, {
      method: 'POST'
    });
    
    if (response.ok) {
      detectionActive = true;
      
      // Update UI
      const toggle = document.getElementById('detectionToggle');
      if (toggle) {
        toggle.textContent = 'Active';
        toggle.className = 'detection-toggle active';
      }
      
      // Start obstacle monitoring
      detectionInterval = setInterval(checkForObstaclesEnhanced, DETECTION_CONFIG.CHECK_INTERVAL);
      
      console.log("🎯 COMBO SYSTEM ONLINE - Detecting ALL Objects!");
      updateDetectionPanel("🤖 COMBO ACTIVE: Monitoring ALL obstacles", "success");
      
      if (typeof addToSummary === 'function') {
        addToSummary("🎯 COMBO MODE: Camera + Universal Object Detection Active!");
      }
      
      // Show detection stream info
      console.log(`📹 Live detection view: http://${DETECTION_CONFIG.PI_IP}:${DETECTION_CONFIG.DETECTION_PORT}/detection/stream`);
    }
  } catch (error) {
    console.error("❌ COMBO START FAILED:", error);
    updateDetectionPanel("❌ Failed to start detection", "error");
  }
}

// AUTO-STOP: Stop when camera stops
async function stopObstacleDetectionAuto() {
  if (!detectionActive) return;
  
  console.log("🛑 COMBO MODE: Stopping object detection with camera...");
  
  try {
    await fetch(`http://${DETECTION_CONFIG.PI_IP}:${DETECTION_CONFIG.DETECTION_PORT}/detection/stop`, {
      method: 'POST'
    });
    
    detectionActive = false;
    
    if (detectionInterval) {
      clearInterval(detectionInterval);
      detectionInterval = null;
    }
    
    // Update UI
    const toggle = document.getElementById('detectionToggle');
    if (toggle) {
      toggle.textContent = 'Inactive';
      toggle.className = 'detection-toggle inactive';
    }
    
    updateDetectionPanel("📹 Camera stopped - Detection paused", "info");
    document.getElementById('detectedObjects').innerHTML = '';
    
    console.log("✅ COMBO MODE: Detection stopped with camera");
  } catch (error) {
    console.error("❌ Failed to stop detection:", error);
  }
}

// Enhanced obstacle checking with visual feedback
async function checkForObstaclesEnhanced() {
  if (!detectionActive) return;
  
  try {
    const response = await fetch(`http://${DETECTION_CONFIG.PI_IP}:${DETECTION_CONFIG.DETECTION_PORT}/detection/obstacles`);
    
    if (response.ok) {
      const data = await response.json();
      
      // Update visual display
      displayDetectedObjects(data.objects);
      
      if (data.danger_count > 0) {
        console.log("🚨 COMBO ALERT: DANGEROUS OBSTACLES IN VIEW!");
        console.table(data.obstacles.filter(obs => obs.threat_level === 'danger'));
        await handleDangerousObstacles(data.obstacles);
        
      } else if (data.obstacle_count > 0) {
        console.log(`👀 COMBO: Monitoring ${data.obstacle_count} objects`);
        const objectNames = [...new Set(data.obstacles.map(obs => obs.class))];
        updateDetectionPanel(`👀 Watching: ${objectNames.join(', ')}`, "warning");
        
      } else {
        updateDetectionPanel("✅ Path clear - all objects safe", "success");
      }
    }
  } catch (error) {
    console.warn("⚠️ Detection check failed:", error);
    updateDetectionPanel("⚠️ Detection error", "error");
  }
}

// Create visual detection panel
function createDetectionPanel() {
  let container = document.querySelector('#status-container') || document.body;
  
  const panelHTML = `
    <div id="detectionPanel" class="detection-panel">
      <div class="detection-header">
        <h3>🎯 COMBO: Camera + ALL Objects</h3>
        <div id="detectionToggle" class="detection-toggle inactive">Inactive</div>
      </div>
      <div id="detectionContent" class="detection-content">
        <div id="detectionStatus" class="detection-status">Waiting for camera activation...</div>
        <div id="detectedObjects" class="detected-objects"></div>
      </div>
    </div>
  `;
  
  container.insertAdjacentHTML('beforeend', panelHTML);
  
  // Add CSS styles
  const styles = `
    <style>
    .detection-panel {
      background: #1e1e1e;
      border: 2px solid #4CAF50;
      border-radius: 8px;
      padding: 15px;
      margin: 10px;
      font-family: 'Courier New', monospace;
      max-width: 400px;
    }
    
    .detection-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    
    .detection-header h3 {
      color: #4CAF50;
      margin: 0;
      font-size: 16px;
    }
    
    .detection-toggle {
      padding: 5px 10px;
      border-radius: 15px;
      font-size: 12px;
      font-weight: bold;
    }
    
    .detection-toggle.active {
      background: #4CAF50;
      color: white;
    }
    
    .detection-toggle.inactive {
      background: #666;
      color: white;
    }
    
    .detection-status {
      color: #fff;
      margin-bottom: 10px;
      padding: 8px;
      background: #2d2d2d;
      border-radius: 4px;
      font-size: 13px;
    }
    
    .detected-objects {
      max-height: 200px;
      overflow-y: auto;
    }
    
    .detected-object {
      background: #2d2d2d;
      margin: 5px 0;
      padding: 8px;
      border-radius: 4px;
      border-left: 4px solid #4CAF50;
    }
    
    .detected-object.warning {
      border-left-color: #FF9800;
      background: #2d1f0a;
    }
    
    .detected-object.danger {
      border-left-color: #f44336;
      background: #2d0a0a;
      animation: pulse 2s infinite;
    }
    
    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.7; }
      100% { opacity: 1; }
    }
    
    .object-name {
      font-weight: bold;
      color: #4CAF50;
    }
    
    .object-details {
      font-size: 12px;
      color: #ccc;
      margin-top: 3px;
    }
    </style>
  `;
  
  document.head.insertAdjacentHTML('beforeend', styles);
  detectionPanel = document.getElementById('detectionPanel');
}

// Display detected objects
function displayDetectedObjects(obstacles) {  // This parameter gets data.objects now
  const container = document.getElementById('detectedObjects');
  if (!container) return;

  // ✅ SAFE CHECK: Handle undefined
  if (!obstacles || !Array.isArray(obstacles)) {
    console.warn('Invalid obstacles data:', obstacles);
    container.innerHTML = '<div style="color: #ff9800; text-align: center;">Detection data unavailable</div>';
    return;
  }

  // ✅ This line should now work (line 269 equivalent)
  if (obstacles.length === 0) {
    container.innerHTML = '<div style="color: #4CAF50; text-align: center;">No obstacles detected</div>';
    return;
  }

  // Display obstacles
  let html = '';
  obstacles.forEach(obstacle => {
    const confidence = Math.round(obstacle.confidence * 100);
    html += `
      <div style="padding: 5px; margin: 2px; background: #f0f0f0; border-radius: 4px;">
        🔍 <strong>${obstacle.class}</strong> 
        (${confidence}% confident, pos: ${obstacle.position.toFixed(2)})
      </div>
    `;
  });
  
  container.innerHTML = html;
}

// Get emoji for ALL YOLO objects (MASSIVELY EXPANDED!)
function getObjectEmoji(objectClass) {
  const emojiMap = {
    // PEOPLE & ANIMALS
    'person': '🚶', 'dog': '🐕', 'cat': '🐱', 'bird': '🐦', 'horse': '🐴',
    'sheep': '🐑', 'cow': '🐄', 'elephant': '🐘', 'bear': '🐻', 'zebra': '🦓', 'giraffe': '🦒',
    
    // VEHICLES
    'bicycle': '🚲', 'car': '🚗', 'motorcycle': '🏍️', 'bus': '🚌', 'truck': '🚛',
    'airplane': '✈️', 'train': '🚂', 'boat': '🚤',
    
    // ROAD & INFRASTRUCTURE
    'traffic light': '🚦', 'fire hydrant': '🚒', 'stop sign': '🛑', 
    'parking meter': '🅿️', 'bench': '🪑',
    
    // SPORTS & RECREATION
    'frisbee': '🥏', 'skis': '🎿', 'snowboard': '🏂', 'sports ball': '⚽',
    'kite': '🪁', 'baseball bat': '⚾', 'baseball glove': '🥎', 'skateboard': '🛹',
    'surfboard': '🏄', 'tennis racket': '🎾',
    
    // CONTAINERS & BAGS
    'backpack': '🎒', 'handbag': '👜', 'suitcase': '🧳', 'umbrella': '☂️',
    
    // KITCHEN & DINING
    'bottle': '🍶', 'wine glass': '🍷', 'cup': '☕', 'bowl': '🍲',  // <-- BOWL!
    'fork': '🍴', 'knife': '🔪', 'spoon': '🥄',
    
    // FOOD
    'banana': '🍌', 'apple': '🍎', 'sandwich': '🥪', 'orange': '🍊',
    'broccoli': '🥦', 'carrot': '🥕', 'hot dog': '🌭', 'pizza': '🍕',
    'donut': '🍩', 'cake': '🎂',
    
    // FURNITURE
    'chair': '🪑', 'couch': '🛋️', 'potted plant': '🪴', 'bed': '🛏️',
    'dining table': '🍽️', 'toilet': '🚽',
    
    // ELECTRONICS
    'tv': '📺', 'laptop': '💻', 'mouse': '🖱️', 'remote': '📱', 'keyboard': '⌨️',
    'cell phone': '📱', 'microwave': '📡', 'oven': '🔥', 'toaster': '🍞',
    'refrigerator': '❄️',
    
    // HOUSEHOLD ITEMS
    'book': '📚', 'clock': '🕐', 'vase': '🏺', 'scissors': '✂️', 
    'teddy bear': '🧸', 'hair drier': '💨', 'toothbrush': '🦷',
    'sink': '🚿', 'tie': '👔',
    
    // UNKNOWN/DEFAULT
    'unknown': '❓', 'object': '📦'
  };
  
  // Handle unknown_object_X pattern from server
  if (objectClass.startsWith('unknown_object_')) {
    return '❓';
  }
  
  return emojiMap[objectClass] || '📦';
}

// Handle dangerous obstacles
async function handleDangerousObstacles(obstacles) {
  const dangerousObs = obstacles.filter(obs => obs.threat_level === 'danger');
  
  console.log("🚨🚨🚨 COMBO EMERGENCY: DANGEROUS OBJECTS DETECTED! 🚨🚨🚨");
  
  dangerousObs.forEach(obs => {
    console.log(`  🔴 ${obs.class.toUpperCase()} at ~${obs.distance_estimate.toFixed(1)}m`);
  });
  
  if (typeof emergencyStop === 'function') {
    await emergencyStop();
    console.log("🛑 EMERGENCY STOP ACTIVATED");
  }
  
  const obstacleTypes = [...new Set(dangerousObs.map(obs => obs.class))].join(', ');
  const message = `🚨 DANGER: ${obstacleTypes} in path! Stopping for safety.`;
  
  updateDetectionPanel(`🚨 EMERGENCY: ${obstacleTypes}`, "danger");
  
  if (typeof addToSummary === 'function') {
    addToSummary(message);
  }
  
  if (typeof sayAndResume === 'function') {
    sayAndResume(`Obstacle detected: ${obstacleTypes}. Stopping immediately.`);
  }
}

// Update status
function updateDetectionPanel(message, type = "info") {
  const statusElement = document.getElementById('detectionStatus');
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.style.background = {
      'success': '#1b5e20', 'warning': '#e65100', 'danger': '#b71c1c',
      'error': '#b71c1c', 'info': '#2d2d2d'
    }[type] || '#2d2d2d';
  }
}

// 🎯 COMBO MODE EVENT LISTENERS - AUTO START/STOP

// Listen for camera start
document.addEventListener('camera:start', () => {
  console.log("📹 Camera started - AUTO-STARTING all-object detection!");
  startObstacleDetectionAuto();
});

document.addEventListener('camera:stop', () => {
  console.log("📹 Camera stopped - AUTO-STOPPING all-object detection!");
  stopObstacleDetectionAuto();
});

// Also listen for navigation events (backup triggers)
document.addEventListener('navigation:start', () => {
  console.log("🚀 Navigation started - COMBO MODE ACTIVATED!");
  startObstacleDetectionAuto();
});

document.addEventListener('navigation:end', () => {
  console.log("🏁 Navigation ended - keeping detection active for monitoring");
  // Keep running for safety monitoring
});

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
  console.log("🎯 Setting up COMBO all-object detection system...");
  setTimeout(initializeDetection, 2000);
});

// Global functions (for manual control if needed)
window.startObstacleDetection = startObstacleDetectionAuto;
window.stopObstacleDetection = stopObstacleDetectionAuto;
window.detectionActive = () => detectionActive;