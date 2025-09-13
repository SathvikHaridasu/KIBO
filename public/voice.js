// ===== VOICE SYSTEM MODULE =====

// ===== VOICE ACTIVITY DETECTION VARIABLES =====
let audioContext = null;
let analyser = null;
let microphone = null;
let microphoneStream = null;
let mediaRecorder = null;
let audioStream = null;
let isVoiceEnabled = true;
let isProcessing = false;
let listening = false;
let shouldListen = true;
let speechCooldownActive = false;
let isListening = false;
let isSpeaking = false;

// ✅ FIXED VAD Configuration - More lenient for better speech capture
let vadThreshold = 25; 
let silenceThreshold = 2000; // Increased from 1200ms - allows longer pauses
let minSpeechDuration = 1000; // Increased from 800ms - prevents cutting off
let vadSilenceTime = 2000; // Increased from 1000ms - more time for pauses
let vadMinSpeechTime = 1000; // Increased from 500ms - ensures full sentences
let silenceStart = 0;
let speechStart = 0;
let currentVadRecording = null;
let vadAudioChunks = [];
let vadSession = null;
let isDetectingSpeech = false;
const MAX_RECORDING_TIME = 15000; // Increased to 15 seconds
let ttsEndTime = 0;          // When TTS finished
let speechCooldownPeriod = 3000;  // 3 seconds after TTS before allowing VAD
let lastSpeechVolume = 0;    // Track volume levels
let consecutiveSilentFrames = 0;
let ttsBlockUntil = 0;
let ttsActive = false;
let blockUntil = 0;
let processingCommand = false;
let commandStartTime = 0;

// Speech synthesis
let speechSynthesis = window.speechSynthesis;
let isSpeakingTTS = false;

// VAPI variables
let vapiAvailable = false;
let currentAudio = null;
let isPlayingAudio = false;

// ===== CORE ENDPOINTS =====
const STT_ENDPOINT = "http://localhost:3001/api/stt";
const NLP_ENDPOINT = "http://localhost:3001/api/nlp";
const VAPI_ENDPOINT = "http://localhost:3001/api/vapi/speak";
const VAPI_HEALTH_ENDPOINT = "http://localhost:3001/api/vapi/health";

// ===== VOICE SYSTEM =====
async function setupVoice() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.log("❌ Microphone access not supported in this browser.");
      const toggleBtn = document.getElementById("toggleVoiceBtn");
      if (toggleBtn) toggleBtn.disabled = true;
      return;
    }

    const healthCheck = await fetch("http://localhost:3001/api/health");
    if (!healthCheck.ok) {
      throw new Error("Backend not available");
    }

    console.log("✅ Voice setup complete");
    
    // ✅ Don't call initializeVAD here - let checkVAPIAvailability handle it
    
  } catch (error) {
    console.error("❌ Voice setup error:", error);
    console.log("⚠️ Voice backend not available, but continuing with limited features");
    // Don't throw error - allow system to continue
  }
}

function updateVoiceButton(active) {
  const button = document.getElementById("toggleVoiceBtn");
  if (!button) return;
  
  if (active) {
    button.innerHTML = '<i class="fas fa-microphone-alt"></i><span class="btn-text">Voice Active</span>';
    button.style.backgroundColor = "#28a745";
    button.setAttribute("aria-pressed", "true");
  } else {
    button.innerHTML = '<i class="fas fa-microphone-slash"></i><span class="btn-text">Voice Off</span>';
    button.style.backgroundColor = "#dc3545";
    button.setAttribute("aria-pressed", "false");
  }
}

async function toggleVoice() {
  const button = document.getElementById("toggleVoiceBtn");
  const voiceStatus = document.getElementById("voiceStatus");
  
  if (!isListening) {
    try {
      console.log("🎤 Starting voice system...");
      
      // ✅ Update UI immediately 
      if (button) {
        button.innerHTML = '<i class="fas fa-microphone-slash"></i><span class="btn-text">Disable Voice</span>';
        button.setAttribute("aria-pressed", "true");
        button.classList.add("active");
      }
      
      if (voiceStatus) {
        voiceStatus.innerHTML = '<i class="fas fa-spinner fa-spin"></i><span>Initializing...</span>';
      }
      
      await setupVoice(); 
      isListening = true;
      
      // ✅ Update UI for active state
      if (voiceStatus) {
        voiceStatus.innerHTML = '<i class="fas fa-microphone"></i><span>Voice: active</span>';
      }
      
      console.log("✅ Voice system started automatically");
      
      // ✅ Auto-announce readiness
      if (typeof say === 'function') {
        await say("Voice system ready. I'm always listening - just start speaking!");
      }
      
      if (typeof addToSummary === 'function') {
        addToSummary("🤖 Voice system ready. I'm always listening - just start speaking!");
      }
      
    } catch (error) {
      console.error("❌ Voice activation failed:", error);
      
      // Reset UI on failure
      if (button) {
        button.innerHTML = '<i class="fas fa-microphone"></i><span class="btn-text">Enable Voice</span>';
        button.setAttribute("aria-pressed", "false");
        button.classList.remove("active");
      }
      
      if (voiceStatus) {
        voiceStatus.innerHTML = '<i class="fas fa-microphone-slash"></i><span>Voice: error</span>';
      }
      
      if (typeof toast === 'function') {
        toast("Voice activation failed. Click the microphone button to retry.");
      }
    }
  } else {
    // Disable voice
    console.log("🔇 Disabling voice system...");
    
    if (typeof stopVoiceRecognition === 'function') {
      stopVoiceRecognition();
    }
    
    isListening = false;
    
    // Update UI
    if (button) {
      button.innerHTML = '<i class="fas fa-microphone"></i><span class="btn-text">Enable Voice</span>';
      button.setAttribute("aria-pressed", "false");
      button.classList.remove("active");
    }
    
    if (voiceStatus) {
      voiceStatus.innerHTML = '<i class="fas fa-microphone-slash"></i><span>Voice: disabled</span>';
    }
    
    console.log("✅ Voice system disabled");
  }
}

