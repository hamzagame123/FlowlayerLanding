import { onStart, onUpdate } from "@needle-tools/engine";
import * as THREE from "three";
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js";

import { CesiumTilesManager } from "./scripts/CesiumTilesManager.js";
import { CarController } from "./scripts/CarController.js";
import { GamepadInput } from "./scripts/GamepadInput.js";
import { WaypointRoute } from "./scripts/WaypointRoute.js";
import { VibeManager } from "./scripts/VibeManager.js";
import { CameraFollow } from "./scripts/CameraFollow.js";
import { HUDBridge } from "./scripts/HUDBridge.js";
import { AIVibeEngine } from "./scripts/AIVibeEngine.js";

import { initStoryExperience } from "./ui/story.js";
import { PersonalizationEngine } from "./ui/personalization.js";
import { TrafficShaderBackground } from "./ui/shaderBackground.js";

let tilesManager: CesiumTilesManager;
let carController: CarController;
let gamepadInput: GamepadInput;
let waypointRoute: WaypointRoute;
let vibeManager: VibeManager;
let cameraFollow: CameraFollow;
let hudBridge: HUDBridge;
let aiVibeEngine: AIVibeEngine;
let personalization: PersonalizationEngine;
let shaderBackground: TrafficShaderBackground | null = null;
const TILE_SPAWN_HEIGHT = 2;
const DEFAULT_CAMERA_STATE = {
    mode: "chase" as const,
    chaseOffset: [0, 8, 22] as [number, number, number],
    lookOffset: [0, 3.5, -2] as [number, number, number],
    orbitTheta: 0,
    orbitPhi: Math.PI / 4.2,
    orbitRadius: 85,
};
let startSurfaceSnapPending = true;

const shaderCanvas = document.getElementById("trafficShaderCanvas") as HTMLCanvasElement | null;
if (shaderCanvas) {
    shaderBackground = new TrafficShaderBackground(shaderCanvas);
    shaderBackground.init();
    shaderBackground.setScreen("storyIntro");
}

personalization = new PersonalizationEngine();

initStoryExperience(() => {
    showScreen("onboarding");
    personalization.start(async () => {
        showScreen("simulator");
        if (aiVibeEngine) {
            await aiVibeEngine.applyGeneratedVibe(personalization.getAnswers());
        }
    });
});

onStart(context => {
    const scene = context.scene;
    context.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    context.renderer.toneMappingExposure = 1.1;
    startSurfaceSnapPending = true;

    tilesManager = new CesiumTilesManager(context);
    tilesManager.init();

    const carObj = new THREE.Object3D();
    carObj.name = "Car";
    carObj.position.copy(tilesManager.getStartScenePosition(TILE_SPAWN_HEIGHT));
    scene.add(carObj);

    const fbxLoader = new FBXLoader();
    fbxLoader.load(
        "/models/audi-rs-q8-2019.fbx",
        (model) => {
            const bounds = new THREE.Box3().setFromObject(model);
            const size = bounds.getSize(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z) || 1;
            const targetSize = 4;
            const scale = targetSize / maxDim;
            model.scale.setScalar(scale);
            model.rotation.x = -Math.PI / 2;
            model.position.set(0, -bounds.min.y * scale, 0);
            model.traverse(child => {
                if ((child as THREE.Mesh).isMesh) {
                    const mesh = child as THREE.Mesh;
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                }
            });
            carObj.add(model);
        },
        undefined,
        (error) => {
            console.error("[main] Failed to load FBX car model", error);
        }
    );

    carController = new CarController(context, carObj);
    gamepadInput = new GamepadInput(carController);
    cameraFollow = new CameraFollow(context, carObj);
    cameraFollow.applyState(DEFAULT_CAMERA_STATE);

    waypointRoute = new WaypointRoute(context, tilesManager);
    waypointRoute.loadRoute("coastal");

    vibeManager = new VibeManager(context);
    vibeManager.setVibe("scenic");

    hudBridge = new HUDBridge(carController, waypointRoute, vibeManager, cameraFollow);
    hudBridge.init();

    aiVibeEngine = new AIVibeEngine(vibeManager);

    // Keep the initial render path simple while the tiles integration stabilizes.
    // We can add postprocessing back once the base scene renders correctly.
});

onUpdate(context => {
    if (!tilesManager) return;

    tilesManager.update(context);

    if (startSurfaceSnapPending && carController) {
        const snappedPosition = tilesManager.snapToSurface(carController.getPosition());
        if (snappedPosition) {
            carController.setPosition(snappedPosition);
            const routeDirection = waypointRoute?.getNextWaypointDirection(snappedPosition);
            if (routeDirection) {
                carController.setHeading(Math.atan2(routeDirection.x, -routeDirection.z));
            }
            startSurfaceSnapPending = false;
        }
    }

    gamepadInput?.update();
    carController?.update(context);
    cameraFollow?.update(context);
    vibeManager?.update(context.time.deltaTime);
    waypointRoute?.update(carController?.getPosition());
    hudBridge?.update();
});

function showScreen(id: string) {
    document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
    const target = document.getElementById(id);
    if (target) target.classList.add("active");
    document.body.dataset.screen = id;
    if (id === "storyIntro" || id === "onboarding" || id === "simulator") {
        shaderBackground?.setScreen(id);
    }
}

export { showScreen, vibeManager, carController, waypointRoute, aiVibeEngine, personalization };
