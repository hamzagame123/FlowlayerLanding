import * as Cesium from "cesium";
import "cesium/Build/Cesium/Widgets/widgets.css";
// import route APIs dynamically when needed or keep buildSampledRoute
import { buildSampledRoute } from "./cesiumRoutes.js";
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
        this.routeEntity = null;
        // Camera system
        this.cameraMode = 'chase'; // 'chase' | 'free'
        this._chaseHandler = null; // postUpdate listener reference

        // Manual Drive System
        this._isManualDrive = false;
        this._manualSpeed = 0;
        this._manualHeading = 0;
        this._manualPos = null;
        this._keysPressed = new Set();
        this.routeData = null;
        this.geoAnchor = null;
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
            this.showToast("Manual Drive: ON (WASD to Drive, L to Lock Cam)");
        } else {
            this.showToast("Manual Drive: OFF (Route Mode)");
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
            contextOptions: { allowTextureFilterAnisotropic: false },
        });

        this.viewer.scene.globe.show = false;
        this.viewer.scene.backgroundColor = Cesium.Color.fromCssColorString("#050508");
        this.viewer.scene.highDynamicRange = true;

        // Custom start: 4 Lower Jarvis Street, Toronto (On the road)
        const startLng = -79.37130;
        const startLat = 43.64330;
        this.geoAnchor = new GeoAnchor(startLat, startLng, this.GROUND_ALT);

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
            this.viewer.scene.primitives.add(this.tileset);
            this.applyVibeAesthetics(vibeId);
        } catch (e) { console.error("[CesiumSim] Tileset:", e); }

        const origin = { lat: startLat, lng: startLng };
        const destStr = "351 Davenport Road, Toronto, ON";

        try {
            const api = await import('./cesiumRoutes.js');
            const routeData = await api.fetchDirectionsRoute(origin, destStr, vibeId);
            this.routeData = routeData;
            this.activeRoute = routeData.coordinates;
            console.log("[CesiumSim] Real route fetched successfully:", this.activeRoute.length, "waypoints");
            
            // Dispatch event for UI/Gemini to pick up the turn-by-turn steps
            window.dispatchEvent(new CustomEvent('routeLoaded', { 
                detail: { 
                    origin: routeData.origin ?? { lat: startLat, lng: startLng },
                    destination: destStr,
                    coordinates: routeData.coordinates,
                    steps: routeData.steps,
                    distanceText: routeData.distanceText,
                    durationText: routeData.durationText,
                    distanceMeters: routeData.distanceMeters,
                    durationSeconds: routeData.durationSeconds,
                    startLocation: [startLng, startLat],
                } 
            }));
        } catch (err) {
            console.warn("[CesiumSim] Google Directions API issue, using fallback line:", err.message);
            this.routeData = null;
            this.activeRoute = [
                [-79.3713, 43.6423],
                [-79.3986, 43.6763]
            ];
        }

        const buildRouteModule = await import('./cesiumRoutes.js');
        const { positionProperty, start, stop } = buildRouteModule.buildSampledRoute(Cesium, this.activeRoute, 18, this.GROUND_ALT + 0.3);
        this.startTime = start;
        this._routeOrientation = new Cesium.VelocityOrientationProperty(positionProperty);

        this.viewer.clock.startTime = start.clone();
        this.viewer.clock.stopTime = stop.clone();
        this.viewer.clock.currentTime = start.clone();
        this.viewer.clock.clockRange = Cesium.ClockRange.CLAMPED;
        this.viewer.clock.shouldAnimate = false;

        // Calculate initial heading based on the first route segment
        let initialHeading = 0;
        if (this.activeRoute.length > 1) {
            const p1 = this.activeRoute[0];
            const p2 = this.activeRoute[1];
            // Delta longitude vs delta latitude for heading
            initialHeading = Math.atan2(p2[0] - p1[0], p2[1] - p1[1]);
        }

        this.carEntity = this.viewer.entities.add({
            position: new Cesium.CallbackProperty((time) => {
                if (this._isManualDrive && this._manualPos) return this._manualPos;
                return positionProperty.getValue(time);
            }, false),
            orientation: new Cesium.CallbackProperty((time) => {
                if (this._isManualDrive) {
                    return Cesium.Quaternion.fromHeadingPitchRoll(
                        new Cesium.HeadingPitchRoll(this._manualHeading, 0, 0)
                    );
                }
                return this._routeOrientation.getValue(time);
            }, false),
            model: {
                uri: "classic_muscle_car.glb",
                minimumPixelSize: 64,
                maximumScale: 20000,
                scale: 1.0, // Assuming 1:1 scale with Cesium meters
                runAnimations: true,
                shadows: Cesium.ShadowMode.ENABLED
            }
        });

        // Initialize route entity storage
        this.routeEntity = null;
        this._drawActiveRoute(vibeId);
        if (this.miniMap) {
            this.syncMiniMapRoute(vibeId);
        }

        // Fly into scene, then activate GTA-style chase camera
        setTimeout(() => {
            if (!this.viewer) return;
            this.viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(startLng, startLat, 300),
                orientation: { 
                    heading: initialHeading, 
                    pitch: Cesium.Math.toRadians(-30), 
                    roll: 0 
                },
                duration: 3.0,
                complete: () => {
                    this.cameraMode = 'chase';
                    this._startChaseCamera();
                    this._updateCameraModeUI();
                }
            });
        }, 2000);

        // Realtime Telemetry & MiniMap Update Hook
        this.viewer.clock.onTick.addEventListener((clock) => {
            if (!this.carEntity || !this.miniMap) return;
            
            // Manual Drive Update
            if (this._isManualDrive) {
                this._updateManualDrive(clock);
            }

            const pos = this.carEntity.position.getValue(clock.currentTime);
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
            this._updateTelemetry(clock, pos);
        });
    }

    syncMiniMapRoute(vibeId = this.currentVibe) {
        if (!this.miniMap || !this.activeRoute) return;
        const hexColor = vibeId === "exciting" ? "#ff00ff" : vibeId === "quiet" ? "#06d6a0" : "#00f5d4";
        this.miniMap.setRoute(this.activeRoute, hexColor);
    }

    _updateManualDrive(clock) {
        const dt = 1/60; // Assuming ~60fps for simple physics constants
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
    }

    _updateTelemetry(clock, currentPos) {
        if (!this.viewer.clock.shouldAnimate) return;

        // Initialize telemetry state if not present
        if (!this._lastPos) {
            this._lastPos = currentPos.clone();
            this._lastTime = clock.currentTime.clone();
            this._totalDistanceMeters = 0;
            return;
        }

        // Calculate time delta in seconds
        const dt = Cesium.JulianDate.secondsDifference(clock.currentTime, this._lastTime);
        if (dt <= 0) return;

        // Calculate distance delta in meters
        const distDelta = Cesium.Cartesian3.distance(this._lastPos, currentPos);
        this._totalDistanceMeters += distDelta;

        // Speed = d/t (m/s) -> convert to mph (1 m/s = 2.23694 mph)
        const speedMps = distDelta / dt;
        const speedMph = Math.round(speedMps * 2.23694);

        // Distance in miles
        const distanceMiles = (this._totalDistanceMeters * 0.000621371).toFixed(1);

        // Elapsed time formatted as mm:ss
        const elapsedSec = Math.floor(Cesium.JulianDate.secondsDifference(clock.currentTime, this.startTime));
        const mins = Math.floor(elapsedSec / 60);
        const secs = (elapsedSec % 60).toString().padStart(2, '0');

        // Update DOM elements
        const elSpeed = document.getElementById("speedDisplay");
        const elStatSpeed = document.getElementById("statSpeed");
        const elStatDist = document.getElementById("statDistance");
        const elStatTime = document.getElementById("statTime");

        if (elSpeed) elSpeed.textContent = speedMph;
        if (elStatSpeed) elStatSpeed.textContent = speedMph;
        if (elStatDist) elStatDist.textContent = distanceMiles;
        if (elStatTime) elStatTime.textContent = `${mins}:${secs}`;

        // Advance nav step cards based on distance travelled
        if (typeof this._advanceNavCards === 'function') {
            this._advanceNavCards(this._totalDistanceMeters);
        }

        // Save state for next tick
        this._lastPos = currentPos.clone();
        this._lastTime = clock.currentTime.clone();
    }

    _createVolumetricGround(vibeId) {
        const colors = {
            exciting: "#0a0814",
            quiet: "#0a1410",
            scenic: "#0c1525", 
        };
        const color = Cesium.Color.fromCssColorString(colors[vibeId] ?? colors.scenic);
        const outlineColor = Cesium.Color.fromCssColorString(vibeId === "exciting" ? "#ff00ff" : "#00f5d4").withAlpha(0.3);

        // 300km x 300km Massive Scale
        const bounds = Cesium.Rectangle.fromDegrees(-81.0, 42.0, -78.0, 45.0);

        this.groundEntity = this.viewer.entities.add({
            name: "World Monolith",
            rectangle: {
                coordinates: bounds,
                height: this.GROUND_ALT,
                extrudedHeight: this.GROUND_ALT - this.MONOLITH_DEPTH, // 10km depth
                material: color,
                outline: true,
                outlineColor: outlineColor,
            }
        });
    }

    async _createRoadNetwork(vibeId) {
        const alt = this.GROUND_ALT + 0.05; // Lower altitude, closer to surface
        const colorHex = vibeId === "exciting" ? "#ff00ff" : vibeId === "quiet" ? "#06d6a0" : "#00f5d4";

        // Road width by importance
        const widthMap = {
            motorway: 5, trunk: 5, primary: 4, secondary: 3,
            tertiary: 2.5, residential: 2, service: 1.5, unclassified: 2
        };

        try {
            const res = await fetch("/toronto_roads.json");
            const data = await res.json();
            console.log(`[CesiumSim] Loading ${data.count} real OSM roads`);

            const lineColor = Cesium.Color.fromCssColorString(colorHex).withAlpha(0.5);
            const majorColor = Cesium.Color.fromCssColorString(colorHex).withAlpha(0.8);

            for (const road of data.roads) {
                if (road.coords.length < 2) continue;

                const flat = [];
                for (const [lng, lat] of road.coords) {
                    flat.push(lng, lat, alt);
                }

                const isMajor = ["motorway", "trunk", "primary", "secondary"].includes(road.type);
                const w = widthMap[road.type] || 2;

                this.viewer.entities.add({
                    polyline: {
                        positions: Cesium.Cartesian3.fromDegreesArrayHeights(flat),
                        width: w,
                        material: isMajor ? majorColor : lineColor,
                        clampToGround: false
                    }
                });
            }
        } catch (e) {
            console.warn("[CesiumSim] Could not load road data:", e);
        }
    }

    _drawActiveRoute(vibeId) {
        if (this.routeEntity) this.viewer.entities.remove(this.routeEntity);

        const color = Cesium.Color.fromCssColorString(vibeId === "exciting" ? "#ff00ff" : "#00f5d4");
        this.routeEntity = this.viewer.entities.add({
            polyline: {
                positions: this.activeRoute.map(c => Cesium.Cartesian3.fromDegrees(c[0], c[1], this.GROUND_ALT + 0.1)),
                width: 8,
                material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.3, color: color }),
            }
        });
    }

    applyVibeAesthetics(vibeId) {
        if (!this.tileset) return;
        this.viewer.scene.postProcessStages.bloom.enabled = true;

        // Per-vibe building color palettes — flat single-color for maximum compatibility
        // Height conditions cause RuntimeError on OSM tiles that lack 'height' metadata.
        // Simple colour expression is guaranteed safe.
        const vibeColors = {
            scenic:    "color('#c8a96e', 0.85)",  // warm amber / sandstone — Archivist
            chill:     "color('#00f5d4', 0.80)",  // teal / mint — Pulse
            adventure: "color('#f72585', 0.90)",  // hot magenta — Director
            fastest:   "color('#8090a0', 0.85)",  // steel grey — Optimizer
            // internal aliases
            exciting:  "color('#f72585', 0.90)",
            quiet:     "color('#00f5d4', 0.80)",
        };

        const colorExpr = vibeColors[vibeId] ?? vibeColors.scenic;

        try {
            this.tileset.style = new Cesium.Cesium3DTileStyle({ color: colorExpr });
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

        const BEHIND_DIST = 18;   // metres behind (zoomed out)
        const ABOVE_DIST  = 6;    // metres above (zoomed out)
        const PITCH       = Cesium.Math.toRadians(-12); // looking slightly down
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
            this.viewer.camera.lookAt(
                pos,
                new Cesium.HeadingPitchRange(
                    this._lastCamHeading + Math.PI - Math.PI/2, 
                    PITCH,
                    Math.sqrt(BEHIND_DIST * BEHIND_DIST + ABOVE_DIST * ABOVE_DIST)
                )
            );
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
        if (this.viewer?.clock && this.startTime) {
            // Force reset to start of sampled route
            this.viewer.clock.currentTime = this.startTime.clone();
            this.viewer.clock.shouldAnimate = true;
            this.viewer.clock.multiplier = 1.0;
        } 
    }
    
    endDrive() { 
        if (this.viewer?.clock) this.viewer.clock.shouldAnimate = false; 
    }

    getDriveData() { 
        const isRunning = this.viewer?.clock?.shouldAnimate;
        return { 
            distance: isRunning ? 0.4 : 0.0, 
            duration: isRunning ? 200 : 0,
            speed: isRunning ? 18 : 0 
        }; 
    }
    async loadRoute(origin, destination, vibeId) {
        try {
            const api = await import('./cesiumRoutes.js');
            const routeData = await api.fetchDirectionsRoute(origin, destination, vibeId);
            this.routeData = routeData;
            this.activeRoute = routeData.coordinates;
            
            // Re-draw route path
            this._drawActiveRoute(vibeId);

            // Update car animation path
            const { positionProperty, start, stop } = api.buildSampledRoute(Cesium, this.activeRoute, 18, this.GROUND_ALT + 0.3);
            this.startTime = start;

            this.viewer.clock.startTime = start.clone();
            this.viewer.clock.stopTime = stop.clone();
            this.viewer.clock.currentTime = start.clone();
            
            if (this.carEntity) {
                this.carEntity.position = positionProperty;
                this.carEntity.orientation = new Cesium.VelocityOrientationProperty(positionProperty);
                this.carEntity.box.outlineColor = vibeId === "exciting" ? Cesium.Color.FUCHSIA : Cesium.Color.AQUA;
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
            console.error("[CesiumSim] Failed to load new route:", err);
        }
    }

    setVibe(vibe) {
        this.currentVibe = vibe;
        this.applyVibeAesthetics(vibe);

        // Update car outline colour while preserving geometry
        if (this.carEntity?.box) {
            const accentColors = {
                scenic: Cesium.Color.fromCssColorString('#c8a96e'),
                chill: Cesium.Color.AQUA,
                adventure: Cesium.Color.FUCHSIA,
                fastest: Cesium.Color.fromCssColorString('#8090a0'),
            };
            this.carEntity.box.outlineColor = accentColors[vibe] ?? Cesium.Color.AQUA;
        }
    }

    setEnvironment(route) {
        // Here `route` is a string like 'coastal', 'mountain', or custom destination
        let dest = route;
        if (route === "coastal") dest = "Woodbine Beach, Toronto";
        else if (route === "mountain") dest = "Casa Loma, Toronto";
        else if (route === "forest") dest = "High Park, Toronto";

        this.currentDestination = dest;
        this.loadRoute("43.6433,-79.3713", dest, this.currentVibe || "scenic");
    }

    resize() { if (this.viewer) this.viewer.resize(); }
}
