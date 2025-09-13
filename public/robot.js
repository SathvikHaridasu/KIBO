// ===== ROBOT CONTROLLER MODULE =====
class RobotController {
  constructor() {
    this.isConnected = false;
    this.updateInterval = null;
    this.statusElements = {};
    this.config = {
      PI_IP: "10.37.117.213",
      ROBOT_PORT: 5001,
      CAMERA_PORT: 5004,
      DETECTION_PORT: 5005,
      BRIDGE_PORT: 3000
    };
    
    this.init();
  }
  
  async init() {
    console.log('🤖 Initializing Robot Controller...');
    this.setupStatusElements();
    this.setupCameraStreams();
    this.setupEventListeners();
    await this.testConnection();
    this.startStatusUpdates();
  }

  setupStatusElements() {
    this.statusElements = {
      battery: document.getElementById('batteryLevel'),
      mode: document.getElementById('robotMode'),
      speed: document.getElementById('robotSpeed'),
      direction: document.getElementById('robotDirection'),
      status: document.getElementById('robotStatus'),
      camera: document.getElementById('cameraStatus'),
      detection: document.getElementById('detectionStatus'),
      action: document.getElementById('currentAction')
    };
  }

  setupCameraStreams() {
    const cameraElement = document.getElementById('cameraStream');
    const detectionElement = document.getElementById('detectionStream');
    
    if (cameraElement) {
      cameraElement.src = `http://${this.config.PI_IP}:${this.config.CAMERA_PORT}/camera/stream`;
      cameraElement.onerror = () => this.updateStatus('camera', 'error', 'Camera offline');
      this.updateStatus('camera', 'ok', 'Camera active');
    }
    
    if (detectionElement) {
      detectionElement.src = `http://${this.config.PI_IP}:${this.config.DETECTION_PORT}/detection/stream`;
      detectionElement.onerror = () => this.updateStatus('detection', 'error', 'Detection offline');
      this.updateStatus('detection', 'ok', 'Detection active');
    }
  }

  async testConnection() {
    try {
      const response = await fetch(`http://${this.config.PI_IP}:${this.config.DETECTION_PORT}/health`);
      if (response.ok) {
        this.isConnected = true;
        this.updateStatus('status', 'ok', 'Connected to robot');
        return true;
      }
    } catch (error) {
      console.error('Connection test failed:', error);
    }
    
    this.isConnected = false;
    this.updateStatus('status', 'error', 'Robot offline');
    return false;
  }

  startStatusUpdates() {
    // Clear any existing interval
    if (this.updateInterval) clearInterval(this.updateInterval);
    
    // Initial update
    this.updateRobotData();
    
    // Set up periodic updates (every 2 seconds)
    this.updateInterval = setInterval(() => {
      this.updateRobotData();
    }, 2000);
  }

  async updateRobotData() {
    if (!this.isConnected) {
      await this.testConnection();
      if (!this.isConnected) return;
    }

    try {
      const response = await fetch(`http://${this.config.PI_IP}:${this.config.DETECTION_PORT}/robot/navigation_data`);
      if (!response.ok) throw new Error('Failed to fetch robot data');
      
      const data = await response.json();
      this.updateStatus('action', 'ok', data.action || 'No action');
      
      // Update other status elements as needed
      if (data.summary) {
        this.updateStatus('battery', 'ok', `${data.summary.battery || 85}%`);
        this.updateStatus('mode', 'ok', data.summary.mode || 'AUTONOMOUS');
      }
      
    } catch (error) {
      console.error('Failed to update robot data:', error);
      this.isConnected = false;
      this.updateStatus('status', 'error', 'Connection lost');
    }
  }

  async sendCommand(command, duration = 1.0) {
    if (!this.isConnected) {
      console.error('Cannot send command: Robot offline');
      return false;
    }

    try {
      const response = await fetch(`http://${this.config.PI_IP}:${this.config.ROBOT_PORT}/robot/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: command, duration })
      });
      
      if (!response.ok) throw new Error('Command failed');
      return true;
      
    } catch (error) {
      console.error('Command failed:', error);
      this.isConnected = false;
      this.updateStatus('status', 'error', 'Command failed');
      return false;
    }
  }

  updateStatus(element, status, message) {
    const el = this.statusElements[element];
    if (!el) return;
    
    el.textContent = message;
    el.className = `status-${status}`;
  }

  setupEventListeners() {
    // Movement controls
    document.getElementById('btnForward')?.addEventListener('mousedown', () => this.sendCommand('forward', 0.5));
    document.getElementById('btnBackward')?.addEventListener('mousedown', () => this.sendCommand('backward', 0.5));
    document.getElementById('btnLeft')?.addEventListener('mousedown', () => this.sendCommand('left', 0.3));
    document.getElementById('btnRight')?.addEventListener('mousedown', () => this.sendCommand('right', 0.3));
    
    // Stop all movement when mouse leaves button
    ['btnForward', 'btnBackward', 'btnLeft', 'btnRight'].forEach(btnId => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.addEventListener('mouseup', () => this.sendCommand('stop'));
        btn.addEventListener('mouseleave', () => this.sendCommand('stop'));
      }
    });
    
    // Emergency stop
    document.getElementById('btnStop')?.addEventListener('click', () => {
      this.sendCommand('stop');
      const stopBtn = document.getElementById('btnStop');
      if (stopBtn) {
        stopBtn.classList.add('emergency-stop-active');
        setTimeout(() => stopBtn.classList.remove('emergency-stop-active'), 500);
      }
    });
  }
}

// ===== ROBOT MOVEMENT FUNCTIONS FOR OBSTACLE AVOIDANCE =====

async function moveForward(duration) {
    return await robotController.sendCommand('forward', duration);
}

async function moveBackward(duration) {
    return await robotController.sendCommand('backward', duration);
}

async function turnLeft(duration) {
    return await robotController.sendCommand('left', duration);
}

async function turnRight(duration) {
    return await robotController.sendCommand('right', duration);
}

async function stopRobot() {
    return await robotController.sendCommand('stop');
}

// Make functions globally available
window.moveForward = moveForward;
window.moveBackward = moveBackward;
window.turnLeft = turnLeft;
window.turnRight = turnRight;
window.stopRobot = stopRobot;

// Initialize the robot controller when the page loads
let robotController;
document.addEventListener('DOMContentLoaded', () => {
  robotController = new RobotController();
  window.robot = robotController; // Make available globally for debugging
});

// Robot control functionality is now handled by the RobotController class