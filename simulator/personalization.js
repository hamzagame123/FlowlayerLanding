// FlowLayer - Personalization Questions System
// =============================================
// Open-ended prompts interpreted by AI-style logic

class PersonalizationEngine {
    constructor() {
        this.currentQuestion = 0;
        this.answers = {};
        this.profile = null;
        this.activeDictationTarget = null;
        this.isDictating = false;
        this.recognition = null;
        this.voiceSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

        this.questions = [
            {
                id: 'drive_intention',
                text: 'What kind of <span>inner state</span> are you hoping this drive creates?',
                helper: 'Share what you want to shift from and where you want to arrive emotionally.',
                placeholder: 'Example: I want to release mental noise after work and return to a calmer, clearer state...'
            },
            {
                id: 'road_relationship',
                text: 'When a route feels <span>right</span>, what does that experience feel like in your body?',
                helper: 'Describe pace, tension, breathing, and how your attention moves.',
                placeholder: 'Example: Smooth rhythm, fewer sudden decisions, no aggressive merges...'
            },
            {
                id: 'surrounding_energy',
                text: 'What kind of <span>surroundings</span> energize you or settle you during a drive?',
                helper: 'Think in images: water, skyline, neighborhoods, trees, open roads, lights.',
                placeholder: 'Example: I feel best near water and wide horizons, less boxed in by dense traffic...'
            },
            {
                id: 'route_tolerance',
                text: 'Which route conditions quickly drain your <span>focus</span>?',
                helper: 'Mention what you want less of: stop-and-go, tight turns, noise, unpredictability, etc.',
                placeholder: 'Example: Frequent hard stops and confusing lane changes make me tense...'
            },
            {
                id: 'preferred_momentum',
                text: 'How should the drive’s <span>momentum</span> unfold from start to finish?',
                helper: 'Do you want gentle build-up, steady flow, scenic detours, or intensity?',
                placeholder: 'Example: Start easy, then open up into a steady flowing pace...'
            },
            {
                id: 'time_and_light',
                text: 'What time, weather, or <span>light quality</span> changes how you feel on the road?',
                helper: 'Describe your ideal atmosphere.',
                placeholder: 'Example: Late afternoon with warm light and dry roads feels grounding...'
            },
            {
                id: 'meaningful_arrival',
                text: 'What does a <span>meaningful arrival</span> feel like to you?',
                helper: 'Not just where you arrive, but how you want to arrive.',
                placeholder: 'Example: Arrive mentally reset, less rushed, and more present than when I started...'
            },
            {
                id: 'route_story',
                text: 'If this drive were a short story, what tone should it have?',
                helper: 'Use your own language. We will interpret this into route behavior.',
                placeholder: 'Example: Quiet beginning, reflective middle, hopeful ending...'
            }
        ];
    }

    init() {
        this.loadProfile();
        this.initSpeechRecognition();
        this.renderQuestion();
        this.setupEventListeners();
    }

    initSpeechRecognition() {
        if (!this.voiceSupported) return;

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = (event) => {
            if (!this.activeDictationTarget) return;

            const transcript = [...event.results]
                .map(result => result[0].transcript)
                .join(' ')
                .trim();

            this.activeDictationTarget.value = transcript;
            this.activeDictationTarget.dispatchEvent(new Event('input', { bubbles: true }));
        };

        this.recognition.onerror = () => {
            this.stopDictationState();
        };

        this.recognition.onend = () => {
            this.stopDictationState();
        };
    }

