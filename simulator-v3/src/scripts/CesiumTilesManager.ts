import * as THREE from "three";
import { TilesRenderer } from "3d-tiles-renderer/three";
import { CesiumIonAuthPlugin, GLTFExtensionsPlugin, ReorientationPlugin } from "3d-tiles-renderer/plugins";
import type { Context } from "@needle-tools/engine";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const WGS84_A = 6378137.0;
const WGS84_F = 1 / 298.257223563;
const WGS84_B = WGS84_A * (1 - WGS84_F);

/** Cesium ion global OSM Buildings (3D Tiles). Override with VITE_CESIUM_ION_OSM_ASSET_ID if needed. */
const DEFAULT_OSM_BUILDINGS_ASSET_ID = 96188;

export class CesiumTilesManager {
    private context: Context;
    private tilesRenderer: TilesRenderer | null = null;
    private tilesGroup: THREE.Group;
    private dracoLoader: DRACOLoader | null = null;
    private ktx2Loader: KTX2Loader | null = null;
    private drivingPlane: THREE.Plane;

    private startLat = 43.6428;
    private startLng = -79.3668;
    private startAlt = 6;

    constructor(context: Context) {
        this.context = context;
        this.tilesGroup = new THREE.Group();
        const gy = this.latLngToScene(this.startLat, this.startLng, 0).y;
        this.drivingPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -gy);
    }

    init() {
        const apiToken = import.meta.env.VITE_CESIUM_ION_TOKEN;
        if (!apiToken || apiToken === "YOUR_CESIUM_ION_TOKEN_HERE") {
            console.warn(
                "[CesiumTilesManager] No Cesium ion token. Add VITE_CESIUM_ION_TOKEN (see https://ion.cesium.com/tokens). Running without 3D buildings."
            );
            this.createFallbackGround();
            return;
        }

        const parsedId = Number.parseInt(import.meta.env.VITE_CESIUM_ION_OSM_ASSET_ID ?? "", 10);
        const assetId = Number.isFinite(parsedId) ? parsedId : DEFAULT_OSM_BUILDINGS_ASSET_ID;

        this.tilesRenderer = new TilesRenderer();
        this.dracoLoader = new DRACOLoader(this.tilesRenderer.manager);
        this.dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");

        this.ktx2Loader = new KTX2Loader(this.tilesRenderer.manager);
        this.ktx2Loader
            .setTranscoderPath("https://unpkg.com/three@0.169.19/examples/jsm/libs/basis/")
            .detectSupport(this.context.renderer);

        this.tilesRenderer.registerPlugin(
            new CesiumIonAuthPlugin({
                apiToken,
                assetId: String(assetId),
                autoRefreshToken: true,
            })
        );
        this.tilesRenderer.registerPlugin(
            new GLTFExtensionsPlugin({
                dracoLoader: this.dracoLoader,
                ktxLoader: this.ktx2Loader,
                meshoptDecoder: MeshoptDecoder,
                autoDispose: false,
            })
        );
        this.tilesRenderer.registerPlugin(
            new ReorientationPlugin({
                lat: THREE.MathUtils.degToRad(this.startLat),
                lon: THREE.MathUtils.degToRad(this.startLng),
                height: this.startAlt,
                recenter: true,
            })
        );

        this.tilesRenderer.setCamera(this.context.mainCamera as THREE.PerspectiveCamera);
        this.tilesRenderer.setResolutionFromRenderer(this.context.mainCamera as THREE.PerspectiveCamera, this.context.renderer);

        this.tilesGroup.add(this.tilesRenderer.group);
        this.context.scene.add(this.tilesGroup);
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

        const sinLat = Math.sin((this.startLat * Math.PI) / 180);
        const cosLat = Math.cos((this.startLat * Math.PI) / 180);
        const sinLng = Math.sin((this.startLng * Math.PI) / 180);
        const cosLng = Math.cos((this.startLng * Math.PI) / 180);

        const dx = cartesian.x - origin.x;
        const dy = cartesian.y - origin.y;
        const dz = cartesian.z - origin.z;

        const east = -sinLng * dx + cosLng * dy;
        const north = -sinLat * cosLng * dx - sinLat * sinLng * dy + cosLat * dz;
        const up = cosLat * cosLng * dx + cosLat * sinLng * dy + sinLat * dz;

        return new THREE.Vector3(east, up, -north);
    }

    private geodeticToECEF(lat: number, lng: number, alt: number): THREE.Vector3 {
        const latRad = (lat * Math.PI) / 180;
        const lngRad = (lng * Math.PI) / 180;
        const e2 = 1 - (WGS84_B * WGS84_B) / (WGS84_A * WGS84_A);
        const N = WGS84_A / Math.sqrt(1 - e2 * Math.sin(latRad) * Math.sin(latRad));

        return new THREE.Vector3(
            (N + alt) * Math.cos(latRad) * Math.cos(lngRad),
            (N + alt) * Math.cos(latRad) * Math.sin(lngRad),
            (N * (1 - e2) + alt) * Math.sin(latRad)
        );
    }

    private createFallbackGround() {
        const ground = new THREE.Mesh(
            new THREE.PlaneGeometry(2000, 2000),
            new THREE.MeshStandardMaterial({ color: 0x1a1a28, roughness: 0.9 })
        );
        ground.rotation.x = -Math.PI / 2;
        ground.position.y = this.latLngToScene(this.startLat, this.startLng, 0).y;
        ground.receiveShadow = true;
        this.context.scene.add(ground);

        const grid = new THREE.GridHelper(2000, 200, 0x00f5d4, 0x111122);
        (grid.material as THREE.Material).opacity = 0.15;
        (grid.material as THREE.Material).transparent = true;
        grid.position.y = ground.position.y + 0.05;
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

    /**
     * Snap to curated drivable height: local ellipsoid ground (not building roofs).
     * OSM Buildings are visual massing only per v3 plan.
     */
    snapToSurface(position: THREE.Vector3, surfaceOffset: number = 0.9): THREE.Vector3 | null {
        const origin = position.clone();
        origin.y += 800;
        const dir = new THREE.Vector3(0, -1, 0);
        const hit = new THREE.Vector3();
        const ray = new THREE.Ray(origin, dir);
        if (!ray.intersectPlane(this.drivingPlane, hit)) return null;
        return hit.clone().add(new THREE.Vector3(0, surfaceOffset, 0));
    }

    getWorldAnchor(): THREE.Vector3 | null {
        if (!this.tilesRenderer) return null;
        const position = this.tilesRenderer.group.position;
        if (position.lengthSq() === 0) return null;
        return position.clone();
    }
}
