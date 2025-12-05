// FlowLayer - Real-Time Emotional Routing App
// ============================================

// State Management
const state = {
    currentScreen: 'home',
    selectedVibe: 'chill',
    activeOverlays: ['scenic', 'adventure'],
    highwayElements: ['ev-lane', 'bike-lane', 'wildlife'],
    cityPulse: {
        traffic: 42,
        events: 8,
        weather: 92,
        vibe: 78
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

// Routes data - now matching the 4 types
const routes = [
    {
        id: 1,
        name: 'Highway 101 Express',
        type: 'Fastest Route',
        vibe: 'fastest',
        color: '#ff9f1c',
        time: 12,
        distance: 8.2,
        highlights: ['Highway merge', '2 toll roads', 'Express lane'],
        tags: ['Direct path', 'Minimal stops', 'Highway focused']
    },
    {
        id: 2,
        name: 'Riverside Drive',
        type: 'Easy & Chill',
        vibe: 'chill',
        color: '#00f5d4',
        time: 22,
        distance: 6.8,
        highlights: ['No highways', 'Wide lanes', '3 traffic lights'],
        tags: ['Smooth roads', 'Easy turns', 'Low stress']
    },
    {
        id: 3,
        name: 'Lakefront Parkway',
        type: 'Scenic Route',
        vibe: 'scenic',
        color: '#06d6a0',
        time: 35,
        distance: 12.4,
        highlights: ['Crystal Lake views', 'Golden Gate overlook', 'Redwood forest'],
        tags: ['Lake views', 'Bridge crossing', 'Nature']
    },
    {
        id: 4,
        name: 'Downtown Loop',
        type: 'Adventure Route',
        vibe: 'adventure',
        color: '#f72585',
        time: 28,
        distance: 9.1,
        highlights: ['Neon District', 'The Twist curves', 'Rooftop bar row'],
        tags: ['Nightlife', 'Landmarks', 'Winding roads']
    }
];

// Points of Interest for the map
const pointsOfInterest = {
    scenic: [
        { x: 0.2, y: 0.3, icon: '🏞️', name: 'Crystal Lake' },
        { x: 0.7, y: 0.2, icon: '🌉', name: 'Golden Gate View' },
        { x: 0.5, y: 0.6, icon: '🌲', name: 'Redwood Grove' },
        { x: 0.85, y: 0.5, icon: '🌅', name: 'Sunset Point' }
    ],
    adventure: [
        { x: 0.3, y: 0.5, icon: '🎪', name: 'Neon District' },
        { x: 0.6, y: 0.4, icon: '🎸', name: 'Live Music Row' },
        { x: 0.4, y: 0.7, icon: '🍸', name: 'Rooftop Bars' },
        { x: 0.75, y: 0.65, icon: '🎭', name: 'Theater Quarter' }
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

// AI Predictions
const predictions = {
    fastest: { 
        emoji: '🏎️', 
        label: 'Speed Demon', 
        desc: 'Buckle up! This route hits the highway and doesn\'t look back. Expect 85% highway driving with 2 quick exits.',
        eta: '12 min',
        confidence: 96 
    },
    chill: { 
        emoji: '😌', 
        label: 'Zen Mode', 
        desc: 'Smooth sailing ahead. Wide lanes, gentle turns, and zero highway stress. Perfect for unwinding after a long day.',
        eta: '22 min',
        confidence: 94 
    },
    scenic: { 
        emoji: '🌅', 
        label: 'Picture Perfect', 
        desc: 'Get your camera ready! You\'ll pass Crystal Lake, cross the famous Golden Gate viewpoint, and wind through redwood forests.',
        eta: '35 min',
        confidence: 91 
    },
    adventure: { 
        emoji: '🎉', 
        label: 'Thrill Seeker', 
        desc: 'This route takes you through the Neon District, past the hottest clubs, and includes "The Twist" - 12 consecutive curves!',
        eta: '28 min',
        confidence: 89 
    }
};

// Highway elements for future mode
const highwayElements = [
    { id: 'ev-lane', name: 'EV Smart Lane', icon: '🚗', color: '#4361ee', desc: 'Automated vehicles' },
    { id: 'bike-lane', name: 'Walk/Bike Lane', icon: '🚴', color: '#06d6a0', desc: 'Protected mobility' },
    { id: 'drone-lane', name: 'Drone Delivery', icon: '🛸', color: '#ff9f1c', desc: 'Aerial logistics' },
    { id: 'wildlife', name: 'Wildlife Bridge', icon: '🦌', color: '#9b5de5', desc: 'Habitat corridors' },
    { id: 'charging', name: 'Charging Forest', icon: '🌲', color: '#00f5d4', desc: 'Energy gardens' },
    { id: 'calm-zone', name: 'Rest Sanctuary', icon: '🧘', color: '#f72585', desc: 'Mental health zones' }
];

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    console.log('FlowLayer initializing...');
    initTime();
    initEventListeners();
    renderVibeOptions();
    renderRouteOptions();
    renderHighwayElements();
    updateAIPrediction();
    
    setTimeout(() => {
        initCityMap();
        initPhoneMap();
        initHighwayCanvas();
        startLiveUpdates();
    }, 100);
    
    console.log('FlowLayer ready!');
});

// Time display
function initTime() {
    const updateTime = () => {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const time12 = hours > 12 ? hours - 12 : (hours === 0 ? 12 : hours);
        const ampm = hours >= 12 ? 'PM' : 'AM';
        
        document.querySelectorAll('.time-display').forEach(el => {
            el.textContent = `${time12}:${minutes} ${ampm}`;
        });
        
        document.querySelectorAll('.phone-time').forEach(el => {
            el.textContent = `${time12}:${minutes}`;
        });
        
        const greetingEl = document.querySelector('.greeting-time');
        if (greetingEl) {
            if (hours < 12) greetingEl.textContent = 'Good Morning';
            else if (hours < 17) greetingEl.textContent = 'Good Afternoon';
            else greetingEl.textContent = 'Good Evening';
        }
    };
    
    updateTime();
    setInterval(updateTime, 1000);
}

// Event Listeners
function initEventListeners() {
    // Phone navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const screen = item.dataset.screen;
            if (screen) {
                switchScreen(screen);
                document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
                item.classList.add('active');
            }
        });
    });
    
    // Quick actions
    document.querySelectorAll('.quick-action').forEach(action => {
        action.addEventListener('click', () => {
            const target = action.dataset.action;
            if (target === 'route') switchScreen('vibe');
            else if (target === 'map') switchScreen('map');
        });
    });
    
    // Phone vibe selection
    document.querySelectorAll('.vibe-card-phone').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.vibe-card-phone').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            state.selectedVibe = card.dataset.vibe;
            updateVibeDisplay();
            updateAIPrediction();
            initCityMap();
            initPhoneMap();
            setTimeout(() => switchScreen('map'), 400);
        });
    });
    
    // Dashboard vibe options
    document.addEventListener('click', (e) => {
        const vibeOption = e.target.closest('.vibe-option');
        if (vibeOption) {
            document.querySelectorAll('.vibe-option').forEach(o => o.classList.remove('active'));
            vibeOption.classList.add('active');
            state.selectedVibe = vibeOption.dataset.vibe;
            updateVibeDisplay();
            updateAIPrediction();
            initCityMap();
        }
    });
    
    // Route options
    document.addEventListener('click', (e) => {
        const routeOption = e.target.closest('.route-option');
        if (routeOption) {
            document.querySelectorAll('.route-option').forEach(o => o.classList.remove('selected'));
            routeOption.classList.add('selected');
            const routeVibe = routeOption.dataset.vibe;
            if (routeVibe) {
                state.selectedVibe = routeVibe;
                updateVibeDisplay();
                updateAIPrediction();
                initCityMap();
            }
        }
    });
    
    // Highway elements
    document.addEventListener('click', (e) => {
        const hwElement = e.target.closest('.highway-element');
        if (hwElement) {
            hwElement.classList.toggle('active');
            const id = hwElement.dataset.element;
            if (state.highwayElements.includes(id)) {
                state.highwayElements = state.highwayElements.filter(el => el !== id);
            } else {
                state.highwayElements.push(id);
            }
            updateHighwayScores();
            initHighwayCanvas();
        }
    });
    
    // Overlay toggles
    document.querySelectorAll('.overlay-toggle').forEach(toggle => {
        toggle.addEventListener('click', () => {
            toggle.classList.toggle('active');
            initPhoneMap();
        });
    });
    
    // Start route button
    const startBtn = document.querySelector('.start-btn');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            switchScreen('nav');
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.querySelector('.nav-item[data-screen="nav"]')?.classList.add('active');
        });
    }
    
    // Trip items
    document.querySelectorAll('.trip-item').forEach(trip => {
        trip.addEventListener('click', () => {
            const tripVibe = trip.dataset.vibe;
            if (tripVibe) {
                state.selectedVibe = tripVibe;
                updateVibeDisplay();
            }
            switchScreen('map');
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            document.querySelector('.nav-item[data-screen="map"]')?.classList.add('active');
        });
    });
}

