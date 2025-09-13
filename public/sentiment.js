// ===== GENESYS SENTIMENT ANALYSIS MODULE =====

class SentimentAnalyzer {
    constructor() {
        this.isAuthenticated = false;
        this.accessToken = null;
        this.currentSentiment = 'neutral';
        this.currentTopics = [];
        this.interactionHistory = [];
        this.callbacks = {
            onSentimentChange: [],
            onTopicChange: [],
            onHighPriorityAlert: []
        };
        
        this.initializeAuth();
    }

    // Initialize authentication with Genesys
    async initializeAuth() {
        try {
            const response = await fetch('/auth/status');
            const authStatus = await response.json();
            
            if (authStatus.authenticated) {
                this.isAuthenticated = true;
                this.updateAuthUI(true);
                console.log('✅ Genesys authentication active');
            } else {
                this.updateAuthUI(false);
                console.log('⚠️ Genesys authentication required');
            }
        } catch (error) {
            console.error('❌ Auth check failed:', error);
            this.updateAuthUI(false);
        }
    }

    // Start OAuth flow with Genesys
    async startAuth() {
        try {
            // Redirect to Genesys OAuth
            const clientId = "376e2b50-76c3-45d8-804e-3815c8d1b2d9";
            const redirectUri = encodeURIComponent("http://localhost:3000/auth/callback");
            const scope = "analytics:conversations:read analytics:conversations:write";
            
            const authUrl = `https://login.cac1.pure.cloud/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}`;
            
            window.open(authUrl, '_blank', 'width=600,height=700');
            
            // Poll for authentication status
            this.pollAuthStatus();
            
        } catch (error) {
            console.error('❌ Auth start failed:', error);
            this.showNotification('Authentication failed', 'error');
        }
    }

