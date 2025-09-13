// ===== NAVIGATION VARIABLES =====
let currentStepIndex = 0;
let navigationSteps = [];
let positionWatcher = null;
let lastInstruction = "";
let stepCompletionCooldown = false;
let lastStepCompletionTime = 0;
let stepLocked = false; // Prevent multiple step progressions

// ===== SIMULATED ROVER TRACKING SYSTEM =====
let simulatedRoverPosition = null; // Rover's simulated GPS position
let simulatedMovementScale = 10000; // 1km = 10cm (scale factor)
let roverStartPosition = null;
let roverBearing = 0; // Rover's current direction in degrees
// ===== OBSTACLE AVOIDANCE VARIABLES =====
let obstacleAvoidanceActive = false;
let originalNavigationStep = null;
let detourInProgress = false;
let lastObstacleCheck = 0;
let obstacleCheckInterval = 2000; // Check every 2 seconds during movement
let safeMovementDistance = 1.0; // Meters to move when avoiding obstacles
let retryAttempts = 0;
let maxRetryAttempts = 3;

// Obstacle detection configuration
const OBSTACLE_DETECTION = {
  PI_IP: "10.37.117.213",
  DETECTION_PORT: 5005,
  DANGER_DISTANCE_THRESHOLD: 2.0, // Consider obstacles dangerous if closer than 2m
  SAFE_DISTANCE_THRESHOLD: 1.0,   // Need 1m clearance to proceed
  CHECK_FREQUENCY: 1500            // Check obstacles every 1.5 seconds
};


// ===== ENHANCED GPS-BASED NAVIGATION SYSTEM =====
function startPositionTracking() {
  console.log("📍 Starting position tracking...");
  
  if (!navigator.geolocation) {
    console.log("⚠️ Geolocation not available");
    return;
  }
  
  // Start watching position for navigation updates
  positionWatcher = navigator.geolocation.watchPosition(
    (position) => {
      const coords = { 
        lat: position.coords.latitude, 
        lng: position.coords.longitude 
      };
      
      if (typeof window !== 'undefined') {
        window.currentPosition = coords;
      }
      
      // Update user marker if it exists
      if (typeof userMarker !== 'undefined' && userMarker) {
        userMarker.setPosition(coords);
      }
      
      console.log("📍 Position updated:", coords);
    },
    (error) => {
      console.warn("📍 Position tracking error:", error);
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 5000
    }
  );
  
  if (typeof addToSummary === 'function') {
    addToSummary("📍 GPS position tracking started");
  }
}

function stopPositionTracking() {
  if (positionWatcher) {
    navigator.geolocation.clearWatch(positionWatcher);
    positionWatcher = null;
  }
  navigationActive = false;
  if (typeof addToSummary === 'function') {
    addToSummary("📍 GPS tracking stopped");
  }
}

// Step-by-step navigation progress checker
function checkStepByStepProgress() {
  if (!simulatedRoverPosition || currentStepIndex >= navigationSteps.length) {
    return;
  }
  
  const now = Date.now();
  if (stepCompletionCooldown && (now - lastStepCompletionTime) < 3000) {
    return; // Wait for cooldown
  }
  
  if (stepLocked) return;
  
  const currentStep = navigationSteps[currentStepIndex];
  const targetLocation = currentStep.endLocation;
  
  const distance = calculateDistance(
    simulatedRoverPosition.lat, simulatedRoverPosition.lng,
    targetLocation.lat(), targetLocation.lng()
  );
  
  const distanceMeters = (distance * 1000).toFixed(1);
  
  console.log(`\n📊 PROGRESS CHECK - Step ${currentStepIndex + 1}`);
  console.log(`Distance to target: ${distanceMeters}m`);
  
  // ✅ Generous completion threshold
  if (distance < 0.1) { // 100 meters
    console.log(`✅ STEP ${currentStepIndex + 1} COMPLETED!`);
    
    stepLocked = true;
    stepCompletionCooldown = true;
    lastStepCompletionTime = now;
    
    if (typeof addToSummary === 'function') {
      addToSummary(`✅ Step ${currentStepIndex + 1} completed`);
    }
    currentStepIndex++;
    
    setTimeout(() => {
      stepLocked = false;
      stepCompletionCooldown = false;
      
      if (currentStepIndex < navigationSteps.length) {
        giveStepByStepInstruction(currentStepIndex);
      }
    }, 2000);
    
  } else {
    console.log(`⏳ ${distanceMeters}m remaining`);
  }
  console.log(`==================\n`);
}

function startNavigation(directionsResult) {
  if (typeof parseDirectionsToSteps === 'function') {
    navigationSteps = parseDirectionsToSteps(directionsResult);
  } else {
    console.error("❌ parseDirectionsToSteps function not available");
    return;
  }
  
  currentStepIndex = 0;
  navigationActive = true;
  // Notify app that navigation has started
  if (typeof document !== 'undefined' && document.dispatchEvent) {
    document.dispatchEvent(new CustomEvent('navigation:start'));
  }
  
  if (typeof addToSummary === 'function') {
    addToSummary("🚀 Step-by-step navigation started");
    addToSummary(`📋 Total steps: ${navigationSteps.length}`);
  }
  
  if (navigationSteps.length > 0) {
    // ✅ Give ONLY the first instruction
    giveStepByStepInstruction(0);
    startPositionTracking();
  }
}

