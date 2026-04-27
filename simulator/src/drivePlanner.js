import { GoogleGenAI } from "@google/genai";

import { fetchGoogleRouteCandidates } from "./routeService.js";

const ai = new GoogleGenAI({ apiKey: import.meta.env.VITE_GEMINI_API_KEY });
const SUPPORTED_VIBES = ["scenic", "chill", "adventure", "fastest"];

function stripCodeFence(text) {
    return String(text || "")
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
}

function parseJsonResponse(text) {
    const cleaned = stripCodeFence(text);
    try {
        return JSON.parse(cleaned);
    } catch {
        const start = cleaned.indexOf("{");
        const end = cleaned.lastIndexOf("}");
        if (start >= 0 && end > start) {
            return JSON.parse(cleaned.slice(start, end + 1));
        }
        throw new Error("Could not parse Gemini JSON response");
    }
}

function getProfileSummary(profile) {
    const answers = profile?.answers || {};
    return Object.entries(answers)
        .map(([questionId, value]) => {
            if (!value) return "";
            if (typeof value === "string") return `${questionId}: ${value}`;
            return `${questionId}: ${(value.text || "").trim()} ${(value.tags || []).join(", ")}`.trim();
        })
        .filter(Boolean)
        .join("\n");
}

function clampVibe(value, fallback) {
    return SUPPORTED_VIBES.includes(value) ? value : fallback;
}

function buildRouteSummary(route) {
    return {
        routeIndex: route.routeIndex,
        distanceText: route.distanceText,
        durationText: route.durationText,
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds,
        highwayBias: route.highwayBias,
        stepSample: route.steps.slice(0, 5).map(step => ({
            instruction: step.instruction,
            distance: step.distance,
        })),
    };
}

function heuristicPickRoute(routes, vibeId) {
    const ranked = [...routes].sort((a, b) => {
        if (vibeId === "fastest") {
            return a.durationSeconds - b.durationSeconds;
        }

        if (vibeId === "scenic" || vibeId === "chill") {
            if (a.highwayBias !== b.highwayBias) return a.highwayBias - b.highwayBias;
            return b.distanceMeters - a.distanceMeters;
        }

        if (a.distanceMeters !== b.distanceMeters) return b.distanceMeters - a.distanceMeters;
        return a.durationSeconds - b.durationSeconds;
    });

    return {
        selectedRouteIndex: ranked[0]?.routeIndex || 0,
        confidence: 0.5,
        shouldRetry: false,
        retryVibe: vibeId,
        rationale: "Selected by local heuristic fallback.",
    };
}

async function inferDriveIntent({ profile, currentVibe, destination, selectedRouteName }) {
    const fallback = {
        vibe: clampVibe(currentVibe, "scenic"),
        rationale: "Using current vibe as planning anchor.",
    };

    if (!ai.apiKey) return fallback;

    const profileSummary = getProfileSummary(profile);
    if (!profileSummary) return fallback;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                {
                    role: "user",
                    parts: [{
                        text: [
                            "Infer the best driving vibe for this simulator.",
                            "Return strict JSON with keys: vibe, rationale.",
                            `Allowed vibe values: ${SUPPORTED_VIBES.join(", ")}.`,
                            `Current vibe: ${currentVibe || "none"}.`,
                            `Selected route label: ${selectedRouteName || "none"}.`,
                            `Destination: ${destination || "none"}.`,
                            "Profile answers:",
                            profileSummary,
                        ].join("\n"),
                    }],
                },
            ],
            config: {
                temperature: 0.2,
            },
        });

        const parsed = parseJsonResponse(response.text);
        return {
            vibe: clampVibe(parsed.vibe, fallback.vibe),
            rationale: String(parsed.rationale || fallback.rationale),
        };
    } catch (err) {
        console.warn("[DrivePlanner] Vibe inference fallback:", err);
        return fallback;
    }
}

async function reviewCandidateRoutes({ routes, vibe, destination, profile, currentVibe }) {
    if (!routes.length) {
        return {
            selectedRouteIndex: 0,
            confidence: 0,
            shouldRetry: false,
            retryVibe: vibe,
            rationale: "No routes available to review.",
        };
    }

    if (!ai.apiKey) {
        return heuristicPickRoute(routes, vibe);
    }

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [
                {
                    role: "user",
                    parts: [{
                        text: [
                            "You are selecting the best driving route for a simulator.",
                            "Pick the route that best matches the intended emotional vibe while still making practical sense.",
                            "Return strict JSON with keys:",
                            "selectedRouteIndex, confidence, shouldRetry, retryVibe, rationale.",
                            `Allowed retryVibe values: ${SUPPORTED_VIBES.join(", ")}.`,
                            `Intended vibe: ${vibe}.`,
                            `Current UI vibe: ${currentVibe || vibe}.`,
                            `Destination: ${destination}.`,
                            "Optional profile context:",
                            getProfileSummary(profile) || "No onboarding answers available.",
                            "Candidate routes:",
                            JSON.stringify(routes.map(buildRouteSummary), null, 2),
                        ].join("\n"),
                    }],
                },
            ],
            config: {
                temperature: 0.2,
            },
        });

        const parsed = parseJsonResponse(response.text);
        return {
            selectedRouteIndex: Number.isFinite(parsed.selectedRouteIndex) ? parsed.selectedRouteIndex : 0,
            confidence: Number(parsed.confidence || 0),
            shouldRetry: Boolean(parsed.shouldRetry),
            retryVibe: clampVibe(parsed.retryVibe, vibe),
            rationale: String(parsed.rationale || ""),
        };
    } catch (err) {
        console.warn("[DrivePlanner] Route review fallback:", err);
        return heuristicPickRoute(routes, vibe);
    }
}

export async function planDriveRoute({
    origin,
    destination,
    currentVibe = "scenic",
    profile = null,
    selectedRouteName = "",
    testingBypass = false,
}) {
    if (testingBypass) {
        const candidatesResponse = await fetchGoogleRouteCandidates(origin, destination, currentVibe);
        return {
            route: candidatesResponse.routes[0],
            routes: candidatesResponse.routes,
            planning: {
                inferredVibe: currentVibe,
                planningVibe: currentVibe,
                vibeRationale: "Testing bypass active.",
                routeRationale: "",
                routeConfidence: 1,
            },
        };
    }

    const inferred = await inferDriveIntent({
        profile,
        currentVibe,
        destination,
        selectedRouteName,
    });

    let planningVibe = inferred.vibe;
    let candidatesResponse = await fetchGoogleRouteCandidates(origin, destination, planningVibe);
    let review = await reviewCandidateRoutes({
        routes: candidatesResponse.routes,
        vibe: planningVibe,
        destination,
        profile,
        currentVibe,
    });

    if (review.shouldRetry && review.retryVibe !== planningVibe) {
        planningVibe = review.retryVibe;
        candidatesResponse = await fetchGoogleRouteCandidates(origin, destination, planningVibe);
        review = await reviewCandidateRoutes({
            routes: candidatesResponse.routes,
            vibe: planningVibe,
            destination,
            profile,
            currentVibe,
        });
    }

    const selected = candidatesResponse.routes.find(route => route.routeIndex === review.selectedRouteIndex)
        || candidatesResponse.routes[0];

    return {
        route: selected,
        routes: candidatesResponse.routes,
        planning: {
            inferredVibe: inferred.vibe,
            planningVibe,
            vibeRationale: inferred.rationale,
            routeRationale: review.rationale,
            routeConfidence: review.confidence,
        },
    };
}
