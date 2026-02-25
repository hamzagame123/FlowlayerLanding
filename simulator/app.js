// FlowLayer - Main Application Controller
// ========================================

class FlowLayerApp {
    constructor() {
        this.personalization = new PersonalizationEngine();
        this.simulator = null;
        this.voice = null;
        this.currentVibe = 'scenic';
        this.currentRoute = 'coastal';
        this.selectedDestination = 'Golden Gate Bridge';
        this.playlist = [];
        this.currentDrive = null;
        this.feedback = {};
        this.storyTimeouts = [];
        this.destinationRecognition = null;
        this.destinationListening = false;
        
        this.initStoryExperience();
    }

    initStoryExperience() {
        const storyScreen = document.getElementById('storyIntro');
        const storyButton = document.getElementById('storyStartBtn');
        const storyLines = [...document.querySelectorAll('.story-line')];
        const storyContainer = document.querySelector('.story-intro-container');

        if (!storyScreen || !storyButton || storyLines.length === 0) {
            this.init();
            return;
        }

        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (prefersReducedMotion) {
            storyLines.forEach(line => line.classList.add('visible'));
            storyButton.classList.add('ready');
            storyButton.addEventListener('click', () => this.finishStoryExperience());
            return;
        }

        let timelineDelay = 700;
        storyLines.forEach(line => {
            this.storyTimeouts.push(setTimeout(() => {
                storyLines.forEach(storyLine => storyLine.classList.remove('current-line'));
                line.classList.add('visible');
                line.classList.add('current-line');
                this.scrollStoryFromMiddle(line, storyContainer);
            }, timelineDelay));

            const linePause = Number(line.dataset.pause || 1800);
            timelineDelay += linePause;
        });

        this.storyTimeouts.push(setTimeout(() => {
            storyButton.classList.add('ready');
        }, timelineDelay + 900));

        this.storyTimeouts.push(setTimeout(() => {
            this.finishStoryExperience();
        }, timelineDelay + 5200));

        storyButton.addEventListener('click', () => this.finishStoryExperience());
    }

    scrollStoryFromMiddle(lineEl, containerEl) {
        if (!lineEl || !containerEl) return;

        const containerRect = containerEl.getBoundingClientRect();
        const lineRect = lineEl.getBoundingClientRect();
        const lineMidpoint = lineRect.top + (lineRect.height / 2);
        const scrollTrigger = containerRect.top + (containerRect.height * 0.5);

        if (lineMidpoint <= scrollTrigger) return;

        const delta = lineMidpoint - scrollTrigger;
        const maxScrollTop = containerEl.scrollHeight - containerEl.clientHeight;
        const nextTop = Math.min(containerEl.scrollTop + delta, maxScrollTop);

        containerEl.scrollTo({
            top: nextTop,
            behavior: 'smooth'
        });
    }

    finishStoryExperience() {
        if (this.storyFinished) return;
        this.storyFinished = true;

        this.storyTimeouts.forEach(timeoutId => clearTimeout(timeoutId));
        this.storyTimeouts = [];

        const storyScreen = document.getElementById('storyIntro');
        if (storyScreen) {
            storyScreen.classList.remove('active');
            this.storyTimeouts.push(setTimeout(() => {
                storyScreen.style.display = 'none';
            }, 520));
        }

        this.init();
    }
    
    init() {
        // Load playlist from storage
        this.loadPlaylist();
        
        // Check if user has completed onboarding
        if (this.personalization.hasCompletedOnboarding()) {
            this.startSimulator();
        } else {
            this.showScreen('onboarding');
            this.personalization.init();
        }
        
        // Listen for onboarding complete
        window.addEventListener('onboardingComplete', (e) => {
            this.onOnboardingComplete(e.detail.profile);
        });
        
        // Listen for voice commands
        window.addEventListener('voiceCommand', (e) => {
            this.handleVoiceCommand(e.detail.command);
        });
        
        // Setup UI event listeners
        this.setupEventListeners();
    }
    
