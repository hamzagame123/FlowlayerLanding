import * as THREE from "three";
import type { Context } from "@needle-tools/engine";

export type CameraMode = "chase" | "free";

export class CameraFollow {
    private context: Context;
    private target: THREE.Object3D;
    private mode: CameraMode = "chase";

    // Keep the default drive view low and close to the car, like a third-person game camera.
    private chaseOffset = new THREE.Vector3(0, 8, 22);
    private lookOffset = new THREE.Vector3(0, 3.5, -2);
    private smoothFactor = 6.5;
    private currentPosition = new THREE.Vector3();
    private chaseFOV = 52;
    private freeFOV = 58;

    private isDragging = false;
    private orbitTheta = 0;
    private orbitPhi = Math.PI / 6;
    private orbitRadius = 220;
    private lastMouse = { x: 0, y: 0 };
    private readonly nearClip = 1;
    private readonly farClip = 5000000;

    constructor(context: Context, target: THREE.Object3D) {
        this.context = context;
        this.target = target;

        const cam = context.mainCamera as THREE.PerspectiveCamera;
        cam.fov = this.chaseFOV;
        cam.near = this.nearClip;
        cam.far = this.farClip;
        cam.updateProjectionMatrix();

        this.currentPosition.copy(target.position).add(this.chaseOffset);

        this.setupFreeControls();
        this.updateModeUI();
    }

    private setupFreeControls() {
        const canvas = this.context.renderer.domElement as HTMLCanvasElement & {
            __flowlayerCameraHandlers?: {
                mousedown: (e: MouseEvent) => void;
                mousemove: (e: MouseEvent) => void;
                mouseup: () => void;
                wheel: (e: WheelEvent) => void;
            };
        };

        const existing = canvas.__flowlayerCameraHandlers;
        if (existing) {
            canvas.removeEventListener("mousedown", existing.mousedown);
            canvas.removeEventListener("mousemove", existing.mousemove);
            canvas.removeEventListener("mouseup", existing.mouseup);
            canvas.removeEventListener("wheel", existing.wheel);
        }

        const mousedown = (e: MouseEvent) => {
            if (this.mode !== "free") return;
            this.isDragging = true;
            this.lastMouse = { x: e.clientX, y: e.clientY };
        };

        const mousemove = (e: MouseEvent) => {
            if (!this.isDragging || this.mode !== "free") return;
            const dx = e.clientX - this.lastMouse.x;
            const dy = e.clientY - this.lastMouse.y;
            this.orbitTheta -= dx * 0.005;
            this.orbitPhi = Math.max(0.15, Math.min(Math.PI / 2.4, this.orbitPhi + dy * 0.005));
            this.lastMouse = { x: e.clientX, y: e.clientY };
        };

        const mouseup = () => { this.isDragging = false; };

        const wheel = (e: WheelEvent) => {
            e.preventDefault();

            if (this.mode === "free") {
                this.orbitRadius = Math.max(18, Math.min(180, this.orbitRadius + e.deltaY * 0.05));
                return;
            }

            this.chaseOffset.z = Math.max(12, Math.min(40, this.chaseOffset.z + e.deltaY * 0.02));
            this.chaseOffset.y = Math.max(4, Math.min(14, this.chaseOffset.y + e.deltaY * 0.01));
        };

        canvas.addEventListener("mousedown", mousedown);
        canvas.addEventListener("mousemove", mousemove);
        canvas.addEventListener("mouseup", mouseup);
        canvas.addEventListener("wheel", wheel, { passive: false });
        canvas.__flowlayerCameraHandlers = { mousedown, mousemove, mouseup, wheel };
    }

    update(context: Context) {
        const cam = context.mainCamera as THREE.PerspectiveCamera;
        this.ensureClipPlanes(cam);

        if (this.mode === "chase") {
            this.updateChase(cam, context.time.deltaTime);
        } else {
            this.updateFree(cam);
        }
    }

    private updateChase(cam: THREE.PerspectiveCamera, dt: number) {
        const heading = this.target.rotation.y;
        const behind = new THREE.Vector3(
            Math.sin(heading) * this.chaseOffset.z,
            this.chaseOffset.y,
            Math.cos(heading) * this.chaseOffset.z
        );

        const desiredPos = this.target.position.clone().add(behind);
        this.currentPosition.lerp(desiredPos, this.smoothFactor * dt);
        cam.position.copy(this.currentPosition);

        const lookTarget = this.target.position.clone().add(this.lookOffset);
        cam.lookAt(lookTarget);

        cam.fov = this.chaseFOV;
        cam.updateProjectionMatrix();
    }

    private updateFree(cam: THREE.PerspectiveCamera) {
        this.orbitPhi = Math.max(0.15, Math.min(Math.PI / 2.4, this.orbitPhi));

        const focusTarget = this.target.position.clone().add(this.lookOffset);
        const x = focusTarget.x + this.orbitRadius * Math.sin(this.orbitPhi) * Math.sin(this.orbitTheta);
        const y = focusTarget.y + this.orbitRadius * Math.cos(this.orbitPhi);
        const z = focusTarget.z + this.orbitRadius * Math.sin(this.orbitPhi) * Math.cos(this.orbitTheta);

        cam.position.set(x, y, z);
        cam.lookAt(focusTarget);

        cam.fov = this.freeFOV;
        cam.updateProjectionMatrix();
    }

    setMode(mode: CameraMode) {
        this.mode = mode;
        if (mode === "free") {
            const cam = this.context.mainCamera;
            const focusTarget = this.target.position.clone().add(this.lookOffset);
            const dir = new THREE.Vector3().subVectors(cam.position, focusTarget);
            this.orbitRadius = Math.max(18, Math.min(180, dir.length()));
            this.orbitTheta = Math.atan2(dir.x, dir.z);
            this.orbitPhi = Math.acos(Math.max(-1, Math.min(1, dir.y / this.orbitRadius)));
            this.orbitPhi = Math.max(0.15, Math.min(Math.PI / 2.4, this.orbitPhi));
        }
        this.updateModeUI();
    }

    toggleMode() {
        this.setMode(this.mode === "chase" ? "free" : "chase");
    }

    getMode(): CameraMode { return this.mode; }

    private ensureClipPlanes(cam: THREE.PerspectiveCamera) {
        if (cam.near === this.nearClip && cam.far === this.farClip) return;
        cam.near = this.nearClip;
        cam.far = this.farClip;
        cam.updateProjectionMatrix();
    }

    private updateModeUI() {
        const iconEl = document.getElementById("cameraModeIcon");
        const labelEl = document.getElementById("cameraModeLabel");
        if (iconEl) iconEl.textContent = this.mode === "chase" ? "\uD83C\uDFA5" : "\uD83C\uDF10";
        if (labelEl) labelEl.textContent = this.mode === "chase" ? "Chase" : "Free";
    }
}
