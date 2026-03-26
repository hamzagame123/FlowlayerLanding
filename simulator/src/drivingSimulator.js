/**
 * FlowLayer — Three.js driving scene + optional Cesium ion OSM Buildings.
 * Chase camera by default; "Look" mode = orbit with right-drag + wheel zoom.
 * Vibes drive fog, sky, lights, and building accents (SIMULATOR_V2_PLAN emotional layer).
 */
import * as THREE from "three";
import { createCesiumOSMLayer } from "./cesiumBuildings.js";

export class DrivingSimulator {
    constructor(options = {}) {
        this.container = document.getElementById("simulatorCanvas");
        this.cesiumToken = options.cesiumToken ?? null;
        this._cesium = null;
        this.isRunning = false;
        this.isDriving = false;
        this.speed = 0;
        this.targetSpeed = 0;
        this.distance = 0;
        this.driveStartTime = null;

        this.environment = "coastal";
        this.currentVibe = "scenic";
        this.cameraMode = "chase";

        this.steerTarget = 0;
        this.carLateral = 0;
        this.carYaw = 0;

        this.chaseDistance = 12;
        this.chaseHeight = 4.2;
        this.chaseMin = 7;
        this.chaseMax = 22;

        this.orbit = { theta: 0.35, phi: 0.55, radius: 16 };
        this.orbitMinR = 8;
        this.orbitMaxR = 42;

        this.keys = { w: false, s: false, a: false, d: false, ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
        this.orbitDrag = { active: false, id: -1, lastX: 0, lastY: 0 };

        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.carGroup = null;
        this.sky = null;
        this.ambientLight = null;
        this.sunLight = null;
        this.rimLight = null;
        this.horizonLight = null;
        this.headspots = [];
        this.roadSegments = [];
        this.sideObjects = [];
        this.groundPlanes = [];
        this.mountains = [];
        this.vibeParticles = null;

        this.environments = {
            coastal: { ground: 0x0a1628, road: 0x151520, roadside: 0x0d2840, treeTrunk: 0x1a1a28, treeCanopy: 0x0a2a24 },
            mountain: { ground: 0x122018, road: 0x16161c, roadside: 0x1a3020, treeTrunk: 0x2a2520, treeCanopy: 0x1a3d2e },
            forest: { ground: 0x081410, road: 0x12141a, roadside: 0x0a2016, treeTrunk: 0x1f241f, treeCanopy: 0x0d3018 },
        };

        /** @type {Record<string, { fogColor: number; fogNear: number; fogFar: number; skyTop: number; skyMid: number; skyHorizon: number; ambient: number; ambientI: number; sun: number; sunI: number; rim: number; rimI: number; horizon: number; horizonI: number; accent: number; exposure: number; particle: string }>} */
        this.vibes = {
            scenic: {
                fogColor: 0x1a1030,
                fogNear: 55,
                fogFar: 320,
                skyTop: 0x0a0818,
                skyMid: 0x3d2050,
                skyHorizon: 0xff7a45,
                ambient: 0x8866aa,
                ambientI: 0.42,
                sun: 0xffcc88,
                sunI: 0.95,
                rim: 0x06d6a0,
                rimI: 0.55,
                horizon: 0xff6b35,
                horizonI: 1.1,
                accent: 0x06d6a0,
                exposure: 1.08,
                particle: "gold",
            },
            chill: {
                fogColor: 0x0c1828,
                fogNear: 35,
                fogFar: 260,
                skyTop: 0x040a14,
                skyMid: 0x1a3050,
                skyHorizon: 0x4a6a8a,
                ambient: 0x446688,
                ambientI: 0.5,
                sun: 0xaaccff,
                sunI: 0.45,
                rim: 0x00f5d4,
                rimI: 0.4,
                horizon: 0x5a7a9a,
                horizonI: 0.65,
                accent: 0x00f5d4,
                exposure: 0.92,
                particle: "mist",
            },
            adventure: {
                fogColor: 0x120818,
                fogNear: 28,
                fogFar: 220,
                skyTop: 0x080410,
                skyMid: 0x401030,
                skyHorizon: 0xf72555,
                ambient: 0x663355,
                ambientI: 0.35,
                sun: 0xffeeff,
                sunI: 1.15,
                rim: 0xf72585,
                rimI: 0.85,
                horizon: 0xff3088,
                horizonI: 0.9,
                accent: 0xf72585,
                exposure: 1.12,
                particle: "sparks",
            },
            fastest: {
                fogColor: 0x08080c,
                fogNear: 80,
                fogFar: 400,
                skyTop: 0x040608,
                skyMid: 0x101820,
                skyHorizon: 0x2a3540,
                ambient: 0x445566,
                ambientI: 0.38,
                sun: 0xffffff,
                sunI: 0.75,
                rim: 0x00f5d4,
                rimI: 0.35,
                horizon: 0xff9f1c,
                horizonI: 0.5,
                accent: 0xff9f1c,
                exposure: 1.0,
                particle: "none",
            },
        };

        this.init();
    }

    init() {
        this.scene = new THREE.Scene();

        const camFar = this.cesiumToken ? 5e6 : 2000;
        this.camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, camFar);

        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x050508);
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.05;
        this.container.appendChild(this.renderer.domElement);

