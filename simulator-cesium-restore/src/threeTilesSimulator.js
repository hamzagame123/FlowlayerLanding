import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import { NeedleTilesRuntime } from "./needleTilesRuntime.js";
import { NeedleRouteBridge } from "./needleRouteBridge.js";
import { fetchGoogleDirectionsRoute } from "./routeService.js";

function distanceBetween(a, b) {
    return a.distanceTo(b);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

export class ThreeTilesSimulator {
    constructor(containerId, apiToken) {
        this.containerId = containerId;
        this.apiToken = apiToken;
        this.container = null;

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = null;

        this.runtime = null;
        this.routeBridge = null;

        this.carRoot = null;
        this.carModel = null;
        this.routeLine = null;
        this.roadLines = [];

        this.currentVibe = "scenic";
        this.currentDestination = "351 Davenport Road, Toronto, ON";
        this.currentRouteName = "Toronto Downtown";
        this.pendingEnvironment = null;
        this.routeData = null;
        this.routeScenePoints = [];
        this.routeSegmentLengths = [];
        this.routeLengthMeters = 0;
        this.routeProgressMeters = 0;
        this.routeDurationSeconds = 0;

        this.isDriving = false;
        this._isManualDrive = false;
        this._manualSpeed = 0;
        this._manualHeading = 0;

        this._speedMph = 0;
        this._distanceMiles = 0;
        this._driveElapsedSeconds = 0;
        this._driveStartTimestamp = null;
        this._lastFrameTime = 0;
        this._rafId = null;

        this.cameraMode = "chase";
        this._keysPressed = new Set();
        this._orbit = {
            theta: 0,
            phi: Math.PI / 4.2,
            radius: 85,
            dragging: false,
            pointerId: -1,
            lastX: 0,
            lastY: 0,
        };

        this._advanceNavCards = null;
        this.miniMap = null;

        this._setupKeyboardListeners();
    }

    async init(vibeId = "scenic") {
        this.currentVibe = vibeId;
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            throw new Error(`Missing container #${this.containerId}`);
        }

        this.container.innerHTML = "";
        this._createThreeScene();
        this._setupPointerControls();

        this.runtime = new NeedleTilesRuntime({
            scene: this.scene,
            camera: this.camera,
            renderer: this.renderer,
            apiToken: this.apiToken,
        });
        this.runtime.init();
        this.routeBridge = new NeedleRouteBridge({ runtime: this.runtime, miniMap: this.miniMap });

        this._createFallbackGround();
        this._createLights();
        this._createCarRoot();
        this._loadCarModel();
        await this._createRoadNetwork();

        const initialEnvironment = this.pendingEnvironment ?? this.currentDestination;
        this.pendingEnvironment = null;
        this.setEnvironment(initialEnvironment);
        this.setVibe(vibeId);
        this._positionCameraInitial();
        this._startLoop();
        window.addEventListener("resize", this._handleResize);
    }

    _createThreeScene() {
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color("#050508");

        const { clientWidth, clientHeight } = this.container;
        this.camera = new THREE.PerspectiveCamera(52, clientWidth / Math.max(clientHeight, 1), 0.1, 5000000);
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        this.renderer.setPixelRatio(window.devicePixelRatio || 1);
        this.renderer.setSize(clientWidth, clientHeight, false);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.container.appendChild(this.renderer.domElement);
        this.clock = new THREE.Clock();
    }

    _createFallbackGround() {
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(20000, 20000),
            new THREE.MeshStandardMaterial({ color: 0x090b12, roughness: 0.95, metalness: 0.02 })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.scene.add(ground);
    }

    _createLights() {
        const ambient = new THREE.AmbientLight(0x7d89a8, 0.65);
        this.scene.add(ambient);

        const key = new THREE.DirectionalLight(0xffd2a8, 1.25);
        key.position.set(180, 240, 120);
        this.scene.add(key);
    }

    _createCarRoot() {
        this.carRoot = new THREE.Group();
        this.carRoot.name = "FlowLayerCar";

        const body = new THREE.Mesh(
            new THREE.BoxGeometry(2.1, 1.0, 4.5),
            new THREE.MeshStandardMaterial({ color: 0x191d2c, roughness: 0.35, metalness: 0.7 })
        );
        body.position.y = 0.7;
        body.castShadow = true;
        body.receiveShadow = true;
        this.carRoot.add(body);

        this.scene.add(this.carRoot);
    }

    _loadCarModel() {
        const loader = new GLTFLoader();
        loader.load(
            "/classic_muscle_car.glb",
            gltf => {
                const model = gltf.scene;
                const bounds = new THREE.Box3().setFromObject(model);
                const size = bounds.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z) || 1;
                const scale = 4.2 / maxDim;
                model.scale.setScalar(scale);
                model.position.y = 0.05;
                model.traverse(child => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        child.receiveShadow = true;
                    }
                });
                this.carModel = model;
                this.carRoot.add(model);
            },
            undefined,
            err => {
                console.warn("[ThreeTilesSim] Could not load car model:", err);
            }
        );
    }

    async _createRoadNetwork() {
        try {
            const roadsUrl = `${import.meta.env.BASE_URL || "/"}toronto_roads.json`;
            const res = await fetch(roadsUrl);
            const data = await res.json();
            const palette = this._getVibePalette(this.currentVibe);

            data.roads.slice(0, 2000).forEach(road => {
                if (!road.coords || road.coords.length < 2) return;
                const points = road.coords.map(([lng, lat]) => this.runtime.latLngToScene(lat, lng, this.runtime.anchor.alt + 0.2));
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const material = new THREE.LineBasicMaterial({
                    color: ["motorway", "trunk", "primary", "secondary"].includes(road.type) ? palette.majorRoad : palette.road,
                    transparent: true,
                    opacity: ["motorway", "trunk", "primary", "secondary"].includes(road.type) ? 0.75 : 0.38,
                });
                const line = new THREE.Line(geometry, material);
                line.renderOrder = 2;
                this.roadLines.push(line);
                this.scene.add(line);
            });
        } catch (err) {
            console.warn("[ThreeTilesSim] Could not load road data:", err);
        }
    }

    async loadRoute(origin, destination, vibeId = this.currentVibe) {
        const resolvedOrigin = origin?.lat != null ? origin : this.runtime.getAnchor();
        this.currentDestination = destination;

        try {
            const routeData = await fetchGoogleDirectionsRoute(resolvedOrigin, destination, vibeId);
            this.routeData = routeData;
            this.routeBridge.setMiniMap(this.miniMap);
            this.routeScenePoints = this.routeBridge.setRoute(routeData, this._getVibePalette(vibeId).route)
                .map(point => point.clone());
            this._rebuildRouteMetrics();
            this._drawActiveRoute(vibeId);
            this._placeCarAtRouteStart();

            window.dispatchEvent(new CustomEvent("routeLoaded", {
                detail: {
                    origin: routeData.origin,
                    destination,
                    coordinates: routeData.coordinates,
                    steps: routeData.steps,
                    distanceText: routeData.distanceText,
                    durationText: routeData.durationText,
                    distanceMeters: routeData.distanceMeters,
                    durationSeconds: routeData.durationSeconds,
                    startLocation: [routeData.origin.lng, routeData.origin.lat],
                }
            }));
        } catch (err) {
            console.error("[ThreeTilesSim] Failed to load route:", err);
            this.routeData = {
                origin: resolvedOrigin,
                destination,
                coordinates: [
                    [resolvedOrigin.lng, resolvedOrigin.lat],
                    [-79.3986, 43.6763],
                ],
                steps: [],
                distanceText: "",
                durationText: "",
                distanceMeters: 0,
                durationSeconds: 0,
            };
            this.routeScenePoints = this.routeBridge.setRoute(this.routeData, this._getVibePalette(vibeId).route)
                .map(point => point.clone());
            this._rebuildRouteMetrics();
            this._drawActiveRoute(vibeId);
            this._placeCarAtRouteStart();
        }
    }

    _rebuildRouteMetrics() {
        this.routeSegmentLengths = [];
        this.routeLengthMeters = 0;
        for (let i = 1; i < this.routeScenePoints.length; i++) {
            const length = distanceBetween(this.routeScenePoints[i - 1], this.routeScenePoints[i]);
            this.routeSegmentLengths.push(length);
            this.routeLengthMeters += length;
        }
        this.routeDurationSeconds = Number(this.routeData?.durationSeconds || Math.max(1, this.routeLengthMeters / 18));
        this.routeProgressMeters = 0;
        this._distanceMiles = 0;
        this._driveElapsedSeconds = 0;
        this._speedMph = 0;
    }

    _drawActiveRoute(vibeId) {
        if (this.routeLine) {
            this.scene.remove(this.routeLine);
            this.routeLine.geometry.dispose();
            this.routeLine.material.dispose();
            this.routeLine = null;
        }

        if (this.routeScenePoints.length < 2) return;

        const geometry = new THREE.BufferGeometry().setFromPoints(this.routeScenePoints);
        const material = new THREE.LineBasicMaterial({
            color: this._getVibePalette(vibeId).route,
            transparent: true,
            opacity: 0.88,
        });
        this.routeLine = new THREE.Line(geometry, material);
        this.routeLine.renderOrder = 10;
        this.scene.add(this.routeLine);
    }

    _placeCarAtRouteStart() {
        const start = this.routeScenePoints[0];
        if (!start) return;
        this.carRoot.position.copy(start);
        const snapped = this.runtime.snapToSurface(this.carRoot.position, 0.9);
        if (snapped) this.carRoot.position.copy(snapped);
        this._manualHeading = this._headingAtProgress(0);
        this.carRoot.rotation.y = this._manualHeading;
        this.routeBridge.updateMiniMapFromScene(this.carRoot.position, this.carRoot.rotation.y);
    }

    _headingAtProgress(progressMeters) {
        if (this.routeScenePoints.length < 2) return this._manualHeading;
        let remaining = progressMeters;
        for (let i = 0; i < this.routeSegmentLengths.length; i++) {
            const segmentLength = this.routeSegmentLengths[i];
            if (remaining <= segmentLength) {
                return this.routeBridge.getHeadingFromRouteSegment(i);
            }
            remaining -= segmentLength;
        }
        return this.routeBridge.getHeadingFromRouteSegment(this.routeSegmentLengths.length - 1);
    }

    _positionAtProgress(progressMeters) {
        if (!this.routeScenePoints.length) return new THREE.Vector3();
        if (this.routeScenePoints.length === 1) return this.routeScenePoints[0].clone();

        let remaining = clamp(progressMeters, 0, this.routeLengthMeters);
        for (let i = 0; i < this.routeSegmentLengths.length; i++) {
            const segmentLength = this.routeSegmentLengths[i];
            if (remaining <= segmentLength || i === this.routeSegmentLengths.length - 1) {
                const from = this.routeScenePoints[i];
                const to = this.routeScenePoints[i + 1];
                const t = segmentLength > 0 ? remaining / segmentLength : 0;
                return from.clone().lerp(to, clamp(t, 0, 1));
            }
            remaining -= segmentLength;
        }
        return this.routeScenePoints[this.routeScenePoints.length - 1].clone();
    }

    startDrive() {
        this.isDriving = true;
        this.routeProgressMeters = 0;
        this._distanceMiles = 0;
        this._driveElapsedSeconds = 0;
        this._speedMph = 0;
        this._driveStartTimestamp = performance.now();
        this._placeCarAtRouteStart();
    }

    endDrive() {
        this.isDriving = false;
        this._speedMph = 0;
    }

    toggleManualDrive() {
        this._isManualDrive = !this._isManualDrive;
        this.isDriving = this._isManualDrive ? true : this.isDriving;
        this.showToast(this._isManualDrive ? "Manual Drive: ON" : "Manual Drive: OFF");
    }

    toggleCameraMode() {
        this.cameraMode = this.cameraMode === "chase" ? "free" : "chase";
        this._updateCameraModeUI();
    }

    setVibe(vibe) {
        this.currentVibe = vibe;
        const palette = this._getVibePalette(vibe);
        if (this.routeLine) {
            this.routeLine.material.color.set(palette.route);
        }
        this.roadLines.forEach(line => {
            line.material.color.set(line.material.opacity > 0.5 ? palette.majorRoad : palette.road);
        });
        if (this.carModel) {
            this.carModel.traverse(child => {
                if (child.isMesh && child.material?.color) {
                    child.material.color.offsetHSL(0, 0, 0);
                }
            });
        }
        this.syncMiniMapRoute(vibe);
    }

    setEnvironment(route) {
        if (!this.runtime) {
            this.pendingEnvironment = route;
            return;
        }

        let destination = route;
        let routeName = "Custom Route";

        if (route === "coastal") {
            destination = "Woodbine Beach, Toronto";
            routeName = "Coastal Highway";
        } else if (route === "mountain") {
            destination = "Casa Loma, Toronto";
            routeName = "Mountain Pass";
        } else if (route === "forest") {
            destination = "High Park, Toronto";
            routeName = "Forest Trail";
        } else if (typeof route === "string" && route.trim()) {
            routeName = route.trim();
        }

        this.currentRouteName = routeName;
        this.loadRoute(this.runtime.getAnchor(), destination, this.currentVibe);
    }

    syncMiniMapRoute(vibeId = this.currentVibe) {
        if (!this.routeBridge || !this.miniMap || !this.routeData) return;
        this.routeBridge.setMiniMap(this.miniMap);
        this.miniMap.setRoute(this.routeData.coordinates, this._getVibePalette(vibeId).route);
    }

    getDriveData() {
        return {
            distance: this._distanceMiles,
            duration: this._driveElapsedSeconds,
            speed: this._speedMph,
        };
    }

    resize = () => {
        if (!this.renderer || !this.camera || !this.container) return;
        const { clientWidth, clientHeight } = this.container;
        this.camera.aspect = clientWidth / Math.max(clientHeight, 1);
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(clientWidth, clientHeight, false);
    };

    _handleResize = () => this.resize();

    _setupKeyboardListeners() {
        window.addEventListener("keydown", e => {
            this._keysPressed.add(e.key.toLowerCase());
            if (e.key.toLowerCase() === "m") this.toggleManualDrive();
            if (e.key.toLowerCase() === "l") this.toggleCameraMode();
        });
        window.addEventListener("keyup", e => {
            this._keysPressed.delete(e.key.toLowerCase());
        });
        window.addEventListener("blur", () => {
            this._keysPressed.clear();
        });
    }

    _setupPointerControls() {
        const canvas = this.renderer.domElement;
        canvas.addEventListener("pointerdown", e => {
            if (this.cameraMode !== "free" || e.button !== 2) return;
            e.preventDefault();
            this._orbit.dragging = true;
            this._orbit.pointerId = e.pointerId;
            this._orbit.lastX = e.clientX;
            this._orbit.lastY = e.clientY;
            canvas.setPointerCapture?.(e.pointerId);
        });
        canvas.addEventListener("pointermove", e => {
            if (!this._orbit.dragging || this.cameraMode !== "free" || e.pointerId !== this._orbit.pointerId) return;
            const dx = e.clientX - this._orbit.lastX;
            const dy = e.clientY - this._orbit.lastY;
            this._orbit.lastX = e.clientX;
            this._orbit.lastY = e.clientY;
            this._orbit.theta -= dx * 0.0011;
            this._orbit.phi = clamp(this._orbit.phi + dy * 0.001, 0.28, Math.PI / 2.3);
        });
        const endDrag = e => {
            if (e.pointerId !== this._orbit.pointerId) return;
            this._orbit.dragging = false;
            this._orbit.pointerId = -1;
        };
        canvas.addEventListener("pointerup", endDrag);
        canvas.addEventListener("pointercancel", endDrag);
        canvas.addEventListener("wheel", e => {
            if (this.cameraMode !== "free") return;
            e.preventDefault();
            this._orbit.radius = clamp(this._orbit.radius + e.deltaY * 0.022, 36, 160);
        }, { passive: false });
        canvas.addEventListener("contextmenu", e => {
            if (this.cameraMode === "free") e.preventDefault();
        });
    }

    _positionCameraInitial() {
        this.camera.position.set(0, 140, 180);
        this.camera.lookAt(this.carRoot.position);
        this._updateCameraModeUI();
    }

    _startLoop() {
        if (this._rafId) cancelAnimationFrame(this._rafId);

        const tick = now => {
            const dt = this._lastFrameTime ? (now - this._lastFrameTime) / 1000 : 1 / 60;
            this._lastFrameTime = now;

            this.runtime.update();
            this._updateSimulation(dt);
            this._updateCamera(dt);
            this.renderer.render(this.scene, this.camera);

            this._rafId = requestAnimationFrame(tick);
        };

        this._rafId = requestAnimationFrame(tick);
    }

    _updateSimulation(dt) {
        if (!this.carRoot) return;

        if (this._isManualDrive) {
            this._updateManualDrive(dt);
        } else if (this.isDriving) {
            this._updateRouteDrive(dt);
        } else {
            this._speedMph = 0;
        }

        this.routeBridge?.updateMiniMapFromScene(this.carRoot.position, this.carRoot.rotation.y);
    }

    _updateManualDrive(dt) {
        const ACCEL = 15;
        const BRAKE = 22;
        const FRICTION = 0.985;
        const TURN_SPEED = 1.2;
        const MAX_SPEED = 40;

        if (this._keysPressed.has("w") || this._keysPressed.has("arrowup")) {
            this._manualSpeed += ACCEL * dt;
        } else if (this._keysPressed.has("s") || this._keysPressed.has("arrowdown")) {
            this._manualSpeed -= BRAKE * dt;
        } else {
            this._manualSpeed *= FRICTION;
        }

        this._manualSpeed = clamp(this._manualSpeed, -10, MAX_SPEED);

        const speedFactor = clamp(Math.abs(this._manualSpeed) / 10, 0.2, 1.0);
        if (this._keysPressed.has("a") || this._keysPressed.has("arrowleft")) {
            this._manualHeading -= TURN_SPEED * dt * speedFactor;
        }
        if (this._keysPressed.has("d") || this._keysPressed.has("arrowright")) {
            this._manualHeading += TURN_SPEED * dt * speedFactor;
        }

        const moveDist = this._manualSpeed * dt;
        const move = new THREE.Vector3(
            Math.sin(this._manualHeading) * moveDist,
            0,
            -Math.cos(this._manualHeading) * moveDist
        );

        this.carRoot.position.add(move);
        const snapped = this.runtime.snapToSurface(this.carRoot.position, 0.9);
        if (snapped) this.carRoot.position.copy(snapped);
        this.carRoot.rotation.y = this._manualHeading;
        this._speedMph = Math.round(Math.abs(this._manualSpeed) * 2.23694);
    }

    _updateRouteDrive(dt) {
        if (!this.routeScenePoints.length) return;

        const speedMps = this.routeLengthMeters > 0 && this.routeDurationSeconds > 0
            ? this.routeLengthMeters / this.routeDurationSeconds
            : 18;

        this.routeProgressMeters = clamp(this.routeProgressMeters + speedMps * dt, 0, this.routeLengthMeters);
        const position = this._positionAtProgress(this.routeProgressMeters);
        const heading = this._headingAtProgress(this.routeProgressMeters);
        this.carRoot.position.copy(position);
        const snapped = this.runtime.snapToSurface(this.carRoot.position, 0.9);
        if (snapped) this.carRoot.position.copy(snapped);
        this.carRoot.rotation.y = heading;

        this._driveElapsedSeconds += dt;
        this._distanceMiles = this.routeProgressMeters * 0.000621371;
        this._speedMph = Math.round(speedMps * 2.23694);
        if (typeof this._advanceNavCards === "function") {
            this._advanceNavCards(this.routeProgressMeters);
        }

        if (this.routeProgressMeters >= this.routeLengthMeters) {
            this.isDriving = false;
            this._speedMph = 0;
        }
    }

    _updateCamera(dt) {
        if (this.cameraMode === "chase") {
            const heading = this.carRoot.rotation.y;
            const desired = this.carRoot.position.clone().add(new THREE.Vector3(
                Math.sin(heading) * 22,
                8,
                Math.cos(heading) * 22
            ));
            this.camera.position.lerp(desired, clamp(dt * 6.5, 0, 1));
            this.camera.lookAt(this.carRoot.position.clone().add(new THREE.Vector3(0, 3.5, -2)));
        } else {
            const focus = this.carRoot.position.clone().add(new THREE.Vector3(0, 3.5, -2));
            this.camera.position.set(
                focus.x + this._orbit.radius * Math.sin(this._orbit.phi) * Math.sin(this._orbit.theta),
                focus.y + this._orbit.radius * Math.cos(this._orbit.phi),
                focus.z + this._orbit.radius * Math.sin(this._orbit.phi) * Math.cos(this._orbit.theta)
            );
            this.camera.lookAt(focus);
        }
    }

    _updateCameraModeUI() {
        const iconEl = document.getElementById("cameraModeIcon");
        const labelEl = document.getElementById("cameraModeLabel");
        if (this.cameraMode === "chase") {
            if (iconEl) iconEl.textContent = "🎥";
            if (labelEl) labelEl.textContent = "Chase";
        } else {
            if (iconEl) iconEl.textContent = "🌐";
            if (labelEl) labelEl.textContent = "Free";
        }
    }

    showToast(msg) {
        const toast = document.createElement("div");
        toast.style.cssText = "position:fixed; bottom:100px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:white; padding:10px 20px; border-radius:20px; z-index:10000; font-family:sans-serif; pointer-events:none;";
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    _getVibePalette(vibeId) {
        const palettes = {
            scenic: { route: "#c8a96e", road: "#4ea6d8", majorRoad: "#8ed6ff" },
            chill: { route: "#00f5d4", road: "#1ca9a0", majorRoad: "#5cf2ee" },
            adventure: { route: "#f72585", road: "#9333ea", majorRoad: "#ff4ea9" },
            fastest: { route: "#8090a0", road: "#7a8796", majorRoad: "#b2c1d1" },
            exciting: { route: "#ff00ff", road: "#a855f7", majorRoad: "#ff63ff" },
            quiet: { route: "#06d6a0", road: "#159570", majorRoad: "#42f5b8" },
        };
        return palettes[vibeId] ?? palettes.scenic;
    }
}
