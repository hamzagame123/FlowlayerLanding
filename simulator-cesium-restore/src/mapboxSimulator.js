import mapboxgl from "mapbox-gl/dist/mapbox-gl-csp";
import MapboxWorker from "mapbox-gl/dist/mapbox-gl-csp-worker?worker";
import "mapbox-gl/dist/mapbox-gl.css";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { fetchGoogleDirectionsRoute } from "./routeService.js";

mapboxgl.workerClass = MapboxWorker;

const TORONTO_ORIGIN = { lat: 43.6433, lng: -79.3713 };
const VIBE_COLORS = {
    scenic: "#ff5cff",
    chill: "#68d9ff",
    adventure: "#00ffe1",
    fastest: "#ff9f1c",
};

const LEGACY_MAPBOX_SKIN = {
    void: "#020912",
    water: "#031a2a",
    land: "#05070a",
    road: "#1e2629",
    grid: "#00f5d4",
    gridHot: "#00ff91",
    buildingBase: "#77786b",
    buildingTop: "#c7c8ba",
    buildingLine: "#d6d8ca",
};

const ROUTE_DESTINATIONS = {
    coastal: "CN Tower, Toronto, ON",
    mountain: "Casa Loma, Toronto, ON",
    forest: "High Park, Toronto, ON",
};

const CAMERA_PRESET_STORAGE_KEY = "flowlayer_chase_camera_preset_v1";
const DEFAULT_CAMERA_PADDING = { top: 18, right: 320, bottom: 540, left: 70 };
const DEFAULT_CHASE_CAMERA = {
    zoom: 21.65,
    pitch: 82.4,
    lookAheadMeters: 0.85,
    sideMeters: 0,
    bearingOffset: 0,
};

const STREET_LAYER_COPY = {
    scenic: "Open waterfront lines and gentle city flow.",
    chill: "Calm urban movement with low-pressure turns.",
    adventure: "Denser city rhythm with sharper directional beats.",
    fastest: "Direct corridor pacing with stronger forward pull.",
};


function toLngLat(point) {
    if (Array.isArray(point)) return [Number(point[0]), Number(point[1])];
    if (point && Number.isFinite(point.lng) && Number.isFinite(point.lat)) return [point.lng, point.lat];
    return [TORONTO_ORIGIN.lng, TORONTO_ORIGIN.lat];
}

