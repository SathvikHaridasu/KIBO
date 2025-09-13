// ===== ENHANCED DETECTION + OBSTACLE AVOIDANCE SYSTEM =====

// Detection configuration
const DETECTION_CONFIG = {
  PI_IP: "10.37.117.213",
  DETECTION_PORT: 5005,
  CHECK_INTERVAL: 300,
  UPDATE_INTERVAL: 500,
  OBSTACLE_THRESHOLD: 15
};

let detectionActive = false;
let detectionInterval = null;
let detectionPanel = null;

// ✅ NEW: Obstacle avoidance variables
let autoAvoidEnabled = false;
let distanceUpdateInterval = null;
let currentDistance = 999;
let obstacleAvoidanceActive = false;

// ===== ENHANCED INITIALIZATION =====
async function initializeDetection() {
  console.log("🔍 Initializing ENHANCED Detection + Obstacle Avoidance System...");
  
  // Create enhanced visual panel
  createEnhancedDetectionPanel();
  setupObstacleAvoidanceControls();
  
  try {
    const response = await fetch(`http://${DETECTION_CONFIG.PI_IP}:${DETECTION_CONFIG.DETECTION_PORT}/health`);
    
    if (response.ok) {
      const data = await response.json();
      console.log("✅ Detection + Obstacle Avoidance server ready:", data);
      updateDetectionPanel("🛡️ Detection + Obstacle Avoidance Ready", "success");
      
      // Start distance monitoring
      startDistanceMonitoring();
      return true;
    }
  } catch (error) {
    console.warn("⚠️ Detection server not available:", error);
    updateDetectionPanel("❌ Detection Server Offline", "error");
    return false;
  }
}

// ===== ENHANCED PANEL CREATION =====
function createEnhancedDetectionPanel() {
  let container = document.querySelector('#status-container') || document.body;
  
  const panelHTML = `
    <div id="detectionPanel" class="enhanced-detection-panel">
      <div class="panel-header">
        <h3>🛡️ Smart Detection + Obstacle Avoidance</h3>
        <div class="status-row">
          <div id="detectionToggle" class="detection-toggle inactive">Detection: Inactive</div>
          <div id="obstacleStatus" class="obstacle-status">Obstacle: Ready</div>
        </div>
      </div>
      
      <!-- Distance Display -->
      <div class="distance-section">
        <div class="distance-display">
          <div class="distance-value">
            <span id="currentDistance">--</span>
            <span class="unit">cm</span>
          </div>
          <div class="distance-bar">
            <div id="distanceBar" class="bar-fill"></div>
          </div>
        </div>
        <div id="obstacleWarning" class="obstacle-warning hidden">⚠️ OBSTACLE DETECTED</div>
      </div>

      <!-- Control Buttons -->
      <div class="control-buttons">
        <button id="toggleAutoAvoid" class="control-btn auto-avoid-off">
          <i class="fas fa-shield-alt"></i>
          <span>Auto-Avoid OFF</span>
        </button>
        <button id="scanPathBtn" class="control-btn scan-btn">
          <i class="fas fa-radar-chart"></i>
          <span>Scan Path</span>
        </button>
        <button id="checkObstaclesBtn" class="control-btn check-btn">
          <i class="fas fa-eye"></i>
          <span>Check Now</span>
        </button>
      </div>

      <!-- Scan Results -->
      <div id="scanResults" class="scan-results hidden">
        <h4>🔍 Path Scan Results:</h4>
        <div class="scan-directions">
          <div class="scan-direction">
            <span class="direction-label">⬅️ Left</span>
            <span id="scanLeft" class="direction-value">--</span>
          </div>
          <div class="scan-direction">
            <span class="direction-label">⬆️ Center</span>
            <span id="scanCenter" class="direction-value">--</span>
          </div>
          <div class="scan-direction">
            <span class="direction-label">➡️ Right</span>
            <span id="scanRight" class="direction-value">--</span>
          </div>
        </div>
        <div id="bestDirection" class="best-direction">
          🎯 Best Path: <span id="recommendedDirection">--</span>
        </div>
      </div>

      <!-- Detection Content -->
      <div id="detectionContent" class="detection-content">
        <div id="detectionStatus" class="detection-status">Waiting for camera activation...</div>
        <div id="detectedObjects" class="detected-objects"></div>
      </div>
    </div>
  `;
  
  container.insertAdjacentHTML('beforeend', panelHTML);
  
  // Add enhanced CSS styles
  addEnhancedStyles();
  detectionPanel = document.getElementById('detectionPanel');
}

