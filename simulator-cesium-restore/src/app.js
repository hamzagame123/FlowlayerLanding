// FlowLayer - Main Application Controller
// ========================================

import { PersonalizationEngine } from "./personalization.js";
import { VoiceController } from "./voice.js";
import { MapboxSimulator } from "./mapboxSimulator.js";
import { loadGooglePlacesLibrary } from "./googlePlaces.js";
import { LiveHostClient } from "./liveHost.js";
import {
    getPinnedCnTowerNarrationAudioUrl,
    getPinnedCnTowerRadar,
    isPinnedCnTowerDestination,
} from "./cnTowerPresets.js";
import { augmentDirectionsWithGemini } from "./vibeDirections.js";

const ROUTE_DESTINATIONS = {
    coastal: 'CN Tower, Toronto, ON',
    mountain: 'Casa Loma, Toronto, ON',
    forest: 'High Park, Toronto, ON',
};

function compactPanelCopy(value, maxLength = 96) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) return '';
    const sentence = text.split(/(?<=[.!?])\s+/)[0] || text;
    if (sentence.length <= maxLength) return sentence;
    return `${sentence.slice(0, maxLength - 1).trimEnd()}…`;
}

function slugifyLabel(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40);
}

function isOpaqueLiveArtifact(value) {
    const text = String(value || '').trim();
    if (!text) return true;
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)) {
        return true;
    }
    if (/^[A-Za-z0-9+/=]{96,}$/.test(text)) {
        return true;
    }
    return false;
}

const ROUTE_RADAR_CACHE_PREFIX = "flowlayer_route_radar_cache_v1";
const ROUTE_RADAR_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;

function getRouteRadarCacheKey({ destination, vibeId, currentLatLng }) {
    const point = Array.isArray(currentLatLng) && currentLatLng.length >= 2
        ? `${Number(currentLatLng[0]).toFixed(3)},${Number(currentLatLng[1]).toFixed(3)}`
        : 'no-point';
    return [
        ROUTE_RADAR_CACHE_PREFIX,
        String(destination || '').trim().toLowerCase(),
        String(vibeId || 'scenic').trim().toLowerCase(),
        point,
    ].join('::');
}

function readRouteRadarCache(cacheKey) {
    try {
        const raw = localStorage.getItem(cacheKey);
        if (!raw) return null;
        const payload = JSON.parse(raw);
        if (!payload?.savedAt || !payload?.data) return null;
        if (Date.now() - Number(payload.savedAt) > ROUTE_RADAR_CACHE_TTL_MS) {
            localStorage.removeItem(cacheKey);
            return null;
        }
        return payload.data;
    } catch {
        return null;
    }
}

function writeRouteRadarCache(cacheKey, data) {
    try {
        localStorage.setItem(cacheKey, JSON.stringify({
            savedAt: Date.now(),
            data,
        }));
    } catch {
        // Ignore storage failures.
    }
}

export class FlowLayerApp {
    constructor() {
        this.personalization = new PersonalizationEngine();
        this.simulator = null;
        this.voice = null;
        this.currentVibe = 'scenic';
        this.currentRoute = 'coastal';
        this.selectedDestination = 'CN Tower';
        this.playlist = [];
        this.currentDrive = null;
        this.feedback = {};
        this.apiTracker = null;
        this.liveHost = null;
        this.storyTimeouts = [];
        this.storyCrawlTimer = null;
        this.destinationRecognition = null;
        this.destinationListening = false;
        this.driveDurationInterval = null;
        this.driveSettings = {
            preferredDurationMinutes: 20
        };
        this.hostSession = {
            active: true,
            minimized: false,
            stage: 'idle',
            mode: 'route',
            candidateName: 'Next driver',
            currentMessage: '',
            currentMeta: '',
        };
        this.routeRadar = {
            timer: null,
            requestInFlight: false,
            lastFetchKey: '',
            lastSignature: '',
            lastSummary: '',
            places: [],
        };
        this.lastRouteNarrationSignature = '';
        this.routeNarrationAudio = null;
        this.destinationAutocomplete = {
            ready: false,
            loading: null,
        };
        
        this.skipSimulatorIntro();
    }

    skipSimulatorIntro() {
        const storyScreen = document.getElementById('storyIntro');
        if (storyScreen) {
            storyScreen.classList.remove('active');
            storyScreen.style.display = 'none';
        }
        this.personalization.loadProfile();
        this.init();
    }

    initStoryExperience() {
        const storyScreen = document.getElementById('storyIntro');
        const storyButton = document.getElementById('storyStartBtn');
        const storySkipButton = document.getElementById('storySkipBtn');
        const storyScroll = document.getElementById('storyScroll');
        const storyLines = [...document.querySelectorAll('.story-line')];
        const storyContainer = document.querySelector('.story-intro-container');
        this.personalization.loadProfile();

        if (!storyScreen || !storyButton || storyLines.length === 0) {
            this.init();
            return;
        }

        if (this.personalization.hasCompletedOnboarding()) {
            storyScreen.classList.remove('active');
            storyScreen.style.display = 'none';
            this.init();
            return;
        }

        const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

        if (prefersReducedMotion) {
            storyLines.forEach(line => line.classList.add('visible'));
            storyButton.classList.add('ready');
            storyButton.addEventListener('click', () => this.finishStoryExperience());
            if (storySkipButton) storySkipButton.addEventListener('click', () => this.finishStoryExperience());
            storyScreen.addEventListener('dblclick', () => this.finishStoryExperience());
            return;
        }

        if (storyScroll) {
            storyScroll.classList.add('crawl-active');
        }

        storyLines.forEach(line => {
            line.dataset.fullText = line.textContent.trim();
            line.textContent = '';
        });

        if (storyContainer) {
            this.storyCrawlTimer = setInterval(() => {
                if (!this.storyFinished) {
                    storyContainer.scrollTop += 0.5;
                }
            }, 16);
        }

        let timelineDelay = 700;
        storyLines.forEach(line => {
            const fullText = line.dataset.fullText || '';
            this.storyTimeouts.push(setTimeout(() => {
                storyLines.forEach(storyLine => storyLine.classList.remove('current-line'));
                line.classList.add('visible');
                line.classList.add('current-line');
                this.typeStoryLine(line, fullText);
                this.scrollStoryFromMiddle(line, storyContainer);
            }, timelineDelay));

            const linePause = Number(line.dataset.pause || 1800);
            timelineDelay += linePause + Math.min(fullText.length * 16, 1300);
        });

        this.storyTimeouts.push(setTimeout(() => {
            storyButton.classList.add('ready');
        }, timelineDelay + 900));

        this.storyTimeouts.push(setTimeout(() => {
            this.finishStoryExperience();
        }, timelineDelay + 5200));

        storyButton.addEventListener('click', () => this.finishStoryExperience());
        if (storySkipButton) storySkipButton.addEventListener('click', () => this.finishStoryExperience());
        storyScreen.addEventListener('dblclick', () => this.finishStoryExperience());
    }

