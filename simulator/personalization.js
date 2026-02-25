// FlowLayer - Personalization Questions System
// =============================================
// 10 questions to understand user preferences for personalized routing

class PersonalizationEngine {
    constructor() {
        this.currentQuestion = 0;
        this.answers = {};
        this.profile = null;
        
        // 10 Personalization questions
        this.questions = [
            {
                id: 'driving_purpose',
                text: 'What brings you to <span>driving</span> today?',
                type: 'options',
                options: [
                    { value: 'relax', icon: '🧘', title: 'Relaxation', desc: 'Unwind and decompress' },
                    { value: 'explore', icon: '🧭', title: 'Exploration', desc: 'Discover new places' },
                    { value: 'focus', icon: '🎯', title: 'Focus Time', desc: 'Clear my head' },
                    { value: 'thrill', icon: '⚡', title: 'Excitement', desc: 'Feel the rush' }
                ]
            },
            {
                id: 'scenic_preference',
                text: 'What does <span>scenic</span> mean to you?',
                type: 'options',
                options: [
                    { value: 'ocean', icon: '🌊', title: 'Ocean & Coast', desc: 'Waves, beaches, sea breeze' },
                    { value: 'mountains', icon: '⛰️', title: 'Mountains', desc: 'Peaks, valleys, elevation' },
                    { value: 'forest', icon: '🌲', title: 'Forests', desc: 'Trees, trails, nature' },
                    { value: 'urban', icon: '🌃', title: 'City Lights', desc: 'Skylines, architecture' }
                ]
            },
            {
                id: 'pace_preference',
                text: 'What <span>pace</span> do you prefer?',
                type: 'options',
                options: [
                    { value: 'slow', icon: '🐢', title: 'Slow & Steady', desc: 'Take your time, enjoy the view' },
                    { value: 'moderate', icon: '🚗', title: 'Moderate', desc: 'Balanced speed and scenery' },
                    { value: 'fast', icon: '🏎️', title: 'Fast', desc: 'Get there with some speed' },
                    { value: 'varied', icon: '🎢', title: 'Mix It Up', desc: 'Variety in pace' }
                ]
            },
            {
                id: 'road_type',
                text: 'What type of <span>roads</span> do you enjoy?',
                type: 'options',
                options: [
                    { value: 'highway', icon: '🛣️', title: 'Open Highways', desc: 'Long, straight, fast' },
                    { value: 'winding', icon: '🔀', title: 'Winding Roads', desc: 'Curves and turns' },
                    { value: 'backroads', icon: '🌾', title: 'Back Roads', desc: 'Hidden paths, less traffic' },
                    { value: 'coastal', icon: '🏖️', title: 'Coastal Drives', desc: 'Along the water' }
                ]
            },
            {
                id: 'time_of_day',
                text: 'When do you prefer to <span>drive</span>?',
                type: 'options',
                options: [
                    { value: 'sunrise', icon: '🌅', title: 'Sunrise', desc: 'Early morning peace' },
                    { value: 'day', icon: '☀️', title: 'Daytime', desc: 'Full visibility' },
                    { value: 'sunset', icon: '🌇', title: 'Sunset', desc: 'Golden hour magic' },
                    { value: 'night', icon: '🌙', title: 'Night', desc: 'City lights and stars' }
                ]
            },
            {
                id: 'traffic_tolerance',
                text: 'How do you feel about <span>traffic</span>?',
                type: 'slider',
                min: 1,
                max: 5,
                minLabel: 'Avoid at all costs',
                maxLabel: 'Doesn\'t bother me',
                default: 3
            },
            {
                id: 'discovery_level',
                text: 'How much do you enjoy <span>discovering</span> new routes?',
                type: 'slider',
                min: 1,
                max: 5,
                minLabel: 'Prefer familiar',
                maxLabel: 'Love surprises',
                default: 3
            },
            {
                id: 'stop_preference',
                text: 'What about <span>stops</span> along the way?',
                type: 'options',
                options: [
                    { value: 'none', icon: '➡️', title: 'No Stops', desc: 'Straight to destination' },
                    { value: 'scenic', icon: '📸', title: 'Photo Spots', desc: 'Scenic viewpoints' },
                    { value: 'food', icon: '☕', title: 'Food & Drinks', desc: 'Cafes, restaurants' },
                    { value: 'attractions', icon: '🎡', title: 'Attractions', desc: 'Points of interest' }
                ]
            },
            {
                id: 'music_vibe',
                text: 'What <span>music</span> fits your driving mood?',
                type: 'options',
                options: [
                    { value: 'chill', icon: '🎧', title: 'Chill & Lo-fi', desc: 'Relaxed beats' },
                    { value: 'energetic', icon: '🎸', title: 'Rock & Energetic', desc: 'Pump up the energy' },
                    { value: 'classical', icon: '🎻', title: 'Classical', desc: 'Timeless elegance' },
                    { value: 'none', icon: '🔇', title: 'Silence', desc: 'Just the road sounds' }
                ]
            },
            {
                id: 'companion_preference',
                text: 'How do you usually <span>drive</span>?',
                type: 'options',
                options: [
                    { value: 'solo', icon: '👤', title: 'Solo', desc: 'Just me and the road' },
                    { value: 'partner', icon: '👥', title: 'With a Partner', desc: 'Sharing the experience' },
                    { value: 'family', icon: '👨‍👩‍👧', title: 'Family', desc: 'All together' },
                    { value: 'friends', icon: '🎉', title: 'Friends', desc: 'Road trip crew' }
                ]
            }
        ];
    }
    
