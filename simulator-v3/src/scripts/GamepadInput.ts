import type { CarController } from "./CarController.js";

export class GamepadInput {
    private car: CarController;
    private connected = false;
    private gamepadIndex = -1;

    private readonly G29_STEERING_AXIS = 0;
    private readonly G29_THROTTLE_AXIS = 1;
    private readonly G29_BRAKE_AXIS = 2;

    private readonly DEADZONE = 0.05;

    constructor(car: CarController) {
        this.car = car;

        window.addEventListener("gamepadconnected", (e) => {
            this.gamepadIndex = e.gamepad.index;
            this.connected = true;
            this.car.hasGamepadSteering = true;
            this.car.hasGamepadThrottle = true;
            this.updateStatusUI(true, e.gamepad.id);
            console.log(`[GamepadInput] Connected: ${e.gamepad.id}`);
        });

        window.addEventListener("gamepaddisconnected", () => {
            this.connected = false;
            this.gamepadIndex = -1;
            this.car.hasGamepadSteering = false;
            this.car.hasGamepadThrottle = false;
            this.updateStatusUI(false);
            console.log("[GamepadInput] Disconnected");
        });
    }

    update() {
        if (!this.connected) return;

        const gamepads = navigator.getGamepads();
        const gp = gamepads[this.gamepadIndex];
        if (!gp) return;

        const rawSteering = gp.axes[this.G29_STEERING_AXIS] ?? 0;
        this.car.steering = this.applyDeadzone(rawSteering);

        const rawThrottle = gp.axes[this.G29_THROTTLE_AXIS] ?? 0;
        this.car.throttle = this.normalizeAxis(rawThrottle);

        const rawBrake = gp.axes[this.G29_BRAKE_AXIS] ?? 0;
        this.car.brake = this.normalizeAxis(rawBrake);

        this.handleButtons(gp);
    }

    private handleButtons(gp: Gamepad) {
        if (gp.buttons[4]?.pressed) {
            document.dispatchEvent(new CustomEvent("gamepad:vibe-prev"));
        }
        if (gp.buttons[5]?.pressed) {
            document.dispatchEvent(new CustomEvent("gamepad:vibe-next"));
        }

        if (gp.buttons[14]?.pressed) {
            document.dispatchEvent(new CustomEvent("gamepad:dpad-left"));
        }
        if (gp.buttons[15]?.pressed) {
            document.dispatchEvent(new CustomEvent("gamepad:dpad-right"));
        }
    }

    private applyDeadzone(value: number): number {
        if (Math.abs(value) < this.DEADZONE) return 0;
        const sign = Math.sign(value);
        return sign * ((Math.abs(value) - this.DEADZONE) / (1 - this.DEADZONE));
    }

    private normalizeAxis(value: number): number {
        const normalized = (1 - value) / 2;
        return Math.max(0, Math.min(1, normalized));
    }

    private updateStatusUI(connected: boolean, name?: string) {
        const statusEl = document.getElementById("gamepadStatus");
        const textEl = document.getElementById("gamepadText");
        if (!statusEl || !textEl) return;

        if (connected) {
            statusEl.classList.add("connected");
            const isG29 = name?.toLowerCase().includes("g29") || name?.toLowerCase().includes("logitech");
            textEl.textContent = isG29 ? "G29 Connected" : "Controller Connected";
        } else {
            statusEl.classList.remove("connected");
            textEl.textContent = "No controller";
        }
    }

    isConnected(): boolean {
        return this.connected;
    }
}
