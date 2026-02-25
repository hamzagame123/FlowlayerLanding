// FlowLayer - Mobile Emotional Routing App
// =========================================

// State Management
const state = {
    currentScreen: 'home',
    previousScreen: 'home',
    selectedVibe: 'chill',
    selectedDestination: 'Golden Gate Bridge',
    explorerMode: false,
    selectedMood: null,
    selectedInterests: [],
    preferences: {
        waitOrWalk: null,
        stops: null,
        visual: null
    },
    vibeCustomizations: {
        scenic: ['mountains', 'lakes'],
        adventure: ['clubs'],
        chill: ['wide-roads']
    },
    cityPulse: {
        traffic: 42,
        events: 8,
        weather: 92
    }
};

// Mood to Vibe mapping
const moodToVibe = {
    stressed: 'chill',
    calm: 'scenic',
    adventurous: 'adventure',
    tired: 'chill'
};

const moodSuggestions = {
    stressed: { icon: '🌊', text: 'We suggest Easy & Chill to help you decompress' },
    calm: { icon: '🏞️', text: 'Perfect mood for a Scenic route!' },
    adventurous: { icon: '🎢', text: 'Adventure mode is calling your name!' },
    tired: { icon: '🌊', text: 'Take it easy with a Chill route' }
};

// 4 DISTINCT Route Types
const vibes = {
    fastest: {
        name: 'Fastest',
        icon: '⚡',
        color: '#ff9f1c',
        words: 'Direct • Quick • Highway',
        desc: 'Major highways, minimal stops',
        longDesc: 'Takes major highways with minimal stops to reach your destination as fast as possible.',
        emoji: '🏎️',
        score: 12
    },
    chill: {
        name: 'Easy & Chill',
        icon: '🌊',
        color: '#00f5d4',
        words: 'Calm • Simple • Low-Stress',
        desc: 'Smooth roads, easy turns',
        longDesc: 'Avoids highways and heavy traffic. Sticks to smooth roads and easy turns for a relaxed drive.',
        emoji: '😌',
        score: 24
    },
    scenic: {
        name: 'Scenic',
        icon: '🏞️',
        color: '#06d6a0',
        words: 'Views • Nature • Relax',
        desc: 'Lakes, bridges, lookout points',
        longDesc: 'Follows coastal roads, lakesides, forests, and lookout points for beautiful scenery.',
        emoji: '🌅',
        score: 32
    },
    adventure: {
        name: 'Adventure',
        icon: '🎢',
        color: '#f72585',
        words: 'Twists • Fun • Detours',
        desc: 'Clubs, landmarks, winding roads',
        longDesc: 'Uses mountain roads, winding curves, unique landmarks, clubs, and exciting detours.',
        emoji: '🎉',
        score: 28
    }
};

// Routes data
const routes = {
    fastest: {
        name: 'Highway 101 Express',
        type: 'Fastest Route',
        time: 12,
        distance: 8.2,
        perception: 'High Intensity',
        highlights: ['🛣️ Highway merge', '💨 Express lane', '🏁 Quick arrival']
    },
    chill: {
        name: 'Riverside Drive',
        type: 'Easy & Chill',
        time: 22,
        distance: 6.8,
        perception: 'Time Dilated',
        highlights: ['🛣️ No highways', '↔️ Wide lanes', '🚦 3 lights']
    },
    scenic: {
        name: 'Lakefront Parkway',
        type: 'Scenic Route',
        time: 35,
        distance: 12.4,
        perception: 'Journey Focused',
        highlights: ['🏞️ Lake views', '🌉 Bridge view', '🌲 Forest road']
    },
    adventure: {
        name: 'The Unknown',
        type: 'Compass Mode',
        time: '??',
        distance: 9.1,
        perception: 'Discovery',
        highlights: ['🧭 No Map', '📍 Target Only', '🎢 Find your way']
    }
};