    loadProfile() {
        const saved = localStorage.getItem('flowlayer_profile');
        if (!saved) return;

        try {
            this.profile = JSON.parse(saved);
            this.answers = this.profile.answers || {};
        } catch (e) {
            this.profile = null;
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
        const value = this.answers[question.id] || '';

        container.innerHTML = `
            <div class="question">
                <h2 class="question-text">${question.text}</h2>
                <p class="question-helper">${question.helper}</p>
                <div class="question-input-wrap">
                    <textarea
                        class="question-input"
                        id="questionInput"
                        data-question="${question.id}"
                        placeholder="${question.placeholder}"
                    >${value}</textarea>
                    <button class="question-voice-btn" id="questionVoiceBtn" type="button" title="Speak your answer">🎙️</button>
                </div>
                <p class="question-caption">Open-ended answers welcome. Our AI routing engine interprets context, not fixed choices.</p>
            </div>
        `;

        this.updateProgress();
        this.updateNavButtons();
        this.attachQuestionListeners();
    }

    attachQuestionListeners() {
        const input = document.getElementById('questionInput');
        const voiceBtn = document.getElementById('questionVoiceBtn');
        if (!input) return;

        const question = this.questions[this.currentQuestion];
        input.addEventListener('input', () => {
            this.answers[question.id] = input.value.trim();
        });

        if (voiceBtn) {
            if (!this.voiceSupported || !this.recognition) {
                voiceBtn.disabled = true;
                voiceBtn.title = 'Voice input not supported in this browser';
                return;
            }

            voiceBtn.addEventListener('click', () => {
                if (this.isDictating) {
                    this.recognition.stop();
                    return;
                }

                this.activeDictationTarget = input;
                this.isDictating = true;
                voiceBtn.classList.add('listening');
                this.recognition.start();
            });
        }
    }

    stopDictationState() {
        this.isDictating = false;
        this.activeDictationTarget = null;
        const voiceBtn = document.getElementById('questionVoiceBtn');
        if (voiceBtn) {
            voiceBtn.classList.remove('listening');
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
        nextBtn.innerHTML = this.currentQuestion === this.questions.length - 1
            ? 'Start Driving <span>→</span>'
            : 'Next <span>→</span>';
    }

    setupEventListeners() {
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');

        prevBtn.addEventListener('click', () => this.prevQuestion());
        nextBtn.addEventListener('click', () => this.nextQuestion());
    }

    prevQuestion() {
        if (this.currentQuestion === 0) return;
        this.currentQuestion -= 1;
        this.renderQuestion();
    }

    nextQuestion() {
        const question = this.questions[this.currentQuestion];
        const answer = (this.answers[question.id] || '').trim();

        if (answer.length < 8 || answer.split(/\s+/).length < 3) {
            const input = document.getElementById('questionInput');
            if (input) {
                input.style.animation = 'shake 0.3s ease';
                setTimeout(() => {
                    input.style.animation = '';
                }, 300);
                input.focus();
            }
            return;
        }

        if (this.currentQuestion < this.questions.length - 1) {
            this.currentQuestion += 1;
            this.renderQuestion();
            return;
        }

        this.completeOnboarding();
    }

    completeOnboarding() {
        this.saveProfile();
        window.dispatchEvent(new CustomEvent('onboardingComplete', {
            detail: { profile: this.profile }
        }));
    }

    inferRoutePreference() {
        const scenicText = (this.answers.surrounding_energy || '').toLowerCase();
        if (/(ocean|coast|beach|water|bay|sea)/.test(scenicText)) return 'coastal';
        if (/(mountain|elevation|hill|peak|canyon)/.test(scenicText)) return 'mountain';
        if (/(forest|trees|green|woods|trail|nature)/.test(scenicText)) return 'forest';
        return 'coastal';
    }

    getRouteRecommendations() {
        const route = this.inferRoutePreference();
        const recommendations = {
            coastal: { type: 'coastal', name: 'Coastal Highway', match: 93, reason: 'Matches your preference for open, water-adjacent atmosphere' },
            mountain: { type: 'mountain', name: 'Mountain Pass', match: 91, reason: 'Fits your pull toward elevation and dynamic terrain' },
            forest: { type: 'forest', name: 'Forest Trail', match: 90, reason: 'Aligns with your calm, nature-first driving language' }
        };

        return [recommendations[route]];
    }

    getPreferredVibe() {
        const combined = Object.values(this.answers).join(' ').toLowerCase();
        if (/(rush|adrenaline|thrill|intense|fast|excited)/.test(combined)) return 'adventure';
        if (/(calm|soft|gentle|relax|breathe|quiet|reset|peace)/.test(combined)) return 'chill';
        if (/(scenic|nature|views|sunset|water|mountain|forest|explore)/.test(combined)) return 'scenic';
        return 'fastest';
    }

    getTimeOfDaySetting() {
        const text = (this.answers.time_and_light || '').toLowerCase();
        if (/(sunrise|morning|dawn|early)/.test(text)) return 'sunrise';
        if (/(night|dark|late|midnight)/.test(text)) return 'night';
        if (/(day|afternoon|noon|bright)/.test(text)) return 'day';
        return 'sunset';
    }
}

const style = document.createElement('style');
style.textContent = `
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
`;
document.head.appendChild(style);

window.PersonalizationEngine = PersonalizationEngine;
