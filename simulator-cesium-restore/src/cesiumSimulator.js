import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
// import route APIs dynamically when needed or keep buildSampledRoute
import { GeoAnchor } from "./geoAnchor.js";

/**
 * Native CesiumJS Simulator: EPIC MONOLITH EDITION
 * - 100% NATIVE CESIUM (No Three.js)
 * - VOLUMETRIC GROUND: 10km deep floating monolith.
 * - MASSIVE SCALE: 300km x 300km horizon-filling ground.
 * - BUILDING CLIPPER: Hides geometry outside the city zone.
 */
export class CesiumSimulator {
    constructor(containerId, apiToken) {
        this.containerId = containerId;
        this.apiToken = apiToken;
        this.viewer = null;
        this.tileset = null;
        this.GROUND_ALT = 75; // Fallback; will be overwritten by terrain sampling
        this.MONOLITH_DEPTH = 10000; // 10km depth
        this.startTime = null;
        this.carEntity = null;
        this.carVisualEntities = [];
        this.routeEntity = null;
        this.routeDecorEntities = [];
        this.groundDecorEntities = [];
        this.roadLabelEntities = [];
        // Camera system
        this.cameraMode = 'chase'; // 'chase' | 'free'
        this._chaseHandler = null; // postUpdate listener reference
        this._cameraInputHandler = null;
        this._cameraOrbit = {
            headingOffset: 0,
            pitch: Cesium.Math.toRadians(-18),
            range: 42,
            dragging: false,
            dragButton: null,
            lastX: 0,
            lastY: 0,
        };

        // Manual Drive System
        this._isManualDrive = false;
        this._manualSpeed = 0;
        this._manualHeading = 0;
        this._manualPos = null;
        this._keysPressed = new Set();
        this.routeData = null;
        this.geoAnchor = null;
        this.currentVibe = "scenic";
        this.currentDestination = "351 Davenport Road, Toronto, ON";
        this.pendingEnvironment = null;
        this._initialized = false;
        this._lastManualFrameTime = null;
        this._lastTrackedPos = null;
        this._currentSpeedMph = 0;
        this._currentDistanceMiles = 0;
        this._currentElapsedSeconds = 0;
        this.performanceProfile = {
            maxResolutionScale: 0.5,
            maximumScreenSpaceError: 36,
            roadLimit: 12000,
            roadLabelLimit: 80,
        };
        this.ROAD_SURFACE_OFFSET = 0.05;
        this._setupKeyboardListeners();
    }

    _setupKeyboardListeners() {
        window.addEventListener('keydown', (e) => {
            this._keysPressed.add(e.key.toLowerCase());
            if (e.key.toLowerCase() === 'm') this.toggleManualDrive();
            if (e.key.toLowerCase() === 'l') this.toggleCameraMode();
        });
        window.addEventListener('keyup', (e) => {
            this._keysPressed.delete(e.key.toLowerCase());
        });
    }

