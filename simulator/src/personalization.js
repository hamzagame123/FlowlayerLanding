// FlowLayer - Personalization Questions System
// =============================================
// Open-ended prompts interpreted by AI-style logic

export class PersonalizationEngine {
    constructor() {
        this.currentQuestion = 0;
        this.answers = {};
        this.profile = null;
        this.activeDictationTarget = null;
        this.isDictating = false;
        this.handsFreeMode = false;
        this.lastTranscript = '';
        this.recognition = null;
        this.voiceSupported = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

        this.questions = [
            {
                id: 'drive_intention',
                text: 'What are you carrying into this drive, and what do you want to leave behind?',
                helper: 'Give this drive a purpose.',
                placeholder: 'Example: I am carrying stress and mental clutter. I want to arrive calmer and clear-headed.',
                suggestions: ['Reset after work', 'Clear my mind', 'Gentle decompression', 'Feel alive again']
            },
            {
                id: 'pace_preference',
                text: 'What pace feels right for you today?',
                helper: 'Not just speed - describe emotional rhythm.',
                placeholder: 'Example: Slow start, steady middle, and no chaotic moments.',
                suggestions: ['Slow and reflective', 'Steady and smooth', 'Energetic and fast', 'Mix of calm and intensity']
            },
            {
                id: 'surrounding_energy',
                text: 'What surroundings change your mood in a good way?',
                helper: 'Think visually: light, water, skyline, trees, neighborhoods.',
                placeholder: 'Example: Water, sunset light, and open roads make me breathe easier.',
                suggestions: ['Ocean or water', 'Trees and forest', 'City lights', 'Mountain elevation']
            },
            {
                id: 'route_tolerance',
                text: 'Which route conditions pull you out of flow?',
                helper: 'Tell us what to avoid.',
                placeholder: 'Example: Stop-and-go traffic and confusing merges make me tense quickly.',
                suggestions: ['Stop-and-go traffic', 'Too many lane changes', 'Crowded downtown streets', 'Unpredictable turns']
            },
            {
                id: 'detour_preference',
                text: 'How open are you to meaningful detours if they improve the experience?',
                helper: 'This helps balance efficiency vs depth.',
                placeholder: 'Example: I am open to a 10-15 minute detour if it feels beautiful and less stressful.',
                suggestions: ['No detours today', 'Small scenic detours', 'Open to exploration', 'Prioritize fastest arrival']
            },
            {
                id: 'time_and_light',
                text: 'What kind of light or atmosphere helps you feel grounded?',
                helper: 'Time of day and weather both matter.',
                placeholder: 'Example: Golden hour and dry roads feel warm and safe.',
                suggestions: ['Sunrise', 'Daylight', 'Sunset glow', 'Night drive']
            },
            {
                id: 'meaningful_arrival',
                text: 'When this drive ends, how do you want to feel?',
                helper: 'Describe your desired arrival state.',
                placeholder: 'Example: Present, lighter, and emotionally reset.',
                suggestions: ['Calm', 'Focused', 'Inspired', 'Energized']
            },
            {
                id: 'route_story',
                text: 'If this drive were a short film, what tone should it have?',
                helper: 'Give us your narrative direction.',
                placeholder: 'Example: Quiet opening, cinematic middle, hopeful ending.',
                suggestions: ['Cinematic and scenic', 'Minimal and calm', 'Playful and adventurous', 'Direct and efficient']
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

            this.lastTranscript = transcript;
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

    getAnswerState(questionId) {
        const existing = this.answers[questionId];
        if (existing && typeof existing === 'object') return existing;
        if (typeof existing === 'string') return { text: existing, tags: [] };
        return { text: '', tags: [] };
    }

    setAnswerState(questionId, nextState) {
        this.answers[questionId] = {
            text: (nextState.text || '').trim(),
            tags: Array.isArray(nextState.tags) ? nextState.tags : []
        };
    }

    renderQuestion() {
        const container = document.getElementById('questionContainer');
        const question = this.questions[this.currentQuestion];
        const answerState = this.getAnswerState(question.id);
        const chips = (question.suggestions || []).map(suggestion => {
            const selected = answerState.tags.includes(suggestion);
            return `<button class="suggestion-chip ${selected ? 'selected' : ''}" type="button" data-suggestion="${suggestion}">${suggestion}</button>`;
        }).join('');

        container.innerHTML = `
            <div class="question">
                <h2 class="question-text">${question.text}</h2>
                <p class="question-helper">${question.helper}</p>
                <div class="question-tools">
                    <span class="handsfree-status ${this.isDictating ? 'active' : ''}" id="handsfreeStatus">${this.isDictating ? 'Mic listening' : 'Mic off'}</span>
                </div>
                <div class="question-chip-group">${chips}</div>
                <div class="question-input-wrap">
                    <textarea
                        class="question-input"
                        id="questionInput"
                        data-question="${question.id}"
                        placeholder="${question.placeholder}"
                    >${answerState.text}</textarea>
                    <button class="question-voice-btn ${this.isDictating ? 'listening' : ''}" id="questionVoiceBtn" type="button" title="Tap to dictate one answer">🎙️</button>
                </div>
                <div class="signal-meter"><span class="signal-fill" id="signalFill"></span></div>
                <p class="question-caption">Tap option chips + type or speak. Mic turns off after each sentence.</p>
            </div>
        `;

        this.updateProgress();
        this.updateNavButtons();
        this.attachQuestionListeners();
        this.updateAnswerSignals(question.id);
    }

    attachQuestionListeners() {
        const input = document.getElementById('questionInput');
        const voiceBtn = document.getElementById('questionVoiceBtn');
        if (!input) return;

        const question = this.questions[this.currentQuestion];
        input.addEventListener('input', () => {
            const state = this.getAnswerState(question.id);
            state.text = input.value;
            this.setAnswerState(question.id, state);
            this.updateAnswerSignals(question.id);
        });

        document.querySelectorAll('.suggestion-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const state = this.getAnswerState(question.id);
                const suggestion = chip.dataset.suggestion;
                const isSelected = state.tags.includes(suggestion);
                state.tags = isSelected
                    ? state.tags.filter(item => item !== suggestion)
                    : [...state.tags, suggestion];
                this.setAnswerState(question.id, state);
                chip.classList.toggle('selected', !isSelected);
                this.updateAnswerSignals(question.id);

                // Quick-select flow: selecting a chip advances immediately.
                if (!isSelected) {
                    this.nextQuestion(false);
                }
            });
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

                this.handsFreeMode = false;
                this.activeDictationTarget = input;
                this.isDictating = true;
                this.lastTranscript = '';
                voiceBtn.classList.add('listening');
                this.recognition.start();
                this.updateHandsfreeStatus();
            });
        }
    }

    stopDictationState() {
        this.isDictating = false;
        this.handsFreeMode = false;
        this.activeDictationTarget = null;
        const voiceBtn = document.getElementById('questionVoiceBtn');
        if (voiceBtn) {
            voiceBtn.classList.remove('listening');
        }
        this.updateHandsfreeStatus();
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
        nextBtn.addEventListener('click', () => this.nextQuestion(false));
    }

    prevQuestion() {
        if (this.currentQuestion === 0) return;
        this.currentQuestion -= 1;
        this.renderQuestion();
    }

    nextQuestion(fromVoice = false) {
        const question = this.questions[this.currentQuestion];
        const state = this.getAnswerState(question.id);
        const answer = (state.text || '').trim();
        const wordCount = answer.split(/\s+/).filter(Boolean).length;
        const hasEnoughText = wordCount >= 3;
        const hasAnyTag = state.tags.length > 0;

        if (!hasEnoughText && !hasAnyTag) {
            const input = document.getElementById('questionInput');
            if (input) {
                input.style.animation = 'shake 0.3s ease';
                setTimeout(() => {
                    input.style.animation = '';
                }, 300);
                input.focus();
            }
            return false;
        }

        if (this.currentQuestion < this.questions.length - 1) {
            this.currentQuestion += 1;
            this.renderQuestion();
            return true;
        }

        this.completeOnboarding();
        return false;
    }

    completeOnboarding() {
        this.saveProfile();
        window.dispatchEvent(new CustomEvent('onboardingComplete', {
            detail: { profile: this.profile }
        }));
    }

    inferRoutePreference() {
        const scenicText = this.getCombinedAnswerText('surrounding_energy');
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
        const combined = this.getAllAnswerText();
        if (/(rush|adrenaline|thrill|intense|fast|excited)/.test(combined)) return 'adventure';
        if (/(calm|soft|gentle|relax|breathe|quiet|reset|peace)/.test(combined)) return 'chill';
        if (/(scenic|nature|views|sunset|water|mountain|forest|explore)/.test(combined)) return 'scenic';
        return 'fastest';
    }

    getTimeOfDaySetting() {
        const text = this.getCombinedAnswerText('time_and_light');
        if (/(sunrise|morning|dawn|early)/.test(text)) return 'sunrise';
        if (/(night|dark|late|midnight)/.test(text)) return 'night';
        if (/(day|afternoon|noon|bright)/.test(text)) return 'day';
        return 'sunset';
    }

    getCombinedAnswerText(questionId) {
        const state = this.getAnswerState(questionId);
        return `${state.text} ${state.tags.join(' ')}`.toLowerCase();
    }

    getAllAnswerText() {
        return Object.keys(this.answers)
            .map(questionId => this.getCombinedAnswerText(questionId))
            .join(' ')
            .toLowerCase();
    }

    updateHandsfreeStatus() {
        const statusEl = document.getElementById('handsfreeStatus');
        if (!statusEl) return;
        statusEl.textContent = this.isDictating ? 'Mic listening' : 'Mic off';
        statusEl.classList.toggle('active', this.isDictating);
    }

    updateAnswerSignals(questionId) {
        const state = this.getAnswerState(questionId);
        const words = (state.text || '').trim().split(/\s+/).filter(Boolean).length;
        const signal = Math.min(100, words * 6 + state.tags.length * 14);

        const fill = document.getElementById('signalFill');
        const label = document.getElementById('signalStatus');
        if (fill) fill.style.width = `${signal}%`;

        if (!label) return;
        if (signal < 25) label.textContent = 'Signal: warming up';
        else if (signal < 55) label.textContent = 'Signal: enough context';
        else if (signal < 80) label.textContent = 'Signal: strong personalization';
        else label.textContent = 'Signal: rich emotional profile';
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
