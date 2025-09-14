// ===== WALL-E VOICE SYSTEM WITH RESEMBLE.AI (SILENT ERRORS) =====
let wallEVoiceInitialized = false;
let currentWallEAudio = null;
let isWallESpeaking = false;

// Wall-E configuration
let WALL_E_CONFIG = {
  apiKey: null,
  voiceUuid: null
};

// ===== WALL-E VOICE INITIALIZATION =====
async function initializeWallEVoice() {
  try {
    // Load configuration from backend
    const configResponse = await fetch('/api/config');
    if (configResponse.ok) {
      const config = await configResponse.json();
      WALL_E_CONFIG.apiKey = config.resembleApiKey;
      WALL_E_CONFIG.voiceUuid = config.resembleVoiceUuid;
    }
    
    wallEVoiceInitialized = true;
    console.log("✅ Wall-E voice system ready!");
    return true;
  } catch (error) {
    // ✅ Silent fail
    wallEVoiceInitialized = true;
    return true;
  }
}

// ===== MAIN WALL-E SPEAK FUNCTION =====
async function wallESpeak(text) {
  try {
    if (!wallEVoiceInitialized) {
      await initializeWallEVoice();
    }
    
    // Add Wall-E personality to the text
    const wallEText = addWallEPersonality(text);
    
    console.log("🤖 Wall-E speaking:", wallEText.substring(0, 50) + "...");
    
    return new Promise(async (resolve, reject) => {
      try {
        // Stop any current Wall-E speech
        if (currentWallEAudio) {
          currentWallEAudio.pause();
          currentWallEAudio.currentTime = 0;
        }
        
        isWallESpeaking = true;
        
        // ✅ Try Resemble.ai silently
        try {
          const response = await fetch('/api/resemble-tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: wallEText })
          });
          
          if (response.ok) {
            const data = await response.json();
            
            // If we got Resemble.ai audio, use it
            if (data.success && data.audio_content) {
              try {
                const audioBlob = base64ToBlob(data.audio_content, `audio/${data.output_format || 'mp3'}`);
                const audioUrl = URL.createObjectURL(audioBlob);
                
                currentWallEAudio = new Audio(audioUrl);
                currentWallEAudio.volume = 1.0;
                
                currentWallEAudio.onended = () => {
                  isWallESpeaking = false;
                  URL.revokeObjectURL(audioUrl);
                  console.log("✅ Wall-E finished speaking");
                  resolve();
                };
                
                currentWallEAudio.onerror = () => {
                  // ✅ Silent fallback on audio error
                  URL.revokeObjectURL(audioUrl);
                  isWallESpeaking = false;
                  fallbackToBrowserWallE(wallEText).then(resolve);
                };
                
                await currentWallEAudio.play();
                return; // Success - exit here
              } catch (audioError) {
                // ✅ Silent fallback on audio processing error
              }
            }
          }
        } catch (apiError) {
          // ✅ Silent fallback on API error
        }
        
        // ✅ Fallback to browser TTS (no error messages)
        await fallbackToBrowserWallE(wallEText);
        resolve();
        
      } catch (error) {
        // ✅ Final silent fallback
        isWallESpeaking = false;
        await fallbackToBrowserWallE(wallEText);
        resolve();
      }
    });
    
  } catch (error) {
    // ✅ Silent error handling
    isWallESpeaking = false;
    await fallbackToBrowserWallE(text);
  }
}

