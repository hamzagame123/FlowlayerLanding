import type { CarController } from "./CarController.js";
import type { WaypointRoute } from "./WaypointRoute.js";
import type { VibeManager } from "./VibeManager.js";
import type { CameraFollow } from "./CameraFollow.js";

export class HUDBridge {
    private car: CarController;
    private route: WaypointRoute;
    private vibes: VibeManager;
    private camera: CameraFollow;

    constructor(car: CarController, route: WaypointRoute, vibes: VibeManager, camera: CameraFollow) {
        this.car = car;
        this.route = route;
        this.vibes = vibes;
        this.camera = camera;
    }

    init() {
        document.getElementById("startDriveBtn")?.addEventListener("click", () => {
            this.car.startDrive();
            this.toggleDriveButtons(true);
        });

        document.getElementById("endDriveBtn")?.addEventListener("click", () => {
            this.car.endDrive();
            this.toggleDriveButtons(false);
            this.showFeedbackModal();
        });

        document.querySelectorAll(".vibe-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const vibe = btn.getAttribute("data-vibe");
                if (vibe) this.vibes.setVibe(vibe);
            });
        });

        document.querySelectorAll(".route-card").forEach(card => {
            card.addEventListener("click", () => {
                const routeId = card.getAttribute("data-route");
                if (routeId) {
                    this.route.loadRoute(routeId);
                    document.querySelectorAll(".route-card").forEach(c => c.classList.remove("active"));
                    card.classList.add("active");
                }
            });
        });

        document.getElementById("cameraModeBtn")?.addEventListener("click", () => {
            this.camera.toggleMode();
        });

        document.getElementById("collapseAssistant")?.addEventListener("click", () => {
            const panel = document.getElementById("assistantPanel");
            panel?.classList.toggle("collapsed");
        });

        document.getElementById("playlistBtn")?.addEventListener("click", () => {
            document.getElementById("playlistModal")?.classList.add("active");
        });

        document.getElementById("closePlaylist")?.addEventListener("click", () => {
            document.getElementById("playlistModal")?.classList.remove("active");
        });

        document.getElementById("skipFeedback")?.addEventListener("click", () => {
            document.getElementById("feedbackModal")?.classList.remove("active");
        });

        document.getElementById("submitFeedback")?.addEventListener("click", () => {
            document.getElementById("feedbackModal")?.classList.remove("active");
        });

        document.querySelectorAll(".rating-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const parent = btn.parentElement;
                parent?.querySelectorAll(".rating-btn").forEach(b => b.classList.remove("selected"));
                btn.classList.add("selected");
            });
        });

        document.querySelectorAll(".choice-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                const parent = btn.parentElement;
                parent?.querySelectorAll(".choice-btn").forEach(b => b.classList.remove("selected"));
                btn.classList.add("selected");
            });
        });

        document.querySelectorAll(".duration-btn").forEach(btn => {
            btn.addEventListener("click", () => {
                document.querySelectorAll(".duration-btn").forEach(b => b.classList.remove("selected"));
                btn.classList.add("selected");
            });
        });

        document.addEventListener("gamepad:vibe-next", () => {
            const vibes = this.vibes.getVibeNames();
            const idx = vibes.indexOf(this.vibes.getCurrentVibe());
            this.vibes.setVibe(vibes[(idx + 1) % vibes.length]);
        });

        document.addEventListener("gamepad:vibe-prev", () => {
            const vibes = this.vibes.getVibeNames();
            const idx = vibes.indexOf(this.vibes.getCurrentVibe());
            this.vibes.setVibe(vibes[(idx - 1 + vibes.length) % vibes.length]);
        });
    }

    update() {
        const speed = Math.round(this.car.getSpeed());
        this.setText("speedDisplay", String(speed));
        this.setText("statSpeed", String(speed));
        this.setText("statDistance", this.car.getDistance().toFixed(1));
        this.setText("statTime", this.car.getDriveTime());
    }

    private setText(id: string, value: string) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    private toggleDriveButtons(driving: boolean) {
        const startBtn = document.getElementById("startDriveBtn");
        const endBtn = document.getElementById("endDriveBtn");
        if (startBtn) startBtn.classList.toggle("hidden", driving);
        if (endBtn) endBtn.classList.toggle("hidden", !driving);
    }

    private showFeedbackModal() {
        document.getElementById("feedbackModal")?.classList.add("active");
    }
}
