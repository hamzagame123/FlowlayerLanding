// FlowLayer - Voice Control System
// ==================================
// Using Web Speech API for hands-free control

class VoiceController {
    constructor() {
        this.isSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
        this.isListening = false;
        this.recognition = null;
        this.synthesis = window.speechSynthesis;
        this.callbacks = {};
        
        // Voice commands mapping
        this.commands = {
            // Navigation commands
            'start': ['start', 'start driving', 'let\'s go', 'go', 'begin'],
            'stop': ['stop', 'stop driving', 'end', 'end drive', 'finish'],
            'speed up': ['speed up', 'faster', 'accelerate', 'go faster'],
            'slow down': ['slow down', 'slower', 'decelerate', 'go slower'],
            
            // Vibe changes
            'scenic': ['scenic', 'scenic route', 'change to scenic', 'make it scenic'],
            'chill': ['chill', 'chill route', 'relaxed', 'change to chill', 'easy'],
            'adventure': ['adventure', 'adventure route', 'exciting', 'change to adventure'],
            'fastest': ['fastest', 'fast route', 'quick', 'change to fastest'],
            
            // Route changes
            'coastal': ['coastal', 'coastal route', 'ocean', 'beach route'],
            'mountain': ['mountain', 'mountain route', 'mountains', 'hill route'],
            'forest': ['forest', 'forest route', 'woods', 'tree route'],
            
            // Utility commands
            'save': ['save', 'save ride', 'save this ride', 'add to playlist'],
            'feedback': ['feedback', 'rate', 'rate this ride', 'how was it'],
            'help': ['help', 'what can i say', 'commands', 'voice commands']
        };
        
        if (this.isSupported) {
            this.init();
        } else {
            console.warn('Speech Recognition not supported in this browser');
        }
    }
    
    init() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';
        
        this.recognition.onstart = () => {
            this.isListening = true;
            this.updateUI(true);
            this.showOverlay(true);
        };
        
        this.recognition.onend = () => {
            this.isListening = false;
            this.updateUI(false);
            
            // Hide overlay after a short delay
            setTimeout(() => {
                if (!this.isListening) {
                    this.showOverlay(false);
                }
            }, 1000);
        };
        
        this.recognition.onresult = (event) => {
            const result = event.results[event.results.length - 1];
            const transcript = result[0].transcript.toLowerCase().trim();
            
            this.updateVoiceText(transcript);
            
            if (result.isFinal) {
                this.processCommand(transcript);
            }
        };
        
        this.recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.isListening = false;
            this.updateUI(false);
            this.showOverlay(false);
            
            if (event.error === 'not-allowed') {
                this.speak('Please allow microphone access to use voice commands.');
            }
        };
    }
    
    start() {
        if (!this.isSupported) {
            this.speak('Voice control is not supported in your browser.');
            return;
        }
        
        if (this.isListening) {
            this.stop();
            return;
        }
        
        try {
            this.recognition.start();
        } catch (e) {
            console.error('Failed to start recognition:', e);
        }
    }
    
    stop() {
        if (this.recognition && this.isListening) {
            this.recognition.stop();
        }
    }
    
    toggle() {
        if (this.isListening) {
            this.stop();
        } else {
            this.start();
        }
    }
    
    processCommand(transcript) {
        let matchedCommand = null;
        let matchedPhrase = null;
        
        // Find matching command
        for (const [command, phrases] of Object.entries(this.commands)) {
            for (const phrase of phrases) {
                if (transcript.includes(phrase)) {
                    matchedCommand = command;
                    matchedPhrase = phrase;
                    break;
                }
            }
            if (matchedCommand) break;
        }
        
        if (matchedCommand) {
            console.log(`Voice command matched: ${matchedCommand}`);
            this.executeCommand(matchedCommand);
        } else {
            this.speak("I didn't catch that. Try saying 'help' for available commands.");
        }
    }
    
    executeCommand(command) {
        // Execute callback if registered
        if (this.callbacks[command]) {
            this.callbacks[command]();
        }
        
        // Dispatch custom event for the app to handle
        window.dispatchEvent(new CustomEvent('voiceCommand', {
            detail: { command }
        }));
        
        // Provide voice feedback
        switch (command) {
            case 'start':
                this.speak('Starting your drive.');
                break;
            case 'stop':
                this.speak('Ending your drive.');
                break;
            case 'speed up':
                this.speak('Speeding up.');
                break;
            case 'slow down':
                this.speak('Slowing down.');
                break;
            case 'scenic':
                this.speak('Switching to scenic mode.');
                break;
            case 'chill':
                this.speak('Switching to chill mode.');
                break;
            case 'adventure':
                this.speak('Switching to adventure mode.');
                break;
            case 'fastest':
                this.speak('Switching to fastest route.');
                break;
            case 'coastal':
                this.speak('Taking the coastal route.');
                break;
            case 'mountain':
                this.speak('Taking the mountain route.');
                break;
            case 'forest':
                this.speak('Taking the forest route.');
                break;
            case 'save':
                this.speak('Saving this ride to your playlist.');
                break;
            case 'feedback':
                this.speak('Opening feedback form.');
                break;
            case 'help':
                this.speakHelp();
                break;
        }
    }
    
    speakHelp() {
        const helpText = `
            You can say: start or stop driving, 
            speed up or slow down, 
            change to scenic, chill, adventure, or fastest mode, 
            take coastal, mountain, or forest route, 
            save this ride, or give feedback.
        `;
        this.speak(helpText);
    }
    
    speak(text) {
        if (!this.synthesis) return;
        
        // Cancel any ongoing speech
        this.synthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 0.8;
        
        // Try to use a pleasant voice
        const voices = this.synthesis.getVoices();
        const preferredVoice = voices.find(v => 
            v.name.includes('Samantha') || 
            v.name.includes('Google') ||
            v.name.includes('Microsoft')
        );
        if (preferredVoice) {
            utterance.voice = preferredVoice;
        }
        
        this.synthesis.speak(utterance);
    }
    
    // Register callback for a specific command
    on(command, callback) {
        this.callbacks[command] = callback;
    }
    
    // UI Updates
    updateUI(isActive) {
        const btn = document.getElementById('voiceToggle');
        const indicator = document.getElementById('voiceIndicator');
        
        if (btn) {
            btn.classList.toggle('active', isActive);
        }
        if (indicator) {
            indicator.classList.toggle('active', isActive);
        }
    }
    
    showOverlay(show) {
        const overlay = document.getElementById('voiceOverlay');
        if (overlay) {
            overlay.classList.toggle('active', show);
        }
    }
    
    updateVoiceText(text) {
        const voiceText = document.getElementById('voiceText');
        if (voiceText) {
            voiceText.textContent = text || 'Listening...';
        }
    }
}

// Export for global access
window.VoiceController = VoiceController;
