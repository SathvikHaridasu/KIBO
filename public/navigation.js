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
    
    // ✅ Wait for speech completion
    await new Promise(async (resolve) => {
      speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(announcement);
      utterance.rate = 0.9;
      utterance.pitch = 1;
      utterance.volume = 1;
      
      utterance.onstart = () => {
        console.log(`🗣️ Speech started: "${announcement}"`);
      };
      
      utterance.onend = () => {
        console.log(`✅ Speech COMPLETELY finished - starting movement with obstacle detection`);
        resolve();
      };
      
      utterance.onerror = (event) => {
        console.log(`❌ Speech error: ${event.error} - proceeding with movement`);
        resolve();
      };
      
      setTimeout(() => {
        console.log(`⏰ Speech timeout - proceeding with movement`);
        resolve();
      }, (announcement.length * 80) + 2000);
      
      speechSynthesis.speak(utterance);
      if (typeof addToSummary === 'function') {
        addToSummary(`🤖 ${announcement}`);
      }
    });
    
    // ✅ NOW EXECUTE MOVEMENT WITH OBSTACLE DETECTION
    let result = false;
    console.log(`🤖 Starting Kibo movement with obstacle monitoring...`);
    
    switch(command) {
      case "forward":
        console.log(`🤖 Kibo moving forward ${duration.toFixed(2)}s with obstacle detection`);
        if (typeof moveForwardWithObstacleDetection === 'function') {
          result = await moveForwardWithObstacleDetection(duration, distanceInMeters);
        } else if (typeof moveForward === 'function') {
          result = await moveForward(duration);
        }
        break;
        
      case "left":
      case "right":
        console.log(`🤖 Kibo turning ${command} 0.3s`);
        
        // Check for obstacles before turning
        const obstaclesBeforeTurn = await checkForObstacles();
        if (obstaclesBeforeTurn && obstaclesBeforeTurn.length > 0) {
          console.log("🚨 Obstacles detected before turn - waiting for clearance");
          await handleObstacleAvoidance(obstaclesBeforeTurn, command);
        }
        
        if (command === "left" && typeof turnLeft === 'function') {
          result = await turnLeft(0.3);
        } else if (command === "right" && typeof turnRight === 'function') {
          result = await turnRight(0.3);
        }
        
        if (result && distanceInMeters > 0) {
          console.log(`🤖 After turn: Kibo moving forward ${duration.toFixed(2)}s with obstacle detection`);
          await new Promise(resolve => setTimeout(resolve, 500));
          if (typeof moveForwardWithObstacleDetection === 'function') {
            await moveForwardWithObstacleDetection(duration, distanceInMeters);
          } else if (typeof moveForward === 'function') {
            await moveForward(duration);
          }
        }
        break;
    }
    
    // ✅ Update simulated rover position
    simulateRoverMovement(command, distanceInMeters);
    
    if (result) {
      console.log(`✅ Kibo movement complete`);
      if (typeof addToSummary === 'function') {
        addToSummary(`🤖 ${command} ${distanceInMeters}m completed safely`);
      }

      if (routeCoordinates.length > 0) {
        animateKiboMovement(command, distanceInMeters);
      }
      
      // ✅ Brief pause before next step
      setTimeout(() => {
        advanceToNextStep();
      }, 1000);
    }
    
  } catch (error) {
    console.error(`❌ Robot movement error:`, error);
  }
}

// ✅ Initialize simulated rover position
function initializeSimulatedRover() {
  // Start rover at user's current location
  let startLocation;
  if (typeof userMarker !== 'undefined' && userMarker) {
    startLocation = userMarker.getPosition();
  } else if (typeof map !== 'undefined' && map) {
    startLocation = map.getCenter();
  } else {
    // Default location if nothing is available
    startLocation = { lat: () => 43.6532, lng: () => -79.3832 };
  }
  
  simulatedRoverPosition = {
    lat: startLocation.lat(),
    lng: startLocation.lng()
  };
  
  roverStartPosition = { ...simulatedRoverPosition };
  roverBearing = 0; // Start facing north
  
  console.log("🤖 Kibo initialized at:", simulatedRoverPosition);
  if (typeof addToSummary === 'function') {
    addToSummary(`🤖 Kibo position initialized: ${simulatedRoverPosition.lat.toFixed(6)}, ${simulatedRoverPosition.lng.toFixed(6)}`);
  }
  
  // Create rover marker on map
  createRoverMarker();
}

