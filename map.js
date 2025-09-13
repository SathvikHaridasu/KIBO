// ===== MAPS & ROUTING MODULE =====

// ===== MAP VARIABLES =====
let map, infoWindow, geocoder, directionsService, directionsRenderer, placesService;
let trafficLayer, transitLayer, bicyclingLayer;
let userMarker = null;
let droppedMarkers = [];

// ===== CONFIG & INITIALIZATION =====
async function loadConfig() {
  try {
    const response = await fetch("http://localhost:3001/api/config");
    const config = await response.json();
    googleMapsApiKey = config.googleMapsApiKey;
    
    if (!googleMapsApiKey) {
      throw new Error("Google Maps API key not found in backend config");
    }
    
    await loadGoogleMapsScript();
    
  } catch (error) {
    console.error("Failed to load config:", error);
    if (typeof toast === 'function') {
      toast("Configuration error. Please ensure backend is running.");
    }
  }
}

function loadGoogleMapsScript() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places&callback=initMap`;
    script.onerror = () => reject(new Error('Failed to load Google Maps script'));
    
    window.initMap = initMap;
    document.head.appendChild(script);
  });
}

// ===== MAP INITIALIZATION =====

function setupAutocomplete(){
  const originInput = document.getElementById("origin"); 
  const destInput = document.getElementById("destination");
  const originAC = new google.maps.places.Autocomplete(originInput, { fields: ["place_id", "geometry", "name", "formatted_address"] });
  const destAC = new google.maps.places.Autocomplete(destInput, { fields: ["place_id", "geometry", "name", "formatted_address"] });
  originAC.addListener("place_changed", ()=> { const p=originAC.getPlace(); if (p.geometry) { map.panTo(p.geometry.location); map.setZoom(14);} });
  destAC.addListener("place_changed", ()=> { const p=destAC.getPlace(); if (p.geometry) { map.panTo(p.geometry.location); map.setZoom(14);} });
}

function setupMapClickDropMarker(){
  map.addListener("click", (e)=> {
    const marker = new google.maps.Marker({ position: e.latLng, map, draggable: true, animation: google.maps.Animation.DROP });
    droppedMarkers.push(marker);
    marker.addListener("click", ()=> {
      infoWindow.setContent(`Lat: ${marker.getPosition().lat().toFixed(6)}<br>Lng: ${marker.getPosition().lng().toFixed(6)}`);
      infoWindow.open(map, marker);
    });
  });
}

// ===== ENHANCED LOCATION TRACKING =====
function tryLocateUser(){
  if (!navigator.geolocation) { 
    if (typeof toast === 'function') {
      toast("Geolocation not supported by your browser.");
    }
    return; 
  }
  
  navigator.geolocation.getCurrentPosition(
    (pos)=> {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      currentPosition = coords;
      map.setCenter(coords); 
      map.setZoom(16);
      
      if (userMarker) userMarker.setMap(null);
      userMarker = new google.maps.Marker({ 
        position: coords, 
        map, 
        title: "Kibo's Location",
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#4285F4",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2
        }
      });
      
      console.log("📍 Kibo location set:", coords);
      if (typeof addToSummary === 'function') {
        addToSummary("🤖 Kibo's location updated");
      }
      
      if (typeof navigationActive !== 'undefined' && navigationActive) {
        if (typeof startPositionTracking === 'function') {
          startPositionTracking();
        }
      }
    },
    (err)=> { 
      console.warn("Geolocation error:", err); 
      if (typeof toast === 'function') {
        toast("Could not get Kibo's location.");
      }
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
  );
}

function addWaypointRow(value=""){
  const list = document.getElementById("waypointsList");
  if (list.children.length >= 8) { alert("Maximum of 8 waypoints reached."); return; }
  const row = document.createElement("div");
  row.className = "waypoint-row";
  const input = document.createElement("input");
  input.type = "text"; input.placeholder = "Waypoint (optional)"; input.value = value;
  const removeBtn = document.createElement("button");
  removeBtn.className = "icon-btn"; removeBtn.title = "Remove waypoint"; removeBtn.textContent = "✕";
  removeBtn.addEventListener("click", ()=> row.remove());
  row.appendChild(input); row.appendChild(removeBtn); list.appendChild(row);
  const ac = new google.maps.places.Autocomplete(input, { fields: ["place_id", "geometry", "name"] });
  ac.addListener("place_changed", () => {});
}

function useHereInField(fieldId){
  if (!userMarker) { 
    if (typeof toast === 'function') {
      toast("We don't have your current location yet. Click 'Use My Location' first.");
    }
    return; 
  }
  geocoder.geocode({ location: userMarker.getPosition() }, (results, status)=> {
    if (status === "OK" && results && results[0]) { 
      document.getElementById(fieldId).value = results[0].formatted_address; 
    } else { 
      document.getElementById(fieldId).value = `${userMarker.getPosition().lat()}, ${userMarker.getPosition().lng()}`; 
    }
  });
}

function clearDroppedMarkers(){ 
  droppedMarkers.forEach(m => m.setMap(null)); 
  droppedMarkers = []; 
}

function getSelectedMode(){
  const checked = document.querySelector('input[name="mode"]:checked');
  return checked ? checked.value : "DRIVING";
}

// ===== NAVIGATION FUNCTIONS =====
function parseDirectionsToSteps(directionsResult) {
  const steps = [];
  const route = directionsResult.routes[0];
  
  if (!route || !route.legs) return steps;
  
  route.legs.forEach((leg, legIndex) => {
    leg.steps.forEach((step, stepIndex) => {
      const instruction = step.instructions.replace(/<[^>]*>/g, '');
      
      steps.push({
        instruction: instruction,
        distance: step.distance.text,
        distanceValue: step.distance.value, // meters
        duration: step.duration.text,
        startLocation: step.start_location,
        endLocation: step.end_location,
        maneuver: step.maneuver || 'straight',
        legIndex: legIndex,
        stepIndex: stepIndex
      });
    });
  });
  
  return steps;
}

// ===== ROUTING FUNCTIONS =====
function buildAndDisplayRoute(){
  const origin = document.getElementById("origin").value.trim();
  const destination = document.getElementById("destination").value.trim();
  if (!origin || !destination) { 
    if (typeof toast === 'function') {
      toast("Please enter both origin and destination.");
    }
    return; 
  }
  
  if (typeof stopPositionTracking === 'function') {
    stopPositionTracking();
  }
  if (typeof clearSummary === 'function') {
    clearSummary();
  }
  
  const waypointInputs = Array.from(document.querySelectorAll("#waypointsList input"));
  const waypoints = waypointInputs.map(inp => inp.value.trim()).filter(Boolean).map(addr => ({ location: addr, stopover: true }));
  const request = { 
    origin, 
    destination, 
    waypoints, 
    travelMode: getSelectedMode(), 
    optimizeWaypoints: true, 
    provideRouteAlternatives: true, 
    drivingOptions: { departureTime: new Date() } 
  };
  
  if (typeof addToSummary === 'function') {
    addToSummary("🔍 Calculating route...");
  }
  
  directionsService.route(request, async (result, status) => {
    if (status === "OK" && result) { 
      directionsRenderer.setDirections(result); 
      renderSummary(result);
      
      // Store route for navigation
      window.currentRoute = result;
      
      if (typeof addToSummary === 'function') {
        addToSummary("✅ Route calculated - starting step-by-step navigation");
      }
      
      // ✅ AUTO-START STEP-BY-STEP NAVIGATION
      await startAutomaticNavigation(result);
      
    } else { 
      const errorMsg = "Directions request failed: " + status;
      if (typeof toast === 'function') {
        toast(errorMsg);
      }
      if (typeof addToSummary === 'function') {
        addToSummary(`❌ ${errorMsg}`);
      }
      if (typeof say === 'function') {
        say("I couldn't build that route.");
      }
    }
  });
}

function clearRoute(){ 
  directionsRenderer.setDirections({ routes: [] }); 
  if (typeof clearSummary === 'function') {
    clearSummary();
  }
  if (typeof stopPositionTracking === 'function') {
    stopPositionTracking();
  }
  if (typeof stopNavigationSafety === 'function') {
    stopNavigationSafety();
  }
  console.log("🧹 Route cleared");
}

function resetAll(){
  clearRoute(); 
  clearDroppedMarkers(); 
  document.getElementById("origin").value = ""; 
  document.getElementById("destination").value = "";
  document.querySelectorAll("#waypointsList .waypoint-row").forEach(r => r.remove()); 
  addWaypointRow(); 
  map.setZoom(12);
  
  if (typeof navigationMode !== 'undefined' && navigationMode) {
    if (typeof stopNavigationSafety === 'function') {
      stopNavigationSafety();
    }
  }
}

function renderSummary(directionResult){
  const route = directionResult.routes[0];
  if (!route) return;
  let txt = "";
  if (route.legs && route.legs.length){
    let totalDist = 0, totalDur = 0;
    route.legs.forEach((leg, i)=> {
      txt += `Leg ${i+1}: ${leg.start_address} → ${leg.end_address}\n`;
      txt += `  Distance: ${leg.distance?.text || "-"} | Duration: ${leg.duration?.text || "-"}\n\n`;
      totalDist += leg.distance?.value || 0;
      totalDur += leg.duration?.value || 0;
    });
    const km = (totalDist/1000).toFixed(2);
    const min = Math.round(totalDur/60);
    txt = `Total: ${km} km • ${min} min\n\n` + txt;
  }
  // Don't overwrite summary if it contains navigation info
  if (typeof navigationActive !== 'undefined' && !navigationActive) {
    const summaryElement = document.getElementById("summary");
    if (summaryElement) {
      summaryElement.textContent = txt;
    }
  }
}

async function startAutomaticNavigation(routeResult) {
  console.log("🚀 Starting automatic step-by-step navigation...");
  
  // ❌ REMOVE ALL SPEECH CALLS FROM HERE
  // Just start the systems silently
  if (typeof startNavigationSilently === 'function') {
    startNavigationSilently(routeResult);
  }
}

async function findNearestPlace(searchTerm) {
  console.log("🔍 Finding nearest:", searchTerm);
  
  lastSearchContext = {
    searchTerm: searchTerm,
    timestamp: Date.now()
  };

  try {
    const location = userMarker ? userMarker.getPosition() : map.getCenter();
    
    const requestBody = {
      textQuery: `${searchTerm} near me`,
      maxResultCount: 5,
      locationBias: {
        circle: {
          center: {
            latitude: location.lat(),
            longitude: location.lng()
          },
          radius: 5000.0
        }
      }
    };
    
    const response = await fetch(`https://places.googleapis.com/v1/places:searchText`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleMapsApiKey,
        'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.location,places.id'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Places API error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.places || data.places.length === 0) {
      if (typeof sayAndResume === 'function') {
        await sayAndResume(`Sorry, I couldn't find any ${searchTerm} nearby.`);
      }
      return;
    }

    const place = data.places[0];
    const placeLocation = new google.maps.LatLng(
      place.location.latitude, 
      place.location.longitude
    );
    
    const routeRequest = {
      origin: location,
      destination: placeLocation,
      travelMode: getSelectedMode()
    };
    
    directionsService.route(routeRequest, async (result, status) => {
      if (status === "OK" && result) {
        const route = result.routes[0];
        const leg = route.legs[0];
        
        const distance = leg.distance?.text || "unknown distance";
        const duration = leg.duration?.text || "unknown time";
        const placeName = place.displayName?.text || searchTerm;
        
        // Set up the map display
        directionsRenderer.setDirections(result);
        renderSummary(result);
        document.getElementById("destination").value = placeName;
        window.currentRoute = result;
        
        // ✅ Complete location announcement first
        const locationMessage = `Found ${placeName}. It's ${distance} away, taking about ${duration}. Starting navigation now.`;
        
        if (typeof addToSummary === 'function') {
          addToSummary(`🎯 Found ${placeName} (${distance}, ${duration})`);
        }
        
        console.log("🗣️ Announcing location found, then starting navigation...");
        
        // ✅ Wait for speech to complete, THEN start navigation
        if (typeof say === 'function') {
          await say(locationMessage);
        }
        
        console.log("✅ Location announcement complete - now starting navigation");
        
        // ✅ Start navigation after speech completes
        setTimeout(() => {
          if (typeof startNavigationCleanly === 'function') {
            startNavigationCleanly(result);
          }
        }, 1000);
        
      } else {
        const placeName = place.displayName?.text || searchTerm;
        console.error("❌ Route calculation failed:", status);
        if (typeof sayAndResume === 'function') {
          await sayAndResume(`Found ${placeName}, but couldn't calculate the route.`);
        }
      }
    });
    
  } catch (error) {
    console.error("❌ Find nearest error:", error);
    if (typeof sayAndResume === 'function') {
      await sayAndResume(`Sorry, there was an error finding ${searchTerm} locations.`);
    }
  }
}

