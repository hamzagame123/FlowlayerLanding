import { getPinnedCnTowerRoute } from "./cnTowerPresets.js";

const ROUTES_API_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
const ROUTE_CACHE_PREFIX = "flowlayer_route_cache_v1";
const ROUTE_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const ROUTES_FIELD_MASK = [
    "routes.distanceMeters",
    "routes.duration",
    "routes.polyline.encodedPolyline",
    "routes.legs.distanceMeters",
    "routes.legs.duration",
    "routes.legs.localizedValues.distance",
    "routes.legs.localizedValues.duration",
    "routes.legs.steps.distanceMeters",
    "routes.legs.steps.staticDuration",
    "routes.legs.steps.navigationInstruction.instructions",
    "routes.legs.steps.localizedValues.distance",
    "routes.legs.steps.startLocation.latLng",
    "routes.legs.steps.endLocation.latLng",
    "routes.legs.steps.polyline.encodedPolyline",
].join(",");

function normalizeWaypoint(point) {
    if (Array.isArray(point) && point.length >= 2) {
        return { lat: Number(point[0]), lng: Number(point[1]) };
    }

    if (typeof point === "string") {
        const [lat, lng] = point.split(",").map(value => Number(value.trim()));
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            return { lat, lng };
        }

        return point.trim();
    }

    if (point && Number.isFinite(point.lat) && Number.isFinite(point.lng)) {
        return { lat: Number(point.lat), lng: Number(point.lng) };
    }

    throw new Error("Unsupported route waypoint format");
}

function normalizeAddressString(value) {
    const text = String(value || "").trim();
    if (!text) return text;
    if (text.includes(",")) return text;

    const knownTorontoPoi = /\b(cn tower|casa loma|high park|woodbine beach|toronto downtown|toronto)\b/i;
    if (knownTorontoPoi.test(text)) return `${text}, Toronto, ON`;

    let normalized = text;
    normalized = normalized.replace(/\bst\b\.?$/i, "Street");
    normalized = normalized.replace(/\bave\b\.?$/i, "Avenue");
    normalized = normalized.replace(/\brd\b\.?$/i, "Road");
    normalized = normalized.replace(/\bdr\b\.?$/i, "Drive");
    normalized = normalized.replace(/\bblvd\b\.?$/i, "Boulevard");

    // Bias short simulator inputs like "351 dupont" or "dupont" to local Toronto search.
    if (/^\d+\s+.+/i.test(normalized)) return `${normalized}, Toronto, ON`;
    if (normalized.split(/\s+/).length <= 4) return `${normalized}, Toronto, ON`;

    return normalized;
}

function serializeWaypoint(point) {
    if (typeof point === "string") {
        return normalizeAddressString(point).toLowerCase();
    }

    return `${Number(point.lat).toFixed(5)},${Number(point.lng).toFixed(5)}`;
}

function getRouteCacheKey(origin, destination, vibeId) {
    return [
        ROUTE_CACHE_PREFIX,
        serializeWaypoint(origin),
        serializeWaypoint(destination),
        String(vibeId || "scenic").toLowerCase(),
    ].join("::");
}

function readCachedRoute(cacheKey) {
    try {
        const raw = localStorage.getItem(cacheKey);
        if (!raw) return null;
        const payload = JSON.parse(raw);
        if (!payload?.savedAt || !payload?.route) return null;
        if (Date.now() - Number(payload.savedAt) > ROUTE_CACHE_TTL_MS) {
            localStorage.removeItem(cacheKey);
            return null;
        }
        return payload.route;
    } catch {
        return null;
    }
}

function writeCachedRoute(cacheKey, route) {
    try {
        localStorage.setItem(cacheKey, JSON.stringify({
            savedAt: Date.now(),
            route,
        }));
    } catch {
        // Ignore storage failures; live API fetch already succeeded.
    }
}

function toWaypoint(point) {
    const normalized = normalizeWaypoint(point);
    if (typeof normalized === "string") {
        return { address: normalizeAddressString(normalized) };
    }

    return {
        location: {
            latLng: {
                latitude: normalized.lat,
                longitude: normalized.lng,
            },
        },
    };
}

function buildRouteModifiers(vibeId) {
    if (vibeId === "chill") {
        return { avoidHighways: true };
    }

    if (vibeId === "scenic") {
        return { avoidHighways: true, avoidTolls: true };
    }

    return {};
}

function buildRequest(origin, destination, vibeId) {
    return {
        origin: toWaypoint(origin),
        destination: toWaypoint(destination),
        travelMode: "DRIVE",
        routingPreference: vibeId === "fastest" ? "TRAFFIC_AWARE_OPTIMAL" : "TRAFFIC_AWARE",
        computeAlternativeRoutes: false,
        languageCode: "en-US",
        units: "IMPERIAL",
        routeModifiers: buildRouteModifiers(vibeId),
    };
}