//SIMPLIFIED: Just advance to next step after movement
function advanceToNextStep() {
  console.log(`✅ Step ${currentStepIndex + 1} completed - advancing`);
  
  if (typeof addToSummary === 'function') {
    addToSummary(`✅ Step ${currentStepIndex + 1} completed`);
  }
  
  currentStepIndex++;
  
  if (currentStepIndex < navigationSteps.length) {
    console.log(`🚀 Starting step ${currentStepIndex + 1}...`);
    setTimeout(() => {
      giveStepByStepInstruction(currentStepIndex);
    }, 1000);
  } else {
    // ✅ Navigation complete - restore normal audio processing
    navigationActive = false;
    navigationInProgress = false;
    stopOnlyMode = false;
    
    // Update global state
    if (typeof window !== 'undefined') {
      window.navigationActive = false;
      window.navigationInProgress = false;
      window.stopOnlyMode = false;
    }
    // Notify app that navigation has ended
    if (typeof document !== 'undefined' && document.dispatchEvent) {
      document.dispatchEvent(new CustomEvent('navigation:end'));
    }
    
    console.log(`🏁 All ${navigationSteps.length} steps completed!`);
    const message = "You have reached your destination!";
    
    if (typeof addToSummary === 'function') {
      addToSummary(message);
    }
    if (typeof setVoiceStatus === 'function') {
      setVoiceStatus("👂 Ready - where would you like to go next?");
    }
    
    // Wait a moment then speak final message
    setTimeout(() => {
      if (typeof sayAndResume === 'function') {
        sayAndResume(message);
      }
    }, 1000);
  }
}

// ===== ENHANCED OBSTACLE DETECTION INTEGRATION =====

// Enhanced forward movement with obstacle detection
async function moveForwardWithObstacleDetection(duration, plannedDistance) {
  console.log(`🛡️ Moving forward with obstacle detection: ${duration}s, ${plannedDistance}m`);
  
  let totalMovementTime = duration * 1000; // Convert to milliseconds
  let checkInterval = Math.min(500, totalMovementTime / 4); // Check 4 times during movement
  let currentTime = 0;
  let movementActive = true;
  
  // Start the actual robot movement
  const movementPromise = moveForward(duration);
  
  // Parallel obstacle monitoring
  const monitoringPromise = new Promise(async (resolve) => {
    while (currentTime < totalMovementTime && movementActive) {
      const obstacles = await checkForObstacles();
      
      if (obstacles && obstacles.length > 0) {
        const dangerousObstacles = obstacles.filter(obs => 
          obs.danger_level === "HIGH" || 
          (obs.area && obs.area > 5000) || // Large objects
          (obs.distance_from_center && obs.distance_from_center < 50) // Objects in path
        );
        
        if (dangerousObstacles.length > 0) {
          console.log("🚨 DANGEROUS OBSTACLES DETECTED DURING MOVEMENT!");
          movementActive = false;
          
          // Emergency stop
          if (typeof stopRobot === 'function') {
            await stopRobot();
          }
          
          // Handle obstacle avoidance
          await handleObstacleAvoidance(dangerousObstacles, "forward");
          resolve(true);
          return;
        }
      }
      
      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      currentTime += checkInterval;
    }
    
    resolve(true);
  });
  
  // Wait for both movement and monitoring to complete
  const [movementResult] = await Promise.all([movementPromise, monitoringPromise]);
  
  console.log(`✅ Forward movement with obstacle detection completed`);
  return movementResult;
}

