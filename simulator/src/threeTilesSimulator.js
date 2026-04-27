import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
    BoxCollider,
    CollisionDetectionMode,
    Context,
    GameObject,
    Rigidbody,
    RigidbodyConstraints,
} from "@needle-tools/engine";

import { NeedleTilesRuntime } from "./needleTilesRuntime.js";
import { NeedleRouteBridge } from "./needleRouteBridge.js";
import { planDriveRoute } from "./drivePlanner.js";

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
        this.context = null;

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.clock = null;

        this.runtime = null;
        this.routeBridge = null;

        this.carRoot = null;
        this.carVisual = null;
        this.carModel = null;
        this.carBody = null;
        this.carCollider = null;
        this.routeLine = null;
        this.routeDecor = [];
        this.environmentDecor = [];
        this.roadLines = [];
        this.roadSurfaces = [];
        this.roadMarkings = [];
        this.driveSurfaceY = 0;
        this.renderBackgroundRoads = true;

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
        this._lastCarPosition = new THREE.Vector3();

        this.cameraMode = "chase";
        this._keysPressed = new Set();
        this._orbit = {
            theta: 0,
            phi: Math.PI / 4.2,
            radius: 180,
            headingOffset: 0,
            pitch: -0.4,
            range: 48,
            dragging: false,
            dragButton: null,
            pointerId: -1,
            lastX: 0,
            lastY: 0,
        };
        this._freeLookFocus = new THREE.Vector3();

        this._advanceNavCards = null;
        this.miniMap = null;
        this.plannerContext = {};
        this.assetLoader = new GLTFLoader();
        this.assetTemplates = new Map();
        this.assetTemplatePromises = new Map();

        this._setupKeyboardListeners();
    }

    async init(vibeId = "scenic") {
        this.currentVibe = vibeId;
        this.container = document.getElementById(this.containerId);
        if (!this.container) {
            throw new Error(`Missing container #${this.containerId}`);
        }

        await this._createThreeScene();
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
        await this._preloadDecorAssets();
        await this._createRoadNetwork();

        const initialEnvironment = this.pendingEnvironment ?? this.currentDestination;
        this.pendingEnvironment = null;
        this.setEnvironment(initialEnvironment);
        this.setVibe(vibeId);
        this._positionCameraInitial();
        this._startLoop();
        window.addEventListener("resize", this._handleResize);
    }

    async _createThreeScene() {
        this.container.setAttribute("camera-controls", "false");

        if (!this.container.context) {
            await new Promise((resolve, reject) => {
                const onReady = () => {
                    cleanup();
                    resolve();
                };
                const onError = () => {
                    cleanup();
                    reject(new Error("Needle engine context failed to initialize"));
                };
                const timer = setTimeout(() => {
                    cleanup();
                    if (this.container.context) resolve();
                    else reject(new Error("Needle engine context unavailable"));
                }, 2000);
                const cleanup = () => {
                    clearTimeout(timer);
                    this.container.removeEventListener("ready", onReady);
                    this.container.removeEventListener("loadfinished", onReady);
                    this.container.removeEventListener("error", onError);
                };
                this.container.addEventListener("ready", onReady, { once: true });
                this.container.addEventListener("loadfinished", onReady, { once: true });
                this.container.addEventListener("error", onError, { once: true });
            });
        }

        this.context = this.container.context;
        if (!this.context) {
            throw new Error("Needle context missing");
        }

        this.context.isManagedExternally = true;
        Context.Current = this.context;
        this.scene = this.context.scene;
        this.camera = this.context.mainCamera ?? this.context.camera;
        this.renderer = this.context.renderer;

        if (!this.scene || !this.camera || !this.renderer) {
            throw new Error("Needle context did not provide scene, camera, and renderer");
        }

        const { clientWidth, clientHeight } = this.container;
        this.scene.background = new THREE.Color("#09010a");
        this.scene.fog = new THREE.FogExp2(0x1a0612, 0.00018);
        this.camera.fov = 46;
        this.camera.aspect = clientWidth / Math.max(clientHeight, 1);
        this.camera.near = 0.1;
        this.camera.far = 5000000;
        this.camera.updateProjectionMatrix();
        this.renderer.setPixelRatio(window.devicePixelRatio || 1);
        this.renderer.setSize(clientWidth, clientHeight, false);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.1;
        this.clock = new THREE.Clock();
    }

    _createFallbackGround() {
        const ground = new THREE.Mesh(
            new THREE.CircleGeometry(26000, 128),
            new THREE.MeshStandardMaterial({
                color: 0x090d14,
                roughness: 1,
                metalness: 0.01,
            })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = -0.24;
        ground.receiveShadow = true;
        this.scene.add(ground);

        const atmosphere = new THREE.Mesh(
            new THREE.CircleGeometry(25500, 96),
            new THREE.MeshBasicMaterial({
                color: 0x101722,
                transparent: true,
                opacity: 0.22,
            })
        );
        atmosphere.rotation.x = -Math.PI / 2;
        atmosphere.position.y = -0.22;
        this.scene.add(atmosphere);

        const horizonGlow = new THREE.Mesh(
            new THREE.CylinderGeometry(9000, 15000, 900, 96, 1, true),
            new THREE.MeshBasicMaterial({
                color: 0x1a2436,
                transparent: true,
                opacity: 0.14,
                side: THREE.DoubleSide,
            })
        );
        horizonGlow.position.y = 260;
        this.scene.add(horizonGlow);

        const horizonBand = new THREE.Mesh(
            new THREE.CircleGeometry(18000, 96),
            new THREE.MeshBasicMaterial({
                color: 0x141d2a,
                transparent: true,
                opacity: 0.12,
            })
        );
        horizonBand.rotation.x = -Math.PI / 2;
        horizonBand.position.y = 2;
        this.scene.add(horizonBand);

        const physicsGround = new THREE.Object3D();
        physicsGround.name = "FlowLayerPhysicsGround";
        physicsGround.position.set(0, -0.25, 0);
        GameObject.add(physicsGround, this.scene, this.context);
        const groundCollider = physicsGround.addComponent(BoxCollider);
        groundCollider.size = new THREE.Vector3(80000, 0.5, 80000);
        groundCollider.center = new THREE.Vector3(0, 0, 0);

        const starsGeometry = new THREE.BufferGeometry();
        const stars = [];
        for (let i = 0; i < 1800; i++) {
            const radius = 14000 + Math.random() * 9000;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI * 0.44;
            stars.push(
                Math.cos(theta) * Math.sin(phi) * radius,
                1800 + Math.cos(phi) * radius * 0.18,
                Math.sin(theta) * Math.sin(phi) * radius
            );
        }
        starsGeometry.setAttribute("position", new THREE.Float32BufferAttribute(stars, 3));
        const starField = new THREE.Points(
            starsGeometry,
            new THREE.PointsMaterial({
                color: 0xffc7df,
                size: 5,
                sizeAttenuation: true,
                transparent: true,
                opacity: 0.28,
            })
        );
        this.scene.add(starField);
    }

    _createLights() {
        const ambient = new THREE.AmbientLight(0xe7edf7, 1.2);
        this.scene.add(ambient);

        const hemi = new THREE.HemisphereLight(0xc9efff, 0x1a2530, 1.15);
        this.scene.add(hemi);

        const key = new THREE.DirectionalLight(0xfff0d6, 1.85);
        key.position.set(180, 240, 120);
        this.scene.add(key);

        const fill = new THREE.DirectionalLight(0x9fd8ff, 0.8);
        fill.position.set(-160, 120, -140);
        this.scene.add(fill);
    }

    _createCarRoot() {
        this.carRoot = new THREE.Group();
        this.carRoot.name = "FlowLayerCar";
        this.carVisual = new THREE.Group();
        this.carVisual.rotation.y = Math.PI;
        this.carRoot.add(this.carVisual);

        const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x0a0a10, roughness: 0.48, metalness: 0.12 });
        const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x050507, roughness: 0.9, metalness: 0.04 });
        const glassMaterial = new THREE.MeshStandardMaterial({
            color: 0xd7f0ff,
            roughness: 0.1,
            metalness: 0.05,
            transparent: true,
            opacity: 0.86,
        });

        const lowerBody = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.52, 4.35), bodyMaterial);
        lowerBody.position.y = 0.44;
        lowerBody.castShadow = true;
        lowerBody.receiveShadow = true;
        this.carVisual.add(lowerBody);

        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.66, 0.5, 2.1), bodyMaterial);
        cabin.position.set(0, 0.88, -0.08);
        cabin.castShadow = true;
        cabin.receiveShadow = true;
        this.carVisual.add(cabin);

        const hood = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.18, 1.1), bodyMaterial);
        hood.position.set(0, 0.63, 1.34);
        hood.rotation.x = -0.08;
        hood.castShadow = true;
        this.carVisual.add(hood);

        const windshield = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.34, 0.88), glassMaterial);
        windshield.position.set(0, 0.95, 0.24);
        windshield.rotation.x = -0.34;
        this.carVisual.add(windshield);

        const rearWindow = new THREE.Mesh(new THREE.BoxGeometry(1.34, 0.28, 0.72), glassMaterial);
        rearWindow.position.set(0, 0.98, -0.96);
        rearWindow.rotation.x = 0.3;
        this.carVisual.add(rearWindow);

        const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(1.98, 0.16, 0.22), trimMaterial);
        frontBumper.position.set(0, 0.24, 2.18);
        this.carVisual.add(frontBumper);

        const rearBumper = new THREE.Mesh(new THREE.BoxGeometry(1.92, 0.16, 0.22), trimMaterial);
        rearBumper.position.set(0, 0.24, -2.16);
        this.carVisual.add(rearBumper);

        const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.28, 24);
        const wheelOffsets = [
            [-1.02, 0.34, 1.32],
            [1.02, 0.34, 1.32],
            [-1.02, 0.34, -1.28],
            [1.02, 0.34, -1.28],
        ];
        wheelOffsets.forEach(([x, y, z]) => {
            const wheel = new THREE.Mesh(wheelGeo, trimMaterial);
            wheel.rotation.z = Math.PI / 2;
            wheel.position.set(x, y, z);
            wheel.castShadow = true;
            this.carVisual.add(wheel);
        });

        const headlightGeo = new THREE.BoxGeometry(0.28, 0.12, 0.08);
        [-0.62, 0.62].forEach(x => {
            const light = new THREE.Mesh(
                headlightGeo,
                new THREE.MeshStandardMaterial({ color: 0xfff2b8, emissive: 0xffcc55, emissiveIntensity: 1.6 })
            );
            light.position.set(x, 0.45, 2.12);
            this.carVisual.add(light);
        });

        GameObject.add(this.carRoot, this.scene, this.context);
        this.carBody = this.carRoot.addComponent(Rigidbody);
        this.carBody.isKinematic = true;
        this.carBody.useGravity = false;
        this.carBody.mass = 1200;
        this.carBody.drag = 2.8;
        this.carBody.angularDrag = 8;
        this.carBody.collisionDetectionMode = CollisionDetectionMode.Continuous;
        this.carBody.constraints =
            RigidbodyConstraints.FreezePositionY |
            RigidbodyConstraints.FreezeRotationX |
            RigidbodyConstraints.FreezeRotationZ;

        this.carCollider = this.carRoot.addComponent(BoxCollider);
        this.carCollider.size = new THREE.Vector3(2.2, 1.12, 4.5);
        this.carCollider.center = new THREE.Vector3(0, 0.58, 0);

        this._syncCarPhysics(this.carRoot.position, 0, true);
    }

    _loadCarModel() {
        this.assetLoader.load(
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
                        if (child.material) {
                            const materials = Array.isArray(child.material) ? child.material : [child.material];
                            materials.forEach(material => {
                                if ("envMapIntensity" in material) material.envMapIntensity = 1.2;
                                if ("roughness" in material && material.roughness > 0.75) material.roughness = 0.55;
                                if ("metalness" in material && material.metalness < 0.15) material.metalness = 0.22;
                                if ("color" in material && material.color && material.color.getHex() < 0x222222) {
                                    material.color.setHex(0x3d4f68);
                                }
                            });
                        }
                    }
                });
                this.carModel = model;
                this.carVisual.add(model);
            },
            undefined,
            err => {
                console.warn("[ThreeTilesSim] Could not load car model:", err);
            }
        );
    }

    async _preloadDecorAssets() {
        await Promise.allSettled([
            this._loadModelTemplate("streetLight", "/assets/street_light.glb", model => {
                this._normalizeModel(model, 3.6);
            }),
            this._loadModelTemplate("tree", "/assets/trees.glb", model => {
                this._normalizeModel(model, 5.2);
            }),
            this._loadModelTemplate("pedestrian", "/assets/pedestrian_man.glb", model => {
                this._normalizeModel(model, 1.72);
            }),
        ]);
    }

    _loadModelTemplate(key, url, configure = null) {
        if (this.assetTemplates.has(key)) {
            return Promise.resolve(this.assetTemplates.get(key));
        }
        if (this.assetTemplatePromises.has(key)) {
            return this.assetTemplatePromises.get(key);
        }

        const promise = this.assetLoader.loadAsync(url)
            .then(gltf => {
                const model = gltf.scene;
                model.traverse(child => {
                    if (!child.isMesh) return;
                    child.castShadow = true;
                    child.receiveShadow = true;
                });
                configure?.(model);
                model.updateMatrixWorld(true);
                this.assetTemplates.set(key, model);
                return model;
            })
            .catch(err => {
                console.warn(`[ThreeTilesSim] Could not load decor asset ${key}:`, err);
                return null;
            });

        this.assetTemplatePromises.set(key, promise);
        return promise;
    }

    _normalizeModel(model, targetHeight) {
        const bounds = new THREE.Box3().setFromObject(model);
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());
        const height = Math.max(size.y, 0.001);
        const scale = targetHeight / height;

        model.scale.setScalar(scale);
        model.updateMatrixWorld(true);

        const scaledBounds = new THREE.Box3().setFromObject(model);
        const scaledCenter = scaledBounds.getCenter(new THREE.Vector3());
        model.position.x -= scaledCenter.x;
        model.position.z -= scaledCenter.z;
        model.position.y -= scaledBounds.min.y;
    }

    _createAssetInstance(key, position, options = {}) {
        const template = this.assetTemplates.get(key);
        if (!template) return null;

        const {
            rotationY = 0,
            scale = 1,
            randomYaw = 0,
        } = options;

        const instance = template.clone(true);
        const yaw = rotationY + (Math.random() - 0.5) * randomYaw;
        instance.position.copy(position);
        instance.position.y = this.driveSurfaceY;
        instance.rotation.y = yaw;
        instance.scale.multiplyScalar(scale);
        instance.userData.sharedAssetInstance = true;
        instance.traverse(child => {
            child.userData.sharedAssetInstance = true;
        });
        return instance;
    }

    _removeSceneObject(object) {
        if (!object) return;
        this.scene.remove(object);

        if (object.userData?.sharedAssetInstance) {
            return;
        }

        const seenMaterials = new Set();
        object.traverse?.(child => {
            child.geometry?.dispose?.();
            const materials = Array.isArray(child.material) ? child.material : [child.material];
            materials.filter(Boolean).forEach(material => {
                if (seenMaterials.has(material)) return;
                seenMaterials.add(material);
                material.dispose?.();
            });
        });
    }

    _clearRoadNetwork() {
        [...this.roadSurfaces, ...this.roadMarkings, ...this.environmentDecor].forEach(object => {
            this._removeSceneObject(object);
        });
        this.roadSurfaces = [];
        this.roadMarkings = [];
        this.environmentDecor = [];
    }

    _getRouteBounds(routeCoords = []) {
        if (!routeCoords.length) return null;
        let minLng = Infinity;
        let maxLng = -Infinity;
        let minLat = Infinity;
        let maxLat = -Infinity;
        routeCoords.forEach(([lng, lat]) => {
            minLng = Math.min(minLng, lng);
            maxLng = Math.max(maxLng, lng);
            minLat = Math.min(minLat, lat);
            maxLat = Math.max(maxLat, lat);
        });
        const padLng = 0.018;
        const padLat = 0.014;
        return {
            minLng: minLng - padLng,
            maxLng: maxLng + padLng,
            minLat: minLat - padLat,
            maxLat: maxLat + padLat,
        };
    }

    async _createRoadNetwork(routeCoords = null) {
        this._clearRoadNetwork();
        if (!this.renderBackgroundRoads) return;
        try {
            const res = await fetch("/toronto_roads.json");
            const data = await res.json();
            const bounds = this._getRouteBounds(routeCoords) ?? {
                minLng: this.runtime.anchor.lng - 0.03,
                maxLng: this.runtime.anchor.lng + 0.03,
                minLat: this.runtime.anchor.lat - 0.03,
                maxLat: this.runtime.anchor.lat + 0.03,
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

            const normalizedRoads = (Array.isArray(data?.roads) ? data.roads : [])
                .filter(road => road && typeof road === "object")
                .map(road => ({
                    ...road,
                    coords: (Array.isArray(road.coords) ? road.coords : [])
                        .filter(coord => (
                            Array.isArray(coord) &&
                            coord.length >= 2 &&
                            Number.isFinite(coord[0]) &&
                            Number.isFinite(coord[1])
                        )),
                }))
                .filter(road => road.coords.length >= 2);

            const nearbyRoads = normalizedRoads
                .filter(road => road.coords.some(([lng, lat]) => (
                    lng >= bounds.minLng &&
                    lng <= bounds.maxLng &&
                    lat >= bounds.minLat &&
                    lat <= bounds.maxLat
                )))
                .sort((a, b) => {
                    const aWeight = typeWeight[a.type] ?? 99;
                    const bWeight = typeWeight[b.type] ?? 99;
                    if (aWeight !== bWeight) return aWeight - bWeight;
                    return b.coords.length - a.coords.length;
                })
                .slice(0, 1200);

            nearbyRoads.forEach(road => {
                try {
                    const scenePoints = road.coords
                        .map(([lng, lat]) => this.runtime.latLngToScene(lat, lng, this.runtime.anchor.alt + this.driveSurfaceY));
                    if (scenePoints.length < 2) return;

                    const points = this._resamplePolyline(scenePoints, 8)
                        .filter(point => point && Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z));
                    if (points.length < 2) return;

                    const width = this._getRoadWidth(road.type);
                    const roadColor = this._getRoadSurfaceColor(road.type);
                    const isMajorRoad = ["motorway", "trunk", "primary", "secondary"].includes(road.type);

                    const shoulder = isMajorRoad
                        ? this._buildRoadSurface(points, width + 0.45, 0x10141d, -0.03)
                        : null;
                    const surface = this._buildRoadSurface(points, width, roadColor, -0.006);
                    const edgeLines = ["motorway", "trunk", "primary", "secondary"].includes(road.type)
                        ? this._buildRoadEdgeLines(points, width, 0x7b8394, Math.max(0.1, width * 0.05), 0.12)
                        : null;
                    const centerMark = ["motorway", "trunk", "primary"].includes(road.type)
                        ? this._buildRoadMarking(points, road.type, width, {
                            color: 0xa6adba,
                            dashLength: 3.5,
                            gapLength: 10,
                            opacity: 0.16,
                            yOffset: 0.038,
                        })
                        : null;

                    [shoulder, surface, edgeLines, centerMark].forEach(mesh => {
                        if (!mesh) return;
                        mesh.renderOrder = mesh instanceof THREE.LineSegments ? 5 : 3;
                        if (mesh instanceof THREE.LineSegments) this.roadMarkings.push(mesh);
                        else this.roadSurfaces.push(mesh);
                        this.scene.add(mesh);
                    });
                } catch (roadErr) {
                    console.warn("[ThreeTilesSim] Skipping malformed road segment", road?.id, roadErr);
                }
            });
        } catch (err) {
            console.warn("[ThreeTilesSim] Could not load road data:", err);
        }
    }

    _getRoadWidth(type) {
        const widths = {
            motorway: 10,
            trunk: 9,
            primary: 7,
            secondary: 6,
            tertiary: 4.5,
            residential: 3.2,
            service: 2.6,
        };
        return widths[type] || 6;
    }

    _getRoadSurfaceColor(type) {
        if (["motorway", "trunk", "primary"].includes(type)) return 0x1f1d27;
        if (["secondary", "tertiary"].includes(type)) return 0x181824;
        return 0x141520;
    }

    _resamplePolyline(points, segmentLength = 8) {
        if (!points || points.length < 2) return points || [];
        const result = [points[0].clone()];
        for (let i = 1; i < points.length; i++) {
            const from = points[i - 1];
            const to = points[i];
            const dist = from.distanceTo(to);
            const steps = Math.max(1, Math.ceil(dist / segmentLength));
            for (let j = 1; j <= steps; j++) {
                result.push(from.clone().lerp(to, j / steps));
            }
        }
        return result;
    }

    _smoothPolyline(points, segmentLength = 8) {
        if (!points || points.length < 3) {
            return this._resamplePolyline(points, segmentLength);
        }

        const curve = new THREE.CatmullRomCurve3(
            points.map(point => point.clone()),
            false,
            "centripetal",
            0.3
        );
        const totalLength = points.reduce((sum, point, index) => (
            index === 0 ? 0 : sum + point.distanceTo(points[index - 1])
        ), 0);
        const divisions = Math.max(points.length * 3, Math.ceil(totalLength / segmentLength));
        return curve.getPoints(divisions);
    }

    _buildRoadSurface(points, width, color, yOffset = 0) {
        if (!points || points.length < 2) return null;

        const left = [];
        const right = [];

        for (let i = 0; i < points.length; i++) {
            const prev = points[Math.max(i - 1, 0)];
            const next = points[Math.min(i + 1, points.length - 1)];
            const forward = next.clone().sub(prev);
            forward.y = 0;
            if (forward.lengthSq() < 1e-6) continue;
            forward.normalize();

            const point = points[i].clone();
            point.y += yOffset;
            const perp = new THREE.Vector3(-forward.z, 0, forward.x).multiplyScalar(width * 0.5);
            left.push(point.clone().add(perp));
            right.push(point.clone().sub(perp));
        }

        if (left.length < 2 || right.length < 2) return null;

        const vertices = [];
        const indices = [];

        for (let i = 0; i < left.length; i++) {
            vertices.push(left[i].x, left[i].y, left[i].z);
            vertices.push(right[i].x, right[i].y, right[i].z);
        }

        for (let i = 0; i < left.length - 1; i++) {
            const a = i * 2;
            const b = a + 1;
            const c = a + 2;
            const d = a + 3;
            indices.push(a, c, b, b, c, d);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        return new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({
                color,
                roughness: 0.96,
                metalness: 0.02,
            })
        );
    }

    _buildRoadEdgeLines(points, width, color, inset = 0.22, opacity = 0.7) {
        if (!points || points.length < 2) return null;
        const leftPoints = [];
        const rightPoints = [];
        for (let i = 0; i < points.length; i++) {
            const prev = points[Math.max(i - 1, 0)];
            const next = points[Math.min(i + 1, points.length - 1)];
            const forward = next.clone().sub(prev);
            forward.y = 0;
            if (forward.lengthSq() < 1e-6) continue;
            forward.normalize();
            const half = Math.max(0.3, width * 0.5 - inset);
            const perp = new THREE.Vector3(-forward.z, 0, forward.x).multiplyScalar(half);
            const base = points[i].clone().add(new THREE.Vector3(0, 0.045, 0));
            leftPoints.push(base.clone().add(perp));
            rightPoints.push(base.clone().sub(perp));
        }
        if (leftPoints.length < 2 || rightPoints.length < 2) return null;
        const geometry = new THREE.BufferGeometry();
        geometry.setFromPoints([...leftPoints, ...rightPoints]);
        const segments = [];
        for (let i = 0; i < leftPoints.length - 1; i++) {
            segments.push(i, i + 1);
        }
        const offset = leftPoints.length;
        for (let i = 0; i < rightPoints.length - 1; i++) {
            segments.push(offset + i, offset + i + 1);
        }
        geometry.setIndex(segments);
        return new THREE.LineSegments(
            geometry,
            new THREE.LineBasicMaterial({ color, transparent: true, opacity })
        );
    }

    _buildRoadMarking(points, roadType, width, options = {}) {
        if (!points || points.length < 2) return null;
        const isMajor = ["motorway", "trunk", "primary", "secondary"].includes(roadType);
        if (width < 8 || !isMajor) return null;
        const {
            color = 0xf3d78a,
            dashLength = 7,
            gapLength = 9,
            opacity = 0.7,
            yOffset = 0.055,
        } = options;

        const dashSegments = [];
        let travelled = 0;
        for (let i = 1; i < points.length; i++) {
            const from = points[i - 1];
            const to = points[i];
            const segLength = from.distanceTo(to);
            if (segLength < 1e-3) continue;
            const dir = to.clone().sub(from).normalize();
            let cursor = 0;
            while (cursor < segLength) {
                const cycleLength = dashLength + gapLength;
                const cycle = travelled + cursor;
                const inDash = cycle % cycleLength < dashLength;
                const dashStart = cursor;
                const dashEnd = Math.min(segLength, cursor + (inDash ? dashLength : gapLength));
                if (inDash) {
                    const start = from.clone().addScaledVector(dir, dashStart).add(new THREE.Vector3(0, yOffset, 0));
                    const end = from.clone().addScaledVector(dir, dashEnd).add(new THREE.Vector3(0, yOffset, 0));
                    dashSegments.push(start, end);
                }
                cursor = dashEnd;
            }
            travelled += segLength;
        }
        if (!dashSegments.length) return null;

        return new THREE.LineSegments(
            new THREE.BufferGeometry().setFromPoints(dashSegments),
            new THREE.LineBasicMaterial({
                color,
                transparent: true,
                opacity,
            })
        );
    }

    async loadRoute(origin, destination, vibeId = this.currentVibe) {
        const resolvedOrigin = origin?.lat != null ? origin : this.runtime.getAnchor();
        this.currentDestination = destination;

        try {
            const plannedDrive = await planDriveRoute({
                origin: resolvedOrigin,
                destination,
                currentVibe: vibeId,
                profile: this.plannerContext.profile,
                selectedRouteName: this.currentRouteName,
            });
            const routeData = plannedDrive.route;
            this.routeData = routeData;
            this.routeBridge.setMiniMap(this.miniMap);
            this.routeScenePoints = this.routeBridge.setRoute(routeData, this._getVibePalette(vibeId).route)
                .map(point => point.clone());
            await this._createRoadNetwork(routeData.coordinates);
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
                    planning: plannedDrive.planning,
                    candidateRoutes: plannedDrive.routes.map(route => ({
                        routeIndex: route.routeIndex,
                        distanceText: route.distanceText,
                        durationText: route.durationText,
                        highwayBias: route.highwayBias,
                    })),
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
            await this._createRoadNetwork(this.routeData.coordinates);
            this._rebuildRouteMetrics();
            this._drawActiveRoute(vibeId);
            this._placeCarAtRouteStart();
        }
    }

    setPlannerContext(context = {}) {
        this.plannerContext = { ...this.plannerContext, ...context };
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
        this.routeDecor.forEach(item => {
            this._removeSceneObject(item);
        });
        this.routeDecor = [];
        this.environmentDecor.forEach(item => {
            this._removeSceneObject(item);
        });
        this.environmentDecor = [];
        if (this.routeLine) {
            this._removeSceneObject(this.routeLine);
            this.routeLine = null;
        }

        if (this.routeScenePoints.length < 2) return;

        const routePoints = this._resamplePolyline(this.routeScenePoints, 4);
        const palette = this._getVibePalette(vibeId);
        const shoulderGlow = this._buildRoadSurface(routePoints, 12.4, 0x2a0616, -0.05);
        const shoulder = this._buildRoadSurface(routePoints, 10.8, 0x1c0712, -0.02);
        const asphalt = this._buildRoadSurface(routePoints, 8.8, 0x0d0f16, 0);
        const edge = this._buildRoadEdgeLines(routePoints, 8.8, 0xf1e6ee, 0.14, 0.92);
        const center = this._buildRoadMarking(routePoints, "primary", 8.8, {
            color: 0xff3f9f,
            dashLength: 4.5,
            gapLength: 8.5,
            opacity: 0.96,
            yOffset: 0.075,
        });
        [shoulderGlow, shoulder, asphalt, edge, center].forEach(mesh => {
            if (!mesh) return;
            mesh.renderOrder = mesh instanceof THREE.LineSegments ? 11 : 9;
            this.routeDecor.push(mesh);
            this.scene.add(mesh);
        });

        this._populateRouteSetDressing(routePoints, palette);
    }

    _populateRouteSetDressing(routePoints, palette) {
        if (!routePoints || routePoints.length < 2) return;
        const maxProps = Math.min(routePoints.length - 1, 120);
        for (let i = 6; i < maxProps; i += 6) {
            const point = routePoints[i];
            const prev = routePoints[Math.max(0, i - 1)];
            const next = routePoints[Math.min(routePoints.length - 1, i + 1)];
            const forward = next.clone().sub(prev).setY(0);
            if (forward.lengthSq() < 1e-5) continue;
            forward.normalize();
            const side = new THREE.Vector3(-forward.z, 0, forward.x);

            const leftLamp = this._createLampPost(point.clone().addScaledVector(side, 6.7), palette.route);
            const rightLamp = this._createLampPost(point.clone().addScaledVector(side, -6.7), palette.route);
            this.environmentDecor.push(leftLamp, rightLamp);
            this.scene.add(leftLamp, rightLamp);

            if (i % 12 === 0) {
                const leftTree = this._createTree(point.clone().addScaledVector(side, 11.5));
                const rightTree = this._createTree(point.clone().addScaledVector(side, -11.5));
                this.environmentDecor.push(leftTree, rightTree);
                this.scene.add(leftTree, rightTree);
            }

            if (i % 18 === 0) {
                const walkSide = i % 36 === 0 ? 1 : -1;
                const pedestrian = this._createPedestrian(
                    point.clone().addScaledVector(side, 4.5 * walkSide),
                    forward,
                    walkSide
                );
                if (pedestrian) {
                    this.environmentDecor.push(pedestrian);
                    this.scene.add(pedestrian);
                }
            }
        }
    }

    _createLampPost(position, glowColor) {
        const instance = this._createAssetInstance("streetLight", position, {
            scale: 1 + Math.random() * 0.08,
            randomYaw: 0.14,
        });
        if (instance) {
            return instance;
        }

        const group = new THREE.Group();
        const pole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.08, 3.4, 10),
            new THREE.MeshStandardMaterial({ color: 0x151218, roughness: 0.92 })
        );
        pole.position.y = 1.7;
        const bulb = new THREE.Mesh(
            new THREE.SphereGeometry(0.24, 12, 12),
            new THREE.MeshBasicMaterial({ color: new THREE.Color(glowColor).offsetHSL(0, 0.05, 0.22) })
        );
        bulb.position.y = 3.45;
        group.add(pole, bulb);
        group.position.copy(position);
        group.position.y = this.driveSurfaceY;
        return group;
    }

    _createTree(position) {
        const instance = this._createAssetInstance("tree", position, {
            scale: 0.72 + Math.random() * 0.35,
            randomYaw: Math.PI,
        });
        if (instance) {
            return instance;
        }

        const group = new THREE.Group();
        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.16, 0.22, 1.2, 8),
            new THREE.MeshStandardMaterial({ color: 0x140d0a, roughness: 1 })
        );
        trunk.position.y = 0.6;
        const crown = new THREE.Mesh(
            new THREE.ConeGeometry(1.4, 3.4, 7),
            new THREE.MeshStandardMaterial({ color: 0x0f261a, roughness: 1 })
        );
        crown.position.y = 2.6;
        group.add(trunk, crown);
        group.position.copy(position);
        group.position.y = this.driveSurfaceY;
        return group;
    }

    _createPedestrian(position, forward, sideSign = 1) {
        const heading = Math.atan2(forward.x, -forward.z);
        return this._createAssetInstance("pedestrian", position, {
            rotationY: heading + (sideSign > 0 ? Math.PI / 2 : -Math.PI / 2),
            scale: 0.96 + Math.random() * 0.12,
            randomYaw: 0.18,
        });
    }

    _placeCarAtRouteStart() {
        const start = this.routeScenePoints[0];
        if (!start) return;
        this._manualHeading = this._headingAtProgress(0);
        this._syncCarPhysics(start, this._manualHeading, true);
        this.routeBridge.updateMiniMapFromScene(this.carRoot.position, this.carRoot.rotation.y);
    }

    _syncCarPhysics(position, heading = this._manualHeading, resetVelocity = true) {
        if (!this.carRoot) return;

        this._manualHeading = heading;
        this.carRoot.position.copy(position);
        this.carRoot.position.y = this.driveSurfaceY;
        this.carRoot.rotation.set(0, heading, 0);
        this.carRoot.updateMatrixWorld(true);

        if (this.carBody) {
            this.carBody.teleport({
                x: this.carRoot.position.x,
                y: this.carRoot.position.y,
                z: this.carRoot.position.z,
            });
            this.carBody.setAngularVelocity(0, 0, 0, true);
            if (resetVelocity) {
                this.carBody.setVelocity(0, 0, 0, true);
            }
        }

        this._lastCarPosition.copy(this.carRoot.position);
    }

    _headingAtProgress(progressMeters) {
        if (this.routeScenePoints.length < 2) return this._manualHeading;
        let remaining = progressMeters;
        for (let i = 0; i < this.routeSegmentLengths.length; i++) {
            const segmentLength = this.routeSegmentLengths[i];
            if (remaining <= segmentLength) {
                return this.routeBridge.getHeadingFromRouteSegment(i) + Math.PI;
            }
            remaining -= segmentLength;
        }
        return this.routeBridge.getHeadingFromRouteSegment(this.routeSegmentLengths.length - 1) + Math.PI;
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
        if (!this.routeScenePoints.length) return;
        if (!this._isManualDrive) {
            this.toggleManualDrive(true);
        }
        this.isDriving = true;
        this._resetDriveTelemetry();
        this._manualSpeed = 0;
        this.showToast("Guided drive active. You control speed and steering.");
    }

    endDrive() {
        this.isDriving = false;
        if (this._isManualDrive) {
            this.toggleManualDrive(false);
        }
    }

    toggleManualDrive(forceValue = null) {
        const nextState = typeof forceValue === "boolean" ? forceValue : !this._isManualDrive;
        if (nextState === this._isManualDrive) return;

        this._isManualDrive = nextState;
        if (this._isManualDrive) {
            this.isDriving = true;
            this._manualHeading = this.carRoot.rotation.y;
            this._manualSpeed = 0;
            this._resetDriveTelemetry();
            this.showToast("Manual Drive: ON (WASD to drive, L to lock cam)");
        } else {
            this.isDriving = false;
            this._manualSpeed = 0;
            this._speedMph = 0;
            this.carBody?.setVelocity(0, 0, 0, true);
            this.carBody?.setAngularVelocity(0, 0, 0, true);
            this._renderTelemetry();
            this.showToast("Manual Drive: OFF");
        }
    }

    toggleCameraMode() {
        this.cameraMode = this.cameraMode === "chase" ? "free" : "chase";
        if (this.cameraMode === "free") {
            this._freeLookFocus.copy(this.carRoot.position);
        }
        this._updateCameraModeUI();
    }

    setVibe(vibe) {
        this.currentVibe = vibe;
        const palette = this._getVibePalette(vibe);
        if (this.routeLine) {
            this.routeLine.material.color.set(palette.route);
        }
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
            if (this.cameraMode === "chase" && e.button !== 0 && e.button !== 2) return;
            if (this.cameraMode === "free" && e.button !== 2) return;
            e.preventDefault();
            this._orbit.dragging = true;
            this._orbit.dragButton = e.button;
            this._orbit.pointerId = e.pointerId;
            this._orbit.lastX = e.clientX;
            this._orbit.lastY = e.clientY;
            canvas.setPointerCapture?.(e.pointerId);
        });
        canvas.addEventListener("pointermove", e => {
            if (!this._orbit.dragging || e.pointerId !== this._orbit.pointerId) return;
            const dx = e.clientX - this._orbit.lastX;
            const dy = e.clientY - this._orbit.lastY;
            this._orbit.lastX = e.clientX;
            this._orbit.lastY = e.clientY;
            if (this.cameraMode === "chase") {
                this._orbit.headingOffset -= dx * 0.005;
                this._orbit.pitch = clamp(this._orbit.pitch - dy * 0.003, -1.3, -0.1);
            } else {
                this._orbit.theta -= dx * 0.0011;
                this._orbit.phi = clamp(this._orbit.phi + dy * 0.001, 0.28, Math.PI / 2.3);
            }
        });
        const endDrag = e => {
            if (e.pointerId !== this._orbit.pointerId) return;
            this._orbit.dragging = false;
            this._orbit.dragButton = null;
            this._orbit.pointerId = -1;
        };
        canvas.addEventListener("pointerup", endDrag);
        canvas.addEventListener("pointercancel", endDrag);
        canvas.addEventListener("wheel", e => {
            e.preventDefault();
            if (this.cameraMode === "chase") {
                this._orbit.range = clamp(this._orbit.range - e.deltaY * 0.06, 12, 4000);
            } else {
                this._orbit.radius = clamp(this._orbit.radius + e.deltaY * 0.12, 24, 6000);
            }
        }, { passive: false });
        canvas.addEventListener("contextmenu", e => {
            e.preventDefault();
        });
    }

    _positionCameraInitial() {
        const heading = this._manualHeading + this._orbit.headingOffset;
        const horizontalRange = Math.cos(this._orbit.pitch) * this._orbit.range;
        const upOffset = -Math.sin(this._orbit.pitch) * this._orbit.range;
        this.camera.position.set(
            this.carRoot.position.x - Math.sin(heading) * horizontalRange,
            this.carRoot.position.y + upOffset,
            this.carRoot.position.z + Math.cos(heading) * horizontalRange
        );
        this.camera.lookAt(this.carRoot.position.clone().add(new THREE.Vector3(0, 1.6, 0)));
        this._updateCameraModeUI();
    }

    _startLoop() {
        if (this._rafId) cancelAnimationFrame(this._rafId);

        const tick = now => {
            const dt = this._lastFrameTime ? (now - this._lastFrameTime) / 1000 : 1 / 60;
            this._lastFrameTime = now;

            this.runtime.update();
            this._updateSimulation(dt);
            this.context?.update(now);
            this._postPhysicsUpdate(dt);
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
        } else {
            this._speedMph = 0;
            this.carBody?.setVelocity(0, 0, 0, true);
            this.carBody?.setAngularVelocity(0, 0, 0, true);
        }
    }

    _updateManualDrive(dt) {
        const ACCEL = 14;
        const BRAKE = 22;
        const COAST = 0.94;
        const TURN_SPEED = 1.45;
        const MAX_SPEED = 18;

        if (this._keysPressed.has("w") || this._keysPressed.has("arrowup")) {
            this._manualSpeed += ACCEL * dt;
        } else if (this._keysPressed.has("s") || this._keysPressed.has("arrowdown")) {
            this._manualSpeed -= BRAKE * dt;
        } else {
            this._manualSpeed *= COAST;
        }

        this._manualSpeed = clamp(this._manualSpeed, -6, MAX_SPEED);

        let steerInput = 0;
        if (this._keysPressed.has("a") || this._keysPressed.has("arrowleft")) {
            steerInput -= 1;
        }
        if (this._keysPressed.has("d") || this._keysPressed.has("arrowright")) {
            steerInput += 1;
        }

        const heading = this._manualHeading;
        const speedFactor = clamp(Math.abs(this._manualSpeed) / 6, 0, 1);
        const steerAuthority = Math.max(speedFactor, 0.12);
        const turnRate = steerInput * TURN_SPEED * steerAuthority;
        this._manualHeading = heading + turnRate * dt;

        const moveDist = this._manualSpeed * dt;
        const move = this._getForwardVector(this._manualHeading).multiplyScalar(moveDist);
        this.carRoot.position.add(move);
        this.carRoot.position.y = this.driveSurfaceY;
        this.carRoot.rotation.y = this._manualHeading;
        this.carRoot.updateMatrixWorld(true);
    }

    _postPhysicsUpdate(dt) {
        if (!this.carRoot) return;

        const frameDistance = this.carRoot.position.distanceTo(this._lastCarPosition);
        this._lastCarPosition.copy(this.carRoot.position);
        this._manualHeading = this.carRoot.rotation.y;

        if (this._isManualDrive) {
            this._distanceMiles += frameDistance * 0.000621371;
            this._driveElapsedSeconds += dt;
            this._speedMph = Math.round(Math.abs(this._manualSpeed) * 2.23694);

            if (typeof this._advanceNavCards === "function") {
                const nearest = this._estimateRouteProgressFromPosition(this.carRoot.position);
                this._advanceNavCards(nearest);
            }
        }

        this.routeBridge?.updateMiniMapFromScene(this.carRoot.position, this.carRoot.rotation.y);
        this._renderTelemetry();
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
        this.carRoot.position.y = this.driveSurfaceY;
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
            if (!this._orbit.dragging) {
                this._orbit.headingOffset *= Math.max(0, 1 - dt * 2.8);
            }
            const baseForward = this._getForwardVector(this.carRoot.rotation.y);
            const headingForward = baseForward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), this._orbit.headingOffset).normalize();
            const horizontalRange = Math.cos(this._orbit.pitch) * this._orbit.range;
            const upOffset = -Math.sin(this._orbit.pitch) * this._orbit.range;
            const desired = this.carRoot.position.clone()
                .addScaledVector(headingForward, -horizontalRange)
                .add(new THREE.Vector3(0, upOffset, 0));
            this.camera.position.lerp(desired, clamp(dt * 6.5, 0, 1));
            const lookTarget = this.carRoot.position.clone()
                .add(new THREE.Vector3(0, 1.5, 0))
                .addScaledVector(baseForward, 12);
            this.camera.lookAt(lookTarget);
        } else {
            const focus = this._freeLookFocus.clone();
            this.camera.position.set(
                focus.x + this._orbit.radius * Math.sin(this._orbit.phi) * Math.sin(this._orbit.theta),
                focus.y + this._orbit.radius * Math.cos(this._orbit.phi),
                focus.z + this._orbit.radius * Math.sin(this._orbit.phi) * Math.cos(this._orbit.theta)
            );
            this.camera.lookAt(focus);
        }
    }

    _getForwardVector(heading = this._manualHeading) {
        return new THREE.Vector3(
            Math.sin(heading),
            0,
            -Math.cos(heading)
        ).normalize();
    }

    _estimateRouteProgressFromPosition(position) {
        if (this.routeScenePoints.length < 2) return 0;
        let bestDistanceSq = Infinity;
        let bestProgress = 0;
        let cumulative = 0;
        for (let i = 0; i < this.routeSegmentLengths.length; i++) {
            const from = this.routeScenePoints[i];
            const to = this.routeScenePoints[i + 1];
            const seg = to.clone().sub(from);
            const segLengthSq = seg.lengthSq();
            if (segLengthSq < 1e-6) continue;
            const t = clamp(position.clone().sub(from).dot(seg) / segLengthSq, 0, 1);
            const projected = from.clone().lerp(to, t);
            const distSq = projected.distanceToSquared(position);
            if (distSq < bestDistanceSq) {
                bestDistanceSq = distSq;
                bestProgress = cumulative + this.routeSegmentLengths[i] * t;
            }
            cumulative += this.routeSegmentLengths[i];
        }
        return bestProgress;
    }

    _renderTelemetry() {
        const speedMph = Math.max(0, Math.round(this._speedMph));
        const distanceMiles = Math.max(0, this._distanceMiles).toFixed(1);
        const mins = Math.floor(this._driveElapsedSeconds / 60);
        const secs = String(Math.floor(this._driveElapsedSeconds % 60)).padStart(2, "0");

        const elSpeed = document.getElementById("speedDisplay");
        const elStatSpeed = document.getElementById("statSpeed");
        const elStatDist = document.getElementById("statDistance");
        const elStatTime = document.getElementById("statTime");

        if (elSpeed) elSpeed.textContent = String(speedMph);
        if (elStatSpeed) elStatSpeed.textContent = String(speedMph);
        if (elStatDist) elStatDist.textContent = distanceMiles;
        if (elStatTime) elStatTime.textContent = `${mins}:${secs}`;
    }

    _resetDriveTelemetry() {
        this.routeProgressMeters = 0;
        this._distanceMiles = 0;
        this._driveElapsedSeconds = 0;
        this._speedMph = 0;
        this._driveStartTimestamp = performance.now();
        this._renderTelemetry();
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
            scenic: { route: "#f4d38b", road: "#3e4f60", majorRoad: "#7bbce9" },
            chill: { route: "#68f4dc", road: "#355b59", majorRoad: "#8bfff3" },
            adventure: { route: "#ff4f9f", road: "#4d2d49", majorRoad: "#ff93c8" },
            fastest: { route: "#ced8e5", road: "#576374", majorRoad: "#e7f0fa" },
            exciting: { route: "#ff77e8", road: "#5c3173", majorRoad: "#ff9df0" },
            quiet: { route: "#6ff0b2", road: "#264d43", majorRoad: "#94ffd0" },
        };
        return palettes[vibeId] ?? palettes.scenic;
    }
}
