import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";

const SUPPORTED_VIBES = new Set(["scenic", "chill", "adventure", "fastest"]);

const VIBE_PROMPTS = {
  scenic: "You are a grounded route concierge for a scenic drive. Suggest only real nearby places that fit the route and keep the tone polished and calm.",
  chill: "You are a relaxed local guide. Suggest only real nearby places that fit an easygoing drive, and keep the tone concise and mellow.",
  adventure: "You are a cinematic route scout. Suggest only real nearby places that add energy or intrigue without inventing facts.",
  fastest: "You are a practical copilot. Suggest only real nearby places worth a quick stop if they are genuinely close and relevant. Keep it efficient.",
};

const TORONTO_FALLBACK_PLACES = [
  {
    name: "Harbourfront Centre",
    lat: 43.6380,
    lng: -79.3818,
    vibes: ["scenic", "chill"],
    reason: "Waterfront cultural hub with wide skyline views and an easy pull toward the lake.",
    address: "235 Queens Quay W, Toronto",
  },
  {
    name: "HTO Park",
    lat: 43.6373,
    lng: -79.3906,
    vibes: ["scenic", "chill"],
    reason: "Photogenic shoreline stop with one of the cleanest skyline angles near the waterfront route.",
    address: "339 Queens Quay W, Toronto",
  },
  {
    name: "Toronto Music Garden",
    lat: 43.6361,
    lng: -79.3995,
    vibes: ["scenic", "chill"],
    reason: "Calm lakefront garden that reads well for a slower, softer route mood.",
    address: "479 Queens Quay W, Toronto",
  },
  {
    name: "Sugar Beach",
    lat: 43.6426,
    lng: -79.3679,
    vibes: ["scenic", "chill"],
    reason: "Distinctive pink waterfront spot with strong photo energy and an open harbour view.",
    address: "11 Dockside Dr, Toronto",
  },
  {
    name: "REBEL",
    lat: 43.6407,
    lng: -79.3544,
    vibes: ["adventure"],
    reason: "Large waterfront nightlife venue that fits an adventure read when the drive wants more pulse.",
    address: "11 Polson St, Toronto",
  },
  {
    name: "Cabana Pool Bar",
    lat: 43.6402,
    lng: -79.3552,
    vibes: ["adventure", "scenic"],
    reason: "High-energy waterfront spot that still keeps the skyline in play.",
    address: "11 Polson St, Toronto",
  },
  {
    name: "The Bentway",
    lat: 43.6386,
    lng: -79.4100,
    vibes: ["adventure", "chill"],
    reason: "Under-Gardiner corridor with a stronger urban edge and event energy.",
    address: "250 Fort York Blvd, Toronto",
  },
  {
    name: "Distillery District",
    lat: 43.6503,
    lng: -79.3596,
    vibes: ["adventure", "scenic"],
    reason: "Dense pedestrian district with heritage texture, nightlife pull, and good visual payoff.",
    address: "55 Mill St, Toronto",
  },
  {
    name: "Union Station",
    lat: 43.6453,
    lng: -79.3806,
    vibes: ["fastest"],
    reason: "Major city anchor useful for orienting a faster, more direct downtown corridor.",
    address: "65 Front St W, Toronto",
  },
  {
    name: "St. Lawrence Market",
    lat: 43.6487,
    lng: -79.3715,
    vibes: ["chill", "fastest"],
    reason: "Central stop with quick city access and a strong local-food anchor.",
    address: "93 Front St E, Toronto",
  },
];

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    summary: {
      type: "string",
      description: "One short paragraph explaining the best nearby options for this route segment.",
    },
    places: {
      type: "array",
      description: "Up to three grounded nearby place suggestions.",
      minItems: 0,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: {
            type: "string",
            description: "Place name exactly as grounded when possible.",
          },
          reason: {
            type: "string",
            description: "Why this place fits the current route or vibe.",
          },
          distanceNote: {
            type: ["string", "null"],
            description: "Short distance or detour note if grounded or clearly implied.",
          },
          address: {
            type: ["string", "null"],
            description: "Grounded address or area description when available.",
          },
          mapsUri: {
            type: ["string", "null"],
            description: "Google Maps or grounded source URL when available.",
          },
          placeId: {
            type: ["string", "null"],
            description: "Grounded Google Maps place identifier when available.",
          },
          lat: {
            type: ["number", "null"],
            description: "Place latitude when known.",
          },
          lng: {
            type: ["number", "null"],
            description: "Place longitude when known.",
          },
        },
        required: ["name", "reason", "distanceNote", "address", "mapsUri", "placeId", "lat", "lng"],
      },
    },
  },
  required: ["summary", "places"],
};

