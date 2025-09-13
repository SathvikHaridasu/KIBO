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
        console.log('🚀 Starting simple HTTP dashboard...');
        
        // Setup camera streams directly
        this.setupCameraStreams();

        // Start streams automatically after a short delay
        setTimeout(() => this.startCameraStreams(), 1000);
        
        // Start periodic status updates
        this.startStatusUpdates();
        
        // Setup manual controls
        this.setupEventListeners();
        
        // Initial connection test
        await this.testConnection();
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
}

// Initialize dashboard
document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new RoverDashboard();
    window.roverDashboard = dashboard; // For debugging
});