// Check for obstacles using our detection API
async function checkForObstacles() {
  try {
    const now = Date.now();
    if (now - lastObstacleCheck < obstacleCheckInterval) {
      return []; // Don't check too frequently
    }
    
    lastObstacleCheck = now;
    
    const response = await fetch(`http://${OBSTACLE_DETECTION.PI_IP}:${OBSTACLE_DETECTION.DETECTION_PORT}/detection_status`, {
      method: 'GET',
      timeout: 1000 // Quick timeout for real-time navigation
    });
    
    if (!response.ok) {
      console.warn("⚠️ Obstacle detection API not responding");
      return [];
    }
    
    const data = await response.json();
    
    if (data.obstacles && data.obstacles.length > 0) {
      console.log(`👀 Detected ${data.obstacles.length} objects:`, data.obstacles.map(obs => obs.type));
      return data.obstacles;
    }
    
    return [];
    
  } catch (error) {
    console.warn("⚠️ Obstacle check failed:", error);
    return [];
  }
}

// Handle obstacle avoidance logic
async function handleObstacleAvoidance(obstacles, originalCommand) {
  console.log("🛡️ OBSTACLE AVOIDANCE ACTIVATED");
  
  if (typeof addToSummary === 'function') {
    addToSummary(`🚨 Obstacles detected: ${obstacles.map(obs => obs.type).join(', ')}`);
  }
  
  // Announce obstacle detection
  const obstacleTypes = [...new Set(obstacles.map(obs => obs.type))];
  const announcement = `Obstacles detected: ${obstacleTypes.join(', ')}. Finding safe path.`;
  
  await new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(announcement);
    utterance.rate = 1.0;
    utterance.onend = resolve;
    utterance.onerror = resolve;
    speechSynthesis.speak(utterance);
  });
  
  // Analyze obstacles to determine avoidance strategy
  let avoidanceStrategy = determineAvoidanceStrategy(obstacles);
  
  console.log(`🤖 Avoidance strategy: ${avoidanceStrategy}`);
  
  try {
    let success = false;
    
    switch(avoidanceStrategy) {
      case "stop_and_wait":
        success = await stopAndWaitStrategy(obstacles);
        break;
      case "detour_left":
        success = await detourStrategy("left");
        break;
      case "detour_right":
        success = await detourStrategy("right");
        break;
      case "reverse_and_retry":
        success = await reverseAndRetryStrategy();
        break;
      default:
        console.log("🛑 No safe avoidance strategy - stopping");
        success = await emergencyStopStrategy();
    }
    
    if (success) {
      console.log("✅ Obstacle avoidance successful - resuming navigation");
      if (typeof addToSummary === 'function') {
        addToSummary("✅ Obstacle avoided - resuming navigation");
      }
    } else {
      console.log("❌ Obstacle avoidance failed - stopping navigation");
      if (typeof addToSummary === 'function') {
        addToSummary("❌ Cannot safely avoid obstacles - navigation paused");
      }
    }
    
  } catch (error) {
    console.error("❌ Obstacle avoidance error:", error);
    await emergencyStopStrategy();
  }
}

// Determine the best avoidance strategy based on obstacles
function determineAvoidanceStrategy(obstacles) {
  // Analyze obstacle positions and types
  const leftSideObstacles = obstacles.filter(obs => obs.center && obs.center[0] < 160); // Left half of camera
  const rightSideObstacles = obstacles.filter(obs => obs.center && obs.center[0] > 160); // Right half
  const centerObstacles = obstacles.filter(obs => obs.center && obs.center[0] >= 120 && obs.center[0] <= 200); // Center
  
  console.log(`📊 Obstacle analysis: Left=${leftSideObstacles.length}, Right=${rightSideObstacles.length}, Center=${centerObstacles.length}`);
  
  // If obstacles are only on one side, detour to the other side
  if (centerObstacles.length === 0) {
    if (leftSideObstacles.length > 0 && rightSideObstacles.length === 0) {
      return "detour_right";
    } else if (rightSideObstacles.length > 0 && leftSideObstacles.length === 0) {
      return "detour_left";
    }
  }
  
  // If center is blocked, try the side with fewer obstacles
  if (centerObstacles.length > 0) {
    if (leftSideObstacles.length < rightSideObstacles.length) {
      return "detour_left";
    } else if (rightSideObstacles.length < leftSideObstacles.length) {
      return "detour_right";
    }
  }
  
  // If obstacles are everywhere or moving objects detected, wait
  const movingObjects = obstacles.filter(obs => obs.type === "person" || obs.type === "dog" || obs.type === "cat");
  if (movingObjects.length > 0) {
    return "stop_and_wait";
  }
  
  // Default strategy
  return "detour_right";
}

