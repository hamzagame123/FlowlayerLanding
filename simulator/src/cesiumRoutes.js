import { fetchGoogleDirectionsRoute } from "./routeService.js";

/**
 * Fetch a route from Google Directions Service (JS SDK)
 * Returns processed coordinates and steps.
 */
export function fetchDirectionsRoute(origin, destination, vibeId) {
    return fetchGoogleDirectionsRoute(origin, destination, vibeId).then(routeData => {
        console.log(`[CesiumRoutes] JS SDK Route success: ${routeData.distanceText}, ${routeData.durationText}`);
        return routeData;
    });
}

/** Convert [lng, lat] coordinate arrays into a sampled position property over time.
 * SUBDIVIDED for maximum smoothness and jitter reduction.
 */
export function buildSampledRoute(Cesium, coordinates, speedMps = 18, groundAltitude = 76) {
    const positionProperty = new Cesium.SampledPositionProperty();
    
    // Low-degree Hermite interpolation provides the smoothest path between samples
    positionProperty.setInterpolationOptions({
        interpolationDegree: 2,
        interpolationAlgorithm: Cesium.HermitePolynomialApproximation
    });

    const start = Cesium.JulianDate.now();
    let currentTime = start.clone();

    const SUBDIVIDE_THRESHOLD_METERS = 5; // Add a sample every 5 meters for dense tracking

    // Initial point
    positionProperty.addSample(currentTime, Cesium.Cartesian3.fromDegrees(coordinates[0][0], coordinates[0][1], groundAltitude));

    for (let i = 1; i < coordinates.length; i++) {
        const prev = coordinates[i-1];
        const next = coordinates[i];
        
        const p0 = Cesium.Cartesian3.fromDegrees(prev[0], prev[1], groundAltitude);
        const p1 = Cesium.Cartesian3.fromDegrees(next[0], next[1], groundAltitude);
        const dist = Cesium.Cartesian3.distance(p0, p1);
        
        const numSteps = Math.max(1, Math.ceil(dist / SUBDIVIDE_THRESHOLD_METERS));
        const stepTime = (dist / numSteps) / speedMps;
        
        for (let j = 1; j <= numSteps; j++) {
            currentTime = Cesium.JulianDate.addSeconds(currentTime, stepTime, new Cesium.JulianDate());
            const lerpP = Cesium.Cartesian3.lerp(p0, p1, j / numSteps, new Cesium.Cartesian3());
            positionProperty.addSample(currentTime, lerpP);
        }
    }

    return { positionProperty, start, stop: currentTime };
}