        if (this.cesiumToken) {
            this._cesium = createCesiumOSMLayer(this.scene, this.camera, this.renderer, this.cesiumToken);
        }

        const canvas = this.renderer.domElement;
        canvas.style.cursor = "grab";
        canvas.style.touchAction = "none";

        this.createSky();
        this.createFogAndLights();
        this.createRoad();
        this.createCar();
        this.createWorldDecor();
        this.createVibeParticles();

        if (this._cesium) {
            this.mountains.forEach((m) => {
                m.visible = false;
            });
        }

        this.applyVibe(this.currentVibe, true);
        this.applyEnvironment(this.environment, true);

        window.addEventListener("resize", () => this.onResize());
        window.addEventListener("keydown", (e) => this.onKey(e, true));
        window.addEventListener("keyup", (e) => this.onKey(e, false));

        canvas.addEventListener("contextmenu", (e) => e.preventDefault());
        canvas.addEventListener("pointerdown", (e) => this.onPointerDown(e));
        canvas.addEventListener("pointermove", (e) => this.onPointerMove(e));
        canvas.addEventListener("pointerup", (e) => this.onPointerUp(e));
        canvas.addEventListener("pointercancel", (e) => this.onPointerUp(e));
        canvas.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });

        this.isRunning = true;
        this.animate();
    }

    createSky() {
        const geo = new THREE.SphereGeometry(800, 48, 32);
        const mat = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x0a0818) },
                midColor: { value: new THREE.Color(0x2a1840) },
                horizonColor: { value: new THREE.Color(0xff6b35) },
                exponent: { value: 0.65 },
                hOffset: { value: 18 },
            },
            vertexShader: `
                varying vec3 vPos;
                void main() {
                    vPos = position;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 midColor;
                uniform vec3 horizonColor;
                uniform float exponent;
                uniform float hOffset;
                varying vec3 vPos;
                void main() {
                    vec3 dir = normalize(vPos + vec3(0.0, hOffset, 0.0));
                    float h = dir.y;
                    vec3 col;
                    if (h < 0.0) col = horizonColor * 0.35;
                    else if (h < 0.12) col = mix(horizonColor, midColor, h / 0.12);
                    else col = mix(midColor, topColor, pow(max(h - 0.12, 0.0) / 0.88, exponent));
                    gl_FragColor = vec4(col, 1.0);
                }
            `,
            side: THREE.BackSide,
            depthWrite: false,
        });
        this.sky = new THREE.Mesh(geo, mat);
        this.scene.add(this.sky);

        const starGeo = new THREE.BufferGeometry();
        const n = 1400;
        const pos = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) {
            const t = Math.random() * Math.PI * 2;
            const p = Math.random() * Math.PI * 0.42;
            const r = 600 + Math.random() * 150;
            pos[i * 3] = r * Math.sin(p) * Math.cos(t);
            pos[i * 3 + 1] = r * Math.cos(p) + 40;
            pos[i * 3 + 2] = r * Math.sin(p) * Math.sin(t);
        }
        starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        this.stars = new THREE.Points(
            starGeo,
            new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.75, depthWrite: false })
        );
        this.scene.add(this.stars);
    }

    createFogAndLights() {
        this.scene.fog = new THREE.Fog(0x1a1030, 50, 300);
        this.ambientLight = new THREE.AmbientLight(0x6688aa, 0.4);
        this.scene.add(this.ambientLight);

        this.sunLight = new THREE.DirectionalLight(0xffcc88, 0.9);
        this.sunLight.position.set(-40, 80, 120);
        this.scene.add(this.sunLight);

        this.rimLight = new THREE.DirectionalLight(0x06d6a0, 0.45);
        this.rimLight.position.set(60, 40, -80);
        this.scene.add(this.rimLight);

        this.horizonLight = new THREE.PointLight(0xff6b35, 0.8, 500, 2);
        this.horizonLight.position.set(0, 20, -220);
        this.scene.add(this.horizonLight);
    }

    createRoad() {
        const roadWidth = 12;
        const segmentLength = 100;
        const numSegments = 6;

        for (let i = 0; i < numSegments; i++) {
            const seg = this.createRoadSegment(roadWidth, segmentLength);
            seg.position.z = -i * segmentLength;
            this.roadSegments.push(seg);
            this.scene.add(seg);
        }

        const g = new THREE.PlaneGeometry(260, 600);
        const mat = new THREE.MeshStandardMaterial({ color: 0x0a1628, roughness: 0.95, metalness: 0.05, side: THREE.DoubleSide });
        const left = new THREE.Mesh(g, mat.clone());
        left.rotation.x = -Math.PI / 2;
        left.position.set(-118, -0.08, -220);
        const right = new THREE.Mesh(g, mat.clone());
        right.rotation.x = -Math.PI / 2;
        right.position.set(118, -0.08, -220);
        this.scene.add(left, right);
        this.groundPlanes.push(left, right);
    }

    createRoadSegment(width, length) {
        const group = new THREE.Group();
        const roadMat = new THREE.MeshStandardMaterial({
            color: 0x151520,
            roughness: 0.88,
            metalness: 0.12,
            emissive: new THREE.Color(0x001a18),
            emissiveIntensity: 0.25,
        });
        roadMat.userData.isRoad = true;

        const road = new THREE.Mesh(new THREE.PlaneGeometry(width, length), roadMat);
        road.rotation.x = -Math.PI / 2;
        road.receiveShadow = true;
        group.add(road);

        const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35 });
        const edgeGlow = new THREE.MeshBasicMaterial({
            color: 0x00f5d4,
            transparent: true,
            opacity: 0.22,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
        });
        edgeGlow.userData.isEdge = true;

        const lg = new THREE.PlaneGeometry(0.12, length);
        const left = new THREE.Mesh(lg, lineMat.clone());
        left.rotation.x = -Math.PI / 2;
        left.position.set(-width / 2 + 0.45, 0.02, 0);
        group.add(left);
        const right = new THREE.Mesh(lg, lineMat.clone());
        right.rotation.x = -Math.PI / 2;
        right.position.set(width / 2 - 0.45, 0.02, 0);
        group.add(right);

        const dashLen = 4;
        const gap = 5;
        const dashes = Math.floor(length / (dashLen + gap));
        const dashMat = new THREE.MeshStandardMaterial({
            color: 0x00f5d4,
            emissive: new THREE.Color(0x00f5d4),
            emissiveIntensity: 0.6,
            roughness: 0.4,
            metalness: 0.2,
            transparent: true,
            opacity: 0.85,
        });
        dashMat.userData.isDash = true;
        for (let i = 0; i < dashes; i++) {
            const d = new THREE.Mesh(new THREE.PlaneGeometry(0.14, dashLen), dashMat.clone());
            d.rotation.x = -Math.PI / 2;
            d.position.set(0, 0.03, -length / 2 + i * (dashLen + gap) + dashLen / 2);
            group.add(d);
        }

        const eg = new THREE.PlaneGeometry(0.35, length);
        const el = new THREE.Mesh(eg, edgeGlow.clone());
        el.rotation.x = -Math.PI / 2;
        el.position.set(-width / 2, 0.04, 0);
        group.add(el);
        const er = new THREE.Mesh(eg, edgeGlow.clone());
        er.rotation.x = -Math.PI / 2;
        er.position.set(width / 2, 0.04, 0);
        group.add(er);

        return group;
    }

    createCar() {
        const g = new THREE.Group();
        g.position.set(0, 0, 2);

        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x12141c,
            roughness: 0.35,
            metalness: 0.65,
            envMapIntensity: 1,
        });
        const glassMat = new THREE.MeshStandardMaterial({
            color: 0x111820,
            roughness: 0.08,
            metalness: 0.9,
            transparent: true,
            opacity: 0.88,
        });
        const accentMat = new THREE.MeshStandardMaterial({
            color: 0x00f5d4,
            emissive: new THREE.Color(0x00f5d4),
            emissiveIntensity: 0.4,
            roughness: 0.5,
            metalness: 0.4,
        });

        const body = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.2), bodyMat);
        body.position.set(0, 0.85, 0);
        g.add(body);

        const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.55, 2.2), glassMat);
        cabin.position.set(0, 1.35, -0.35);
        g.add(cabin);

        const tail = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.45, 1.2), bodyMat);
        tail.position.set(0, 0.75, 1.35);
        g.add(tail);

        for (const x of [-0.85, 0.85]) {
            const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.08), accentMat);
            t.position.set(x, 0.42, -1.55);
            g.add(t);
        }

        g.rotation.order = "YXZ";
        this.carGroup = g;
        this.scene.add(g);

        [-0.75, 0.75].forEach((x) => {
            const s = new THREE.SpotLight(0xfff5e6, 2.4, 120, Math.PI / 4.5, 0.5, 1);
            s.position.set(x, 1.05, -1.85);
            const tgt = new THREE.Object3D();
            tgt.position.set(x * 0.2, 0, -42);
            g.add(tgt);
            s.target = tgt;
            g.add(s);
            this.headspots.push(s);
        });
    }

    createWorldDecor() {
        for (let i = 0; i < 22; i++) {
            const z = -i * 22 - 15;
            this.createRoadPost(-7.5, z);
            this.createRoadPost(7.5, z);
        }
        for (let i = 0; i < 36; i++) {
            const z = -Math.random() * 420 - 40;
            const side = Math.random() > 0.5 ? 1 : -1;
            const x = side * (14 + Math.random() * 38);
            this.createTree(x, z);
        }
        const mGeo = new THREE.ConeGeometry(70, 55, 5);
        const mMat = new THREE.MeshStandardMaterial({ color: 0x06080c, roughness: 0.95, metalness: 0.05, transparent: true, opacity: 0.9 });
        for (let i = 0; i < 7; i++) {
            const m = new THREE.Mesh(mGeo, mMat.clone());
            m.position.set(-180 + i * 58 + (Math.random() - 0.5) * 30, 22, -480);
            m.scale.setScalar(0.45 + Math.random() * 0.55);
            this.scene.add(m);
            this.mountains.push(m);
        }
    }

    createRoadPost(x, z) {
        const group = new THREE.Group();
        const post = new THREE.Mesh(
            new THREE.CylinderGeometry(0.08, 0.1, 3.2),
            new THREE.MeshStandardMaterial({ color: 0x2a2a38, roughness: 0.8, metalness: 0.2 })
        );
        post.position.y = 1.6;
        group.add(post);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18), new THREE.MeshBasicMaterial({ color: 0x00f5d4, transparent: true, opacity: 0.9 }));
        bulb.position.y = 3.25;
        group.add(bulb);
        group.position.set(x, 0, z);
        group.userData.isSide = true;
        this.scene.add(group);
        this.sideObjects.push(group);
    }

    createTree(x, z) {
        const group = new THREE.Group();
        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.25, 0.38, 2.8),
            new THREE.MeshStandardMaterial({ color: 0x1a1a28, roughness: 0.9, metalness: 0.05 })
        );
        trunk.position.y = 1.4;
        group.add(trunk);
        const canopy = new THREE.Mesh(
            new THREE.ConeGeometry(1.8 + Math.random() * 1.5, 5 + Math.random() * 3, 7),
            new THREE.MeshStandardMaterial({ color: 0x0a1a14, roughness: 0.9, metalness: 0.02, transparent: true, opacity: 0.92 })
        );
        canopy.position.y = 4.2 + Math.random();
        group.add(canopy);
        group.position.set(x, 0, z);
        group.userData.isSide = true;
        this.scene.add(group);
        this.sideObjects.push(group);
    }

    createVibeParticles() {
        const geo = new THREE.BufferGeometry();
        const count = 320;
        const pos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 80;
            pos[i * 3 + 1] = Math.random() * 12;
            pos[i * 3 + 2] = -Math.random() * 100 - 10;
        }
        geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
        this.vibeParticles = new THREE.Points(
            geo,
            new THREE.PointsMaterial({ color: 0xffcc66, size: 0.15, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending })
        );
        this.scene.add(this.vibeParticles);
    }

    applyVibe(vibe, instant) {
        const v = this.vibes[vibe] || this.vibes.scenic;
        this.currentVibe = vibe in this.vibes ? vibe : "scenic";

        const fogC = new THREE.Color(v.fogColor);
        this.scene.fog.color.copy(fogC);
        this.scene.fog.near = v.fogNear;
        this.scene.fog.far = this._cesium ? Math.max(v.fogFar, 1300) : v.fogFar;

        if (this.sky?.material?.uniforms) {
            this.sky.material.uniforms.topColor.value.setHex(v.skyTop);
            this.sky.material.uniforms.midColor.value.setHex(v.skyMid);
            this.sky.material.uniforms.horizonColor.value.setHex(v.skyHorizon);
        }

        this.ambientLight.color.setHex(v.ambient);
        this.ambientLight.intensity = v.ambientI;
        this.sunLight.color.setHex(v.sun);
        this.sunLight.intensity = v.sunI;
        this.rimLight.color.setHex(v.rim);
        this.rimLight.intensity = v.rimI;
        this.horizonLight.color.setHex(v.horizon);
        this.horizonLight.intensity = v.horizonI;

        this.renderer.toneMappingExposure = v.exposure;

        const accent = new THREE.Color(v.accent);
        this.updateRoadAccent(accent);
        this._cesium?.setVibeAccent(accent);

        if (this.vibeParticles?.material) {
            const mode = v.particle;
            if (mode === "gold") {
                this.vibeParticles.material.color.setHex(0xffdd88);
                this.vibeParticles.material.opacity = 0.35;
            } else if (mode === "mist") {
                this.vibeParticles.material.color.setHex(0xaaccff);
                this.vibeParticles.material.opacity = 0.22;
            } else if (mode === "sparks") {
                this.vibeParticles.material.color.setHex(0xff66aa);
                this.vibeParticles.material.opacity = 0.28;
            } else {
                this.vibeParticles.material.opacity = 0;
            }
        }

        if (instant) {
            this.updateCamera(1);
        }
    }

    updateRoadAccent(accent) {
        const apply = (obj) => {
            obj.traverse((ch) => {
                if (!ch.isMesh || !ch.material) return;
                const m = ch.material;
                if (m.userData.isDash) {
                    m.emissive.copy(accent);
                    m.color.copy(accent);
                }
                if (m.userData.isEdge) {
                    m.color.copy(accent);
                }
            });
        };
        this.roadSegments.forEach(apply);
    }

    applyEnvironment(type, instant) {
        this.environment = this.environments[type] ? type : "coastal";
        const e = this.environments[this.environment];

        this.groundPlanes.forEach((mesh) => {
            mesh.material.color.setHex(e.ground);
        });

        this.sideObjects.forEach((obj) => {
            obj.traverse((ch) => {
                if (!ch.isMesh || !ch.material) return;
                if (ch.geometry?.type === "CylinderGeometry") {
                    ch.material.color.setHex(e.treeTrunk);
                }
                if (ch.geometry?.type === "ConeGeometry") {
                    ch.material.color.setHex(e.treeCanopy);
                }
            });
        });

        this.roadSegments.forEach((seg) => {
            seg.traverse((ch) => {
                if (!ch.isMesh || !ch.material || !ch.material.userData.isRoad) return;
                ch.material.color.setHex(e.road);
            });
        });

        if (instant) this.applyVibe(this.currentVibe, true);
    }

    setVibe(vibe) {
        this.applyVibe(vibe, false);
    }

    setEnvironment(type) {
        this.applyEnvironment(type, false);
    }

    setCameraMode(mode) {
        this.cameraMode = mode === "look" ? "look" : "chase";
        const label = document.getElementById("cameraModeLabel");
        const icon = document.getElementById("cameraModeIcon");
        if (label) label.textContent = this.cameraMode === "chase" ? "Chase" : "Look";
        if (icon) icon.textContent = this.cameraMode === "chase" ? "\uD83C\uDFA5" : "\uD83C\uDF10";
        this.renderer.domElement.style.cursor = this.cameraMode === "look" ? "crosshair" : "grab";
    }

    toggleCameraMode() {
        this.setCameraMode(this.cameraMode === "chase" ? "look" : "chase");
    }

    onKey(e, down) {
        const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
        if (k in this.keys) this.keys[k] = down;
        if (e.key === "w" || e.key === "W") this.keys.w = down;
        if (e.key === "s" || e.key === "S") this.keys.s = down;
        if (e.key === "a" || e.key === "A") this.keys.a = down;
        if (e.key === "d" || e.key === "D") this.keys.d = down;
    }

    onPointerDown(e) {
        if (this.cameraMode !== "look" || e.button !== 2) return;
        e.preventDefault();
        this.orbitDrag.active = true;
        this.orbitDrag.id = e.pointerId;
        this.orbitDrag.lastX = e.clientX;
        this.orbitDrag.lastY = e.clientY;
        try {
            this.renderer.domElement.setPointerCapture(e.pointerId);
        } catch (_) {}
    }

    onPointerMove(e) {
        if (!this.orbitDrag.active || e.pointerId !== this.orbitDrag.id) return;
        const dx = e.clientX - this.orbitDrag.lastX;
        const dy = e.clientY - this.orbitDrag.lastY;
        this.orbitDrag.lastX = e.clientX;
        this.orbitDrag.lastY = e.clientY;
        this.orbit.theta -= dx * 0.0045;
        this.orbit.phi = Math.max(0.12, Math.min(1.35, this.orbit.phi - dy * 0.004));
    }

    onPointerUp(e) {
        if (!this.orbitDrag.active || e.pointerId !== this.orbitDrag.id) return;
        this.orbitDrag.active = false;
        this.orbitDrag.id = -1;
        try {
            this.renderer.domElement.releasePointerCapture(e.pointerId);
        } catch (_) {}
    }

    onWheel(e) {
        if (!this.container.contains(this.renderer.domElement)) return;
        e.preventDefault();
        const dy = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY), 80);
        if (this.cameraMode === "chase") {
            this.chaseDistance = THREE.MathUtils.clamp(this.chaseDistance + dy * 0.04, this.chaseMin, this.chaseMax);
            this.chaseHeight = THREE.MathUtils.clamp(3.2 + (this.chaseDistance - 12) * 0.22, 2.8, 7);
        } else {
            this.orbit.radius = THREE.MathUtils.clamp(this.orbit.radius + dy * 0.05, this.orbitMinR, this.orbitMaxR);
        }
    }

    startDrive() {
        this.isDriving = true;
        this.targetSpeed = 48;
        this.driveStartTime = Date.now();
        this.distance = 0;
    }

    endDrive() {
        this.isDriving = false;
        this.targetSpeed = 0;
    }

    setSpeed(speed) {
        this.targetSpeed = Math.max(0, Math.min(120, speed));
    }

    accelerate() {
        this.targetSpeed = Math.min(120, this.targetSpeed + 12);
    }

    decelerate() {
        this.targetSpeed = Math.max(0, this.targetSpeed - 12);
    }

    updateInput(dt) {
        if (this.keys.w || this.keys.ArrowUp) this.targetSpeed = Math.min(120, this.targetSpeed + dt * 28);
        if (this.keys.s || this.keys.ArrowDown) this.targetSpeed = Math.max(0, this.targetSpeed - dt * 32);
        let steer = 0;
        if (this.keys.a || this.keys.ArrowLeft) steer -= 1;
        if (this.keys.d || this.keys.ArrowRight) steer += 1;
        this.steerTarget = THREE.MathUtils.lerp(this.steerTarget, steer, 0.12);
        this.carLateral = THREE.MathUtils.clamp(this.carLateral + this.steerTarget * dt * 14, -3.2, 3.2);
        this.carYaw = THREE.MathUtils.lerp(this.carYaw, this.steerTarget * 0.18, dt * 3);
        if (Math.abs(this.steerTarget) < 0.05) {
            this.carLateral = THREE.MathUtils.lerp(this.carLateral, 0, dt * 0.8);
            this.carYaw = THREE.MathUtils.lerp(this.carYaw, 0, dt * 1.2);
        }
    }

    updateCamera(dt) {
        const car = this.carGroup;
        if (!car) return;

        const focus = car.position.clone().add(new THREE.Vector3(0, 1.1, 0));

        if (this.cameraMode === "chase") {
            const bob = this.isDriving ? Math.sin(performance.now() * 0.002) * 0.06 : 0;
            const off = new THREE.Vector3(this.carLateral * 0.2, this.chaseHeight + bob, this.chaseDistance);
            off.applyAxisAngle(new THREE.Vector3(0, 1, 0), this.carYaw);
            const desired = focus.clone().add(off);
            const look = focus.clone().add(new THREE.Vector3(0, 0.35, -32).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.carYaw));
            this.camera.position.lerp(desired, 1 - Math.exp(-10 * dt));
            this.camera.lookAt(look);
        } else {
            const p = this.orbit.phi;
            const t = this.orbit.theta;
            const r = this.orbit.radius;
            const ox = r * Math.sin(p) * Math.sin(t);
            const oy = r * Math.cos(p) + 1.2;
            const oz = r * Math.sin(p) * Math.cos(t);
            this.camera.position.set(focus.x + ox, focus.y + oy, focus.z + oz);
            this.camera.lookAt(focus.x, focus.y + 0.6, focus.z - 4);
        }

        const spd = this.speed / 100;
        this.camera.fov = THREE.MathUtils.lerp(58, 68, spd);
        this.camera.updateProjectionMatrix();
    }

    updateStats() {
        const speedDisplay = document.getElementById("speedDisplay");
        const statSpeed = document.getElementById("statSpeed");
        if (speedDisplay) speedDisplay.textContent = Math.round(this.speed);
        if (statSpeed) statSpeed.textContent = Math.round(this.speed);
        const statDistance = document.getElementById("statDistance");
        if (statDistance) statDistance.textContent = this.distance.toFixed(1);
        if (this.driveStartTime) {
            const elapsed = Math.floor((Date.now() - this.driveStartTime) / 1000);
            const mins = Math.floor(elapsed / 60);
            const secs = elapsed % 60;
            const statTime = document.getElementById("statTime");
            if (statTime) statTime.textContent = `${mins}:${secs.toString().padStart(2, "0")}`;
        }
    }

    animate() {
        requestAnimationFrame(() => this.animate());
        const dt = Math.min(0.05, this._lastT ? (performance.now() - this._lastT) / 1000 : 0.016);
        this._lastT = performance.now();

        this.updateInput(dt);
        this.speed += (this.targetSpeed - this.speed) * Math.min(1, dt * 2.2);
        if (this.isDriving) this.distance += (this.speed / 3600) * dt;

        this.carGroup.position.x = THREE.MathUtils.lerp(this.carGroup.position.x, this.carLateral, 1 - Math.exp(-8 * dt));
        this.carGroup.rotation.y = THREE.MathUtils.lerp(this.carGroup.rotation.y, this.carYaw, 1 - Math.exp(-6 * dt));

        const moveSpeed = this.speed * 0.018 * dt * 60;
        this.roadSegments.forEach((segment) => {
            segment.position.z += moveSpeed;
            if (segment.position.z > 60) segment.position.z -= 600;
        });
        this.sideObjects.forEach((obj) => {
            obj.position.z += moveSpeed;
            if (obj.position.z > 40) obj.position.z -= 480;
        });
        this.mountains.forEach((m) => {
            m.position.z += moveSpeed * 0.35;
            if (m.position.z > 80) m.position.z -= 520;
        });

        if (this.stars) this.stars.rotation.y += 0.00006;
        if (this.vibeParticles && this.vibeParticles.material.opacity > 0.01) {
            this.vibeParticles.position.z += moveSpeed * 0.85;
            if (this.vibeParticles.position.z > 20) this.vibeParticles.position.z -= 120;
        }

        this.updateCamera(dt);
        this.updateStats();
        this.camera.updateMatrixWorld();
        this._cesium?.update();
        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
    }

    getDriveData() {
        return {
            distance: this.distance,
            duration: this.driveStartTime ? Date.now() - this.driveStartTime : 0,
            avgSpeed: this.driveStartTime ? this.distance / ((Date.now() - this.driveStartTime) / 3600000) : 0,
            environment: this.environment,
        };
    }
}