    // Poll for authentication status after OAuth redirect
    pollAuthStatus() {
        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch('/auth/status');
                const authStatus = await response.json();
                
                if (authStatus.authenticated) {
                    this.isAuthenticated = true;
                    this.updateAuthUI(true);
                    clearInterval(pollInterval);
                    this.showNotification('Successfully authenticated with Genesys!', 'success');
                    console.log('✅ Genesys authentication completed');
                }
            } catch (error) {
                console.error('❌ Auth polling error:', error);
            }
        }, 2000);

        // Stop polling after 2 minutes
        setTimeout(() => clearInterval(pollInterval), 120000);
    }

    // Analyze voice transcript for sentiment and topics
    async analyzeTranscript(transcript) {
        if (!this.isAuthenticated) {
            console.warn('⚠️ Cannot analyze - not authenticated with Genesys');
            return null;
        }

        try {
            console.log('🧠 Analyzing transcript with Genesys:', transcript);
            
            const response = await fetch('/api/analyze-interaction', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    transcript: transcript,
                    accessToken: this.accessToken || 'stored-token' // In production, get from secure storage
                })
            });

            if (!response.ok) {
                throw new Error(`Analysis failed: ${response.status}`);
            }

            const analysis = await response.json();
            
            if (analysis.success) {
                this.updateSentiment(analysis.analysis.sentiment);
                this.updateTopics(analysis.analysis.topics);
                this.addToHistory(transcript, analysis.analysis);
                
                // Handle high priority alerts
                if (analysis.needsIntervention) {
                    this.handleHighPriorityAlert(analysis);
                }
                
                return analysis;
            }
            
        } catch (error) {
            console.error('❌ Sentiment analysis failed:', error);
            this.showNotification('Sentiment analysis failed', 'error');
            return null;
        }
    }

    // Update sentiment state and notify callbacks
    updateSentiment(sentiment) {
        const previousSentiment = this.currentSentiment;
        this.currentSentiment = sentiment.overall || sentiment;
        
        if (previousSentiment !== this.currentSentiment) {
            console.log(`📊 Sentiment changed: ${previousSentiment} → ${this.currentSentiment}`);
            
            // Notify callbacks
            this.callbacks.onSentimentChange.forEach(callback => {
                callback(this.currentSentiment, previousSentiment);
            });
            
            // Update UI
            this.updateSentimentUI(this.currentSentiment);
        }
    }

    // Update topics state and notify callbacks
    updateTopics(topics) {
        this.currentTopics = topics || [];
        
        console.log('🏷️ Topics detected:', this.currentTopics);
        
        // Notify callbacks
        this.callbacks.onTopicChange.forEach(callback => {
            callback(this.currentTopics);
        });
        
        // Update UI
        this.updateTopicsUI(this.currentTopics);
    }

    // Handle high priority sentiment alerts
    handleHighPriorityAlert(analysis) {
        console.log('🚨 High priority interaction detected:', analysis);
        
        // Notify callbacks
        this.callbacks.onHighPriorityAlert.forEach(callback => {
            callback(analysis);
        });
        
        // Show urgent notification
        this.showNotification(
            `User frustration detected: ${analysis.response.message}`, 
            'warning',
            true
        );
        
        // Update dashboard with alert
        this.updateAlertUI(analysis);
    }

    // Add interaction to history
    addToHistory(transcript, analysis) {
        const interaction = {
            timestamp: new Date(),
            transcript: transcript,
            sentiment: analysis.sentiment,
            topics: analysis.topics,
            interactionId: analysis.interactionId
        };
        
        this.interactionHistory.unshift(interaction);
        
        // Keep only last 50 interactions
        if (this.interactionHistory.length > 50) {
            this.interactionHistory = this.interactionHistory.slice(0, 50);
        }
        
        this.updateHistoryUI();
    }

    // Register callback functions
    onSentimentChange(callback) {
        this.callbacks.onSentimentChange.push(callback);
    }

    onTopicChange(callback) {
        this.callbacks.onTopicChange.push(callback);
    }

    onHighPriorityAlert(callback) {
        this.callbacks.onHighPriorityAlert.push(callback);
    }

    // UI Update Methods
    updateAuthUI(authenticated) {
        const authButton = document.getElementById('genesys-auth-btn');
        const authStatus = document.getElementById('genesys-auth-status');
        const authButtonMini = document.getElementById('genesys-auth-btn-mini');
        
        if (authButton && authStatus) {
            if (authenticated) {
                authButton.innerHTML = '<i class="fas fa-check-circle"></i> Authenticated';
                authButton.className = 'btn btn-success';
                authStatus.textContent = 'Connected to Genesys Cloud';
                authStatus.className = 'status-connected';
            } else {
                authButton.innerHTML = '<i class="fas fa-sign-in-alt"></i> Connect to Genesys';
                authButton.className = 'btn btn-primary';
                authStatus.textContent = 'Not connected';
                authStatus.className = 'status-disconnected';
            }
        }
        
        // Update mini widget
        if (authButtonMini) {
            if (authenticated) {
                authButtonMini.innerHTML = '<i class="fas fa-check-circle"></i> Connected';
                authButtonMini.className = 'btn btn-sm btn-success';
            } else {
                authButtonMini.innerHTML = '<i class="fas fa-sign-in-alt"></i> Connect';
                authButtonMini.className = 'btn btn-sm btn-primary';
            }
        }
    }

    updateSentimentUI(sentiment) {
        const sentimentDisplay = document.getElementById('sentiment-display');
        const sentimentIndicator = document.getElementById('sentiment-indicator');
        const sentimentDisplayMini = document.getElementById('sentiment-display-mini');
        const sentimentIndicatorMini = document.getElementById('sentiment-indicator-mini');
        
        if (sentimentDisplay) {
            sentimentDisplay.textContent = this.getSentimentLabel(sentiment);
            sentimentDisplay.className = `sentiment-${sentiment}`;
        }
        
        if (sentimentIndicator) {
            sentimentIndicator.className = `sentiment-indicator ${sentiment}`;
        }
        
        // Update mini widget
        if (sentimentDisplayMini) {
            sentimentDisplayMini.textContent = this.getSentimentLabel(sentiment);
            sentimentDisplayMini.className = `sentiment-${sentiment}`;
        }
        
        if (sentimentIndicatorMini) {
            sentimentIndicatorMini.className = `sentiment-indicator ${sentiment}`;
        }
    }

    updateTopicsUI(topics) {
        const topicsContainer = document.getElementById('topics-container');
        
        if (topicsContainer) {
            topicsContainer.innerHTML = '';
            
            if (topics && topics.length > 0) {
                topics.forEach(topic => {
                    const topicElement = document.createElement('span');
                    topicElement.className = 'topic-chip';
                    topicElement.textContent = topic;
                    topicsContainer.appendChild(topicElement);
                });
            } else {
                topicsContainer.innerHTML = '<span class="no-topics">No topics detected</span>';
            }
        }
    }

    updateAlertUI(analysis) {
        const alertContainer = document.getElementById('sentiment-alerts');
        
        if (alertContainer) {
            const alertElement = document.createElement('div');
            alertElement.className = 'sentiment-alert high-priority';
            alertElement.innerHTML = `
                <div class="alert-header">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>High Priority Alert</span>
                    <button class="alert-close" onclick="this.parentElement.parentElement.remove()">×</button>
                </div>
                <div class="alert-content">
                    <p>${analysis.response.message}</p>
                    <div class="alert-actions">
                        <button class="btn btn-sm btn-primary" onclick="sentimentAnalyzer.handleAlert('offer_help')">
                            Offer Help
                        </button>
                        <button class="btn btn-sm btn-secondary" onclick="sentimentAnalyzer.handleAlert('pause_interaction')">
                            Pause Interaction
                        </button>
                    </div>
                </div>
            `;
            
            alertContainer.insertBefore(alertElement, alertContainer.firstChild);
            
            // Auto-remove after 30 seconds
            setTimeout(() => {
                if (alertElement.parentNode) {
                    alertElement.remove();
                }
            }, 30000);
        }
    }

    updateHistoryUI() {
        const historyContainer = document.getElementById('interaction-history');
        
        if (historyContainer) {
            historyContainer.innerHTML = '';
            
            this.interactionHistory.slice(0, 10).forEach(interaction => {
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                historyItem.innerHTML = `
                    <div class="history-header">
                        <span class="history-time">${interaction.timestamp.toLocaleTimeString()}</span>
                        <span class="history-sentiment sentiment-${interaction.sentiment.overall || interaction.sentiment}">
                            ${this.getSentimentLabel(interaction.sentiment.overall || interaction.sentiment)}
                        </span>
                    </div>
                    <div class="history-transcript">"${interaction.transcript}"</div>
                    <div class="history-topics">
                        ${(interaction.topics || []).map(topic => `<span class="topic-tag">${topic}</span>`).join('')}
                    </div>
                `;
                historyContainer.appendChild(historyItem);
            });
        }
    }

    // Handle alert actions
    handleAlert(action) {
        console.log(`🎯 Handling alert action: ${action}`);
        
        switch (action) {
            case 'offer_help':
                this.showNotification('Offering additional assistance to user', 'info');
                // Implement help offering logic
                break;
            case 'pause_interaction':
                this.showNotification('Pausing current interaction', 'info');
                // Implement interaction pause logic
                break;
            case 'escalate':
                this.showNotification('Escalating to human support', 'warning');
                // Implement escalation logic
                break;
        }
    }

    // Utility methods
    getSentimentLabel(sentiment) {
        const labels = {
            'very_negative': 'Very Negative',
            'negative': 'Negative',
            'neutral': 'Neutral',
            'positive': 'Positive',
            'very_positive': 'Very Positive'
        };
        return labels[sentiment] || 'Unknown';
    }

    showNotification(message, type = 'info', urgent = false) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type} ${urgent ? 'urgent' : ''}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${this.getNotificationIcon(type)}"></i>
                <span>${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        // Add to notification container
        let container = document.getElementById('notification-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'notification-container';
            document.body.appendChild(container);
        }
        
        container.appendChild(notification);
        
        // Auto-remove after 5 seconds (unless urgent)
        if (!urgent) {
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 5000);
        }
    }

    getNotificationIcon(type) {
        const icons = {
            'success': 'check-circle',
            'error': 'exclamation-circle',
            'warning': 'exclamation-triangle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }

    // Get current state
    getState() {
        return {
            isAuthenticated: this.isAuthenticated,
            currentSentiment: this.currentSentiment,
            currentTopics: this.currentTopics,
            interactionHistory: this.interactionHistory
        };
    }
}

// Initialize global sentiment analyzer
window.sentimentAnalyzer = new SentimentAnalyzer();

// Add event listeners for mini widget
document.addEventListener('DOMContentLoaded', () => {
    const authButtonMini = document.getElementById('genesys-auth-btn-mini');
    if (authButtonMini) {
        authButtonMini.addEventListener('click', () => {
            if (window.sentimentAnalyzer) {
                window.sentimentAnalyzer.startAuth();
            }
        });
    }
});

// Export for module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SentimentAnalyzer;
}