    _setupMouseCameraControls() {
        if (!this.viewer?.canvas) return;

        this._cameraInputHandler = new Cesium.ScreenSpaceEventHandler(this.viewer.canvas);
        const startDrag = (movement, button) => {
            if (this.cameraMode !== 'chase') return;
            this._cameraOrbit.dragging = true;
            this._cameraOrbit.dragButton = button;
            this._cameraOrbit.lastX = movement.position.x;
            this._cameraOrbit.lastY = movement.position.y;
        };
        const endDrag = (button) => {
            if (this._cameraOrbit.dragButton !== button) return;
            this._cameraOrbit.dragging = false;
            this._cameraOrbit.dragButton = null;
        };

        this._cameraInputHandler.setInputAction((movement) => {
            startDrag(movement, 'left');
        }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

        this._cameraInputHandler.setInputAction((movement) => {
            startDrag(movement, 'right');
        }, Cesium.ScreenSpaceEventType.RIGHT_DOWN);

        this._cameraInputHandler.setInputAction((movement) => {
            if (!this._cameraOrbit.dragging || this.cameraMode !== 'chase') return;
            const dx = movement.endPosition.x - this._cameraOrbit.lastX;
            const dy = movement.endPosition.y - this._cameraOrbit.lastY;
            this._cameraOrbit.lastX = movement.endPosition.x;
            this._cameraOrbit.lastY = movement.endPosition.y;
            this._cameraOrbit.headingOffset -= dx * 0.005;
            this._cameraOrbit.pitch = Cesium.Math.clamp(
                this._cameraOrbit.pitch - dy * 0.003,
                Cesium.Math.toRadians(-75),
                Cesium.Math.toRadians(-6)
            );
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

        this._cameraInputHandler.setInputAction(() => {
            endDrag('left');
        }, Cesium.ScreenSpaceEventType.LEFT_UP);

        this._cameraInputHandler.setInputAction(() => {
            endDrag('right');
        }, Cesium.ScreenSpaceEventType.RIGHT_UP);

        this._cameraInputHandler.setInputAction((delta) => {
            if (this.cameraMode !== 'chase') return;
            this._cameraOrbit.range = Cesium.Math.clamp(
                this._cameraOrbit.range - delta * 0.06,
                18,
                180
            );
        }, Cesium.ScreenSpaceEventType.WHEEL);
    }

    toggleManualDrive() {
        this._isManualDrive = !this._isManualDrive;
        console.log("[CesiumSim] Manual Drive:", this._isManualDrive);
        
        if (this._isManualDrive) {
            // Initialize manual position from current car position
            const time = this.viewer.clock.currentTime;
            this._manualPos = this.carEntity.position.getValue(time);
            
            // Re-initialize heading from current orientation
            const orientation = this.carEntity.orientation.getValue(time);
            if (orientation) {
                const hpr = Cesium.HeadingPitchRoll.fromQuaternion(orientation);
                this._manualHeading = hpr.heading;
            }

            this.viewer.clock.shouldAnimate = false; // Stop route animation
            this.viewer.scene.requestRenderMode = false;
            this._lastManualFrameTime = performance.now();
            this._resetDriveTelemetry();
            this.showToast("Manual Drive: ON (WASD to Drive, L to Lock Cam)");
        } else {
            this.viewer.scene.requestRenderMode = true;
            this._lastManualFrameTime = null;
            this._manualSpeed = 0;
            this._currentSpeedMph = 0;
            this._renderTelemetry();
            this.showToast("Manual Drive: OFF (Guided Route)");
        }
    }

    showToast(msg) {
        // Simple toast or console log if no UI helper exists
        console.log("[Toast]", msg);
        const toast = document.createElement("div");
        toast.style.cssText = "position:fixed; bottom:100px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.8); color:white; padding:10px 20px; border-radius:20px; z-index:10000; font-family:sans-serif; pointer-events:none;";
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    async init(vibeId = "scenic") {
        console.log("[CesiumSim] init() vibe:", vibeId);
        Cesium.Ion.defaultAccessToken = this.apiToken;
        this.currentVibe = vibeId;

        this.viewer = new Cesium.Viewer(this.containerId, {
            animation: false,
            timeline: false,
            baseLayerPicker: false,
            geocoder: false,
            homeButton: false,
            navigationHelpButton: false,
            sceneModePicker: false,
            fullscreenButton: false,
            infoBox: false,
            imageryProvider: false,
            skyBox: false,
            skyAtmosphere: false,
            contextOptions: {
                allowTextureFilterAnisotropic: false,
                webgl: {
                    alpha: false,
                    antialias: false,
                    depth: true,
                    stencil: false,
                    powerPreference: "low-power",
                    preserveDrawingBuffer: false,
                    failIfMajorPerformanceCaveat: false,
                },
            },
            requestRenderMode: true,
            maximumRenderTimeChange: 1 / 30,
        });

        this.viewer.scene.globe.show = false;
        this.viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#050508");
        this.viewer.scene.highDynamicRange = false;
        this.viewer.scene.fxaa = false;
        this.viewer.scene.msaaSamples = 1;
        this.viewer.scene.postProcessStages.fxaa.enabled = false;
        this.viewer.resolutionScale = Math.min(window.devicePixelRatio || 1, this.performanceProfile.maxResolutionScale);
        this.viewer.shadows = false;
        this._setupMouseCameraControls();

        // Custom start: 4 Lower Jarvis Street, Toronto, snapped to the Lower Jarvis roadway centerline
        const startLng = -79.3692689;
        const startLat = 43.6444017;
        this.geoAnchor = new GeoAnchor(startLat, startLng, this.GROUND_ALT);
        const origin = { lat: startLat, lng: startLng };
        const destStr = this._resolveDestination(this.pendingEnvironment ?? "coastal");
        this.currentDestination = destStr;
        this.pendingEnvironment = null;

        const routePromise = this._loadInitialRoute(origin, destStr, vibeId);

        // Seed a route immediately so nav cards, minimap, and car placement are not blocked by terrain/tiles.
        this.routeData = this._createFallbackRouteData(origin, destStr, vibeId);
        this.activeRoute = this.routeData.coordinates;
        this._dispatchRouteLoaded(this.routeData, [origin.lng, origin.lat]);

        // ── STEP 1: Get precise ground height from Cesium World Terrain ──
        // This is the KEY fix: OSM Buildings are positioned relative to the WGS84
        // ellipsoid. We need terrain height to match our entities to building bases.
        try {
            const terrainProvider = await Cesium.createWorldTerrainAsync();
            const positions = [Cesium.Cartographic.fromDegrees(startLng, startLat)];
            const sampledPositions = await Cesium.sampleTerrainMostDetailed(terrainProvider, positions);
            this.GROUND_ALT = sampledPositions[0].height;
            console.log("[CesiumSim] Terrain-sampled GROUND_ALT:", this.GROUND_ALT, "m (WGS84 ellipsoid)");
        } catch (e) {
            console.warn("[CesiumSim] Terrain sampling failed, using fallback GROUND_ALT:", this.GROUND_ALT, e);
        }

        this.viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(startLng, startLat, 1500),
            orientation: { 
                heading: 0, // Facing NORTH
                pitch: Cesium.Math.toRadians(-45), 
                roll: 0 
            }
        });

        this._createVolumetricGround(vibeId);

        // ── Drawing Real OSM Roads ──
        await this._createRoadNetwork(vibeId);

        // ── Load Buildings ──
        try {
            this.tileset = await Cesium.Cesium3DTileset.fromIonAssetId(96188);
            this.tileset.maximumScreenSpaceError = this.performanceProfile.maximumScreenSpaceError;
            this.tileset.skipLevelOfDetail = true;
            this.tileset.baseScreenSpaceError = 1024;
            this.tileset.skipScreenSpaceErrorFactor = 16;
            this.tileset.skipLevels = 1;
            this.tileset.dynamicScreenSpaceError = true;
            this.tileset.dynamicScreenSpaceErrorDensity = 0.0024;
            this.tileset.dynamicScreenSpaceErrorFactor = 4.0;
            this.tileset.cullWithChildrenBounds = true;
            this.tileset.preferLeaves = true;
            this.tileset.loadSiblings = false;
            this.viewer.scene.primitives.add(this.tileset);
            this.applyVibeAesthetics(vibeId);
        } catch (e) { console.error("[CesiumSim] Tileset:", e); }

        routePromise.then(routeData => {
            this.routeData = routeData;
            this.activeRoute = routeData.coordinates;
            this._drawActiveRoute(vibeId);
            if (this.miniMap) this.syncMiniMapRoute(vibeId);
            this._dispatchRouteLoaded(routeData, [origin.lng, origin.lat]);
        });

        // Calculate initial heading based on the first route segment
        let initialHeading = 0;
        if (this.activeRoute.length > 1) {
            const p1 = this.activeRoute[0];
            const p2 = this.activeRoute[1];
            // Delta longitude vs delta latitude for heading
            initialHeading = Math.atan2(p2[0] - p1[0], p2[1] - p1[1]);
        }

        const startPosition = this._spawnPositionFromRoutePoint(this.activeRoute[0]);
        this._manualPos = startPosition.clone();
        this._manualHeading = initialHeading;
        this.startTime = Cesium.JulianDate.now();
        this.viewer.clock.startTime = this.startTime.clone();
        this.viewer.clock.currentTime = this.startTime.clone();
        this.viewer.clock.shouldAnimate = false;
        this._resetDriveTelemetry();

        this.carEntity = this.viewer.entities.add({
            position: new Cesium.CallbackProperty(() => this._manualPos, false),
            orientation: new Cesium.CallbackProperty(() => this._getCarOrientationQuaternion(), false),
        });
        this._buildCarVisuals();

        this._drawActiveRoute(vibeId);
        if (this.miniMap) {
            this.syncMiniMapRoute(vibeId);
        }
        this._initialized = true;

        // Fly into scene, then activate GTA-style chase camera
        setTimeout(() => {
            if (!this.viewer) return;
            const previewHeading = initialHeading + this._cameraOrbit.headingOffset;
            const previewLng = startLng - Math.sin(previewHeading) * 0.0019;
            const previewLat = startLat - Math.cos(previewHeading) * 0.0019;
            this.viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(previewLng, previewLat, this.GROUND_ALT + 150),
                orientation: {
                    heading: previewHeading,
                    pitch: Cesium.Math.toRadians(-22),
                    roll: 0
                },
                duration: 2.5,
                complete: () => {
                    this.cameraMode = 'chase';
                    this._startChaseCamera();
                    this._updateCameraModeUI();
                }
            });
        }, 1000);

        // Realtime Telemetry & MiniMap Update Hook
        this.viewer.clock.onTick.addEventListener((clock) => {
            if (!this.carEntity || !this.miniMap) return;

            const pos = this._manualPos;
            if (!pos) return;

            const carto = Cesium.Cartographic.fromCartesian(pos);
            const lat = Cesium.Math.toDegrees(carto.latitude);
            const lng = Cesium.Math.toDegrees(carto.longitude);

            const orientation = this.carEntity.orientation.getValue(clock.currentTime);
            let heading = 0;
            if (orientation) {
                const hpr = Cesium.HeadingPitchRoll.fromQuaternion(orientation);
                heading = hpr.heading;
            }

            this.miniMap.update(lat, lng, heading);
            if (!this._isManualDrive) {
                this._updateTelemetry(clock, pos);
            }
        });

        this.viewer.scene.preRender.addEventListener(() => {
            if (!this._isManualDrive || !this._manualPos) return;
            const now = performance.now();
            const dt = this._lastManualFrameTime ? Math.min((now - this._lastManualFrameTime) / 1000, 0.05) : 1 / 60;
            this._lastManualFrameTime = now;
            this._updateManualDrive(dt);

            const carto = Cesium.Cartographic.fromCartesian(this._manualPos);
            const lat = Cesium.Math.toDegrees(carto.latitude);
            const lng = Cesium.Math.toDegrees(carto.longitude);
            this.miniMap?.update(lat, lng, this._manualHeading);
            this._updateTelemetry(this.viewer.clock, this._manualPos);
        });
    }

