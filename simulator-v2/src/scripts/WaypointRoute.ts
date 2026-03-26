import * as THREE from "three";
import type { Context } from "@needle-tools/engine";
import type { GoogleTilesManager } from "./GoogleTilesManager.js";

interface Waypoint {
    lat: number;
    lng: number;
    alt?: number;
}

interface RouteDefinition {
    name: string;
    description: string;
    waypoints: Waypoint[];
}

const ROUTES: Record<string, RouteDefinition> = {
    coastal: {
        name: "Harbourfront Loop",
        description: "Toronto Waterfront",
        waypoints: [
            { lat: 43.64444326865409, lng: -79.36930438053525 },
            { lat: 43.6428, lng: -79.3668 },
            { lat: 43.6412, lng: -79.3629 },
            { lat: 43.6404, lng: -79.3584 },
            { lat: 43.6409, lng: -79.3537 },
            { lat: 43.6427, lng: -79.3495 },
            { lat: 43.6454, lng: -79.3468 },
        ],
    },
    mountain: {
        name: "Skyline Run",
        description: "Downtown Toronto",
        waypoints: [
            { lat: 43.64444326865409, lng: -79.36930438053525 },
            { lat: 43.6438, lng: -79.3746 },
            { lat: 43.6434, lng: -79.3799 },
            { lat: 43.6440, lng: -79.3848 },
            { lat: 43.6447, lng: -79.3890 },
            { lat: 43.6439, lng: -79.3929 },
        ],
    },
    forest: {
        name: "Ravine Route",
        description: "Don River Edge",
        waypoints: [
            { lat: 43.64444326865409, lng: -79.36930438053525 },
            { lat: 43.6468, lng: -79.3653 },
            { lat: 43.6502, lng: -79.3609 },
            { lat: 43.6533, lng: -79.3574 },
            { lat: 43.6560, lng: -79.3536 },
        ],
    },
};

export class WaypointRoute {
    private context: Context;
    private tilesManager: GoogleTilesManager;
    private scenePoints: THREE.Vector3[] = [];
    private pathLine: THREE.Line | null = null;
    private currentWaypointIndex = 0;
    private totalDistance = 0;
    private distanceCovered = 0;
    private currentRouteId = "";
    private currentRouteName = "";

    constructor(context: Context, tilesManager: GoogleTilesManager) {
        this.context = context;
        this.tilesManager = tilesManager;
    }

    loadRoute(routeId: string) {
        const route = ROUTES[routeId];
        if (!route) {
            console.warn(`[WaypointRoute] Route "${routeId}" not found.`);
            return;
        }

        this.currentRouteId = routeId;
        this.currentRouteName = route.name;
        this.currentWaypointIndex = 0;
        this.distanceCovered = 0;

        if (this.pathLine) {
            this.context.scene.remove(this.pathLine);
            this.pathLine.geometry.dispose();
        }

        this.scenePoints = route.waypoints.map(wp =>
            this.tilesManager.latLngToScene(wp.lat, wp.lng, wp.alt ?? 20)
        );

        this.totalDistance = 0;
        for (let i = 1; i < this.scenePoints.length; i++) {
            this.totalDistance += this.scenePoints[i].distanceTo(this.scenePoints[i - 1]);
        }

        this.drawPath();
    }

    private drawPath() {
        const curvePoints: THREE.Vector3[] = [];

        if (this.scenePoints.length >= 2) {
            const curve = new THREE.CatmullRomCurve3(this.scenePoints, false, "centripetal", 0.5);
            const divisions = Math.max(100, this.scenePoints.length * 30);
            curvePoints.push(...curve.getPoints(divisions));
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(curvePoints);
        const material = new THREE.LineBasicMaterial({
            color: 0x00f5d4,
            transparent: true,
            opacity: 0.7,
            linewidth: 2,
        });

        this.pathLine = new THREE.Line(geometry, material);
        this.pathLine.position.y = 1;
        this.pathLine.renderOrder = 999;
        this.context.scene.add(this.pathLine);
    }

    update(carPosition?: THREE.Vector3) {
        if (!carPosition || this.scenePoints.length === 0) return;

        let closestIdx = 0;
        let closestDist = Infinity;

        for (let i = this.currentWaypointIndex; i < this.scenePoints.length; i++) {
            const d = carPosition.distanceTo(this.scenePoints[i]);
            if (d < closestDist) {
                closestDist = d;
                closestIdx = i;
            }
        }

        if (closestDist < 20 && closestIdx > this.currentWaypointIndex) {
            this.currentWaypointIndex = closestIdx;
        }

        this.distanceCovered = 0;
        for (let i = 1; i <= this.currentWaypointIndex && i < this.scenePoints.length; i++) {
            this.distanceCovered += this.scenePoints[i].distanceTo(this.scenePoints[i - 1]);
        }
    }

    getNextWaypointDirection(carPosition: THREE.Vector3): THREE.Vector3 | null {
        const nextIdx = Math.min(this.currentWaypointIndex + 1, this.scenePoints.length - 1);
        if (nextIdx >= this.scenePoints.length) return null;
        return new THREE.Vector3().subVectors(this.scenePoints[nextIdx], carPosition).normalize();
    }

    getProgress(): number {
        if (this.totalDistance === 0) return 0;
        return Math.min(1, this.distanceCovered / this.totalDistance);
    }

    reloadCurrentRoute() {
        if (this.currentRouteId) this.loadRoute(this.currentRouteId);
    }

    getRouteName(): string { return this.currentRouteName; }
    getAvailableRoutes() { return ROUTES; }
    isComplete(): boolean { return this.currentWaypointIndex >= this.scenePoints.length - 1; }
}