    init() {
        this.loadProfile();
        this.renderQuestion();
        this.setupEventListeners();
    }
    
    loadProfile() {
        const saved = localStorage.getItem('flowlayer_profile');
        if (saved) {
            try {
                this.profile = JSON.parse(saved);
                this.answers = this.profile.answers || {};
            } catch (e) {
                this.profile = null;
            }
        }
    }
    
    saveProfile() {
        this.profile = {
            answers: this.answers,
            createdAt: Date.now(),
            completedOnboarding: true
        };
        localStorage.setItem('flowlayer_profile', JSON.stringify(this.profile));
    }
    
    hasCompletedOnboarding() {
        return this.profile && this.profile.completedOnboarding;
    }
    
    renderQuestion() {
        const container = document.getElementById('questionContainer');
        const question = this.questions[this.currentQuestion];
        
        let html = `<div class="question">
            <h2 class="question-text">${question.text}</h2>`;
        
        if (question.type === 'options') {
            html += '<div class="answer-options">';
            question.options.forEach(opt => {
                const isSelected = this.answers[question.id] === opt.value;
                html += `
                    <button class="answer-option ${isSelected ? 'selected' : ''}" data-value="${opt.value}">
                        <span class="answer-icon">${opt.icon}</span>
                        <div class="answer-text">
                            <h4>${opt.title}</h4>
                            <p>${opt.desc}</p>
                        </div>
                    </button>
                `;
            });
            html += '</div>';
        } else if (question.type === 'slider') {
            const value = this.answers[question.id] || question.default;
            html += `
                <div class="slider-container">
                    <div class="slider-labels">
                        <span class="slider-label">${question.minLabel}</span>
                        <span class="slider-label">${question.maxLabel}</span>
                    </div>
                    <input type="range" class="slider-input" 
                           min="${question.min}" max="${question.max}" 
                           value="${value}"
                           data-question="${question.id}">
                    <div class="slider-value">${value}</div>
                </div>
            `;
        }
        
        html += '</div>';
        container.innerHTML = html;
        
        // Update progress
        this.updateProgress();
        
        // Update navigation buttons
        this.updateNavButtons();
        
        // Attach event listeners for this question
        this.attachQuestionListeners();
    }
    
    attachQuestionListeners() {
        const question = this.questions[this.currentQuestion];
        
        if (question.type === 'options') {
            document.querySelectorAll('.answer-option').forEach(btn => {
                btn.addEventListener('click', () => {
                    // Remove selected from all
                    document.querySelectorAll('.answer-option').forEach(b => b.classList.remove('selected'));
                    // Add selected to clicked
                    btn.classList.add('selected');
                    // Save answer
                    this.answers[question.id] = btn.dataset.value;
                });
            });
        } else if (question.type === 'slider') {
            const slider = document.querySelector('.slider-input');
            const valueDisplay = document.querySelector('.slider-value');
            
            slider.addEventListener('input', (e) => {
                valueDisplay.textContent = e.target.value;
                this.answers[question.id] = parseInt(e.target.value);
            });
            
            // Set initial value if not answered
            if (!this.answers[question.id]) {
                this.answers[question.id] = question.default;
            }
        }
    }
    