    _clearCarVisuals() {
        if (!this.viewer || !this.carVisualEntities.length) return;
        for (const entity of this.carVisualEntities) {
            this.viewer.entities.remove(entity);
        }
        this.carVisualEntities = [];
    }

    _getRoadSurfaceHeight() {
        return this.GROUND_ALT + this.ROAD_SURFACE_OFFSET;
    }

    _spawnPositionFromRoutePoint(point) {
        return Cesium.Cartesian3.fromDegrees(
            point[0],
            point[1],
            this._getRoadSurfaceHeight()
        );
    }

    _getCarOrientationQuaternion(position = this._manualPos) {
        if (!position) return Cesium.Quaternion.IDENTITY;
        return Cesium.Transforms.headingPitchRollQuaternion(
            position,
            new Cesium.HeadingPitchRoll(this._manualHeading, 0, 0)
        );
    }

    _projectToRoadSurface(position = this._manualPos) {
        if (!position) return null;
        const cartographic = Cesium.Cartographic.fromCartesian(position);
        return Cesium.Cartesian3.fromRadians(
            cartographic.longitude,
            cartographic.latitude,
            this._getRoadSurfaceHeight()
        );
    }

    _offsetFromCar(rightMeters, forwardMeters, upMeters) {
        if (!this._manualPos) return null;
        const heading = this._manualHeading;
        const east = (rightMeters * Math.cos(heading)) + (forwardMeters * Math.sin(heading));
        const north = (-rightMeters * Math.sin(heading)) + (forwardMeters * Math.cos(heading));
        const localOffset = new Cesium.Cartesian3(east, north, upMeters);
        const transform = Cesium.Transforms.eastNorthUpToFixedFrame(this._manualPos);
        return Cesium.Matrix4.multiplyByPoint(transform, localOffset, new Cesium.Cartesian3());
    }

    _buildCarVisuals() {
        if (!this.viewer) return;
        this._clearCarVisuals();

        const bodyColor = Cesium.Color.fromCssColorString("#f97316");
        const roofColor = Cesium.Color.fromCssColorString("#ffd7aa");
        const accentColor = Cesium.Color.fromCssColorString("#111827");
        const wheelColor = Cesium.Color.fromCssColorString("#09090b");
        const shadowColor = Cesium.Color.fromCssColorString("#020617").withAlpha(0.32);

        const makeBoxPart = ({ right = 0, forward = 0, up = 0, dimensions, material }) => {
            const entity = this.viewer.entities.add({
                position: new Cesium.CallbackProperty(() => this._offsetFromCar(right, forward, up), false),
                orientation: new Cesium.CallbackProperty(() => this._getCarOrientationQuaternion(), false),
                box: {
                    dimensions,
                    material,
                    outline: false,
                    shadows: Cesium.ShadowMode.DISABLED,
                }
            });
            this.carVisualEntities.push(entity);
        };

        const makeEllipsoidPart = ({ right = 0, forward = 0, up = 0, radii, material }) => {
            const entity = this.viewer.entities.add({
                position: new Cesium.CallbackProperty(() => this._offsetFromCar(right, forward, up), false),
                orientation: new Cesium.CallbackProperty(() => this._getCarOrientationQuaternion(), false),
                ellipsoid: {
                    radii,
                    material,
                    outline: false,
                    shadows: Cesium.ShadowMode.DISABLED,
                }
            });
            this.carVisualEntities.push(entity);
        };

        makeEllipsoidPart({
            up: 0.03,
            radii: new Cesium.Cartesian3(0.92, 2.15, 0.03),
            material: shadowColor,
        });
        makeBoxPart({
            up: 0.34,
            dimensions: new Cesium.Cartesian3(1.95, 4.25, 0.68),
            material: bodyColor,
        });
        makeBoxPart({
            forward: -0.2,
            up: 0.78,
            dimensions: new Cesium.Cartesian3(1.45, 1.85, 0.42),
            material: roofColor,
        });
        makeBoxPart({
            forward: 1.72,
            up: 0.34,
            dimensions: new Cesium.Cartesian3(0.88, 0.48, 0.12),
            material: accentColor,
        });
        for (const [right, forward] of [
            [-0.95, 1.25],
            [0.95, 1.25],
            [-0.95, -1.2],
            [0.95, -1.2],
        ]) {
            makeEllipsoidPart({
                right,
                forward,
                up: 0.22,
                radii: new Cesium.Cartesian3(0.24, 0.24, 0.24),
                material: wheelColor,
            });
        }
    }

    syncMiniMapRoute(vibeId = this.currentVibe) {
        if (!this.miniMap || !this.activeRoute) return;
        const hexColor = vibeId === "exciting" ? "#ff00ff" : vibeId === "quiet" ? "#06d6a0" : "#00f5d4";
        this.miniMap.setRoute(this.activeRoute, hexColor);
    }

