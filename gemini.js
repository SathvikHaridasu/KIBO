// gemini.js - enhanced for conversational intelligence
window.GEMINI_CONFIG = {
  apiKey: "AIzaSyBUZtba4U80SiS9BbGUDTqP8Um4L4Oemgk",
  model: "models/gemini-1.5",
  endpointBase: "https://generativelanguage.googleapis.com/v1beta2"
};

window.geminiAnalyzeUtterance = async function(utterance, conversationHistory = []){
  const url = `${GEMINI_CONFIG.endpointBase}/${encodeURIComponent(GEMINI_CONFIG.model)}:generateContent?key=${encodeURIComponent(GEMINI_CONFIG.apiKey)}`;

  const systemInstruction = `You are Kibo, an intelligent navigation assistant. Parse user requests and respond with STRICT JSON only.

For complex requests like "set destination to nearest walmart", break them into actionable steps.

Return JSON matching this schema:
{
  "assistant_say": "string (conversational response, <=200 chars)",
  "intent": "navigate|nearest|route|toggle_layer|set_mode|clear_route|add_waypoint|general|unknown",
  "entity": "string (place name/type like 'walmart', 'coffee shop')",
  "place_type": "string (google places type: 'store', 'restaurant', 'gas_station', etc)",
  "search_query": "string (what to search for)",
  "travel_mode": "DRIVING|WALKING|TRANSIT|BICYCLING",
  "action_chain": ["string array of actions needed"],
  "needs_location": boolean,
  "needs_confirmation": boolean,
  "layer": "traffic|transit|bicycling",
  "layer_on": boolean
}

Examples:
- "nearest walmart" → {"intent":"nearest", "entity":"walmart", "place_type":"store", "search_query":"walmart", "needs_location":true, "needs_confirmation":true}
- "set destination to closest gas station" → {"intent":"nearest", "entity":"gas station", "place_type":"gas_station", "search_query":"gas station", "action_chain":["find_location", "search_places", "calculate_route"], "needs_confirmation":true}`;

  const messages = [
    { role: "system", content: [{ type: "text/plain", text: systemInstruction }] },
    { role: "user", content: [{ type: "text/plain", text: utterance }] }
  ];

  const body = {
    prompt: messages,
    responseConfig: { responseMimeType: "application/json" },
    temperature: 0.3,
    maxOutputTokens: 512
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(()=>res.statusText);
    throw new Error("Gemini API error: " + res.status + " " + text);
  }

  const data = await res.json();
  const raw = (data?.candidates?.[0]?.content?.[0]?.text) || JSON.stringify(data);
  try {
    return JSON.parse(raw);
  } catch (e) {
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch(_){}
    }
    throw new Error("Could not parse Gemini JSON response.");
  }
};