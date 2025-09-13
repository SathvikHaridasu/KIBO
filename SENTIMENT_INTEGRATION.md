# Real-Time Sentiment Analysis Integration

This document explains the newly integrated Genesys Cloud sentiment analysis and topic detection system for the Kibo robot dog project.

## 🎯 Overview

The sentiment analysis integration provides real-time emotional intelligence to the robot's voice interactions, allowing it to:
- Detect user frustration, satisfaction, or confusion
- Identify conversation topics automatically
- Adapt responses based on emotional state
- Provide alerts for high-priority interactions requiring human intervention

## 🏗️ Architecture

### Backend Components
- **OAuth Authentication**: Handles Genesys Cloud authentication flow
- **Sentiment Analysis API**: `/api/analyze-interaction` endpoint for processing transcripts
- **Response Handling**: Categorizes sentiment and triggers appropriate actions

### Frontend Components
- **SentimentAnalyzer Class**: Core JavaScript module for sentiment analysis
- **Dashboard Integration**: Real-time sentiment display in the robot dashboard
- **Voice Integration**: Automatic sentiment analysis of voice transcripts
- **Notification System**: Alerts for high-priority interactions

## 🚀 Features

### 1. Real-Time Sentiment Detection
- **Sentiment Levels**: Very Negative, Negative, Neutral, Positive, Very Positive
- **Visual Indicators**: Color-coded sentiment displays and indicators
- **Live Updates**: Real-time sentiment changes during conversations

### 2. Topic Detection
- **Automatic Topic Extraction**: Identifies conversation topics from voice transcripts
- **Topic Chips**: Visual display of detected topics
- **Context Awareness**: Helps understand conversation context

### 3. Adaptive Response System
- **Priority-Based Responses**: Different actions based on sentiment level
- **High Priority Alerts**: Immediate notifications for user frustration
- **Response Suggestions**: Offers help, clarification, or escalation options

### 4. Interaction History
- **Conversation Logging**: Tracks all voice interactions with sentiment data
- **Historical Analysis**: View past interactions and their emotional context
- **Search and Filter**: Find specific interactions by sentiment or topic

## 📱 User Interface

### Dashboard Integration
The sentiment analysis is integrated into the robot dashboard with:

1. **Sentiment Analysis Panel**
   - Connection status to Genesys Cloud
   - Current sentiment display with visual indicator
   - Detected topics section
   - High-priority alerts

2. **Voice Interactions Section**
   - Historical log of all voice interactions
   - Sentiment and topic data for each interaction
   - Clear interactions button

3. **Real-Time Notifications**
   - Pop-up notifications for sentiment changes
   - High-priority alerts for user frustration
   - Action buttons for responding to alerts

### Main Interface Integration
The main voice interface includes:
- **Mini Sentiment Widget**: Compact sentiment display
- **Authentication Button**: Quick access to Genesys authentication
- **Real-Time Updates**: Live sentiment updates during voice interactions

## 🔧 Setup and Configuration

### Prerequisites
1. **Genesys Cloud Account**: You need a Genesys Cloud account with API access
2. **OAuth Application**: The OAuth credentials are already configured in the code
3. **Backend Server**: Ensure the Node.js backend is running

### Authentication Setup
1. **Start the Backend**: Run `npm start` in the project root
2. **Access Dashboard**: Navigate to `http://localhost:3000/dashboard.html`
3. **Connect to Genesys**: Click "Connect to Genesys" button
4. **OAuth Flow**: Complete the OAuth authentication in the popup window
5. **Verification**: Check that the connection status shows "Connected"

### Environment Variables
The following environment variables are used (already configured in server.js):
```javascript
const CLIENT_ID = "376e2b50-76c3-45d8-804e-3815c8d1b2d9";
const CLIENT_SECRET = "pYz2-gLgeIVjkPLrA_GgMB7y1LxF-SyOvRo77F9hgPw";
const REDIRECT_URI = "http://localhost:3000/auth/callback";
```

## 🎮 Usage

### Basic Usage
1. **Enable Voice**: Click "Enable Voice" in the main interface
2. **Speak Commands**: Issue voice commands to the robot
3. **Monitor Sentiment**: Watch the sentiment display update in real-time
4. **View Dashboard**: Check the dashboard for detailed sentiment analysis