// ===== ENHANCED STYLES =====
function addEnhancedStyles() {
  const styles = `
    <style>
    .enhanced-detection-panel {
      background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
      border: 2px solid #00ff80;
      border-radius: 12px;
      padding: 20px;
      margin: 15px;
      font-family: 'Courier New', monospace;
      color: white;
      max-width: 450px;
      box-shadow: 0 4px 12px rgba(0,255,128,0.2);
    }
    
    .panel-header {
      margin-bottom: 20px;
    }
    
    .panel-header h3 {
      color: #00ff80;
      margin: 0 0 10px 0;
      font-size: 16px;
    }
    
    .status-row {
      display: flex;
      gap: 10px;
    }
    
    .detection-toggle, .obstacle-status {
      padding: 5px 10px;
      border-radius: 15px;
      font-size: 11px;
      font-weight: bold;
      flex: 1;
      text-align: center;
    }
    
    .detection-toggle.active, .obstacle-status.active {
      background: #4CAF50;
      color: white;
    }
    
    .detection-toggle.inactive, .obstacle-status.ready {
      background: #666;
      color: white;
    }
    
    .obstacle-status.warning {
      background: #ffaa00;
      color: black;
    }
    
    .obstacle-status.danger {
      background: #ff4444;
      color: white;
    }
    
    .distance-section {
      background: rgba(0,0,0,0.3);
      padding: 15px;
      border-radius: 10px;
      margin-bottom: 15px;
      text-align: center;
    }
    
    .distance-value {
      font-size: 28px;
      font-weight: bold;
      color: #00ff80;
      margin-bottom: 10px;
    }
    
    .distance-value .unit {
      font-size: 14px;
      color: #ccc;
    }
    
    .distance-bar {
      width: 100%;
      height: 6px;
      background: #333;
      border-radius: 3px;
      overflow: hidden;
      margin-bottom: 10px;
    }
    
    .bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #ff4444 0%, #ffaa00 50%, #00ff80 100%);
      width: 0%;
      transition: width 0.3s ease;
    }
    
    .obstacle-warning {
      background: #ff4444;
      color: white;
      padding: 6px 12px;
      border-radius: 15px;
      font-weight: bold;
      font-size: 12px;
      animation: pulse 1.5s infinite;
    }
    
    .obstacle-warning.hidden {
      display: none;
    }
    
    .control-buttons {
      display: flex;
      gap: 8px;
      margin-bottom: 15px;
    }
    
    .control-btn {
      flex: 1;
      padding: 10px 6px;
      border: none;
      border-radius: 6px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.3s ease;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      font-size: 10px;
    }
    
    .control-btn i {
      font-size: 14px;
    }
    
    .auto-avoid-off {
      background: #666;
      color: white;
    }
    
    .auto-avoid-on {
      background: #ff4444;
      color: white;
      animation: pulse 2s infinite;
    }
    
    .scan-btn {
      background: #ffaa00;
      color: black;
    }
    
    .check-btn {
      background: #00aaff;
      color: white;
    }
    
    .control-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 3px 6px rgba(0,0,0,0.3);
    }
    
    .scan-results {
      background: rgba(255,170,0,0.1);
      border: 1px solid #ffaa00;
      border-radius: 8px;
      padding: 12px;
      margin-bottom: 15px;
    }
    
    .scan-results.hidden {
      display: none;
    }
    
    .scan-results h4 {
      margin: 0 0 10px 0;
      color: #ffaa00;
      font-size: 13px;
    }
    
    .scan-directions {
      display: flex;
      justify-content: space-around;
      margin-bottom: 10px;
    }
    
    .scan-direction {
      text-align: center;
      background: rgba(0,0,0,0.3);
      padding: 8px;
      border-radius: 4px;
      min-width: 60px;
    }
    
    .direction-label {
      display: block;
      font-size: 10px;
      color: #ccc;
      margin-bottom: 4px;
    }
    
    .direction-value {
      display: block;
      font-size: 12px;
      font-weight: bold;
      color: #00ff80;
    }
    
    .best-direction {
      text-align: center;
      font-size: 12px;
      font-weight: bold;
      color: #00ff80;
    }
    
    .detection-status {
      color: #fff;
      margin-bottom: 10px;
      padding: 8px;
      background: #2d2d2d;
      border-radius: 4px;
      font-size: 12px;
    }
    
    .detected-objects {
      max-height: 150px;
      overflow-y: auto;
    }
    
    .detected-object {
      background: #2d2d2d;
      margin: 4px 0;
      padding: 6px;
      border-radius: 4px;
      border-left: 3px solid #4CAF50;
      font-size: 11px;
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
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    
    @media (max-width: 768px) {
      .control-buttons {
        flex-direction: column;
      }
      
      .scan-directions {
        flex-direction: column;
        gap: 6px;
      }
    }
    </style>
  `;
  
  document.head.insertAdjacentHTML('beforeend', styles);
}