function distanceMeters(a, b) {
    const [lng1, lat1] = a.map(Number);
    const [lng2, lat2] = b.map(Number);
    const earth = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const s1 = Math.sin(dLat / 2);
    const s2 = Math.sin(dLng / 2);
    const h = s1 * s1 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * s2 * s2;
    return 2 * earth * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function bearingDegrees(a, b) {
    const [lng1, lat1] = a.map(value => value * Math.PI / 180);
    const [lng2, lat2] = b.map(value => value * Math.PI / 180);
    const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function interpolateLngLat(a, b, t) {
    return [
        a[0] + (b[0] - a[0]) * t,
        a[1] + (b[1] - a[1]) * t,
    ];
}

function wrapDegrees(value) {
    return (value % 360 + 360) % 360;
}

function signedDegrees(value) {
    const wrapped = ((value + 180) % 360 + 360) % 360 - 180;
    return wrapped === -180 ? 180 : wrapped;
}

function clamp(value, min, max) {
    if (!Number.isFinite(value)) return min;
    return Math.max(min, Math.min(max, value));
}

function metersToLng(meters, latitude) {
    return meters / (111320 * Math.cos(latitude * Math.PI / 180));
}

function metersToLat(meters) {
    return meters / 110540;
}

function offsetLngLat(point, headingDegrees, sideMeters, forwardMeters = 0) {
    const [lng, lat] = point;
    const heading = headingDegrees * Math.PI / 180;
    const lateralHeading = heading + Math.PI / 2;
    const deltaLng =
        metersToLng(Math.sin(heading) * forwardMeters, lat) +
        metersToLng(Math.sin(lateralHeading) * sideMeters, lat);
    const deltaLat =
        metersToLat(Math.cos(heading) * forwardMeters) +
        metersToLat(Math.cos(lateralHeading) * sideMeters);

    return [lng + deltaLng, lat + deltaLat];
}

function routeIdentity(destination, vibeId) {
    const normalizedDestination = typeof destination === "string"
        ? destination.trim().toLowerCase()
        : JSON.stringify(destination || {});
    return `${normalizedDestination}::${String(vibeId || "scenic").toLowerCase()}`;
}

export class MapboxSimulator {
    constructor(containerId, accessToken) {
        this.containerId = containerId;
        this.accessToken = accessToken || import.meta.env.VITE_MAPBOX_ACCESS_TOKEN;
        this.map = null;
        this.marker = null;
        this.miniMap = null;
        this.currentVibe = "scenic";
        this.currentRoute = "coastal";
        this.currentDestination = ROUTE_DESTINATIONS.coastal;
        this.routeData = null;
        this.routeCoordinates = [];
        this.routeDistanceMeters = 0;
        this.segmentDistances = [];
        this.segmentIndex = 0;
        this.segmentProgressMeters = 0;
        this.currentLngLat = [TORONTO_ORIGIN.lng, TORONTO_ORIGIN.lat];
        this.currentHeading = 0;
        this.cameraMode = "chase";
        this._keysPressed = new Set();
        this._frame = null;
        this._lastFrameTime = null;
        this._manualSpeed = 0;
        this._targetSpeed = 24;
        this._steeringAngle = 0;
        this._isManualDrive = false;
        this.driveMode = "route";
        this.isDriving = false;
        this.startTime = null;
        this._currentSpeedMph = 0;
        this._currentDistanceMiles = 0;
        this._currentElapsedSeconds = 0;
        this._styleInitialized = false;
        this._streetMemory = {
            pods: [],
            witnesses: [],
        };
        this._carLayerId = "flowlayer-car-model";
        this._signalLayerId = "flowlayer-traffic-signals";
        this._carModelReady = false;
        this._threeCar = {
            scene: null,
            camera: null,
            renderer: null,
            root: null,
            model: null,
            loader: null,
        };
        this._threeSignals = {
            scene: null,
            camera: null,
            renderer: null,
            root: null,
        };
        this._trafficSignals = [];
        this._nearbyPlaces = [];
        this._nearbyPlaceMarkers = [];
        this._chaseCamera = {
            ...DEFAULT_CHASE_CAMERA,
            ...this._loadSavedCameraPreset(),
            activePointerId: null,
            dragging: false,
            lastX: 0,
            lastY: 0,
        };
        this._cameraPadding = { ...DEFAULT_CAMERA_PADDING };
        this._startupIntroPlayed = false;
        this._cameraScriptLock = false;
        this._cameraScriptToken = 0;
        this._activeRouteIdentity = "";
        this._setupKeyboardListeners();
    }

    _setupKeyboardListeners() {
        window.addEventListener("keydown", event => {
            this._keysPressed.add(event.key.toLowerCase());
            if (event.key.toLowerCase() === "m") this.toggleManualDrive();
            if (event.key.toLowerCase() === "l") this.toggleCameraMode();
        });
        window.addEventListener("keyup", event => {
            this._keysPressed.delete(event.key.toLowerCase());
        });
    }

    async init(vibeId = "scenic") {
        if (this.map) return;
        if (!this.accessToken) {
            throw new Error("Missing VITE_MAPBOX_ACCESS_TOKEN for Mapbox simulator.");
        }

        this.currentVibe = vibeId;
        mapboxgl.accessToken = this.accessToken;

        const container = document.getElementById(this.containerId);
        if (!container) throw new Error(`Missing simulator container: ${this.containerId}`);
        container.classList.add("mapbox-simulator-container");
        this._fallbackCity = document.createElement("div");
        this._fallbackCity.className = "flowlayer-fallback-city";
        this._fallbackCity.setAttribute("aria-hidden", "true");
        container.appendChild(this._fallbackCity);

        this.map = new mapboxgl.Map({
            container,
            style: "mapbox://styles/mapbox/standard",
            config: {
                basemap: {
                    theme: "monochrome",
                    lightPreset: "night",
                    show3dObjects: false,
                    show3dBuildings: false,
                    show3dTrees: false,
                    show3dLandmarks: false,
                    show3dFacades: false,
                    showPointOfInterestLabels: false,
                    showTransitLabels: false,
                    showPedestrianRoads: true,
                    colorWater: LEGACY_MAPBOX_SKIN.water,
                    colorRoads: LEGACY_MAPBOX_SKIN.road,
                    colorGreenspace: "#17241d",
                },
            },
            center: this.currentLngLat,
            zoom: 18.9,
            pitch: 84,
            bearing: -22,
            projection: "mercator",
            antialias: true,
            attributionControl: false,
        });

        this.map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "bottom-right");
        this._setupPointerControls();
        this._applyCameraInteractionMode();
        this._createCarMarker();
        this._startLoop();
        this._initializeStyleWhenReady(vibeId);
    }

    _setupPointerControls() {
        const canvas = this.map?.getCanvas?.();
        if (!canvas) return;

        const endDrag = (event) => {
            if (this._chaseCamera.activePointerId !== event.pointerId) return;
            this._chaseCamera.dragging = false;
            this._chaseCamera.activePointerId = null;
            canvas.releasePointerCapture?.(event.pointerId);
        };

        canvas.addEventListener("pointerdown", event => {
            if (this.cameraMode !== "chase") return;
            event.preventDefault();
            this._chaseCamera.dragging = true;
            this._chaseCamera.activePointerId = event.pointerId;
            this._chaseCamera.lastX = event.clientX;
            this._chaseCamera.lastY = event.clientY;
            canvas.setPointerCapture?.(event.pointerId);
        });

        canvas.addEventListener("pointermove", event => {
            if (this.cameraMode !== "chase" || !this._chaseCamera.dragging || this._chaseCamera.activePointerId !== event.pointerId) return;
            event.preventDefault();
            const dx = event.clientX - this._chaseCamera.lastX;
            const dy = event.clientY - this._chaseCamera.lastY;
            this._chaseCamera.lastX = event.clientX;
            this._chaseCamera.lastY = event.clientY;

            this._chaseCamera.bearingOffset = Math.max(-55, Math.min(55, this._chaseCamera.bearingOffset - dx * 0.18));
            this._chaseCamera.pitch = Math.max(68, Math.min(86, this._chaseCamera.pitch - dy * 0.05));
            this._syncPosition();
        });

        canvas.addEventListener("pointerup", endDrag);
        canvas.addEventListener("pointercancel", endDrag);
        canvas.addEventListener("contextmenu", event => event.preventDefault());
        canvas.addEventListener("wheel", event => {
            if (this.cameraMode !== "chase") return;
            event.preventDefault();
            this._chaseCamera.zoom = Math.max(19.4, Math.min(22.2, this._chaseCamera.zoom - (event.deltaY * 0.0022)));
            this._syncPosition();
        }, { passive: false });
    }

    _setHandlerEnabled(handler, enabled) {
        if (!handler) return;
        if (enabled) handler.enable();
        else handler.disable();
    }

    _applyCameraInteractionMode() {
        if (!this.map) return;
        const freeLook = this.cameraMode === "free";
        this._setHandlerEnabled(this.map.dragPan, freeLook);
        this._setHandlerEnabled(this.map.scrollZoom, freeLook);
        this._setHandlerEnabled(this.map.boxZoom, false);
        this._setHandlerEnabled(this.map.dragRotate, freeLook);
        this._setHandlerEnabled(this.map.doubleClickZoom, freeLook);
        this._setHandlerEnabled(this.map.keyboard, false);
        this._setHandlerEnabled(this.map.touchZoomRotate, freeLook);
        const canvas = this.map.getCanvas?.();
        if (canvas) {
            canvas.style.cursor = freeLook ? "grab" : "default";
        }
    }

    _measureRelativeOffset(fromPoint, originPoint, headingDegrees) {
        const [originLng, originLat] = originPoint;
        const [targetLng, targetLat] = fromPoint;
        const eastMeters = (targetLng - originLng) * 111320 * Math.cos(originLat * Math.PI / 180);
        const northMeters = (targetLat - originLat) * 110540;
        const heading = headingDegrees * Math.PI / 180;
        return {
            forwardMeters: eastMeters * Math.sin(heading) + northMeters * Math.cos(heading),
            sideMeters: eastMeters * Math.cos(heading) - northMeters * Math.sin(heading),
        };
    }

    _captureChaseCameraFromMap() {
        if (!this.map) return null;
        const center = this.map.getCenter();
        const zoom = clamp(this.map.getZoom(), 19.4, 22.6);
        const pitch = clamp(this.map.getPitch(), 68, 86);
        const absoluteBearing = wrapDegrees(this.map.getBearing());
        const bearingOffset = clamp(signedDegrees(absoluteBearing - this.currentHeading), -95, 95);
        const chaseBearing = wrapDegrees(this.currentHeading + bearingOffset);
        const offset = this._measureRelativeOffset([center.lng, center.lat], this.currentLngLat, chaseBearing);

        this._chaseCamera.zoom = zoom;
        this._chaseCamera.pitch = pitch;
        this._chaseCamera.bearingOffset = bearingOffset;
        this._chaseCamera.lookAheadMeters = clamp(offset.forwardMeters, 0.1, 12);
        this._chaseCamera.sideMeters = clamp(offset.sideMeters, -8, 8);

        return {
            zoom: this._chaseCamera.zoom,
            pitch: this._chaseCamera.pitch,
            bearingOffset: this._chaseCamera.bearingOffset,
            lookAheadMeters: this._chaseCamera.lookAheadMeters,
            sideMeters: this._chaseCamera.sideMeters,
        };
    }

    _loadSavedCameraPreset() {
        try {
            const saved = localStorage.getItem(CAMERA_PRESET_STORAGE_KEY);
            if (!saved) return null;
            const parsed = JSON.parse(saved);
            return {
                zoom: clamp(Number(parsed.zoom), 19.4, 22.6),
                pitch: clamp(Number(parsed.pitch), 68, 86),
                lookAheadMeters: clamp(Number(parsed.lookAheadMeters), 0.1, 12),
                sideMeters: clamp(Number(parsed.sideMeters || 0), -8, 8),
                bearingOffset: clamp(Number(parsed.bearingOffset), -95, 95),
            };
        } catch {
            return null;
        }
    }

    saveCameraAsDefault() {
        const preset = this._captureChaseCameraFromMap() || {
            zoom: this._chaseCamera.zoom,
            pitch: this._chaseCamera.pitch,
            lookAheadMeters: this._chaseCamera.lookAheadMeters,
            sideMeters: this._chaseCamera.sideMeters,
            bearingOffset: this._chaseCamera.bearingOffset,
        };
        localStorage.setItem(CAMERA_PRESET_STORAGE_KEY, JSON.stringify(preset));
        return preset;
    }

    _waitForMapMoveEnd(timeoutMs = 6000) {
        return new Promise(resolve => {
            if (!this.map) {
                resolve();
                return;
            }

            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                this.map.off("moveend", finish);
                resolve();
            };

            const timer = setTimeout(finish, timeoutMs);
            this.map.once("moveend", finish);
        });
    }

    _waitForMapIdle(timeoutMs = 2500) {
        return new Promise(resolve => {
            if (!this.map) {
                resolve();
                return;
            }

            let settled = false;
            const finish = () => {
                if (settled) return;
                settled = true;
                clearTimeout(timer);
                this.map.off("idle", finish);
                resolve();
            };

            const timer = setTimeout(finish, timeoutMs);
            this.map.once("idle", finish);
        });
    }

    async _playStartupIntro() {
        if (!this.map || this._startupIntroPlayed) return;

        const token = ++this._cameraScriptToken;
        this._cameraScriptLock = true;

        const torontoReveal = [-79.3874, 43.6256];
        const skylineApproach = [-79.3862, 43.6368];
        const waterfrontGlide = [-79.3819, 43.6426];
        const routeReveal = offsetLngLat(
            this.currentLngLat,
            wrapDegrees(this.currentHeading - 10),
            -2.5,
            44
        );
        const chaseBearing = wrapDegrees(this.currentHeading + this._chaseCamera.bearingOffset);
        const finalCenter = offsetLngLat(
            this.currentLngLat,
            chaseBearing,
            this._chaseCamera.sideMeters,
            this._chaseCamera.lookAheadMeters
        );

        this.map.jumpTo({
            center: torontoReveal,
            zoom: 11.8,
            pitch: 52,
            bearing: 4,
        });

        await this._waitForMapIdle(1800);
        await new Promise(resolve => setTimeout(resolve, 900));
        if (token !== this._cameraScriptToken) return;

        this.map.flyTo({
            center: skylineApproach,
            zoom: 13.35,
            pitch: 60,
            bearing: 8,
            duration: 6400,
            curve: 1.08,
            speed: 0.12,
            essential: true,
        });
        await this._waitForMapMoveEnd();
        await this._waitForMapIdle(1600);
        await new Promise(resolve => setTimeout(resolve, 550));
        if (token !== this._cameraScriptToken) return;

        this.map.easeTo({
            center: waterfrontGlide,
            zoom: 15.7,
            pitch: 70,
            bearing: -12,
            duration: 5000,
            easing: t => 1 - Math.pow(1 - t, 2.2),
        });
        await this._waitForMapMoveEnd();
        await this._waitForMapIdle(1400);
        await new Promise(resolve => setTimeout(resolve, 450));
        if (token !== this._cameraScriptToken) return;

        this.map.easeTo({
            center: routeReveal,
            zoom: 17.95,
            pitch: 77,
            bearing: wrapDegrees(chaseBearing - 10),
            duration: 3400,
            easing: t => 1 - Math.pow(1 - t, 2.6),
        });
        await this._waitForMapMoveEnd();
        await this._waitForMapIdle(1200);
        await new Promise(resolve => setTimeout(resolve, 220));
        if (token !== this._cameraScriptToken) return;

        this.map.easeTo({
            center: finalCenter,
            zoom: this._chaseCamera.zoom,
            pitch: this._chaseCamera.pitch,
            bearing: chaseBearing,
            padding: this._cameraPadding,
            duration: 2400,
            easing: t => 1 - Math.pow(1 - t, 3),
        });
        await this._waitForMapMoveEnd();

        if (token === this._cameraScriptToken) {
            this._cameraScriptLock = false;
            this._startupIntroPlayed = true;
            this._syncPosition();
        }
    }

    _initializeStyleWhenReady(vibeId) {
        const finish = async () => {
            if (this._styleInitialized || !this.map?.isStyleLoaded?.()) return;
            this._styleInitialized = true;
            if (this._fallbackCity) this._fallbackCity.style.display = "none";
            this._applyLegacyMapboxSkin(vibeId);
            this._add3dCarLayer();
            this._add3dSignalLayer();
            this.applyVibeAesthetics(vibeId);
            await this.loadRoute(TORONTO_ORIGIN, this.currentDestination, vibeId, {
                forceReset: this.routeCoordinates.length < 2,
            });
        };

        this.map.once("load", finish);
        this.map.once("style.load", finish);

        const poll = setInterval(() => {
            if (this._styleInitialized) {
                clearInterval(poll);
                return;
            }
            finish();
        }, 300);

        setTimeout(() => {
            if (this._styleInitialized) return;
            clearInterval(poll);
            console.warn("[MapboxSim] Map style is still loading; using fallback route state until Mapbox is ready.");
            document.getElementById(this.containerId)?.classList.add("mapbox-style-timeout");
            const fallback = this._createFallbackRouteData(TORONTO_ORIGIN, this.currentDestination, vibeId, "Mapbox style load timeout");
            this.routeData = fallback;
            this.routeCoordinates = fallback.coordinates;
            this.segmentDistances = this.routeCoordinates.slice(0, -1).map((point, index) => distanceMeters(point, this.routeCoordinates[index + 1]));
            this.routeDistanceMeters = this.segmentDistances.reduce((sum, value) => sum + value, 0);
            this._activeRouteIdentity = routeIdentity(this.currentDestination, vibeId);
            this.currentLngLat = this.routeCoordinates[0];
            this.currentHeading = bearingDegrees(this.routeCoordinates[0], this.routeCoordinates[1]);
            this._syncPosition();
            this.syncMiniMapRoute(vibeId);
            this._rebuildTrafficSignals();
            this._rebuildStreetMemory(vibeId);
            this._dispatchRouteLoaded(fallback);
        }, 8000);
    }

    _createCarMarker() {
        const el = document.createElement("div");
        el.className = "mapbox-car-marker";
        el.innerHTML = `<span></span>`;
        this.marker = new mapboxgl.Marker({ element: el, rotationAlignment: "map", pitchAlignment: "map" })
            .setLngLat(this.currentLngLat)
            .addTo(this.map);
    }

    _add3dCarLayer() {
        if (!this.map || this.map.getLayer(this._carLayerId)) return;

        const customLayer = {
            id: this._carLayerId,
            type: "custom",
            renderingMode: "3d",
            onAdd: (map, gl) => {
                const scene = new THREE.Scene();
                const camera = new THREE.Camera();
                const renderer = new THREE.WebGLRenderer({
                    canvas: map.getCanvas(),
                    context: gl,
                    antialias: true,
                });
                renderer.autoClear = false;

                const hemi = new THREE.HemisphereLight(0xdff7ff, 0x10131c, 1.55);
                scene.add(hemi);

                const dir = new THREE.DirectionalLight(0xffffff, 1.65);
                dir.position.set(18, 22, 28);
                scene.add(dir);

                const root = new THREE.Group();
                scene.add(root);

                this._threeCar.scene = scene;
                this._threeCar.camera = camera;
                this._threeCar.renderer = renderer;
                this._threeCar.root = root;
                this._threeCar.loader = new GLTFLoader();

                this._threeCar.loader.load(
                    `${import.meta.env.BASE_URL || "/"}classic_muscle_car.glb`,
                    gltf => {
                        const model = gltf.scene;
                        const bounds = new THREE.Box3().setFromObject(model);
                        const size = bounds.getSize(new THREE.Vector3());
                        const maxDim = Math.max(size.x, size.y, size.z) || 1;
                        const scale = 6.2 / maxDim;
                        model.scale.setScalar(scale);
                        model.position.set(0, 0, 0);
                        model.traverse(child => {
                            if (child.isMesh) {
                                child.castShadow = true;
                                child.receiveShadow = true;
                            }
                        });
                        root.add(model);
                        this._threeCar.model = model;
                        this._carModelReady = true;
                        this.marker?.getElement?.().classList.add("is-hidden");
                    },
                    undefined,
                    error => {
                        console.warn("[MapboxSim] Could not load 3D car model:", error);
                    }
                );
            },
            render: (gl, matrix) => {
                const { scene, camera, renderer, root } = this._threeCar;
                if (!scene || !camera || !renderer || !root) return;

                const mercator = mapboxgl.MercatorCoordinate.fromLngLat(
                    { lng: this.currentLngLat[0], lat: this.currentLngLat[1] },
                    0.15
                );
                const scale = mercator.meterInMercatorCoordinateUnits();
                const headingRadians = ((180 - this.currentHeading) * Math.PI) / 180;

                const translation = new THREE.Matrix4().makeTranslation(
                    mercator.x,
                    mercator.y,
                    mercator.z
                );
                const scaleMatrix = new THREE.Matrix4().makeScale(scale, -scale, scale);
                const rotationZ = new THREE.Matrix4().makeRotationAxis(
                    new THREE.Vector3(0, 0, 1),
                    headingRadians
                );
                const rotationX = new THREE.Matrix4().makeRotationAxis(
                    new THREE.Vector3(1, 0, 0),
                    Math.PI / 2
                );

                const mapMatrix = new THREE.Matrix4().fromArray(matrix);
                const modelTransform = new THREE.Matrix4()
                    .multiply(translation)
                    .multiply(scaleMatrix)
                    .multiply(rotationZ)
                    .multiply(rotationX);

                camera.projectionMatrix = mapMatrix.multiply(modelTransform);
                renderer.resetState();
                renderer.render(scene, camera);
                this.map.triggerRepaint();
            },
        };

        const labelLayerId = this.map.getStyle().layers.find(layer => layer.type === "symbol")?.id;
        this.map.addLayer(customLayer, labelLayerId);
    }

    _add3dSignalLayer() {
        if (!this.map || this.map.getLayer(this._signalLayerId)) return;

        const customLayer = {
            id: this._signalLayerId,
            type: "custom",
            renderingMode: "3d",
            onAdd: (map, gl) => {
                const scene = new THREE.Scene();
                const camera = new THREE.Camera();
                const renderer = new THREE.WebGLRenderer({
                    canvas: map.getCanvas(),
                    context: gl,
                    antialias: true,
                });
                renderer.autoClear = false;

                const ambient = new THREE.AmbientLight(0xb6d7f5, 1.25);
                scene.add(ambient);

                const fill = new THREE.DirectionalLight(0xffffff, 1.35);
                fill.position.set(20, 18, 30);
                scene.add(fill);

                const root = new THREE.Group();
                scene.add(root);

                this._threeSignals.scene = scene;
                this._threeSignals.camera = camera;
                this._threeSignals.renderer = renderer;
                this._threeSignals.root = root;
                this._rebuildTrafficSignals();
            },
            render: (gl, matrix) => {
                const { scene, camera, renderer } = this._threeSignals;
                if (!scene || !camera || !renderer) return;

                camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);
                renderer.resetState();
                renderer.render(scene, camera);
                this.map.triggerRepaint();
            },
        };

        const labelLayerId = this.map.getStyle().layers.find(layer => layer.type === "symbol")?.id;
        this.map.addLayer(customLayer, labelLayerId);
    }

    _clearTrafficSignals() {
        const root = this._threeSignals.root;
        if (!root) {
            this._trafficSignals = [];
            return;
        }

        for (const signal of this._trafficSignals) {
            root.remove(signal.group);
        }
        this._trafficSignals = [];
    }

    _createSignalPlacement(point, heading, laneSide = 1, distanceBack = 10, lateralOffset = 6.4) {
        return {
            lngLat: offsetLngLat(point, heading, laneSide * lateralOffset, -distanceBack),
            heading,
        };
    }

    _deriveTrafficSignalPlacements() {
        const placements = [];
        const steps = this.routeData?.steps || [];

        steps.forEach((step, index) => {
            const start = step?.startLocation ? toLngLat(step.startLocation) : null;
            const end = step?.endLocation ? toLngLat(step.endLocation) : null;
            if (!start || !end) return;

            const heading = bearingDegrees(start, end);
            const instruction = String(step?.instruction || "").toLowerCase();
            const isIntersectionCandidate = /turn|merge|ramp|approach|intersection|left|right/.test(instruction) || index < 2;
            if (!isIntersectionCandidate) return;

            placements.push(this._createSignalPlacement(end, heading, 1, 16, 8.4));
            placements.push(this._createSignalPlacement(end, heading, -1, 10, 9.2));
        });

        if (!placements.length && this.routeCoordinates.length > 2) {
            for (let i = 1; i < this.routeCoordinates.length - 1; i += 2) {
                const start = this.routeCoordinates[i - 1];
                const end = this.routeCoordinates[i];
                const heading = bearingDegrees(start, end);
                placements.push(this._createSignalPlacement(end, heading, 1, 16, 8.2));
                placements.push(this._createSignalPlacement(end, heading, -1, 10, 9));
            }
        }

        return placements.slice(0, 6);
    }

    _createTrafficSignalMesh(index, placement) {
        const mercator = mapboxgl.MercatorCoordinate.fromLngLat(
            { lng: placement.lngLat[0], lat: placement.lngLat[1] },
            0
        );
        const scale = mercator.meterInMercatorCoordinateUnits();
        const headingRadians = ((180 - wrapDegrees(placement.heading + 180)) * Math.PI) / 180;

        const group = new THREE.Group();
        group.position.set(mercator.x, mercator.y, mercator.z);
        group.scale.set(scale, -scale, scale);
        group.rotation.z = headingRadians;

        const poleMaterial = new THREE.MeshStandardMaterial({
            color: 0x2d3442,
            roughness: 0.58,
            metalness: 0.72,
        });
        const housingMaterial = new THREE.MeshStandardMaterial({
            color: 0x171b23,
            roughness: 0.66,
            metalness: 0.4,
        });
        const armMaterial = new THREE.MeshStandardMaterial({
            color: 0x444c5a,
            roughness: 0.5,
            metalness: 0.7,
        });
        const redMaterial = new THREE.MeshStandardMaterial({ color: 0x360707, emissive: 0x120202, emissiveIntensity: 0.2 });
        const yellowMaterial = new THREE.MeshStandardMaterial({ color: 0x40310a, emissive: 0x1d1402, emissiveIntensity: 0.2 });
        const greenMaterial = new THREE.MeshStandardMaterial({ color: 0x0a2b13, emissive: 0x031007, emissiveIntensity: 0.2 });

        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.11, 5.8, 12), poleMaterial);
        pole.position.set(0, 0, 2.9);
        group.add(pole);

        const mast = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.09, 0.09), armMaterial);
        mast.position.set(-0.95, 0, 5.38);
        group.add(mast);

        const support = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.88, 10), armMaterial);
        support.position.set(-1.66, 0, 4.96);
        support.rotation.x = Math.PI / 2;
        support.rotation.z = -0.42;
        group.add(support);

        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 0.22, 14), new THREE.MeshStandardMaterial({
            color: 0x5a626d,
            roughness: 0.84,
            metalness: 0.08,
        }));
        base.position.set(0, 0, 0.11);
        group.add(base);

        const headGroup = new THREE.Group();
        headGroup.position.set(-1.88, 0, 5.18);
        group.add(headGroup);

        const housing = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.4, 1.08), housingMaterial);
        headGroup.add(housing);

        const visorMaterial = new THREE.MeshStandardMaterial({ color: 0x0d0f14, roughness: 0.75, metalness: 0.3 });
        [-0.28, 0, 0.28].forEach(y => {
            const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.1, 16, 1, true, Math.PI, Math.PI), visorMaterial);
            visor.rotation.z = Math.PI / 2;
            visor.position.set(0.18, 0, y);
            visor.scale.set(1, 1.18, 1);
            headGroup.add(visor);
        });

        const makeLens = (material, z) => {
            const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.06, 18), material);
            lens.rotation.z = Math.PI / 2;
            lens.position.set(0.2, 0, z);
            headGroup.add(lens);
            return lens;
        };

        makeLens(redMaterial, 0.28);
        makeLens(yellowMaterial, 0);
        makeLens(greenMaterial, -0.28);

        return {
            group,
            redMaterial,
            yellowMaterial,
            greenMaterial,
            cycleOffsetMs: index * 1600,
        };
    }

    _rebuildTrafficSignals() {
        this._clearTrafficSignals();
        const root = this._threeSignals.root;
        if (!root || !this.map) return;

        const placements = this._deriveTrafficSignalPlacements();
        placements.forEach((placement, index) => {
            const signal = this._createTrafficSignalMesh(index, placement);
            root.add(signal.group);
            this._trafficSignals.push(signal);
        });
        this._updateTrafficSignals(0);
    }

    _updateTrafficSignals() {
        const now = Date.now();
        for (const signal of this._trafficSignals) {
            const cycleMs = 12000;
            const phase = (now + signal.cycleOffsetMs) % cycleMs;
            const state = phase < 4300 ? "red" : phase < 5400 ? "yellow" : "green";

            signal.redMaterial.emissive.setHex(state === "red" ? 0xff2f43 : 0x120202);
            signal.yellowMaterial.emissive.setHex(state === "yellow" ? 0xffbf38 : 0x1d1402);
            signal.greenMaterial.emissive.setHex(state === "green" ? 0x38ff88 : 0x031007);

            signal.redMaterial.emissiveIntensity = state === "red" ? 2.4 : 0.18;
            signal.yellowMaterial.emissiveIntensity = state === "yellow" ? 2.1 : 0.18;
            signal.greenMaterial.emissiveIntensity = state === "green" ? 2.25 : 0.18;
        }
    }

    _startLoop() {
        if (this._frame) return;
        const tick = (time) => {
            const dt = this._lastFrameTime ? Math.min((time - this._lastFrameTime) / 1000, 0.08) : 0;
            this._lastFrameTime = time;
            this._updateDrive(dt);
            this._frame = requestAnimationFrame(tick);
        };
        this._frame = requestAnimationFrame(tick);
    }

    _updateDrive(dt) {
        if (dt > 0) {
            this._updateStreetMemory(dt);
            this._updateTrafficSignals(dt);
        }

        if (!this.isDriving || dt <= 0) {
            this._renderTelemetry();
            return;
        }

        const accelerating = this._keysPressed.has("w") || this._keysPressed.has("arrowup");
        const braking = this._keysPressed.has("s") || this._keysPressed.has("arrowdown");
        const turningLeft = this._keysPressed.has("a") || this._keysPressed.has("arrowleft");
        const turningRight = this._keysPressed.has("d") || this._keysPressed.has("arrowright");

        if (accelerating) this._manualSpeed = Math.min(this._manualSpeed + 24 * dt, this._targetSpeed);
        else if (braking) this._manualSpeed = Math.max(this._manualSpeed - 32 * dt, 0);
        else this._manualSpeed = Math.max(this._manualSpeed - 9 * dt, 0);

        const steeringInput = (turningRight ? 1 : 0) - (turningLeft ? 1 : 0);
        const steeringResponse = steeringInput !== 0 ? 150 : 220;
        const maxSteerAngle = clamp(34 - (this._manualSpeed * 0.75), 12, 32);
        const steerTarget = steeringInput * maxSteerAngle;
        const steerDelta = steerTarget - this._steeringAngle;
        const steerStep = Math.sign(steerDelta) * Math.min(Math.abs(steerDelta), steeringResponse * dt);
        this._steeringAngle += steerStep;

        const forwardSpeed = this._manualSpeed;
        const turnAuthority = 0.28 + clamp(forwardSpeed * 0.09, 0, 1.45);
        const yawRate = this._steeringAngle * turnAuthority;
        this.currentHeading = wrapDegrees(this.currentHeading + yawRate * dt);

        this._advanceByHeading(this._manualSpeed * dt);
        this._currentSpeedMph = this._manualSpeed * 2.23694;
        this._currentElapsedSeconds = this.startTime ? Math.floor((Date.now() - this.startTime) / 1000) : 0;
        this._renderTelemetry();
    }

    _advanceByHeading(distanceDelta) {
        if (distanceDelta <= 0) {
            this._syncPosition();
            return;
        }

        this.currentLngLat = offsetLngLat(this.currentLngLat, this.currentHeading, 0, distanceDelta);
        this._currentDistanceMiles += distanceDelta / 1609.34;
        if (typeof this._advanceNavCards === "function") {
            this._advanceNavCards(this._currentDistanceMiles * 1609.34);
        }
        this._syncPosition();
    }

    _syncPosition() {
        if (this.marker) {
            this.marker.setLngLat(this.currentLngLat);
            this.marker.setRotation(this.currentHeading);
        }

        if (this.map && this.cameraMode === "chase" && !this._cameraScriptLock) {
            const chaseBearing = wrapDegrees(this.currentHeading + this._chaseCamera.bearingOffset);
            const cameraTarget = offsetLngLat(this.currentLngLat, chaseBearing, this._chaseCamera.sideMeters, this._chaseCamera.lookAheadMeters);
            this.map.jumpTo({
                center: cameraTarget,
                bearing: chaseBearing,
                pitch: this._chaseCamera.pitch,
                zoom: this._chaseCamera.zoom,
                padding: this._cameraPadding,
            });
        }

        if (this.miniMap) {
            this.miniMap.update(this.currentLngLat[1], this.currentLngLat[0], this.currentHeading * Math.PI / 180);
        }
    }

    _updateStreetMemory(dt) {
        for (const pod of this._streetMemory.pods) {
            if (!pod.marker || pod.track.length < 2) continue;

            pod.distance += pod.speed * dt;
            while (pod.distance >= pod.trackLength && pod.trackLength > 0) {
                pod.distance -= pod.trackLength;
            }

            let traversed = 0;
            for (let i = 0; i < pod.segmentLengths.length; i += 1) {
                const segmentLength = pod.segmentLengths[i];
                if (traversed + segmentLength >= pod.distance) {
                    const start = pod.track[i];
                    const end = pod.track[i + 1] || pod.track[0];
                    const localT = segmentLength > 0 ? (pod.distance - traversed) / segmentLength : 0;
                    const lngLat = interpolateLngLat(start, end, localT);
                    const heading = bearingDegrees(start, end);
                    pod.marker.setLngLat(lngLat);
                    pod.marker.setRotation(heading);
                    break;
                }
                traversed += segmentLength;
            }
        }
    }

    _renderTelemetry() {
        const speed = Math.round(this._currentSpeedMph || 0);
        const miles = (this._currentDistanceMiles || 0).toFixed(1);
        const minutes = Math.floor((this._currentElapsedSeconds || 0) / 60);
        const seconds = String((this._currentElapsedSeconds || 0) % 60).padStart(2, "0");

        const setText = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.textContent = value;
        };
        setText("speedDisplay", speed);
        setText("statSpeed", speed);
        setText("statDistance", miles);
        setText("statTime", `${minutes}:${seconds}`);
    }

    _setPaintIfLayerExists(layerId, property, value) {
        if (!this.map?.getLayer?.(layerId)) return;
        try {
            this.map.setPaintProperty(layerId, property, value);
        } catch {
            // Mapbox Standard changes layer internals across releases; keep this cosmetic pass non-blocking.
        }
    }

    _applyLegacyMapboxSkin(vibeId = this.currentVibe) {
        if (!this.map?.getStyle?.()) return;

        try {
            this.map.setFog({
                color: LEGACY_MAPBOX_SKIN.void,
                "high-color": "#071522",
                "horizon-blend": 0.03,
                "space-color": "#01040a",
                "star-intensity": 0,
            });
        } catch {
            // Fog is not available on every style load state.
        }

        for (const layer of this.map.getStyle().layers || []) {
            if (layer.type === "background") {
                this._setPaintIfLayerExists(layer.id, "background-color", LEGACY_MAPBOX_SKIN.void);
            }

            if (layer.type === "fill" && /water|land|park|building/i.test(layer.id)) {
                const fillColor = /water/i.test(layer.id)
                    ? LEGACY_MAPBOX_SKIN.water
                    : /park|landuse|green/i.test(layer.id)
                        ? "#111b16"
                        : "#22251f";
                this._setPaintIfLayerExists(layer.id, "fill-color", fillColor);
                this._setPaintIfLayerExists(layer.id, "fill-opacity", /water/i.test(layer.id) ? 1 : 0.72);
            }

            if (layer.type === "line" && /road|street|bridge|tunnel|path/i.test(layer.id)) {
                this._setPaintIfLayerExists(layer.id, "line-color", LEGACY_MAPBOX_SKIN.road);
                this._setPaintIfLayerExists(layer.id, "line-opacity", 0.38);
                this._setPaintIfLayerExists(layer.id, "line-emissive-strength", 0.08);
            }

            if (layer.type === "symbol") {
                this._setPaintIfLayerExists(layer.id, "text-color", "#aeb8b5");
                this._setPaintIfLayerExists(layer.id, "text-halo-color", LEGACY_MAPBOX_SKIN.void);
                this._setPaintIfLayerExists(layer.id, "text-halo-width", 1);
                this._setPaintIfLayerExists(layer.id, "icon-opacity", 0.28);
                this._setPaintIfLayerExists(layer.id, "text-opacity", 0.42);
            }

            if (layer.type === "fill-extrusion") {
                this._setPaintIfLayerExists(layer.id, "fill-extrusion-color", [
                    "interpolate",
                    ["linear"],
                    ["coalesce", ["get", "height"], 20],
                    0,
                    LEGACY_MAPBOX_SKIN.buildingBase,
                    80,
                    "#9fa193",
                    220,
                    LEGACY_MAPBOX_SKIN.buildingTop,
                ]);
                this._setPaintIfLayerExists(layer.id, "fill-extrusion-opacity", 0.58);
                this._setPaintIfLayerExists(layer.id, "fill-extrusion-vertical-gradient", true);
                this._setPaintIfLayerExists(layer.id, "fill-extrusion-emissive-strength", 0.08);
            }
        }

        this._setLegacyBuildingLayer();
        this._setCityGridLayers(vibeId);
    }

    _setCityGridLayers(vibeId = this.currentVibe) {
        if (!this.map?.isStyleLoaded?.()) return;

        const style = this._getRouteStyle(vibeId);
        const sourceId = "flowlayer-city-grid";

        if (!this.map.getSource(sourceId)) {
            this.map.addSource(sourceId, {
                type: "geojson",
                data: "/toronto_roads.json",
            });
        }

        const firstSymbolLayer = this.map.getStyle().layers.find(layer => layer.type === "symbol")?.id;
        const addLayerIfMissing = (layer) => {
            if (!this.map.getLayer(layer.id)) this.map.addLayer(layer, firstSymbolLayer);
        };

        addLayerIfMissing({
            id: "flowlayer-city-grid-glow",
            type: "line",
            source: sourceId,
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
                "line-color": LEGACY_MAPBOX_SKIN.grid,
                "line-width": ["interpolate", ["linear"], ["zoom"], 13, 1.2, 18, 4.2, 21, 7.6],
                "line-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0.18, 16, 0.44, 20, 0.34],
                "line-blur": 4,
                "line-emissive-strength": 1,
            },
        });

        addLayerIfMissing({
            id: "flowlayer-city-grid-core",
            type: "line",
            source: sourceId,
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
                "line-color": LEGACY_MAPBOX_SKIN.grid,
                "line-width": ["interpolate", ["linear"], ["zoom"], 13, 0.5, 18, 1.5, 21, 2.8],
                "line-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0.42, 16, 0.82, 20, 0.62],
                "line-emissive-strength": 1,
            },
        });

        this.map.setPaintProperty("flowlayer-city-grid-glow", "line-color", style.glow);
        this.map.setPaintProperty("flowlayer-city-grid-core", "line-color", style.end);
    }

    _setLegacyBuildingLayer() {
        if (!this.map?.getStyle?.()?.sources?.composite) return;

        const layerId = "flowlayer-legacy-buildings";
        const firstSymbolLayer = this.map.getStyle().layers.find(layer => layer.type === "symbol")?.id;
        const paint = {
            "fill-extrusion-color": [
                "interpolate",
                ["linear"],
                ["coalesce", ["get", "height"], 18],
                0,
                LEGACY_MAPBOX_SKIN.buildingBase,
                90,
                "#a2a497",
                240,
                LEGACY_MAPBOX_SKIN.buildingTop,
            ],
            "fill-extrusion-height": ["coalesce", ["get", "height"], 14],
            "fill-extrusion-base": ["coalesce", ["get", "min_height"], 0],
            "fill-extrusion-opacity": 0.72,
            "fill-extrusion-vertical-gradient": true,
            "fill-extrusion-emissive-strength": 0.12,
        };

        if (this.map.getLayer(layerId)) {
            for (const [property, value] of Object.entries(paint)) {
                this._setPaintIfLayerExists(layerId, property, value);
            }
            return;
        }

        this.map.addLayer({
            id: layerId,
            type: "fill-extrusion",
            source: "composite",
            "source-layer": "building",
            filter: ["==", ["get", "extrude"], "true"],
            minzoom: 13,
            paint,
        }, firstSymbolLayer);
    }

    _getRouteStyle(vibeId) {
        const byVibe = {
            scenic: {
                glow: "#ff5cff",
                casing: "#fff0ff",
                start: "#ff9dff",
                end: "#d91bff",
                marker: "#fff0ff",
                markerStroke: "#ff5cff",
            },
            chill: {
                glow: "#68d9ff",
                casing: "#effbff",
                start: "#97ecff",
                end: "#35b8ff",
                marker: "#e3f8ff",
                markerStroke: "#35b8ff",
            },
            adventure: {
                glow: "#00ffe1",
                casing: "#eafffb",
                start: "#9efff4",
                end: "#00ff91",
                marker: "#eafffb",
                markerStroke: "#00ffe1",
            },
            fastest: {
                glow: "#ffc566",
                casing: "#fff5df",
                start: "#ffd78f",
                end: "#ff9f1c",
                marker: "#fff7ea",
                markerStroke: "#ff9f1c",
            },
        };
        return byVibe[vibeId] || byVibe.scenic;
    }

    _setRouteManeuverLayers(vibeId) {
        const style = this._getRouteStyle(vibeId);
        const points = (this.routeData?.steps || [])
            .map((step, index) => {
                const lngLat = step?.endLocation ? toLngLat(step.endLocation) : null;
                if (!lngLat) return null;
                return {
                    type: "Feature",
                    geometry: { type: "Point", coordinates: lngLat },
                    properties: { stepIndex: index },
                };
            })
            .filter(Boolean)
            .slice(0, -1);

        const data = {
            type: "FeatureCollection",
            features: points,
        };

        if (this.map.getSource("flowlayer-route-maneuvers")) {
            this.map.getSource("flowlayer-route-maneuvers").setData(data);
            this.map.setPaintProperty("flowlayer-route-maneuver-halo", "circle-color", style.glow);
            this.map.setPaintProperty("flowlayer-route-maneuver-core", "circle-color", style.marker);
            this.map.setPaintProperty("flowlayer-route-maneuver-core", "circle-stroke-color", style.markerStroke);
            return;
        }

        this.map.addSource("flowlayer-route-maneuvers", {
            type: "geojson",
            data,
        });

        this.map.addLayer({
            id: "flowlayer-route-maneuver-halo",
            type: "circle",
            source: "flowlayer-route-maneuvers",
            paint: {
                "circle-radius": 11,
                "circle-color": style.glow,
                "circle-opacity": 0.18,
                "circle-blur": 0.6,
            },
        });

        this.map.addLayer({
            id: "flowlayer-route-maneuver-core",
            type: "circle",
            source: "flowlayer-route-maneuvers",
            paint: {
                "circle-radius": 5.2,
                "circle-color": style.marker,
                "circle-stroke-color": style.markerStroke,
                "circle-stroke-width": 2,
                "circle-opacity": 0.96,
            },
        });
    }

    _setRouteLayers(coordinates, vibeId) {
        const style = this._getRouteStyle(vibeId);
        const data = {
            type: "Feature",
            geometry: { type: "LineString", coordinates },
            properties: {},
        };

        if (this.map.getSource("flowlayer-route")) {
            this.map.getSource("flowlayer-route").setData(data);
            this.map.setPaintProperty("flowlayer-route-halo", "line-color", style.glow);
            this.map.setPaintProperty("flowlayer-route-casing", "line-color", style.casing);
            this.map.setPaintProperty("flowlayer-route-core", "line-gradient", [
                "interpolate",
                ["linear"],
                ["line-progress"],
                0,
                style.start,
                0.48,
                style.glow,
                1,
                style.end,
            ]);
            this.map.setPaintProperty("flowlayer-route-core", "line-emissive-strength", 0.96);
            this.map.setPaintProperty("flowlayer-route-sheen", "line-color", style.casing);
            this._setRouteManeuverLayers(vibeId);
            return;
        }

        this.map.addSource("flowlayer-route", { type: "geojson", data, lineMetrics: true });
        this.map.addLayer({
            id: "flowlayer-route-halo",
            type: "line",
            source: "flowlayer-route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
                "line-color": style.glow,
                "line-width": 24,
                "line-opacity": 0.18,
                "line-blur": 10,
                "line-emissive-strength": 0.36,
            },
        });
        this.map.addLayer({
            id: "flowlayer-route-casing",
            type: "line",
            source: "flowlayer-route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
                "line-color": style.casing,
                "line-width": 10.5,
                "line-opacity": 0.28,
            },
        });
        this.map.addLayer({
            id: "flowlayer-route-core",
            type: "line",
            source: "flowlayer-route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
                "line-gradient": [
                    "interpolate",
                    ["linear"],
                    ["line-progress"],
                    0,
                    style.start,
                    0.48,
                    style.glow,
                    1,
                    style.end,
                ],
                "line-width": 6.4,
                "line-opacity": 0.96,
                "line-emissive-strength": 0.96,
            },
        });
        this.map.addLayer({
            id: "flowlayer-route-sheen",
            type: "line",
            source: "flowlayer-route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
                "line-color": style.casing,
                "line-width": 2.15,
                "line-opacity": 0.82,
                "line-blur": 0.2,
            },
        });
        this._setRouteManeuverLayers(vibeId);
    }

    syncMiniMapRoute(vibeId = this.currentVibe) {
        if (this.miniMap && this.routeCoordinates.length) {
            this.miniMap.setRoute(this.routeCoordinates, VIBE_COLORS[vibeId] || VIBE_COLORS.scenic);
        }
    }

    async loadRoute(origin, destination, vibeId = this.currentVibe, options = {}) {
        const { forceReset = false } = options;
        const routeData = await this._loadInitialRoute(origin, destination, vibeId);
        const nextRouteIdentity = routeIdentity(destination, vibeId);
        const preservePose = !forceReset && this.routeCoordinates.length > 1 && this._activeRouteIdentity === nextRouteIdentity;
        this.routeData = routeData;
        this.routeCoordinates = routeData.coordinates.length ? routeData.coordinates.map(toLngLat) : this._fallbackCoordinates();
        this.segmentDistances = this.routeCoordinates.slice(0, -1).map((point, index) => distanceMeters(point, this.routeCoordinates[index + 1]));
        this.routeDistanceMeters = this.segmentDistances.reduce((sum, value) => sum + value, 0);
        if (!preservePose) {
            this.segmentIndex = 0;
            this.segmentProgressMeters = 0;
            this.currentLngLat = this.routeCoordinates[0];
            this.currentHeading = bearingDegrees(this.routeCoordinates[0], this.routeCoordinates[1] || this.routeCoordinates[0]);
        }
        this._activeRouteIdentity = nextRouteIdentity;
        this._setRouteLayers(this.routeCoordinates, vibeId);
        this._rebuildTrafficSignals();
        this._syncPosition();
        this.syncMiniMapRoute(vibeId);
        if (!preservePose && !this._startupIntroPlayed) {
            await this._playStartupIntro();
        } else if (!preservePose) {
            this.map.easeTo({
                center: offsetLngLat(
                    this.currentLngLat,
                    wrapDegrees(this.currentHeading + this._chaseCamera.bearingOffset),
                    this._chaseCamera.sideMeters,
                    this._chaseCamera.lookAheadMeters
                ),
                bearing: wrapDegrees(this.currentHeading + this._chaseCamera.bearingOffset),
                pitch: this._chaseCamera.pitch,
                zoom: this._chaseCamera.zoom,
                padding: this._cameraPadding,
                duration: 900,
            });
        }

        this._rebuildStreetMemory(vibeId);
        this.setNearbyPlaceHighlights(this._nearbyPlaces);
        this._dispatchRouteLoaded(routeData);
        return routeData;
    }

    async _loadInitialRoute(origin, destination, vibeId) {
        try {
            return await fetchGoogleDirectionsRoute(origin, destination, vibeId);
        } catch (err) {
            console.warn("[MapboxSim] Route API issue, using fallback route:", err.message);
            return this._createFallbackRouteData(origin, destination, vibeId, err.message);
        }
    }

    _dispatchRouteLoaded(routeData) {
        window.dispatchEvent(new CustomEvent("routeLoaded", {
            detail: {
                origin: routeData.origin,
                destination: routeData.destination,
                steps: routeData.steps,
                coordinates: this.routeCoordinates,
                distanceText: routeData.distanceText,
                durationText: routeData.durationText,
                distanceMeters: routeData.distanceMeters || this.routeDistanceMeters,
                durationSeconds: routeData.durationSeconds,
                startLocation: this.routeCoordinates[0],
            },
        }));
    }

    _fallbackCoordinates() {
        return [
            [-79.3713, 43.6433],
            [-79.3762, 43.6471],
            [-79.3817, 43.6506],
            [-79.3861, 43.6537],
            [-79.3894, 43.6574],
        ];
    }

    _createFallbackRouteData(origin, destination, vibeId = this.currentVibe, fallbackReason = "") {
        const coordinates = this._fallbackCoordinates();
        return {
            origin: typeof origin === "string" ? TORONTO_ORIGIN : origin,
            destination,
            coordinates,
            steps: [
                { instruction: "Pull out onto the Toronto waterfront route.", distance: "0.3 mi", startLocation: coordinates[0], endLocation: coordinates[1] },
                { instruction: "Follow the highlighted city corridor toward downtown.", distance: "0.6 mi", startLocation: coordinates[1], endLocation: coordinates[3] },
                { instruction: "Ease into the final approach and keep the route line centered.", distance: "0.4 mi", startLocation: coordinates[3], endLocation: coordinates[4] },
            ],
            distanceText: "1.3 mi",
            durationText: vibeId === "fastest" ? "6 min" : "9 min",
            distanceMeters: 2092,
            durationSeconds: vibeId === "fastest" ? 360 : 540,
            fallbackReason,
        };
    }

    startDrive(mode = "route") {
        this.driveMode = mode;
        this.isDriving = true;
        this._isManualDrive = mode === "free";
        this.startTime = Date.now();
        this._manualSpeed = 0;
        this._steeringAngle = 0;
    }

    startFreeDrive() {
        this.startDrive("free");
    }

    endDrive() {
        this.isDriving = false;
        this._isManualDrive = false;
        this.driveMode = "route";
        this._manualSpeed = 0;
        this._steeringAngle = 0;
    }

    getDriveData() {
        return {
            distance: this._currentDistanceMiles,
            duration: this._currentElapsedSeconds,
            speed: this._currentSpeedMph,
            route: this.currentRoute,
            vibe: this.currentVibe,
        };
    }

    toggleManualDrive() {
        this._isManualDrive = !this._isManualDrive;
        this.isDriving = this._isManualDrive;
        this.driveMode = this._isManualDrive ? "free" : "route";
        if (this.isDriving && !this.startTime) this.startTime = Date.now();
        if (!this.isDriving) {
            this._manualSpeed = 0;
            this._steeringAngle = 0;
        }
        return this._isManualDrive;
    }

    toggleCameraMode() {
        if (this.cameraMode === "free") {
            this._captureChaseCameraFromMap();
        }
        this.cameraMode = this.cameraMode === "chase" ? "free" : "chase";
        this._applyCameraInteractionMode();
        this._updateCameraModeUI();
        if (this.cameraMode === "chase") {
            this._syncPosition();
        }
        return this.cameraMode;
    }

    _updateCameraModeUI() {
        const label = document.getElementById("cameraModeLabel");
        const icon = document.getElementById("cameraModeIcon");
        if (label) label.textContent = this.cameraMode === "chase" ? "Chase" : "Look";
        if (icon) icon.textContent = this.cameraMode === "chase" ? "🎥" : "🕹️";
    }

    setVibe(vibe) {
        this.currentVibe = vibe;
        this.applyVibeAesthetics(vibe);
        if (this.routeCoordinates.length) {
            this._setRouteLayers(this.routeCoordinates, vibe);
            this.syncMiniMapRoute(vibe);
        }
        this._refreshStreetMemoryTheme();
    }

    setEnvironment(route) {
        this.currentRoute = route;
        this.currentDestination = ROUTE_DESTINATIONS[route] || ROUTE_DESTINATIONS.coastal;
        if (this.map) {
            this.loadRoute(TORONTO_ORIGIN, this.currentDestination, this.currentVibe || "scenic", { forceReset: true });
        }
    }

    setDestination(destination, vibeId = this.currentVibe) {
        this.currentDestination = destination || ROUTE_DESTINATIONS.coastal;
        if (this.map) {
            this.loadRoute(TORONTO_ORIGIN, this.currentDestination, vibeId || this.currentVibe, { forceReset: true });
        }
    }

    applyVibeAesthetics(vibeId) {
        if (!this.map) return;
        try {
            const basemapByVibe = {
                scenic: {
                    lightPreset: "night",
                    theme: "monochrome",
                    show3dObjects: false,
                    show3dBuildings: false,
                    show3dTrees: false,
                    show3dLandmarks: false,
                    show3dFacades: false,
                    showPointOfInterestLabels: false,
                    showTransitLabels: false,
                    showPedestrianRoads: true,
                    colorGreenspace: "#17241d",
                    colorWater: LEGACY_MAPBOX_SKIN.water,
                    colorRoads: LEGACY_MAPBOX_SKIN.road,
                },
                chill: {
                    lightPreset: "night",
                    theme: "monochrome",
                    show3dObjects: false,
                    show3dBuildings: false,
                    show3dTrees: false,
                    show3dLandmarks: false,
                    show3dFacades: false,
                    showPointOfInterestLabels: false,
                    showTransitLabels: false,
                    showPedestrianRoads: true,
                    colorGreenspace: "#13212a",
                    colorWater: LEGACY_MAPBOX_SKIN.water,
                    colorRoads: LEGACY_MAPBOX_SKIN.road,
                },
                adventure: {
                    lightPreset: "night",
                    theme: "monochrome",
                    show3dObjects: false,
                    show3dBuildings: false,
                    show3dTrees: false,
                    show3dLandmarks: false,
                    show3dFacades: false,
                    showPointOfInterestLabels: false,
                    showTransitLabels: false,
                    showPedestrianRoads: true,
                    colorGreenspace: "#15231d",
                    colorWater: LEGACY_MAPBOX_SKIN.water,
                    colorRoads: LEGACY_MAPBOX_SKIN.road,
                },
                fastest: {
                    lightPreset: "night",
                    theme: "monochrome",
                    show3dObjects: false,
                    show3dBuildings: false,
                    show3dTrees: false,
                    show3dLandmarks: false,
                    show3dFacades: false,
                    showPointOfInterestLabels: false,
                    showTransitLabels: false,
                    showPedestrianRoads: false,
                    colorGreenspace: "#202016",
                    colorWater: LEGACY_MAPBOX_SKIN.water,
                    colorRoads: LEGACY_MAPBOX_SKIN.road,
                },
            };
            const config = basemapByVibe[vibeId] || basemapByVibe.scenic;
            for (const [key, value] of Object.entries(config)) {
                this.map.setConfigProperty("basemap", key, value);
            }
            this._applyLegacyMapboxSkin(vibeId);
        } catch (error) {
            console.warn("[MapboxSim] Could not apply Mapbox atmosphere:", error);
        }
    }

    accelerate() {
        this._targetSpeed = Math.min(this._targetSpeed + 5, 42);
    }

    decelerate() {
        this._targetSpeed = Math.max(this._targetSpeed - 5, 8);
    }

    resize() {
        if (this.map) this.map.resize();
    }

    _clearStreetMemory() {
        for (const pod of this._streetMemory.pods) {
            pod.marker?.remove();
        }
        for (const witness of this._streetMemory.witnesses) {
            witness.marker?.remove();
        }
        this._streetMemory.pods = [];
        this._streetMemory.witnesses = [];
    }

    _rebuildStreetMemory(vibeId = this.currentVibe) {
        if (!this.map || this.routeCoordinates.length < 2) return;
        this._clearStreetMemory();

        const podSides = [-7, 7, -13, 13];
        podSides.forEach((sideMeters, index) => {
            const track = this._buildStreetTrack(sideMeters, index * 2);
            const el = document.createElement("div");
            el.className = `street-memory-pod vibe-${vibeId}`;
            el.innerHTML = `<span class="street-memory-pod-core"></span>`;
            const marker = new mapboxgl.Marker({
                element: el,
                rotationAlignment: "map",
                pitchAlignment: "map",
            }).setLngLat(track[0]).addTo(this.map);
            const segmentLengths = track.slice(0, -1).map((point, trackIndex) => distanceMeters(point, track[trackIndex + 1]));
            const trackLength = segmentLengths.reduce((sum, value) => sum + value, 0);
            this._streetMemory.pods.push({
                marker,
                track,
                segmentLengths,
                trackLength,
                speed: 9 + (index * 1.8),
                distance: (trackLength / podSides.length) * index,
            });
        });

        const witnessPoints = this._buildWitnessPoints();
        witnessPoints.forEach((lngLat, index) => {
            const el = document.createElement("div");
            el.className = `street-memory-witness vibe-${vibeId}`;
            el.style.animationDelay = `${index * 0.45}s`;
            el.innerHTML = `<span class="street-memory-witness-halo"></span><span class="street-memory-witness-body"></span>`;
            const marker = new mapboxgl.Marker({
                element: el,
                rotationAlignment: "viewport",
                pitchAlignment: "viewport",
            }).setLngLat(lngLat).addTo(this.map);
            this._streetMemory.witnesses.push({ marker });
        });

        this._dispatchStreetMemoryUpdate();
    }

    _buildStreetTrack(sideMeters, pointOffset = 0) {
        const base = this.routeCoordinates.length ? this.routeCoordinates : this._fallbackCoordinates();
        const track = [];

        for (let index = 0; index < base.length - 1; index += 1) {
            const point = base[index];
            const next = base[index + 1];
            const heading = bearingDegrees(point, next);
            track.push(offsetLngLat(point, heading, sideMeters, pointOffset));
        }

        const last = base[base.length - 1];
        const prev = base[base.length - 2] || last;
        const returnHeading = bearingDegrees(last, prev);
        track.push(offsetLngLat(last, returnHeading, sideMeters * 0.65, pointOffset * 0.5));

        const reverse = [...base].reverse();
        for (let index = 0; index < reverse.length - 1; index += 1) {
            const point = reverse[index];
            const next = reverse[index + 1];
            const heading = bearingDegrees(point, next);
            track.push(offsetLngLat(point, heading, -sideMeters, -pointOffset * 0.4));
        }

        track.push(track[0]);
        return track;
    }

    _buildWitnessPoints() {
        const base = this.routeCoordinates.length ? this.routeCoordinates : this._fallbackCoordinates();
        const points = [];

        for (let index = 1; index < base.length - 1; index += 4) {
            const point = base[index];
            const next = base[index + 1] || point;
            const heading = bearingDegrees(point, next);
            points.push(offsetLngLat(point, heading, 22 + ((index % 3) * 5), 6));
            points.push(offsetLngLat(point, heading, -18 - ((index % 2) * 4), -4));
        }

        return points.slice(0, 6);
    }

    _refreshStreetMemoryTheme() {
        const vibeClassNames = ["vibe-scenic", "vibe-chill", "vibe-adventure", "vibe-fastest"];
        for (const pod of this._streetMemory.pods) {
            const el = pod.marker?.getElement?.();
            if (!el) continue;
            el.classList.remove(...vibeClassNames);
            el.classList.add(`vibe-${this.currentVibe}`);
        }
        for (const witness of this._streetMemory.witnesses) {
            const el = witness.marker?.getElement?.();
            if (!el) continue;
            el.classList.remove(...vibeClassNames);
            el.classList.add(`vibe-${this.currentVibe}`);
        }
        this._dispatchStreetMemoryUpdate();
    }

    _buildRouteFeelDetail() {
        const baseFeaturesByRoute = {
            coastal: ["Waterfront", "Long sightlines", "Open turns"],
            mountain: ["Elevation", "Tighter bends", "Compressed views"],
            forest: ["Green edges", "Sheltered road", "Quieter pacing"],
            custom: ["City route", "Live destination", "Adaptive path"],
        };
        const emotionByVibe = {
            scenic: ["Calm", "Curious", "Airy"],
            chill: ["Easy", "Smooth", "Settled"],
            adventure: ["Alert", "Charged", "Restless"],
            fastest: ["Focused", "Urgent", "Sharp"],
        };

        const instructions = (this.routeData?.steps || []).map(step => String(step?.instruction || "").toLowerCase());
        const dynamicFeatures = [];
        if (instructions.some(text => text.includes("right") || text.includes("left"))) dynamicFeatures.push("Turn sequence");
        if (instructions.some(text => text.includes("south") || text.includes("north") || text.includes("east") || text.includes("west"))) dynamicFeatures.push("Strong direction");
        if (this.routeDistanceMeters > 1800) dynamicFeatures.push("Long corridor");

        const baseFeatures = baseFeaturesByRoute[this.currentRoute] || baseFeaturesByRoute.custom;
        const features = [...new Set([...baseFeatures, ...dynamicFeatures])].slice(0, 4);
        const emotions = (emotionByVibe[this.currentVibe] || emotionByVibe.scenic).slice(0, 3);

        return {
            label: "Route Feel",
            summary: STREET_LAYER_COPY[this.currentVibe] || STREET_LAYER_COPY.scenic,
            features,
            emotions,
        };
    }

    _dispatchStreetMemoryUpdate() {
        const detail = this._buildRouteFeelDetail();
        window.dispatchEvent(new CustomEvent("streetMemoryUpdated", {
            detail,
        }));
    }

    _clearNearbyPlaceHighlights() {
        for (const entry of this._nearbyPlaceMarkers) {
            entry.marker?.remove?.();
        }
        this._nearbyPlaceMarkers = [];
    }

    _deriveNearbyPlaceLngLat(place, index) {
        const lat = Number(place?.lat);
        const lng = Number(place?.lng);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            return [lng, lat];
        }

        const route = this.routeCoordinates.length ? this.routeCoordinates : this._fallbackCoordinates();
        if (!route.length) {
            return this.currentLngLat;
        }

        const stride = 10 + (index * 8);
        const anchorIndex = clamp(this.segmentIndex + stride, 1, Math.max(1, route.length - 2));
        const point = route[anchorIndex] || route[route.length - 1];
        const next = route[Math.min(anchorIndex + 1, route.length - 1)] || point;
        const heading = bearingDegrees(point, next);
        const sideMeters = index === 1 ? 10 : index === 2 ? -10 : 6;
        const forwardMeters = index * 2.5;
        return offsetLngLat(point, heading, sideMeters, forwardMeters);
    }

    setNearbyPlaceHighlights(places = []) {
        this._nearbyPlaces = Array.isArray(places) ? places.slice(0, 3) : [];
        if (!this.map) return;

        this._clearNearbyPlaceHighlights();
        if (!this._nearbyPlaces.length) return;

        this._nearbyPlaces.forEach((place, index) => {
            const lngLat = this._deriveNearbyPlaceLngLat(place, index);
            const el = document.createElement("div");
            el.className = `route-place-marker vibe-${this.currentVibe}`;
            el.innerHTML = `
                <span class="route-place-beam"></span>
                <span class="route-place-dot"></span>
                <span class="route-place-chip">
                    <strong>${String(place?.name || "Nearby place")}</strong>
                    <em>${String(place?.distanceText || place?.distanceNote || place?.address || "Ahead on route")}</em>
                </span>
            `;

            const marker = new mapboxgl.Marker({
                element: el,
                anchor: "bottom",
                pitchAlignment: "map",
                rotationAlignment: "map",
            }).setLngLat(lngLat).addTo(this.map);

            this._nearbyPlaceMarkers.push({ marker, place, lngLat });
        });
    }
}