    typeStoryLine(lineEl, fullText) {
        if (!lineEl) return;
        lineEl.textContent = '';
        let charIndex = 0;
        const text = String(fullText || '');

        const revealNext = () => {
            if (this.storyFinished || !lineEl.isConnected) return;
            lineEl.textContent = text.slice(0, charIndex);
            charIndex += 1;

            if (charIndex <= text.length) {
                const timeoutId = setTimeout(revealNext, 20);
                this.storyTimeouts.push(timeoutId);
            }
        };

        revealNext();
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
        if (this.storyCrawlTimer) {
            clearInterval(this.storyCrawlTimer);
            this.storyCrawlTimer = null;
        }

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
        this.loadDriveSettings();

        // Listen for onboarding complete
        window.addEventListener('onboardingComplete', (e) => {
            this.onOnboardingComplete(e.detail.profile);
        });
        
        // Listen for voice commands
        window.addEventListener('voiceCommand', (e) => {
            this.handleVoiceCommand(e.detail.command);
        });

        window.addEventListener('streetMemoryUpdated', (e) => {
            this.updateStreetMemoryPanel(e.detail);
        });
        
        // Setup UI event listeners
        this.setupEventListeners();
        this.apiTracker = window.flowlayerApiTracker || null;
        this.liveHost = new LiveHostClient({
            tracker: this.apiTracker,
            onReply: (text) => this.handleLiveHostReply(text),
            onStateChange: (state, detail) => this.handleLiveHostState(state, detail),
        });

        if (!this.personalization.profile) {
            this.personalization.init();
        } else {
            this.personalization.initSpeechRecognition();
        }

        this.applyOutsideTvHandoff();
        this.hydrateHostSession();
        this.startSimulator();
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

    applyOutsideTvHandoff() {
        const params = new URLSearchParams(window.location.search);
        const vibe = params.get('vibe') || localStorage.getItem('flowlayer_outside_vibe');
        const route = params.get('route') || localStorage.getItem('flowlayer_outside_route');
        const destination = params.get('destination') || localStorage.getItem('flowlayer_outside_destination');

        if (['scenic', 'chill', 'adventure', 'fastest'].includes(vibe)) {
            this.currentVibe = vibe;
        }

        if (['coastal', 'mountain', 'forest'].includes(route)) {
            this.currentRoute = route;
        }

        if (destination) {
            this.selectedDestination = destination;
            this.currentRoute = 'custom';
            const input = document.getElementById('destinationInputSim');
            if (input) input.value = destination;
        }
    }

    getQueueCandidateName() {
        const params = new URLSearchParams(window.location.search);
        return params.get('driver')
            || localStorage.getItem('flowlayer_outside_driver_name')
            || localStorage.getItem('flowlayer_queue_name')
            || localStorage.getItem('flowlayer_driver_name')
            || this.personalization?.profile?.name
            || 'Next driver';
    }

    hydrateHostSession() {
        this.hostSession.candidateName = this.getQueueCandidateName();
        this.setHostStage('idle');
        this.updateRouteRadarPanel();
    }
    
    onOnboardingComplete(profile) {
        // Set initial preferences based on personalization
        this.currentVibe = this.personalization.getPreferredVibe();
        
        // Transition to simulator
        this.startSimulator();
    }
    
    startSimulator() {
        this.showScreen('simulator');
        
        // Initialize Mapbox simulator if not already.
        if (!this.simulator) {
            this.simulator = new MapboxSimulator("cesiumContainer", import.meta.env.VITE_MAPBOX_ACCESS_TOKEN);
        }
        
        // Initialize voice control
        if (!this.voice) {
            this.voice = new VoiceController();
            this.setupVoiceCallbacks();
        }
        
        // Apply personalization settings natively
        let initialVibe = "scenic"; 
        if (this.personalization.profile) {
            const vibe = this.personalization.getPreferredVibe();
            this.setVibe(vibe);
            this.setRoute(this.personalization.inferRoutePreference());
        } else {
            this.setVibe(initialVibe);
        }

        // Fire simulator.init() after screen transition completes so the map
        // container has real pixel dimensions before Mapbox creates its canvas.
        setTimeout(() => {
            this.simulator.init(this.currentVibe).catch(err => console.error("[FlowLayer] Mapbox init error:", err));
        }, 600);
        
        // Initialize voice control
        if (!this.voice) {
            try {
                this.voice = new VoiceController();
                this.setupVoiceCallbacks();
            } catch(e) {
                console.warn("[FlowLayer] Voice controller unavailable:", e);
            }
        }
        
        // Initialize MiniMap
        if (!this.miniMap) {
            import('./miniMap.js').then(module => {
                this.miniMap = new module.MiniMap("miniMapContainer");
                if (this.simulator) {
                    this.simulator.miniMap = this.miniMap;
                    if (typeof this.simulator.syncMiniMapRoute === 'function') {
                        this.simulator.syncMiniMapRoute(this.currentVibe);
                    }
                }
            }).catch(e => console.error("Could not load minimap:", e));
        }
        
        // Update UI
        this.updateVibeUI();
        this.updateRouteUI();
        this.setupDestinationInput();
        this.updateStreetMemoryPanel({
            label: 'Route Feel',
            summary: 'Waiting for route character.',
            features: ['Loading'],
            emotions: ['Waiting'],
        });
        this.updateDriveControls();
    }
    
    setupVoiceCallbacks() {
        // Register voice command callbacks
        this.voice.on('start', () => this.startDrive());
        this.voice.on('stop', () => this.endDrive());
        this.voice.on('speed up', () => this.simulator.accelerate && this.simulator.accelerate());
        this.voice.on('slow down', () => this.simulator.decelerate && this.simulator.decelerate());
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
            voiceToggle.addEventListener('click', async () => {
                if (this.liveHost && this.hostSession.stage !== 'idle') {
                    await this.toggleLiveMicFromUi();
                    return;
                }
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

        const freeBtn = document.getElementById('freeDriveBtn');
        if (freeBtn) {
            freeBtn.addEventListener('click', () => {
                if (!this.simulator) return;
                if (this.simulator.isDriving && this.simulator.driveMode === 'free') {
                    this.endDrive();
                    return;
                }
                this.startFreeDrive();
            });
        }

        const camBtn = document.getElementById('cameraModeBtn');
        if (camBtn) {
            camBtn.addEventListener('click', () => {
                if (this.simulator && typeof this.simulator.toggleCameraMode === 'function') {
                    this.simulator.toggleCameraMode();
                }
            });
        }

        const saveCameraBtn = document.getElementById('saveCameraBtn');
        if (saveCameraBtn) {
            saveCameraBtn.addEventListener('click', () => {
                if (!this.simulator || typeof this.simulator.saveCameraAsDefault !== 'function') {
                    this.showToast('Camera is not ready yet.');
                    return;
                }
                this.simulator.saveCameraAsDefault();
                this.showToast('Startup camera saved.');
            });
        }

        const hostButtons = [
            document.getElementById('sessionHostPrimary'),
            document.getElementById('sessionHostSecondary'),
            document.getElementById('sessionHostTertiary'),
        ];
        hostButtons.forEach(button => {
            button?.addEventListener('click', () => {
                this.handleHostAction(button.dataset.action || '');
            });
        });

        const hostDismiss = document.getElementById('sessionHostDismiss');
        hostDismiss?.addEventListener('click', () => {
            this.handleHostAction('toggle-host');
        });

        const miniMapSizeBtn = document.getElementById('miniMapSizeBtn');
        if (miniMapSizeBtn) {
            miniMapSizeBtn.addEventListener('click', () => {
                if (!this.miniMap || typeof this.miniMap.toggleExpanded !== 'function') return;
                const expanded = this.miniMap.toggleExpanded();
                const shell = document.getElementById('miniMapShell');
                const icon = document.getElementById('miniMapSizeIcon');
                const label = document.getElementById('miniMapSizeLabel');
                shell?.classList.toggle('expanded', expanded);
                if (icon) icon.textContent = expanded ? '−' : '+';
                if (label) label.textContent = expanded ? 'Shrink Map' : 'Expand Map';
            });
        }
        
        // Vibe selector buttons
        document.querySelectorAll('.vibe-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const vibe = btn.dataset.vibe;
                this.setVibe(vibe);
                this.showToast(`Vibe changed to ${vibe}`);
            });
        });

        // Listen for route loaded → build animated AI step cards
        window.addEventListener('routeLoaded', async (e) => {
            const { steps, startLocation } = e.detail;
            const listEl = document.getElementById('navStepList');
            if (!listEl) return;

            // Clear previous cards
            listEl.innerHTML = '';

            if (!steps || steps.length === 0) {
                listEl.innerHTML = '<p class="route-loading-hint">No steps found for this route.</p>';
                return;
            }

            // Vibe accent colours
            const vibeAccents = {
                scenic: '#c8a96e', chill: '#00f5d4',
                adventure: '#f72585', fastest: '#8090a0'
            };
            const accentColor = vibeAccents[this.currentVibe] || 'var(--accent-primary)';

            // Direction emoji helpers
            const dirIcon = (instr) => {
                const t = (instr || '').toLowerCase();
                if (t.includes('left'))  return '↰';
                if (t.includes('right')) return '↱';
                if (t.includes('merge') || t.includes('onto')) return '⤴';
                if (t.includes('dest'))  return '📍';
                return '↑';
            };

            // Build a card for each step
            const cards = steps.map((step, i) => {
                const card = document.createElement('div');
                card.className = 'nav-step-card';
                card.style.setProperty('--step-accent', accentColor);
                card.dataset.stepIndex = i;

                // Strip HTML from instruction
                const plainInstr = (step.instruction || '').replace(/<[^>]*>/g, '');

                card.innerHTML = `
                    <div class="nav-step-header">
                        <span class="nav-step-icon">${dirIcon(plainInstr)}</span>
                        <span class="nav-step-instruction">${plainInstr}</span>
                        <span class="nav-step-dist">${step.distance || ''}</span>
                    </div>
                `;
                listEl.appendChild(card);
                return card;
            });

            // Stagger slide-in animation
            cards.forEach((card, i) => {
                setTimeout(() => card.classList.add('slide-in'), i * 80);
            });

            // Mark first card active
            if (cards[0]) cards[0].classList.add('active');

            // Track car position to advance the active step
            let activeStep = 0;
            const totalSteps = steps.length;

            // Build cumulative distance thresholds from route steps
            let cumDist = 0;
            const thresholds = steps.map(s => {
                const metres = Number.isFinite(s.distanceMeters)
                    ? s.distanceMeters
                    : (parseFloat((s.distance || '0').replace(/[^0-9.]/g, '')) || 0);
                cumDist += metres;
                return cumDist;
            });

            // Advance cards as distance accumulates during drive
            const _advanceCards = (travelledMetres) => {
                if (activeStep >= totalSteps - 1) return;

                // Check if driver has passed the current step's threshold
                if (travelledMetres >= (thresholds[activeStep] || Infinity) * 0.9) {
                    // Collapse previous active card
                    if (cards[activeStep]) {
                        cards[activeStep].classList.remove('active');
                        cards[activeStep].classList.add('past');
                    }
                    activeStep++;
                    if (cards[activeStep]) {
                        cards[activeStep].classList.add('active');
                        // Scroll into view
                        cards[activeStep].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                }
            };

            // Hook into the simulator's telemetry to advance cards
            if (this.simulator) {
                this.simulator._advanceNavCards = _advanceCards;
            }

            if (this.hostSession.stage === 'capture_destination') {
                this.setHostStage('capture_vibe', { speak: true });
            }

            this.fetchRouteRadar({ force: true, startLocation });
            if (this.simulator?.isDriving && this.simulator?.driveMode === 'route') {
                this.speakRouteIntro();
            }
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
                this.showToast('Outside TV handles the route test. Use the TV screen to update the next driver profile.');
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

        // Preferred duration buttons
        document.querySelectorAll('.duration-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const group = btn.closest('.duration-btns');
                if (!group) return;

                group.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                this.feedback.preferredDurationMinutes = parseInt(btn.dataset.minutes, 10);
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

        this.startDriveDurationWatcher();
        
        this.simulator.startDrive('route');
        this.startRouteRadar();
        this.setHostStage('driving', { speak: false });
        this.updateDriveControls();
        this.speakRouteIntro();
    }

    startFreeDrive() {
        if (!this.simulator) return;

        if (!this.currentDrive) {
            this.currentDrive = {
                startTime: Date.now(),
                route: 'free-drive',
                vibe: this.currentVibe
            };
            this.startDriveDurationWatcher();
        }
        this.currentDrive.route = 'free-drive';
        this.currentDrive.vibe = this.currentVibe;

        this.simulator.startFreeDrive();
        this.startRouteRadar();
        this.setHostStage('driving', { speak: false });
        this.updateDriveControls();
    }

    async speakRouteIntro() {
        const isPinnedCnTower = isPinnedCnTowerDestination(this.selectedDestination);
        const steps = Array.isArray(this.simulator?.routeData?.steps) ? this.simulator.routeData.steps : [];
        if (!isPinnedCnTower && (!steps.length || !this.voice?.speak)) return;

        const signature = isPinnedCnTower
            ? `pinned-cn-tower::${String(this.currentVibe || 'scenic').toLowerCase()}`
            : [
                String(this.currentVibe || 'scenic').toLowerCase(),
                ...steps.slice(0, 6).map(step => `${String(step?.instruction || '').replace(/<[^>]*>/g, '').trim()}|${String(step?.distance || '').trim()}`),
            ].join('::');

        if (!signature || signature === this.lastRouteNarrationSignature) {
            return;
        }

        this.lastRouteNarrationSignature = signature;

        try {
            if (isPinnedCnTower) {
                const played = await this.playPinnedRouteNarrationAudio();
                if (played) {
                    return;
                }
            }

            const text = await augmentDirectionsWithGemini(
                steps,
                this.currentVibe,
                this.simulator?.currentLngLat || null
            );
            if (!text) return;
            this.voice.speak(text);
        } catch (error) {
            console.warn('[FlowLayer] Route narration failed:', error);
            this.lastRouteNarrationSignature = '';
        }
    }

    async playPinnedRouteNarrationAudio() {
        const audioUrl = getPinnedCnTowerNarrationAudioUrl(this.currentVibe);
        if (!audioUrl) return false;

        try {
            if (this.routeNarrationAudio) {
                this.routeNarrationAudio.pause();
                this.routeNarrationAudio.currentTime = 0;
            }

            const audio = new Audio(audioUrl);
            audio.preload = 'auto';
            audio.volume = 1;
            this.routeNarrationAudio = audio;
            await audio.play();
            return true;
        } catch (error) {
            console.warn('[FlowLayer] Pinned narration audio failed:', error);
            this.routeNarrationAudio = null;
            return false;
        }
    }
    
    endDrive(autoEnded = false) {
        if (!this.simulator || !this.currentDrive) return;
        this.stopDriveDurationWatcher();
        this.lastRouteNarrationSignature = '';
        if (this.routeNarrationAudio) {
            this.routeNarrationAudio.pause();
            this.routeNarrationAudio.currentTime = 0;
            this.routeNarrationAudio = null;
        }
        
        // Get drive data
        const driveData = this.simulator.getDriveData();
        this.currentDrive.endTime = Date.now();
        this.currentDrive.distance = driveData.distance;
        this.currentDrive.duration = driveData.duration;
        
        this.simulator.endDrive();
        this.stopRouteRadar();
        
        this.updateDriveControls();

        if (autoEnded) {
            this.showToast('Drive duration reached. Wrapping up your ride.');
        }
        
        // Show feedback modal
        setTimeout(() => this.showFeedback(), 500);
    }
    
    // Vibe & Route Control
    setVibe(vibe) {
        this.currentVibe = vibe;
        this.lastRouteNarrationSignature = '';
        if (this.routeNarrationAudio) {
            this.routeNarrationAudio.pause();
            this.routeNarrationAudio.currentTime = 0;
            this.routeNarrationAudio = null;
        }
        
        this.updateVibeUI();
        if (this.simulator && typeof this.simulator.setVibe === 'function') {
            this.simulator.setVibe(vibe);
        }
        this.updateRouteRadarPanel();
        if (this.hostSession.stage === 'capture_vibe') {
            this.setHostStage('ready', { speak: true });
        }
        if (this.simulator?.isDriving) {
            this.fetchRouteRadar({ force: true });
        }
    }
    
    updateVibeUI() {
        document.querySelectorAll('.vibe-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.vibe === this.currentVibe);
        });
    }
    
    setRoute(route) {
        this.currentRoute = route;
        this.selectedDestination = ROUTE_DESTINATIONS[route] || this.selectedDestination;
        this.lastRouteNarrationSignature = '';
        if (this.routeNarrationAudio) {
            this.routeNarrationAudio.pause();
            this.routeNarrationAudio.currentTime = 0;
            this.routeNarrationAudio = null;
        }
        
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
            routeName.textContent = routeNames[this.currentRoute] || this.selectedDestination || 'Custom Route';
        }
    }

    updateDriveControls() {
        const startBtn = document.getElementById('startDriveBtn');
        const endBtn = document.getElementById('endDriveBtn');
        const freeBtn = document.getElementById('freeDriveBtn');
        const isDriving = Boolean(this.simulator?.isDriving);
        const isFreeDrive = Boolean(this.simulator?.driveMode === 'free' && this.simulator?.isDriving);

        startBtn?.classList.toggle('hidden', isDriving);
        endBtn?.classList.toggle('hidden', !isDriving);
        freeBtn?.classList.toggle('active', isFreeDrive);
    }

    setDestination(destination, { showToast = false } = {}) {
        const nextDestination = String(destination || '').trim() || 'Untitled Destination';
        this.selectedDestination = nextDestination;
        this.currentRoute = 'custom';
        this.lastRouteNarrationSignature = '';
        if (this.routeNarrationAudio) {
            this.routeNarrationAudio.pause();
            this.routeNarrationAudio.currentTime = 0;
            this.routeNarrationAudio = null;
        }

        const destinationInput = document.getElementById('destinationInputSim');
        if (destinationInput) {
            destinationInput.value = nextDestination;
        }

        if (this.simulator && typeof this.simulator.setDestination === 'function') {
            this.simulator.setDestination(nextDestination, this.currentVibe);
        }

        this.updateRouteUI();
        if (this.hostSession.stage === 'capture_destination') {
            this.setHostStage('capture_vibe', { speak: true });
        }
        this.fetchRouteRadar({ force: true });
        if (showToast) {
            this.showToast(`Destination set: ${nextDestination}`);
        }
    }

    updateStreetMemoryPanel(detail = {}) {
        const labelEl = document.getElementById('streetMemoryLabel');
        const summaryEl = document.getElementById('streetMemorySummary');
        const featureChipsEl = document.getElementById('streetFeatureChips');
        const emotionChipsEl = document.getElementById('streetEmotionChips');
        const renderChips = (target, values = [], className = '') => {
            if (!target) return;
            const chips = (values || []).slice(0, 4);
            target.innerHTML = chips.map(value => `<span class="route-feel-chip ${className}">${value}</span>`).join('');
        };

        if (labelEl) {
            labelEl.textContent = detail.label || 'Route Feel';
        }
        if (summaryEl) {
            summaryEl.textContent = compactPanelCopy(detail.summary || 'Route character will appear here once guidance is ready.', 88);
        }
        renderChips(featureChipsEl, detail.features?.length ? detail.features : ['Open road']);
        renderChips(emotionChipsEl, detail.emotions?.length ? detail.emotions : ['Focused'], 'emotion');
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
            this.setDestination(destinationInput.value.trim() || 'Untitled Destination', { showToast: true });
        });

        const ensureAutocomplete = () => this.initDestinationAutocomplete(destinationInput);
        destinationInput.addEventListener('focus', ensureAutocomplete, { once: true });
        destinationInput.addEventListener('pointerdown', ensureAutocomplete, { once: true });

        if (!destinationVoiceBtn) return;
        this.initDestinationDictation(destinationVoiceBtn, destinationInput);
    }