// ===== OBSTACLE AVOIDANCE CONTROLS =====
function setupObstacleAvoidanceControls() {
  // Auto-avoid toggle
  setTimeout(() => {
    const autoAvoidBtn = document.getElementById('toggleAutoAvoid');
    if (autoAvoidBtn) {
      autoAvoidBtn.addEventListener('click', toggleAutoAvoid);
    }
    
    // Manual scan button
    const scanBtn = document.getElementById('scanPathBtn');
    if (scanBtn) {
      scanBtn.addEventListener('click', scanForPath);
    }
    
    // Check obstacles button  
    const checkBtn = document.getElementById('checkObstaclesBtn');
    if (checkBtn) {
      checkBtn.addEventListener('click', checkObstacles);
    }
  }, 100);
}

// ===== DISTANCE MONITORING =====
function startDistanceMonitoring() {
  if (distanceUpdateInterval) {
    clearInterval(distanceUpdateInterval);
  }
  
  distanceUpdateInterval = setInterval(async () => {
    await updateDistance();
  }, DETECTION_CONFIG.UPDATE_INTERVAL);
  
  console.log("📡 Distance monitoring started");
}

async function updateDistance() {
  try {
    const response = await fetch(`http://${DETECTION_CONFIG.PI_IP}:${DETECTION_CONFIG.DETECTION_PORT}/ultrasonic_distance`);
    
    if (!response.ok) throw new Error('Distance request failed');
    
    const data = await response.json();
    currentDistance = data.distance_cm;
    
    // Update UI
    updateDistanceDisplay(data.distance_cm);
    
    // Check for obstacles if auto-avoid is enabled
    if (autoAvoidEnabled && data.obstacle_detected) {
      await handleAutoAvoid();
    }
    
  } catch (error) {
    console.warn('Distance update failed:', error);
    updateDistanceDisplay(999); // Show offline
  }
}

