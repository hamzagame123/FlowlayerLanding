const CN_TOWER_DESTINATION_REGEX = /\bcn tower\b/i;
const TORONTO_ORIGIN = { lat: 43.6433, lng: -79.3713 };

const PINNED_ROUTE_COORDINATES = [
    [-79.37121, 43.64317],
    [-79.37663, 43.64127],
    [-79.37813, 43.64079],
    [-79.37934, 43.64037],
    [-79.38013, 43.64008],
    [-79.38063, 43.63994],
    [-79.38278, 43.63959],
    [-79.38327, 43.64051],
    [-79.38343, 43.64082],
    [-79.38367, 43.64161],
    [-79.38401, 43.64239],
    [-79.38594, 43.64199],
    [-79.38631, 43.64187],
    [-79.38666, 43.64168],
];

const PINNED_ROUTE_STEPS = [
    {
        distance: "0.6 mi",
        duration: "4 min",
        instruction: "Head southwest on Queens Quay E toward Cooper St",
        startLocation: [-79.3712089, 43.643173],
        endLocation: [-79.3827816, 43.6395925],
        distanceMeters: 1017,
        durationSeconds: 225,
    },
    {
        distance: "0.2 mi",
        duration: "2 min",
        instruction: "Turn right onto Lower Simcoe St",
        startLocation: [-79.3827816, 43.6395925],
        endLocation: [-79.3840129, 43.642394499999995],
        distanceMeters: 328,
        durationSeconds: 108,
    },
    {
        distance: "0.1 mi",
        duration: "1 min",
        instruction: "Turn left onto Bremner Blvd Destination will be on the right",
        startLocation: [-79.3840129, 43.642394499999995],
        endLocation: [-79.3866599, 43.6416836],
        distanceMeters: 229,
        durationSeconds: 62,
    },
];

const PINNED_NARRATION = {
    scenic: "Alright, we're easing onto Queens Quay East, heading southwest toward Cooper Street with the waterfront opening up beside us. Then it's a quick right on Lower Simcoe and a final left onto Bremner Boulevard for the CN Tower approach.",
    chill: "We'll drift along Queens Quay East by the waterfront, take Lower Simcoe north, then slide left onto Bremner for a calm CN Tower arrival.",
    adventure: "We cut southwest along Queens Quay, snap onto Lower Simcoe, then hook left onto Bremner for the CN Tower finish straight ahead.",
    fastest: "Stay direct: southwest on Queens Quay, right on Lower Simcoe, then left on Bremner for the CN Tower approach.",
};

const ROUTE_RADAR_PLACES = [
    {
        name: "Sugar Beach",
        address: "11 Dockside Dr, Toronto",
        lat: 43.638,
        lng: -79.3818,
        vibes: ["scenic", "chill", "fastest"],
        reason: {
            scenic: "Distinctive pink waterfront spot with strong photo energy and a wide harbour read.",
            chill: "Easy waterfront pause with open water, pastel seating, and a softer pace than the core.",
            fastest: "Useful waterfront anchor just off the corridor if you want one quick visual stop.",
            adventure: "Waterfront landmark close to the route with a stylized city-beach atmosphere.",
        },
    },
    {
        name: "Harbourfront Centre",
        address: "235 Queens Quay W, Toronto",
        lat: 43.6373,
        lng: -79.3906,
        vibes: ["scenic", "chill", "adventure"],
        reason: {
            scenic: "Strong skyline and lakefront framing with a clean promenade read.",
            chill: "One of the calmer cultural pockets on the water with room to slow the mood down.",
            adventure: "Active waterfront node that keeps the route feeling urban and event-adjacent.",
            fastest: "Major waterfront anchor close to the CN Tower corridor.",
        },
    },
    {
        name: "Roundhouse Park",
        address: "255 Bremner Blvd, Toronto",
        lat: 43.6418,
        lng: -79.3857,
        vibes: ["scenic", "fastest", "adventure"],
        reason: {
            scenic: "Historic rail yard textures right under the tower make the final approach feel more cinematic.",
            fastest: "Right on the CN Tower finish zone, so it's an efficient landmark for the last turn.",
            adventure: "Rail museum massing and tower proximity add a stronger sense of destination payoff.",
            chill: "Compact parkland near the tower if you want a gentler arrival moment.",
        },
    },
    {
        name: "St. Lawrence Market",
        address: "93 Front St E, Toronto",
        lat: 43.6487,
        lng: -79.3715,
        vibes: ["chill", "adventure", "fastest"],
        reason: {
            chill: "Strong local-food anchor with a grounded Toronto feel if you want the drive to stay human-scale.",
            adventure: "Denser old-core energy with a more textured city read than the open waterfront.",
            fastest: "Central stop with quick city access and a strong local anchor near the origin.",
            scenic: "Historic market streets add city texture near the route origin.",
        },
    },
];

