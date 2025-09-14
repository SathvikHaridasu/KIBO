// ===== STREAMLINED ROVER DASHBOARD =====
class RoverDashboard {
    constructor() {
        this.isConnected = false;
        this.updateInterval = null;
        this.PI_IP = "10.37.117.213";
        
        // UI Elements
        this.connectionDot = document.getElementById('connection-dot');
        this.connectionText = document.getElementById('connection-text');
        this.loadingScreen = document.getElementById('loading-screen');
        this.dashboardContent = document.getElementById('dashboard-content');
        
        // Status elements
        this.statusElements = {
            battery: document.querySelector('.battery-level'),
            mode: document.querySelector('.robo-mode'),
            speed: document.querySelector('.robo-speed'),
            direction: document.querySelector('.robo-direction'),
            temperature: document.querySelector('.robo-temp'),
            distance: document.querySelector('.robo-distance'),
            obstacles: document.querySelector('.obstacle-count'),
            action: document.querySelector('.current-action')
        };
        
        this.init();
    }

    async init() {
        console.log('🚀 Starting Rover Dashboard...');
        
        // Setup camera streams
        this.setupCameraStreams();
        
        // Initialize obstacle avoidance
        this.initializeObstacleAvoidance();
        
        // Test initial connection
        await this.testConnection();
        
        // Start status updates if connected
        if (this.isConnected) {
            this.startStatusUpdates();
        }
        
        // ✅ AUTO-START STREAMS IMMEDIATELY
        setTimeout(() => {
            this.startCameraStreams();
        }, 1000);
        
        console.log('✅ Rover Dashboard initialized!');
    }