function updateDistanceDisplay(distance) {
  // Update distance value
  const distanceElement = document.getElementById('currentDistance');
  if (distanceElement) {
    distanceElement.textContent = distance === 999 ? '--' : distance;
  }
  
  // Update distance bar (0-100cm range)
  const barElement = document.getElementById('distanceBar');
  if (barElement) {
    const percentage = distance === 999 ? 0 : Math.min((distance / 100) * 100, 100);
    barElement.style.width = percentage + '%';
  }
  
  // Update obstacle warning
  const warningElement = document.getElementById('obstacleWarning');
  if (warningElement) {
    if (distance < DETECTION_CONFIG.OBSTACLE_THRESHOLD && distance !== 999) {
      warningElement.classList.remove('hidden');
    } else {
      warningElement.classList.add('hidden');
    }
  }
  
  // Update obstacle status
  const statusElement = document.getElementById('obstacleStatus');
  if (statusElement) {
    if (distance < DETECTION_CONFIG.OBSTACLE_THRESHOLD && distance !== 999) {
      statusElement.textContent = `Obstacle: ${distance}cm DANGER`;
      statusElement.className = 'obstacle-status danger';
    } else if (distance < 50 && distance !== 999) {
      statusElement.textContent = `Obstacle: ${distance}cm Warning`;
      statusElement.className = 'obstacle-status warning';
    } else {
      statusElement.textContent = distance === 999 ? 'Obstacle: Offline' : `Obstacle: ${distance}cm Clear`;
      statusElement.className = 'obstacle-status ready';
    }
  }
}

// ===== OBSTACLE AVOIDANCE FUNCTIONS =====
function toggleAutoAvoid() {
  autoAvoidEnabled = !autoAvoidEnabled;
  
  const button = document.getElementById('toggleAutoAvoid');
  if (button) {
    if (autoAvoidEnabled) {
      button.className = 'control-btn auto-avoid-on';
      button.innerHTML = `
        <i class="fas fa-shield-alt"></i>
        <span>Auto-Avoid ON</span>
      `;
    } else {
      button.className = 'control-btn auto-avoid-off';
      button.innerHTML = `
        <i class="fas fa-shield-alt"></i>
        <span>Auto-Avoid OFF</span>
      `;
    }
  }
  
  if (typeof addToSummary === 'function') {
    addToSummary(`🛡️ Auto-avoid ${autoAvoidEnabled ? 'enabled' : 'disabled'}`);
  }
  
  console.log(`🛡️ Auto-avoid ${autoAvoidEnabled ? 'ENABLED' : 'DISABLED'}`);
}

async function checkObstacles() {
  try {
    updateDetectionPanel('🔍 Checking obstacles...', 'info');
    
    const response = await fetch(`http://${DETECTION_CONFIG.PI_IP}:${DETECTION_CONFIG.DETECTION_PORT}/obstacle_check`);
    
    if (!response.ok) throw new Error('Obstacle check failed');
    
    const data = await response.json();
    console.log('🔍 Obstacle check result:', data);
    
    // Update status based on result
    let statusMessage = '';
    switch(data.action) {
      case 'AVOID_SCAN':
        statusMessage = '🚨 OBSTACLES DETECTED - Scan recommended';
        break;
      case 'CAMERA_AVOID':
        statusMessage = '👁️ Camera detects obstacles ahead';
        break;
      case 'CLEAR':
        statusMessage = '✅ Path clear - safe to proceed';
        break;
    }
    
    updateDetectionPanel(statusMessage, data.action === 'CLEAR' ? 'success' : 'warning');
    
    if (typeof addToSummary === 'function') {
      addToSummary(`🔍 ${statusMessage}`);
    }
    
    return data;
    
  } catch (error) {
    console.error('Obstacle check error:', error);
    updateDetectionPanel('❌ Obstacle check failed', 'error');
  }
}