async function initializeVAD() {
  try {
    console.log("🎤 Initializing Voice Activity Detection...");
    
    audioStream = await navigator.mediaDevices.getUserMedia({ 
      audio: { 
        sampleRate: 48000, 
        channelCount: 1, 
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      } 
    });

    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    microphone = audioContext.createMediaStreamSource(audioStream);
    
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.3;
    microphone.connect(analyser);

    listening = true;
    isVoiceEnabled = true;
    isProcessing = false;
    shouldListen = true;
    
    updateVoiceUI(true);
    if (typeof setVoiceStatus === 'function') {
      setVoiceStatus("👂 Always listening - speak anytime");
    }
    
    console.log("🔊 Voice Activity Detection started successfully");
    
    if (typeof say === 'function') {
      say("Voice system ready. I'm always listening - just start speaking!");
    }
    
    setTimeout(() => {
      if (listening) {
        startVADLoop();
      }
    }, 3000); // Back to 3 seconds
    
  } catch (error) {
    console.error("❌ VAD initialization failed:", error);
    handleVADError(error);
  }
}

function startVADLoop() {
  if (!listening || !analyser) return;
  
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  function detectVoiceActivity() {
    if (!listening || !analyser) return;
    
    analyser.getByteFrequencyData(dataArray);
    
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    const averageVolume = sum / bufferLength;
    
    const now = Date.now();
    
    // ✅ NAVIGATION MODE: Only listen for STOP command
    if ((typeof navigationInProgress !== 'undefined' && navigationInProgress) || 
        (typeof stopOnlyMode !== 'undefined' && stopOnlyMode)) {
      if (averageVolume > vadThreshold && !isSpeaking) {
        console.log(`🛑 NAVIGATION MODE: Only listening for STOP command`);
        isSpeaking = true;
        speechStart = now;
        silenceStart = 0;
        if (typeof setVoiceStatus === 'function') {
          setVoiceStatus("🛑 Listening for STOP only...");
        }
        startVADRecording();
      } else if (isSpeaking) {
        if (averageVolume <= vadThreshold) {
          if (silenceStart === 0) {
            silenceStart = now;
          } else if (now - silenceStart > vadSilenceTime) {
            const speechDuration = now - speechStart;
            if (speechDuration > vadMinSpeechTime) {
              console.log(`✅ STOP-only speech ended, checking for STOP command`);
              stopVADRecording();
            } else {
              cancelVADRecording();
            }
            isSpeaking = false;
            silenceStart = 0;
            speechStart = 0;
            if (typeof setVoiceStatus === 'function') {
              setVoiceStatus("🛑 Navigation active - say STOP to halt");
            }
          }
        } else {
          silenceStart = 0;
        }
      }
      requestAnimationFrame(detectVoiceActivity);
      return;
    }
    
    // ✅ NORMAL MODE: Full audio processing
    const isBlocked = ttsActive || 
                      isProcessing || 
                      isSpeakingTTS || 
                      isPlayingAudio || 
                      processingCommand ||
                      (now < blockUntil);
    
    if (isBlocked) {
      if (isSpeaking) {
        console.log("🔇 Stopping recording - system processing command");
        isSpeaking = false;
        silenceStart = 0;
        speechStart = 0;
        cancelVADRecording();
        if (typeof setVoiceStatus === 'function') {
          setVoiceStatus("🔇 Processing - please wait");
        }
      }
      requestAnimationFrame(detectVoiceActivity);
      return;
    }
    
    if (averageVolume > vadThreshold && !isSpeaking) {
      console.log(`🗣️ Speech detected (volume: ${averageVolume.toFixed(1)}), starting recording...`);
      isSpeaking = true;
      speechStart = now;
      silenceStart = 0;
      if (typeof setVoiceStatus === 'function') {
        setVoiceStatus("🎙️ Recording...");
      }
      startVADRecording();
    } else if (isSpeaking) {
      if (averageVolume <= vadThreshold) {
        if (silenceStart === 0) {
          silenceStart = now;
        } else if (now - silenceStart > vadSilenceTime) {
          const speechDuration = now - speechStart;
          if (speechDuration > vadMinSpeechTime) {
            console.log(`✅ Speech ended (${speechDuration}ms), processing...`);
            stopVADRecording();
          } else {
            console.log("⚠️ Speech too short, ignoring");
            cancelVADRecording();
          }
          isSpeaking = false;
          silenceStart = 0;
          speechStart = 0;
          if (typeof setVoiceStatus === 'function') {
            setVoiceStatus("👂 Always listening - speak anytime");
          }
        }
      } else {
        silenceStart = 0;
      }
    }
    
    requestAnimationFrame(detectVoiceActivity);
  }
  
  detectVoiceActivity();
  console.log("🔄 Enhanced Voice Activity Detection loop started");
}

