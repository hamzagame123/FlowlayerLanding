import * as THREE from "three";
import type { Context } from "@needle-tools/engine";

/** Pixels-equivalent vertical wheel delta; caps spikes from trackpads / line mode. */
function normalizeWheelDeltaY(e: WheelEvent): number {
    let y = e.deltaY;
    if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
        y *= 16;
    } else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        y *= 120;
    }
    const sign = Math.sign(y);
    const mag = Math.min(Math.abs(y), 100);
    return sign * mag;
}

export type CameraMode = "chase" | "free";

export interface CameraFollowState {
    mode: CameraMode;
    chaseOffset: [number, number, number];
    lookOffset: [number, number, number];
    orbitTheta: number;
    orbitPhi: number;
    orbitRadius: number;
}

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
    private orbitPhi = Math.PI / 4.2;
    private orbitRadius = 85;
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
                pointerdown: (e: PointerEvent) => void;
                pointermove: (e: PointerEvent) => void;
                pointerup: (e: PointerEvent) => void;
                lostpointercapture: () => void;
                wheel: (e: WheelEvent) => void;
                contextmenu: (e: Event) => void;
            };
        };

        const existing = canvas.__flowlayerCameraHandlers;
        if (existing) {
            canvas.removeEventListener("pointerdown", existing.pointerdown);
            canvas.removeEventListener("pointermove", existing.pointermove);
            canvas.removeEventListener("pointerup", existing.pointerup);
            canvas.removeEventListener("lostpointercapture", existing.lostpointercapture);
            canvas.removeEventListener("wheel", existing.wheel);
            canvas.removeEventListener("contextmenu", existing.contextmenu);
        }

        const activePointerId = { id: -1 };

        const pointerdown = (e: PointerEvent) => {
            if (this.mode !== "free" || e.button !== 0) return;
            e.preventDefault();
            this.isDragging = true;
            activePointerId.id = e.pointerId;
            this.lastMouse = { x: e.clientX, y: e.clientY };
            try {
                canvas.setPointerCapture(e.pointerId);
            } catch {
                /* ignore */
            }
        };

        const pointermove = (e: PointerEvent) => {
            if (!this.isDragging || this.mode !== "free") return;
            if (activePointerId.id !== -1 && e.pointerId !== activePointerId.id) return;
            const dx = e.clientX - this.lastMouse.x;
            const dy = e.clientY - this.lastMouse.y;
            this.lastMouse = { x: e.clientX, y: e.clientY };
            if (dx === 0 && dy === 0) return;
            this.orbitTheta -= dx * 0.0011;
            this.orbitPhi = Math.max(0.28, Math.min(Math.PI / 2.3, this.orbitPhi + dy * 0.001));
        };

        const endPointerDrag = (e: PointerEvent) => {
            if (activePointerId.id !== -1 && e.pointerId !== activePointerId.id) return;
            try {
                if (canvas.hasPointerCapture(e.pointerId)) {
                    canvas.releasePointerCapture(e.pointerId);
                }
            } catch {
                /* ignore */
            }
            activePointerId.id = -1;
            this.isDragging = false;
        };

        const pointerup = (e: PointerEvent) => {
            endPointerDrag(e);
        };

        const lostpointercapture = () => {
            activePointerId.id = -1;
            this.isDragging = false;
        };

        const wheel = (e: WheelEvent) => {
            if (this.mode !== "free") {
                return;
            }
            e.preventDefault();
            const dy = normalizeWheelDeltaY(e);
            const step = dy * 0.022;
            this.orbitRadius = Math.max(36, Math.min(140, this.orbitRadius + step));
        };

        const contextmenu = (e: Event) => {
            if (this.mode === "free") e.preventDefault();
        };

        canvas.addEventListener("pointerdown", pointerdown);
        canvas.addEventListener("pointermove", pointermove);
        canvas.addEventListener("pointerup", pointerup);
        canvas.addEventListener("pointercancel", pointerup);
        canvas.addEventListener("lostpointercapture", lostpointercapture);
        canvas.addEventListener("wheel", wheel, { passive: false });
        canvas.addEventListener("contextmenu", contextmenu);
        canvas.__flowlayerCameraHandlers = {
            pointerdown,
            pointermove,
            pointerup,
            lostpointercapture,
            wheel,
            contextmenu,
        };
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
        this.orbitPhi = Math.max(0.28, Math.min(Math.PI / 2.3, this.orbitPhi));

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
            this.orbitRadius = Math.max(36, Math.min(140, dir.length()));
            this.orbitTheta = Math.atan2(dir.x, dir.z);
            this.orbitPhi = Math.acos(Math.max(-1, Math.min(1, dir.y / this.orbitRadius)));
            this.orbitPhi = Math.max(0.28, Math.min(Math.PI / 2.3, this.orbitPhi));
        }
        this.updateModeUI();
    }

    toggleMode() {
        this.setMode(this.mode === "chase" ? "free" : "chase");
    }

    getMode(): CameraMode { return this.mode; }

    getState(): CameraFollowState {
        return {
            mode: this.mode,
            chaseOffset: [this.chaseOffset.x, this.chaseOffset.y, this.chaseOffset.z],
            lookOffset: [this.lookOffset.x, this.lookOffset.y, this.lookOffset.z],
            orbitTheta: this.orbitTheta,
            orbitPhi: this.orbitPhi,
            orbitRadius: this.orbitRadius,
        };
    }

    applyState(state: Partial<CameraFollowState>) {
        if (state.chaseOffset) {
            this.chaseOffset.set(state.chaseOffset[0], state.chaseOffset[1], state.chaseOffset[2]);
        }
        if (state.lookOffset) {
            this.lookOffset.set(state.lookOffset[0], state.lookOffset[1], state.lookOffset[2]);
        }
        if (typeof state.orbitTheta === "number") this.orbitTheta = state.orbitTheta;
        if (typeof state.orbitPhi === "number") this.orbitPhi = state.orbitPhi;
        if (typeof state.orbitRadius === "number") this.orbitRadius = state.orbitRadius;
        if (state.mode) this.mode = state.mode;

        this.orbitRadius = Math.max(36, Math.min(140, this.orbitRadius));
        this.orbitPhi = Math.max(0.28, Math.min(Math.PI / 2.3, this.orbitPhi));
        this.updateModeUI();
    }

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
