
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
    vapiPublicApiKey: process.env.VAPI_PUBLIC_API_KEY || null,
    vapiAssistantId: process.env.VAPI_ASSISTANT_ID || null,
    // ✅ ADD THESE RESEMBLE.AI FIELDS:
    resembleApiKey: process.env.RESEMBLE_API_KEY || null,
    resembleVoiceUuid: process.env.RESEMBLE_VOICE_UUID || null,
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

// ===== RESEMBLE.AI WALL-E TTS ENDPOINT =====
// ===== ALTERNATIVE WALL-E TTS ENDPOINT =====
app.post('/api/resemble-tts', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: "No text provided" });
    }
    
    if (!process.env.RESEMBLE_API_KEY || !process.env.RESEMBLE_VOICE_UUID) {
      return res.status(200).json({
        success: false,
        fallback: true,
        message: "Resemble.ai not configured"
      });
    }
    
    console.log("🤖 Wall-E TTS request:", text.substring(0, 50) + "...");
    
    // ✅ TRY METHOD 1: Direct synthesis endpoint
    try {
      const response1 = await fetch('https://app.resemble.ai/api/v2/clips', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.RESEMBLE_API_KEY}`
        },
        body: JSON.stringify({
          voice_uuid: process.env.RESEMBLE_VOICE_UUID,
          body: text,
          title: "Wall-E"
        })
      });
      
      if (response1.ok) {
        const data1 = await response1.json();
        console.log("✅ Method 1 success");
        return res.json({
          success: true,
          audio_url: data1.audio_src,
          method: "resemble_method_1"
        });
      }
    } catch (e1) {
      console.log("Method 1 failed:", e1.message);
    }
    
    // ✅ TRY METHOD 2: Different endpoint format
    try {
      const response2 = await fetch('https://app.resemble.ai/api/v2/projects/clips/create_sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Token ${process.env.RESEMBLE_API_KEY}`
        },
        body: JSON.stringify({
          voice_uuid: process.env.RESEMBLE_VOICE_UUID,
          body: text
        })
      });
      
      if (response2.ok) {
        const data2 = await response2.json();
        console.log("✅ Method 2 success");
        return res.json({
          success: true,
          audio_url: data2.audio_src,
          method: "resemble_method_2"
        });
      }
    } catch (e2) {
      console.log("Method 2 failed:", e2.message);
    }
    
    // ✅ ALL METHODS FAILED - Use browser TTS
    console.log("🔄 All Resemble.ai methods failed, using browser TTS");
    return res.json({
      success: false,
      fallback: true,
      message: "Resemble.ai unavailable, using browser TTS"
    });
    
  } catch (error) {
    console.error("❌ Resemble TTS error:", error);
    res.json({
      success: false,
      fallback: true,
      message: "Using browser TTS fallback"
    });
  }
});

// Wall-E TTS endpoint using Resemble.ai
app.post('/api/resemble-tts', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: "No text provided" });
    }
    
    if (!process.env.RESEMBLE_API_KEY || !process.env.RESEMBLE_VOICE_UUID) {
      // ✅ Silent fallback - no console spam
      return res.status(200).json({
        success: false,
        fallback: true,
        message: "Using browser TTS"
      });
    }
    
    // ✅ Try Resemble.ai silently
    try {
      const response = await fetch('https://f.cluster.resemble.ai/synthesize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEMBLE_API_KEY}`,
          'Content-Type': 'application/json',
          'Accept-Encoding': 'gzip, deflate, br'
        },
        body: JSON.stringify({
          voice_uuid: process.env.RESEMBLE_VOICE_UUID,
          data: text,
          sample_rate: 22050,
          output_format: "mp3"
        })
      });
      
      if (response.ok) {
        const audioData = await response.json();
        
        if (audioData.success && audioData.audio_content) {
          // ✅ Success - return Resemble.ai audio
          return res.json({
            success: true,
            audio_content: audioData.audio_content,
            output_format: audioData.output_format || "mp3",
            duration: audioData.duration,
            method: "resemble_wall_e"
          });
        }
      }
    } catch (resembleError) {
      // ✅ Silent fail - don't log errors
    }
    
    // ✅ Silent fallback to browser TTS
    res.json({
      success: false,
      fallback: true,
      message: "Using browser TTS"
    });
    
  } catch (error) {
    // ✅ Silent fallback on any error
    res.json({
      success: false,
      fallback: true,
      message: "Using browser TTS"
    });
  }
});

// Update your config endpoint to include Resemble keys
app.get('/api/config', (req, res) => {
  res.json({
    googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || null,
    geminiApiKey: process.env.GEMINI_API_KEY || null,
    googleSttApiKey: process.env.GOOGLE_STT_API_KEY || null,
    vapiPublicApiKey: process.env.VAPI_PUBLIC_API_KEY || null,
    vapiAssistantId: process.env.VAPI_ASSISTANT_ID || null,
    // ✅ NEW: Add Resemble config
    resembleApiKey: process.env.RESEMBLE_API_KEY || null,
    resembleVoiceUuid: process.env.RESEMBLE_VOICE_UUID || null,
  });
});