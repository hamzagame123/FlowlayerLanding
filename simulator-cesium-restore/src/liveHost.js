import { GoogleGenAI, Modality } from "@google/genai";

const DEFAULT_LIVE_MODEL = "gemini-3.1-flash-live-preview";
const DIRECT_LIVE_API_KEY = String(import.meta.env.VITE_GEMINI_API_KEY || "").trim();

function decodeBase64ToBytes(base64) {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

function encodeBytesToBase64(bytes) {
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

function float32ToPcm16Bytes(float32Samples) {
    const buffer = new ArrayBuffer(float32Samples.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Samples.length; i += 1) {
        const sample = Math.max(-1, Math.min(1, float32Samples[i]));
        view.setInt16(i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    }
    return new Uint8Array(buffer);
}

function parseSampleRate(mimeType = "") {
    const match = String(mimeType).match(/rate=(\d+)/i);
    return match ? Number(match[1]) : 24000;
}

class LiveAudioPlayer {
    constructor() {
        this.context = null;
        this.queueTime = 0;
        this.activeSources = new Set();
    }

    async ensureContext() {
        if (!this.context || this.context.state === "closed") {
            const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextCtor) {
                throw new Error("Web Audio API is unavailable.");
            }
            this.context = new AudioContextCtor({ sampleRate: 24000 });
            this.queueTime = this.context.currentTime;
        }

        if (this.context.state === "suspended") {
            await this.context.resume();
        }

        return this.context;
    }

    async playPcmChunk(base64, mimeType = "audio/pcm;rate=24000") {
        if (!base64) return;
        const context = await this.ensureContext();
        const bytes = decodeBase64ToBytes(base64);
        const int16 = new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
        const samples = new Float32Array(int16.length);
        for (let i = 0; i < int16.length; i += 1) {
            samples[i] = Math.max(-1, Math.min(1, int16[i] / 32768));
        }

        const sampleRate = parseSampleRate(mimeType);
        const buffer = context.createBuffer(1, samples.length, sampleRate);
        buffer.copyToChannel(samples, 0);

        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(context.destination);

        const startAt = Math.max(context.currentTime + 0.01, this.queueTime || context.currentTime);
        source.start(startAt);
        this.queueTime = startAt + buffer.duration;
        this.activeSources.add(source);
        source.onended = () => {
            this.activeSources.delete(source);
            if (this.activeSources.size === 0 && this.context) {
                this.queueTime = this.context.currentTime;
            }
        };
    }

    stop() {
        this.activeSources.forEach(source => {
            try {
                source.stop();
            } catch {
                // Ignore source stop failures.
            }
        });
        this.activeSources.clear();
        if (this.context && this.context.state !== "closed") {
            this.queueTime = this.context.currentTime;
        } else {
            this.queueTime = 0;
        }
    }

    close() {
        this.stop();
        if (this.context && this.context.state !== "closed") {
            this.context.close().catch(() => {});
        }
        this.context = null;
    }
}

function normalizeResponseChunk(text = "") {
    return String(text).replace(/\s+/g, " ").trim();
}

function appendResponseChunk(existing, incoming) {
    const chunk = normalizeResponseChunk(incoming);
    if (!chunk) return existing;
    if (!existing) return chunk;
    if (existing.endsWith(chunk)) return existing;
    if (chunk.startsWith(existing)) return chunk;
    return `${existing} ${chunk}`.replace(/\s+/g, " ").trim();
}

function extractTextParts(payload, bucket = []) {
    if (!payload) return bucket;

    if (Array.isArray(payload)) {
        payload.forEach(item => extractTextParts(item, bucket));
        return bucket;
    }

    if (typeof payload === "string") {
        return bucket;
    }

    if (typeof payload === "object") {
        if (payload.sessionResumptionUpdate?.newHandle) {
            return bucket;
        }
        if (typeof payload.outputTranscription?.text === "string") {
            bucket.push(payload.outputTranscription.text);
        }
        if (typeof payload.serverContent?.outputTranscription?.text === "string") {
            bucket.push(payload.serverContent.outputTranscription.text);
        }
        if (Array.isArray(payload.parts)) {
            payload.parts.forEach(part => {
                if (typeof part?.text === "string") {
                    bucket.push(part.text);
                }
            });
        }
        if (Array.isArray(payload.serverContent?.modelTurn?.parts)) {
            payload.serverContent.modelTurn.parts.forEach(part => {
                if (typeof part?.text === "string") {
                    bucket.push(part.text);
                }
            });
        }
    }

    return bucket;
}

function extractAudioChunks(payload, bucket = []) {
    if (!payload) return bucket;

    if (Array.isArray(payload)) {
        payload.forEach(item => extractAudioChunks(item, bucket));
        return bucket;
    }

    if (payload.audioChunk?.data) {
        bucket.push(payload.audioChunk);
    }

    if (Array.isArray(payload.audioChunks)) {
        payload.audioChunks.forEach(chunk => {
            if (chunk?.data) bucket.push(chunk);
        });
    }

    if (Array.isArray(payload.serverContent?.audioChunks)) {
        payload.serverContent.audioChunks.forEach(chunk => {
            if (chunk?.data) bucket.push(chunk);
        });
    }

    if (Array.isArray(payload.serverContent?.modelTurn?.parts)) {
        payload.serverContent.modelTurn.parts.forEach(part => {
            if (part?.inlineData?.data) {
                bucket.push({
                    data: part.inlineData.data,
                    mimeType: part.inlineData.mimeType || "audio/pcm;rate=24000",
                });
            }
        });
    }

    return bucket;
}

function buildSystemInstruction(context = {}) {
    return [
        "You are FlowLayer Host, a calm real-time driving guide inside a future Toronto driving simulator.",
        "Keep every reply under 24 words unless the app explicitly asks for more detail.",
        "Ask only one next-step question at a time.",
        "Never dump paragraphs. Never roleplay beyond the simulator context.",
        "If the user is choosing a destination, help them decide between a destination or free drive.",
        "If the app provides a vibe, use that tone lightly without sounding theatrical.",
        `Current queued driver name: ${context.candidateName || "unknown"}.`,
        `Current destination: ${context.destination || "unknown"}.`,
        `Current vibe: ${context.vibeId || "scenic"}.`,
    ].join(" ");
}

export class LiveHostClient {
    constructor({ tracker, onReply, onStateChange } = {}) {
        this.tracker = tracker;
        this.onReply = onReply;
        this.onStateChange = onStateChange;
        this.session = null;
        this.model = DEFAULT_LIVE_MODEL;
        this.lastContext = null;
        this.connecting = null;
        this.audioPlayer = new LiveAudioPlayer();
        this.micStream = null;
        this.micContext = null;
        this.micSource = null;
        this.micProcessor = null;
        this.micSink = null;
        this.micActive = false;
        this.readyPromise = null;
        this.resolveReady = null;
        this.pendingResponse = "";
        this.lastDeliveredResponse = "";
        this.currentTurnHasLiveAudio = false;
        this.authMode = DIRECT_LIVE_API_KEY ? "direct-key" : "ephemeral-token";
    }

    buildCallbacks() {
        return {
            onopen: () => {
                const detail = this.authMode === "direct-key" ? "Connected (API key)" : "Connected";
                this.tracker?.mark("live-session", "success", detail);
                this.onStateChange?.("open", detail);
            },
            onmessage: event => {
                const payload = event?.data ?? event;
                if (payload?.setupComplete) {
                    this.resolveReady?.();
                    this.resolveReady = null;
                }

                const interrupted = Boolean(payload?.serverContent?.interrupted || payload?.interrupted);
                if (interrupted) {
                    this.audioPlayer.stop();
                    this.pendingResponse = "";
                    this.currentTurnHasLiveAudio = false;
                }

                const audioChunks = extractAudioChunks(payload, []);
                audioChunks.forEach(chunk => {
                    this.currentTurnHasLiveAudio = true;
                    this.audioPlayer.playPcmChunk(chunk.data, chunk.mimeType).catch(error => {
                        console.warn("[FlowLayer] Gemini Live audio playback failed:", error);
                    });
                });

                const text = extractTextParts(payload, []).join(" ").replace(/\s+/g, " ").trim();
                if (text) {
                    this.pendingResponse = appendResponseChunk(this.pendingResponse, text);
                    this.onReply?.(this.pendingResponse, { partial: true, fallbackSpeak: false, payload });
                }

                const turnComplete = Boolean(payload?.serverContent?.turnComplete);
                if (turnComplete) {
                    const finalText = normalizeResponseChunk(this.pendingResponse);
                    const fallbackSpeak = !this.currentTurnHasLiveAudio;
                    this.pendingResponse = "";
                    if (finalText && finalText !== this.lastDeliveredResponse) {
                        this.lastDeliveredResponse = finalText;
                        this.onReply?.(finalText, { partial: false, fallbackSpeak, payload });
                    }
                    this.currentTurnHasLiveAudio = false;
                }
            },
            onerror: event => {
                const detail = String(event?.message || event?.error?.message || "Live session error");
                this.tracker?.mark("live-session", "error", detail);
                this.onStateChange?.("error", detail);
            },
            onclose: event => {
                const reason = String(event?.reason || "").trim();
                const code = Number.isFinite(event?.code) ? `WS ${event.code}` : "";
                const detail = [code, reason].filter(Boolean).join(" · ") || "Closed";
                this.tracker?.mark("live-session", "idle", detail);
                this.onStateChange?.("closed", detail);
                this.session = null;
                this.resolveReady = null;
                this.readyPromise = null;
            },
        };
    }

    async connectWithAi(ai, model, systemInstruction) {
        this.session = await ai.live.connect({
            model,
            config: {
                systemInstruction,
                responseModalities: [Modality.AUDIO],
                outputAudioTranscription: {},
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: "Kore",
                        },
                    },
                },
            },
            callbacks: this.buildCallbacks(),
        });
    }

    async connect(context = {}) {
        if (this.session) return this.session;
        if (this.connecting) return this.connecting;

        this.lastContext = context;
        this.tracker?.mark("live-session", "active", "Connecting");
        this.onStateChange?.("connecting");

        this.connecting = (async () => {
            await this.audioPlayer.ensureContext().catch(() => {});
            this.readyPromise = new Promise(resolve => {
                this.resolveReady = resolve;
            });

            let systemInstruction = buildSystemInstruction(context);

            if (DIRECT_LIVE_API_KEY) {
                try {
                    this.authMode = "direct-key";
                    this.model = String(context.model || DEFAULT_LIVE_MODEL).trim() || DEFAULT_LIVE_MODEL;
                    const directClient = new GoogleGenAI({
                        apiKey: DIRECT_LIVE_API_KEY,
                        httpOptions: { apiVersion: "v1alpha" },
                    });
                    await this.connectWithAi(directClient, this.model, systemInstruction);
                } catch (error) {
                    console.warn("[FlowLayer] Direct Gemini Live key failed, falling back to ephemeral token:", error);
                    this.session = null;
                    this.authMode = "ephemeral-token";
                }
            }

            if (!this.session) {
                const response = await fetch("/api/live-token", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        candidateName: context.candidateName,
                        destination: context.destination,
                        vibeId: context.vibeId,
                        model: context.model || DEFAULT_LIVE_MODEL,
                    }),
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(errorText || `Live token failed with ${response.status}`);
                }

                const tokenPayload = await response.json();
                this.model = tokenPayload.model || DEFAULT_LIVE_MODEL;
                systemInstruction = tokenPayload.systemInstruction || systemInstruction;

                const tokenClient = new GoogleGenAI({
                    apiKey: tokenPayload.token,
                    httpOptions: { apiVersion: "v1alpha" },
                });
                await this.connectWithAi(tokenClient, this.model, systemInstruction);
            }

            await Promise.race([
                this.readyPromise,
                new Promise(resolve => window.setTimeout(resolve, 3000)),
            ]);

            return this.session;
        })();

        try {
            return await this.connecting;
        } finally {
            this.connecting = null;
        }
    }

    async sendStagePrompt(stage, context = {}) {
        const session = await this.connect(context);
        const prompt = [
            `Current app stage: ${stage}.`,
            `Driver name: ${context.candidateName || "unknown"}.`,
            `Destination: ${context.destination || "not set"}.`,
            `Vibe: ${context.vibeId || "scenic"}.`,
            `Drive mode: ${context.mode || "route"}.`,
            "Reply with one short spoken line that helps the user with this step.",
        ].join(" ");

        this.pendingResponse = "";
        this.currentTurnHasLiveAudio = false;
        session.sendRealtimeInput({
            text: prompt,
        });
    }

    async startMicrophone(context = {}) {
        const session = await this.connect(context);
        if (this.micActive) return true;
        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error("Microphone capture is unavailable in this browser.");
        }

        const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextCtor) {
            throw new Error("Web Audio API is unavailable for microphone capture.");
        }

        this.micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                channelCount: 1,
                noiseSuppression: true,
                echoCancellation: true,
                autoGainControl: true,
            },
        });

        this.micContext = new AudioContextCtor({ sampleRate: 16000 });
        if (this.micContext.state === "suspended") {
            await this.micContext.resume();
        }

        this.micSource = this.micContext.createMediaStreamSource(this.micStream);
        this.micProcessor = this.micContext.createScriptProcessor(4096, 1, 1);
        this.micSink = this.micContext.createGain();
        this.micSink.gain.value = 0;

        this.micProcessor.onaudioprocess = event => {
            if (!this.micActive || !this.session) return;
            const channel = event.inputBuffer.getChannelData(0);
            const pcmBytes = float32ToPcm16Bytes(channel);
            session.sendRealtimeInput({
                audio: {
                    data: encodeBytesToBase64(pcmBytes),
                    mimeType: "audio/pcm;rate=16000",
                },
            });
        };

        this.micSource.connect(this.micProcessor);
        this.micProcessor.connect(this.micSink);
        this.micSink.connect(this.micContext.destination);
        this.micActive = true;
        this.onStateChange?.("mic-on");
        return true;
    }

    async stopMicrophone() {
        this.micActive = false;

        if (this.micProcessor) {
            this.micProcessor.onaudioprocess = null;
            this.micProcessor.disconnect();
            this.micProcessor = null;
        }

        this.micSource?.disconnect();
        this.micSource = null;

        this.micSink?.disconnect();
        this.micSink = null;

        this.micStream?.getTracks?.().forEach(track => track.stop());
        this.micStream = null;

        if (this.micContext && this.micContext.state !== "closed") {
            await this.micContext.close().catch(() => {});
        }
        this.micContext = null;
        this.onStateChange?.("mic-off");
    }

    async toggleMicrophone(context = {}) {
        if (this.micActive) {
            await this.stopMicrophone();
            return false;
        }
        await this.startMicrophone(context);
        return true;
    }

    isMicrophoneActive() {
        return this.micActive;
    }

    close() {
        this.stopMicrophone().catch(() => {});
        this.audioPlayer.close();
        this.pendingResponse = "";
        this.lastDeliveredResponse = "";
        this.currentTurnHasLiveAudio = false;
        this.session?.close?.();
        this.session = null;
    }
}