function parseDurationSeconds(durationValue) {
    if (typeof durationValue === "number") return durationValue;
    const match = String(durationValue || "").match(/^([0-9.]+)s$/);
    return match ? Number(match[1]) : 0;
}

function formatDurationText(totalSeconds) {
    const seconds = Math.max(0, Math.round(totalSeconds));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);

    if (hours > 0) {
        return `${hours} hr${hours === 1 ? "" : "s"} ${minutes} min`;
    }

    return `${Math.max(minutes, 1)} min`;
}

function formatDistanceText(distanceMeters) {
    const miles = distanceMeters / 1609.34;
    if (miles < 0.1) {
        return `${Math.round(distanceMeters * 3.28084)} ft`;
    }
    if (miles < 10) {
        return `${miles.toFixed(1)} mi`;
    }
    return `${Math.round(miles)} mi`;
}

function decodePolyline(encoded) {
    const coordinates = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
        let result = 0;
        let shift = 0;
        let byte;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        const deltaLat = (result & 1) ? ~(result >> 1) : (result >> 1);
        lat += deltaLat;

        result = 0;
        shift = 0;
        do {
            byte = encoded.charCodeAt(index++) - 63;
            result |= (byte & 0x1f) << shift;
            shift += 5;
        } while (byte >= 0x20);
        const deltaLng = (result & 1) ? ~(result >> 1) : (result >> 1);
        lng += deltaLng;

        coordinates.push([lng / 1e5, lat / 1e5]);
    }

    return coordinates;
}

function getLatLngFromWaypoint(waypoint) {
    const latLng = waypoint?.latLng || waypoint?.location?.latLng;
    if (!latLng) return null;

    return [Number(latLng.longitude), Number(latLng.latitude)];
}

function normalizeStep(step) {
    const distanceMeters = Number(step?.distanceMeters || 0);
    const durationSeconds = parseDurationSeconds(step?.staticDuration);
    const polyline = step?.polyline?.encodedPolyline;
    const path = polyline ? decodePolyline(polyline) : [];

    return {
        distance: step?.localizedValues?.distance?.text || formatDistanceText(distanceMeters),
        duration: formatDurationText(durationSeconds),
        instruction: String(step?.navigationInstruction?.instructions || "").replace(/<[^>]*>?/gm, ""),
        startLocation: getLatLngFromWaypoint(step?.startLocation) || path[0] || null,
        endLocation: getLatLngFromWaypoint(step?.endLocation) || path[path.length - 1] || null,
        distanceMeters,
        durationSeconds,
    };
}

export async function fetchGoogleDirectionsRoute(origin, destination, vibeId = "scenic") {
    const normalizedOrigin = normalizeWaypoint(origin);
    const normalizedDestination = normalizeWaypoint(destination);
    const pinnedRoute = getPinnedCnTowerRoute(
        typeof normalizedOrigin === "string" ? null : normalizedOrigin,
        normalizedDestination,
        vibeId
    );
    const cacheKey = getRouteCacheKey(normalizedOrigin, normalizedDestination, vibeId);
    if (pinnedRoute) {
        writeCachedRoute(cacheKey, pinnedRoute);
        return pinnedRoute;
    }
    const cachedRoute = readCachedRoute(cacheKey);
    if (cachedRoute) {
        return cachedRoute;
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
        throw new Error("Google Maps API key not configured");
    }

    const response = await fetch(ROUTES_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": ROUTES_FIELD_MASK,
        },
        body: JSON.stringify(buildRequest(normalizedOrigin, normalizedDestination, vibeId)),
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Routes API request failed (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    const route = data.routes?.[0];
    const leg = route?.legs?.[0];
    if (!route || !leg) {
        throw new Error("Routes API returned no routes");
    }

    const coordinates = decodePolyline(route.polyline?.encodedPolyline || "");
    const steps = (leg.steps || []).map(normalizeStep).filter(step => step.startLocation && step.endLocation);
    const distanceMeters = Number(route.distanceMeters ?? leg.distanceMeters ?? 0);
    const durationSeconds = parseDurationSeconds(route.duration ?? leg.duration);

    const routePayload = {
        origin: typeof normalizedOrigin === "string"
            ? { lat: NaN, lng: NaN }
            : normalizedOrigin,
        destination: normalizedDestination,
        coordinates,
        steps,
        distanceText: leg?.localizedValues?.distance?.text || formatDistanceText(distanceMeters),
        durationText: leg?.localizedValues?.duration?.text || formatDurationText(durationSeconds),
        distanceMeters,
        durationSeconds,
    };

    writeCachedRoute(cacheKey, routePayload);
    return routePayload;
}