async function scanForPath() {
  try {
    const button = document.getElementById('scanPathBtn');
    if (button) {
      button.innerHTML = `<i class="fas fa-spinner fa-spin"></i><span>Scanning...</span>`;
      button.disabled = true;
    }
    
    updateDetectionPanel('🔄 Scanning for clear path...', 'info');
    
    const response = await fetch(`http://${DETECTION_CONFIG.PI_IP}:${DETECTION_CONFIG.DETECTION_PORT}/scan_path`, {
      method: 'POST'
    });
    
    if (!response.ok) throw new Error('Path scan failed');
    
    const data = await response.json();
    console.log('📡 Scan results:', data);
    
    // Display scan results
    displayScanResults(data);
    
    if (typeof addToSummary === 'function') {
      addToSummary(`📡 Best path: ${data.best_direction} (${data.best_distance}cm)`);
    }
    
    updateDetectionPanel(`🎯 Best path: ${data.best_direction} - ${data.best_distance}cm`, 'success');
    
    return data;
    
  } catch (error) {
    console.error('Path scan error:', error);
    updateDetectionPanel('❌ Path scan failed', 'error');
  } finally {
    const button = document.getElementById('scanPathBtn');
    if (button) {
      button.innerHTML = `<i class="fas fa-radar-chart"></i><span>Scan Path</span>`;
      button.disabled = false;
    }
  }
}

function displayScanResults(data) {
  const resultsDiv = document.getElementById('scanResults');
  if (!resultsDiv) return;
  
  // Show results panel
  resultsDiv.classList.remove('hidden');
  
  // Update direction values
  document.getElementById('scanLeft').textContent = `${data.scan_results.left}cm`;
  document.getElementById('scanCenter').textContent = `${data.scan_results.center}cm`;
  document.getElementById('scanRight').textContent = `${data.scan_results.right}cm`;
  
  // Update best direction
  const directionElement = document.getElementById('recommendedDirection');
  if (directionElement) {
    directionElement.textContent = data.best_direction.toUpperCase();
  }
  
  // Auto-hide after 8 seconds
  setTimeout(() => {
    resultsDiv.classList.add('hidden');
  }, 8000);
}

async function handleAutoAvoid() {
  if (!autoAvoidEnabled || obstacleAvoidanceActive) return;
  
  obstacleAvoidanceActive = true;
  console.log('🚨 Auto-avoid triggered!');
  
  try {
    // Check obstacles
    const obstacleData = await checkObstacles();
    
    if (obstacleData && obstacleData.action === 'AVOID_SCAN') {
      console.log('🔄 Auto-scanning for clear path...');
      
      // Automatically scan for path
      const scanData = await scanForPath();
      
      if (scanData && scanData.best_direction) {
        if (typeof addToSummary === 'function') {
          addToSummary(`🤖 Auto-avoid: Go ${scanData.best_direction} (${scanData.best_distance}cm clear)`);
        }
        console.log(`🎯 Auto-avoid recommends: ${scanData.best_direction}`);
      }
    }
  } finally {
    // Reset after 5 seconds
    setTimeout(() => {
      obstacleAvoidanceActive = false;
    }, 5000);
  }
}

// ===== EXISTING DETECTION FUNCTIONS (PRESERVED) =====
async function startObstacleDetectionAuto() {
  if (detectionActive) return;
  
  console.log("🚀 COMBO MODE ACTIVATED: Camera + ALL-OBJECT Detection + Obstacle Avoidance!");
  updateDetectionPanel("🔄 Activating universal object detection...", "info");
  
  try {
    const response = await fetch(`http://${DETECTION_CONFIG.PI_IP}:${DETECTION_CONFIG.DETECTION_PORT}/detection/start`, {
      method: 'POST'
    });
    
    if (response.ok) {
      detectionActive = true;
      
      // Update detection toggle
      const toggle = document.getElementById('detectionToggle');
      if (toggle) {
        toggle.textContent = 'Detection: Active';
        toggle.className = 'detection-toggle active';
      }
      
      // Start obstacle monitoring
      detectionInterval = setInterval(checkForObstaclesEnhanced, DETECTION_CONFIG.CHECK_INTERVAL);
      
      console.log("🎯 ENHANCED SYSTEM ONLINE - Detection + Obstacle Avoidance!");
      updateDetectionPanel("🛡️ Enhanced detection + obstacle avoidance active", "success");
      
      if (typeof addToSummary === 'function') {
        addToSummary("🎯 Enhanced Detection + Obstacle Avoidance Active!");
      }
    }
  } catch (error) {
    console.error("❌ Enhanced system start failed:", error);
    updateDetectionPanel("❌ Failed to start enhanced detection", "error");
  }
}