    _updateManualDrive(dt) {
        const ACCEL = 15; 
        const BRAKE = 25;
        const FRICTION = 0.98;
        const TURN_SPEED = 1.2;
        const MAX_SPEED = 40;

        // Acceleration / Braking
        if (this._keysPressed.has('w') || this._keysPressed.has('arrowup')) {
            this._manualSpeed += ACCEL * dt;
        } else if (this._keysPressed.has('s') || this._keysPressed.has('arrowdown')) {
            this._manualSpeed -= BRAKE * dt;
        } else {
            this._manualSpeed *= FRICTION;
        }

        this._manualSpeed = Cesium.Math.clamp(this._manualSpeed, -10, MAX_SPEED);

        // Steering
        const speedFactor = Cesium.Math.clamp(Math.abs(this._manualSpeed) / 10, 0.2, 1.0);
        if (this._keysPressed.has('a') || this._keysPressed.has('arrowleft')) {
            this._manualHeading -= TURN_SPEED * dt * speedFactor;
        }
        if (this._keysPressed.has('d') || this._keysPressed.has('arrowright')) {
            this._manualHeading += TURN_SPEED * dt * speedFactor;
        }

        // Calculate Movement Vector
        // Cesium heading: 0 = North, PI/2 = East
        // In ENU: velocity.x = sin(h), velocity.y = cos(h)
        const vx = Math.sin(this._manualHeading) * this._manualSpeed * dt;
        const vy = Math.cos(this._manualHeading) * this._manualSpeed * dt;

        // Convert displacement to Cartesian3
        if (!this._manualPos) return;
        const enuTransform = Cesium.Transforms.eastNorthUpToFixedFrame(this._manualPos);
        const displacement = new Cesium.Cartesian3(vx, vy, 0);
        const worldDisplacement = Cesium.Matrix4.multiplyByPointAsVector(enuTransform, displacement, new Cesium.Cartesian3());
        
        this._manualPos = Cesium.Cartesian3.add(this._manualPos, worldDisplacement, new Cesium.Cartesian3());
        this._manualPos = this._projectToRoadSurface(this._manualPos);
        this._currentSpeedMph = Math.round(Math.abs(this._manualSpeed) * 2.23694);
    }

    _updateTelemetry(clock, currentPos) {
        // Initialize telemetry state if not present
        if (!this._lastTrackedPos) {
            this._lastTrackedPos = currentPos.clone();
            this._lastTime = clock.currentTime.clone();
            return;
        }

        // Calculate time delta in seconds
        const dt = this._isManualDrive
            ? Math.max(1 / 120, (performance.now() - this._lastTelemetryTimestamp) / 1000)
            : Math.max(1 / 120, Cesium.JulianDate.secondsDifference(clock.currentTime, this._lastTime));
        if (dt <= 0) return;

        // Calculate distance delta in meters
        const distDelta = Cesium.Cartesian3.distance(this._lastTrackedPos, currentPos);
        this._totalDistanceMeters += distDelta;

        // Speed = d/t (m/s) -> convert to mph (1 m/s = 2.23694 mph)
        const speedMps = this._isManualDrive ? Math.abs(this._manualSpeed) : distDelta / dt;
        const speedMph = Math.round(speedMps * 2.23694);

        // Distance in miles
        const distanceMiles = (this._totalDistanceMeters * 0.000621371).toFixed(1);

        // Elapsed time formatted as mm:ss
        const elapsedSec = this._isManualDrive
            ? Math.floor((performance.now() - this._manualDriveStartTime) / 1000)
            : Math.floor(Cesium.JulianDate.secondsDifference(clock.currentTime, this.startTime));
        const mins = Math.floor(elapsedSec / 60);
        const secs = (elapsedSec % 60).toString().padStart(2, '0');
        this._currentSpeedMph = speedMph;
        this._currentDistanceMiles = Number(distanceMiles);
        this._currentElapsedSeconds = elapsedSec;

        // Update DOM elements
        this._renderTelemetry();

        // Advance nav step cards based on distance travelled
        if (typeof this._advanceNavCards === 'function') {
            this._advanceNavCards(this._totalDistanceMeters);
        }

        // Save state for next tick
        this._lastTrackedPos = currentPos.clone();
        this._lastTime = clock.currentTime.clone();
        this._lastTelemetryTimestamp = performance.now();
    }

    _renderTelemetry() {
        const elSpeed = document.getElementById("speedDisplay");
        const elStatSpeed = document.getElementById("statSpeed");
        const elStatDist = document.getElementById("statDistance");
        const elStatTime = document.getElementById("statTime");

        const mins = Math.floor(this._currentElapsedSeconds / 60);
        const secs = String(this._currentElapsedSeconds % 60).padStart(2, '0');
        if (elSpeed) elSpeed.textContent = this._currentSpeedMph;
        if (elStatSpeed) elStatSpeed.textContent = this._currentSpeedMph;
        if (elStatDist) elStatDist.textContent = this._currentDistanceMiles.toFixed(1);
        if (elStatTime) elStatTime.textContent = `${mins}:${secs}`;
    }