function startVADRecording() {
  if (!audioStream || isProcessing) return;
  
  vadAudioChunks = [];
  
  const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') 
    ? 'audio/webm;codecs=opus' 
    : 'audio/webm';
    
  currentVadRecording = new MediaRecorder(audioStream, { 
    mimeType: mimeType,
    audioBitsPerSecond: 128000  
  });
  
  currentVadRecording.ondataavailable = (event) => {
    if (event.data.size > 0) {
      vadAudioChunks.push(event.data);
    }
  };
  
  currentVadRecording.onstop = async () => {
    if (!isProcessing && vadAudioChunks.length > 0) {
      await processVADAudio();
    }
  };
  
  currentVadRecording.start();
  
  setTimeout(() => {
    if (currentVadRecording && currentVadRecording.state === 'recording') {
      console.log("⏰ Max recording time reached, stopping");
      stopVADRecording();
    }
  }, MAX_RECORDING_TIME);
}

function stopVADRecording() {
  if (currentVadRecording && currentVadRecording.state === 'recording') {
    currentVadRecording.stop();
  }
}

function cancelVADRecording() {
  if (currentVadRecording && currentVadRecording.state === 'recording') {
    currentVadRecording.stop();
    vadAudioChunks = [];
  }
}

// ✅ STOP-only audio processing during navigation
async function processSTOPCommand() {
  if (vadAudioChunks.length === 0) return;
  
  console.log("🛑 Checking for STOP command during navigation...");
  
  try {
    const audioBlob = new Blob(vadAudioChunks, { 
      type: vadAudioChunks[0].type || 'audio/webm' 
    });
    
    const transcript = await transcribeAudio(audioBlob);
    
    if (transcript && transcript.trim()) {
      const cleanText = transcript.toLowerCase().trim();
      console.log("🛑 Navigation transcript:", cleanText);
      
      // ✅ Check for STOP command variants
      const stopWords = ['stop', 'halt', 'pause', 'cease', 'quit', 'end'];
      const isStopCommand = stopWords.some(word => cleanText.includes(word));
      
      if (isStopCommand) {
        console.log("🛑 STOP COMMAND DETECTED - Halting navigation");
        
        // Stop robot immediately
        if (typeof stopRobot === 'function') {
          await stopRobot();
        }
        
        // Reset navigation state
        if (typeof window !== 'undefined') {
          window.navigationActive = false;
          window.navigationInProgress = false;
          window.stopOnlyMode = false;
        }
        
        // Clear any pending movements
        if (typeof positionWatcher !== 'undefined' && positionWatcher) {
          navigator.geolocation.clearWatch(positionWatcher);
          positionWatcher = null;
        }
        
        // Announce stop
        const stopMessage = "Journey stopped. Please let me know where you would like to go.";
        if (typeof addToSummary === 'function') {
          addToSummary("🛑 Navigation stopped by user");
        }
        
        // Resume normal audio processing
        if (typeof setVoiceStatus === 'function') {
          setVoiceStatus("👂 Ready - where would you like to go?");
        }
        
        // Wait a moment then speak
        setTimeout(() => {
          if (typeof sayAndResume === 'function') {
            sayAndResume(stopMessage);
          }
        }, 500);
        
      } else {
        console.log("🛑 Not a stop command, ignoring during navigation");
        if (typeof setVoiceStatus === 'function') {
          setVoiceStatus("🛑 Navigation active - say STOP to halt");
        }
      }
    }
    
  } catch (error) {
    console.error("❌ STOP command processing error:", error);
  } finally {
    vadAudioChunks = [];
  }
}

