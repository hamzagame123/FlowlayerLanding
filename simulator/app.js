// FlowLayer - Main Application Controller
// ========================================

class FlowLayerApp {
    constructor() {
        this.personalization = new PersonalizationEngine();
        this.simulator = null;
        this.voice = null;
        this.currentVibe = 'scenic';
        this.currentRoute = 'coastal';
        this.playlist = [];
        this.currentDrive = null;
        this.feedback = {};
        
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
            
            // Set environment based on scenic preference
            const scenicPref = this.personalization.answers.scenic_preference;
            if (scenicPref === 'ocean') this.setRoute('coastal');
            else if (scenicPref === 'mountains') this.setRoute('mountain');
            else if (scenicPref === 'forest') this.setRoute('forest');
        }
        
        // Update UI
        this.updateVibeUI();
        this.updateRouteUI();
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
