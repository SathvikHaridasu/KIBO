// ===== MAIN APPLICATION ENTRY POINT (Simplified) =====

// ===== GLOBAL STATE VARIABLES =====
let currentPosition = null;
let navigationActive = false;

// ===== UTILITY FUNCTIONS =====
function $(id) { return document.getElementById(id); }
function setTranscript(t) { const el = $("transcript"); if (el) el.textContent = t; }
function setAssistant(t) { const el = $("assistantOutput"); if (el) el.textContent = t; }
function toast(msg) { setAssistant(msg); }

// ===== SUMMARY BOX FUNCTIONS =====
function addToSummary(message) {
  const summaryBox = $("summary");
  if (!summaryBox) return;
  summaryBox.textContent += message + "\n";
  summaryBox.scrollTop = summaryBox.scrollHeight;
}
function clearSummary() {
  const summaryBox = $("summary");
  if (summaryBox) summaryBox.textContent = "";
}

// ===== INTENT HANDLERS (Simplified) =====
function handleMovementControl(parsed) {
  const { action, message } = parsed;
  switch(action) {
    case "stop":
      navigationActive = false;
      addToSummary("🛑 Robot stopped");
      break;
    case "resume":
      navigationActive = true;
      addToSummary("▶️ Navigation resumed");
      break;
    default:
      addToSummary(`🎮 ${message}`);
  }
}

function handleStatusQuery(parsed) {
  const { action, message } = parsed;
  if (action === "location" && currentPosition) {
    addToSummary(`📍 Current location: ${currentPosition.lat}, ${currentPosition.lng}`);
  } else {
    addToSummary(`ℹ️ ${message}`);
  }
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  console.log("🔄 DOM loaded, simplified app ready.");
});