async function processVADAudio() {
  if (isProcessing || vadAudioChunks.length === 0) return;
  
  // ✅ STOP-only processing during navigation
  if ((typeof navigationInProgress !== 'undefined' && navigationInProgress) || 
      (typeof stopOnlyMode !== 'undefined' && stopOnlyMode)) {
    await processSTOPCommand();
    return;
  }
  
  // ✅ Regular processing when not navigating
  console.log("🛑 STARTING COMMAND PROCESSING - BLOCKING ALL AUDIO INPUT");
  isProcessing = true;
  processingCommand = true;
  commandStartTime = Date.now();
  ttsActive = true;
  if (typeof setVoiceStatus === 'function') {
    setVoiceStatus("🧠 Processing command - audio blocked");
  }
  
  try {
    const audioBlob = new Blob(vadAudioChunks, { 
      type: vadAudioChunks[0].type || 'audio/webm' 
    });
    
    console.log("🎤 Processing audio blob, size:", audioBlob.size);
    
    if (audioBlob.size < 1000) {
      console.log("⚠️ Audio too small, skipping");
      clearCommandBlock();
      return;
    }
    
    const transcript = await transcribeAudio(audioBlob);
    
    if (transcript && transcript.trim()) {
      console.log("📝 Transcript:", transcript);
      if (typeof setTranscript === 'function') {
        setTranscript(`You said: "${transcript}"`);
      }
      
      console.log("🔄 Processing command, audio input remains blocked");
      
      // Analyze sentiment and topics with Genesys
      if (window.sentimentAnalyzer) {
        try {
          const sentimentAnalysis = await window.sentimentAnalyzer.analyzeTranscript(transcript.trim());
          if (sentimentAnalysis) {
            console.log("🧠 Sentiment Analysis:", sentimentAnalysis);
          }
        } catch (error) {
          console.warn("⚠️ Sentiment analysis failed:", error);
        }
      }
      
      if (awaitingConfirmation) {
        console.log("⏳ Checking confirmation for:", transcript);
        await handleConfirmation(transcript.trim());
        return;
      }
      
      const aiResponse = await fetch(NLP_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcript.trim() })
      });
      
      if (aiResponse.ok) {
        const parsed = await aiResponse.json();
        console.log("🧠 AI Response:", parsed);
        await executeSmartIntent(parsed);
      } else {
        throw new Error(`NLP request failed: ${aiResponse.status}`);
      }
      
    } else {
      console.log("⚠️ No transcript received");
      clearCommandBlock();
      if (typeof setVoiceStatus === 'function') {
        setVoiceStatus("👂 No speech detected - try again");
      }
    }
    
  } catch (error) {
    console.error("❌ VAD processing error:", error);
    clearCommandBlock();
    if (typeof setVoiceStatus === 'function') {
      setVoiceStatus("❌ Processing failed - speak again");
    }
    
    if (!isSpeakingTTS && typeof say === 'function') {
      say("Sorry, I didn't catch that. Please try again.");
    }
  } finally {
    vadAudioChunks = [];
    console.log("🔄 Audio processing complete, waiting for speech to finish");
  }
}

function clearCommandBlock() {
  console.log("✅ CLEARING COMMAND BLOCK - RESUMING AUDIO INPUT");
  processingCommand = false;
  isProcessing = false;
  ttsActive = false;
  blockUntil = 0;
  commandStartTime = 0;
}

async function handleConfirmation(text) {
  console.log("🤔 Handling confirmation:", text);
  
  if (awaitingConfirmation.type === "destination_clarification") {
    const clarificationText = `User originally asked about a destination, I asked for clarification, and they responded: "${text}". What destination do they want?`;
    
    try {
      const result = await smartParse(clarificationText);
      awaitingConfirmation = null;
      
      if (result.intent === "navigate" && result.destination) {
        console.log("🎯 Clarified destination:", result.destination);
        if (typeof searchAndNavigate === 'function') {
          await searchAndNavigate(result.destination);
        }
      } else if (result.intent === "nearest" && result.searchTerm) {
        console.log("🔍 Clarified search:", result.searchTerm);
        if (typeof findNearestPlace === 'function') {
          await findNearestPlace(result.searchTerm);
        }
      } else {
        if (typeof sayAndResume === 'function') {
          sayAndResume("I still couldn't understand the destination. Please try again.");
        }
      }
      return;
    } catch (error) {
      console.error("❌ Clarification error:", error);
      awaitingConfirmation = null;
      if (typeof sayAndResume === 'function') {
        sayAndResume("Sorry, please tell me where you want to go.");
      }
      return;
    }
  }
  
  const confirmationWords = /\b(yes|yeah|go|start|begin|navigate|directions|proceed|ok|okay|sure|please)\b/i;
  const cancelWords = /\b(no|cancel|stop|nevermind|abort|nope)\b/i;
  
  if (confirmationWords.test(text)) {
    const { action } = awaitingConfirmation; 
    awaitingConfirmation = null; 
    console.log("✅ User confirmed - starting navigation");
    if (typeof addToSummary === 'function') {
      addToSummary("✅ Navigation confirmed by user");
    }
    if (typeof sayAndResume === 'function') {
      sayAndResume("Starting navigation now!");
    }
    action(); 
    return;
  } else if (cancelWords.test(text)){
    awaitingConfirmation = null; 
    console.log("❌ User canceled navigation");
    if (typeof addToSummary === 'function') {
      addToSummary("❌ Navigation canceled by user");
    }
    if (typeof sayAndResume === 'function') {
      sayAndResume("Navigation canceled.");
    }
    return;
  } else {
    console.log("🤔 Checking if command is confirmation...");
    try {
      const parsed = await smartParse(text);
      if (parsed.intent === "control" && (parsed.action === "start" || parsed.action === "begin")) {
        const { action } = awaitingConfirmation;
        awaitingConfirmation = null;
        console.log("✅ User confirmed via start command");
        if (typeof addToSummary === 'function') {
          addToSummary("✅ Navigation confirmed via start command");
        }
        if (typeof sayAndResume === 'function') {
          sayAndResume("Starting navigation now!");
        }
        action();
        return;
      } else if (parsed.intent === "navigate" || parsed.intent === "nearest") {
        awaitingConfirmation = null;
        console.log("🔄 User requesting new navigation, processing new command");
        await executeSmartIntent(parsed);
        return;
      }
    } catch (error) {
      console.log("🤷 Not a clear confirmation, asking again");
    }
    
    const searchTerm = awaitingConfirmation.searchTerm || "destination";
    if (typeof sayAndResume === 'function') {
      sayAndResume(`Do you want to start navigation to ${searchTerm}? Please say yes or no.`);
    }
    return;
  }
}