// Screen switching
function switchScreen(screenId) {
    const currentEl = document.querySelector('.app-screen.active');
    const nextEl = document.getElementById(`${screenId}Screen`);
    
    if (!nextEl || currentEl === nextEl) return;
    
    if (currentEl) {
        currentEl.classList.add('prev');
        currentEl.classList.remove('active');
    }
    
    setTimeout(() => {
        if (currentEl) currentEl.classList.remove('prev');
        nextEl.classList.add('active');
        state.currentScreen = screenId;
        
        if (screenId === 'map') setTimeout(() => initPhoneMap(), 50);
        else if (screenId === 'nav') setTimeout(() => initNavMap(), 50);
    }, 150);
}

// Update displays
function updateVibeDisplay() {
    const vibe = vibes[state.selectedVibe];
    if (!vibe) return;
    
    document.querySelectorAll('.current-vibe-name').forEach(el => {
        el.textContent = vibe.name;
    });
    document.querySelectorAll('.current-vibe-icon').forEach(el => {
        el.textContent = vibe.icon;
    });
    
    // Update route preview
    const route = routes.find(r => r.vibe === state.selectedVibe);
    if (route) {
        document.querySelectorAll('.route-preview-name').forEach(el => el.textContent = route.name);
        document.querySelectorAll('.route-preview-type').forEach(el => el.textContent = route.type);
        document.querySelectorAll('.route-preview-time').forEach(el => el.textContent = route.time + 'm');
        document.querySelectorAll('.route-preview-distance').forEach(el => el.textContent = route.distance + ' mi');
    }
    
    document.querySelectorAll('.vibe-card-phone').forEach(card => {
        card.classList.toggle('selected', card.dataset.vibe === state.selectedVibe);
    });
    
    document.querySelectorAll('.vibe-option').forEach(opt => {
        opt.classList.toggle('active', opt.dataset.vibe === state.selectedVibe);
    });
}

