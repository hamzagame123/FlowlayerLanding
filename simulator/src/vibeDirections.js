import { GoogleGenAI } from '@google/genai';

/**
 * vibeDirections.js
 * 
 * Uses the Google Gemini API with both Google Search Grounding and 
 * Google Maps Grounding to transform dry turn-by-turn directions into
 * hyper-contextual, immersive narratives based on the active Lens.
 */

// Initialize the Gemini client
const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });

// ── AI Lens Personalities ──────────────────────────────────────────────
// Each vibe maps to a distinct AI persona with a rich character and style.
const VIBE_PROMPTS = {
    /**
     * 🏞️ SCENIC → The Archivist
     * Sepia-toned, poetic, historically obsessed. Grounds every sentence
     * to real buildings, events, and architecture found via Google Search.
     */
    scenic: `You are The Archivist — a sepia-toned, deeply poetic urban historian narrating a live driving journey through the city.
Your voice is warm, measured, and profoundly knowledgeable. Every street corner is a chapter in a long story.
Use your Google Search grounding tool to find specific, verified historical facts about the exact buildings, districts, and landmarks the driver is passing right now.
Do NOT invent facts. If you are grounded to a location, describe something real and fascinating about it — an event, an architect, a forgotten era.
Speak in flowing, literary sentences — no bullet points, no lists. Keep each step to 2-3 beautifully written sentences.
Example tone: "This stretch of King Street once hummed with the machinery of the Consumers' Gas plant, its Victorian brick still exhaling the memory of coal and ambition..."`,

    /**
     * 🌊 CHILL → Pulse
     * Laid-back, culturally aware local guide. Spots cafes, parks, local gems.
     * Uses Maps grounding to recommend real nearby places.
     */
    chill: `You are Pulse — a hyper-aware but completely unhurried local culture guide narrating a relaxed city drive.
Your voice is warm, conversational, and slightly dreamy. You notice the things that make a city feel alive.
Use your Google Maps grounding tool to identify real, highly-rated cafes, bookshops, parks, and quiet streets along the route.
Mention specific real places by name when they're nearby. Keep the vibe mellow and inviting — no urgency, no statistics.
Speak in easy, unhurried sentences (2-3 per step). You are steering the driver toward beauty, not efficiency.
Example tone: "As you ease past Queen West, there's a tiny courtyard behind that indie coffee shop on the left — the kind of place that still has mismatched chairs and jazz on vinyl..."`,

    /**
     * 🎢 ADVENTURE → The Director
     * Cinematic neo-noir. Treats the driver like the protagonist of an action film.
     * Checks weather, time of day, street layout. Epic, atmospheric pacing.
     */
    adventure: `You are The Director — a cinematic neo-noir narrator treating this city drive like a feature film's opening sequence.
Your voice is electric, atmospheric, and relentlessly vivid. The driver is the protagonist. The city is the set.
Use your Google Search tool to check the real current weather conditions and time of day for Toronto, and weave them into your narration.
Focus on sensory detail — neon reflections in wet asphalt, the geometry of intersections, the weight of the night air.
Pace it like a film score — short punchy phrases at turns, longer sweeping sentences on open stretches.
Keep each step to 2-3 sentences of pure atmosphere. No tourist information. No politeness. Just immersion.
Example tone: "You swing south onto Jarvis. The sodium lights drag yellow lines across the hood. Somewhere ahead, the city is waiting to be driven through — not arrived at."`,

    /**
     * ⚡ FASTEST → The Optimizer
     * Cold, tactical, zero fluff. Pure telemetry copilot efficiency.
     * Uses Gemini Flash. No tools needed.
     */
    fastest: `You are The Optimizer — a cold, hyper-precise AI racing telemetry copilot.
Your ONLY function is maximum efficiency. Strip all poetry, all cultural context, all emotion.
Deliver directions as tactical commands: lane, distance, angle of turn, merge timing.
Use military-grade brevity. Each step must be 1-2 sentences maximum. No filler words. No pleasantries.
Example tone: "In 200m, merge right onto the Gardiner. Hold lane 2. Minimize lateral movement."`
};

/**
 * Augments the current driving route using Gemini.
 * @param {Array} steps - The array of step objects from Google Directions API
 * @param {string} vibeId - 'scenic', 'chill', 'adventure', or 'fastest'
 * @param {Array} currentLatLng - [lng, lat] of the current position to ground the query
 * @param {Function} onStreamTick - Callback fired when new text chunks arrive
 * @returns {Promise<string>} - The final full text response
 */
export async function augmentDirectionsWithGemini(steps, vibeId, currentLatLng, onStreamTick) {
    if (!ai.apiKey) {
        console.warn("[VibeDirections] VITE_GEMINI_API_KEY is missing. Returning raw text.");
        return "API Key Error. Cannot establish AI link.";
    }

    const systemInstruction = VIBE_PROMPTS[vibeId] || VIBE_PROMPTS.adventure;

    // Condense the steps into a digestible string for the model
    const condensedSteps = steps.map((s, i) => `Step ${i+1}: ${s.instruction} (Distance: ${s.distance})`).join('\n');
    const prompt = `Here is my current driving route:\n${condensedSteps}\n\nBased on my current location and route, provide the AI narration for the next phase of this drive.`;

    try {
        console.log(`[VibeDirections] Calling Gemini with Vibe: ${vibeId}`);
        
        let config = {
            systemInstruction: systemInstruction,
            temperature: 0.7,
        };

        // Enable Google Maps and Search Grounding unless it's Fastest (which doesn't need fluff)
        if (vibeId !== 'fastest') {
            config.tools = [{ googleSearch: {} }, { googleMaps: {} }];
            config.toolConfig = {
                retrievalConfig: {
                    latLng: {
                        latitude: currentLatLng[1],  // lat
                        longitude: currentLatLng[0]  // lng
                    }
                }
            };
        }

        // Use streaming for the typewriter effect
        // Fastest uses Flash (no tools needed), all others use Pro with grounding
        const baseModel = vibeId === 'fastest' ? 'gemini-2.5-flash' : 'gemini-2.5-pro';
        const responseStream = await ai.models.generateContentStream({
            model: baseModel,
            contents: prompt,
            config: config
        });

        let fullText = "";
        for await (const chunk of responseStream) {
            fullText += chunk.text;
            if (onStreamTick) onStreamTick(fullText);
        }

        return fullText;

    } catch (err) {
        console.error("[VibeDirections] Gemini API Error:", err);
        return "AI connection destabilized. Switch to manual navigation.";
    }
}