function isFiniteLatLng(value) {
    return value && Number.isFinite(Number(value.lat)) && Number.isFinite(Number(value.lng));
}

function normalizeDestination(destination) {
    return String(destination || "").trim();
}

function distanceMeters(from, to) {
    const earthRadius = 6371000;
    const lat1 = Number(from.lat) * Math.PI / 180;
    const lat2 = Number(to.lat) * Math.PI / 180;
    const dLat = (Number(to.lat) - Number(from.lat)) * Math.PI / 180;
    const dLng = (Number(to.lng) - Number(from.lng)) * Math.PI / 180;
    const s1 = Math.sin(dLat / 2);
    const s2 = Math.sin(dLng / 2);
    const h = s1 * s1 + Math.cos(lat1) * Math.cos(lat2) * s2 * s2;
    return 2 * earthRadius * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function formatDistanceNote(meters) {
    const miles = meters / 1609.34;
    if (miles < 0.15) return `${Math.round(meters * 3.28084)} ft`;
    return `${miles.toFixed(miles < 1 ? 1 : 0)} mi`;
}

export function isPinnedCnTowerDestination(destination) {
    return CN_TOWER_DESTINATION_REGEX.test(normalizeDestination(destination));
}

export function matchesPinnedCnTowerOrigin(origin) {
    if (!isFiniteLatLng(origin)) return false;
    return distanceMeters(origin, TORONTO_ORIGIN) < 120;
}

export function getPinnedCnTowerRoute(origin, destination, vibeId = "scenic") {
    if (!isPinnedCnTowerDestination(destination)) return null;
    if (!matchesPinnedCnTowerOrigin(origin)) return null;

    const durationByVibe = {
        scenic: { durationText: "5 mins", durationSeconds: 327 },
        chill: { durationText: "6 mins", durationSeconds: 366 },
        adventure: { durationText: "5 mins", durationSeconds: 333 },
        fastest: { durationText: "4 mins", durationSeconds: 288 },
    };
    const timing = durationByVibe[vibeId] || durationByVibe.scenic;

    return {
        origin: { lat: Number(origin.lat), lng: Number(origin.lng) },
        destination: "CN Tower, Toronto, ON",
        coordinates: PINNED_ROUTE_COORDINATES.map(pair => [...pair]),
        steps: PINNED_ROUTE_STEPS.map(step => ({ ...step, startLocation: [...step.startLocation], endLocation: [...step.endLocation] })),
        distanceText: "1.0 mi",
        durationText: timing.durationText,
        distanceMeters: 1574,
        durationSeconds: timing.durationSeconds,
        pinnedPreset: "cn-tower",
    };
}

export function getPinnedCnTowerNarration(vibeId = "scenic") {
    return PINNED_NARRATION[vibeId] || PINNED_NARRATION.scenic;
}

export function getPinnedCnTowerNarrationAudioUrl(vibeId = "scenic") {
    const safeVibe = ["scenic", "chill", "adventure", "fastest"].includes(vibeId)
        ? vibeId
        : "scenic";
    return `/audio/cn-tower-${safeVibe}.wav`;
}

export function getPinnedCnTowerRadar(currentLatLng, vibeId = "scenic") {
    const current = Array.isArray(currentLatLng) && currentLatLng.length >= 2
        ? { lng: Number(currentLatLng[0]), lat: Number(currentLatLng[1]) }
        : TORONTO_ORIGIN;

    const places = ROUTE_RADAR_PLACES
        .filter(place => place.vibes.includes(vibeId) || place.vibes.includes("scenic"))
        .map(place => {
            const meters = distanceMeters(current, place);
            const reason = place.reason[vibeId] || place.reason.scenic;
            return {
                name: place.name,
                reason,
                distanceNote: formatDistanceNote(meters),
                distanceText: formatDistanceNote(meters),
                address: place.address,
                mapsUri: null,
                placeId: null,
                lat: place.lat,
                lng: place.lng,
                meters,
            };
        })
        .sort((a, b) => a.meters - b.meters)
        .slice(0, 3)
        .map(({ meters, ...place }) => place);

    const summaryByVibe = {
        scenic: "Pinned CN Tower radar is showing the most photogenic waterfront and tower-adjacent stops on this route.",
        chill: "Pinned CN Tower radar is surfacing softer waterfront and market stops close to the route.",
        adventure: "Pinned CN Tower radar is surfacing higher-energy waterfront and tower-side landmarks near the route.",
        fastest: "Pinned CN Tower radar is showing only quick high-value landmarks along the CN Tower corridor.",
    };

    return {
        summary: summaryByVibe[vibeId] || summaryByVibe.scenic,
        places,
        pinnedPreset: "cn-tower",
    };
}

export function getPinnedCnTowerNarrationSignature() {
    return PINNED_ROUTE_STEPS
        .map(step => `${String(step.instruction).toLowerCase()}|${String(step.distance).toLowerCase()}`)
        .join("::");
}