// Points of Interest for the map
const pointsOfInterest = {
    scenic: [
        { x: 0.2, y: 0.3, icon: '🏞️', name: 'Crystal Lake' },
        { x: 0.7, y: 0.2, icon: '🌉', name: 'Golden Gate View' },
        { x: 0.5, y: 0.6, icon: '🌲', name: 'Redwood Grove' }
    ],
    adventure: [
        { x: 0.3, y: 0.5, icon: '🎪', name: 'Neon District' },
        { x: 0.6, y: 0.4, icon: '🎸', name: 'Live Music Row' },
        { x: 0.4, y: 0.7, icon: '🍸', name: 'Rooftop Bars' }
    ],
    chill: [
        { x: 0.25, y: 0.4, icon: '🧘', name: 'Quiet Zone' },
        { x: 0.55, y: 0.55, icon: '☕', name: 'Cafe District' },
        { x: 0.8, y: 0.35, icon: '📚', name: 'Library Row' }
    ],
    fastest: [
        { x: 0.15, y: 0.2, icon: '🛣️', name: 'Highway On-ramp' },
        { x: 0.5, y: 0.3, icon: '💨', name: 'Express Lane' },
        { x: 0.85, y: 0.25, icon: '🏁', name: 'Fast Exit' }
    ]
};

// Customization options mapping
const customizationLabels = {
    'mountains': '⛰️ Mountains',
    'lakes': '🌊 Lakes',
    'parks': '🌲 Parks',
    'beaches': '🏖️ Beaches',
    'clubs': '🍸 Clubs',
    'attractions': '🎡 Tourist Spots',
    'street-art': '🎨 Street Art',
    'food': '🍕 Food Spots',
    'wide-roads': '↔️ Wide Roads',
    'low-traffic': '🚗 Low Traffic',
    'quiet': '🤫 Quiet Areas'
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('FlowLayer Mobile initializing...');
    initTime();
    initEventListeners();
    initMoodCheckin();
    initPreferences();
    initRouteBuilder();
    initVibeCustomizations();
    initExplorerMode();
    updateVibeDisplay();

    setTimeout(() => {
        startLiveUpdates();
    }, 100);

    console.log('FlowLayer Mobile ready!');
});

// Time-based greeting
function initTime() {
    const updateGreeting = () => {
        const now = new Date();
        const hours = now.getHours();

        const greetingEl = document.querySelector('.greeting-time');
        if (greetingEl) {
            if (hours < 12) greetingEl.textContent = 'Good Morning';
            else if (hours < 17) greetingEl.textContent = 'Good Afternoon';
            else greetingEl.textContent = 'Good Evening';
        }
    };

    updateGreeting();
    setInterval(updateGreeting, 60000);
}

// ================================
// MOOD CHECK-IN
// ================================

function initMoodCheckin() {
    const moodClose = document.getElementById('moodClose');
    if (moodClose) {
        moodClose.addEventListener('click', () => {
            const checkin = document.getElementById('moodCheckin');
            if (checkin) {
                checkin.style.display = 'none';
            }
        });
    }

    document.querySelectorAll('.mood-option').forEach(option => {
        option.addEventListener('click', () => {
            const mood = option.dataset.mood;

            // Update selection
            document.querySelectorAll('.mood-option').forEach(o => o.classList.remove('selected'));
            option.classList.add('selected');
            state.selectedMood = mood;

            // Show suggestion
            const suggestion = moodSuggestions[mood];
            const suggestionEl = document.getElementById('moodSuggestion');
            if (suggestionEl && suggestion) {
                suggestionEl.style.display = 'flex';
                suggestionEl.querySelector('.suggestion-icon').textContent = suggestion.icon;
                suggestionEl.querySelector('.suggestion-text').textContent = suggestion.text;
            }

            // Auto-set suggested vibe
            const suggestedVibe = moodToVibe[mood];
            if (suggestedVibe) {
                state.selectedVibe = suggestedVibe;
                updateVibeDisplay();
            }
        });
    });
}

// ================================
// PREFERENCES
// ================================

function initPreferences() {
    document.querySelectorAll('.preference-option').forEach(option => {
        option.addEventListener('click', () => {
            const pref = option.dataset.pref;
            const value = option.dataset.value;

            // Clear other selections in same group
            document.querySelectorAll(`.preference-option[data-pref="${pref}"]`).forEach(o => {
                o.classList.remove('selected');
            });

            option.classList.add('selected');
            state.preferences[pref] = value;
        });
    });

    const saveBtn = document.getElementById('savePreferencesBtn');
    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            // Save preferences (in real app, would save to storage)
            console.log('Preferences saved:', state.preferences);
            switchScreen('home');
            updateNavActive('home');
        });
    }
}