function getApiKey() {
  return process.env.VERTEX_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
}

function redactSensitive(value) {
  return String(value)
    .replace(/([?&]key=)[^&\s"]+/gi, "$1[redacted]")
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted-api-key]")
    .replace(/-----BEGIN PRIVATE KEY-----[\s\S]*?-----END PRIVATE KEY-----/g, "[redacted-private-key]");
}

function configureCredentialsFile() {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS || !process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON) {
    return;
  }

  const credentialsPath = path.join(os.tmpdir(), "flowlayer-google-adc.json");
  fs.writeFileSync(credentialsPath, process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON, { mode: 0o600 });
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
}

function getAiClient() {
  configureCredentialsFile();

  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || "global";
  const useVertex = process.env.GOOGLE_GENAI_USE_VERTEXAI === "true" || Boolean(project);

  if (useVertex) {
    if (!project) {
      throw new Error("Missing GOOGLE_CLOUD_PROJECT for route radar.");
    }

    return {
      ai: new GoogleGenAI({
        vertexai: true,
        project,
        location,
      }),
      backend: "vertex-ai",
    };
  }

  const apiKey = getApiKey();
  if (apiKey) {
    return {
      ai: new GoogleGenAI({ apiKey }),
      backend: process.env.VERTEX_API_KEY ? "vertex-api-key" : "gemini-api-key",
    };
  }

  throw new Error("Missing VERTEX_API_KEY or GOOGLE_CLOUD_PROJECT for route radar.");
}

function readBody(request) {
  if (request.body !== undefined) {
    return Promise.resolve(
      typeof request.body === "string" ? request.body : JSON.stringify(request.body)
    );
  }

  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large."));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function normalizeSteps(steps) {
  if (!Array.isArray(steps)) return [];
  return steps.slice(0, 12).map((step, index) => ({
    index: index + 1,
    instruction: String(step?.instruction || "").replace(/<[^>]*>/g, "").trim(),
    distance: String(step?.distance || "").trim(),
  })).filter(step => step.instruction || step.distance);
}

function normalizeLatLng(currentLatLng) {
  if (Array.isArray(currentLatLng) && currentLatLng.length >= 2) {
    const longitude = Number(currentLatLng[0]);
    const latitude = Number(currentLatLng[1]);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
  }

  if (currentLatLng && typeof currentLatLng === "object") {
    const latitude = Number(currentLatLng.latitude ?? currentLatLng.lat);
    const longitude = Number(currentLatLng.longitude ?? currentLatLng.lng ?? currentLatLng.lon);
    if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
      return { latitude, longitude };
    }
  }

  return null;
}

function normalizeHeading(heading) {
  const value = Number(heading);
  return Number.isFinite(value) ? Math.round(value) : null;
}

function extractGroundedPlaces(groundingMetadata) {
  const chunks = groundingMetadata?.groundingChunks;
  if (!Array.isArray(chunks)) return [];

  return chunks
    .map(chunk => chunk?.maps)
    .filter(Boolean)
    .map(maps => ({
      name: typeof maps.title === "string" ? maps.title.trim() : "",
      address: typeof maps.formattedAddress === "string" ? maps.formattedAddress.trim() : null,
      mapsUri: typeof maps.uri === "string" ? maps.uri : null,
      placeId: typeof maps.placeId === "string" ? maps.placeId : null,
      lat: Number.isFinite(Number(maps?.location?.latitude ?? maps?.latLng?.latitude))
        ? Number(maps.location?.latitude ?? maps.latLng?.latitude)
        : null,
      lng: Number.isFinite(Number(maps?.location?.longitude ?? maps?.latLng?.longitude))
        ? Number(maps.location?.longitude ?? maps.latLng?.longitude)
        : null,
    }))
    .filter(place => place.name)
    .filter((place, index, places) => places.findIndex(item => item.name === place.name && item.placeId === place.placeId) === index)
    .slice(0, 3);
}

