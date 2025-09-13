// Route to handle voice interaction analysis
app.post('/api/analyze-interaction', async (req, res) => {
    const { transcript, accessToken } = req.body;

    if (!transcript || !accessToken) {
        return res.status(400).json({ 
            error: 'Transcript and access token are required' 
        });
    }

    try {
        // Analyze the interaction using Genesys Cloud
        const analysis = await analyzeInteraction(accessToken, transcript);

        // Check for negative sentiment and get appropriate response
        const sentimentResponse = handleNegativeSentiment(
            analysis.sentiment.overall, 
            analysis.topics
        );

        // Emit real-time update to connected clients (if using WebSocket)
        if (sentimentResponse.priority === 'high') {
            // You can implement WebSocket here to notify the dashboard
            console.log('High priority interaction detected:', {
                interactionId: analysis.interactionId,
                sentiment: analysis.sentiment,
                response: sentimentResponse
            });
        }

        // Return analysis results and any necessary responses
        res.json({
            success: true,
            analysis: {
                sentiment: analysis.sentiment,
                topics: analysis.topics,
                interactionId: analysis.interactionId
            },
            response: sentimentResponse,
            needsIntervention: sentimentResponse.priority === 'high'
        });

    } catch (error) {
        console.error('Analysis error:', error);
        res.status(500).json({
            error: 'Failed to analyze interaction',
            details: error.message
        });
    }
});