// ================================
// ROUTE BUILDER
// ================================

function initRouteBuilder() {
    // Interest chip selection
    document.querySelectorAll('.interest-chip').forEach(chip => {
        chip.addEventListener('click', () => {
            chip.classList.toggle('selected');
            const interest = chip.dataset.interest;

            if (chip.classList.contains('selected')) {
                if (!state.selectedInterests.includes(interest)) {
                    state.selectedInterests.push(interest);
                }
            } else {
                state.selectedInterests = state.selectedInterests.filter(i => i !== interest);
            }

            updateSelectedInterestsDisplay();
        });
    });

    // Continue button
    const continueBtn = document.getElementById('routeBuilderContinue');
    if (continueBtn) {
        continueBtn.addEventListener('click', () => {
            switchScreen('vibe');
            updateNavActive('vibe');
        });
    }

    // Skip button
    const skipBtn = document.getElementById('routeBuilderSkip');
    if (skipBtn) {
        skipBtn.addEventListener('click', () => {
            state.selectedInterests = [];
            updateSelectedInterestsDisplay();
            switchScreen('vibe');
            updateNavActive('vibe');
        });
    }
}

function updateSelectedInterestsDisplay() {
    const display = document.getElementById('selectedInterestsDisplay');
    const list = document.getElementById('selectedInterestsList');

    if (!display || !list) return;

    if (state.selectedInterests.length > 0) {
        display.style.display = 'block';
        const interestIcons = {
            'water': '🌊',
            'parks': '🌲',
            'coffee': '☕',
            'art': '🎨',
            'historic': '🏛️',
            'food': '🍕',
            'mountains': '⛰️',
            'nightlife': '🍸'
        };
        list.innerHTML = state.selectedInterests.map(i =>
            `<span>${interestIcons[i] || '📍'}</span>`
        ).join('');
    } else {
        display.style.display = 'none';
    }
}

// ================================
// VIBE CUSTOMIZATIONS
// ================================

function initVibeCustomizations() {
    document.querySelectorAll('.customize-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            e.stopPropagation(); // Don't trigger vibe card click

            const vibeCard = chip.closest('.vibe-card-phone');
            const vibe = vibeCard?.dataset.vibe;
            const option = chip.dataset.option;

            if (!vibe || !option) return;

            chip.classList.toggle('selected');

            if (!state.vibeCustomizations[vibe]) {
                state.vibeCustomizations[vibe] = [];
            }

            if (chip.classList.contains('selected')) {
                if (!state.vibeCustomizations[vibe].includes(option)) {
                    state.vibeCustomizations[vibe].push(option);
                }
            } else {
                state.vibeCustomizations[vibe] = state.vibeCustomizations[vibe].filter(o => o !== option);
            }

            updateCustomizationsDisplay();
        });
    });
}

function updateCustomizationsDisplay() {
    const container = document.getElementById('routeCustomizations');
    const list = document.getElementById('customizationsList');

    if (!container || !list) return;

    const customizations = state.vibeCustomizations[state.selectedVibe] || [];

    if (customizations.length > 0) {
        container.style.display = 'block';
        list.innerHTML = customizations.map(c =>
            `<span>${customizationLabels[c] || c}</span>`
        ).join('');
    } else {
        container.style.display = 'none';
    }
}

// ================================
// EXPLORER MODE
// ================================

function initExplorerMode() {
    const toggle = document.getElementById('explorerToggle');
    if (toggle) {
        toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            toggle.classList.toggle('active');
            state.explorerMode = toggle.classList.contains('active');
            updateExplorerModeUI();
        });
    }
}

