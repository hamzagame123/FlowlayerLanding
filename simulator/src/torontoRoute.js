/**
 * Toronto Route — Real street waypoints for downtown Toronto driving loop.
 * Converts lat/lng waypoints to Three.js local coordinates relative to the Cesium anchor.
 */
import { ANCHOR_LAT, ANCHOR_LNG } from "./cesiumBuildings.js";

const DEG_TO_RAD = Math.PI / 180;
const METERS_PER_DEG_LAT = 111320;
const METERS_PER_DEG_LNG = 111320 * Math.cos(ANCHOR_LAT * DEG_TO_RAD);

/**
 * Downtown Toronto driving loop:
 * Start near CN Tower → north on University Ave → east on Queen St →
 * north on Yonge St → west on Dundas St → south on University → loop
 */
const WAYPOINTS_LATLNG = [
    // 4 Lower Jarvis St, Toronto driving North
    [43.6438, -79.3682], // Lower Jarvis near Queens Quay
    [43.6448, -79.3686], // Lower Jarvis & Lake Shore
    [43.6465, -79.3695], // Lower Jarvis & Front
    [43.6496, -79.3712], // Jarvis & Richmond
    [43.6517, -79.3723], // Jarvis & Queen
    [43.6538, -79.3734], // Jarvis & Shuter
    [43.6562, -79.3746], // Jarvis & Dundas
];

/** Convert lat/lng to local Three.js (x, z) relative to the Cesium anchor. */
function latLngToLocal(lat, lng) {
    const x = (lng - ANCHOR_LNG) * METERS_PER_DEG_LNG;   // east = +X
    const z = -(lat - ANCHOR_LAT) * METERS_PER_DEG_LAT;  // north = -Z
    return { x, z };
}

/** Precompute local coords and cumulative distances. */
function buildRoute(waypoints) {
    const points = waypoints.map(([lat, lng]) => latLngToLocal(lat, lng));
    const distances = [0];
    let totalDist = 0;

    for (let i = 1; i < points.length; i++) {
        const dx = points[i].x - points[i - 1].x;
        const dz = points[i].z - points[i - 1].z;
        totalDist += Math.sqrt(dx * dx + dz * dz);
        distances.push(totalDist);
    }

    return { points, distances, totalLength: totalDist };
}

const route = buildRoute(WAYPOINTS_LATLNG);

/**
 * Get position and heading at a given distance along the route.
 * @param {number} dist — distance in meters along the route (wraps around)
 * @returns {{ x: number, z: number, heading: number }}
 */
export function getRoutePositionAt(dist) {
    const { points, distances, totalLength } = route;

    // Wrap distance for looping
    let d = dist % totalLength;
    if (d < 0) d += totalLength;

    // Find the segment we're on
    let segIdx = 0;
    for (let i = 1; i < distances.length; i++) {
        if (distances[i] >= d) {
            segIdx = i - 1;
            break;
        }
        if (i === distances.length - 1) segIdx = i - 1;
    }

    // Interpolate within segment
    const segStart = distances[segIdx];
    const segEnd = distances[segIdx + 1] || distances[segIdx] + 1;
    const t = Math.min(1, Math.max(0, (d - segStart) / (segEnd - segStart)));

    const p0 = points[segIdx];
    const p1 = points[(segIdx + 1) % points.length];

    const dx = p1.x - p0.x;
    const dz = p1.z - p0.z;

    const x = p0.x + dx * t;
    const z = p0.z + dz * t;

    // Heading: angle from current segment direction (atan2 of dx, dz)
    const heading = Math.atan2(dx, dz) + Math.PI; // angle in XZ plane (adjusted so -Z faces forward)

    // Return exact target coordinates for lookAt binding
    const nx = p0.x + dx * (t + 0.01);
    const nz = p0.z + dz * (t + 0.01);

    return { x, z, heading, targetX: nx, targetZ: nz };
}

/** Total route length in meters. */
export const ROUTE_LENGTH = route.totalLength;

/** Route points for debug visualization. */
export const ROUTE_POINTS = route.points;

/** Convert local (x, z) back to lat/lng for the mini-map. */
export function localToLatLng(x, z) {
    const lat = ANCHOR_LAT - z / METERS_PER_DEG_LAT;
    const lng = ANCHOR_LNG + x / METERS_PER_DEG_LNG;
    return { lat, lng };
}