async function searchAndNavigate(query) {
  console.log("🔍 Searching for:", query);
  const location = userMarker ? userMarker.getPosition() : map.getCenter();
  
  placesService.textSearch({ query, location, radius: 50000 }, async (results, status) => {
    console.log("🔎 Text search status:", status);
    console.log("📋 Text search results:", results?.length || 0, "found");
    
    if (status !== google.maps.places.PlacesServiceStatus.OK || !results || results.length === 0) {
      if (typeof say === 'function') {
        say(`Sorry, I couldn't find ${query}.`);
      }
      return;
    }
    
    const place = results[0];
    
    const request = { origin: location, destination: place.geometry.location, travelMode: getSelectedMode() };
    directionsService.route(request, async (result, status) => {
      if (status === "OK" && result) {
        directionsRenderer.setDirections(result);
        renderSummary(result);
        document.getElementById("destination").value = place.name || place.formatted_address || query;
        
        window.currentRoute = result;
        
        if (typeof addToSummary === 'function') {
          addToSummary(`🎯 Found ${place.name} - starting step-by-step navigation automatically`);
        }
        await startAutomaticNavigation(result);
        
      } else {
        if (typeof say === 'function') {
          say("Sorry, I couldn't calculate the route.");
        }
      }
    });
  });
}