function updateExplorerModeUI() {
    const indicator = document.getElementById('explorerModeIndicator');
    if (indicator) {
        indicator.style.display = state.explorerMode && state.selectedVibe === 'adventure' ? 'flex' : 'none';
    }

    // Update route preview for explorer mode
    if (state.explorerMode && state.selectedVibe === 'adventure') {
        document.querySelectorAll('.route-preview-name').forEach(el => el.textContent = 'The Unknown');
        document.querySelectorAll('.route-preview-type').forEach(el => el.textContent = 'Explorer Mode');
        document.querySelectorAll('.route-preview-time').forEach(el => el.textContent = '??');
    }
}

// ================================
// EVENT LISTENERS
// ================================

function initEventListeners() {
    // Bottom navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const screen = item.dataset.screen;
            if (screen) {
                if (screen === 'vibe') {
                    // Go to destination first
                    switchScreen('destination');
                } else {
                    switchScreen(screen);
                }
                updateNavActive(screen);
            }
        });
    });

    // Quick actions on home
    document.querySelectorAll('.quick-action').forEach(action => {
        action.addEventListener('click', () => {
            const target = action.dataset.action;
            if (target === 'route') {
                switchScreen('destination');
                updateNavActive('vibe');
            } else if (target === 'map') {
                switchScreen('map');
                updateNavActive('map');
            } else if (target === 'preferences') {
                switchScreen('preferences');
            }
        });
    });

    // Back buttons
    document.querySelectorAll('.back-btn, .back-btn-small').forEach(btn => {
        btn.addEventListener('click', () => {
            const backTo = btn.dataset.back;
            if (backTo) {
                switchScreen(backTo);
                if (backTo === 'home') updateNavActive('home');
                else if (backTo === 'destination') updateNavActive('vibe');
                else if (backTo === 'vibe') updateNavActive('vibe');
                else if (backTo === 'routeBuilder') updateNavActive('vibe');
            }
        });
    });

    // Destination items
    document.querySelectorAll('.destination-item').forEach(item => {
        item.addEventListener('click', () => {
            const dest = item.dataset.destination;
            if (dest) {
                state.selectedDestination = dest;
                updateDestinationDisplay();
                switchScreen('routeBuilder'); // Go to route builder first
            }
        });
    });

    // Destination input
    const destInput = document.getElementById('destinationInput');
    if (destInput) {
        destInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && destInput.value.trim()) {
                state.selectedDestination = destInput.value.trim();
                updateDestinationDisplay();
                switchScreen('routeBuilder');
            }
        });
    }

    // Phone vibe selection
    document.querySelectorAll('.vibe-card-phone').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.vibe-card-phone').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            state.selectedVibe = card.dataset.vibe;
            updateVibeDisplay();
            updateCustomizationsDisplay();
            updateExplorerModeUI();

            setTimeout(() => {
                switchScreen('map');
                updateNavActive('map');
                setTimeout(() => initPhoneMap(), 100);
            }, 300);
        });
    });

    // Start route button
    const startBtn = document.querySelector('.start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            switchScreen('nav');
            updateNavActive('nav');
            setTimeout(() => initNavMap(), 100);
        });
    }

    // End navigation button
    const endNavBtn = document.getElementById('endNavBtn');
    if (endNavBtn) {
        endNavBtn.addEventListener('click', () => {
            switchScreen('home');
            updateNavActive('home');
        });
    }

    // Trip items (recent drives)
    document.querySelectorAll('.trip-item').forEach(trip => {
        trip.addEventListener('click', () => {
            const tripVibe = trip.dataset.vibe;
            if (tripVibe) {
                state.selectedVibe = tripVibe;
                updateVibeDisplay();
            }
            switchScreen('map');
            updateNavActive('map');
            setTimeout(() => initPhoneMap(), 100);
        });
    });
}

// Update nav active state
function updateNavActive(screen) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const activeItem = document.querySelector(`.nav-item[data-screen="${screen}"]`);
    if (activeItem) activeItem.classList.add('active');
}