function updateVoiceUI(active) {
  const button = document.getElementById("toggleVoiceBtn");
  if (active) {
    button.innerHTML = '<i class="fas fa-microphone-alt"></i><span class="btn-text">Voice Active</span>';
    button.style.backgroundColor = "#28a745";
    button.setAttribute("aria-pressed", "true");
  } else {
    button.innerHTML = '<i class="fas fa-microphone-slash"></i><span class="btn-text">Voice Off</span>';
    button.style.backgroundColor = "#dc3545";
    button.setAttribute("aria-pressed", "false");
  }
}

function handleVADError(error) {
  if (error.name === 'NotAllowedError') {
    if (typeof toast === 'function') {
      toast("Please allow microphone access for voice features.");
    }
    if (typeof setVoiceStatus === 'function') {
      setVoiceStatus("❌ Microphone access denied");
    }
  } else {
    if (typeof toast === 'function') {
      toast("Could not start voice system: " + error.message);
    }
    if (typeof setVoiceStatus === 'function') {
      setVoiceStatus("❌ Voice system failed");
    }
  }
  
  updateVoiceUI(false);
}

// Check if VAPI is available on startup
async function checkVAPIAvailability() {
  console.log("🎤 Checking VAPI availability...");
  
  try {
    // Try VAPI first
    if (typeof window.VAPI !== 'undefined') {
      console.log("✅ VAPI found, initializing...");
      await initializeVAPI();
    } else {
      console.log("🎤 VAPI unavailable - using browser TTS");
      
      // ✅ AUTO-START BROWSER VOICE SYSTEM  
      console.log("🚀 Auto-starting voice system...");
      await setupVoice(); // ← Use correct function name
      
      // ✅ AUTOMATICALLY START VAD LISTENING
      if (!listening) {
        console.log("🎤 Auto-enabling voice activity detection...");
        await initializeVAD(); // ← Start VAD directly
        isListening = true; // ← Set the flag
        
        // Update UI to show voice is active
        updateVoiceButton(true);
        if (typeof setVoiceStatus === 'function') {
          setVoiceStatus("👂 Always listening - speak anytime");
        }
      }
    }
  } catch (error) {
    console.error("❌ Voice system initialization failed:", error);
  }
}

async function initializeBrowserVoice() {
  console.log("🎤 Initializing browser voice system...");
  
  try {
    await setupVoice();
    console.log("✅ Browser voice system initialized");
  } catch (error) {
    console.error("❌ Browser voice initialization failed:", error);
    throw error;
  }
}

// Enhanced say function with VAPI
function say(text) {
  return new Promise((resolve) => {
    if (!isVoiceEnabled) {
      console.log("🔇 Voice disabled, skipping:", text);
      resolve();
      return;
    }
    
    console.log("🗣️ Speaking:", text);
    if (typeof addToSummary === 'function') {
      addToSummary(`🤖 ${text}`);
    }
    if (typeof setAssistant === 'function') {
      setAssistant(text);
    }
    
    ttsActive = true;
    isSpeakingTTS = true;
    blockUntil = Date.now() + (text.length * 60) + 1500;
    
    stopCurrentSpeech();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;
    
    utterance.onend = () => {
      ttsActive = false;
      isSpeakingTTS = false;
      console.log("✅ Speech completed");
      resolve(); // ← Resolve when done
    };
    
    utterance.onerror = (event) => {
      ttsActive = false;
      isSpeakingTTS = false;
      console.log("❌ Speech error:", event.error);
      resolve(); // ← Resolve on error too
    };
    
    speechSynthesis.speak(utterance);
  });
}

