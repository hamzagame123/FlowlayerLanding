type VoiceCommand = {
    patterns: RegExp[];
    action: () => void;
};

export class VoiceController {
    private recognition: any = null;
    private isListening = false;
    private commands: VoiceCommand[] = [];

    constructor() {
        const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (!SpeechRecognitionCtor) {
            console.warn("[VoiceController] Speech recognition not supported.");
            return;
        }

        this.recognition = new SpeechRecognitionCtor();
        this.recognition.continuous = true;
        this.recognition.interimResults = false;
        this.recognition.lang = "en-US";

        this.recognition.onresult = (event: any) => {
            const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase().trim();
            this.processCommand(transcript);
        };

        this.recognition.onend = () => {
            if (this.isListening) {
                this.recognition?.start();
            }
        };
    }

    registerCommand(patterns: RegExp[], action: () => void) {
        this.commands.push({ patterns, action });
    }

    start() {
        if (!this.recognition) return;
        this.isListening = true;
        try { this.recognition.start(); } catch { /* already started */ }
        this.updateUI(true);
    }

    stop() {
        if (!this.recognition) return;
        this.isListening = false;
        this.recognition.stop();
        this.updateUI(false);
    }

    toggle() {
        if (this.isListening) this.stop();
        else this.start();
    }

    private processCommand(transcript: string) {
        const textEl = document.getElementById("voiceText");
        if (textEl) textEl.textContent = `"${transcript}"`;

        for (const cmd of this.commands) {
            if (cmd.patterns.some(p => p.test(transcript))) {
                cmd.action();
                return;
            }
        }
    }

    private updateUI(active: boolean) {
        const indicator = document.getElementById("voiceIndicator");
        const overlay = document.getElementById("voiceOverlay");
        indicator?.classList.toggle("active", active);
        overlay?.classList.toggle("active", active);
    }

    isSupported(): boolean {
        return this.recognition !== null;
    }
}
