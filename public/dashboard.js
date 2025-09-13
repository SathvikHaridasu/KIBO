class RoverDashboard {
    constructor() {
        this.isConnected = false;
        this.updateInterval = null;
        this.PI_IP = "10.37.117.213"; // Your Raspberry Pi IP

        this.statusElements = {
            battery: document.querySelector('.battery-level'),
            mode: document.querySelector('.robo-mode'),
            speed: document.querySelector('.robo-speed'),
            direction: document.querySelector('.robo-direction'),
            fps: document.querySelector('.robo-fps'),
            temperature: document.querySelector('.robo-temp'),
            obstacles: document.querySelector('.obstacle-count'),
            crosswalks: document.querySelector('.crosswalk-count'),
            vehicles: document.querySelector('.vehicle-count'),
            action: document.querySelector('.current-action')
        };
        
        this.connectionStatus = document.getElementById('connection-status');
        this.connectionStatusText = document.getElementById('connection-status-text');
        this.dashboardContent = document.getElementById('dashboard-content');
        this.loadingScreen = document.getElementById('loading-screen');
        
        this.init();
    }

    async init() {
        console.log('🚀 Starting enhanced dashboard with obstacle avoidance...');
        
        // Setup camera streams directly
        this.setupCameraStreams();

        // ✅ NEW: Initialize obstacle avoidance
        this.initializeObstacleAvoidance();

        // Start streams automatically after a short delay
        setTimeout(() => this.startCameraStreams(), 1000);
        
        // Start periodic status updates
        this.startStatusUpdates();
        
        // Setup manual controls
        this.setupEventListeners();
        
        // Initial connection test
        await this.testConnection();
        
        console.log('✅ Enhanced dashboard with obstacle avoidance ready!');
    }

    setupCameraStreams() {
        console.log('📹 Setting up dual camera streams...');
        
        const detectionStream = document.getElementById('detection-stream');
        const cameraStream = document.getElementById('camera-stream');
        const startBtn = document.getElementById('start-streams');
        const stopBtn = document.getElementById('stop-streams');
        
        // Setup stream URLs (but don't start yet)
        if (detectionStream) {
            detectionStream.dataset.streamUrl = `http://${this.PI_IP}:5005/detection_stream`;
        }
        
        if (cameraStream) {
            cameraStream.dataset.streamUrl = `http://${this.PI_IP}:5004/camera/stream`;
        }
        
        // Setup button handlers
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startCameraStreams());
        }
        
        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopCameraStreams());
        }
        
        console.log('📷 Dual camera setup complete');
    }

    async startCameraStreams() {
        console.log('🚀 Starting dual camera streams...');
        
        const detectionStream = document.getElementById('detection-stream');
        const cameraStream = document.getElementById('camera-stream');
        const startBtn = document.getElementById('start-streams');
        const stopBtn = document.getElementById('stop-streams');
        
        try {
            // Start both streams
            if (detectionStream) {
                detectionStream.src = detectionStream.dataset.streamUrl + `?t=${Date.now()}`;
                detectionStream.classList.add('active');
                detectionStream.onerror = () => this.handleStreamError('detection');
            }
            
            if (cameraStream) {
                cameraStream.src = cameraStream.dataset.streamUrl + `?t=${Date.now()}`;
                cameraStream.classList.add('active');
                cameraStream.onerror = () => this.handleStreamError('camera');
            }
            
            // Update UI
            if (startBtn) startBtn.style.display = 'none'; // Hide start button
            if (stopBtn) stopBtn.style.display = 'inline-flex';
            
            // Start detection system integration
            if (typeof startObstacleDetectionAuto === 'function') {
                startObstacleDetectionAuto();
            }
            
            this.addLog('Dual camera streams started', 'success');
            
        } catch (error) {
            console.error('❌ Failed to start camera streams:', error);
            this.addLog('Camera stream error: ' + error.message, 'error');
        }
    }

    async stopCameraStreams() {
        console.log('🛑 Stopping dual camera streams...');
        
        const detectionStream = document.getElementById('detection-stream');
        const cameraStream = document.getElementById('camera-stream');
        const startBtn = document.getElementById('start-streams');
        const stopBtn = document.getElementById('stop-streams');
        
        try {
            // Stop streams
            if (detectionStream) {
                detectionStream.src = '';
                detectionStream.classList.remove('active');
            }
            
            if (cameraStream) {
                cameraStream.src = '';
                cameraStream.classList.remove('active');
            }
            
            // Update UI
            if (startBtn) startBtn.style.display = 'none'; // Keep start button hidden
            if (stopBtn) stopBtn.style.display = 'none';
            
            // Stop detection system
            if (typeof stopObstacleDetectionAuto === 'function') {
                stopObstacleDetectionAuto();
            }
            
            this.addLog('Camera streams stopped', 'info');
            
        } catch (error) {
            console.error('❌ Failed to stop camera streams:', error);
            this.addLog('Camera stop error: ' + error.message, 'error');
        }
    }

    handleStreamError(streamType) {
        console.error(`❌ ${streamType} stream error`);
        this.addLog(`${streamType} stream connection failed`, 'error');
        
        const statusElement = document.querySelector(`.${streamType}-status`);
        if (statusElement) {
            statusElement.textContent = 'Stream Error';
            statusElement.className = `${streamType}-status error`;
        }
    }

    updateDetectionStats(data) {
        // Update detection-specific stats
        const objectCount = document.getElementById('detection-objects');
        const threatLevel = document.getElementById('threat-level');
        const detectionStatus = document.querySelector('.detection-status');
        const safetyStatus = document.querySelector('.safety-status');
        
        if (data && objectCount) {
            objectCount.textContent = data.object_count || 0;
        }
        
        if (data && threatLevel) {
            const threat = data.danger_count > 0 ? 'DANGER' : 
                        data.obstacle_count > 0 ? 'CAUTION' : 'SAFE';
            threatLevel.textContent = threat;
            threatLevel.className = `threat-${threat.toLowerCase()}`;
        }
        
        if (detectionStatus) {
            detectionStatus.textContent = data ? 'AI Active' : 'AI Standby';
        }
        
        if (safetyStatus) {
            const status = data?.danger_count > 0 ? 'danger' : 
                        data?.obstacle_count > 0 ? 'warning' : 'safe';
            safetyStatus.textContent = status.toUpperCase();
            safetyStatus.className = `safety-status ${status}`;
        }
    }


    

    async testConnection() {
        try {
            const response = await fetch(`http://${this.PI_IP}:5005/health`, { timeout: 5000 });
            if (response.ok) {
                this.isConnected = true;
                this.updateConnectionStatus('connected', 'Connected to Robot');
                this.showDashboard();
                console.log('✅ Robot connection successful');
            } else {
                throw new Error('Health check failed');
            }
        } catch (error) {
            console.error('❌ Robot connection failed:', error);
            this.updateConnectionStatus('disconnected', 'Robot Offline');
            this.showLoadingScreen('Robot is offline. Check connection.');
        }
    }

    startStatusUpdates() {
        // Update every 2 seconds (perfect for dashboard!)
        this.updateInterval = setInterval(() => {
            this.updateRobotData();
        }, 2000);
        
        // Initial update
        this.updateRobotData();
        console.log('📊 Status updates started (every 2 seconds)');
    }

    async updateRobotData() {
        try {
            // Existing code stays the same...
            const response = await fetch(`http://${this.PI_IP}:5005/robot/navigation_data`);
            
            if (!response.ok) throw new Error('Navigation data unavailable');
            
            const data = await response.json();
            
            // Existing updates...
            this.updateDashboardElements({
                battery: 85,
                mode: "AUTONOMOUS",
                speed: "2.1 m/s",
                direction: data.action || "STOPPED",
                fps: "52",
                temperature: "42°C",
                obstacles: data.summary?.obstacle_count || 0,
                crosswalks: data.summary?.crosswalk_count || 0, 
                vehicles: data.summary?.vehicle_count || 0,
                action: data.action || "UNKNOWN"
            });
            
            // NEW: Update detection stats
            this.updateDetectionStats(data.summary);
            
            // Existing connection status code...
            if (!this.isConnected) {
                this.isConnected = true;
                this.updateConnectionStatus('connected', 'Robot Online');
                this.showDashboard();
            }
            
        } catch (error) {
            console.error('📊 Status update failed:', error);
            if (this.isConnected) {
                this.isConnected = false;
                this.updateConnectionStatus('disconnected', 'Robot Offline');
            }
        }
    }

    updateDashboardElements(data) {
        // Update each status element if it exists
        Object.entries(data).forEach(([key, value]) => {
            const element = this.statusElements[key];
            if (element) {
                element.textContent = value;
            }
        });
    }

    async sendCommand(command, duration = 1.0) {
        if (!this.isConnected) {
            console.error('❌ Cannot send command: Robot offline');
            return;
        }

        try {
            console.log(`🎮 Sending command: ${command}`);
            
            const response = await fetch(`http://${this.PI_IP}:5001/robot/command`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: command,
                    duration: duration
                })
            });

            const result = await response.json();
            console.log(`✅ Command result:`, result);
            
        } catch (error) {
            console.error(`❌ Command failed:`, error);
        }
    }

    updateConnectionStatus(status, message) {
        if (this.connectionStatus) {
            this.connectionStatus.className = `status-${status}`;
        }
        if (this.connectionStatusText) {
            this.connectionStatusText.textContent = message;
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
        if (this.dashboardContent) this.dashboardContent.style.display = 'grid';
    }

    setupEventListeners() {
        // Manual control buttons
        document.querySelectorAll('.control-btn').forEach(button => {
            button.addEventListener('click', (e) => {
                const command = e.target.dataset.command;
                if (command) {
                    this.sendCommand(command);
                }
            });
        });

        // Emergency stop button (special handling)
        const emergencyBtn = document.getElementById('emergency-stop');
        if (emergencyBtn) {
            emergencyBtn.addEventListener('click', () => {
                this.sendCommand('stop', 0); // Immediate stop
            });
        }
    }

    // ===== OBSTACLE AVOIDANCE METHODS =====
    initializeObstacleAvoidance() {
        console.log("🛡️ Initializing dashboard obstacle avoidance...");
        
        // Initialize obstacle avoidance variables
        this.autoAvoidEnabled = false;
        this.currentDistance = 999;
        this.distanceUpdateInterval = null;
        this.obstacleAvoidanceActive = false;
        
        // Setup event listeners
        this.setupObstacleControls();
        
        // Start distance monitoring
        this.startDistanceMonitoring();
        
        console.log("✅ Dashboard obstacle avoidance initialized");
    }

    setupObstacleControls() {
        // Auto-avoid toggle
        const autoAvoidBtn = document.getElementById('toggleAutoAvoid');
        if (autoAvoidBtn) {
            autoAvoidBtn.addEventListener('click', () => this.toggleAutoAvoid());
        }
        
        // Manual scan button
        const scanBtn = document.getElementById('scanPathBtn');
        if (scanBtn) {
            scanBtn.addEventListener('click', () => this.scanForPath());
        }
        
        // Check obstacles button  
        const checkBtn = document.getElementById('checkObstaclesBtn');
        if (checkBtn) {
            checkBtn.addEventListener('click', () => this.checkObstacles());
        }
        
        console.log("🎛️ Obstacle control handlers setup complete");
    }

    startDistanceMonitoring() {
        if (this.distanceUpdateInterval) {
            clearInterval(this.distanceUpdateInterval);
        }
        
        this.distanceUpdateInterval = setInterval(async () => {
            await this.updateDistance();
        }, 500); // Update every 500ms
        
        console.log("📡 Dashboard distance monitoring started");
    }

    async updateDistance() {
        try {
            const response = await fetch(`http://${this.PI_IP}:5005/ultrasonic_distance`);
            
            if (!response.ok) throw new Error('Distance request failed');
            
            const data = await response.json();
            this.currentDistance = data.distance_cm;
            
            // Update UI
            this.updateDistanceDisplay(data.distance_cm);
            
            // Check for obstacles if auto-avoid is enabled
            if (this.autoAvoidEnabled && data.obstacle_detected) {
                await this.handleAutoAvoid();
            }
            
        } catch (error) {
            console.warn('📡 Distance update failed:', error);
            this.updateDistanceDisplay(999); // Show offline
        }
    }

    updateDistanceDisplay(distance) {
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
            if (distance < 15 && distance !== 999) {
                warningElement.classList.remove('hidden');
            } else {
                warningElement.classList.add('hidden');
            }
        }
        
        // Update ultrasonic status
        const ultrasonicStatus = document.getElementById('ultrasonicStatus');
        if (ultrasonicStatus) {
            if (distance === 999) {
                ultrasonicStatus.textContent = '📡 Ultrasonic: Offline';
                ultrasonicStatus.className = 'status-chip danger';
            } else if (distance < 15) {
                ultrasonicStatus.textContent = `📡 Ultrasonic: ${distance}cm DANGER`;
                ultrasonicStatus.className = 'status-chip danger';
            } else if (distance < 50) {
                ultrasonicStatus.textContent = `📡 Ultrasonic: ${distance}cm Warning`;
                ultrasonicStatus.className = 'status-chip warning';
            } else {
                ultrasonicStatus.textContent = `📡 Ultrasonic: ${distance}cm Clear`;
                ultrasonicStatus.className = 'status-chip active';
            }
        }
        
        // Update rover status distance
        const distanceStatus = document.querySelector('.robo-distance');
        if (distanceStatus) {
            distanceStatus.textContent = distance === 999 ? '-- cm' : `${distance} cm`;
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
            
            // Update status based on result
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
            
            // Display scan results
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
            // Check obstacles
            const obstacleData = await this.checkObstacles();
            
            if (obstacleData && obstacleData.action === 'AVOID_SCAN') {
                console.log('🔄 Auto-scanning for clear path...');
                
                // Automatically scan for path
                const scanData = await this.scanForPath();
                
                if (scanData && scanData.best_direction) {
                    this.addLog(`🤖 Auto-avoid: Go ${scanData.best_direction} (${scanData.best_distance}cm clear)`, 'warning');
                    console.log(`🎯 Auto-avoid recommends: ${scanData.best_direction}`);
                }
            }
        } finally {
            // Reset after 5 seconds
            setTimeout(() => {
                this.obstacleAvoidanceActive = false;
            }, 5000);
        }
    }

    addLog(message, type = 'info') {
        const systemLogs = document.getElementById('system-logs');
        if (!systemLogs) return;
        
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `[${timestamp}] ${message}`;
        
        systemLogs.appendChild(logEntry);
        systemLogs.scrollTop = systemLogs.scrollHeight;
        
        // Keep only last 50 log entries
        const entries = systemLogs.children;
        if (entries.length > 50) {
            systemLogs.removeChild(entries[0]);
        }
    }
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new RoverDashboard();
    window.roverDashboard = dashboard; // For debugging
});