// ===== MAIN APPLICATION ENTRY POINT =====

// ===== GLOBAL STATE VARIABLES =====
let googleMapsApiKey = null;
let currentPosition = null;
let navigationActive = false;
let navigationInProgress = false;
let stopOnlyMode = false;
let awaitingConfirmation = null;
let uiNavigationActive = false; // UI-level flag to manage sidebar auto-hide behavior

// ===== UTILITY FUNCTIONS =====
function $(id) { return document.getElementById(id); }
function setTranscript(t) { $("transcript").textContent = t; }
function setAssistant(t) { $("assistantOutput").textContent = t; }
function setVoiceStatus(t) { $("voiceStatus").textContent = t; }
function setCameraStatus(t) { if ($("cameraStatus")) $("cameraStatus").textContent = t; }
function toast(msg) { setAssistant(msg); }

// ===== SUMMARY BOX FUNCTIONS =====
function addToSummary(message) {
  const summaryBox = $("summary");
  
  if (!summaryBox) {
    console.log("📋 Summary (no element):", message);
    return;
  }
  
  const newMessage = `${message}\n`;
  summaryBox.textContent += newMessage;
  summaryBox.scrollTop = summaryBox.scrollHeight;
  console.log("📋 Added to summary:", message);
}

function clearSummary() {
  $("summary").textContent = "";
}

// ===== UTILITY FUNCTIONS =====
function ensureAllFunctionsExist() {
  const requiredFunctions = [
    'startPositionTracking',
    'stopPositionTracking', 
    'processVADAudio',
    'processSTOPCommand',
    'clearCommandBlock'
  ];
  
  requiredFunctions.forEach(funcName => {
    if (typeof window[funcName] !== 'function') {
      console.warn(`⚠️ Missing function: ${funcName}`);
    }
  });
}


// ===== INTENT HANDLERS =====
function handleMovementControl(parsed) {
  const { action, message } = parsed;
  
  switch(action) {
    case "stop":
      if (typeof stopPositionTracking === 'function') {
        stopPositionTracking();
      }
      if (typeof stopNavigationSafety === 'function') {
        stopNavigationSafety();
      }
      addToSummary("🛑 Robot stopped");
      if (typeof sayAndResume === 'function') {
        sayAndResume(message || "Stopping movement");
      }
      break;
      
    case "pause":
      navigationActive = false;
      addToSummary("⏸️ Navigation paused");
      if (typeof sayAndResume === 'function') {
        sayAndResume(message || "Navigation paused");
      }
      break;
      
    case "resume":
      if (window.currentRoute) {
        navigationActive = true;
        if (typeof startPositionTracking === 'function') {
          startPositionTracking();
        }
        addToSummary("▶️ Navigation resumed");
        if (typeof sayAndResume === 'function') {
          sayAndResume(message || "Navigation resumed");
        }
      } else {
        if (typeof sayAndResume === 'function') {
          sayAndResume("No route to resume. Please set a destination first.");
        }
      }
      break;
      
    default:
      addToSummary(`🎮 ${message}`);
      if (typeof sayAndResume === 'function') {
        sayAndResume(message || "Movement control executed");
      }
  }
}

function handleRouteControl(parsed) {
  const { action, message } = parsed;
  
  switch(action) {
    case "clear":
      if (typeof clearRoute === 'function') {
        clearRoute();
      }
      clearSummary();
      if (typeof stopPositionTracking === 'function') {
        stopPositionTracking();
      }
      addToSummary("🧹 Route cleared");
      if (typeof sayAndResume === 'function') {
        sayAndResume(message || "Route cleared");
      }
      break;
      
    case "new":
      if (typeof clearRoute === 'function') {
        clearRoute();
      }
      addToSummary("🆕 Ready for new route");
      if (typeof sayAndResume === 'function') {
        sayAndResume(message || "Previous route cleared. Where would you like to go?");
      }
      break;
      
    default:
      addToSummary(`🗺️ ${message}`);
      if (typeof sayAndResume === 'function') {
        sayAndResume(message || "Route command executed");
      }
  }
}