    async initDestinationAutocomplete(inputEl) {
        if (!inputEl || inputEl.dataset.autocompleteBound === 'true' || this.destinationAutocomplete.ready) return;
        if (this.destinationAutocomplete.loading) {
            await this.destinationAutocomplete.loading;
            return;
        }

        this.destinationAutocomplete.loading = (async () => {
        try {
            const maps = await loadGooglePlacesLibrary();
            const autocomplete = new maps.places.Autocomplete(inputEl, {
                fields: ['formatted_address', 'geometry', 'name'],
                componentRestrictions: { country: ['ca'] },
            });

            autocomplete.addListener('place_changed', () => {
                const place = autocomplete.getPlace();
                const destination = place?.formatted_address || place?.name || inputEl.value.trim();
                if (!destination) return;
                this.setDestination(destination, { showToast: true });
            });

            inputEl.dataset.autocompleteBound = 'true';
            this.destinationAutocomplete.ready = true;
        } catch (error) {
            console.warn('[FlowLayer] Google Places autocomplete unavailable:', error);
        }
        })();

        try {
            await this.destinationAutocomplete.loading;
        } finally {
            this.destinationAutocomplete.loading = null;
        }
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

    getLiveContext() {
        return {
            candidateName: this.hostSession.candidateName,
            destination: this.selectedDestination,
            vibeId: this.currentVibe,
            mode: this.hostSession.mode,
        };
    }

    async speakWithLiveHost(stage) {
        if (!this.liveHost) {
            if (this.voice?.speak) {
                this.voice.speak(this.hostSession.currentMessage);
            }
            return;
        }

        try {
            await this.liveHost.sendStagePrompt(stage, this.getLiveContext());
        } catch (error) {
            console.warn('[FlowLayer] Live host prompt failed:', error);
            this.apiTracker?.mark('live-session', 'error', 'Unavailable');
            if (this.voice?.speak) {
                this.voice.speak(this.hostSession.currentMessage);
            }
        }
    }

    handleLiveHostReply(text, meta = {}) {
        if (isOpaqueLiveArtifact(text)) {
            return;
        }
        const next = compactPanelCopy(text, 120);
        if (!next) return;
        this.hostSession.currentMeta = next;
        this.renderHostSession({
            label: document.getElementById('sessionHostStage')?.textContent || 'Session Host',
            message: this.hostSession.currentMessage,
            meta: next,
            actions: [
                { slot: 'primary', label: document.getElementById('sessionHostPrimary')?.textContent || 'Begin Session', action: document.getElementById('sessionHostPrimary')?.dataset.action || 'begin-session' },
                { slot: 'secondary', label: document.getElementById('sessionHostSecondary')?.textContent || 'Free Drive', action: document.getElementById('sessionHostSecondary')?.dataset.action || 'choose-free-drive' },
                { slot: 'tertiary', label: document.getElementById('sessionHostTertiary')?.textContent || 'Hide', action: document.getElementById('sessionHostTertiary')?.dataset.action || 'toggle-host' },
            ],
        });

        if (!meta.partial && meta.fallbackSpeak && this.voice?.speak) {
            this.voice.speak(next);
        }
    }

    handleLiveHostState(state, detail = '') {
        if (state === 'open') {
            this.apiTracker?.mark('live-session', 'success', 'Connected');
            return;
        }
        if (state === 'mic-on') {
            this.updateLiveMicUi(true);
            return;
        }
        if (state === 'mic-off') {
            this.updateLiveMicUi(false);
            return;
        }
        if (state === 'connecting') {
            this.apiTracker?.mark('live-session', 'active', 'Connecting');
            return;
        }
        if (state === 'closed') {
            this.apiTracker?.mark('live-session', 'idle', detail || 'Closed');
            this.updateLiveMicUi(false);
            return;
        }
        if (state === 'error') {
            this.apiTracker?.mark('live-session', 'error', detail || 'Live error');
        }
    }

    updateLiveMicUi(active) {
        const voiceToggle = document.getElementById('voiceToggle');
        const voiceIndicator = document.getElementById('voiceIndicator');
        voiceToggle?.classList.toggle('active', Boolean(active));
        voiceIndicator?.classList.toggle('active', Boolean(active));
        if (voiceToggle) {
            voiceToggle.title = active ? 'Gemini mic is live' : 'Enable Gemini mic';
        }
    }

    async ensureLiveMicStarted() {
        if (!this.liveHost) return false;
        try {
            await this.liveHost.startMicrophone(this.getLiveContext());
            this.updateLiveMicUi(true);
            return true;
        } catch (error) {
            console.warn('[FlowLayer] Live microphone unavailable:', error);
            this.updateLiveMicUi(false);
            this.showToast('Gemini mic permission was blocked or unavailable.');
            return false;
        }
    }

    async toggleLiveMicFromUi() {
        if (!this.liveHost) return;
        try {
            const active = await this.liveHost.toggleMicrophone(this.getLiveContext());
            this.updateLiveMicUi(active);
            this.showToast(active ? 'Gemini mic is live.' : 'Gemini mic stopped.');
        } catch (error) {
            console.warn('[FlowLayer] Gemini mic toggle failed:', error);
            this.updateLiveMicUi(false);
            this.showToast('Could not start the Gemini mic.');
        }
    }

    setHostStage(stage, { speak = false } = {}) {
        this.hostSession.stage = stage;
        this.hostSession.active = true;
        const candidate = this.hostSession.candidateName || 'Next driver';
        const stageConfig = {
            idle: {
                label: 'Seat Check',
                message: 'Ready for the next driver. Start the host when someone sits down.',
                meta: 'This is the temporary seat trigger. Later it can be driven by a real sensor.',
                actions: [
                    { slot: 'primary', label: 'Begin Session', action: 'begin-session' },
                    { slot: 'secondary', label: 'Free Drive Ready', action: 'free-drive-direct' },
                    { slot: 'tertiary', label: 'Hide', action: 'toggle-host' },
                ],
                speech: '',
            },
            confirm_identity: {
                label: 'Queue Check',
                message: `Are you ${candidate} from the queue?`,
                meta: 'Confirm the queued rider or continue as a guest.',
                actions: [
                    { slot: 'primary', label: "Yes, that's me", action: 'confirm-identity' },
                    { slot: 'secondary', label: 'Guest Driver', action: 'guest-driver' },
                    { slot: 'tertiary', label: 'Hide', action: 'toggle-host' },
                ],
                speech: `Hi. Are you ${candidate} from the queue?`,
            },
            choose_mode: {
                label: 'Drive Mode',
                message: 'I can set a destination for you or leave the city open for free drive.',
                meta: 'Choose a route, or let Gemini surface places as you wander.',
                actions: [
                    { slot: 'primary', label: 'Choose Destination', action: 'choose-destination' },
                    { slot: 'secondary', label: 'Free Drive', action: 'choose-free-drive' },
                    { slot: 'tertiary', label: 'Repeat Intro', action: 'repeat-intro' },
                ],
                speech: 'This is a live driving simulation. You can choose a destination, or free drive.',
            },
            capture_destination: {
                label: 'Destination',
                message: 'Type or say where you want to go, then confirm it.',
                meta: 'The destination bar supports Google autocomplete and voice dictation.',
                actions: [
                    { slot: 'primary', label: 'Use Typed Destination', action: 'use-current-destination' },
                    { slot: 'secondary', label: 'Focus Destination', action: 'focus-destination' },
                    { slot: 'tertiary', label: 'Free Drive Instead', action: 'choose-free-drive' },
                ],
                speech: 'Where are you going? You can say an address, or type it into the destination bar.',
            },
            capture_vibe: {
                label: 'Vibe',
                message: 'Choose the emotional read for the drive before you move.',
                meta: `Current vibe: ${this.currentVibe}. Use these quick picks or the vibe tiles on the right for Fast.`,
                actions: [
                    { slot: 'primary', label: 'Scenic', action: 'set-vibe-scenic' },
                    { slot: 'secondary', label: 'Adventure', action: 'set-vibe-adventure' },
                    { slot: 'tertiary', label: 'Chill', action: 'set-vibe-chill' },
                ],
                speech: 'How should this drive feel? Scenic, adventure, chill, or fast.',
            },
            ready: {
                label: 'Ready',
                message: this.hostSession.mode === 'free'
                    ? `Free drive is armed in ${this.currentVibe} mode.`
                    : `Route set for ${this.selectedDestination} in ${this.currentVibe} mode.`,
                meta: this.hostSession.mode === 'free'
                    ? 'The nearby-place radar will start updating once you move.'
                    : 'The nearby-place radar will keep updating around your route.',
                actions: [
                    { slot: 'primary', label: this.hostSession.mode === 'free' ? 'Start Free Drive' : 'Start Route', action: 'start-current-drive' },
                    { slot: 'secondary', label: 'Change Vibe', action: 'back-to-vibe' },
                    { slot: 'tertiary', label: 'Change Mode', action: 'back-to-mode' },
                ],
                speech: this.hostSession.mode === 'free'
                    ? 'Free drive is ready.'
                    : `Route ready for ${this.selectedDestination}.`,
            },
            driving: {
                label: 'Live Guide',
                message: this.hostSession.mode === 'free'
                    ? 'Free drive is active. Nearby places will update from your current heading.'
                    : 'Drive is active. Nearby places will update as the route unfolds.',
                meta: 'Glance right for grounded places and mood shifts. The host only needs to speak when something useful appears.',
                actions: [
                    { slot: 'primary', label: 'Refresh Radar', action: 'refresh-radar' },
                    { slot: 'secondary', label: 'End Drive', action: 'end-current-drive' },
                    { slot: 'tertiary', label: 'Hide', action: 'toggle-host' },
                ],
                speech: '',
            },
        };

        const config = stageConfig[stage] || stageConfig.idle;
        this.hostSession.currentMessage = config.message;
        this.hostSession.currentMeta = config.meta;
        this.renderHostSession(config);

        if (speak) {
            this.speakWithLiveHost(stage);
        }
    }

    renderHostSession(config) {
        const root = document.getElementById('sessionHostCard');
        if (!root || !config) return;

        root.classList.toggle('active', this.hostSession.active);
        root.classList.toggle('minimized', this.hostSession.minimized);

        const stageEl = document.getElementById('sessionHostStage');
        const messageEl = document.getElementById('sessionHostMessage');
        const metaEl = document.getElementById('sessionHostMeta');
        const dismissEl = document.getElementById('sessionHostDismiss');
        if (stageEl) stageEl.textContent = config.label || 'Session Host';
        if (messageEl) messageEl.textContent = config.message || '';
        if (metaEl) metaEl.textContent = config.meta || '';
        if (dismissEl) dismissEl.textContent = this.hostSession.minimized ? '+' : '−';

        const slots = {
            primary: document.getElementById('sessionHostPrimary'),
            secondary: document.getElementById('sessionHostSecondary'),
            tertiary: document.getElementById('sessionHostTertiary'),
        };

        Object.entries(slots).forEach(([slot, button]) => {
            if (!button) return;
            const nextAction = config.actions?.find(action => action.slot === slot);
            if (!nextAction) {
                button.classList.add('hidden');
                button.dataset.action = '';
                return;
            }

            button.classList.remove('hidden');
            button.textContent = nextAction.label;
            button.dataset.action = nextAction.action;
        });
    }

    handleHostAction(action) {
        switch (action) {
            case 'begin-session':
                this.hostSession.minimized = false;
                this.setHostStage('confirm_identity', { speak: true });
                this.ensureLiveMicStarted();
                break;
            case 'confirm-identity':
            case 'guest-driver':
                this.setHostStage('choose_mode', { speak: true });
                break;
            case 'choose-destination':
                this.hostSession.mode = 'route';
                this.setHostStage('capture_destination', { speak: true });
                this.focusDestinationInput();
                break;
            case 'choose-free-drive':
            case 'free-drive-direct':
                this.hostSession.mode = 'free';
                this.setHostStage('capture_vibe', { speak: true });
                break;
            case 'repeat-intro':
                this.setHostStage('choose_mode', { speak: true });
                break;
            case 'use-current-destination':
                this.hostSession.mode = 'route';
                this.setDestination(this.selectedDestination, { showToast: true });
                break;
            case 'focus-destination':
                this.focusDestinationInput();
                break;
            case 'set-vibe-scenic':
            case 'set-vibe-adventure':
            case 'set-vibe-chill':
                this.setVibe(action.replace('set-vibe-', ''));
                break;
            case 'back-to-vibe':
                this.setHostStage('capture_vibe', { speak: false });
                break;
            case 'back-to-mode':
                this.setHostStage('choose_mode', { speak: false });
                break;
            case 'start-current-drive':
                if (this.hostSession.mode === 'free') this.startFreeDrive();
                else this.startDrive();
                break;
            case 'refresh-radar':
                this.fetchRouteRadar({ force: true });
                break;
            case 'end-current-drive':
                this.endDrive();
                break;
            case 'toggle-host':
                this.hostSession.minimized = !this.hostSession.minimized;
                this.renderHostSession({
                    label: document.getElementById('sessionHostStage')?.textContent || 'Session Host',
                    message: this.hostSession.currentMessage,
                    meta: this.hostSession.currentMeta,
                    actions: [
                        { slot: 'primary', label: document.getElementById('sessionHostPrimary')?.textContent || 'Begin Session', action: document.getElementById('sessionHostPrimary')?.dataset.action || 'begin-session' },
                        { slot: 'secondary', label: document.getElementById('sessionHostSecondary')?.textContent || 'Free Drive', action: document.getElementById('sessionHostSecondary')?.dataset.action || 'choose-free-drive' },
                        { slot: 'tertiary', label: document.getElementById('sessionHostTertiary')?.textContent || 'Hide', action: document.getElementById('sessionHostTertiary')?.dataset.action || 'toggle-host' },
                    ],
                });
                break;
            default:
                break;
        }
    }

    focusDestinationInput() {
        const destinationInput = document.getElementById('destinationInputSim');
        destinationInput?.focus();
        destinationInput?.select();
    }

    startRouteRadar() {
        this.stopRouteRadar();
        this.fetchRouteRadar({ force: true });
        this.routeRadar.timer = window.setInterval(() => {
            this.fetchRouteRadar();
        }, 12000);
    }

    stopRouteRadar() {
        if (!this.routeRadar.timer) return;
        window.clearInterval(this.routeRadar.timer);
        this.routeRadar.timer = null;
    }

    buildRouteRadarRequest({ startLocation = null } = {}) {
        return {
            vibeId: this.currentVibe,
            currentLatLng: startLocation || this.simulator?.currentLngLat || null,
            heading: this.simulator?.currentHeading || 0,
            destination: this.selectedDestination,
            routeName: this.getRouteName(this.currentRoute),
            mode: this.hostSession.mode,
            steps: (this.simulator?.routeData?.steps || []).slice(0, 6).map(step => ({
                instruction: step.instruction,
                distance: step.distance,
                startLocation: step.startLocation,
                endLocation: step.endLocation,
            })),
        };
    }

    async fetchRouteRadar({ force = false, startLocation = null } = {}) {
        const currentLatLng = startLocation || this.simulator?.currentLngLat;
        if (!currentLatLng || this.routeRadar.requestInFlight) return;

        const fetchKey = [
            this.currentVibe,
            this.selectedDestination,
            currentLatLng.map(value => Number(value).toFixed(3)).join(','),
            Math.round((this.simulator?.currentHeading || 0) / 20) * 20,
        ].join('::');

        if (!force && this.routeRadar.lastFetchKey === fetchKey) return;
        this.routeRadar.lastFetchKey = fetchKey;

        const cacheKey = getRouteRadarCacheKey({
            destination: this.selectedDestination,
            vibeId: this.currentVibe,
            currentLatLng,
        });

        if (isPinnedCnTowerDestination(this.selectedDestination)) {
            const pinnedRadar = getPinnedCnTowerRadar(currentLatLng, this.currentVibe);
            writeRouteRadarCache(cacheKey, pinnedRadar);
            this.routeRadar.lastSummary = pinnedRadar.summary || '';
            this.routeRadar.places = Array.isArray(pinnedRadar.places) ? pinnedRadar.places : [];
            this.updateRouteRadarPanel(pinnedRadar);
            this.simulator?.setNearbyPlaceHighlights?.(this.routeRadar.places);
            this.routeRadar.lastSignature = JSON.stringify(this.routeRadar.places.map(place => `${place.name}:${place.distanceNote || place.address || ''}`));
            return;
        }

        const cachedRadar = readRouteRadarCache(cacheKey);
        if (!force && cachedRadar) {
            this.routeRadar.lastSummary = cachedRadar.summary || '';
            this.routeRadar.places = Array.isArray(cachedRadar.places) ? cachedRadar.places : [];
            this.updateRouteRadarPanel(cachedRadar);
            this.simulator?.setNearbyPlaceHighlights?.(this.routeRadar.places);
            this.routeRadar.lastSignature = JSON.stringify(this.routeRadar.places.map(place => `${place.name}:${place.distanceNote || place.address || ''}`));
            return;
        }

        this.routeRadar.requestInFlight = true;

        try {
            const response = await fetch('/api/route-radar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.buildRouteRadarRequest({ startLocation })),
            });
            if (!response.ok) {
                throw new Error(`Route radar failed with ${response.status}`);
            }

            const result = await response.json();
            writeRouteRadarCache(cacheKey, result);
            this.routeRadar.lastSummary = result.summary || '';
            this.routeRadar.places = Array.isArray(result.places) ? result.places : [];
            this.updateRouteRadarPanel(result);
            this.simulator?.setNearbyPlaceHighlights?.(this.routeRadar.places);

            const nextSignature = JSON.stringify(this.routeRadar.places.map(place => `${place.name}:${place.distanceNote || place.address || ''}`));
            if (this.hostSession.stage === 'driving' && nextSignature && nextSignature !== this.routeRadar.lastSignature) {
                const topPlace = this.routeRadar.places[0];
                if (topPlace?.name && this.voice?.speak) {
                    this.voice.speak(`${topPlace.name} is nearby. ${compactPanelCopy(topPlace.reason || 'Grounded nearby place.', 68)}`);
                }
            }
            this.routeRadar.lastSignature = nextSignature;
        } catch (error) {
            console.warn('[FlowLayer] Route radar failed:', error);
            this.updateRouteRadarPanel({
                summary: 'Nearby place radar is waiting on grounded place data.',
                places: [],
            });
            this.simulator?.setNearbyPlaceHighlights?.([]);
        } finally {
            this.routeRadar.requestInFlight = false;
        }
    }

