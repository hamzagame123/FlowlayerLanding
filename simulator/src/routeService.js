const ROUTES_API_URL = "https://routes.googleapis.com/directions/v2:computeRoutes";
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

function toWaypoint(point) {
    const normalized = normalizeWaypoint(point);
    if (typeof normalized === "string") {
        return { address: normalized };
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

function getApiKey() {
    const envKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (envKey) return envKey;

    const script = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (!script) return "";

    try {
        const url = new URL(script.src);
        return url.searchParams.get("key") || "";
    } catch {
        return "";
    }
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

function buildRequest(origin, destination, vibeId, options = {}) {
    const body = {
        origin: toWaypoint(origin),
        destination: toWaypoint(destination),
        travelMode: "DRIVE",
        routingPreference: vibeId === "fastest" ? "TRAFFIC_AWARE_OPTIMAL" : "TRAFFIC_AWARE",
        computeAlternativeRoutes: options.computeAlternatives !== false,
        languageCode: "en-US",
        units: "IMPERIAL",
        routeModifiers: buildRouteModifiers(vibeId),
    };

    if (options.intermediates?.length) {
        body.intermediates = options.intermediates.map(toWaypoint);
    }

    return body;
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
        const feet = Math.round(distanceMeters * 3.28084);
        return `${feet} ft`;
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
        duration: step?.localizedValues?.staticDuration?.text || formatDurationText(durationSeconds),
        instruction: String(step?.navigationInstruction?.instructions || "").replace(/<[^>]*>?/gm, ""),
        startLocation: getLatLngFromWaypoint(step?.startLocation) || path[0] || null,
        endLocation: getLatLngFromWaypoint(step?.endLocation) || path[path.length - 1] || null,
        distanceMeters,
        durationSeconds,
        path,
    };
}

function summarizeHighwayBias(steps) {
    const highwayPattern = /\b(hwy|highway|expressway|freeway|ramp|gardiner|dvp|401|qew)\b/i;
    return steps.reduce((count, step) => (
        highwayPattern.test(step.instruction || "") ? count + 1 : count
    ), 0);
}

function normalizeRoute(route, origin, destination, vibeId, routeIndex) {
    const leg = route?.legs?.[0];
    const polyline = route?.polyline?.encodedPolyline;
    const coordinates = polyline ? decodePolyline(polyline) : [];
    const steps = (leg?.steps || []).map(normalizeStep).filter(step => step.startLocation && step.endLocation);
    const distanceMeters = Number(route?.distanceMeters ?? leg?.distanceMeters ?? 0);
    const durationSeconds = parseDurationSeconds(route?.duration ?? leg?.duration);

    return {
        routeIndex,
        origin,
        destination,
        vibeId,
        coordinates,
        steps,
        distanceText: leg?.localizedValues?.distance?.text || formatDistanceText(distanceMeters),
        durationText: leg?.localizedValues?.duration?.text || formatDurationText(durationSeconds),
        distanceMeters,
        durationSeconds,
        highwayBias: summarizeHighwayBias(steps),
    };
}

async function requestRoutes(origin, destination, vibeId = "scenic", options = {}) {
    const apiKey = getApiKey();
    if (!apiKey) {
        throw new Error("Google Maps API key not configured");
    }

    const normalizedOrigin = normalizeWaypoint(origin);
    const normalizedDestination = normalizeWaypoint(destination);
    const response = await fetch(ROUTES_API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": apiKey,
            "X-Goog-FieldMask": ROUTES_FIELD_MASK,
        },
        body: JSON.stringify(buildRequest(normalizedOrigin, normalizedDestination, vibeId, options)),
    });

    if (!response.ok) {
        const body = await response.text();
        throw new Error(`Routes API request failed (${response.status}): ${body}`);
    }

    const data = await response.json();
    const routes = (data.routes || []).map((route, routeIndex) => normalizeRoute(
        route,
        typeof normalizedOrigin === "string" ? { lat: NaN, lng: NaN } : normalizedOrigin,
        normalizedDestination,
        vibeId,
        routeIndex
    ));

    if (!routes.length) {
        throw new Error("Routes API returned no routes");
    }

    return routes;
}

export async function fetchGoogleRouteCandidates(origin, destination, vibeId = "scenic", options = {}) {
    const routes = await requestRoutes(origin, destination, vibeId, options);
    return { routes };
}

export async function fetchGoogleDirectionsRoute(origin, destination, vibeId = "scenic", options = {}) {
    const routes = await requestRoutes(origin, destination, vibeId, options);
    return routes[0];
}