    showScreen(screenId) {
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });
        
        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }
    }
    
    onOnboardingComplete(profile) {
        // Set initial preferences based on personalization
        this.currentVibe = this.personalization.getPreferredVibe();
        
        // Transition to simulator
        this.startSimulator();
    }
    
    startSimulator() {
        this.showScreen('simulator');
        
        // Initialize simulator if not already
        if (!this.simulator) {
            this.simulator = new DrivingSimulator();
        }
        
        // Initialize voice control
        if (!this.voice) {
            this.voice = new VoiceController();
            this.setupVoiceCallbacks();
        }
        
        // Apply personalization settings
        if (this.personalization.profile) {
            const vibe = this.personalization.getPreferredVibe();
            this.setVibe(vibe);
            
            // Set environment based on interpreted preferences
            this.setRoute(this.personalization.inferRoutePreference());
        }
        
        // Update UI
        this.updateVibeUI();
        this.updateRouteUI();
        this.setupDestinationInput();
    }
    
    setupVoiceCallbacks() {
        // Register voice command callbacks
        this.voice.on('start', () => this.startDrive());
        this.voice.on('stop', () => this.endDrive());
        this.voice.on('speed up', () => this.simulator.accelerate());
        this.voice.on('slow down', () => this.simulator.decelerate());
        this.voice.on('scenic', () => this.setVibe('scenic'));
        this.voice.on('chill', () => this.setVibe('chill'));
        this.voice.on('adventure', () => this.setVibe('adventure'));
        this.voice.on('fastest', () => this.setVibe('fastest'));
        this.voice.on('coastal', () => this.setRoute('coastal'));
        this.voice.on('mountain', () => this.setRoute('mountain'));
        this.voice.on('forest', () => this.setRoute('forest'));
        this.voice.on('save', () => this.saveCurrentRide());
        this.voice.on('feedback', () => this.showFeedback());
    }
    
    setupEventListeners() {
        // Voice toggle button
        const voiceToggle = document.getElementById('voiceToggle');
        if (voiceToggle) {
            voiceToggle.addEventListener('click', () => {
                if (this.voice) this.voice.toggle();
            });
        }
        
        // Start/End drive buttons
        const startBtn = document.getElementById('startDriveBtn');
        const endBtn = document.getElementById('endDriveBtn');
        
        if (startBtn) {
            startBtn.addEventListener('click', () => this.startDrive());
        }
        if (endBtn) {
            endBtn.addEventListener('click', () => this.endDrive());
        }
        
        // Vibe selector buttons
        document.querySelectorAll('.vibe-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const vibe = btn.dataset.vibe;
                this.setVibe(vibe);
            });
        });
        
        // Route cards
        document.querySelectorAll('.route-card').forEach(card => {
            card.addEventListener('click', () => {
                const route = card.dataset.route;
                this.setRoute(route);
            });
        });
        
        // Add to playlist button
        const addToPlaylistBtn = document.getElementById('addToPlaylistBtn');
        if (addToPlaylistBtn) {
            addToPlaylistBtn.addEventListener('click', () => this.saveCurrentRide());
        }
        
        // Playlist button
        const playlistBtn = document.getElementById('playlistBtn');
        if (playlistBtn) {
            playlistBtn.addEventListener('click', () => this.showPlaylistModal());
        }
        
        // Close playlist
        const closePlaylist = document.getElementById('closePlaylist');
        if (closePlaylist) {
            closePlaylist.addEventListener('click', () => this.hidePlaylistModal());
        }
        
        // Collapse assistant panel
        const collapseBtn = document.getElementById('collapseAssistant');
        if (collapseBtn) {
            collapseBtn.addEventListener('click', () => {
                const panel = document.getElementById('assistantPanel');
                panel.classList.toggle('collapsed');
                collapseBtn.textContent = panel.classList.contains('collapsed') ? '+' : '−';
            });
        }
        
        // Settings button (reset onboarding for demo)
        const settingsBtn = document.getElementById('settingsBtn');
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                if (confirm('Reset personalization and restart onboarding?')) {
                    localStorage.removeItem('flowlayer_profile');
                    location.reload();
                }
            });
        }
        
        // Feedback modal buttons
        this.setupFeedbackListeners();
        this.setupDestinationInput();
        
        // Click outside modal to close
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    overlay.classList.remove('active');
                }
            });
        });
    }
    
    setupFeedbackListeners() {
        // Rating buttons
        document.querySelectorAll('.rating-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const scale = btn.closest('.rating-scale');
                const question = scale.dataset.question;
                
                // Remove selected from siblings
                scale.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('selected'));
                // Add selected to clicked
                btn.classList.add('selected');
                // Store answer
                this.feedback[question] = parseInt(btn.dataset.value);
            });
        });
        
        // Choice buttons
        document.querySelectorAll('.choice-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const container = btn.closest('.yes-no-btns');
                const question = container.dataset.question;
                
                // Remove selected from siblings
                container.querySelectorAll('.choice-btn').forEach(b => b.classList.remove('selected'));
                // Add selected to clicked
                btn.classList.add('selected');
                // Store answer
                this.feedback[question] = btn.dataset.value;
            });
        });
        
        // Skip feedback
        const skipBtn = document.getElementById('skipFeedback');
        if (skipBtn) {
            skipBtn.addEventListener('click', () => {
                this.hideFeedback();
            });
        }
        
        // Submit feedback
        const submitBtn = document.getElementById('submitFeedback');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                this.submitFeedback();
            });
        }
    }
    
    // Drive Control
    startDrive() {
        if (!this.simulator) return;
        
        this.currentDrive = {
            startTime: Date.now(),
            route: this.currentRoute,
            vibe: this.currentVibe
        };
        
        this.simulator.startDrive();
        
        // Update UI
        document.getElementById('startDriveBtn').classList.add('hidden');
        document.getElementById('endDriveBtn').classList.remove('hidden');
    }
    
    endDrive() {
        if (!this.simulator || !this.currentDrive) return;
        
        // Get drive data
        const driveData = this.simulator.getDriveData();
        this.currentDrive.endTime = Date.now();
        this.currentDrive.distance = driveData.distance;
        this.currentDrive.duration = driveData.duration;
        
        this.simulator.endDrive();
        
        // Update UI
        document.getElementById('endDriveBtn').classList.add('hidden');
        document.getElementById('startDriveBtn').classList.remove('hidden');
        
        // Show feedback modal
        setTimeout(() => this.showFeedback(), 500);
    }
    
    // Vibe & Route Control
    setVibe(vibe) {
        this.currentVibe = vibe;
        this.updateVibeUI();
        
        // Visual feedback
        if (this.voice && this.voice.synthesis) {
            // Already spoken by voice controller if via voice
        }
    }
    
    updateVibeUI() {
        document.querySelectorAll('.vibe-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.vibe === this.currentVibe);
        });
    }
    
    setRoute(route) {
        this.currentRoute = route;
        
        // Update simulator environment
        if (this.simulator) {
            this.simulator.setEnvironment(route);
        }
        
        this.updateRouteUI();
    }
    
    updateRouteUI() {
        // Update route cards
        document.querySelectorAll('.route-card').forEach(card => {
            card.classList.toggle('active', card.dataset.route === this.currentRoute);
        });
        
        // Update header route display
        const routeNames = {
            coastal: 'Coastal Highway',
            mountain: 'Mountain Pass',
            forest: 'Forest Trail'
        };
        
        const routeName = document.querySelector('.route-name');
        if (routeName) {
            routeName.textContent = routeNames[this.currentRoute] || 'Custom Route';
        }
    }

    setupDestinationInput() {
        const destinationInput = document.getElementById('destinationInputSim');
        const destinationVoiceBtn = document.getElementById('destinationVoiceBtn');
        if (!destinationInput || destinationInput.dataset.bound === 'true') return;

        destinationInput.value = this.selectedDestination;
        destinationInput.dataset.bound = 'true';

        destinationInput.addEventListener('change', () => {
            this.selectedDestination = destinationInput.value.trim() || 'Untitled Destination';
        });

        destinationInput.addEventListener('keypress', (e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            destinationInput.blur();
            this.selectedDestination = destinationInput.value.trim() || 'Untitled Destination';
            this.showToast(`Destination set: ${this.selectedDestination}`);
        });

        if (!destinationVoiceBtn) return;
        this.initDestinationDictation(destinationVoiceBtn, destinationInput);
    }

    initDestinationDictation(buttonEl, inputEl) {
        if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
            buttonEl.disabled = true;
            buttonEl.title = 'Voice input not supported in this browser';
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.destinationRecognition = new SpeechRecognition();
        this.destinationRecognition.continuous = false;
        this.destinationRecognition.interimResults = true;
        this.destinationRecognition.lang = 'en-US';

        this.destinationRecognition.onresult = (event) => {
            const transcript = [...event.results]
                .map(result => result[0].transcript)
                .join(' ')
                .trim();

            inputEl.value = transcript;
            this.selectedDestination = transcript || this.selectedDestination;
        };

        this.destinationRecognition.onerror = () => this.stopDestinationDictation(buttonEl);
        this.destinationRecognition.onend = () => this.stopDestinationDictation(buttonEl);

        buttonEl.addEventListener('click', () => {
            if (this.destinationListening) {
                this.destinationRecognition.stop();
                return;
            }

            this.destinationListening = true;
            buttonEl.classList.add('listening');
            this.destinationRecognition.start();
        });
    }

    stopDestinationDictation(buttonEl) {
        this.destinationListening = false;
        if (buttonEl) buttonEl.classList.remove('listening');
    }
    
    // Playlist Management
    loadPlaylist() {
        const saved = localStorage.getItem('flowlayer_playlist');
        if (saved) {
            try {
                this.playlist = JSON.parse(saved);
            } catch (e) {
                this.playlist = [];
            }
        }
    }
    
    savePlaylist() {
        localStorage.setItem('flowlayer_playlist', JSON.stringify(this.playlist));
    }
    
    saveCurrentRide() {
        if (!this.currentDrive) {
            // Create a placeholder if no active drive
            const driveData = this.simulator ? this.simulator.getDriveData() : {};
            this.currentDrive = {
                route: this.currentRoute,
                vibe: this.currentVibe,
                distance: driveData.distance || 0,
                duration: driveData.duration || 0
            };
        }
        
        const ride = {
            id: Date.now(),
            route: this.currentRoute,
            vibe: this.currentVibe,
            distance: this.currentDrive.distance || 0,
            date: new Date().toLocaleDateString(),
            name: this.getRouteName(this.currentRoute)
        };
        
        this.playlist.unshift(ride);
        this.savePlaylist();
        
        // Show confirmation
        this.showToast('Ride saved to playlist!');
    }
    
    getRouteName(route) {
        const names = {
            coastal: 'Coastal Highway',
            mountain: 'Mountain Pass',
            forest: 'Forest Trail'
        };
        return names[route] || 'Custom Route';
    }
    
    showPlaylistModal() {
        const modal = document.getElementById('playlistModal');
        const content = document.getElementById('playlistContent');
        const empty = document.getElementById('playlistEmpty');
        
        if (this.playlist.length === 0) {
            content.classList.add('hidden');
            empty.classList.remove('hidden');
        } else {
            empty.classList.add('hidden');
            content.classList.remove('hidden');
            
            content.innerHTML = this.playlist.map(ride => `
                <div class="playlist-item" data-id="${ride.id}">
                    <div class="playlist-thumb" style="background: linear-gradient(135deg, 
                        ${ride.route === 'coastal' ? '#0077b6, #00b4d8' : 
                          ride.route === 'mountain' ? '#2d6a4f, #52b788' : 
                          '#1b4332, #40916c'})"></div>
                    <div class="playlist-info">
                        <h4>${ride.name}</h4>
                        <p>${ride.vibe} vibe</p>
                    </div>
                    <div class="playlist-meta">
                        <span class="distance">${ride.distance.toFixed(1)} mi</span>
                        <span class="date">${ride.date}</span>
                    </div>
                </div>
            `).join('');
            
            // Add click handlers to load ride
            content.querySelectorAll('.playlist-item').forEach(item => {
                item.addEventListener('click', () => {
                    const id = parseInt(item.dataset.id);
                    const ride = this.playlist.find(r => r.id === id);
                    if (ride) {
                        this.setRoute(ride.route);
                        this.setVibe(ride.vibe);
                        this.hidePlaylistModal();
                    }
                });
            });
        }
        
        modal.classList.add('active');
    }
    
    hidePlaylistModal() {
        const modal = document.getElementById('playlistModal');
        modal.classList.remove('active');
    }
    
    // Feedback System
    showFeedback() {
        this.feedback = {};
        
        // Reset UI
        document.querySelectorAll('.rating-btn, .choice-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        document.getElementById('feedbackNotes').value = '';
        
        const modal = document.getElementById('feedbackModal');
        modal.classList.add('active');
    }
    
    hideFeedback() {
        const modal = document.getElementById('feedbackModal');
        modal.classList.remove('active');
        this.currentDrive = null;
    }
    
    submitFeedback() {
        // Get notes
        const notes = document.getElementById('feedbackNotes').value;
        if (notes) {
            this.feedback.notes = notes;
        }
        
        // Save feedback to personalization
        this.saveFeedbackToProfile();
        
        // Show thank you
        this.showToast('Thanks for your feedback!');
        
        this.hideFeedback();
    }
    
    saveFeedbackToProfile() {
        // This could update user preferences based on feedback
        // For example, if they rate scenic poorly, reduce scenic recommendations
        const profile = JSON.parse(localStorage.getItem('flowlayer_profile') || '{}');
        
        if (!profile.feedback) {
            profile.feedback = [];
        }
        
        profile.feedback.push({
            ...this.feedback,
            route: this.currentRoute,
            vibe: this.currentVibe,
            date: Date.now()
        });
        
        localStorage.setItem('flowlayer_profile', JSON.stringify(profile));
    }
    
    // Toast notifications
    showToast(message) {
        // Create toast if doesn't exist
        let toast = document.querySelector('.toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 100px;
                left: 50%;
                transform: translateX(-50%) translateY(20px);
                background: var(--bg-elevated);
                border: 1px solid var(--accent-primary);
                color: var(--text-primary);
                padding: 14px 24px;
                border-radius: 12px;
                font-size: 14px;
                z-index: 1000;
                opacity: 0;
                transition: all 0.3s ease;
            `;
            document.body.appendChild(toast);
        }
        
        toast.textContent = message;
        toast.style.opacity = '1';
        toast.style.transform = 'translateX(-50%) translateY(0)';
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
        }, 3000);
    }
    
    handleVoiceCommand(command) {
        // Additional handling if needed
        console.log('Voice command received:', command);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.flowlayerApp = new FlowLayerApp();
});
