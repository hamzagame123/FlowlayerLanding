import * as THREE from "three";
import type { Context } from "@needle-tools/engine";

export interface VibePreset {
    name: string;
    lighting: { color: string; intensity: number; ambient: string; ambientIntensity: number };
    fog: { color: string; density: number };
    bloom: { intensity: number; threshold: number; scatter: number };
    sky: { topColor: string; bottomColor: string };
    particles: { type: string; count: number; color: string };
    audioMood: string;
}

const VIBE_PRESETS: Record<string, VibePreset> = {
    scenic: {
        name: "Scenic",
        lighting: { color: "#ffffff", intensity: 1.35, ambient: "#dceeff", ambientIntensity: 0.8 },
        fog: { color: "#d6e6f7", density: 0 },
        bloom: { intensity: 0.35, threshold: 1.2, scatter: 0.9 },
        sky: { topColor: "#8ab8e8", bottomColor: "#dfefff" },
        particles: { type: "fireflies", count: 200, color: "#ffdd44" },
        audioMood: "warm_ambient",
    },
    chill: {
        name: "Chill",
        lighting: { color: "#8888cc", intensity: 0.6, ambient: "#6666aa", ambientIntensity: 0.4 },
        fog: { color: "#1a1a2e", density: 0.0015 },
        bloom: { intensity: 0.2, threshold: 2.0, scatter: 0.85 },
        sky: { topColor: "#0a0a1e", bottomColor: "#3d5a80" },
        particles: { type: "mist", count: 100, color: "#aaaadd" },
        audioMood: "lo_fi_ambient",
    },
    adventure: {
        name: "Adventure",
        lighting: { color: "#ffffff", intensity: 1.0, ambient: "#ccaa88", ambientIntensity: 0.6 },
        fog: { color: "#1a1210", density: 0.0005 },
        bloom: { intensity: 0.3, threshold: 1.5, scatter: 0.8 },
        sky: { topColor: "#1a0a14", bottomColor: "#f72585" },
        particles: { type: "dust", count: 300, color: "#cc9966" },
        audioMood: "energetic_wind",
    },
    fastest: {
        name: "Fastest",
        lighting: { color: "#ffffff", intensity: 1.2, ambient: "#dddddd", ambientIntensity: 0.7 },
        fog: { color: "#0a0a14", density: 0.0002 },
        bloom: { intensity: 0.1, threshold: 3.0, scatter: 0.7 },
        sky: { topColor: "#0a0a14", bottomColor: "#1a1a2e" },
        particles: { type: "none", count: 0, color: "#ffffff" },
        audioMood: "minimal",
    },
};

export class VibeManager {
    private context: Context;
    private currentVibe: string = "scenic";
    private dirLight: THREE.DirectionalLight;
    private ambientLight: THREE.AmbientLight;
    private hemiLight: THREE.HemisphereLight;
    private fog: THREE.FogExp2;
    private skyMesh: THREE.Mesh | null = null;
    private particleSystem: THREE.Points | null = null;
    private customPreset: VibePreset | null = null;

    private targetPreset: VibePreset | null = null;
    private lerpProgress = 1;

    constructor(context: Context) {
        this.context = context;

        this.dirLight = new THREE.DirectionalLight(0xff9f6b, 0.9);
        this.dirLight.position.set(50, 80, -30);
        this.dirLight.castShadow = true;
        context.scene.add(this.dirLight);

        this.ambientLight = new THREE.AmbientLight(0xffd4a0, 0.5);
        context.scene.add(this.ambientLight);

        this.hemiLight = new THREE.HemisphereLight(0xcfe6ff, 0xffd8b0, 0.75);
        context.scene.add(this.hemiLight);

        this.fog = new THREE.FogExp2(0x2a1a0e, 0.0008);
        context.scene.fog = this.fog;

        this.createSkyDome();
    }

    setVibe(vibeId: string) {
        const preset = vibeId === "custom" && this.customPreset
            ? this.customPreset
            : VIBE_PRESETS[vibeId];
        if (!preset) return;

        this.currentVibe = vibeId;
        this.targetPreset = preset;
        this.lerpProgress = 0;

        document.querySelectorAll(".vibe-btn").forEach(btn => {
            btn.classList.toggle("active", btn.getAttribute("data-vibe") === vibeId);
        });
    }

    setCustomPreset(preset: VibePreset) {
        this.customPreset = preset;
    }

    update(dt: number) {
        this.updateSkyFollow();
        if (!this.targetPreset || this.lerpProgress >= 1) return;

        this.lerpProgress = Math.min(1, this.lerpProgress + dt * 0.5);
        const t = this.easeInOut(this.lerpProgress);

        const target = this.targetPreset;

        const targetColor = new THREE.Color(target.lighting.color);
        this.dirLight.color.lerp(targetColor, t);
        this.dirLight.intensity = THREE.MathUtils.lerp(this.dirLight.intensity, target.lighting.intensity, t);

        const targetAmbient = new THREE.Color(target.lighting.ambient);
        this.ambientLight.color.lerp(targetAmbient, t);
        this.ambientLight.intensity = THREE.MathUtils.lerp(this.ambientLight.intensity, target.lighting.ambientIntensity, t);

        const hemiSky = new THREE.Color(target.sky.topColor);
        const hemiGround = new THREE.Color(target.sky.bottomColor);
        this.hemiLight.color.lerp(hemiSky, t);
        this.hemiLight.groundColor.lerp(hemiGround, t);
        this.hemiLight.intensity = THREE.MathUtils.lerp(this.hemiLight.intensity, Math.max(0.9, target.lighting.ambientIntensity), t);

        const targetFogColor = new THREE.Color(target.fog.color);
        this.fog.color.lerp(targetFogColor, t);
        this.fog.density = THREE.MathUtils.lerp(this.fog.density, target.fog.density, t);

        this.updateSkyColors(target, t);
    }

    private createSkyDome() {
        const geo = new THREE.SphereGeometry(1, 32, 32);
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x0a0a14) },
                bottomColor: { value: new THREE.Color(0xff6b35) },
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 wp = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = wp.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize(vWorldPosition).y;
                    float t = clamp(h * 0.5 + 0.5, 0.0, 1.0);
                    gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
                }
            `,
            side: THREE.BackSide,
            depthWrite: false,
        });
        this.skyMesh = new THREE.Mesh(geo, mat);
        this.skyMesh.scale.setScalar(5000000);
        this.skyMesh.renderOrder = -1;
        this.context.scene.add(this.skyMesh);
    }

    private updateSkyColors(preset: VibePreset, t: number) {
        if (!this.skyMesh) return;
        const mat = this.skyMesh.material as THREE.ShaderMaterial;
        const targetTop = new THREE.Color(preset.sky.topColor);
        const targetBottom = new THREE.Color(preset.sky.bottomColor);
        (mat.uniforms.topColor.value as THREE.Color).lerp(targetTop, t);
        (mat.uniforms.bottomColor.value as THREE.Color).lerp(targetBottom, t);
    }

    private updateSkyFollow() {
        if (!this.skyMesh) return;
        this.skyMesh.position.copy(this.context.mainCamera.position);
    }

    private easeInOut(t: number): number {
        return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    getCurrentVibe(): string { return this.currentVibe; }
    getPreset(vibeId: string): VibePreset | undefined { return VIBE_PRESETS[vibeId]; }
    getVibeNames(): string[] { return Object.keys(VIBE_PRESETS); }
}
