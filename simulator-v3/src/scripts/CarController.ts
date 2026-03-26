import * as THREE from "three";
import type { Context } from "@needle-tools/engine";

export class CarController {
    private context: Context;
    private carObject: THREE.Object3D;
    private velocity = new THREE.Vector3();
    private heading = 0;
    private _speed = 0;
    private _distance = 0;
    private driveStartTime: number | null = null;
    private isDriving = false;

    steering = 0;
    throttle = 0;
    brake = 0;

    private maxSpeed = 120;
    private acceleration = 18;
    private brakeForce = 35;
    private friction = 5;
    private turnSpeed = 2.2;

    private keysDown = new Set<string>();

    constructor(context: Context, carObject: THREE.Object3D) {
        this.context = context;
        this.carObject = carObject;

        window.addEventListener("keydown", (e) => this.keysDown.add(e.key.toLowerCase()));
        window.addEventListener("keyup", (e) => this.keysDown.delete(e.key.toLowerCase()));
        window.addEventListener("blur", () => this.keysDown.clear());
    }

    private isKeyHeld(key: string): boolean {
        return this.keysDown.has(key.toLowerCase());
    }

    update(context: Context) {
        if (!this.isDriving) return;

        const dt = context.time.deltaTime;
        this.handleKeyboardInput();

        const effectiveThrottle = this.throttle - this.brake;
        if (effectiveThrottle > 0) {
            this._speed += this.acceleration * effectiveThrottle * dt;
        } else if (effectiveThrottle < 0) {
            this._speed += this.brakeForce * effectiveThrottle * dt;
        } else {
            this._speed -= this.friction * dt;
        }

        this._speed = Math.max(0, Math.min(this.maxSpeed, this._speed));

        if (this._speed > 0.5) {
            const turnFactor = Math.min(1, this._speed / 30);
            this.heading += this.steering * this.turnSpeed * turnFactor * dt;
        }

        const moveSpeed = this._speed * 0.44704;
        this.velocity.set(
            Math.sin(this.heading) * moveSpeed * dt,
            0,
            -Math.cos(this.heading) * moveSpeed * dt
        );

        this.carObject.position.add(this.velocity);
        this.carObject.rotation.y = this.heading;

        this._distance += moveSpeed * dt / 1609.34;
    }

    private handleKeyboardInput() {
        if (this.isKeyHeld("w") || this.isKeyHeld("arrowup")) {
            this.throttle = Math.min(1, this.throttle + 0.05);
        } else if (this.throttle > 0 && !this.hasGamepadThrottle) {
            this.throttle = Math.max(0, this.throttle - 0.03);
        }

        if (this.isKeyHeld("s") || this.isKeyHeld("arrowdown")) {
            this.brake = Math.min(1, this.brake + 0.05);
        } else if (this.brake > 0 && !this.hasGamepadThrottle) {
            this.brake = Math.max(0, this.brake - 0.03);
        }

        if (this.isKeyHeld("a") || this.isKeyHeld("arrowleft")) {
            this.steering = Math.max(-1, this.steering - 0.06);
        } else if (this.isKeyHeld("d") || this.isKeyHeld("arrowright")) {
            this.steering = Math.min(1, this.steering + 0.06);
        } else if (!this.hasGamepadSteering) {
            this.steering *= 0.85;
        }
    }

    hasGamepadSteering = false;
    hasGamepadThrottle = false;

    startDrive() {
        this.isDriving = true;
        this.driveStartTime = Date.now();
        this._distance = 0;
        this._speed = 0;
    }

    endDrive() {
        this.isDriving = false;
        this.throttle = 0;
        this.brake = 0;
        this.steering = 0;
    }

    getSpeed(): number { return this._speed; }
    getDistance(): number { return this._distance; }
    getHeading(): number { return this.heading; }
    getPosition(): THREE.Vector3 { return this.carObject.position.clone(); }
    getObject(): THREE.Object3D { return this.carObject; }
    getIsDriving(): boolean { return this.isDriving; }
    setPosition(position: THREE.Vector3) { this.carObject.position.copy(position); }
    setHeading(heading: number) {
        this.heading = heading;
        this.carObject.rotation.y = heading;
    }

    getDriveTime(): string {
        if (!this.driveStartTime) return "0:00";
        const elapsed = Math.floor((Date.now() - this.driveStartTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    }

    getDriveData() {
        return {
            distance: this._distance,
            duration: this.driveStartTime ? Date.now() - this.driveStartTime : 0,
            avgSpeed: this.driveStartTime
                ? (this._distance / ((Date.now() - this.driveStartTime) / 3600000))
                : 0,
            speed: this._speed,
        };
    }
}