function buildPrompt({ vibeId, latLng, heading, destination, routeName, steps }) {
  const headingText = heading === null ? "unknown" : `${heading} degrees`;
  const positionText = latLng
    ? `Current location: latitude ${latLng.latitude}, longitude ${latLng.longitude}.`
    : "Current location is unavailable.";

  return [
    "Find grounded nearby place suggestions for the driver's current route context.",
    positionText,
    `Current heading: ${headingText}.`,
    `Destination: ${String(destination || "Unknown destination").trim() || "Unknown destination"}.`,
    `Route name: ${String(routeName || "Unnamed route").trim() || "Unnamed route"}.`,
    `Vibe: ${vibeId}.`,
    "Route steps:",
    JSON.stringify(steps),
    "Use Google Maps grounding for the factual place data.",
    "Prefer places that are nearby, directionally plausible, and actually useful for this route moment.",
    "Do not invent names, addresses, or distances. If grounding is weak, return fewer places.",
    "Return JSON only.",
  ].join("\n");
}

function shouldRetryWithFallback(error) {
  const message = String(error?.message || "");
  return /google maps|googlemaps|grounding|tool|response_json_schema|response schema|unsupported|not supported/i.test(message);
}

async function generateRouteRadar({ ai, model, prompt, systemInstruction, latLng }) {
  return ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction,
      temperature: 0.35,
      tools: [{ googleMaps: {} }],
      ...(latLng
        ? {
            toolConfig: {
              retrievalConfig: { latLng },
            },
          }
        : {}),
      responseMimeType: "application/json",
      responseJsonSchema: RESPONSE_SCHEMA,
    },
  });
}

function parseStrictJson(text) {
  const parsed = JSON.parse(text || "{}");
  const summary = typeof parsed.summary === "string" ? parsed.summary.trim() : "";
  const places = Array.isArray(parsed.places) ? parsed.places : [];

  return {
    summary,
    places: places.slice(0, 3).map(place => ({
      name: String(place?.name || "").trim(),
      reason: String(place?.reason || "").trim(),
      distanceNote: place?.distanceNote == null ? null : String(place.distanceNote).trim(),
      address: place?.address == null ? null : String(place.address).trim(),
      mapsUri: place?.mapsUri == null ? null : String(place.mapsUri).trim(),
      placeId: place?.placeId == null ? null : String(place.placeId).trim(),
      lat: place?.lat == null ? null : Number(place.lat),
      lng: place?.lng == null ? null : Number(place.lng),
    })).filter(place => place.name && place.reason),
  };
}

function mergePlaces(modelPlaces, groundedPlaces) {
  const groundedByKey = new Map(
    groundedPlaces.map(place => [`${place.name}::${place.placeId || ""}`, place])
  );

  const merged = modelPlaces.map(place => {
    const directMatch = groundedByKey.get(`${place.name}::${place.placeId || ""}`);
    const fuzzyMatch = directMatch || groundedPlaces.find(item => item.name.toLowerCase() === place.name.toLowerCase());
    const grounded = fuzzyMatch || null;

    return {
      name: grounded?.name || place.name,
      reason: place.reason,
      distanceNote: place.distanceNote || null,
      address: grounded?.address || place.address || null,
      mapsUri: grounded?.mapsUri || place.mapsUri || null,
      placeId: grounded?.placeId || place.placeId || null,
      lat: grounded?.lat ?? place.lat ?? null,
      lng: grounded?.lng ?? place.lng ?? null,
    };
  });

  for (const grounded of groundedPlaces) {
    if (merged.length >= 3) break;
    const exists = merged.some(place => (place.placeId && grounded.placeId && place.placeId === grounded.placeId) || place.name.toLowerCase() === grounded.name.toLowerCase());
    if (!exists) {
      merged.push({
        name: grounded.name,
        reason: "Grounded nearby option surfaced from Google Maps for this route segment.",
        distanceNote: null,
        address: grounded.address,
        mapsUri: grounded.mapsUri,
        placeId: grounded.placeId,
        lat: grounded.lat ?? null,
        lng: grounded.lng ?? null,
      });
    }
  }

  return merged.slice(0, 3);
}