// Update AI Prediction
function updateAIPrediction() {
    const pred = predictions[state.selectedVibe];
    const content = document.querySelector('.prediction-content');
    if (!content || !pred) return;
    
    content.innerHTML = `
        <div class="prediction-vibe">${pred.emoji}</div>
        <div class="prediction-label">${pred.label}</div>
        <div class="prediction-eta">ETA: <strong>${pred.eta}</strong></div>
        <p class="prediction-desc">${pred.desc}</p>
        <div class="prediction-confidence">
            <div class="confidence-bar">
                <div class="confidence-fill" style="width: ${pred.confidence}%"></div>
            </div>
            <span class="confidence-text">${pred.confidence}% match</span>
        </div>
    `;
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

// City Map
function initCityMap() {
    const canvas = document.getElementById('cityMap');
    if (!canvas) return;
    
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    
    drawCityMap(ctx, rect.width, rect.height);
}

function drawCityMap(ctx, width, height) {
    // Background
    ctx.fillStyle = '#0a0a10';
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
    
    // Streets
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 3;
    [0.25, 0.5, 0.75].forEach(r => {
        ctx.beginPath();
        ctx.moveTo(0, height * r);
        ctx.lineTo(width, height * r);
        ctx.stroke();
    });
    [0.2, 0.4, 0.6, 0.8].forEach(r => {
        ctx.beginPath();
        ctx.moveTo(width * r, 0);
        ctx.lineTo(width * r, height);
        ctx.stroke();
    });
    
    const vibe = vibes[state.selectedVibe];
    const pois = pointsOfInterest[state.selectedVibe] || [];
    
    // Draw POIs for current vibe
    pois.forEach(poi => {
        drawPOI(ctx, width * poi.x, height * poi.y, vibe.color, poi.icon, poi.name);
    });
    
    // Draw route based on vibe
    const routeColor = vibe.color;
    let routePoints;
    
    if (state.selectedVibe === 'fastest') {
        // Straight highway route
        routePoints = [
            { x: width * 0.1, y: height * 0.85 },
            { x: width * 0.3, y: height * 0.6 },
            { x: width * 0.5, y: height * 0.4 },
            { x: width * 0.7, y: height * 0.25 },
            { x: width * 0.9, y: height * 0.15 }
        ];
    } else if (state.selectedVibe === 'scenic') {
        // Curvy scenic route passing lakes and viewpoints
        routePoints = [
            { x: width * 0.1, y: height * 0.85 },
            { x: width * 0.2, y: height * 0.4 }, // Near lake
            { x: width * 0.4, y: height * 0.55 },
            { x: width * 0.55, y: height * 0.65 }, // Through forest
            { x: width * 0.75, y: height * 0.3 }, // Near bridge view
            { x: width * 0.9, y: height * 0.15 }
        ];
    } else if (state.selectedVibe === 'adventure') {
        // Winding route through exciting areas
        routePoints = [
            { x: width * 0.1, y: height * 0.85 },
            { x: width * 0.25, y: height * 0.6 },
            { x: width * 0.35, y: height * 0.55 }, // Neon district
            { x: width * 0.5, y: height * 0.45 },
            { x: width * 0.65, y: height * 0.5 }, // Music row
            { x: width * 0.75, y: height * 0.35 },
            { x: width * 0.9, y: height * 0.15 }
        ];
    } else {
        // Chill - smooth easy route
        routePoints = [
            { x: width * 0.1, y: height * 0.85 },
            { x: width * 0.25, y: height * 0.7 },
            { x: width * 0.4, y: height * 0.55 },
            { x: width * 0.6, y: height * 0.4 },
            { x: width * 0.75, y: height * 0.3 },
            { x: width * 0.9, y: height * 0.15 }
        ];
    }
    
    drawRoute(ctx, routePoints, routeColor);
    
    // Markers
    drawMarker(ctx, routePoints[0].x, routePoints[0].y, routeColor, true);
    drawMarker(ctx, routePoints[routePoints.length-1].x, routePoints[routePoints.length-1].y, '#9b5de5', false);
}

function drawPOI(ctx, x, y, color, icon, name) {
    // Glow
    ctx.fillStyle = hexToRgba(color, 0.2);
    ctx.beginPath();
    ctx.arc(x, y, 35, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = hexToRgba(color, 0.4);
    ctx.beginPath();
    ctx.arc(x, y, 20, 0, Math.PI * 2);
    ctx.fill();
    
    // Icon background
    ctx.fillStyle = hexToRgba(color, 0.8);
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
    
    // Icon
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, x, y);
    
    // Label
    ctx.font = '10px Outfit';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(name, x, y + 25);
}

function drawRoute(ctx, points, color) {
    if (points.length < 2) return;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
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
    ctx.arc(x, y, 14, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#0a0a10';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
}

// Phone Map
function initPhoneMap() {
    const canvas = document.getElementById('phoneMapCanvas');
    if (!canvas) return;
    
    const container = canvas.parentElement;
    canvas.width = container.offsetWidth * 2;
    canvas.height = container.offsetHeight * 2;
    canvas.style.width = container.offsetWidth + 'px';
    canvas.style.height = container.offsetHeight + 'px';
    
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    
    drawPhoneMap(ctx, container.offsetWidth, container.offsetHeight);
}

function drawPhoneMap(ctx, width, height) {
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, width, height);
    
    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 20) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 20) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    
    const vibe = vibes[state.selectedVibe];
    const pois = pointsOfInterest[state.selectedVibe] || [];
    
    // Draw some POIs
    pois.slice(0, 3).forEach((poi, i) => {
        const px = 50 + (i * 80);
        const py = height * 0.35 + (i % 2 === 0 ? 0 : 50);
        drawPOI(ctx, px, py, vibe.color, poi.icon, '');
    });
    
    // Route
    const color = vibe.color;
    const routePoints = [
        { x: 35, y: height * 0.72 },
        { x: 80, y: height * 0.55 },
        { x: 140, y: height * 0.4 },
        { x: 200, y: height * 0.3 },
        { x: width - 55, y: height * 0.18 }
    ];
    
    drawRoute(ctx, routePoints, color);
    drawMarker(ctx, routePoints[0].x, routePoints[0].y, color, true);
    drawMarker(ctx, routePoints[routePoints.length-1].x, routePoints[routePoints.length-1].y, '#9b5de5', false);
}

