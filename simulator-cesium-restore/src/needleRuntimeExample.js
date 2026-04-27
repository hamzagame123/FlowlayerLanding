import * as THREE from "three";

import { NeedleTilesRuntime } from "./needleTilesRuntime.js";
import { NeedleRouteBridge } from "./needleRouteBridge.js";
import { fetchGoogleDirectionsRoute } from "./routeService.js";

/**
 * Reference integration for the eventual Needle migration of /simulator.
 *
 * This file is intentionally not wired into the app yet. It documents and validates the exact
 * runtime contract we need once Cesium is removed:
 * - 3DTilesRendererJS owns world tiles
 * - Google routes stay intact
 * - minimap stays geo-accurate
 */
export async function createNeedleRuntimeExample({
    scene,
    camera,
    renderer,
    apiToken,
    miniMap = null,
    vibeId = "scenic",
    destination = "351 Davenport Road, Toronto, ON",
}) {
    const runtime = new NeedleTilesRuntime({
        scene,
        camera,
        renderer,
        apiToken,
    });
    runtime.init();

    const routeBridge = new NeedleRouteBridge({ runtime, miniMap });
    const origin = runtime.getAnchor();
    const routeData = await fetchGoogleDirectionsRoute(origin, destination, vibeId);
    routeBridge.setRoute(routeData);

    const car = new THREE.Object3D();
    const routePoints = routeBridge.getSceneRoutePoints();
    if (routePoints.length) {
        car.position.copy(routePoints[0]);
        car.rotation.y = routeBridge.getHeadingFromRouteSegment(0);
        const snapped = runtime.snapToSurface(car.position);
        if (snapped) car.position.copy(snapped);
        scene.add(car);
        routeBridge.updateMiniMapFromScene(car.position, car.rotation.y);
    }

    return {
        runtime,
        routeBridge,
        car,
        update() {
            runtime.update();
            routeBridge.updateMiniMapFromScene(car.position, car.rotation.y);
        },
    };
}
