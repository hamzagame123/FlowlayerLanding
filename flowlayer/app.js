// FlowLayer - Mobile Emotional Routing App
// =========================================

// State Management
const state = {
    currentScreen: 'home',
    previousScreen: 'home',
    selectedVibe: 'chill',
    selectedDestination: 'Golden Gate Bridge',
    cityPulse: {
        traffic: 42,
        events: 8,
        weather: 92
    }
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
        highlights: ['🛣️ Highway merge', '💨 Express lane', '🏁 Quick arrival']
    },
    chill: {
        name: 'Riverside Drive',
        type: 'Easy & Chill',
        time: 22,
        distance: 6.8,
        highlights: ['🛣️ No highways', '↔️ Wide lanes', '🚦 3 lights']
    },
    scenic: {
        name: 'Lakefront Parkway',
        type: 'Scenic Route',
        time: 35,
        distance: 12.4,
        highlights: ['🏞️ Lake views', '🌉 Bridge view', '🌲 Forest road']
    },
    adventure: {
        name: 'Downtown Loop',
        type: 'Adventure Route',
        time: 28,
        distance: 9.1,
        highlights: ['🎪 Neon District', '🎸 Music Row', '🎢 The Twist']
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

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('FlowLayer Mobile initializing...');
    initTime();
    initEventListeners();
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

// Event Listeners
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
                switchScreen('vibe');
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
                switchScreen('vibe');
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
    document.querySelectorAll('.route-preview-time').forEach(el => el.textContent = route.time + 'm');
    document.querySelectorAll('.route-preview-distance').forEach(el => el.textContent = route.distance + ' mi');
    
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
    
    const vibe = vibes[state.selectedVibe];
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
    drawMarker(ctx, routePoints[routePoints.length-1].x, routePoints[routePoints.length-1].y, '#9b5de5', false);
}

function getRoutePoints(vibeType, width, height) {
    switch(vibeType) {
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
    ctx.lineTo(points[points.length-1].x, points[points.length-1].y);
    
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