// Nav Map
function initNavMap() {
    const canvas = document.getElementById('navMapCanvas');
    if (!canvas) return;
    
    const container = canvas.parentElement;
    canvas.width = container.offsetWidth * 2;
    canvas.height = container.offsetHeight * 2;
    canvas.style.width = container.offsetWidth + 'px';
    canvas.style.height = container.offsetHeight + 'px';
    
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    
    const width = container.offsetWidth;
    const height = container.offsetHeight;
    const vibe = vibes[state.selectedVibe];
    
    ctx.fillStyle = '#050508';
    ctx.fillRect(0, 0, width, height);
    
    // Grid
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    for (let x = 0; x < width; x += 25) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = 0; y < height; y += 25) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    
    // Road
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 28;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(width / 2, height);
    ctx.lineTo(width / 2, height * 0.4);
    ctx.bezierCurveTo(width / 2, height * 0.3, width * 0.65, height * 0.2, width * 0.85, height * 0.08);
    ctx.stroke();
    
    // Route line
    ctx.strokeStyle = vibe.color;
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(width / 2, height);
    ctx.lineTo(width / 2, height * 0.4);
    ctx.bezierCurveTo(width / 2, height * 0.3, width * 0.65, height * 0.2, width * 0.85, height * 0.08);
    ctx.shadowColor = vibe.color;
    ctx.shadowBlur = 15;
    ctx.stroke();
    ctx.shadowBlur = 0;
    
    // Position marker
    ctx.fillStyle = vibe.color;
    ctx.beginPath();
    ctx.moveTo(width / 2, height * 0.58);
    ctx.lineTo(width / 2 - 12, height * 0.58 + 20);
    ctx.lineTo(width / 2 + 12, height * 0.58 + 20);
    ctx.closePath();
    ctx.shadowColor = vibe.color;
    ctx.shadowBlur = 15;
    ctx.fill();
    ctx.shadowBlur = 0;
}