### Advanced Features
1. **High-Priority Alerts**: When user frustration is detected, alerts appear with action buttons
2. **Topic Analysis**: View detected conversation topics in the dashboard
3. **Interaction History**: Review past interactions and their sentiment data
4. **Response Adaptation**: The system automatically adapts responses based on sentiment

### Alert Actions
When high-priority alerts appear, you can:
- **Offer Help**: Provide additional assistance to the user
- **Pause Interaction**: Temporarily stop the current interaction
- **Escalate**: Transfer to human support if needed

## 🔍 API Endpoints

### `/api/analyze-interaction`
**Method**: POST
**Purpose**: Analyze voice transcript for sentiment and topics

**Request Body**:
```json
{
  "transcript": "User's voice command text",
  "accessToken": "Genesys Cloud access token"
}
```

**Response**:
```json
{
  "success": true,
  "analysis": {
    "sentiment": {
      "overall": "negative"
    },
    "topics": ["navigation", "frustration"],
    "interactionId": "conversation-id"
  },
  "response": {
    "priority": "high",
    "message": "I notice you seem frustrated...",
    "actions": ["offer_help", "pause_interaction"]
  },
  "needsIntervention": true
}
```

### `/auth/status`
**Method**: GET
**Purpose**: Check Genesys Cloud authentication status

**Response**:
```json
{
  "authenticated": true,
  "expires_at": 1234567890000
}
```

## 🎨 Customization

### Styling
The sentiment analysis components use CSS classes that can be customized:
- `.sentiment-{level}`: Sentiment display styling
- `.sentiment-indicator`: Visual sentiment indicators
- `.topic-chip`: Topic display styling
- `.sentiment-alert`: Alert notification styling

### Callbacks
You can register custom callbacks for sentiment events:
```javascript
// Sentiment change callback
sentimentAnalyzer.onSentimentChange((sentiment, previous) => {
  console.log(`Sentiment changed: ${previous} → ${sentiment}`);
});

// Topic change callback
sentimentAnalyzer.onTopicChange((topics) => {
  console.log('Topics detected:', topics);
});

// High priority alert callback
sentimentAnalyzer.onHighPriorityAlert((analysis) => {
  console.log('High priority alert:', analysis);
});
```

## 🐛 Troubleshooting

### Common Issues

1. **Authentication Failed**
   - Check that the backend server is running
   - Verify OAuth credentials are correct
   - Ensure popup blockers are disabled

2. **Sentiment Analysis Not Working**
   - Verify Genesys Cloud connection
   - Check browser console for errors
   - Ensure voice transcripts are being generated

3. **UI Not Updating**
   - Check that sentiment.js is loaded
   - Verify DOM elements exist
   - Check for JavaScript errors

### Debug Mode
Enable debug logging by opening browser console and looking for:
- `🧠 Sentiment Analysis:` - Analysis results
- `📊 Sentiment changed:` - Sentiment updates
- `🚨 High priority interaction detected:` - Alert triggers

## 🔮 Future Enhancements

### Planned Features
1. **Machine Learning Integration**: Custom sentiment models
2. **Multi-Language Support**: Sentiment analysis in multiple languages
3. **Advanced Analytics**: Detailed conversation analytics and reporting
4. **Custom Response Templates**: Configurable response messages
5. **Integration with Other Services**: Slack, email notifications, etc.

### API Improvements
1. **WebSocket Support**: Real-time updates without polling
2. **Batch Processing**: Analyze multiple interactions at once
3. **Custom Models**: Train custom sentiment models for specific use cases

## 📚 Additional Resources

- [Genesys Cloud API Documentation](https://developer.genesys.cloud/)
- [Sentiment Analysis Best Practices](https://cloud.google.com/natural-language/docs/basics#sentiment_analysis)
- [Voice User Interface Design](https://www.voiceflow.com/blog/voice-user-interface-design)

## 🤝 Support

For issues or questions about the sentiment analysis integration:
1. Check the browser console for error messages
2. Verify all dependencies are installed
3. Ensure the backend server is running properly
4. Check the Genesys Cloud connection status

The integration is designed to be robust and handle errors gracefully, falling back to basic functionality if sentiment analysis is unavailable.