function distanceMeters(a, b) {
  const toRadians = value => value * Math.PI / 180;
  const earth = 6371000;
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  return 2 * earth * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function formatDistanceNote(meters) {
  const miles = meters / 1609.34;
  if (miles < 0.15) return "close now";
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

function buildFallbackRouteRadar({ vibeId, latLng, destination }) {
  const current = latLng || { latitude: 43.6433, longitude: -79.3713 };
  const nearby = TORONTO_FALLBACK_PLACES
    .filter(place => place.vibes.includes(vibeId) || (vibeId === "fastest" && place.vibes.includes("chill")))
    .map(place => {
      const meters = distanceMeters(current, { latitude: place.lat, longitude: place.lng });
      return {
        ...place,
        meters,
      };
    })
    .sort((a, b) => a.meters - b.meters)
    .slice(0, 3)
    .map(place => ({
      name: place.name,
      reason: place.reason,
      distanceNote: formatDistanceNote(place.meters),
      address: place.address,
      mapsUri: null,
      placeId: null,
      lat: place.lat,
      lng: place.lng,
    }));

  return {
    summary: nearby.length
      ? `Using local Toronto fallback data near ${destination || "your route"} while Gemini grounding is unavailable.`
      : "Nearby places are temporarily unavailable.",
    places: nearby,
    groundingMetadata: null,
    fallback: true,
  };
}

export default async function handler(request, response) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  let fallbackContext = null;

  if (request.method !== "POST") {
    response.statusCode = 405;
    response.end(JSON.stringify({ error: "Method not allowed." }));
    return;
  }

  try {
    const payload = JSON.parse(await readBody(request) || "{}");
    const vibeId = SUPPORTED_VIBES.has(payload.vibeId) ? payload.vibeId : "adventure";
    const steps = normalizeSteps(payload.steps);
    const latLng = normalizeLatLng(payload.currentLatLng);
    const heading = normalizeHeading(payload.heading);
    const destination = String(payload.destination || "").trim();
    const routeName = String(payload.routeName || "").trim();
    fallbackContext = { vibeId, currentLatLng: payload.currentLatLng, destination };

    if (!steps.length) {
      response.statusCode = 400;
      response.end(JSON.stringify({ error: "No route steps provided." }));
      return;
    }

    const { ai } = getAiClient();
    const preferredModel = process.env.GEMINI_ROUTE_RADAR_MODEL
      || process.env.VERTEX_ROUTE_RADAR_MODEL
      || process.env.GEMINI_MODEL
      || process.env.VERTEX_MODEL
      || "gemini-3-flash-preview";
    const fallbackModel = process.env.GEMINI_ROUTE_RADAR_FALLBACK_MODEL
      || process.env.VERTEX_ROUTE_RADAR_FALLBACK_MODEL
      || "gemini-2.5-flash";
    const prompt = buildPrompt({ vibeId, latLng, heading, destination, routeName, steps });

    let result;
    let model = preferredModel;

    try {
      result = await generateRouteRadar({
        ai,
        model,
        prompt,
        systemInstruction: VIBE_PROMPTS[vibeId],
        latLng,
      });
    } catch (error) {
      if (!shouldRetryWithFallback(error) || fallbackModel === preferredModel) {
        throw error;
      }

      model = fallbackModel;
      result = await generateRouteRadar({
        ai,
        model,
        prompt,
        systemInstruction: VIBE_PROMPTS[vibeId],
        latLng,
      });
    }

    const groundingMetadata = result.candidates?.[0]?.groundingMetadata || null;
    const groundedPlaces = extractGroundedPlaces(groundingMetadata);
    const parsed = parseStrictJson(result.text);

    response.statusCode = 200;
    response.end(JSON.stringify({
      summary: parsed.summary,
      places: mergePlaces(parsed.places, groundedPlaces),
      groundingMetadata,
    }));
  } catch (error) {
    const message = redactSensitive(error?.message || String(error));
    const resourceExhausted = /RESOURCE_EXHAUSTED|quota|rate limit/i.test(message);
    if (resourceExhausted) {
      const fallbackPayload = fallbackContext || {};
      const fallback = buildFallbackRouteRadar({
        vibeId: SUPPORTED_VIBES.has(fallbackPayload.vibeId) ? fallbackPayload.vibeId : "adventure",
        latLng: normalizeLatLng(fallbackPayload.currentLatLng),
        destination: String(fallbackPayload.destination || "").trim(),
      });
      response.statusCode = 200;
      response.end(JSON.stringify(fallback));
      return;
    }

    response.statusCode = 500;
    response.end(JSON.stringify({
      error: "Route radar failed.",
      detail: message,
    }));
  }
}
