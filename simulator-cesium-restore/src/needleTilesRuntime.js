import * as THREE from "three";
import { TilesRenderer } from "3d-tiles-renderer/three";
import { CesiumIonAuthPlugin, GLTFExtensionsPlugin, ReorientationPlugin } from "3d-tiles-renderer/plugins";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

import { GeoAnchor } from "./geoAnchor.js";

const DEFAULT_OSM_BUILDINGS_ASSET_ID = 96188;
const DEFAULT_START = {
    lat: 43.64330,
    lng: -79.37130,
    alt: 75,
};

/**
 * Needle-compatible 3D Tiles runtime.
 *
 * It does not import Needle directly. Instead it accepts the scene, camera, and renderer
 * objects Needle provides, which makes it safe to reuse in this project before the full
 * renderer swap is complete.
 */
export class NeedleTilesRuntime {
    constructor({
        scene,
        camera,
        renderer,
        apiToken,
        assetId = DEFAULT_OSM_BUILDINGS_ASSET_ID,
        anchor = DEFAULT_START,
    }) {
        this.scene = scene;
        this.camera = camera;
        this.renderer = renderer;
        this.apiToken = apiToken;
        this.assetId = assetId;
        this.anchor = {
            lat: anchor.lat,
            lng: anchor.lng,
            alt: anchor.alt ?? DEFAULT_START.alt,
        };

        this.geoAnchor = new GeoAnchor(this.anchor.lat, this.anchor.lng, this.anchor.alt);
        this.tilesRenderer = null;
        this.tilesGroup = new THREE.Group();
        this.dracoLoader = null;
        this.ktx2Loader = null;
        this.surfaceRaycaster = new THREE.Raycaster();
        this._initialized = false;
    }

    init() {
        if (this._initialized) return;
        if (!this.scene || !this.camera || !this.renderer) {
            throw new Error("NeedleTilesRuntime requires scene, camera, and renderer");
        }

        this.tilesRenderer = new TilesRenderer();
        this.dracoLoader = new DRACOLoader(this.tilesRenderer.manager);
        this.dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");

        this.ktx2Loader = new KTX2Loader(this.tilesRenderer.manager);
        this.ktx2Loader
            .setTranscoderPath("https://unpkg.com/three@0.170.0/examples/jsm/libs/basis/")
            .detectSupport(this.renderer);

        if (this.apiToken) {
            this.tilesRenderer.registerPlugin(new CesiumIonAuthPlugin({
                apiToken: this.apiToken,
                assetId: String(this.assetId),
                autoRefreshToken: true,
            }));
            this.tilesRenderer.registerPlugin(new GLTFExtensionsPlugin({
                dracoLoader: this.dracoLoader,
                ktxLoader: this.ktx2Loader,
                meshoptDecoder: MeshoptDecoder,
                autoDispose: false,
            }));
            this.tilesRenderer.registerPlugin(new ReorientationPlugin({
                lat: THREE.MathUtils.degToRad(this.anchor.lat),
                lon: THREE.MathUtils.degToRad(this.anchor.lng),
                height: this.anchor.alt,
                recenter: true,
            }));

            this.tilesRenderer.setCamera(this.camera);
            this.tilesRenderer.setResolutionFromRenderer(this.camera, this.renderer);

            this.tilesGroup.name = "FlowLayerNeedleTiles";
            this.tilesGroup.add(this.tilesRenderer.group);
            this.scene.add(this.tilesGroup);
        } else {
            console.warn("[NeedleTilesRuntime] Missing VITE_CESIUM_ION_TOKEN. Running without 3D tiles.");
        }

        this._initialized = true;
    }

    update() {
        if (!this.tilesRenderer || !this.apiToken) return;
        this.camera.updateMatrixWorld?.();
        this.tilesRenderer.setCamera(this.camera);
        this.tilesRenderer.setResolutionFromRenderer(this.camera, this.renderer);
        this.tilesRenderer.update();
    }

    dispose() {
        if (!this._initialized) return;

        if (this.tilesGroup.parent) {
            this.tilesGroup.parent.remove(this.tilesGroup);
        }

        this.dracoLoader?.dispose?.();
        this.ktx2Loader?.dispose?.();
        this.tilesRenderer?.dispose?.();

        this.tilesRenderer = null;
        this.dracoLoader = null;
        this.ktx2Loader = null;
        this._initialized = false;
    }

    latLngToScene(lat, lng, alt = 0) {
        const local = this.geoAnchor.geodeticToLocal(lat, lng, alt);
        return new THREE.Vector3(local.east, local.up, -local.north);
    }

    sceneToLatLng(position) {
        const geo = this.geoAnchor.localToGeodetic(position.x, -position.z, position.y);
        return {
            lat: geo.lat,
            lng: geo.lng,
            alt: geo.alt,
        };
    }

    routeToScenePoints(coordinates, altitudeOffset = 0) {
        return coordinates.map(([lng, lat]) => this.latLngToScene(lat, lng, this.anchor.alt + altitudeOffset));
    }

    getAnchor() {
        return { ...this.anchor };
    }

    /**
     * Snap against loaded tile meshes when available. This preserves local surface feel while
     * keeping the minimap and route geometry grounded in lat/lng.
     */
    snapToSurface(position, surfaceOffset = 1.0) {
        if (!this.tilesRenderer || !this.apiToken || this.tilesRenderer.group.children.length === 0) return null;

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
}