// Stop and wait for obstacles to clear
async function stopAndWaitStrategy(obstacles) {
  console.log("⏳ STOP AND WAIT: Waiting for obstacles to clear...");
  
  if (typeof stopRobot === 'function') {
    await stopRobot();
  }
  
  const waitAnnouncement = "Stopping to wait for obstacles to clear";
  const utterance = new SpeechSynthesisUtterance(waitAnnouncement);
  speechSynthesis.speak(utterance);
  
  // Wait and check periodically
  for (let attempt = 0; attempt < 10; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
    
    const currentObstacles = await checkForObstacles();
    const stillBlocked = currentObstacles.filter(obs => 
      obs.danger_level === "HIGH" || 
      (obs.center && obs.center[0] >= 120 && obs.center[0] <= 200) // Still in center
    );
    
    if (stillBlocked.length === 0) {
      console.log("✅ Path cleared - resuming movement");
      return true;
    }
    
    console.log(`⏳ Still waiting... ${stillBlocked.length} obstacles remaining`);
  }
  
  console.log("⏰ Wait timeout - trying detour strategy");
  return await detourStrategy("right");
}

// Detour around obstacles
async function detourStrategy(direction) {
  console.log(`🔄 DETOUR STRATEGY: Moving ${direction} to avoid obstacles`);
  
  try {
    // Step 1: Turn to detour direction
    const turnFunction = direction === "left" ? turnLeft : turnRight;
    if (typeof turnFunction === 'function') {
      await turnFunction(0.5); // Longer turn for detour
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Step 2: Move forward to clear obstacle
    if (typeof moveForward === 'function') {
      await moveForward(1.0); // Move forward 1 second
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Step 3: Check if path is clear
    const obstaclesAfterDetour = await checkForObstacles();
    const pathStillBlocked = obstaclesAfterDetour.filter(obs => 
      obs.center && obs.center[0] >= 120 && obs.center[0] <= 200
    );
    
    if (pathStillBlocked.length > 0) {
      console.log("🚧 Path still blocked after detour - trying opposite direction");
      const oppositeDirection = direction === "left" ? "right" : "left";
      return await detourStrategy(oppositeDirection);
    }
    
    // Step 4: Turn back toward original direction
    const returnTurnFunction = direction === "left" ? turnRight : turnLeft;
    if (typeof returnTurnFunction === 'function') {
      await returnTurnFunction(0.5);
    }
    
    console.log(`✅ Detour ${direction} successful - path clear`);
    return true;
    
  } catch (error) {
    console.error(`❌ Detour ${direction} failed:`, error);
    return false;
  }
}

// Reverse and retry strategy
async function reverseAndRetryStrategy() {
  console.log("🔄 REVERSE AND RETRY: Backing up and reassessing");
  
  try {
    // Move backward
    if (typeof moveBackward === 'function') {
      await moveBackward(0.5);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check obstacles again
    const obstaclesAfterReverse = await checkForObstacles();
    if (obstaclesAfterReverse.length === 0) {
      console.log("✅ Obstacles cleared after reverse - resuming forward");
      return true;
    }
    
    // Try a detour strategy
    return await detourStrategy("right");
    
  } catch (error) {
    console.error("❌ Reverse and retry failed:", error);
    return false;
  }
}

// Emergency stop strategy
async function emergencyStopStrategy() {
  console.log("🚨 EMERGENCY STOP: Cannot safely proceed");
  
  if (typeof stopRobot === 'function') {
    await stopRobot();
  }
  
  const emergencyAnnouncement = "Cannot safely navigate around obstacles. Please assist or provide new directions.";
  const utterance = new SpeechSynthesisUtterance(emergencyAnnouncement);
  speechSynthesis.speak(utterance);
  
  // Reset navigation flags
  navigationInProgress = false;
  stopOnlyMode = false;
  if (typeof window !== 'undefined') {
    window.navigationInProgress = false;
    window.stopOnlyMode = false;
  }
  
  if (typeof setVoiceStatus === 'function') {
    setVoiceStatus("🚨 Navigation paused - manual assistance needed");
  }
  
  return false;
}

// ✅ Create visual rover marker
function createRoverMarker() {
  if (typeof window !== 'undefined' && window.roverMarker) {
    window.roverMarker.setMap(null);
  }
  
  if (typeof google !== 'undefined' && google.maps && typeof map !== 'undefined') {
    window.roverMarker = new google.maps.Marker({
      position: simulatedRoverPosition,
      map: map,
      title: "Kibo Robot",
      icon: {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 6,
        fillColor: "#FF0000",
        fillOpacity: 0.8,
        strokeWeight: 2,
        strokeColor: "#FFFFFF",
        rotation: roverBearing
      }
    });
  }
}

// ✅ Simulate rover movement based on real distances
function simulateRoverMovement(command, realDistanceMeters) {
  if (!simulatedRoverPosition) {
    initializeSimulatedRover();
  }
  
  console.log(`\n📍 === POSITION UPDATE ===`);
  console.log(`Command: ${command}, Distance: ${realDistanceMeters}m`);
  console.log(`Before - Lat: ${simulatedRoverPosition.lat.toFixed(8)}, Lng: ${simulatedRoverPosition.lng.toFixed(8)}, Bearing: ${roverBearing}°`);
  
  let newPosition = { ...simulatedRoverPosition };
  
  switch(command) {
    case "forward":
      if (realDistanceMeters > 0) {
        // Convert to actual GPS distance (scaled)
        const simulatedDistanceMeters = realDistanceMeters / 1000; // Scale down for testing
        newPosition = moveInDirection(simulatedRoverPosition, roverBearing, simulatedDistanceMeters);
        console.log(`✅ Moved forward ${realDistanceMeters}m (${simulatedDistanceMeters*1000}m GPS scale)`);
      }
      break;
      
    case "left":
      roverBearing = (roverBearing - 90 + 360) % 360;
      console.log(`✅ Turned left - now facing ${roverBearing}°`);
      break;
      
    case "right": 
      roverBearing = (roverBearing + 90) % 360;
      console.log(`✅ Turned right - now facing ${roverBearing}°`);
      break;
      
    case "backward":
      if (realDistanceMeters > 0) {
        const simulatedDistanceMeters = realDistanceMeters / 1000;
        newPosition = moveInDirection(simulatedRoverPosition, (roverBearing + 180) % 360, simulatedDistanceMeters);
        console.log(`✅ Moved backward ${realDistanceMeters}m`);
      }
      break;
  }
  
  // Update rover position
  simulatedRoverPosition = newPosition;
  
  console.log(`After  - Lat: ${simulatedRoverPosition.lat.toFixed(8)}, Lng: ${simulatedRoverPosition.lng.toFixed(8)}, Bearing: ${roverBearing}°`);
  
  // Update rover marker on map
  if (typeof window !== 'undefined' && window.roverMarker) {
    window.roverMarker.setPosition(simulatedRoverPosition);
    window.roverMarker.setIcon({
      path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
      scale: 8,
      fillColor: "#FF0000", 
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: "#FFFFFF",
      rotation: roverBearing
    });
  }
  
  console.log(`========================\n`);
}

// ✅ Helper function to move in a specific direction
function moveInDirection(startPos, bearingDegrees, distanceMeters) {
  const earthRadius = 6378137; // Earth's radius in meters
  const bearingRadians = bearingDegrees * (Math.PI / 180);
  
  const lat1 = startPos.lat * (Math.PI / 180);
  const lng1 = startPos.lng * (Math.PI / 180);
  
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(distanceMeters / earthRadius) +
    Math.cos(lat1) * Math.sin(distanceMeters / earthRadius) * Math.cos(bearingRadians)
  );
  
  const lng2 = lng1 + Math.atan2(
    Math.sin(bearingRadians) * Math.sin(distanceMeters / earthRadius) * Math.cos(lat1),
    Math.cos(distanceMeters / earthRadius) - Math.sin(lat1) * Math.sin(lat2)
  );
  
  return {
    lat: lat2 * (180 / Math.PI),
    lng: lng2 * (180 / Math.PI)
  };
}

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
          Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}


function startNavigationCleanly(routeResult) {
  console.log("🚀 Starting clean navigation...");
  
  try {
    if (typeof parseDirectionsToSteps === 'function') {
      navigationSteps = parseDirectionsToSteps(routeResult);
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
    
    // Initialize rover position
    initializeSimulatedRover();
    
    // ✅ START LIVE MAP ANIMATION
    startLiveMapAnimation(routeResult);
    
    if (typeof addToSummary === 'function') {
      addToSummary("🚀 Navigation started");
      addToSummary(`📋 Total steps: ${navigationSteps.length}`);
      addToSummary("🎬 Live map tracking active"); // ← New
    }
    
    console.log(`📋 Navigation plan - ${navigationSteps.length} steps total`);
    
    if (navigationSteps.length > 0) {
      giveStepByStepInstruction(0);
    }
    
    console.log("✅ Clean navigation with live animation started");
    
  } catch (error) {
    console.error("❌ Navigation start failed:", error);
  }
}

function executeRobotMovementForStep(stepIndex) {
  if (stepIndex >= navigationSteps.length) {
    console.log("❌ Step index out of range:", stepIndex);
    return;
  }
  
  const step = navigationSteps[stepIndex];
  const distanceInMeters = step.distanceValue;
  
  console.log(`🤖 Executing movement for step ${stepIndex + 1}: ${step.instruction}`);
  console.log(`🤖 Distance: ${step.distance} (${distanceInMeters}m)`);
  
  let robotCommand = "forward";
  
  if (step.maneuver === 'turn-left' || step.instruction.toLowerCase().includes('turn left')) {
    robotCommand = "left";
  } else if (step.maneuver === 'turn-right' || step.instruction.toLowerCase().includes('turn right')) {
    robotCommand = "right";
  } else {
    robotCommand = "forward";
  }
  
  // ✅ EXECUTE THE ACTUAL ROBOT MOVEMENT
  executeRobotMovement(robotCommand, distanceInMeters);
  
  if (typeof addToSummary === 'function') {
    addToSummary(`🤖 Executing step ${stepIndex + 1}: ${robotCommand} ${distanceInMeters}m`);
  }
}

// ✅ SUPPORTING FUNCTION: Silent navigation start (NO speech calls)
function startNavigationSilently(routeResult, startFromStep = 0) {
  console.log("🚀 Starting navigation silently from step", startFromStep);
  
  try {
    if (typeof parseDirectionsToSteps === 'function') {
      navigationSteps = parseDirectionsToSteps(routeResult);
    } else {
      console.error("❌ parseDirectionsToSteps function not available");
      return;
    }
    
    currentStepIndex = startFromStep; // ✅ Start from step 0, not step 1
    navigationActive = true;
    // Notify app that navigation has started
    if (typeof document !== 'undefined' && document.dispatchEvent) {
      document.dispatchEvent(new CustomEvent('navigation:start'));
    }
    
    // Initialize simulated rover position
    initializeSimulatedRover();
    
    if (typeof addToSummary === 'function') {
      addToSummary("🚀 Step-by-step navigation started");
      addToSummary(`📋 Total steps: ${navigationSteps.length}`);
    }
    
    if (currentStepIndex < navigationSteps.length) {
      const currentStep = navigationSteps[currentStepIndex];
      if (typeof addToSummary === 'function') {
        addToSummary(`🧭 Monitoring step ${currentStepIndex + 1}: ${currentStep.instruction}`);
      }
    }
    
    if (typeof startRobotNavigationSilently === 'function') {
      startRobotNavigationSilently();
    }
    startPositionTracking();
    
    if (typeof isCameraActive !== 'undefined' && isCameraActive && typeof startEnhancedDetectionLoop === 'function') {
      startEnhancedDetectionLoop();
    }
    
    console.log("✅ Silent navigation with rover simulation started");
    
  } catch (error) {
    console.error("❌ Silent navigation start failed:", error);
    if (typeof addToSummary === 'function') {
      addToSummary("⚠️ Navigation started with limited features");
    }
  }
}

function testDistanceFormula() {
  console.log("\n🧪 === TESTING DISTANCE FORMULA ===");
  console.log("Formula: distanceMeters/100 = cm, cm*0.1 = seconds");
  console.log("Examples:");
  
  const testDistances = [19, 50, 100, 214, 500, 1000, 1500];
  
  testDistances.forEach(distance => {
    const realDistanceCm = distance / 100;
    const duration = Math.max(0.05, Math.min(realDistanceCm * 0.1, 2.0));
    console.log(`   ${distance}m → ${realDistanceCm.toFixed(1)}cm → ${duration.toFixed(3)}s`);
  });
  
  console.log("=================================\n");
}
// ===== LIVE MAP ANIMATION SYSTEM =====
let routeCoordinates = []; // All route points
let currentRouteIndex = 0; // Current position along route
let animationInterval = null;
let routeProgress = 0; // 0 to 1 (0% to 100%)

// Extract route coordinates from Google Maps result
function extractRouteCoordinates(directionsResult) {
  routeCoordinates = [];
  
  const route = directionsResult.routes[0];
  if (!route) return;
  
  // Get all coordinate points from the route polyline
  route.legs.forEach(leg => {
    leg.steps.forEach(step => {
      const path = step.path || [];
      path.forEach(point => {
        routeCoordinates.push({
          lat: point.lat(),
          lng: point.lng()
        });
      });
    });
  });
  
  // If no detailed path, use step start/end points
  if (routeCoordinates.length === 0) {
    route.legs.forEach(leg => {
      leg.steps.forEach(step => {
        routeCoordinates.push({
          lat: step.start_location.lat(),
          lng: step.start_location.lng()
        });
        routeCoordinates.push({
          lat: step.end_location.lat(),
          lng: step.end_location.lng()
        });
      });
    });
  }
  
  console.log(`🗺️ Route extracted: ${routeCoordinates.length} coordinate points`);
  return routeCoordinates;
}

// Start animated movement along the route
function startLiveMapAnimation(directionsResult) {
  console.log("🎬 Starting live map animation...");
  
  // Extract route coordinates
  extractRouteCoordinates(directionsResult);
  
  if (routeCoordinates.length === 0) {
    console.log("❌ No route coordinates found");
    return;
  }
  
  // Start Kibo at the beginning of the route
  currentRouteIndex = 0;
  routeProgress = 0;
  
  const startPosition = routeCoordinates[0];
  simulatedRoverPosition = { ...startPosition };
  
  // Create/update Kibo's marker
  createAnimatedRoverMarker();
  
  // Center map on starting position
  if (typeof map !== 'undefined') {
    map.panTo(startPosition);
    map.setZoom(16); // Close zoom for detailed view
  }
  
  console.log("✅ Live animation initialized");
}

// Create enhanced rover marker for animation
function createAnimatedRoverMarker() {
  // Remove existing marker
  if (typeof window !== 'undefined' && window.roverMarker) {
    window.roverMarker.setMap(null);
  }
  
  if (typeof google !== 'undefined' && google.maps && typeof map !== 'undefined') {
    window.roverMarker = new google.maps.Marker({
      position: simulatedRoverPosition,
      map: map,
      title: "Kibo Robot - Live Navigation",
      icon: {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 8,
        fillColor: "#00FF00", // Green for active navigation
        fillOpacity: 1,
        strokeWeight: 3,
        strokeColor: "#000000",
        rotation: roverBearing
      },
      zIndex: 1000 // Keep on top
    });
    
    // Add info window with progress
    const infoWindow = new google.maps.InfoWindow({
      content: `<div style="text-align:center">
        <strong>🤖 Kibo Robot</strong><br>
        <span style="color:#666">Navigation Progress: ${Math.round(routeProgress * 100)}%</span>
      </div>`
    });
    
    window.roverMarker.addListener('click', () => {
      infoWindow.open(map, window.roverMarker);
    });
  }
}

// Animate Kibo along the route (call this during movement)
function animateKiboMovement(command, distanceInMeters) {
  if (routeCoordinates.length === 0) {
    console.log("⚠️ No route coordinates for animation");
    return;
  }
  
  console.log(`🎬 Animating Kibo ${command} movement: ${distanceInMeters}m`);
  
  // Calculate how many route points to advance based on distance
  const totalRouteDistance = calculateTotalRouteDistance();
  const distanceRatio = distanceInMeters / totalRouteDistance;
  const pointsToAdvance = Math.max(1, Math.floor(distanceRatio * routeCoordinates.length));
  
  const startIndex = currentRouteIndex;
  const endIndex = Math.min(currentRouteIndex + pointsToAdvance, routeCoordinates.length - 1);
  
  console.log(`📍 Moving from point ${startIndex} to ${endIndex} (${pointsToAdvance} points)`);
  
  // Smooth animation between points
  animateBetweenPoints(startIndex, endIndex, 2000); // 2 seconds animation
}

// Smooth animation between route points
function animateBetweenPoints(startIndex, endIndex, durationMs) {
  if (animationInterval) {
    clearInterval(animationInterval);
  }
  
  const startTime = Date.now();
  const startPos = routeCoordinates[startIndex];
  const endPos = routeCoordinates[endIndex];
  
  // Calculate bearing for arrow direction
  const bearing = calculateBearing(startPos, endPos);
  roverBearing = bearing;
  
  animationInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(elapsed / durationMs, 1);
    
    // Smooth interpolation between start and end
    const currentPos = {
      lat: startPos.lat + (endPos.lat - startPos.lat) * progress,
      lng: startPos.lng + (endPos.lng - startPos.lng) * progress
    };
    
    // Update Kibo's position
    simulatedRoverPosition = currentPos;
    
    if (window.roverMarker) {
      window.roverMarker.setPosition(currentPos);
      window.roverMarker.setIcon({
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 8,
        fillColor: "#00FF00",
        fillOpacity: 1,
        strokeWeight: 3,
        strokeColor: "#000000",
        rotation: bearing
      });
    }
    
    // Keep map centered on Kibo
    if (typeof map !== 'undefined') {
      map.panTo(currentPos);
    }
    
    // Update progress
    routeProgress = endIndex / (routeCoordinates.length - 1);
    
    // Animation complete
    if (progress >= 1) {
      clearInterval(animationInterval);
      currentRouteIndex = endIndex;
      
      console.log(`✅ Animation complete - now at point ${endIndex} (${Math.round(routeProgress * 100)}%)`);
      
      // Update summary with progress
      if (typeof addToSummary === 'function') {
        addToSummary(`📍 Progress: ${Math.round(routeProgress * 100)}% of route completed`);
      }
    }
  }, 50); // 20 FPS animation
}

// Calculate total route distance
function calculateTotalRouteDistance() {
  let total = 0;
  for (let i = 1; i < routeCoordinates.length; i++) {
    total += calculateDistance(
      routeCoordinates[i-1].lat, routeCoordinates[i-1].lng,
      routeCoordinates[i].lat, routeCoordinates[i].lng
    );
  }
  return total * 1000; // Convert to meters
}

// Calculate bearing between two points
function calculateBearing(start, end) {
  const dLng = (end.lng - start.lng) * Math.PI / 180;
  const lat1 = start.lat * Math.PI / 180;
  const lat2 = end.lat * Math.PI / 180;
  
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  
  const bearing = Math.atan2(y, x) * 180 / Math.PI;
  return (bearing + 360) % 360;
}