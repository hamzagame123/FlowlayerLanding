import { GoogleGenAI } from "@google/genai";

const DEFAULT_LIVE_MODEL = "gemini-3.1-flash-live-preview";

function getApiKey() {
  return process.env.GEMINI_API_KEY || process.env.VERTEX_API_KEY || process.env.GOOGLE_API_KEY || "";
}

function redactSensitive(value) {
  return String(value)
    .replace(/([?&]key=)[^&\s"]+/gi, "$1[redacted]")
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "[redacted-api-key]");
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

function buildSystemInstruction(payload) {
  return [
    "You are FlowLayer Host, a concise voice companion inside a futuristic Toronto driving simulator.",
    "Keep replies short, grounded, and practical for a person about to drive.",
    "Ask one thing at a time and avoid long prose.",
    `Queued driver: ${payload.candidateName || "unknown"}.`,
    `Destination: ${payload.destination || "not set"}.`,
    `Vibe: ${payload.vibeId || "scenic"}.`,
  ].join(" ");
}

export default async function handler(request, response) {
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  if (request.method !== "POST") {
    response.statusCode = 405;
    response.end(JSON.stringify({ error: "Method not allowed." }));
    return;
  }

  try {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error("Missing Gemini API key for Live API token creation.");
    }

    const payload = JSON.parse(await readBody(request) || "{}");
    const model = String(payload.model || process.env.GEMINI_LIVE_MODEL || DEFAULT_LIVE_MODEL).trim() || DEFAULT_LIVE_MODEL;
    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: { apiVersion: "v1alpha" },
    });

    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        newSessionExpireTime: new Date(Date.now() + 60 * 1000).toISOString(),
        expireTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        liveConnectConstraints: {
          model,
          config: {
            responseModalities: ["AUDIO"],
            outputAudioTranscription: {},
          },
        },
      },
    });

    response.statusCode = 200;
    response.end(JSON.stringify({
      token: token.name,
      model,
      systemInstruction: buildSystemInstruction(payload),
      expireTime: token.expireTime || null,
      newSessionExpireTime: token.newSessionExpireTime || null,
    }));
  } catch (error) {
    response.statusCode = 500;
    response.end(JSON.stringify({
      error: "Live token creation failed.",
      detail: redactSensitive(error?.message || String(error)),
    }));
  }
}