function handleStatusQuery(parsed) {
  const { action, message } = parsed;
  
  switch(action) {
    case "location":
      if (currentPosition) {
        const locationMsg = `Current location: ${currentPosition.lat.toFixed(4)}, ${currentPosition.lng.toFixed(4)}`;
        addToSummary(`📍 ${locationMsg}`);
        if (typeof sayAndResume === 'function') {
          sayAndResume(message || locationMsg);
        }
      } else {
        if (typeof tryLocateUser === 'function') {
          tryLocateUser();
        }
        if (typeof sayAndResume === 'function') {
          sayAndResume(message || "Getting current location...");
        }
      }
      break;
      
    default:
      addToSummary(`ℹ️ ${message}`);
      if (typeof sayAndResume === 'function') {
        sayAndResume(message || "Status information provided");
      }
  }
}

function handleSpeedControl(parsed) {
  const { parameters, message } = parsed;
  const speed = parameters?.speed || "normal";
  
  addToSummary(`⚡ Speed set to: ${speed}`);
  if (typeof sayAndResume === 'function') {
    sayAndResume(message || `Speed adjusted to ${speed} pace`);
  }
}

function handleMapControl(parsed) {
  const { parameters, message } = parsed;
  const feature = parameters?.mapFeature;
  
  switch(feature) {
    case "traffic":
      const trafficToggle = $("trafficToggle");
      trafficToggle.checked = !trafficToggle.checked;
      trafficToggle.dispatchEvent(new Event('change'));
      addToSummary("🚦 Traffic layer toggled");
      if (typeof sayAndResume === 'function') {
        sayAndResume(message || "Traffic layer toggled");
      }
      break;
      
    case "satellite":
      addToSummary("🛰️ Satellite view toggled");
      if (typeof sayAndResume === 'function') {
        sayAndResume(message || "Satellite view toggled");
      }
      break;
      
    default:
      addToSummary(`🗺️ ${message}`);
      if (typeof sayAndResume === 'function') {
        sayAndResume(message || "Map feature adjusted");
      }
  }
}

function handleEnvironmentalControl(parsed) {
  const { parameters, message } = parsed;
  const mode = parameters?.mode;
  
  addToSummary(`🌍 Environmental mode: ${mode}`);
  if (typeof sayAndResume === 'function') {
    sayAndResume(message || `Switched to ${mode} navigation mode`);
  }
}

// Auto-start voice system after a brief delay
async function autoStartVoice() {
  console.log("🎤 Attempting auto-start of voice system...");
  
  try {
    // Small delay to let page fully load
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Simulate button click to satisfy browser security requirements
    const voiceButton = document.getElementById("toggleVoiceBtn");
    if (voiceButton && !isListening) {
      console.log("🎤 Auto-clicking voice button to start system...");
      voiceButton.click(); // This satisfies browser user interaction requirement
    }
  } catch (error) {
    console.error("❌ Auto-start failed:", error);
    console.log("💡 User will need to click the microphone button manually");
  }
}

// ===== MOBILE SIDEBAR FUNCTIONS =====
function toggleSidebar() {
  const sidebar = $("sidebar");
  sidebar.classList.toggle("active");
  
  const isOpen = sidebar.classList.contains("active");
  $("sidebarToggle").setAttribute("aria-expanded", isOpen);
  if ($("menuToggle")) $("menuToggle").setAttribute("aria-expanded", isOpen);
  
  if (window.innerWidth <= 1024) {
    document.body.style.overflow = isOpen ? "hidden" : "";
  }
}

function closeSidebar() {
  const sidebar = $("sidebar");
  sidebar.classList.remove("active");
  
  $("sidebarToggle").setAttribute("aria-expanded", "false");
  if ($("menuToggle")) $("menuToggle").setAttribute("aria-expanded", "false");
  
  document.body.style.overflow = "";
}

window.addEventListener('resize', () => {
  if (window.innerWidth > 1024) {
    closeSidebar();
  }
});