// Screen switching
function switchScreen(screenId) {
    const currentEl = document.querySelector('.app-screen.active');
    const nextEl = document.getElementById(`${screenId}Screen`);

    if (!nextEl || currentEl === nextEl) return;

    state.previousScreen = state.currentScreen;

    if (currentEl) {
        currentEl.classList.add('prev');
        currentEl.classList.remove('active');
    }

    setTimeout(() => {
        if (currentEl) currentEl.classList.remove('prev');
        nextEl.classList.add('active');
        state.currentScreen = screenId;

        // Initialize map canvases when needed
        if (screenId === 'map') {
            setTimeout(() => initPhoneMap(), 50);
        } else if (screenId === 'nav') {
            setTimeout(() => initNavMap(), 50);
        }
    }, 100);
}

// Update destination display
function updateDestinationDisplay() {
    const destText = document.getElementById('selectedDestText');
    if (destText) {
        destText.textContent = state.selectedDestination;
    }

    const routeBuilderDest = document.getElementById('routeBuilderDestText');
    if (routeBuilderDest) {
        routeBuilderDest.textContent = state.selectedDestination;
    }

    const mapSearch = document.getElementById('mapSearchInput');
    if (mapSearch) {
        mapSearch.value = state.selectedDestination;
    }
}

// Update vibe displays
function updateVibeDisplay() {
    const vibe = vibes[state.selectedVibe];
    const route = routes[state.selectedVibe];
    if (!vibe || !route) return;

    // Update current vibe name
    document.querySelectorAll('.current-vibe-name').forEach(el => {
        el.textContent = vibe.name;
    });
    document.querySelectorAll('.current-vibe-icon').forEach(el => {
        el.textContent = vibe.icon;
    });

    // Update route preview
    document.querySelectorAll('.route-preview-name').forEach(el => el.textContent = route.name);
    document.querySelectorAll('.route-preview-type').forEach(el => el.textContent = route.type);
    document.querySelectorAll('.route-preview-time').forEach(el => el.textContent = route.time === '??' ? '?? m' : route.time + 'm');
    document.querySelectorAll('.route-preview-distance').forEach(el => el.textContent = route.distance + ' mi');

    // Update Perception Label
    const perceptionEl = document.querySelector('.route-perception');
    if (perceptionEl) {
        perceptionEl.textContent = route.perception;
        perceptionEl.style.color = vibe.color;
    }

    // Update highlights
    const highlightsContainer = document.querySelector('.route-preview-highlights');
    if (highlightsContainer) {
        highlightsContainer.innerHTML = route.highlights.map(h =>
            `<span class="highlight-item">${h}</span>`
        ).join('');
    }

    // Update vibe cards selection
    document.querySelectorAll('.vibe-card-phone').forEach(card => {
        card.classList.toggle('selected', card.dataset.vibe === state.selectedVibe);
    });

    // Update customizations display
    updateCustomizationsDisplay();
    updateExplorerModeUI();
}

// ============================================
// CANVAS RENDERING
// ============================================

function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Phone Map
function initPhoneMap() {
    const canvas = document.getElementById('phoneMapCanvas');
    if (!canvas) return;

    const container = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = container.offsetWidth * dpr;
    canvas.height = container.offsetHeight * dpr;
    canvas.style.width = container.offsetWidth + 'px';
    canvas.style.height = container.offsetHeight + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    drawPhoneMap(ctx, container.offsetWidth, container.offsetHeight);
}

