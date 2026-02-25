// FlowLayer - Three.js Driving Simulator
// ========================================

class DrivingSimulator {
    constructor() {
        this.container = document.getElementById('simulatorCanvas');
        this.isRunning = false;
        this.isDriving = false;
        this.speed = 0;
        this.targetSpeed = 0;
        this.distance = 0;
        this.driveStartTime = null;
        this.roadOffset = 0;
        
        // Current route/environment settings
        this.environment = 'coastal'; // coastal, mountain, forest
        this.timeOfDay = 'sunset'; // day, sunset, night
        this.weather = 'clear'; // clear, foggy, rainy
        
        // Scene objects
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.car = null;
        this.road = null;
        this.trees = [];
        this.clouds = [];
        this.roadSegments = [];
        
        // Environment colors based on route type
        this.environments = {
            coastal: {
                sky: 0x1a0a2e,
                horizon: 0xff6b35,
                ground: 0x0a1628,
                road: 0x1a1a24,
                accent: 0x00f5d4
            },
            mountain: {
                sky: 0x0d1b2a,
                horizon: 0x3d5a80,
                ground: 0x1b4332,
                road: 0x1a1a24,
                accent: 0x52b788
            },
            forest: {
                sky: 0x0a0f0d,
                horizon: 0x2d6a4f,
                ground: 0x1b4332,
                road: 0x1a1a24,
                accent: 0x40916c
            }
        };
        
        this.init();
    }
    