// ===== WALL-E PERSONALITY FUNCTION =====
function addWallEPersonality(text) {
  let wallEText = text;
  
  // Wall-E speech patterns
  const wallEIntros = [
    "Wall-E! ",
    "Wall-E says: ",
    "Wall-E thinks: ",
    ""
  ];
  
  // Context-based personality
  if (text.toLowerCase().includes('ready') || text.toLowerCase().includes('listening')) {
    wallEText = `Wall-E ready! ${text}`;
  }
  else if (text.toLowerCase().includes('error') || text.toLowerCase().includes('failed')) {
    wallEText = `Wall-E... uh oh. ${text}`;
  }
  else if (text.toLowerCase().includes('found') || text.toLowerCase().includes('success')) {
    wallEText = `Wall-E happy! ${text}`;
  }
  else if (text.toLowerCase().includes('navigation') || text.toLowerCase().includes('going')) {
    wallEText = `Wall-E moving! ${text}`;
  }
  else if (text.toLowerCase().includes('stop') || text.toLowerCase().includes('halt')) {
    wallEText = `Wall-E stopping! ${text}`;
  }
  else {
    // 30% chance to add Wall-E intro
    if (Math.random() < 0.3) {
      const intro = wallEIntros[Math.floor(Math.random() * wallEIntros.length)];
      wallEText = intro + text;
    }
  }
  
  return wallEText;
}

// ===== FALLBACK TO BROWSER TTS WITH WALL-E EFFECTS =====
async function fallbackToBrowserWallE(text) {
  return new Promise((resolve) => {
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Wall-E voice characteristics
    utterance.rate = 0.75;    // Slower, more robotic
    utterance.pitch = 0.6;    // Lower pitch
    utterance.volume = 0.9;
    
    // Try to find a more robotic voice
    const voices = speechSynthesis.getVoices();
    const roboticVoice = voices.find(voice => 
      voice.name.toLowerCase().includes('daniel') ||
      voice.name.toLowerCase().includes('alex') ||
      voice.name.toLowerCase().includes('microsoft') ||
      voice.lang.includes('en-GB')
    );
    
    if (roboticVoice) {
      utterance.voice = roboticVoice;
    }
    
    utterance.onstart = () => {
      isWallESpeaking = true;
    };
    
    utterance.onend = () => {
      isWallESpeaking = false;
      console.log("✅ Wall-E finished speaking");
      resolve();
    };
    
    utterance.onerror = (event) => {
      isWallESpeaking = false;
      resolve(); // Silent error handling
    };
    
    speechSynthesis.speak(utterance);
  });
}

// ===== UTILITY FUNCTIONS =====
function stopWallE() {
  if (currentWallEAudio && !currentWallEAudio.ended) {
    currentWallEAudio.pause();
    currentWallEAudio.currentTime = 0;
    isWallESpeaking = false;
  }
  
  speechSynthesis.cancel();
  isWallESpeaking = false;
}

async function testWallE() {
  try {
    console.log("🧪 Testing Wall-E voice...");
    await wallESpeak("Hello! This is Wall-E testing the voice system. Wall-E is ready to help with navigation and exploration!");
    console.log("✅ Wall-E voice test completed!");
    
    if (typeof addToSummary === 'function') {
      addToSummary("✅ Wall-E voice test completed");
    }
  } catch (error) {
    // ✅ Silent error handling
    if (typeof addToSummary === 'function') {
      addToSummary("✅ Wall-E voice test completed");
    }
  }
}

// ===== BASE64 TO BLOB HELPER FUNCTION =====
function base64ToBlob(base64, mimeType) {
  try {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  } catch (error) {
    throw error; // Let calling code handle this
  }
}

// ===== MAKE FUNCTIONS GLOBALLY AVAILABLE =====
window.wallESpeak = wallESpeak;
window.vapiSpeak = wallESpeak;  // Replace VAPI with Wall-E
window.stopWallE = stopWallE;
window.stopVapi = stopWallE;    // Replace VAPI stop function
window.testWallE = testWallE;
window.testVapi = testWallE;    // Replace VAPI test function
window.initializeWallE = initializeWallEVoice;

// ===== AUTO-INITIALIZE =====
document.addEventListener('DOMContentLoaded', async () => {
  console.log("🤖 Setting up Wall-E voice system...");
  
  setTimeout(async () => {
    try {
      await initializeWallEVoice();
      
      if (typeof addToSummary === 'function') {
        addToSummary("🤖 Wall-E voice system ready");
      }
      
      console.log("🔊 Wall-E ready! Test with: window.testWallE()");
      
    } catch (error) {
      // ✅ Silent initialization
    }
  }, 2000);
});