function drawPhoneMap(ctx, width, height) {
    // Background
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, width, height);

    const vibe = vibes[state.selectedVibe];

    // Explorer Mode (Adventure with toggle on) - Minimalist UI
    if (state.selectedVibe === 'adventure' && state.explorerMode) {
        // No grid, no route line - just destination direction

        // Draw large faint compass ring
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, width * 0.3, 0, Math.PI * 2);
        ctx.stroke();

        // Draw N/S/E/W markers
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.font = '14px Outfit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('N', width / 2, height / 2 - width * 0.35);
        ctx.fillText('S', width / 2, height / 2 + width * 0.35);
        ctx.fillText('E', width / 2 + width * 0.35, height / 2);
        ctx.fillText('W', width / 2 - width * 0.35, height / 2);

        // Draw destination direction arrow
        const routePoints = getRoutePoints(state.selectedVibe, width, height);
        const dest = routePoints[routePoints.length - 1];
        const start = routePoints[0];

        const angle = Math.atan2(dest.y - start.y, dest.x - start.x);

        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.rotate(angle);

        // Draw Arrow
        ctx.fillStyle = vibe.color;
        ctx.beginPath();
        ctx.moveTo(40, 0);
        ctx.lineTo(-15, 18);
        ctx.lineTo(-5, 0);
        ctx.lineTo(-15, -18);
        ctx.closePath();
        ctx.shadowColor = vibe.color;
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.restore();

        // Draw "Find your way" text
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.font = '16px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('Find your own path', width / 2, height * 0.85);

        // Draw destination marker only
        drawMarker(ctx, dest.x, dest.y, '#9b5de5', false);

        // Draw user position dot
        ctx.fillStyle = vibe.color;
        ctx.beginPath();
        ctx.arc(width * 0.12, height * 0.78, 8, 0, Math.PI * 2);
        ctx.fill();

        return;
    }

    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 25) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    for (let y = 0; y < height; y += 25) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    const pois = pointsOfInterest[state.selectedVibe] || [];

    // Draw POIs
    pois.forEach((poi, i) => {
        const px = width * poi.x;
        const py = height * poi.y;
        drawPOI(ctx, px, py, vibe.color, poi.icon);
    });

    // Draw route
    const color = vibe.color;
    const routePoints = getRoutePoints(state.selectedVibe, width, height);

    drawRoute(ctx, routePoints, color);
    drawMarker(ctx, routePoints[0].x, routePoints[0].y, color, true);
    drawMarker(ctx, routePoints[routePoints.length - 1].x, routePoints[routePoints.length - 1].y, '#9b5de5', false);
}

function getRoutePoints(vibeType, width, height) {
    switch (vibeType) {
        case 'fastest':
            return [
                { x: width * 0.12, y: height * 0.78 },
                { x: width * 0.35, y: height * 0.55 },
                { x: width * 0.6, y: height * 0.35 },
                { x: width * 0.88, y: height * 0.18 }
            ];
        case 'scenic':
            return [
                { x: width * 0.12, y: height * 0.78 },
                { x: width * 0.2, y: height * 0.45 },
                { x: width * 0.45, y: height * 0.55 },
                { x: width * 0.55, y: height * 0.35 },
                { x: width * 0.75, y: height * 0.25 },
                { x: width * 0.88, y: height * 0.18 }
            ];
        case 'adventure':
            return [
                { x: width * 0.12, y: height * 0.78 },
                { x: width * 0.25, y: height * 0.6 },
                { x: width * 0.35, y: height * 0.5 },
                { x: width * 0.5, y: height * 0.55 },
                { x: width * 0.65, y: height * 0.4 },
                { x: width * 0.75, y: height * 0.3 },
                { x: width * 0.88, y: height * 0.18 }
            ];
        default: // chill
            return [
                { x: width * 0.12, y: height * 0.78 },
                { x: width * 0.3, y: height * 0.6 },
                { x: width * 0.5, y: height * 0.45 },
                { x: width * 0.7, y: height * 0.32 },
                { x: width * 0.88, y: height * 0.18 }
            ];
    }
}

function drawPOI(ctx, x, y, color, icon) {
    // Glow
    ctx.fillStyle = hexToRgba(color, 0.2);
    ctx.beginPath();
    ctx.arc(x, y, 28, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = hexToRgba(color, 0.4);
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();

    // Icon background
    ctx.fillStyle = hexToRgba(color, 0.8);
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();

    // Icon
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, x, y);
}

function drawRoute(ctx, points, color) {
    if (points.length < 2) return;

    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);

    for (let i = 1; i < points.length - 1; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);

    ctx.shadowColor = color;
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.shadowBlur = 0;
}

function drawMarker(ctx, x, y, color, isStart) {
    ctx.fillStyle = hexToRgba(color, 0.3);
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#0a0a10';
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fill();
}

