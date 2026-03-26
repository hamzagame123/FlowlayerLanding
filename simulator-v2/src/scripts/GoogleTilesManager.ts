import * as THREE from "three";
import { TilesRenderer } from "3d-tiles-renderer/three";
import { GoogleCloudAuthPlugin, GLTFExtensionsPlugin, ReorientationPlugin } from "3d-tiles-renderer/plugins";
import type { Context } from "@needle-tools/engine";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const WGS84_A = 6378137.0;
const WGS84_F = 1 / 298.257223563;
const WGS84_B = WGS84_A * (1 - WGS84_F);

export class GoogleTilesManager {
    private context: Context;
    private tilesRenderer: TilesRenderer | null = null;
    private tilesGroup: THREE.Group;
    private dracoLoader: DRACOLoader | null = null;
    private ktx2Loader: KTX2Loader | null = null;
    private surfaceRaycaster = new THREE.Raycaster();

    private startLat = 43.64444326865409;
    private startLng = -79.36930438053525;
    private startAlt = 20;

    constructor(context: Context) {
        this.context = context;
        this.tilesGroup = new THREE.Group();
    }

    init() {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        if (!apiKey || apiKey === "YOUR_GOOGLE_MAPS_API_KEY_HERE") {
            console.warn("[GoogleTilesManager] No API key. Running without 3D tiles.");
            this.createFallbackGround();
            return;
        }

        this.tilesRenderer = new TilesRenderer("https://tile.googleapis.com/v1/3dtiles/root.json");
        this.dracoLoader = new DRACOLoader(this.tilesRenderer.manager);
        this.dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");

        this.ktx2Loader = new KTX2Loader(this.tilesRenderer.manager);
        this.ktx2Loader
            .setTranscoderPath("https://unpkg.com/three@0.169.19/examples/jsm/libs/basis/")
            .detectSupport(this.context.renderer);

        this.tilesRenderer.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: apiKey, autoRefreshToken: true }));
        this.tilesRenderer.registerPlugin(new GLTFExtensionsPlugin({
            dracoLoader: this.dracoLoader,
            ktxLoader: this.ktx2Loader,
            meshoptDecoder: MeshoptDecoder,
            autoDispose: false,
        }));
        this.tilesRenderer.registerPlugin(new ReorientationPlugin({
            lat: THREE.MathUtils.degToRad(this.startLat),
            lon: THREE.MathUtils.degToRad(this.startLng),
            height: this.startAlt,
            recenter: true,
        }));
        this.tilesRenderer.setCamera(this.context.mainCamera as THREE.PerspectiveCamera);
        this.tilesRenderer.setResolutionFromRenderer(this.context.mainCamera as THREE.PerspectiveCamera, this.context.renderer);

        this.tilesGroup.add(this.tilesRenderer.group);
        this.context.scene.add(this.tilesGroup);

        this.positionCamera();
    }

    update(context: Context) {
        if (!this.tilesRenderer) return;
        const camera = context.mainCamera as THREE.PerspectiveCamera;
        camera.updateMatrixWorld();
        this.tilesRenderer.setCamera(camera);
        this.tilesRenderer.setResolutionFromRenderer(camera, context.renderer);
        this.tilesRenderer.update();
    }

    latLngToScene(lat: number, lng: number, alt: number = 0): THREE.Vector3 {
        const cartesian = this.geodeticToECEF(lat, lng, alt);
        const origin = this.geodeticToECEF(this.startLat, this.startLng, 0);

        const sinLat = Math.sin(this.startLat * Math.PI / 180);
        const cosLat = Math.cos(this.startLat * Math.PI / 180);
        const sinLng = Math.sin(this.startLng * Math.PI / 180);
        const cosLng = Math.cos(this.startLng * Math.PI / 180);

        const dx = cartesian.x - origin.x;
        const dy = cartesian.y - origin.y;
        const dz = cartesian.z - origin.z;

        const east = -sinLng * dx + cosLng * dy;
        const north = -sinLat * cosLng * dx - sinLat * sinLng * dy + cosLat * dz;
        const up = cosLat * cosLng * dx + cosLat * sinLng * dy + sinLat * dz;

        return new THREE.Vector3(east, up, -north);
    }

    private geodeticToECEF(lat: number, lng: number, alt: number): THREE.Vector3 {
        const latRad = lat * Math.PI / 180;
        const lngRad = lng * Math.PI / 180;
        const e2 = 1 - (WGS84_B * WGS84_B) / (WGS84_A * WGS84_A);
        const N = WGS84_A / Math.sqrt(1 - e2 * Math.sin(latRad) * Math.sin(latRad));

        return new THREE.Vector3(
            (N + alt) * Math.cos(latRad) * Math.cos(lngRad),
            (N + alt) * Math.cos(latRad) * Math.sin(lngRad),
            (N * (1 - e2) + alt) * Math.sin(latRad)
        );
    }

    private positionCamera() {
        const camera = this.context.mainCamera as THREE.PerspectiveCamera;
        camera.near = 0.1;
        camera.far = 10000000;
        camera.position.set(0, 1200, 1200);
        camera.lookAt(0, 0, 0);
        camera.updateProjectionMatrix();
    }

    private createFallbackGround() {
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(2000, 2000),
            new THREE.MeshStandardMaterial({ color: 0x1a1a28, roughness: 0.9 })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.receiveShadow = true;
        this.context.scene.add(ground);

        const grid = new THREE.GridHelper(2000, 200, 0x00f5d4, 0x111122);
        (grid.material as THREE.Material).opacity = 0.15;
        (grid.material as THREE.Material).transparent = true;
        this.context.scene.add(grid);

        const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
        this.context.scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xff9f6b, 0.8);
        dirLight.position.set(50, 80, -30);
        this.context.scene.add(dirLight);

    }

    getStartCoordinates() {
        return { lat: this.startLat, lng: this.startLng, alt: this.startAlt };
    }

    getStartScenePosition(heightOffset: number = 0) {
        return this.latLngToScene(this.startLat, this.startLng, this.startAlt + heightOffset);
    }

    snapToSurface(position: THREE.Vector3, surfaceOffset: number = 1.5): THREE.Vector3 | null {
        if (!this.tilesRenderer || this.tilesRenderer.group.children.length === 0) return null;

        const rayOrigin = position.clone();
        rayOrigin.y += 600;

        this.surfaceRaycaster.near = 0;
        this.surfaceRaycaster.far = 2000;
        this.surfaceRaycaster.set(rayOrigin, new THREE.Vector3(0, -1, 0));

        const hits = this.surfaceRaycaster.intersectObject(this.tilesRenderer.group, true);
        const hit = hits.find(entry => entry.point && Number.isFinite(entry.point.y));
        if (!hit) return null;

        return hit.point.clone().add(new THREE.Vector3(0, surfaceOffset, 0));
    }

    getWorldAnchor(): THREE.Vector3 | null {
        if (!this.tilesRenderer) return null;
        const position = this.tilesRenderer.group.position;
        if (position.lengthSq() === 0) return null;
        return position.clone();
    }
}