    _createVolumetricGround(vibeId) {
        if (this.groundEntity) {
            this.viewer.entities.remove(this.groundEntity);
            this.groundEntity = null;
        }
        if (this.groundDecorEntities.length) {
            for (const entity of this.groundDecorEntities) {
                this.viewer.entities.remove(entity);
            }
            this.groundDecorEntities = [];
        }

        const palettes = {
            exciting: {
                base: "#050912",
                mid: "#0d1b2d",
                glow: "#153a5d",
                haze: "#7dd3fc",
                water: "#071a2b",
                rim: "#38bdf8",
            },
            quiet: {
                base: "#060d12",
                mid: "#0b1720",
                glow: "#123241",
                haze: "#67e8f9",
                water: "#071824",
                rim: "#22d3ee",
            },
            scenic: {
                base: "#050913",
                mid: "#0d1f33",
                glow: "#18466b",
                haze: "#7dd3fc",
                water: "#07182a",
                rim: "#67e8f9",
            },
            chill: {
                base: "#060912",
                mid: "#0d1f33",
                glow: "#173d5d",
                haze: "#7dd3fc",
                water: "#071722",
                rim: "#60a5fa",
            },
            adventure: {
                base: "#040912",
                mid: "#0e2035",
                glow: "#165074",
                haze: "#7dd3fc",
                water: "#07182c",
                rim: "#67e8f9",
            },
            fastest: {
                base: "#080b12",
                mid: "#161d29",
                glow: "#31435f",
                haze: "#facc15",
                water: "#0c1620",
                rim: "#facc15",
            },
        };
        const palette = palettes[vibeId] ?? palettes.scenic;
        const color = Cesium.Color.fromCssColorString(palette.base);

        // 300km x 300km Massive Scale
        const bounds = Cesium.Rectangle.fromDegrees(-81.0, 42.0, -78.0, 45.0);

        this.groundEntity = this.viewer.entities.add({
            name: "World Monolith",
            rectangle: {
                coordinates: bounds,
                height: this.GROUND_ALT,
                extrudedHeight: this.GROUND_ALT - this.MONOLITH_DEPTH, // 10km depth
                material: color,
                outline: false,
            }
        });

        const center = Cesium.Cartesian3.fromDegrees(-79.37130, 43.64330, this.GROUND_ALT);
        const makeEllipse = (semiMajorAxis, semiMinorAxis, height, material) => {
            const entity = this.viewer.entities.add({
                position: center,
                ellipse: {
                    semiMajorAxis,
                    semiMinorAxis,
                    height,
                    material,
                    outline: false,
                }
            });
            this.groundDecorEntities.push(entity);
        };

        makeEllipse(
            18000,
            14000,
            this.GROUND_ALT + 0.02,
            Cesium.Color.fromCssColorString(palette.mid).withAlpha(0.28)
        );

        makeEllipse(
            9000,
            7000,
            this.GROUND_ALT + 0.03,
            Cesium.Color.fromCssColorString(palette.glow).withAlpha(0.18)
        );

        makeEllipse(
            26000,
            22000,
            this.GROUND_ALT + 0.01,
            Cesium.Color.fromCssColorString(palette.haze).withAlpha(0.05)
        );

        makeEllipse(
            16000,
            5200,
            this.GROUND_ALT + 0.04,
            Cesium.Color.fromCssColorString(palette.rim).withAlpha(0.06)
        );

        const harborWater = this.viewer.entities.add({
            rectangle: {
                coordinates: Cesium.Rectangle.fromDegrees(-79.43, 43.595, -79.27, 43.634),
                height: this.GROUND_ALT + 0.025,
                material: Cesium.Color.fromCssColorString(palette.water).withAlpha(0.9),
                outline: false,
            }
        });
        this.groundDecorEntities.push(harborWater);

        const harborRim = this.viewer.entities.add({
            corridor: {
                positions: Cesium.Cartesian3.fromDegreesArrayHeights([
                    -79.43, 43.634, this.GROUND_ALT + 0.045,
                    -79.27, 43.634, this.GROUND_ALT + 0.045
                ]),
                width: 260,
                height: this.GROUND_ALT + 0.045,
                material: Cesium.Color.fromCssColorString(palette.rim).withAlpha(0.16),
                cornerType: Cesium.CornerType.ROUNDED,
            }
        });
        this.groundDecorEntities.push(harborRim);

        const horizonBand = this.viewer.entities.add({
            position: center,
            wall: {
                positions: Cesium.Cartesian3.fromDegreesArrayHeights([
                    -79.68, 43.80, this.GROUND_ALT + 20,
                    -79.06, 43.80, this.GROUND_ALT + 20,
                    -79.06, 43.47, this.GROUND_ALT + 20,
                    -79.68, 43.47, this.GROUND_ALT + 20,
                    -79.68, 43.80, this.GROUND_ALT + 20,
                ]),
                minimumHeights: [
                    this.GROUND_ALT - 140,
                    this.GROUND_ALT - 140,
                    this.GROUND_ALT - 140,
                    this.GROUND_ALT - 140,
                    this.GROUND_ALT - 140,
                ],
                material: Cesium.Color.fromCssColorString(palette.haze).withAlpha(0.04),
                outline: false,
            }
        });
        this.groundDecorEntities.push(horizonBand);
    }