    updateRouteRadarPanel(detail = {}) {
        const summaryEl = document.getElementById('routeRadarSummary');
        const listEl = document.getElementById('routeRadarList');
        const hintEl = document.getElementById('routeRadarHint');
        if (!summaryEl || !listEl || !hintEl) return;

        const places = Array.isArray(detail.places) ? detail.places.slice(0, 3) : this.routeRadar.places.slice(0, 3);
        summaryEl.textContent = compactPanelCopy(
            detail.summary || this.routeRadar.lastSummary || 'Grounded nearby places will appear here once the host is active.',
            110
        );
        hintEl.textContent = this.simulator?.isDriving
            ? 'Live updates based on your position, vibe, and heading.'
            : 'Start a drive or choose a destination to wake the nearby-place radar.';

        if (!places.length) {
            this.simulator?.setNearbyPlaceHighlights?.([]);
            listEl.innerHTML = '<div class="route-radar-item"><span class="route-radar-dot"></span><div class="route-radar-copy"><span class="route-radar-name">No places loaded</span><span class="route-radar-meta">No nearby highlights yet.</span></div></div>';
            return;
        }

        listEl.innerHTML = places.map(place => {
            const distance = place.distanceText || place.distanceNote || place.distance || '';
            const supporting = [place.address, compactPanelCopy(place.reason || '', 64)].filter(Boolean).slice(0, 2).join(' · ');
            return `
                <div class="route-radar-item" data-place="${slugifyLabel(place.name)}">
                    <span class="route-radar-dot"></span>
                    <div class="route-radar-copy">
                        <span class="route-radar-name">${place.name}${distance ? ` · ${distance}` : ''}</span>
                        <span class="route-radar-meta">${supporting || 'Grounded nearby place'}</span>
                    </div>
                </div>
            `;
        }).join('');
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

    loadDriveSettings() {
        const saved = localStorage.getItem('flowlayer_drive_settings');
        if (!saved) return;

        try {
            const parsed = JSON.parse(saved);
            const minutes = Number(parsed.preferredDurationMinutes);
            if (Number.isFinite(minutes) && minutes > 0) {
                this.driveSettings.preferredDurationMinutes = minutes;
            }
        } catch (e) {
            // Keep defaults if parsing fails.
        }
    }

    saveDriveSettings() {
        localStorage.setItem('flowlayer_drive_settings', JSON.stringify(this.driveSettings));
    }

    startDriveDurationWatcher() {
        this.stopDriveDurationWatcher();
        const minutes = Number(this.driveSettings.preferredDurationMinutes);
        if (!Number.isFinite(minutes) || minutes <= 0) return;

        const targetMs = minutes * 60 * 1000;
        this.driveDurationInterval = setInterval(() => {
            if (!this.currentDrive || !this.simulator || !this.simulator.isDriving) return;
            const elapsedMs = Date.now() - this.currentDrive.startTime;
            if (elapsedMs >= targetMs) {
                this.endDrive(true);
            }
        }, 1000);
    }

    stopDriveDurationWatcher() {
        if (!this.driveDurationInterval) return;
        clearInterval(this.driveDurationInterval);
        this.driveDurationInterval = null;
    }
    
    saveCurrentRide() {
        if (this.currentDrive && this.currentDrive.savedToPlaylist) {
            this.showToast('This drive is already in your playlist.');
            return;
        }

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
            duration: this.currentDrive.duration || 0,
            date: new Date().toLocaleDateString(),
            name: this.getRouteName(this.currentRoute)
        };
        
        this.playlist.unshift(ride);
        this.savePlaylist();
        this.currentDrive.savedToPlaylist = true;
        
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
        document.querySelectorAll('.duration-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        document.getElementById('feedbackNotes').value = '';

        const saveToPlaylist = document.getElementById('saveToPlaylistAfterDrive');
        if (saveToPlaylist) {
            saveToPlaylist.checked = this.currentDrive ? !this.currentDrive.savedToPlaylist : true;
        }

        const preferred = Number(this.driveSettings.preferredDurationMinutes);
        const defaultDurationBtn = document.querySelector(`.duration-btn[data-minutes="${preferred}"]`);
        if (defaultDurationBtn) {
            defaultDurationBtn.classList.add('selected');
            this.feedback.preferredDurationMinutes = preferred;
        }
        
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

        const selectedDurationBtn = document.querySelector('.duration-btn.selected');
        if (selectedDurationBtn) {
            const minutes = parseInt(selectedDurationBtn.dataset.minutes, 10);
            if (Number.isFinite(minutes) && minutes > 0) {
                this.driveSettings.preferredDurationMinutes = minutes;
                this.feedback.preferredDurationMinutes = minutes;
                this.saveDriveSettings();
            }
        }

        const saveToPlaylist = document.getElementById('saveToPlaylistAfterDrive');
        if (saveToPlaylist && saveToPlaylist.checked) {
            this.saveCurrentRide();
            this.feedback.savedToPlaylist = true;
        } else {
            this.feedback.savedToPlaylist = false;
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
        if (command === 'start' && this.hostSession.stage === 'ready') {
            if (this.hostSession.mode === 'free') this.startFreeDrive();
            else this.startDrive();
            return;
        }

        if (command === 'stop' && this.simulator?.isDriving) {
            this.endDrive();
            return;
        }

        console.log('Voice command received:', command);
    }
}
