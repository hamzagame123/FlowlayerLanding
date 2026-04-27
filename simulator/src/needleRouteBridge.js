import * as THREE from "three";

/**
 * Route/minimap bridge for a Needle + 3DTilesRendererJS runtime.
 *
 * It preserves the existing /simulator contract:
 * - routes stay in [lng, lat]
 * - minimap consumes lat/lng + heading
 * - scene uses local projected coordinates
 */
export class NeedleRouteBridge {
    constructor({ runtime, miniMap = null }) {
        this.runtime = runtime;
        this.miniMap = miniMap;
        this.routeData = null;
        this.sceneRoutePoints = [];
    }

    setMiniMap(miniMap) {
        this.miniMap = miniMap;
        if (this.routeData && this.miniMap) {
            this.miniMap.setRoute(this.routeData.coordinates);
        }
    }

    setRoute(routeData, vibeColor = "#00f5d4") {
        this.routeData = routeData;
        this.sceneRoutePoints = this.runtime.routeToScenePoints(routeData.coordinates, 0);
        if (this.miniMap) {
            this.miniMap.setRoute(routeData.coordinates, vibeColor);
        }
        return this.sceneRoutePoints;
    }

    getSceneRoutePoints() {
        return this.sceneRoutePoints.map(point => point.clone());
    }

    getRouteData() {
        return this.routeData;
    }

    updateMiniMapFromScene(position, heading) {
        if (!this.miniMap || !position) return;
        const geo = this.runtime.sceneToLatLng(position);
        this.miniMap.update(geo.lat, geo.lng, heading);
    }

    /**
     * Finds the nearest scene point on the route. Useful when keeping a vehicle glued to the
     * authored Google route while still rendering in a local three.js / Needle scene.
     */
    getNearestRoutePoint(position) {
        if (!this.sceneRoutePoints.length) return null;

        let bestPoint = this.sceneRoutePoints[0];
        let bestDistance = position.distanceToSquared(bestPoint);

        for (let i = 1; i < this.sceneRoutePoints.length; i++) {
            const candidate = this.sceneRoutePoints[i];
            const distance = position.distanceToSquared(candidate);
            if (distance < bestDistance) {
                bestDistance = distance;
                bestPoint = candidate;
            }
        }

        return bestPoint.clone();
    }

    getHeadingFromRouteSegment(index) {
        if (!this.sceneRoutePoints.length) return 0;
        const clamped = Math.max(0, Math.min(index, this.sceneRoutePoints.length - 2));
        const current = this.sceneRoutePoints[clamped];
        const next = this.sceneRoutePoints[clamped + 1];
        const direction = new THREE.Vector3().subVectors(next, current).normalize();
        return Math.atan2(direction.x, -direction.z);
    }
}