// Nav Map
function initNavMap() {
    const canvas = document.getElementById('navMapCanvas');
    if (!canvas) return;

    const container = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;

    canvas.width = container.offsetWidth * dpr;
    canvas.height = container.offsetHeight * dpr;
    canvas.style.width = container.offsetWidth + 'px';
    canvas.style.height = container.offsetHeight + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const width = container.offsetWidth;
    const height = container.offsetHeight;
    const vibe = vibes[state.selectedVibe];

    // Background
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, width, height);

    // Explorer Mode (Adventure with toggle on) - Active Navigation
    if (state.selectedVibe === 'adventure' && state.explorerMode) {
        // Draw spinning compass ring
        const time = Date.now() / 1000;

        ctx.save();
        ctx.translate(width / 2, height * 0.5);

        // Outer ring
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, width * 0.35, 0, Math.PI * 2);
        ctx.stroke();

        // Compass markers
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = '16px Outfit';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('N', 0, -width * 0.4);

        // Direction arrow (wobbling slightly)
        ctx.rotate(Math.sin(time * 0.5) * 0.1 - 0.5);

        ctx.fillStyle = vibe.color;
        ctx.beginPath();
        ctx.moveTo(0, -60);
        ctx.lineTo(25, 25);
        ctx.lineTo(0, 12);
        ctx.lineTo(-25, 25);
        ctx.closePath();
        ctx.shadowColor = vibe.color;
        ctx.shadowBlur = 25;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.restore();

        // Distance hint
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.font = '24px Space Mono';
        ctx.textAlign = 'center';
        ctx.fillText('~0.8 mi', width / 2, height * 0.85);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = '14px Outfit';
        ctx.fillText('to destination', width / 2, height * 0.9);

        // Update nav text override
        const navText = document.querySelector('.nav-text h3');
        if (navText) navText.textContent = "Head towards the destination";
        const navSub = document.querySelector('.nav-text p');
        if (navSub) navSub.textContent = "Trust your instincts";

        return;
    }

    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    for (let x = 0; x < width; x += 30) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
    for (let y = 0; y < height; y += 30) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    // Road
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 35;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(width / 2, height);
    ctx.lineTo(width / 2, height * 0.4);
    ctx.bezierCurveTo(width / 2, height * 0.3, width * 0.65, height * 0.2, width * 0.85, height * 0.08);
    ctx.stroke();

    // Route line
    ctx.strokeStyle = vibe.color;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(width / 2, height);
    ctx.lineTo(width / 2, height * 0.4);
    ctx.bezierCurveTo(width / 2, height * 0.3, width * 0.65, height * 0.2, width * 0.85, height * 0.08);
    ctx.shadowColor = vibe.color;
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Position marker (car icon triangle)
    ctx.fillStyle = vibe.color;
    ctx.beginPath();
    ctx.moveTo(width / 2, height * 0.56);
    ctx.lineTo(width / 2 - 14, height * 0.56 + 24);
    ctx.lineTo(width / 2 + 14, height * 0.56 + 24);
    ctx.closePath();
    ctx.shadowColor = vibe.color;
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.shadowBlur = 0;
}

// Live Updates
function startLiveUpdates() {
    setInterval(() => {
        state.cityPulse.traffic = Math.round(Math.min(99, Math.max(20, state.cityPulse.traffic + (Math.random() - 0.5) * 10)));
        state.cityPulse.events = Math.round(Math.min(25, Math.max(2, state.cityPulse.events + (Math.random() - 0.5) * 3)));
        state.cityPulse.weather = Math.round(Math.min(99, Math.max(60, state.cityPulse.weather + (Math.random() - 0.5) * 5)));

        document.querySelectorAll('.pulse-traffic-value').forEach(el => el.textContent = state.cityPulse.traffic);
        document.querySelectorAll('.pulse-events-value').forEach(el => el.textContent = state.cityPulse.events);
        document.querySelectorAll('.pulse-weather-value').forEach(el => el.textContent = state.cityPulse.weather + '%');
    }, 3000);
}

// Handle resize
window.addEventListener('resize', () => {
    if (state.currentScreen === 'map') {
        setTimeout(() => initPhoneMap(), 100);
    } else if (state.currentScreen === 'nav') {
        setTimeout(() => initNavMap(), 100);
    }
});

// Handle orientation change
window.addEventListener('orientationchange', () => {
    setTimeout(() => {
        if (state.currentScreen === 'map') initPhoneMap();
        else if (state.currentScreen === 'nav') initNavMap();
    }, 300);
});