// ===== MAP INITIALIZATION =====
function initMap() {
  const DEFAULT_CENTER = { lat: 43.6532, lng: -79.3832 };
  
  // ✅ CREATE THE ACTUAL MAP (this was missing!)
  map = new google.maps.Map(document.getElementById("map"), {
    center: DEFAULT_CENTER, 
    zoom: 12, 
    streetViewControl: true, 
    mapTypeControl: true, 
    fullscreenControl: true,
    gestureHandling: 'cooperative',
    disableDefaultUI: false,
    zoomControl: true,
    mapTypeId: 'roadmap',
    optimized: true,
    useStaticMap: false
  });
  
  // ✅ INITIALIZE MAP SERVICES (this was missing!)
  infoWindow = new google.maps.InfoWindow();
  geocoder = new google.maps.Geocoder();
  directionsService = new google.maps.DirectionsService();
  directionsRenderer = new google.maps.DirectionsRenderer({ 
    suppressMarkers: false,
    optimized: true,
    preserveViewport: false
  });
  directionsRenderer.setMap(map);
  placesService = new google.maps.places.PlacesService(map);

  trafficLayer = new google.maps.TrafficLayer();
  transitLayer = new google.maps.TransitLayer();
  bicyclingLayer = new google.maps.BicyclingLayer();

// ✅ SETUP ALL THE FUNCTIONALITY
if (typeof setupUI === 'function') setupUI();
if (typeof setupVADControls === 'function') setupVADControls();
setupAutocomplete();
setupMapClickDropMarker();
tryLocateUser();
if (typeof setupCamera === 'function') setupCamera();

console.log("✅ Google Maps initialized successfully");

// ✅ THEN AUTO-START VOICE SYSTEM WITH VAD
setTimeout(async () => {
  console.log("🎤 Auto-starting voice system...");
  try {
    if (typeof setupVoice === 'function') {
      await setupVoice();
      console.log("✅ Voice system auto-started successfully");
    }
    
    // ✅ NOW START THE ACTUAL VOICE LISTENING
    if (typeof checkVAPIAvailability === 'function') {
      console.log("🎤 Starting voice activity detection...");
      await checkVAPIAvailability();
      console.log("✅ Voice listening activated");
    }
    
  } catch (error) {
    console.error("❌ Voice auto-start failed:", error);
  }
}, 1500);
}