    async _createRoadNetwork(vibeId) {
        const alt = this.GROUND_ALT + 0.05; // Lower altitude, closer to surface
        const asphaltMajor = Cesium.Color.fromCssColorString("#2b3446").withAlpha(0.985);
        const asphaltMinor = Cesium.Color.fromCssColorString("#20283a").withAlpha(0.94);
        const shoulderColor = Cesium.Color.fromCssColorString("#1c4865").withAlpha(0.24);
        const edgeColor = Cesium.Color.fromCssColorString("#f5fbff").withAlpha(0.74);
        const centerColor = Cesium.Color.fromCssColorString(vibeId === "fastest" ? "#fcd34d" : "#7dd3fc").withAlpha(0.92);
        const glowColor = Cesium.Color.fromCssColorString("#38bdf8").withAlpha(0.12);

        const widthMap = {
            motorway: 24, trunk: 20, primary: 16, secondary: 13,
            tertiary: 10, residential: 8, service: 6, unclassified: 7
        };

        try {
            const roadsUrl = `${import.meta.env.BASE_URL || "/"}toronto_roads.json`;
            const res = await fetch(roadsUrl);
            const data = await res.json();
            const nearbyRoads = this._selectNearbyRoads(data.roads);
            const labeledRoadNames = new Set();
            let labelsPlaced = 0;
            console.log(`[CesiumSim] Loading ${nearbyRoads.length} stylized roads`);

            for (const road of nearbyRoads) {
                if (road.coords.length < 2) continue;

                const flat = [];
                for (const [lng, lat] of road.coords) {
                    flat.push(lng, lat, alt);
                }

                const isMajor = ["motorway", "trunk", "primary", "secondary"].includes(road.type);
                const isPrimaryClass = ["motorway", "trunk", "primary"].includes(road.type);
                const w = widthMap[road.type] || 2;
                const positions = Cesium.Cartesian3.fromDegreesArrayHeights(flat);

                if (isMajor) {
                    this.viewer.entities.add({
                        corridor: {
                            positions,
                            width: w + Math.max(2.8, w * 0.22),
                            height: alt - 0.014,
                            material: shoulderColor,
                            cornerType: Cesium.CornerType.ROUNDED,
                        }
                    });
                }

                if (isPrimaryClass) {
                    this.viewer.entities.add({
                        corridor: {
                            positions,
                            width: w + Math.max(6, w * 0.46),
                            height: alt - 0.02,
                            material: glowColor,
                            cornerType: Cesium.CornerType.ROUNDED,
                        }
                    });
                }

                this.viewer.entities.add({
                    corridor: {
                        positions,
                        width: w,
                        height: alt,
                        material: isMajor ? asphaltMajor : asphaltMinor,
                        cornerType: Cesium.CornerType.ROUNDED,
                    }
                });

                if (isMajor || road.type === "tertiary") {
                    this.viewer.entities.add({
                        polyline: {
                            positions,
                            width: Math.max(1.2, w * 0.07),
                            material: edgeColor,
                            clampToGround: false,
                        }
                    });
                }

                if (isPrimaryClass) {
                    this.viewer.entities.add({
                        polyline: {
                            positions,
                            width: Math.max(1.2, w * 0.06),
                            material: new Cesium.PolylineDashMaterialProperty({
                                color: centerColor,
                                dashLength: 20,
                                gapColor: Cesium.Color.fromCssColorString("#120d16").withAlpha(0.0),
                            }),
                            clampToGround: false,
                        }
                    });
                }

                const canLabel =
                    !!road.name &&
                    road.name.trim().length > 0 &&
                    !labeledRoadNames.has(road.name) &&
                    labelsPlaced < (this.performanceProfile.roadLabelLimit ?? 140) &&
                    isMajor &&
                    road.coords.length >= 4;

                if (canLabel) {
                    const midpointIndex = Math.floor(road.coords.length / 2);
                    const [labelLng, labelLat] = road.coords[midpointIndex];
                    this.roadLabelEntities.push(this.viewer.entities.add({
                        position: Cesium.Cartesian3.fromDegrees(labelLng, labelLat, alt + 0.2),
                        label: {
                            text: road.name,
                            font: "600 17px 'Segoe UI', sans-serif",
                            fillColor: Cesium.Color.fromCssColorString("#edf7ff").withAlpha(0.93),
                            outlineColor: Cesium.Color.fromCssColorString("#08111c").withAlpha(0.98),
                            outlineWidth: 5,
                            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                            showBackground: true,
                            backgroundColor: Cesium.Color.fromCssColorString("#08111c").withAlpha(0.5),
                            backgroundPadding: new Cesium.Cartesian2(12, 6),
                            horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                            verticalOrigin: Cesium.VerticalOrigin.CENTER,
                            disableDepthTestDistance: Number.POSITIVE_INFINITY,
                            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 7000),
                            scaleByDistance: new Cesium.NearFarScalar(250, 1.0, 7000, 0.35),
                            translucencyByDistance: new Cesium.NearFarScalar(250, 1.0, 7000, 0.25),
                            pixelOffset: new Cesium.Cartesian2(0, -8),
                        }
                    }));
                    labeledRoadNames.add(road.name);
                    labelsPlaced += 1;
                }
            }
        } catch (e) {
            console.warn("[CesiumSim] Could not load road data:", e);
        }
    }

    _drawActiveRoute(vibeId) {
        if (this.routeEntity) this.viewer.entities.remove(this.routeEntity);
        this._clearRouteDecor();

        const routeColor = Cesium.Color.fromCssColorString(vibeId === "fastest" ? "#fcd34d" : "#67e8f9");
        const edgeColor = Cesium.Color.fromCssColorString("#f8fbff").withAlpha(0.9);
        const routePositions = this.activeRoute.map(c => Cesium.Cartesian3.fromDegrees(c[0], c[1], this.GROUND_ALT + 0.1));

        this.routeDecorEntities.push(this.viewer.entities.add({
            corridor: {
                positions: routePositions,
                width: 30,
                height: this.GROUND_ALT + 0.03,
                material: Cesium.Color.fromCssColorString("#0b1a27").withAlpha(0.16),
                cornerType: Cesium.CornerType.ROUNDED,
            }
        }));

        this.routeDecorEntities.push(this.viewer.entities.add({
            corridor: {
                positions: routePositions,
                width: 20,
                height: this.GROUND_ALT + 0.07,
                material: Cesium.Color.fromCssColorString("#101923").withAlpha(0.985),
                cornerType: Cesium.CornerType.ROUNDED,
            }
        }));

        this.routeDecorEntities.push(this.viewer.entities.add({
            polyline: {
                positions: routePositions,
                width: 2.8,
                material: edgeColor,
                clampToGround: false,
            }
        }));

        this.routeDecorEntities.push(this.viewer.entities.add({
            polyline: {
                positions: routePositions,
                width: 1.6,
                material: new Cesium.PolylineDashMaterialProperty({
                    color: routeColor,
                    dashLength: 22,
                    gapColor: Cesium.Color.fromAlpha(routeColor, 0.02),
                }),
                clampToGround: false,
            }
        }));

        this._addRouteGuideLights(routePositions, routeColor);

        this.routeEntity = this.viewer.entities.add({
            polyline: {
                positions: routePositions,
                width: 12,
                material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.12, color: routeColor }),
            }
        });
    }

    applyVibeAesthetics(vibeId) {
        if (!this.tileset) return;
        this.viewer.scene.postProcessStages.bloom.enabled = false;

                const accent = {
            scenic: "#8fd3ff",
            chill: "#93c5fd",
            adventure: "#67e8f9",
            fastest: "#fcd34d",
            exciting: "#67e8f9",
            quiet: "#a5f3fc",
        }[vibeId] ?? "#8fd3ff";

        try {
            this.tileset.style = new Cesium.Cesium3DTileStyle({
                defines: {
                    material: "${feature['building:material']}",
                    building: "${feature['building']}",
                    dist: "distance(vec2(${feature['cesium#longitude']}, ${feature['cesium#latitude']}), vec2(-79.37130, 43.64330))",
                },
                color: {
                    conditions: [
                        ["${building} === 'apartments' || ${building} === 'residential'", "mix(color('#dbe4ef', 1.0), color('" + accent + "', 1.0), 0.16)"],
                        ["${material} === 'glass'", "color('#d8f1ff', 1.0)"],
                        ["${material} === 'concrete'", "color('#bcc6d3', 1.0)"],
                        ["${material} === 'brick'", "color('#b88a78', 1.0)"],
                        ["${material} === 'stone'", "color('#a8b8cb', 1.0)"],
                        ["${material} === 'metal' || ${material} === 'steel'", "color('#d2dbe7', 1.0)"],
                        ["${dist} < 0.008", "mix(color('#eef6ff', 1.0), color('" + accent + "', 1.0), 0.08)"],
                        ["true", "color('#dfe6ef', 1.0)"],
                    ],
                },
            });
        } catch (styleErr) {
            console.warn('[CesiumSim] Could not apply vibe style:', styleErr);
        }
    }

    // ── Camera System ──────────────────────────────────────────────────────────

    /**
     * Toggle between Chase (GTA third-person) and Free (orbit) camera mode.
     */
    toggleCameraMode() {
        this.cameraMode = this.cameraMode === 'chase' ? 'free' : 'chase';
        if (this.cameraMode === 'chase') {
            this._startChaseCamera();
        } else {
            this._stopChaseCamera();
        }
        this._updateCameraModeUI();
    }

    /**
     * Start GTA-style chase camera using postUpdate.
     * Positions camera behind the car, tracking its velocity heading.
     */
    _startChaseCamera() {
        if (!this.viewer || !this.carEntity) return;
        this._stopChaseCamera(); // prevent duplicate listeners

        const LERP_FACTOR = 0.15; // Slightly more responsive follow

        // Persistent state for LERP
        this._lastCamHeading = null;

        this._chaseHandler = this.viewer.scene.postUpdate.addEventListener(() => {
            if (!this.carEntity || this.cameraMode !== 'chase') return;

            const time = this.viewer.clock.currentTime;
            const pos = this.carEntity.position.getValue(time);
            if (!pos) return;

            // Get car heading from its velocity-derived orientation
            let targetHeading = 0;
            const orientation = this.carEntity.orientation?.getValue(time);
            if (orientation) {
                const hpr = Cesium.HeadingPitchRoll.fromQuaternion(orientation);
                targetHeading = hpr.heading;
            }

            // Smoothing the heading to avoid jittery rotations
            if (this._lastCamHeading === null) this._lastCamHeading = targetHeading;
            
            // Handle angle wraparound for smooth Lerp
            let diff = targetHeading - this._lastCamHeading;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            this._lastCamHeading += diff * LERP_FACTOR;

            // lookAt places camera at (pos) + HeadingPitchRange offset
            // heading + π - π/2 puts camera *behind* the car if model is -90 deg offset
            const heading = this._lastCamHeading + this._cameraOrbit.headingOffset;
            const horizontalRange = Math.cos(this._cameraOrbit.pitch) * this._cameraOrbit.range;
            const upOffset = -Math.sin(this._cameraOrbit.pitch) * this._cameraOrbit.range;
            const east = -Math.sin(heading) * horizontalRange;
            const north = -Math.cos(heading) * horizontalRange;
            const targetTransform = Cesium.Transforms.eastNorthUpToFixedFrame(pos);
            const cameraOffset = new Cesium.Cartesian3(east, north, upOffset);
            this.viewer.camera.lookAtTransform(targetTransform, cameraOffset);
        });
    }

    /** Stop the chase camera listener, restoring free orbit. */
    _stopChaseCamera() {
        if (this._chaseHandler) {
            this._chaseHandler();
            this._chaseHandler = null;
        }
        // Unlock camera so Cesium's default controls work again
        if (this.viewer) this.viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    }

    /** Sync the HUD button label/icon to the current camera mode. */
    _updateCameraModeUI() {
        const iconEl  = document.getElementById('cameraModeIcon');
        const labelEl = document.getElementById('cameraModeLabel');
        if (this.cameraMode === 'chase') {
            if (iconEl)  iconEl.textContent  = '🎥';
            if (labelEl) labelEl.textContent = 'Chase';
        } else {
            if (iconEl)  iconEl.textContent  = '🌐';
            if (labelEl) labelEl.textContent = 'Free';
        }
    }

    // ── Drive Control ──────────────────────────────────────────────────────────

    startDrive() { 
        if (!this.viewer || !this._manualPos) return;
        if (!this._isManualDrive) {
            this.toggleManualDrive();
        }
        this._resetDriveTelemetry();
        this.viewer.scene.requestRenderMode = false;
        this.showToast("Guided drive active. You control speed and steering.");
    }
    
    endDrive() { 
        if (!this.viewer) return;
        this.viewer.clock.shouldAnimate = false;
        if (this._isManualDrive) {
            this.toggleManualDrive();
        }
    }

    getDriveData() { 
        return { 
            distance: this._currentDistanceMiles, 
            duration: this._currentElapsedSeconds,
            speed: this._currentSpeedMph, 
        }; 
    }

    async _loadInitialRoute(origin, destination, vibeId) {
        try {
            const api = await import('./cesiumRoutes.js');
            const routeData = await api.fetchDirectionsRoute(origin, destination, vibeId);
            if (!routeData.coordinates?.length) {
                throw new Error("Route response had no coordinates");
            }
            console.log("[CesiumSim] Real route fetched successfully:", routeData.coordinates.length, "waypoints");
            return routeData;
        } catch (err) {
            console.warn("[CesiumSim] Google Directions API issue, keeping fallback route:", err.message);
            return {
                ...this._createFallbackRouteData(origin, destination, vibeId),
                fallbackReason: err.message,
            };
        }
    }

    _dispatchRouteLoaded(routeData, startLocation) {
        window.dispatchEvent(new CustomEvent('routeLoaded', {
            detail: {
                origin: routeData.origin,
                destination: routeData.destination,
                coordinates: routeData.coordinates,
                steps: routeData.steps,
                distanceText: routeData.distanceText,
                durationText: routeData.durationText,
                distanceMeters: routeData.distanceMeters,
                durationSeconds: routeData.durationSeconds,
                startLocation,
                fallback: !!routeData.fallback,
                fallbackReason: routeData.fallbackReason,
            }
        }));
    }

    _createFallbackRouteData(origin, destination, vibeId = this.currentVibe) {
        const destinationPoints = {
            "Woodbine Beach, Toronto, ON": { lat: 43.6634, lng: -79.3067 },
            "Casa Loma, Toronto, ON": { lat: 43.6780, lng: -79.4094 },
            "High Park, Toronto, ON": { lat: 43.6465, lng: -79.4637 },
            "CN Tower, Toronto, ON": { lat: 43.6426, lng: -79.3871 },
        };
        const destPoint = destinationPoints[destination] || { lat: 43.6763, lng: -79.3986 };
        const midPoint = {
            lat: (origin.lat + destPoint.lat) / 2,
            lng: (origin.lng + destPoint.lng) / 2,
        };
        const coordinates = [
            [origin.lng, origin.lat],
            [midPoint.lng, midPoint.lat],
            [destPoint.lng, destPoint.lat],
        ];
        const distanceMeters = Math.round(this._estimateRouteDistanceMeters(coordinates));
        const durationSeconds = Math.max(180, Math.round(distanceMeters / (vibeId === "fastest" ? 12 : 8)));

        return {
            origin,
            destination,
            coordinates,
            steps: [
                {
                    instruction: `Head out from Lower Jarvis toward ${destination}.`,
                    distance: `${Math.max(1, Math.round(distanceMeters * 0.00035))} mi`,
                    startLocation: coordinates[0],
                    endLocation: coordinates[1],
                    distanceMeters: Math.round(distanceMeters * 0.45),
                    durationSeconds: Math.round(durationSeconds * 0.45),
                },
                {
                    instruction: `Continue through downtown Toronto toward the selected destination.`,
                    distance: `${Math.max(1, Math.round(distanceMeters * 0.00027))} mi`,
                    startLocation: coordinates[1],
                    endLocation: coordinates[2],
                    distanceMeters: Math.round(distanceMeters * 0.55),
                    durationSeconds: Math.round(durationSeconds * 0.55),
                },
            ],
            distanceText: `${Math.max(0.1, distanceMeters / 1609.34).toFixed(1)} mi`,
            durationText: `${Math.max(1, Math.round(durationSeconds / 60))} min`,
            distanceMeters,
            durationSeconds,
            fallback: true,
        };
    }

    _estimateRouteDistanceMeters(coordinates) {
        let total = 0;
        for (let i = 1; i < coordinates.length; i++) {
            const [lngA, latA] = coordinates[i - 1];
            const [lngB, latB] = coordinates[i];
            const latMeters = (latB - latA) * 111320;
            const lngMeters = (lngB - lngA) * 111320 * Math.cos(((latA + latB) / 2) * Math.PI / 180);
            total += Math.hypot(latMeters, lngMeters);
        }
        return total;
    }

    async loadRoute(origin, destination, vibeId) {
        try {
            const api = await import('./cesiumRoutes.js');
            const routeData = await api.fetchDirectionsRoute(origin, destination, vibeId);
            this.routeData = routeData;
            this.activeRoute = routeData.coordinates;
            if (!this.activeRoute?.length) {
                throw new Error("Route response had no coordinates");
            }
            
            // Re-draw route path
            this._drawActiveRoute(vibeId);
            this._manualPos = this._spawnPositionFromRoutePoint(this.activeRoute[0]);
            if (this.activeRoute.length > 1) {
                const p1 = this.activeRoute[0];
                const p2 = this.activeRoute[1];
                this._manualHeading = Math.atan2(p2[0] - p1[0], p2[1] - p1[1]);
            }
            this.startTime = Cesium.JulianDate.now();
            this._resetDriveTelemetry();
            
            if (this.carEntity && this.cameraMode === "chase") {
                this._startChaseCamera();
            }

            // Sync with MiniMap
            this.syncMiniMapRoute(vibeId);

            window.dispatchEvent(new CustomEvent('routeLoaded', {
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

            console.log("[CesiumSim] Dynamically loaded new route.");
        } catch (err) {
            console.warn("[CesiumSim] Failed to load live route; using fallback route:", err.message);
            const normalizedOrigin = Array.isArray(origin)
                ? { lat: Number(origin[0]), lng: Number(origin[1]) }
                : origin;
            const fallbackOrigin = normalizedOrigin?.lat && normalizedOrigin?.lng
                ? normalizedOrigin
                : { lat: 43.6444017, lng: -79.3692689 };
            const routeData = this._createFallbackRouteData(fallbackOrigin, destination, vibeId);
            this.routeData = routeData;
            this.activeRoute = routeData.coordinates;
            this._drawActiveRoute(vibeId);
            this._manualPos = this._spawnPositionFromRoutePoint(this.activeRoute[0]);
            if (this.activeRoute.length > 1) {
                const p1 = this.activeRoute[0];
                const p2 = this.activeRoute[1];
                this._manualHeading = Math.atan2(p2[0] - p1[0], p2[1] - p1[1]);
            }
            this._resetDriveTelemetry();
            this.syncMiniMapRoute(vibeId);
            window.dispatchEvent(new CustomEvent('routeLoaded', {
                detail: {
                    ...routeData,
                    startLocation: [fallbackOrigin.lng, fallbackOrigin.lat],
                    fallback: true,
                    fallbackReason: err.message,
                }
            }));
        }
    }

    setVibe(vibe) {
        this.currentVibe = vibe;
        this.applyVibeAesthetics(vibe);
    }

    setEnvironment(route) {
        const dest = this._resolveDestination(route);
        this.currentDestination = dest;
        if (!this._initialized || !this.viewer) {
            this.pendingEnvironment = route;
            return;
        }
        this.loadRoute("43.6433,-79.3713", dest, this.currentVibe || "scenic");
    }

    resize() { if (this.viewer) this.viewer.resize(); }

    _resolveDestination(route) {
        if (route === "coastal") return "Woodbine Beach, Toronto, ON";
        if (route === "mountain") return "Casa Loma, Toronto, ON";
        if (route === "forest") return "High Park, Toronto, ON";
        if (["scenic", "chill", "adventure", "fastest", "exciting", "quiet"].includes(route)) {
            return "Woodbine Beach, Toronto, ON";
        }
        return route || this.currentDestination;
    }

    _selectNearbyRoads(roads) {
        const anchorLng = -79.37130;
        const anchorLat = 43.64330;
        const bounds = {
            minLng: anchorLng - 0.085,
            maxLng: anchorLng + 0.085,
            minLat: anchorLat - 0.085,
            maxLat: anchorLat + 0.085,
        };
        const typeWeight = {
            motorway: 0,
            trunk: 1,
            primary: 2,
            secondary: 3,
            tertiary: 4,
            residential: 5,
            service: 6,
            unclassified: 7,
        };

        return roads
            .filter(road => road.coords.some(([lng, lat]) => (
                lng >= bounds.minLng && lng <= bounds.maxLng && lat >= bounds.minLat && lat <= bounds.maxLat
            )))
            .sort((a, b) => {
                const aWeight = typeWeight[a.type] ?? 99;
                const bWeight = typeWeight[b.type] ?? 99;
                if (aWeight !== bWeight) return aWeight - bWeight;
                return b.coords.length - a.coords.length;
            })
            .slice(0, this.performanceProfile.roadLimit ?? roads.length);
    }

    _clearRouteDecor() {
        if (!this.viewer || !this.routeDecorEntities.length) return;
        for (const entity of this.routeDecorEntities) {
            this.viewer.entities.remove(entity);
        }
        this.routeDecorEntities = [];
    }

    _addRouteGuideLights(routePositions, routeColor) {
        if (!this.viewer || routePositions.length < 2) return;

        const lightColor = Cesium.Color.fromAlpha(routeColor, 0.95);
        const count = Math.min(18, Math.floor(routePositions.length / 2));
        for (let i = 1; i < count; i++) {
            const idx = Math.min(routePositions.length - 1, i * Math.max(1, Math.floor(routePositions.length / count)));
            const position = routePositions[idx];
            this.routeDecorEntities.push(this.viewer.entities.add({
                position,
                point: {
                    pixelSize: 6,
                    color: lightColor,
                    outlineColor: Cesium.Color.WHITE.withAlpha(0.8),
                    outlineWidth: 1,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                }
            }));
        }
    }

    _resetDriveTelemetry() {
        this._totalDistanceMeters = 0;
        this._currentSpeedMph = 0;
        this._currentDistanceMiles = 0;
        this._currentElapsedSeconds = 0;
        this._lastTrackedPos = null;
        this._lastTime = this.viewer?.clock?.currentTime?.clone?.() || null;
        this._lastTelemetryTimestamp = performance.now();
        this._manualDriveStartTime = performance.now();
        this._renderTelemetry();
    }
}