async function stopObstacleDetectionAuto() {
  if (!detectionActive) return;
  
  console.log("🛑 ENHANCED MODE: Stopping detection with camera...");
  
  try {
    await fetch(`http://${DETECTION_CONFIG.PI_IP}:${DETECTION_CONFIG.DETECTION_PORT}/detection/stop`, {
      method: 'POST'
    });
    
    detectionActive = false;
    
    if (detectionInterval) {
      clearInterval(detectionInterval);
      detectionInterval = null;
    }
    
    // Update detection toggle
    const toggle = document.getElementById('detectionToggle');
    if (toggle) {
      toggle.textContent = 'Detection: Inactive';
      toggle.className = 'detection-toggle inactive';
    }
    
    updateDetectionPanel("📹 Camera stopped - Detection paused", "info");
    document.getElementById('detectedObjects').innerHTML = '';
    
    console.log("✅ Enhanced detection stopped with camera");
  } catch (error) {
    console.error("❌ Failed to stop detection:", error);
  }
}

// ===== REST OF EXISTING FUNCTIONS (PRESERVED) =====
async function checkForObstaclesEnhanced() {
  if (!detectionActive) return;
  
  try {
    const response = await fetch(`http://${DETECTION_CONFIG.PI_IP}:${DETECTION_CONFIG.DETECTION_PORT}/detection/obstacles`);
    
    if (response.ok) {
      const data = await response.json();
      
      // Update visual display
      displayDetectedObjects(data.objects);
      
      if (data.danger_count > 0) {
        console.log("🚨 ENHANCED ALERT: DANGEROUS OBSTACLES IN VIEW!");
        console.table(data.obstacles.filter(obs => obs.threat_level === 'danger'));
        await handleDangerousObstacles(data.obstacles);
        
      } else if (data.obstacle_count > 0) {
        console.log(`👀 Enhanced monitoring: ${data.obstacle_count} objects`);
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

function displayDetectedObjects(obstacles) {
  const container = document.getElementById('detectedObjects');
  if (!container) return;

  if (!obstacles || !Array.isArray(obstacles)) {
    console.warn('Invalid obstacles data:', obstacles);
    container.innerHTML = '<div style="color: #ff9800; text-align: center;">Detection data unavailable</div>';
    return;
  }

  if (obstacles.length === 0) {
    container.innerHTML = '<div style="color: #4CAF50; text-align: center;">No obstacles detected</div>';
    return;
  }

  let html = '';
  obstacles.forEach(obstacle => {
    const confidence = Math.round(obstacle.confidence * 100);
    html += `
      <div style="padding: 4px; margin: 2px; background: #f0f0f0; border-radius: 3px; font-size: 10px;">
        🔍 <strong>${obstacle.class}</strong> 
        (${confidence}%, pos: ${obstacle.position.toFixed(1)})
      </div>
    `;
  });
  
  container.innerHTML = html;
}

async function handleDangerousObstacles(obstacles) {
  const dangerousObs = obstacles.filter(obs => obs.threat_level === 'danger');
  
  console.log("🚨🚨🚨 ENHANCED EMERGENCY: DANGEROUS OBJECTS DETECTED! 🚨🚨🚨");
  
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

// ===== EVENT LISTENERS FOR AUTO-START/STOP =====

// Listen for camera start
document.addEventListener('camera:start', () => {
  console.log("📹 Camera started - AUTO-STARTING enhanced detection!");
  startObstacleDetectionAuto();
});

document.addEventListener('camera:stop', () => {
  console.log("📹 Camera stopped - AUTO-STOPPING enhanced detection!");
  stopObstacleDetectionAuto();
});

// Listen for navigation events
document.addEventListener('navigation:start', () => {
  console.log("🚀 Navigation started - ENHANCED MODE ACTIVATED!");
  startObstacleDetectionAuto();
});

document.addEventListener('navigation:end', () => {
  console.log("🏁 Navigation ended - keeping enhanced detection active for monitoring");
  // Keep running for safety monitoring
});

// ===== GLOBAL INTEGRATION FUNCTIONS =====

// Make obstacle avoidance functions globally available for navigation integration
window.getCurrentDistance = () => currentDistance;
window.isAutoAvoidEnabled = () => autoAvoidEnabled;
window.checkObstacleAvoidance = checkObstacles;
window.scanForClearPath = scanForPath;
window.getObstacleAvoidanceData = () => ({
  currentDistance,
  autoAvoidEnabled,
  obstacleAvoidanceActive,
  isSystemActive: distanceUpdateInterval !== null
});

// Integration with existing navigation system
window.handleNavigationObstacles = async function(command, distanceInMeters) {
  if (!autoAvoidEnabled) return { safe: true, recommendation: null };
  
  console.log(`🛡️ Checking obstacles before ${command} movement (${distanceInMeters}m)`);
  
  // Check current distance
  if (currentDistance < DETECTION_CONFIG.OBSTACLE_THRESHOLD && currentDistance !== 999) {
    console.log(`🚨 Obstacle detected: ${currentDistance}cm - triggering avoidance`);
    
    // Check obstacles using both sensors
    const obstacleData = await checkObstacles();
    
    if (obstacleData && obstacleData.action === 'AVOID_SCAN') {
      // Scan for clear path
      const scanData = await scanForPath();
      
      if (scanData && scanData.best_direction) {
        return {
          safe: false,
          recommendation: scanData.best_direction,
          distance: scanData.best_distance,
          action: 'DETOUR',
          message: `Obstacle at ${currentDistance}cm - recommend ${scanData.best_direction} (${scanData.best_distance}cm clear)`
        };
      } else {
        return {
          safe: false,
          recommendation: null,
          action: 'STOP',
          message: `Obstacle at ${currentDistance}cm - no clear path found`
        };
      }
    }
  }
  
  return { safe: true, recommendation: null };
};

// Emergency stop function for dangerous obstacles
window.emergencyObstacleStop = async function() {
  console.log("🚨 EMERGENCY OBSTACLE STOP TRIGGERED!");
  
  // Stop robot if function is available
  if (typeof stopRobot === 'function') {
    await stopRobot();
  }
  
  // Update UI
  updateDetectionPanel("🚨 EMERGENCY STOP - Dangerous obstacle detected!", "danger");
  
  // Add to summary
  if (typeof addToSummary === 'function') {
    addToSummary("🚨 Emergency stop - dangerous obstacle detected");
  }
  
  // Voice announcement
  if (typeof sayAndResume === 'function') {
    sayAndResume("Emergency stop activated due to dangerous obstacle. Please assist.");
  }
};

// ===== INITIALIZATION ON PAGE LOAD =====
document.addEventListener('DOMContentLoaded', async () => {
  console.log("🛡️ Setting up ENHANCED detection + obstacle avoidance system...");
  setTimeout(initializeDetection, 2000);
});

// ===== GLOBAL FUNCTIONS FOR MANUAL CONTROL =====
window.startObstacleDetection = startObstacleDetectionAuto;
window.stopObstacleDetection = stopObstacleDetectionAuto;
window.detectionActive = () => detectionActive;
window.toggleObstacleAvoidance = toggleAutoAvoid;
window.manualObstacleCheck = checkObstacles;
window.manualPathScan = scanForPath;

// ===== UTILITY FUNCTIONS =====

// Get emoji for ALL YOLO objects (PRESERVED FROM ORIGINAL)
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
    'bottle': '🍶', 'wine glass': '🍷', 'cup': '☕', 'bowl': '🍲',
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

console.log("🛡️ Enhanced Detection + Obstacle Avoidance System loaded successfully!");