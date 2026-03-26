type ShaderScreen = "storyIntro" | "onboarding" | "simulator";

const VERTEX_SHADER = `#version 300 es
in vec2 a_position;
out vec2 v_uv;

void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_intensity;

float laneGlow(vec2 p, float offset, float width, float amp, float speed, float bend) {
    float y = p.y;
    float curve = offset;
    curve += sin(y * 6.0 + u_time * speed) * amp;
    curve += sin(y * 12.0 - u_time * (speed * 0.65)) * amp * 0.45;
    curve += bend * pow(1.0 - y, 1.7);

    float d = abs(p.x - curve);
    float core = smoothstep(width, width * 0.18, d);
    float halo = exp(-d * (8.0 / max(width, 0.001)));
    return core + halo * 0.9;
}

void main() {
    vec2 uv = v_uv;
    vec2 p = uv * 2.0 - 1.0;
    p.x *= u_resolution.x / max(u_resolution.y, 1.0);

    float t = u_time * 0.55;
    float sweep = sin(t * 0.35) * 0.12;
    p.x += sweep;

    vec3 col = vec3(0.0);

    float whiteA = laneGlow(p, -0.78, 0.028, 0.06, 1.35, -1.25);
    float whiteB = laneGlow(p, -0.56, 0.022, 0.05, 1.55, -1.05);
    float redA = laneGlow(p, -0.18, 0.032, 0.08, 1.1, -0.8);
    float redB = laneGlow(p, 0.12, 0.04, 0.09, 0.92, -0.72);

    col += vec3(1.0, 0.96, 0.92) * whiteA * 1.45;
    col += vec3(1.0, 0.94, 0.9) * whiteB * 1.1;
    col += vec3(1.0, 0.25, 0.3) * redA * 1.2;
    col += vec3(1.0, 0.18, 0.28) * redB * 1.5;

    float bloom = (whiteA + whiteB) * 0.18 + (redA + redB) * 0.3;
    col += vec3(0.55, 0.08, 0.12) * exp(-abs(p.x - 0.08) * 1.6) * 0.22;
    col += vec3(0.85, 0.12, 0.16) * bloom * 0.35;

    float horizonGlow = pow(max(0.0, 1.0 - length(vec2(p.x * 0.55, p.y - 0.86)) * 0.95), 5.2);
    col += mix(vec3(1.0, 0.65, 0.58), vec3(1.0, 0.94, 0.9), 0.55) * horizonGlow * 1.5;

    float vignette = smoothstep(1.55, 0.18, length(vec2(p.x * 0.72, p.y * 1.18)));
    col *= vignette;

    col *= u_intensity;
    outColor = vec4(col, 1.0);
}
`;

export class TrafficShaderBackground {
    private canvas: HTMLCanvasElement;
    private gl: WebGL2RenderingContext | null = null;
    private program: WebGLProgram | null = null;
    private animationHandle = 0;
    private startedAt = performance.now();
    private aPosition = -1;
    private uResolution: WebGLUniformLocation | null = null;
    private uTime: WebGLUniformLocation | null = null;
    private uIntensity: WebGLUniformLocation | null = null;
    private targetIntensity = 1;
    private currentIntensity = 1;
    private readonly onResize = () => this.resize();

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
    }

    init() {
        const gl = this.canvas.getContext("webgl2", {
            antialias: true,
            alpha: true,
            premultipliedAlpha: true,
        });

        if (!gl) {
            this.canvas.classList.add("is-fallback");
            return;
        }

        this.gl = gl;
        const program = this.createProgram(VERTEX_SHADER, FRAGMENT_SHADER);
        if (!program) {
            this.canvas.classList.add("is-fallback");
            return;
        }

        this.program = program;
        this.aPosition = gl.getAttribLocation(program, "a_position");
        this.uResolution = gl.getUniformLocation(program, "u_resolution");
        this.uTime = gl.getUniformLocation(program, "u_time");
        this.uIntensity = gl.getUniformLocation(program, "u_intensity");

        const vertices = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
            -1,  1,
             1, -1,
             1,  1,
        ]);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        gl.useProgram(program);
        gl.enableVertexAttribArray(this.aPosition);
        gl.vertexAttribPointer(this.aPosition, 2, gl.FLOAT, false, 0, 0);

        window.addEventListener("resize", this.onResize);
        this.resize();
        this.render();
    }

    setScreen(screen: ShaderScreen) {
        if (screen === "storyIntro") this.targetIntensity = 1.0;
        else if (screen === "onboarding") this.targetIntensity = 0.78;
        else this.targetIntensity = 0.22;
    }

    dispose() {
        if (this.animationHandle) cancelAnimationFrame(this.animationHandle);
        window.removeEventListener("resize", this.onResize);
    }

    private resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = Math.max(1, Math.floor(this.canvas.clientWidth * dpr));
        const height = Math.max(1, Math.floor(this.canvas.clientHeight * dpr));

        if (this.canvas.width === width && this.canvas.height === height) return;
        this.canvas.width = width;
        this.canvas.height = height;
        this.gl?.viewport(0, 0, width, height);
    }

    private render = () => {
        if (!this.gl || !this.program) return;

        this.animationHandle = requestAnimationFrame(this.render);
        this.currentIntensity += (this.targetIntensity - this.currentIntensity) * 0.04;

        const gl = this.gl;
        const elapsed = (performance.now() - this.startedAt) / 1000;
        gl.useProgram(this.program);
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        if (this.uResolution) gl.uniform2f(this.uResolution, this.canvas.width, this.canvas.height);
        if (this.uTime) gl.uniform1f(this.uTime, elapsed);
        if (this.uIntensity) gl.uniform1f(this.uIntensity, this.currentIntensity);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    private createProgram(vertexSource: string, fragmentSource: string) {
        if (!this.gl) return null;

        const gl = this.gl;
        const vertex = this.compile(gl.VERTEX_SHADER, vertexSource);
        const fragment = this.compile(gl.FRAGMENT_SHADER, fragmentSource);
        if (!vertex || !fragment) return null;

        const program = gl.createProgram();
        if (!program) return null;

        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error("[TrafficShaderBackground] Program link failed", gl.getProgramInfoLog(program));
            return null;
        }

        return program;
    }

    private compile(type: number, source: string) {
        if (!this.gl) return null;

        const shader = this.gl.createShader(type);
        if (!shader) return null;

        this.gl.shaderSource(shader, source);
        this.gl.compileShader(shader);

        if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
            console.error("[TrafficShaderBackground] Shader compile failed", this.gl.getShaderInfoLog(shader));
            this.gl.deleteShader(shader);
            return null;
        }

        return shader;
    }
}