// ===== INITIALIZATION (updated) =====
document.addEventListener('DOMContentLoaded', async () => {
  console.log("🔄 DOM loaded, initializing...");

  // Wire up sidebar toggles
  const menuToggleBtn = $("menuToggle");
  const closeSidebarBtn = $("closeSidebar");
  const sidebarToggleBtn = $("sidebarToggle");
  const sidebarEl = $("sidebar");
  const leftEdgeHotspot = $("leftEdgeHotspot");
  const bodyEl = document.body;
  let sidebarAutoCloseTimer = null;

  function openSidebar() {
    if (!sidebarEl) return;
    sidebarEl.classList.add('active');
    sidebarEl.classList.add('open');
    if (window.innerWidth <= 1024) document.body.style.overflow = 'hidden';
  }

  function scheduleSidebarAutoClose(delayMs = 3500) {
    if (!sidebarEl) return;
    if (sidebarAutoCloseTimer) {
      clearTimeout(sidebarAutoCloseTimer);
      sidebarAutoCloseTimer = null;
    }
    // Only auto-close while navigation is active
    if (uiNavigationActive || window.navigationInProgress) {
      sidebarAutoCloseTimer = setTimeout(() => {
        sidebarEl.classList.remove('active');
        sidebarEl.classList.remove('open');
        document.body.style.overflow = '';
      }, delayMs);
    }
  }

  if (menuToggleBtn && sidebarEl) {
    menuToggleBtn.addEventListener('click', () => {
      openSidebar();
    });
  }

  if (closeSidebarBtn && sidebarEl) {
    closeSidebarBtn.addEventListener('click', () => {
      sidebarEl.classList.remove('active');
      sidebarEl.classList.remove('open');
      document.body.style.overflow = '';
    });
  }

  if (sidebarToggleBtn) {
    sidebarToggleBtn.addEventListener('click', toggleSidebar);
  }

  // Hover-to-reveal: when mouse enters the left-edge hotspot, open the sidebar
  if (leftEdgeHotspot && sidebarEl) {
    leftEdgeHotspot.addEventListener('mouseenter', () => {
      if (uiNavigationActive || window.navigationInProgress) {
        openSidebar();
        scheduleSidebarAutoClose(3500);
      }
    });
  }

  // When mouse leaves the sidebar during navigation, auto-close it to keep map visible
  if (sidebarEl) {
    sidebarEl.addEventListener('mouseenter', () => {
      if (sidebarAutoCloseTimer) {
        clearTimeout(sidebarAutoCloseTimer);
        sidebarAutoCloseTimer = null;
      }
    });
    sidebarEl.addEventListener('mouseleave', () => {
      if (uiNavigationActive || window.navigationInProgress) {
        sidebarEl.classList.remove('active');
        sidebarEl.classList.remove('open');
        document.body.style.overflow = '';
      }
    });
  }

  // Listen for navigation lifecycle to auto-hide sidebar
  document.addEventListener('navigation:start', () => {
    uiNavigationActive = true;
    closeSidebar();
    if (bodyEl) bodyEl.classList.add('nav-active');
  });
  document.addEventListener('navigation:end', () => {
    uiNavigationActive = false;
    // Do not force open; user can reveal via hotspot or buttons
    if (bodyEl) bodyEl.classList.remove('nav-active');
    if (sidebarAutoCloseTimer) {
      clearTimeout(sidebarAutoCloseTimer);
      sidebarAutoCloseTimer = null;
    }
  });

  // Map Chips Toggle -> sync with checkboxes
  const layerMap = { traffic: 'trafficToggle', transit: 'transitToggle', bike: 'bicyclingToggle' };
  document.querySelectorAll('.map-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      chip.classList.toggle('active');
      const layer = chip.dataset.layer;
      const checkboxId = layerMap[layer];
      const checkbox = checkboxId ? $(checkboxId) : null;
      if (checkbox) {
        checkbox.checked = chip.classList.contains('active');
        checkbox.dispatchEvent(new Event('change'));
      }
    });
  });

  // FAB proxies removed (corner buttons deleted)

  try {
    // Just load the config - everything else happens in initMap()
    if (typeof loadConfig === 'function') {
      await loadConfig();
    } else {
      console.error("loadConfig function not found - check map.js");
    }

    console.log("✅ Initial setup complete");
  } catch (error) {
    console.error("❌ Initialization error:", error);
  }
});

window.addEventListener('beforeunload', () => {
  if (typeof cameraStream !== 'undefined' && cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
  }
  if (typeof isDetectionRunning !== 'undefined' && isDetectionRunning && typeof stopObjectDetection === 'function') {
    stopObjectDetection();
  }
});