    setupCameraStreams() {
        const stopBtn = document.getElementById('stop-streams');
        
        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopCameraStreams());
        }
    }

    async startCameraStreams() {
        console.log('🎥 Auto-starting camera streams...');
        
        const detectionStream = document.getElementById('detection-stream');
        const cameraStream = document.getElementById('camera-stream');
        
        try {
            // Start detection stream
            if (detectionStream) {
                detectionStream.src = `http://${this.PI_IP}:5005/detection_stream?t=${Date.now()}`;
                detectionStream.onload = () => {
                    document.getElementById('detection-status').textContent = 'Active';
                    document.getElementById('detection-status').className = 'stream-status active';
                    document.getElementById('detection-info').textContent = 'Active';
                };
                detectionStream.onerror = () => this.handleStreamError('detection');
            }
            
            // Start camera stream (flipped)
            if (cameraStream) {
                cameraStream.src = `http://${this.PI_IP}:5004/camera/stream?t=${Date.now()}`;
                cameraStream.onload = () => {
                    document.getElementById('camera-status').textContent = 'Live';
                    document.getElementById('camera-status').className = 'stream-status active';
                    document.getElementById('camera-info').textContent = 'Active';
                };
                cameraStream.onerror = () => this.handleStreamError('camera');
            }
            
            // Start detection system if available
            if (typeof startObstacleDetectionAuto === 'function') {
                startObstacleDetectionAuto();
            }
            
            this.addLog('Camera streams auto-started', 'success');
            
        } catch (error) {
            console.error('❌ Camera stream error:', error);
            this.addLog('Camera stream error: ' + error.message, 'error');
        }
    }

    async stopCameraStreams() {
        console.log('🛑 Stopping camera streams...');
        
        const detectionStream = document.getElementById('detection-stream');
        const cameraStream = document.getElementById('camera-stream');
        
        // Stop streams
        if (detectionStream) {
            detectionStream.src = '';
            document.getElementById('detection-status').textContent = 'Stopped';
            document.getElementById('detection-status').className = 'stream-status error';
            document.getElementById('detection-info').textContent = 'Stopped';
        }
        
        if (cameraStream) {
            cameraStream.src = '';
            document.getElementById('camera-status').textContent = 'Stopped';
            document.getElementById('camera-status').className = 'stream-status error';
            document.getElementById('camera-info').textContent = 'Stopped';
        }
        
        // Stop detection system if available
        if (typeof stopObstacleDetectionAuto === 'function') {
            stopObstacleDetectionAuto();
        }
        
        this.addLog('Camera streams stopped', 'info');
    }

    handleStreamError(streamType) {
        console.error(`❌ ${streamType} stream error`);
        this.addLog(`${streamType} stream connection failed`, 'error');
        
        const statusElement = document.getElementById(`${streamType}-status`);
        const infoElement = document.getElementById(`${streamType}-info`);
        
        if (statusElement) {
            statusElement.textContent = 'Error';
            statusElement.className = 'stream-status error';
        }
        
        if (infoElement) {
            infoElement.textContent = 'Error';
        }
    }

    async testConnection() {
        try {
            const response = await fetch(`http://${this.PI_IP}:5005/health`, { 
                signal: AbortSignal.timeout(5000) 
            });
            
            if (response.ok) {
                this.isConnected = true;
                this.updateConnectionStatus(true, 'Connected');
                this.showDashboard();
                console.log('✅ Robot connection successful');
                this.addLog('Connected to rover', 'success');
            } else {
                throw new Error('Health check failed');
            }
        } catch (error) {
            console.error('❌ Robot connection failed:', error);
            this.isConnected = false;
            this.updateConnectionStatus(false, 'Offline');
            this.showLoadingScreen('Robot is offline. Retrying...');
            
            // Retry connection after 5 seconds
            setTimeout(() => this.testConnection(), 5000);
        }
    }

    startStatusUpdates() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        
        this.updateInterval = setInterval(() => {
            this.updateRobotStatus();
        }, 2000);
        
        // Initial update
        this.updateRobotStatus();
        console.log('📊 Status updates started');
    }

    async updateRobotStatus() {
        try {
            const response = await fetch(`http://${this.PI_IP}:5005/robot/navigation_data`);
            
            if (!response.ok) throw new Error('Navigation data unavailable');
            
            const data = await response.json();
            
            // Update dashboard elements
            this.updateStatusElements({
                battery: data.battery || 85,
                mode: data.mode || "AUTONOMOUS", 
                speed: data.speed || "0 m/s",
                direction: data.action || "STOPPED",
                temperature: data.temperature || "--°C",
                distance: data.distance || "-- cm",
                obstacles: data.summary?.obstacle_count || 0,
                action: data.action || "STANDBY"
            });
            
            // Update detection stats
            this.updateDetectionStats(data.summary);
            
            // Update connection status if needed
            if (!this.isConnected) {
                this.isConnected = true;
                this.updateConnectionStatus(true, 'Connected');
                this.showDashboard();
            }
            
        } catch (error) {
            console.warn('📊 Status update failed:', error);
            if (this.isConnected) {
                this.isConnected = false;
                this.updateConnectionStatus(false, 'Connection Lost');
                this.addLog('Lost connection to rover', 'error');
            }
        }
    }

    updateStatusElements(data) {
        Object.entries(data).forEach(([key, value]) => {
            const element = this.statusElements[key];
            if (element) {
                element.textContent = value;
            }
        });
        
        // Update battery fill indicator
        if (data.battery && typeof data.battery === 'number') {
            const batteryFill = document.querySelector('.battery-fill');
            if (batteryFill) {
                batteryFill.style.width = `${Math.max(0, Math.min(100, data.battery))}%`;
            }
        }
    }

    updateDetectionStats(data) {
        if (!data) return;
        
        const objectsEl = document.getElementById('detection-count');
        const threatEl = document.getElementById('threat-level');
        const safetyEl = document.getElementById('safety-status');
        
        if (objectsEl) objectsEl.textContent = data.object_count || 0;
        
        if (threatEl) {
            const threat = data.danger_count > 0 ? 'DANGER' : 
                         data.obstacle_count > 0 ? 'CAUTION' : 'SAFE';
            threatEl.textContent = threat;
            threatEl.className = `stat-value threat-${threat.toLowerCase()}`;
        }
        
        if (safetyEl) {
            const status = data.danger_count > 0 ? 'DANGER' : 
                         data.obstacle_count > 0 ? 'WARNING' : 'SAFE';
            safetyEl.textContent = status;
        }
    }

    updateConnectionStatus(connected, message) {
        if (this.connectionDot) {
            this.connectionDot.className = connected ? 'indicator-dot connected' : 'indicator-dot';
        }
        if (this.connectionText) {
            this.connectionText.textContent = message;
        }
        
        const systemStatus = document.getElementById('system-status');
        if (systemStatus) {
            systemStatus.textContent = connected ? 'Online' : 'Offline';
        }
    }

    showLoadingScreen(message) {
        if (this.loadingScreen) this.loadingScreen.style.display = 'flex';
        if (this.dashboardContent) this.dashboardContent.style.display = 'none';
        
        const loadingMessage = document.getElementById('loading-message');
        if (loadingMessage) loadingMessage.textContent = message;
    }

    showDashboard() {
        if (this.loadingScreen) this.loadingScreen.style.display = 'none';
        if (this.dashboardContent) this.dashboardContent.style.display = 'block';
    }

    // ===== OBSTACLE AVOIDANCE INTEGRATION =====
    initializeObstacleAvoidance() {
        console.log("🛡️ Initializing obstacle avoidance integration...");
        
        this.autoAvoidEnabled = false;
        this.currentDistance = 999;
        this.obstacleAvoidanceActive = false;
        
        // Setup obstacle control event listeners
        const autoAvoidBtn = document.getElementById('toggleAutoAvoid');
        const scanBtn = document.getElementById('scanPathBtn');
        const checkBtn = document.getElementById('checkObstaclesBtn');
        
        if (autoAvoidBtn) {
            autoAvoidBtn.addEventListener('click', () => this.toggleAutoAvoid());
        }
        
        if (scanBtn) {
            scanBtn.addEventListener('click', () => this.scanForPath());
        }
        
        if (checkBtn) {
            checkBtn.addEventListener('click', () => this.checkObstacles());
        }
        
        // Start distance monitoring
        this.startDistanceMonitoring();
        
        console.log("✅ Obstacle avoidance integration ready");
    }

    startDistanceMonitoring() {
        setInterval(async () => {
            await this.updateDistance();
        }, 500);
    }

    async updateDistance() {
        try {
            const response = await fetch(`http://${this.PI_IP}:5005/ultrasonic_distance`);
            if (!response.ok) throw new Error('Distance request failed');
            
            const data = await response.json();
            this.currentDistance = data.distance_cm;
            
            this.updateDistanceDisplay(data.distance_cm);
            
            if (this.autoAvoidEnabled && data.obstacle_detected) {
                await this.handleAutoAvoid();
            }
            
        } catch (error) {
            this.updateDistanceDisplay(999);
        }
    }

    updateDistanceDisplay(distance) {
        const distanceEl = document.getElementById('currentDistance');
        const barEl = document.getElementById('distanceBar');
        const warningEl = document.getElementById('obstacleWarning');
        const statusEl = document.getElementById('ultrasonicStatus');
        
        if (distanceEl) {
            distanceEl.textContent = distance === 999 ? '--' : distance;
        }
        
        if (barEl) {
            const percentage = distance === 999 ? 0 : Math.min((distance / 100) * 100, 100);
            barEl.style.width = percentage + '%';
        }
        
        if (warningEl) {
            if (distance < 15 && distance !== 999) {
                warningEl.classList.remove('hidden');
            } else {
                warningEl.classList.add('hidden');
            }
        }
        
        if (statusEl) {
            if (distance === 999) {
                statusEl.textContent = '📡 Ultrasonic: Offline';
                statusEl.className = 'status-chip danger';
            } else if (distance < 15) {
                statusEl.textContent = `📡 Ultrasonic: ${distance}cm DANGER`;
                statusEl.className = 'status-chip danger';
            } else if (distance < 50) {
                statusEl.textContent = `📡 Ultrasonic: ${distance}cm Warning`;
                statusEl.className = 'status-chip warning';
            } else {
                statusEl.textContent = `📡 Ultrasonic: ${distance}cm Clear`;
                statusEl.className = 'status-chip active';
            }
        }
        
        // Update rover status distance
        if (this.statusElements.distance) {
            this.statusElements.distance.textContent = distance === 999 ? '-- cm' : `${distance} cm`;
        }
    }

    toggleAutoAvoid() {
        this.autoAvoidEnabled = !this.autoAvoidEnabled;
        
        const button = document.getElementById('toggleAutoAvoid');
        const modeStatus = document.getElementById('avoidanceMode');
        
        if (button) {
            if (this.autoAvoidEnabled) {
                button.className = 'btn btn-sm obstacle-btn auto-avoid-on';
                button.innerHTML = `
                    <i class="fas fa-shield-alt"></i>
                    <span>Auto-Avoid ON</span>
                `;
            } else {
                button.className = 'btn btn-sm obstacle-btn auto-avoid-off';
                button.innerHTML = `
                    <i class="fas fa-shield-alt"></i>
                    <span>Auto-Avoid OFF</span>
                `;
            }
        }
        
        if (modeStatus) {
            modeStatus.textContent = this.autoAvoidEnabled ? '🤖 Auto' : '🎮 Manual';
            modeStatus.className = this.autoAvoidEnabled ? 'status-chip active' : 'status-chip';
        }
        
        this.addLog(`Obstacle avoidance ${this.autoAvoidEnabled ? 'enabled' : 'disabled'}`, 
                   this.autoAvoidEnabled ? 'success' : 'info');
        
        console.log(`🛡️ Auto-avoid ${this.autoAvoidEnabled ? 'ENABLED' : 'DISABLED'}`);
    }

    async checkObstacles() {
        try {
            const response = await fetch(`http://${this.PI_IP}:5005/obstacle_check`);
            if (!response.ok) throw new Error('Obstacle check failed');
            
            const data = await response.json();
            console.log('🔍 Obstacle check result:', data);
            
            let statusMessage = '';
            let logType = 'info';
            
            switch(data.action) {
                case 'AVOID_SCAN':
                    statusMessage = '🚨 OBSTACLES DETECTED - Scan recommended';
                    logType = 'error';
                    break;
                case 'CAMERA_AVOID':
                    statusMessage = '👁️ Camera detects obstacles ahead';
                    logType = 'error';
                    break;
                case 'CLEAR':
                    statusMessage = '✅ Path clear - safe to proceed';
                    logType = 'success';
                    break;
                default:
                    statusMessage = `🔍 Obstacle check: ${data.action}`;
            }
            
            this.addLog(statusMessage, logType);
            return data;
            
        } catch (error) {
            console.error('Obstacle check error:', error);
            this.addLog('❌ Obstacle check failed', 'error');
        }
    }

    async scanForPath() {
        try {
            const button = document.getElementById('scanPathBtn');
            if (button) {
                button.innerHTML = `<i class="fas fa-spinner fa-spin"></i><span>Scanning...</span>`;
                button.disabled = true;
            }
            
            this.addLog('🔄 Scanning for clear path...', 'info');
            
            const response = await fetch(`http://${this.PI_IP}:5005/scan_path`, {
                method: 'POST'
            });
            
            if (!response.ok) throw new Error('Path scan failed');
            
            const data = await response.json();
            console.log('📡 Scan results:', data);
            
            this.displayScanResults(data);
            this.addLog(`📡 Best path: ${data.best_direction} (${data.best_distance}cm)`, 'success');
            
            return data;
            
        } catch (error) {
            console.error('Path scan error:', error);
            this.addLog('❌ Path scan failed', 'error');
        } finally {
            const button = document.getElementById('scanPathBtn');
            if (button) {
                button.innerHTML = `<i class="fas fa-radar-chart"></i><span>Scan Path</span>`;
                button.disabled = false;
            }
        }
    }

    displayScanResults(data) {
        const resultsDiv = document.getElementById('scanResults');
        if (!resultsDiv) return;
        
        resultsDiv.classList.remove('hidden');
        
        if (data.scan_results) {
            document.getElementById('scanLeft').textContent = `${data.scan_results.left}cm`;
            document.getElementById('scanCenter').textContent = `${data.scan_results.center}cm`;
            document.getElementById('scanRight').textContent = `${data.scan_results.right}cm`;
        }
        
        const directionElement = document.getElementById('recommendedDirection');
        if (directionElement && data.best_direction) {
            directionElement.textContent = data.best_direction.toUpperCase();
        }
        
        // Auto-hide after 10 seconds
        setTimeout(() => {
            resultsDiv.classList.add('hidden');
        }, 10000);
    }

    async handleAutoAvoid() {
        if (!this.autoAvoidEnabled || this.obstacleAvoidanceActive) return;
        
        this.obstacleAvoidanceActive = true;
        console.log('🚨 Dashboard auto-avoid triggered!');
        
        try {
            const obstacleData = await this.checkObstacles();
            
            if (obstacleData && obstacleData.action === 'AVOID_SCAN') {
                console.log('🔄 Auto-scanning for clear path...');
                
                const scanData = await this.scanForPath();
                
                if (scanData && scanData.best_direction) {
                    this.addLog(`🤖 Auto-avoid: Go ${scanData.best_direction} (${scanData.best_distance}cm clear)`, 'warning');
                    console.log(`🎯 Auto-avoid recommends: ${scanData.best_direction}`);
                }
            }
        } finally {
            setTimeout(() => {
                this.obstacleAvoidanceActive = false;
            }, 5000);
        }
    }

    // ===== LOGGING SYSTEM =====
    addLog(message, type = 'info') {
        const systemLogs = document.getElementById('system-logs');
        if (!systemLogs) return;
        
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `[${timestamp}] ${message}`;
        
        systemLogs.insertBefore(logEntry, systemLogs.firstChild);
        
        // Keep only last 50 log entries
        while (systemLogs.children.length > 50) {
            systemLogs.removeChild(systemLogs.lastChild);
        }
    }

    // ===== CLEANUP =====
    destroy() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        console.log('🧹 Dashboard cleanup completed');
    }
}

// ===== INITIALIZE DASHBOARD =====
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Rover Dashboard...');
    const dashboard = new RoverDashboard();
    window.roverDashboard = dashboard; // Make available globally for debugging
});

// ===== GLOBAL HELPERS =====
window.addLog = function(message, type = 'info') {
    if (window.roverDashboard) {
        window.roverDashboard.addLog(message, type);
    }
};

// ===== CLEANUP ON PAGE UNLOAD =====
window.addEventListener('beforeunload', () => {
    if (window.roverDashboard) {
        window.roverDashboard.destroy();
    }
});

// Force flip the live camera feed after DOM loads
document.addEventListener('DOMContentLoaded', () => {
    const cameraStream = document.getElementById('camera-stream');
    if (cameraStream) {
        cameraStream.style.transform = 'scaleX(-1)';
        cameraStream.style.webkitTransform = 'scaleX(-1)';
        cameraStream.style.setProperty('transform', 'scaleX(-1)', 'important');
    }
});

// Also force it when streams start
setTimeout(() => {
    const cameraStream = document.getElementById('camera-stream');
    if (cameraStream) {
        cameraStream.style.transform = 'scaleY(-1)';
        cameraStream.style.setProperty('transform', 'scaleY(-1)','important');

    }
}, 2000);