// Highway Canvas
function initHighwayCanvas() {
    const canvas = document.getElementById('highwayCanvas');
    if (!canvas) return;
    
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();
    
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    
    const ctx = canvas.getContext('2d');
    ctx.scale(2, 2);
    
    drawHighway(ctx, rect.width, rect.height);
}

function drawHighway(ctx, width, height) {
    // Sky
    const skyGradient = ctx.createLinearGradient(0, 0, 0, height);
    skyGradient.addColorStop(0, '#1a0a2e');
    skyGradient.addColorStop(0.4, '#0f0518');
    skyGradient.addColorStop(1, '#050508');
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, width, height);
    
    // Stars
    for (let i = 0; i < 40; i++) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.6 + 0.1})`;
        ctx.beginPath();
        ctx.arc(Math.random() * width, Math.random() * height * 0.35, Math.random() * 1.2 + 0.3, 0, Math.PI * 2);
        ctx.fill();
    }
    
    // Highway base
    ctx.fillStyle = '#1a1a24';
    ctx.beginPath();
    ctx.moveTo(0, height * 0.92);
    ctx.lineTo(width * 0.28, height * 0.5);
    ctx.lineTo(width * 0.72, height * 0.5);
    ctx.lineTo(width, height * 0.92);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();
    
    const active = state.highwayElements;
    
    if (active.includes('ev-lane')) {
        ctx.strokeStyle = '#4361ee';
        ctx.lineWidth = 2;
        ctx.setLineDash([15, 8]);
        ctx.beginPath();
        ctx.moveTo(width * 0.12, height * 0.88);
        ctx.lineTo(width * 0.38, height * 0.54);
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.fillStyle = '#4361ee';
        ctx.shadowColor = '#4361ee';
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.ellipse(width * 0.24, height * 0.72, 12, 6, -0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
    
    if (active.includes('bike-lane')) {
        ctx.fillStyle = hexToRgba('#06d6a0', 0.15);
        ctx.beginPath();
        ctx.moveTo(width * 0.16, height * 0.9);
        ctx.lineTo(width * 0.4, height * 0.52);
        ctx.lineTo(width * 0.44, height * 0.52);
        ctx.lineTo(width * 0.2, height * 0.9);
        ctx.closePath();
        ctx.fill();
        
        ctx.strokeStyle = '#06d6a0';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(width * 0.18, height * 0.88);
        ctx.lineTo(width * 0.42, height * 0.52);
        ctx.stroke();
    }
    
    if (active.includes('wildlife')) {
        ctx.fillStyle = hexToRgba('#9b5de5', 0.25);
        ctx.beginPath();
        ctx.arc(width * 0.5, height * 0.46, 35, 0, Math.PI, true);
        ctx.fill();
        
        ctx.strokeStyle = '#9b5de5';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(width * 0.5, height * 0.46, 35, 0, Math.PI, true);
        ctx.stroke();
        
        drawTree(ctx, width * 0.44, height * 0.38, '#06d6a0');
        drawTree(ctx, width * 0.56, height * 0.38, '#00f5d4');
    }
    
    if (active.includes('charging')) {
        for (let i = 0; i < 4; i++) {
            drawTree(ctx, width * 0.82 + i * 12, height * 0.58 - i * 6, '#00f5d4');
        }
        ctx.fillStyle = '#00f5d4';
        for (let i = 0; i < 8; i++) {
            ctx.globalAlpha = Math.random() * 0.6 + 0.2;
            ctx.beginPath();
            ctx.arc(width * 0.82 + Math.random() * 45, height * 0.48 + Math.random() * 25, 1.5, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
    
    if (active.includes('drone-lane')) {
        ctx.strokeStyle = hexToRgba('#ff9f1c', 0.35);
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 12]);
        ctx.beginPath();
        ctx.moveTo(0, height * 0.22);
        ctx.lineTo(width, height * 0.22);
        ctx.stroke();
        ctx.setLineDash([]);
        
        ctx.fillStyle = '#ff9f1c';
        ctx.shadowColor = '#ff9f1c';
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.moveTo(width * 0.6, height * 0.19);
        ctx.lineTo(width * 0.58, height * 0.22);
        ctx.lineTo(width * 0.62, height * 0.22);
        ctx.closePath();
        ctx.fill();
        ctx.shadowBlur = 0;
    }
    
    if (active.includes('calm-zone')) {
        ctx.fillStyle = hexToRgba('#f72585', 0.18);
        ctx.beginPath();
        ctx.ellipse(width * 0.22, height * 0.76, 38, 22, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#f72585';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.ellipse(width * 0.22, height * 0.76, 38, 22, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
    }
    
    // Road markings
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 2;
    ctx.setLineDash([25, 18]);
    ctx.beginPath();
    ctx.moveTo(width * 0.06, height * 0.94);
    ctx.lineTo(width * 0.5, height * 0.52);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(width * 0.94, height * 0.94);
    ctx.lineTo(width * 0.5, height * 0.52);
    ctx.stroke();
    ctx.setLineDash([]);
}

function drawTree(ctx, x, y, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - 16);
    ctx.lineTo(x - 8, y);
    ctx.lineTo(x + 8, y);
    ctx.closePath();
    ctx.fill();
    
    ctx.fillStyle = '#3d2817';
    ctx.fillRect(x - 2, y, 4, 6);
}

// Highway Scores
function updateHighwayScores() {
    const baseScores = { eco: 40, mobility: 50, emotion: 45, safety: 55 };
    const bonuses = {
        'ev-lane': { mobility: 15, eco: 10 },
        'bike-lane': { eco: 12, mobility: 8, emotion: 5 },
        'drone-lane': { mobility: 10 },
        'wildlife': { eco: 20, emotion: 10 },
        'charging': { eco: 15, emotion: 5 },
        'calm-zone': { emotion: 20, safety: 10 }
    };
    
    const scores = { ...baseScores };
    state.highwayElements.forEach(id => {
        const bonus = bonuses[id];
        if (bonus) {
            Object.keys(bonus).forEach(key => {
                scores[key] = Math.min(99, scores[key] + bonus[key]);
            });
        }
    });
    
    document.querySelectorAll('.highway-score').forEach(el => {
        const type = el.dataset.type;
        const valueEl = el.querySelector('.highway-score-value');
        if (valueEl && scores[type] !== undefined) {
            valueEl.textContent = scores[type];
            valueEl.style.color = scores[type] > 75 ? '#00f5d4' : scores[type] > 55 ? '#ff9f1c' : '#ef476f';
        }
    });
}

// Render Functions
function renderVibeOptions() {
    const container = document.querySelector('.vibe-options');
    if (!container) return;
    
    container.innerHTML = Object.entries(vibes).map(([key, vibe]) => `
        <div class="vibe-option ${state.selectedVibe === key ? 'active' : ''}" data-vibe="${key}" style="--vibe-color: ${vibe.color}">
            <div class="vibe-icon">${vibe.icon}</div>
            <div class="vibe-info">
                <h4>${vibe.name}</h4>
                <p>${vibe.words}</p>
            </div>
            <div class="vibe-score" style="color: ${vibe.color}">${vibe.score}m</div>
        </div>
    `).join('');
}

function renderRouteOptions() {
    const container = document.querySelector('.route-options');
    if (!container) return;
    
    container.innerHTML = routes.map((route, i) => `
        <div class="route-option ${route.vibe === state.selectedVibe ? 'selected' : ''}" data-vibe="${route.vibe}" style="--route-color: ${route.color}">
            <div class="route-header">
                <div>
                    <div class="route-name">${route.name}</div>
                    <div class="route-type" style="color: ${route.color}">${route.type}</div>
                </div>
                <div class="route-time">
                    <div class="route-time-value">${route.time}m</div>
                    <div class="route-time-label">${route.distance} mi</div>
                </div>
            </div>
            <div class="route-highlights">
                ${route.highlights.map(h => `<span class="route-highlight">${h}</span>`).join('')}
            </div>
            <div class="route-tags">
                ${route.tags.map(tag => `<span class="route-tag">${tag}</span>`).join('')}
            </div>
        </div>
    `).join('');
}

function renderHighwayElements() {
    const container = document.querySelector('.highway-elements');
    if (!container) return;
    
    container.innerHTML = highwayElements.map(el => `
        <div class="highway-element ${state.highwayElements.includes(el.id) ? 'active' : ''}" data-element="${el.id}" style="--element-color: ${el.color}">
            <div class="element-icon">${el.icon}</div>
            <div class="element-info">
                <div class="element-name">${el.name}</div>
                <div class="element-desc">${el.desc}</div>
            </div>
            <div class="element-toggle"></div>
        </div>
    `).join('');
    
    updateHighwayScores();
}

// Live Updates
function startLiveUpdates() {
    setInterval(() => {
        state.cityPulse.traffic = Math.round(Math.min(99, Math.max(20, state.cityPulse.traffic + (Math.random() - 0.5) * 10)));
        state.cityPulse.events = Math.round(Math.min(25, Math.max(2, state.cityPulse.events + (Math.random() - 0.5) * 3)));
        state.cityPulse.weather = Math.round(Math.min(99, Math.max(60, state.cityPulse.weather + (Math.random() - 0.5) * 5)));
        state.cityPulse.vibe = Math.round(Math.min(99, Math.max(50, state.cityPulse.vibe + (Math.random() - 0.5) * 8)));
        
        document.querySelectorAll('.pulse-traffic-value').forEach(el => el.textContent = state.cityPulse.traffic);
        document.querySelectorAll('.pulse-events-value').forEach(el => el.textContent = state.cityPulse.events);
        document.querySelectorAll('.pulse-weather-value').forEach(el => el.textContent = state.cityPulse.weather + '%');
        document.querySelectorAll('.pulse-vibe-value').forEach(el => el.textContent = state.cityPulse.vibe);
        
        document.querySelectorAll('.pulse-text strong').forEach(el => el.textContent = state.cityPulse.vibe);
        
        const metricValues = document.querySelectorAll('.metric-item .metric-value');
        if (metricValues.length >= 4) {
            metricValues[0].textContent = state.cityPulse.traffic;
            metricValues[1].textContent = state.cityPulse.events;
            metricValues[2].textContent = state.cityPulse.weather + '%';
            metricValues[3].textContent = state.cityPulse.vibe;
        }
    }, 3000);
}

window.addEventListener('resize', () => {
    initCityMap();
    initHighwayCanvas();
    if (state.currentScreen === 'map') initPhoneMap();
    if (state.currentScreen === 'nav') initNavMap();
});