// Step-by-step instruction system
function giveStepByStepInstruction(stepIndex) {
  if (stepIndex >= navigationSteps.length) {
    navigationActive = false;
    console.log(`🏁 Navigation complete!`);
    // Notify app that navigation has ended
    if (typeof document !== 'undefined' && document.dispatchEvent) {
      document.dispatchEvent(new CustomEvent('navigation:end'));
    }
    return;
  }
  
  const step = navigationSteps[stepIndex];
  const distanceInMeters = step.distanceValue;
  
  console.log(`\n🧭 STEP ${stepIndex + 1} of ${navigationSteps.length}`);
  console.log(`Instruction: ${step.instruction}`);
  console.log(`Distance: ${distanceInMeters}m`);
  
  let robotCommand = "forward";
  let instruction = `Step ${stepIndex + 1}: Move forward ${step.distance}`;
  
  // ✅ Simple command detection
  if (step.instruction.toLowerCase().includes('turn left')) {
    robotCommand = "left";
    instruction = `Step ${stepIndex + 1}: Turn left and continue ${step.distance}`;
  } else if (step.instruction.toLowerCase().includes('turn right')) {
    robotCommand = "right";
    instruction = `Step ${stepIndex + 1}: Turn right and continue ${step.distance}`;
  }
  
  console.log(`🤖 Will execute: ${robotCommand} ${distanceInMeters}m\n`);
  
  if (typeof addToSummary === 'function') {
    addToSummary(`🧭 ${instruction}`);
  }
  
  // ✅ Execute robot movement (voice announcement happens inside)
  executeRobotMovement(robotCommand, distanceInMeters);
}

// Enhanced robot movement with obstacle detection
async function executeRobotMovement(command, distanceInMeters) {
  console.log(`\n🎯 ENHANCED ROBOT STEP: ${command.toUpperCase()} ${distanceInMeters}m`);
  
  // ✅ Enable navigation mode - only STOP commands allowed
  navigationInProgress = true;
  stopOnlyMode = true;
  
  // Make these globally available for voice system
  if (typeof window !== 'undefined') {
    window.navigationInProgress = true;
    window.stopOnlyMode = true;
  }
  
  if (typeof setVoiceStatus === 'function') {
    setVoiceStatus("🛑 Navigation active - say STOP to halt");
  }
  
  try {
    let duration = 0.1;
    if (command === "forward" || command === "backward") {
      const sqrtScale = Math.sqrt(distanceInMeters / 50);
      duration = Math.max(0.03, Math.min(sqrtScale * 5.00, 2.0));
      console.log(`📏 Duration formula: ${distanceInMeters}m → ${duration.toFixed(3)}s`);
    }
    
    // ✅ ENHANCED ANNOUNCEMENTS WITH STREET NAMES
    let announcement = "";
    const step = navigationSteps[currentStepIndex];
    const instruction = step ? step.instruction : "";

    if (command === "forward") {
      const streetMatch = instruction.match(/(?:on|along|down)\s+([^,\s]+(?:\s+[^,\s]+)*)/i);
      const streetName = streetMatch ? streetMatch[1] : "";
      
      if (streetName) {
        announcement = `Kibo will now continue forward on ${streetName} for ${distanceInMeters} meters, monitoring for obstacles`;
      } else {
        announcement = `Kibo will now move forward ${distanceInMeters} meters with obstacle detection active`;
      }
    } else if (command === "left") {
      const streetMatch = instruction.match(/turn left (?:onto|into|on)\s+([^,\s]+(?:\s+[^,\s]+)*)/i);
      const streetName = streetMatch ? streetMatch[1] : "";
      
      if (streetName && distanceInMeters > 0) {
        announcement = `Kibo will now turn left onto ${streetName} and continue for ${distanceInMeters} meters`;
      } else if (streetName) {
        announcement = `Kibo will now turn left onto ${streetName}`;
      } else {
        announcement = `Kibo will now turn left and continue ${distanceInMeters} meters`;
      }
    } else if (command === "right") {
      const streetMatch = instruction.match(/turn right (?:onto|into|on)\s+([^,\s]+(?:\s+[^,\s]+)*)/i);
      const streetName = streetMatch ? streetMatch[1] : "";
      
      if (streetName && distanceInMeters > 0) {
        announcement = `Kibo will now turn right onto ${streetName} and continue for ${distanceInMeters} meters`;
      } else if (streetName) {
        announcement = `Kibo will now turn right onto ${streetName}`;
      } else {
        announcement = `Kibo will now turn right and continue ${distanceInMeters} meters`;
      }
    }

    // Handle special cases like roundabouts
    if (instruction.toLowerCase().includes('roundabout')) {
      const exitMatch = instruction.match(/take the (\d+)(?:st|nd|rd|th) exit/i);
      const exitNum = exitMatch ? exitMatch[1] : "next";
      const streetMatch = instruction.match(/(?:onto|on)\s+([^,\s]+(?:\s+[^,\s]+)*)/i);
      const streetName = streetMatch ? streetMatch[1] : "";
      
      if (streetName) {
        announcement = `Kibo will navigate the roundabout, taking the ${exitNum} exit onto ${streetName}, continuing for ${distanceInMeters} meters`;
      } else {
        announcement = `Kibo will navigate the roundabout, taking the ${exitNum} exit, continuing for ${distanceInMeters} meters`;
      }
    }
    
    console.log(`🗣️ Voice announcement: "${announcement}"`);
    
    