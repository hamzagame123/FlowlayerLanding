import * as THREE from "three";
import { TilesRenderer } from "3d-tiles-renderer/three";
import { CesiumIonAuthPlugin, GLTFExtensionsPlugin, ReorientationPlugin } from "3d-tiles-renderer/plugins";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

/** Golden Gate / waterfront — matches UI “Golden Gate Bridge” (SIMULATOR_V2_PLAN). */
const ANCHOR_LAT = 37.8199;
const ANCHOR_LNG = -122.4783;
const ANCHOR_ALT = 14;
const DEFAULT_OSM_ASSET_ID = 96188;

/**
 * Stream Cesium ion OSM Buildings into the same Three.js scene (real massing around the drive).
 */
export function createCesiumOSMLayer(scene, camera, renderer, apiToken) {
    if (!apiToken || apiToken === "YOUR_CESIUM_ION_TOKEN_HERE") {
        console.warn("[FlowLayer] Set VITE_CESIUM_ION_TOKEN in .env for Cesium OSM Buildings.");
        return null;
    }

    const assetIdRaw = import.meta.env.VITE_CESIUM_ION_OSM_ASSET_ID;
    const parsed = Number.parseInt(String(assetIdRaw || ""), 10);
    const assetId = Number.isFinite(parsed) ? parsed : DEFAULT_OSM_ASSET_ID;

    const tilesRenderer = new TilesRenderer();
    const dracoLoader = new DRACOLoader(tilesRenderer.manager);
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.7/");

    const ktx2Loader = new KTX2Loader(tilesRenderer.manager);
    ktx2Loader.setTranscoderPath("https://unpkg.com/three@0.170.0/examples/jsm/libs/basis/").detectSupport(renderer);

    tilesRenderer.registerPlugin(
        new CesiumIonAuthPlugin({
            apiToken,
            assetId: String(assetId),
            autoRefreshToken: true,
        })
    );
    tilesRenderer.registerPlugin(
        new GLTFExtensionsPlugin({
            dracoLoader,
            ktxLoader: ktx2Loader,
            meshoptDecoder: MeshoptDecoder,
            autoDispose: false,
        })
    );
    tilesRenderer.registerPlugin(
        new ReorientationPlugin({
            lat: THREE.MathUtils.degToRad(ANCHOR_LAT),
            lon: THREE.MathUtils.degToRad(ANCHOR_LNG),
            height: ANCHOR_ALT,
            recenter: true,
        })
    );

    tilesRenderer.setCamera(camera);
    tilesRenderer.setResolutionFromRenderer(camera, renderer);

    /** Slight offset so the procedural road reads as “through” the city slice. */
    tilesRenderer.group.position.set(-18, 0, -140);

    scene.add(tilesRenderer.group);

    const accent = new THREE.Color(0x00f5d4);

    return {
        tilesRenderer,
        update() {
            camera.updateMatrixWorld();
            tilesRenderer.setCamera(camera);
            tilesRenderer.setResolutionFromRenderer(camera, renderer);
            tilesRenderer.update();
        },
        setVibeAccent(color) {
            accent.copy(color);
            tilesRenderer.forEachLoadedModel((root) => {
                root.traverse((obj) => {
                    if (!obj.isMesh) return;
                    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                    for (const m of mats) {
                        if (!m || !("emissive" in m) || !m.emissive) continue;
                        m.emissive.copy(accent);
                        m.emissiveIntensity = Math.max(typeof m.emissiveIntensity === "number" ? m.emissiveIntensity : 0.1, 0.14);
                    }
                });
            });
        },
    };
}
