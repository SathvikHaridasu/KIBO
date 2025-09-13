
import express from "express";
import cors from "cors";
import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
const VAPI_API_KEY = process.env.VAPI_API_KEY;

app.use(cors());
app.use(express.json({ 
  limit: '50mb' 
}));
app.use(express.urlencoded({ 
  extended: true, 
  limit: '50mb' 
}));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- CONFIG ENDPOINT ---
// Returns API keys for the frontend
app.get('/api/config', (req, res) => {
  res.json({
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || null,
    geminiApiKey: process.env.GEMINI_API_KEY || null,
    googleSttApiKey: process.env.GOOGLE_STT_API_KEY || null,
  });
});

app.post("/api/stt", async (req, res) => {
  try {
    // Check if API key exists
    if (!process.env.GOOGLE_STT_API_KEY) {
      console.error("❌ GOOGLE_STT_API_KEY not found in environment variables");
      return res.status(500).json({ 
        error: "Google Speech-to-Text API key not configured",
        details: "Please add GOOGLE_STT_API_KEY to your .env file"
      });
    }

    const { audioData, config = {} } = req.body;
    
    if (!audioData) {
      return res.status(400).json({ error: "No audio data provided" });
    }

    console.log("🎤 Processing STT request, audio size:", audioData.length);

    const defaultConfig = {
      encoding: "WEBM_OPUS",
      sampleRateHertz: 48000,
      languageCode: "en-US",
      enableAutomaticPunctuation: true,
      model: "latest_long"
    };

    const requestBody = {
      config: { ...defaultConfig, ...config },
      audio: { content: audioData }
    };

    console.log("🔄 Sending request to Google STT API...");

    const response = await axios.post(
      `https://speech.googleapis.com/v1/speech:recognize?key=${process.env.GOOGLE_STT_API_KEY}`,
      requestBody,
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000
      }
    );

    console.log("✅ STT API response received");
    res.json(response.data);
    
  } catch (error) {
    console.error("❌ STT proxy error:", error.response?.data || error.message);
    
    if (error.response) {
      console.error("❌ Google API Error Status:", error.response.status);
      console.error("❌ Google API Error Data:", error.response.data);
      
      res.status(error.response.status).json({ 
        error: `Google STT API error: ${error.response.status}`,
        details: error.response.data,
        hint: "Check if your GOOGLE_STT_API_KEY has Speech-to-Text API enabled"
      });
    } else if (error.code === 'ECONNABORTED') {
      res.status(500).json({ 
        error: "Request timeout connecting to Google STT API",
        details: "The request took too long. Try with shorter audio clips."
      });
    } else {
      res.status(500).json({ 
        error: "Network error connecting to Google STT API",
        details: error.message,
        hint: "Check your internet connection and API key"
      });
    }
  }
});