    init() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x0a0a14, 50, 300);
        
        // Camera - Driver's perspective
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 4, 10);
        this.camera.lookAt(0, 2, -50);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x08080c);
        this.container.appendChild(this.renderer.domElement);
        
        // Create environment
        this.createSky();
        this.createRoad();
        this.createCar();
        this.createEnvironmentObjects();
        this.createLighting();
        
        // Handle resize
        window.addEventListener('resize', () => this.onResize());
        
        // Start render loop
        this.animate();
    }
    
    createSky() {
        // Gradient sky using a large sphere
        const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
        const skyMaterial = new THREE.ShaderMaterial({
            uniforms: {
                topColor: { value: new THREE.Color(0x0a0a14) },
                bottomColor: { value: new THREE.Color(0x1a0a2e) },
                horizonColor: { value: new THREE.Color(0xff6b35) },
                offset: { value: 20 },
                exponent: { value: 0.6 }
            },
            vertexShader: `
                varying vec3 vWorldPosition;
                void main() {
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPosition = worldPosition.xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform vec3 topColor;
                uniform vec3 bottomColor;
                uniform vec3 horizonColor;
                uniform float offset;
                uniform float exponent;
                varying vec3 vWorldPosition;
                void main() {
                    float h = normalize(vWorldPosition + offset).y;
                    float t = max(pow(max(h, 0.0), exponent), 0.0);
                    vec3 color;
                    if (h < 0.0) {
                        color = bottomColor;
                    } else if (h < 0.15) {
                        color = mix(horizonColor, bottomColor, h / 0.15);
                    } else {
                        color = mix(horizonColor, topColor, (h - 0.15) / 0.85);
                    }
                    gl_FragColor = vec4(color, 1.0);
                }
            `,
            side: THREE.BackSide
        });
        
        this.sky = new THREE.Mesh(skyGeometry, skyMaterial);
        this.scene.add(this.sky);
        
        // Stars
        const starsGeometry = new THREE.BufferGeometry();
        const starsCount = 1000;
        const positions = new Float32Array(starsCount * 3);
        
        for (let i = 0; i < starsCount; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI * 0.5; // Upper hemisphere only
            const radius = 400;
            
            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.cos(phi) + 50;
            positions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
        }
        
        starsGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const starsMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 1,
            transparent: true,
            opacity: 0.8
        });
        
        this.stars = new THREE.Points(starsGeometry, starsMaterial);
        this.scene.add(this.stars);
    }
    
    createRoad() {
        // Infinite road effect using segments
        const roadWidth = 12;
        const segmentLength = 100;
        const numSegments = 5;
        
        for (let i = 0; i < numSegments; i++) {
            const segment = this.createRoadSegment(roadWidth, segmentLength);
            segment.position.z = -i * segmentLength;
            this.roadSegments.push(segment);
            this.scene.add(segment);
        }
        
        // Ground planes on sides
        const groundGeometry = new THREE.PlaneGeometry(200, 500);
        const groundMaterial = new THREE.MeshLambertMaterial({
            color: 0x0a1628,
            side: THREE.DoubleSide
        });
        
        // Left ground
        const leftGround = new THREE.Mesh(groundGeometry, groundMaterial);
        leftGround.rotation.x = -Math.PI / 2;
        leftGround.position.set(-106, -0.1, -200);
        this.scene.add(leftGround);
        
        // Right ground
        const rightGround = new THREE.Mesh(groundGeometry, groundMaterial);
        rightGround.rotation.x = -Math.PI / 2;
        rightGround.position.set(106, -0.1, -200);
        this.scene.add(rightGround);
    }
    
    createRoadSegment(width, length) {
        const group = new THREE.Group();
        
        // Main road surface
        const roadGeometry = new THREE.PlaneGeometry(width, length);
        const roadMaterial = new THREE.MeshLambertMaterial({
            color: 0x1a1a24,
            side: THREE.DoubleSide
        });
        
        const road = new THREE.Mesh(roadGeometry, roadMaterial);
        road.rotation.x = -Math.PI / 2;
        road.position.y = 0;
        group.add(road);
        
        // Road lines
        const lineGeometry = new THREE.PlaneGeometry(0.15, length);
        const lineMaterial = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.4
        });
        
        // Side lines
        const leftLine = new THREE.Mesh(lineGeometry, lineMaterial);
        leftLine.rotation.x = -Math.PI / 2;
        leftLine.position.set(-width / 2 + 0.5, 0.01, 0);
        group.add(leftLine);
        
        const rightLine = new THREE.Mesh(lineGeometry, lineMaterial);
        rightLine.rotation.x = -Math.PI / 2;
        rightLine.position.set(width / 2 - 0.5, 0.01, 0);
        group.add(rightLine);
        
        // Center dashed line
        const dashLength = 4;
        const dashGap = 6;
        const numDashes = Math.floor(length / (dashLength + dashGap));
        
        for (let i = 0; i < numDashes; i++) {
            const dashGeometry = new THREE.PlaneGeometry(0.15, dashLength);
            const dashMaterial = new THREE.MeshBasicMaterial({
                color: 0x00f5d4,
                transparent: true,
                opacity: 0.6
            });
            
            const dash = new THREE.Mesh(dashGeometry, dashMaterial);
            dash.rotation.x = -Math.PI / 2;
            dash.position.set(0, 0.01, -length / 2 + i * (dashLength + dashGap) + dashLength / 2);
            group.add(dash);
        }
        
        // Road edge glow
        const edgeGeometry = new THREE.PlaneGeometry(0.3, length);
        const edgeMaterial = new THREE.MeshBasicMaterial({
            color: 0x00f5d4,
            transparent: true,
            opacity: 0.15
        });
        
        const leftEdge = new THREE.Mesh(edgeGeometry, edgeMaterial);
        leftEdge.rotation.x = -Math.PI / 2;
        leftEdge.position.set(-width / 2, 0.02, 0);
        group.add(leftEdge);
        
        const rightEdge = new THREE.Mesh(edgeGeometry, edgeMaterial);
        rightEdge.rotation.x = -Math.PI / 2;
        rightEdge.position.set(width / 2, 0.02, 0);
        group.add(rightEdge);
        
        return group;
    }
    
    createCar() {
        // Simplified car representation (hood view visible at bottom)
        const carGroup = new THREE.Group();
        
        // Hood
        const hoodGeometry = new THREE.BoxGeometry(3, 0.3, 2);
        const hoodMaterial = new THREE.MeshPhongMaterial({
            color: 0x1a1a24,
            specular: 0x444444,
            shininess: 100
        });
        const hood = new THREE.Mesh(hoodGeometry, hoodMaterial);
        hood.position.set(0, 0, 1);
        carGroup.add(hood);
        
        // Dashboard lights (subtle cyan glow)
        const dashGeometry = new THREE.PlaneGeometry(2, 0.1);
        const dashMaterial = new THREE.MeshBasicMaterial({
            color: 0x00f5d4,
            transparent: true,
            opacity: 0.3
        });
        const dashLight = new THREE.Mesh(dashGeometry, dashMaterial);
        dashLight.position.set(0, 0.2, 0.5);
        dashLight.rotation.x = -Math.PI / 6;
        carGroup.add(dashLight);
        
        carGroup.position.set(0, 2.5, 6);
        this.car = carGroup;
        this.scene.add(this.car);
    }
    
    createEnvironmentObjects() {
        // Road side posts with lights
        for (let i = 0; i < 20; i++) {
            const z = -i * 25 - 20;
            
            // Left post
            this.createRoadPost(-8, z);
            // Right post
            this.createRoadPost(8, z);
        }
        
        // Trees/rocks on sides
        for (let i = 0; i < 30; i++) {
            const z = -Math.random() * 400 - 50;
            const side = Math.random() > 0.5 ? 1 : -1;
            const x = side * (15 + Math.random() * 30);
            
            this.createTree(x, z);
        }
        
        // Distant mountains/hills
        this.createDistantMountains();
    }
    
    createRoadPost(x, z) {
        const group = new THREE.Group();
        
        // Post
        const postGeometry = new THREE.CylinderGeometry(0.1, 0.1, 4);
        const postMaterial = new THREE.MeshLambertMaterial({ color: 0x333344 });
        const post = new THREE.Mesh(postGeometry, postMaterial);
        post.position.y = 2;
        group.add(post);
        
        // Light
        const lightGeometry = new THREE.SphereGeometry(0.2);
        const lightMaterial = new THREE.MeshBasicMaterial({
            color: 0x00f5d4,
            transparent: true,
            opacity: 0.8
        });
        const light = new THREE.Mesh(lightGeometry, lightMaterial);
        light.position.y = 4;
        group.add(light);
        
        // Light glow
        const glowGeometry = new THREE.SphereGeometry(0.5);
        const glowMaterial = new THREE.MeshBasicMaterial({
            color: 0x00f5d4,
            transparent: true,
            opacity: 0.2
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.y = 4;
        group.add(glow);
        
        group.position.set(x, 0, z);
        this.scene.add(group);
        this.trees.push(group); // Reuse for movement
    }
    
    createTree(x, z) {
        const group = new THREE.Group();
        
        // Simplified tree silhouette
        const trunkGeometry = new THREE.CylinderGeometry(0.3, 0.4, 3);
        const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x1a1a28 });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = 1.5;
        group.add(trunk);
        
        // Canopy - cone shape
        const canopyGeometry = new THREE.ConeGeometry(2 + Math.random() * 2, 6 + Math.random() * 4, 6);
        const canopyMaterial = new THREE.MeshLambertMaterial({
            color: 0x0a1a14,
            transparent: true,
            opacity: 0.9
        });
        const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
        canopy.position.y = 5 + Math.random() * 2;
        group.add(canopy);
        
        group.position.set(x, 0, z);
        this.scene.add(group);
        this.trees.push(group);
    }
    
    createDistantMountains() {
        // Create silhouette mountains on the horizon
        const mountainGeometry = new THREE.ConeGeometry(80, 60, 4);
        const mountainMaterial = new THREE.MeshBasicMaterial({
            color: 0x0a0a14,
            transparent: true,
            opacity: 0.8
        });
        
        for (let i = 0; i < 5; i++) {
            const mountain = new THREE.Mesh(mountainGeometry, mountainMaterial.clone());
            mountain.position.set(
                -150 + i * 80 + (Math.random() - 0.5) * 40,
                15,
                -450
            );
            mountain.scale.set(
                0.5 + Math.random() * 0.5,
                0.5 + Math.random() * 0.8,
                1
            );
            this.scene.add(mountain);
        }
    }
    
    createLighting() {
        // Ambient light
        const ambientLight = new THREE.AmbientLight(0x404060, 0.5);
        this.scene.add(ambientLight);
        
        // Directional light (moonlight)
        const moonLight = new THREE.DirectionalLight(0x8888ff, 0.3);
        moonLight.position.set(50, 100, -100);
        this.scene.add(moonLight);
        
        // Horizon glow
        const horizonLight = new THREE.PointLight(0xff6b35, 0.5, 300);
        horizonLight.position.set(0, 10, -250);
        this.scene.add(horizonLight);
        
        // Car headlights
        const headlightLeft = new THREE.SpotLight(0xffffee, 1, 100, Math.PI / 6, 0.5);
        headlightLeft.position.set(-1, 3, 4);
        headlightLeft.target.position.set(-1, 0, -50);
        this.scene.add(headlightLeft);
        this.scene.add(headlightLeft.target);
        
        const headlightRight = new THREE.SpotLight(0xffffee, 1, 100, Math.PI / 6, 0.5);
        headlightRight.position.set(1, 3, 4);
        headlightRight.target.position.set(1, 0, -50);
        this.scene.add(headlightRight);
        this.scene.add(headlightRight.target);
    }
    
    setEnvironment(type) {
        this.environment = type;
        const env = this.environments[type] || this.environments.coastal;
        
        // Update sky colors
        if (this.sky && this.sky.material.uniforms) {
            this.sky.material.uniforms.bottomColor.value.setHex(env.sky);
            this.sky.material.uniforms.horizonColor.value.setHex(env.horizon);
        }
        
        // Update fog
        this.scene.fog.color.setHex(env.sky);
    }
    
    startDrive() {
        this.isDriving = true;
        this.targetSpeed = 45;
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
        this.targetSpeed = Math.min(120, this.targetSpeed + 10);
    }
    
    decelerate() {
        this.targetSpeed = Math.max(0, this.targetSpeed - 10);
    }
    
    updateStats() {
        // Update speed display
        const speedDisplay = document.getElementById('speedDisplay');
        const statSpeed = document.getElementById('statSpeed');
        if (speedDisplay) speedDisplay.textContent = Math.round(this.speed);
        if (statSpeed) statSpeed.textContent = Math.round(this.speed);
        
        // Update distance
        const statDistance = document.getElementById('statDistance');
        if (statDistance) statDistance.textContent = this.distance.toFixed(1);
        
        // Update time
        if (this.driveStartTime) {
            const elapsed = Math.floor((Date.now() - this.driveStartTime) / 1000);
            const mins = Math.floor(elapsed / 60);
            const secs = elapsed % 60;
            const statTime = document.getElementById('statTime');
            if (statTime) {
                statTime.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
            }
        }
    }
    
    animate() {
        requestAnimationFrame(() => this.animate());
        
        // Smooth speed transition
        this.speed += (this.targetSpeed - this.speed) * 0.02;
        
        // Update distance (mph to miles per frame at 60fps)
        if (this.isDriving) {
            this.distance += (this.speed / 3600) / 60;
        }
        
        // Move road segments
        const moveSpeed = this.speed * 0.015;
        
        this.roadSegments.forEach((segment, index) => {
            segment.position.z += moveSpeed;
            
            // Loop segment back
            if (segment.position.z > 50) {
                segment.position.z -= 500;
            }
        });
        
        // Move environment objects
        this.trees.forEach(tree => {
            tree.position.z += moveSpeed;
            
            // Loop back
            if (tree.position.z > 30) {
                tree.position.z -= 450;
            }
        });
        
        // Subtle camera movement for immersion
        if (this.isDriving) {
            const time = Date.now() * 0.001;
            this.camera.position.x = Math.sin(time * 0.5) * 0.1;
            this.camera.position.y = 4 + Math.sin(time * 0.7) * 0.05;
            this.camera.rotation.z = Math.sin(time * 0.3) * 0.005;
        }
        
        // Rotate stars slowly
        if (this.stars) {
            this.stars.rotation.y += 0.0001;
        }
        
        // Update stats
        this.updateStats();
        
        // Render
        this.renderer.render(this.scene, this.camera);
    }
    
    onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }
    
    getDriveData() {
        return {
            distance: this.distance,
            duration: this.driveStartTime ? Date.now() - this.driveStartTime : 0,
            avgSpeed: this.driveStartTime ? 
                (this.distance / ((Date.now() - this.driveStartTime) / 3600000)) : 0,
            environment: this.environment
        };
    }
}

// Export for global access
window.DrivingSimulator = DrivingSimulator;
