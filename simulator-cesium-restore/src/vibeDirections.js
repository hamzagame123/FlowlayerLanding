import { getPinnedCnTowerNarration, getPinnedCnTowerNarrationSignature } from "./cnTowerPresets.js";

/**
 * Browser bridge for route narration.
 *
 * AI keys stay server-side, so the simulator calls an API endpoint
 * instead of shipping model credentials to the browser bundle.
 */

const DEFAULT_NARRATION_ENDPOINT = "/api/vertex-narrate";
const NARRATION_CACHE_PREFIX = "flowlayer_narration_cache_v1";
const NARRATION_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function getNarrationEndpoint() {
    return import.meta.env.VITE_VERTEX_NARRATE_ENDPOINT ||
        DEFAULT_NARRATION_ENDPOINT;
}

function fallbackNarration(steps) {
    const firstStep = steps?.[0];
    const instruction = String(firstStep?.instruction || "").replace(/<[^>]*>/g, "").trim();
    const distance = firstStep?.distance ? ` for ${firstStep.distance}` : "";
    return instruction ? `${instruction}${distance}.` : "Continue along the active route.";
}

function normalizeInstruction(value) {
    return String(value || "")
        .replace(/<[^>]*>/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function getNarrationCacheKey(steps, vibeId) {
    const signature = (steps || [])
        .slice(0, 6)
        .map(step => `${normalizeInstruction(step?.instruction)}|${String(step?.distance || "").trim().toLowerCase()}`)
        .join("::");

    return `${NARRATION_CACHE_PREFIX}::${String(vibeId || "scenic").toLowerCase()}::${signature}`;
}

function readCachedNarration(cacheKey) {
    try {
        const raw = localStorage.getItem(cacheKey);
        if (!raw) return null;
        const payload = JSON.parse(raw);
        if (!payload?.text || !payload?.savedAt) return null;
        if (Date.now() - Number(payload.savedAt) > NARRATION_CACHE_TTL_MS) {
            localStorage.removeItem(cacheKey);
            return null;
        }
        return String(payload.text).trim();
    } catch {
        return null;
    }
}

function writeCachedNarration(cacheKey, text) {
    try {
        localStorage.setItem(cacheKey, JSON.stringify({
            savedAt: Date.now(),
            text,
        }));
    } catch {
        // Ignore cache write failures.
    }
}

/**
 * Augments the current driving route using the server-side AI narration endpoint.
 * @param {Array} steps - Route step objects from Google Routes.
 * @param {string} vibeId - 'scenic', 'chill', 'adventure', or 'fastest'.
 * @param {Array} currentLatLng - [lng, lat] current position.
 * @param {Function} onStreamTick - Callback kept for compatibility; called once.
 * @returns {Promise<string>}
 */
export async function augmentDirectionsWithGemini(steps, vibeId, currentLatLng, onStreamTick) {
    const cacheKey = getNarrationCacheKey(steps, vibeId);
    const cachedText = readCachedNarration(cacheKey);
    if (cachedText) {
        if (onStreamTick) onStreamTick(cachedText);
        return cachedText;
    }

    const signature = (steps || [])
        .slice(0, 6)
        .map(step => `${normalizeInstruction(step?.instruction)}|${String(step?.distance || "").trim().toLowerCase()}`)
        .join("::");

    if (signature === getPinnedCnTowerNarrationSignature()) {
        const text = getPinnedCnTowerNarration(vibeId);
        writeCachedNarration(cacheKey, text);
        if (onStreamTick) onStreamTick(text);
        return text;
    }

    try {
        const response = await fetch(getNarrationEndpoint(), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                steps,
                vibeId,
                currentLatLng,
            }),
        });

        if (!response.ok) {
            const body = await response.text();
            throw new Error(`Narration endpoint failed (${response.status}): ${body}`);
        }

        const payload = await response.json();
        const text = String(payload.text || "").trim() || fallbackNarration(steps);
        writeCachedNarration(cacheKey, text);
        if (onStreamTick) onStreamTick(text);
        return text;
    } catch (err) {
        console.warn("[VibeDirections] AI narration unavailable:", err);
        const text = fallbackNarration(steps);
        if (onStreamTick) onStreamTick(text);
        return text;
    }
}
