import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";

const SUPPORTED_VIBES = new Set(["scenic", "chill", "adventure", "fastest"]);

const VIBE_PROMPTS = {
  scenic: `You are The Archivist, a warm urban historian narrating a live city drive. Use grounded, concrete details when available. Do not invent facts. Keep the response to 2-3 polished sentences.`,
  chill: `You are Pulse, a relaxed local culture guide narrating a calm city drive. Mention real nearby places only when grounded. Keep the response mellow and concise.`,
  adventure: `You are The Director, a cinematic neo-noir narrator treating the drive like a film sequence. Use sensory detail and tight pacing. Keep the response to 2-3 sentences.`,
  fastest: `You are The Optimizer, a precise telemetry copilot. Give short tactical driving guidance with no poetry or filler.`,
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
      throw new Error("Missing GOOGLE_CLOUD_PROJECT for Vertex AI narration.");
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

  throw new Error("Missing VERTEX_API_KEY or GOOGLE_CLOUD_PROJECT for AI narration.");
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

function getLatLngConfig(currentLatLng) {
  if (!Array.isArray(currentLatLng) || currentLatLng.length < 2) return null;

  const longitude = Number(currentLatLng[0]);
  const latitude = Number(currentLatLng[1]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return { latitude, longitude };
}

export default async function handler(request, response) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  if (request.method !== "POST") {
    response.statusCode = 405;
    response.end(JSON.stringify({ error: "Method not allowed." }));
    return;
  }

  try {
    const payload = JSON.parse(await readBody(request) || "{}");
    const vibe = SUPPORTED_VIBES.has(payload.vibeId) ? payload.vibeId : "adventure";
    const steps = normalizeSteps(payload.steps);
    const currentLatLng = Array.isArray(payload.currentLatLng) ? payload.currentLatLng : null;
    const model = vibe === "fastest"
      ? (process.env.GEMINI_FAST_MODEL || process.env.VERTEX_FAST_MODEL || "gemini-2.5-flash")
      : (process.env.GEMINI_NARRATION_MODEL || process.env.VERTEX_NARRATION_MODEL || "gemini-2.5-flash");

    if (!steps.length) {
      response.statusCode = 400;
      response.end(JSON.stringify({ error: "No route steps provided." }));
      return;
    }

    const { ai, backend } = getAiClient();
    const latLng = getLatLngConfig(currentLatLng);
    const locationText = currentLatLng
      ? `Current approximate position: longitude ${currentLatLng[0]}, latitude ${currentLatLng[1]}.`
      : "Current exact position is unavailable.";

    const result = await ai.models.generateContent({
      model,
      contents: [
        locationText,
        "Route steps:",
        JSON.stringify(steps),
        "Use Google Maps grounding when it helps verify nearby streets or places.",
        "Write the next narration block for the driver. Do not return JSON.",
      ].join("\n"),
      config: {
        systemInstruction: VIBE_PROMPTS[vibe],
        temperature: vibe === "fastest" ? 0.2 : 0.7,
        tools: [{ googleMaps: {} }],
        ...(latLng
          ? {
              toolConfig: {
                retrievalConfig: { latLng },
              },
            }
          : {}),
      },
    });

    response.statusCode = 200;
    response.end(JSON.stringify({
      text: result.text || "",
      model,
      backend,
      groundingMetadata: result.candidates?.[0]?.groundingMetadata || null,
    }));
  } catch (error) {
    response.statusCode = 500;
    response.end(JSON.stringify({
      error: "Vertex narration failed.",
      detail: redactSensitive(error?.message || String(error)),
    }));
  }
}