    updateProgress() {
        const fill = document.getElementById('progressFill');
        const text = document.getElementById('progressText');
        
        const progress = ((this.currentQuestion + 1) / this.questions.length) * 100;
        fill.style.width = `${progress}%`;
        text.textContent = `${this.currentQuestion + 1} / ${this.questions.length}`;
    }
    
    updateNavButtons() {
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        
        prevBtn.disabled = this.currentQuestion === 0;
        
        if (this.currentQuestion === this.questions.length - 1) {
            nextBtn.innerHTML = 'Start Driving <span>→</span>';
        } else {
            nextBtn.innerHTML = 'Next <span>→</span>';
        }
    }
    
    setupEventListeners() {
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        
        prevBtn.addEventListener('click', () => this.prevQuestion());
        nextBtn.addEventListener('click', () => this.nextQuestion());
    }
    
    prevQuestion() {
        if (this.currentQuestion > 0) {
            this.currentQuestion--;
            this.renderQuestion();
        }
    }
    
    nextQuestion() {
        const question = this.questions[this.currentQuestion];
        
        // Check if answered
        if (!this.answers[question.id]) {
            // For slider, use default
            if (question.type === 'slider') {
                this.answers[question.id] = question.default;
            } else {
                // Highlight that selection is needed
                const container = document.querySelector('.answer-options');
                if (container) {
                    container.style.animation = 'shake 0.3s ease';
                    setTimeout(() => container.style.animation = '', 300);
                }
                return;
            }
        }
        
        if (this.currentQuestion < this.questions.length - 1) {
            this.currentQuestion++;
            this.renderQuestion();
        } else {
            // Complete onboarding
            this.completeOnboarding();
        }
    }
    
    completeOnboarding() {
        this.saveProfile();
        
        // Dispatch custom event
        window.dispatchEvent(new CustomEvent('onboardingComplete', {
            detail: { profile: this.profile }
        }));
    }
    
    // Generate route recommendations based on profile
    getRouteRecommendations() {
        const recommendations = [];
        const answers = this.answers;
        
        // Based on scenic preference
        if (answers.scenic_preference === 'ocean') {
            recommendations.push({
                type: 'coastal',
                name: 'Coastal Highway',
                match: 95,
                reason: 'Matches your love for ocean views'
            });
        } else if (answers.scenic_preference === 'mountains') {
            recommendations.push({
                type: 'mountain',
                name: 'Mountain Pass',
                match: 92,
                reason: 'Perfect for mountain lovers'
            });
        } else if (answers.scenic_preference === 'forest') {
            recommendations.push({
                type: 'forest',
                name: 'Forest Trail',
                match: 90,
                reason: 'Ideal for nature immersion'
            });
        }
        
        // Based on pace
        if (answers.pace_preference === 'slow') {
            recommendations.forEach(r => {
                if (r.type === 'forest') r.match += 5;
            });
        } else if (answers.pace_preference === 'fast') {
            recommendations.unshift({
                type: 'highway',
                name: 'Express Route',
                match: 88,
                reason: 'Built for speed'
            });
        }
        
        return recommendations.slice(0, 3);
    }
    
    // Get driving vibe based on answers
    getPreferredVibe() {
        const answers = this.answers;
        
        if (answers.driving_purpose === 'thrill' || answers.pace_preference === 'fast') {
            return 'adventure';
        }
        if (answers.driving_purpose === 'relax' || answers.pace_preference === 'slow') {
            return 'chill';
        }
        if (answers.scenic_preference && answers.scenic_preference !== 'urban') {
            return 'scenic';
        }
        return 'scenic'; // default
    }
    
    // Get preferred time of day setting
    getTimeOfDaySetting() {
        return this.answers.time_of_day || 'sunset';
    }
}

// Add shake animation
const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);

// Export for global access
window.PersonalizationEngine = PersonalizationEngine;