function sayAndResume(text) {
  if (typeof addToSummary === 'function') {
    addToSummary(`🤖 ${text}`);
  }
  
  if (!isVoiceEnabled) {
    console.log("🔇 Voice disabled, clearing command block");
    clearCommandBlock();
    setTimeout(resumeListening, 500);
    return;
  }
  
  console.log("🗣️ Speaking response, maintaining audio block:", text);
  if (typeof setAssistant === 'function') {
    setAssistant(text);
  }
  
  // 🆕 MAINTAIN ALL BLOCKING FLAGS (don't clear them yet)
  ttsActive = true;
  isSpeakingTTS = true;
  if (typeof setVoiceStatus === 'function') {
    setVoiceStatus("🗣️ Speaking response - audio blocked");
  }
  
  // Cancel any existing speech
  speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1;
  utterance.volume = 1;
  
  utterance.onstart = () => {
    console.log("🗣️ Response speech started - audio input still blocked");
  };
  
  utterance.onend = () => {
    console.log("✅ RESPONSE COMPLETELY FINISHED - CLEARING ALL BLOCKS");
    
    // 🆕 CLEAR ALL BLOCKING FLAGS ONLY AFTER SPEECH IS DONE
    clearCommandBlock();
    isSpeaking = false;       
    isSpeakingTTS = false;
    
    // Resume listening after short delay
    setTimeout(() => {
      resumeListening();
      if (typeof setVoiceStatus === 'function') {
        setVoiceStatus("👂 Ready - speak anytime");
      }
      console.log("👂 Audio input resumed - ready for next command");
    }, 1000);
  };
  
  utterance.onerror = (event) => {
    console.log("❌ Speech error, clearing all blocks:", event.error);
    
    // 🆕 CLEAR ALL FLAGS ON ERROR TOO
    clearCommandBlock();
    isSpeaking = false;       
    isSpeakingTTS = false;    
    
    setTimeout(() => {
      resumeListening();
      if (typeof setVoiceStatus === 'function') {
        setVoiceStatus("👂 Ready - speak anytime");
      }
    }, 1000);
  };
  
  speechSynthesis.speak(utterance);
}

// ✅ ADD DEBUG FUNCTION to check system state
function debugVADState() {
  const now = Date.now();
  console.log("🔍 VAD State Debug:");
  console.log(`  ttsActive: ${ttsActive}`);
  console.log(`  isSpeaking: ${isSpeaking}`);
  console.log(`  isSpeakingTTS: ${isSpeakingTTS}`);
  console.log(`  isProcessing: ${isProcessing}`);
  console.log(`  isPlayingAudio: ${isPlayingAudio}`);
  console.log(`  blockUntil: ${blockUntil}, now: ${now}, blocked: ${now < blockUntil}`);
  console.log(`  listening: ${listening}`);
}

function debugFullVADState() {
  const now = Date.now();
  console.log("🔍 FULL VAD State Debug:");
  console.log(`  processingCommand: ${processingCommand}`);
  console.log(`  commandStartTime: ${commandStartTime} (${now - commandStartTime}ms ago)`);
  console.log(`  ttsActive: ${ttsActive}`);
  console.log(`  isSpeaking: ${isSpeaking}`);
  console.log(`  isSpeakingTTS: ${isSpeakingTTS}`);
  console.log(`  isProcessing: ${isProcessing}`);
  console.log(`  isPlayingAudio: ${isPlayingAudio}`);
  console.log(`  blockUntil: ${blockUntil}, now: ${now}, blocked: ${now < blockUntil}`);
  console.log(`  listening: ${listening}`);
  console.log(`  Overall blocked: ${processingCommand || ttsActive || isProcessing || isSpeakingTTS || isPlayingAudio || (now < blockUntil)}`);
}

function resetFullVADState() {
  console.log("🔄 Resetting FULL VAD state...");
  
  clearCommandBlock();
  isSpeaking = false;
  isSpeakingTTS = false;
  isPlayingAudio = false;
  
  // Cancel any active recordings
  if (currentVadRecording && currentVadRecording.state === 'recording') {
    currentVadRecording.stop();
  }
  
  // Cancel any speech
  speechSynthesis.cancel();
  
  if (typeof setVoiceStatus === 'function') {
    setVoiceStatus("👂 Ready - speak anytime");
  }
  console.log("✅ FULL VAD state reset complete - ready for new commands");
}