app.post('/api/nlp', async (req, res) => {
  try {
    // Check if API key exists
    if (!process.env.GEMINI_API_KEY) {
      console.error("❌ GEMINI_API_KEY not found in environment variables");
      return res.status(500).json({ 
        intent: "unknown", 
        message: "Gemini API key not configured"
      });
    }

    const { text } = req.body;
    
    const prompt = `You are an expert navigation assistant for an autonomous robot dog. You help users navigate and control the robot dog's movement and pathfinding.

    CONTEXT:
    - This is a robot dog, not a vehicle
    - It moves at walking speed through pedestrian areas, buildings, and outdoor spaces
    - It can navigate stairs, sidewalks, indoor spaces, and terrain
    - It's used for delivery, patrol, assistance, or companionship tasks

    USER REQUEST: "${text}"

    CAPABILITIES YOU CAN HANDLE:
    1. **Navigation Commands**: "go to", "walk to", "head to", "navigate to", "take me to"
    2. **Location Finding**: "find", "locate", "where is", "show me"
    3. **Proximity Search**: "nearest", "closest", "find nearby"
    4. **Movement Control**: "stop", "pause", "resume", "follow me", "stay here", "start navigation"
    5. **Route Management**: "clear route", "new route", "cancel navigation"
    6. **Status Queries**: "where am I", "what's my location", "show current position"
    7. **Environmental**: "avoid obstacles", "indoor mode", "outdoor mode"
    8. **Speed Control**: "go faster", "slow down", "walking pace"
    9. **Map Features**: "show traffic", "hide traffic", "show satellite view"

    RESPONSE FORMAT (JSON):
    {
      "intent": "navigate|nearest|find|control|route|status|environmental|speed|map|unknown",
      "destination": "specific place name if navigation",
      "searchTerm": "what to search for if finding/nearest",
      "action": "specific action if movement control",
      "message": "helpful response to user",
      "needsClarification": boolean,
      "followUpQuestion": "question if clarification needed",
      "parameters": {
        "speed": "normal|fast|slow if speed control",
        "mode": "indoor|outdoor if environmental",
        "mapFeature": "traffic|satellite if map control"
      }
    }

    DECISION LOGIC:
    - **Specific addresses/buildings** → navigate directly
    - **Generic places** (McDonald's, Starbucks) → find nearest unless specified
    - **Ambiguous requests** → ask ONE clear question
    - **Movement commands** → execute immediately
    - **Status queries** → provide current information

    EXAMPLES:
    - "walk to Conestoga College" → {"intent":"navigate", "destination":"Conestoga College", "message":"Navigating to Conestoga College"}
    - "find the nearest coffee shop" → {"intent":"nearest", "searchTerm":"coffee shop", "message":"Finding nearest coffee shop"}
    - "go to Starbucks" → {"intent":"nearest", "searchTerm":"Starbucks", "message":"Finding nearest Starbucks"}
    - "take me to 123 King Street" → {"intent":"navigate", "destination":"123 King Street", "message":"Navigating to 123 King Street"}
    - "stop moving" → {"intent":"control", "action":"stop", "message":"Stopping movement"}
    - "start navigation" → {"intent":"control", "action":"start", "message":"Starting navigation"}
    - "clear the route" → {"intent":"route", "action":"clear", "message":"Route cleared"}
    - "where am I" → {"intent":"status", "action":"location", "message":"Showing current location"}
    - "slow down" → {"intent":"speed", "parameters":{"speed":"slow"}, "message":"Reducing speed"}

    PERSONALITY:
    - Be helpful and efficient
    - Use robot/tech terminology when appropriate
    - Keep responses concise but informative
    - Ask for clarification only when truly needed
    - Remember this is for a robot dog, not a human or car

    Analyze the user's request and provide the appropriate JSON response.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const jsonText = response.text().trim();
    
    const cleanJson = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    const parsed = JSON.parse(cleanJson);
    
    console.log('🧠 Gemini AI parsed:', parsed);
    res.json(parsed);
    
  } catch (error) {
    console.error('❌ Gemini AI error:', error);
    res.status(500).json({ 
      intent: "unknown", 
      message: "I didn't understand that." 
    });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    env: {
      hasSttKey: !!process.env.GOOGLE_STT_API_KEY,
      hasMapsKey: !!process.env.GOOGLE_MAPS_API_KEY,
      hasGeminiKey: !!process.env.GEMINI_API_KEY
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Kibo backend running on http://localhost:${PORT}`);
  console.log(`📍 STT endpoint: http://localhost:${PORT}/api/stt`);
  console.log(`🧠 NLP endpoint: http://localhost:${PORT}/api/nlp`);
  console.log(`⚙️  Config endpoint: http://localhost:${PORT}/api/config`);
  console.log(`❤️  Health endpoint: http://localhost:${PORT}/api/health`);
  
  // Environment check
  if (!process.env.GOOGLE_STT_API_KEY) console.warn("⚠️  GOOGLE_STT_API_KEY not found - voice features will not work");
  if (!process.env.GOOGLE_MAPS_API_KEY) console.warn("⚠️  GOOGLE_MAPS_API_KEY not found - maps will not load");
  if (!process.env.GEMINI_API_KEY) console.warn("⚠️  GEMINI_API_KEY not found - AI features will not work");
  
  console.log("\n🔧 Setup Instructions:");
  console.log("1. Create a .env file in your backend root directory");
  console.log("2. Add your Google Cloud API keys:");
  console.log("   GOOGLE_STT_API_KEY=your_speech_to_text_key");
  console.log("   GOOGLE_MAPS_API_KEY=your_maps_key");  
  console.log("   GEMINI_API_KEY=your_gemini_key");
  console.log("3. Enable these APIs in Google Cloud Console:");
  console.log("   - Cloud Speech-to-Text API");
  console.log("   - Maps JavaScript API");
  console.log("   - Gemini API (AI Studio)");
});

// ===== VAPI INTEGRATION =====


// VAPI Text-to-Speech endpoint
app.post('/api/vapi/speak', async (req, res) => {
  try {
    const { text, voice = 'jennifer', speed = 1.0 } = req.body;
    
    if (!text || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text is required' });
    }

    console.log('🗣️ VAPI TTS Request:', text.substring(0, 50) + '...');

    const vapiResponse = await fetch('https://api.vapi.ai/call/web/voice/speak', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: text,
        voice: voice,
        speed: speed,
        format: 'mp3' // or 'wav'
      })
    });

    if (!vapiResponse.ok) {
      const errorText = await vapiResponse.text();
      console.error('❌ VAPI Error:', vapiResponse.status, errorText);
      throw new Error(`VAPI request failed: ${vapiResponse.status}`);
    }

    // Get audio buffer from VAPI
    const audioBuffer = await vapiResponse.arrayBuffer();
    
    // Convert to base64 for frontend
    const base64Audio = Buffer.from(audioBuffer).toString('base64');

    res.json({
      success: true,
      audio: base64Audio,
      format: 'mp3',
      text: text
    });

  } catch (error) {
    console.error('❌ VAPI TTS Error:', error);
    res.status(500).json({ 
      error: 'VAPI text-to-speech failed',
      fallback: true // Tell frontend to use browser TTS
    });
  }
});

// Health check for VAPI
app.get('/api/vapi/health', async (req, res) => {
  try {
    const testResponse = await fetch('https://api.vapi.ai/call/web/voice/speak', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VAPI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Test',
        voice: 'jennifer'
      })
    });

    res.json({
      vapiAvailable: testResponse.ok,
      status: testResponse.status
    });
  } catch (error) {
    res.json({
      vapiAvailable: false,
      error: error.message
    });
  }
});