// VAPI audio playback
async function playVAPIAudio(text, resumeAfter = false) {
  try {
    isSpeakingTTS = true;
    
    const response = await fetch(VAPI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: text,
        voice: 'jennifer',
        speed: 0.9
      })
    });

    if (!response.ok) {
      throw new Error(`VAPI request failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.fallback) {
      console.log("⚠️ VAPI unavailable, falling back to browser TTS");
      playBrowserSpeech(text, resumeAfter);
      return;
    }

    const audioBlob = base64ToBlob(data.audio, 'audio/mp3');
    const audioUrl = URL.createObjectURL(audioBlob);
    
    currentAudio = new Audio(audioUrl);
    currentAudio.volume = 1.0;
    
    currentAudio.onended = () => {
      isSpeakingTTS = false;
      isPlayingAudio = false;
      URL.revokeObjectURL(audioUrl);
      
      console.log("✅ VAPI audio completed");
      
      if (resumeAfter) {
        setTimeout(() => {
          resumeListening();
        }, 500);
      }
    };
    
    currentAudio.onerror = (error) => {
      console.error("❌ VAPI audio playback error:", error);
      isSpeakingTTS = false;
      isPlayingAudio = false;
      
      playBrowserSpeech(text, resumeAfter);
    };
    
    isPlayingAudio = true;
    await currentAudio.play();
    
  } catch (error) {
    console.error("❌ VAPI error:", error);
    isSpeakingTTS = false;
    
    playBrowserSpeech(text, resumeAfter);
  }
}

function playBrowserSpeech(text, resumeAfter = false) {
  speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9;
  utterance.pitch = 1;
  utterance.volume = 1;
  
  utterance.onstart = () => {
    isSpeakingTTS = true;
  };
  
  utterance.onend = () => {
    isSpeakingTTS = false;
    console.log("✅ Browser TTS completed");
    
    if (resumeAfter) {
      setTimeout(() => {
        resumeListening();
      }, 500);
    }
  };
  
  utterance.onerror = (event) => {
    isSpeakingTTS = false;
    if (event.error !== 'canceled' && event.error !== 'interrupted') {
      console.error("❌ Browser TTS error:", event.error);
    }
    
    if (resumeAfter) {
      setTimeout(() => {
        resumeListening();
      }, 1000);
    }
  };
  
  speechSynthesis.speak(utterance);
}

function stopCurrentSpeech() {
  if (currentAudio && !currentAudio.ended) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    isPlayingAudio = false;
  }
  
  speechSynthesis.cancel();
  isSpeakingTTS = false;
}

function base64ToBlob(base64, mimeType) {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: mimeType });
}

function setupVADControls() {
  const thresholdSlider = document.getElementById("vadThreshold");
  const thresholdValue = document.getElementById("vadThresholdValue");
  
  if (thresholdSlider) {
    thresholdSlider.addEventListener('input', (e) => {
      vadThreshold = parseInt(e.target.value);
      thresholdValue.textContent = vadThreshold;
      console.log("🎚️ VAD threshold updated:", vadThreshold);
    });
  }
}

async function transcribeAudio(audioBlob) {
  try {
    const arrayBuffer = await audioBlob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let binaryString = '';
    for (let i = 0; i < uint8Array.length; i++) {
      binaryString += String.fromCharCode(uint8Array[i]);
    }
    const base64Audio = btoa(binaryString);

    const response = await fetch(STT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioData: base64Audio,
        config: {
          encoding: "WEBM_OPUS",
          sampleRateHertz: 48000,
          languageCode: "en-US",
          enableAutomaticPunctuation: true,
          model: "latest_long"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`STT request failed: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      return data.results[0].alternatives[0].transcript;
    }
    
    return null;
    
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
}

// ===== CONVERSATION HANDLING =====
async function handleUtterance(text){
  console.log("🗣️ Handling utterance:", text);
  if (typeof setTranscript === 'function') {
    setTranscript(text);
  }

  if (isProcessing) {
    console.log("⚠️ Already processing, ignoring:", text);
    return;
  }

  if (text.length < 3) {
    console.log("⚠️ Speech too short, asking for repeat");
    if (typeof sayAndResume === 'function') {
      sayAndResume("I didn't catch that. Please repeat?");
    }
    return;
  }

  // ✅ FIXED: Filter problematic single words
  const problematicSingleWords = ['reset', 'clear', 'cleared', 'okay', 'ok', 'um', 'uh'];
  const cleanText = text.toLowerCase().trim();
  
  if (problematicSingleWords.includes(cleanText)) {
    console.log("⚠️ Filtered problematic single word:", cleanText);
    if (typeof sayAndResume === 'function') {
      sayAndResume("I didn't quite catch that. Please tell me what you'd like to do.");
    }
    return;
  }

  const commonErrors = ['a', 'the', 'uh', 'um', 'er', 'ah'];
  if (commonErrors.includes(text.toLowerCase().trim())) {
    console.log("⚠️ Likely speech recognition error, asking for repeat");
    if (typeof sayAndResume === 'function') {
      sayAndResume("I didn't understand. Where would you like to go?");
    }
    return;
  }

  const words = text.toLowerCase().split(' ');
  if (words.length > 1 && words.every(word => word === words[0])) {
    console.log("⚠️ Repeated words detected, asking for repeat");
    if (typeof sayAndResume === 'function') {
      sayAndResume("Sorry, that didn't come through clearly. Please try again?");
    }
    return;
  }

  isProcessing = true;
  shouldListen = false;
  
  console.log("🛑 BLOCKING audio input during processing");
  
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }
  
  window.speechSynthesis.cancel();

  if (awaitingConfirmation){
    console.log("⏳ Awaiting confirmation, user said:", text);
    await handleConfirmation(text);
    return;
  }

  console.log("🎯 Processing command directly:", text);

  try {
    const parsed = await smartParse(text);
    console.log("📋 Parsed:", parsed);
    
    if (parsed.intent !== "unknown") {
      await executeSmartIntent(parsed);
    } else {
      console.log("⚠️ Unknown command - resuming listening");
      resumeListening();
    }
  } catch (e) {
    console.error("❌ Processing error:", e);
    if (typeof sayAndResume === 'function') {
      sayAndResume("Sorry, I had trouble processing that request.");
    }
  }
}

async function smartParse(text) {
  console.log("🧠 Smart parsing:", text);
  
  try {
    const response = await fetch(NLP_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    
    if (!response.ok) {
      throw new Error(`NLP request failed: ${response.status}`);
    }
    
    const result = await response.json();
    console.log("🎯 AI parsed:", result);
    return result;
    
  } catch (error) {
    console.error("❌ Smart parse error:", error);
    return { intent: "unknown", message: "I couldn't understand that. Please tell me where you'd like to go." };
  }
}

async function executeSmartIntent(parsed) {
  console.log("⚡ Executing smart intent:", parsed.intent);
  console.log("🛑 Audio input remains blocked during command execution");
  
  // 🆕 ENSURE BLOCKING REMAINS ACTIVE
  processingCommand = true;
  isProcessing = true;
  
  if (typeof handleRobotIntegration === 'function') {
    await handleRobotIntegration(parsed);
  }
  
  if (parsed.needsClarification && parsed.followUpQuestion) {
    awaitingConfirmation = {
      type: "destination_clarification",
      originalParsed: parsed
    };
    if (typeof addToSummary === 'function') {
      addToSummary(`❓ ${parsed.followUpQuestion}`);
    }
    if (typeof sayAndResume === 'function') {
      sayAndResume(parsed.followUpQuestion); // This will handle clearing blocks
    }
    return;
  }
  
  switch(parsed.intent) {
    case "navigate":
      console.log("🎯 Setting route to:", parsed.destination);
      if (typeof addToSummary === 'function') {
        addToSummary(`🎯 Navigating to: ${parsed.destination}`);
      }
      if (typeof searchAndNavigate === 'function') {
        await searchAndNavigate(parsed.destination);
      }
      break;
      
    case "nearest":
    case "find":
      console.log("🔍 Finding:", parsed.searchTerm || parsed.destination);
      const searchQuery = parsed.searchTerm || parsed.destination;
      if (typeof addToSummary === 'function') {
        addToSummary(`🔍 Finding nearest: ${searchQuery}`);
      }
      if (typeof findNearestPlace === 'function') {
        await findNearestPlace(searchQuery);
      }
      break;
      
    case "control":
      console.log("🎮 Movement control:", parsed.action);
      
      if (parsed.action === "start" || parsed.action === "begin") {
        if (awaitingConfirmation && awaitingConfirmation.action) {
          console.log("✅ User confirmed pending navigation");
          const { action } = awaitingConfirmation;
          awaitingConfirmation = null;
          if (typeof sayAndResume === 'function') {
            sayAndResume("Starting navigation now!");
          }
          action();
          return;
        }
        
        if (window.currentRoute) {
          if (typeof sayAndResume === 'function') {
            sayAndResume("Starting directions now!");
          }
          if (typeof startNavigation === 'function') {
            startNavigation(window.currentRoute);
          }
        } else {
          const msg = "No route calculated yet. Please set a destination first.";
          if (typeof addToSummary === 'function') {
            addToSummary(`⚠️ ${msg}`);
          }
          if (typeof sayAndResume === 'function') {
            sayAndResume(msg);
          }
        }
      } else {
        if (typeof handleMovementControl === 'function') {
          handleMovementControl(parsed);
        }
      }
      break;
      
    case "route":
      console.log("🗺️ Route management:", parsed.action);
      if (typeof handleRouteControl === 'function') {
        handleRouteControl(parsed);
      }
      break;
      
    case "status":
      console.log("📍 Status query:", parsed.action);
      if (typeof handleStatusQuery === 'function') {
        handleStatusQuery(parsed);
      }
      break;
      
    default:
      console.log("⚠️ Unknown intent");
      const unknownMsg = parsed.message || "I couldn't understand that command. Please try again.";
      if (typeof addToSummary === 'function') {
        addToSummary(`⚠️ ${unknownMsg}`);
      }
      if (typeof sayAndResume === 'function') {
        sayAndResume(unknownMsg);
      }
      break;
  }
  
  // 🆕 NOTE: Don't clear blocks here - let sayAndResume handle it
}

function resumeListening() {
  console.log("🔄 Resuming listening...");
  
  // ✅ CLEAR PROCESSING FLAG
  isProcessing = false;
  
  setTimeout(() => {
    shouldListen = true;
    
    if (listening && !ttsActive && !isSpeakingTTS) {
      if (typeof setVoiceStatus === 'function') {
        setVoiceStatus("👂 Ready - speak anytime");
      }
      console.log("👂 VAD ready for user input");
    } else {
      console.log("⚠️ VAD not ready - system still busy");
    }
  }, 500);
}