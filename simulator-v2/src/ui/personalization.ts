interface Question {
    id: string;
    text: string;
    helper: string;
    placeholder: string;
    suggestions: string[];
}

const QUESTIONS: Question[] = [
    {
        id: "drive_intention",
        text: "What are you carrying into this drive, and what do you want to leave behind?",
        helper: "Give this drive a purpose.",
        placeholder: "Example: I am carrying stress and mental clutter. I want to arrive calmer and clear-headed.",
        suggestions: ["Reset after work", "Clear my mind", "Gentle decompression", "Feel alive again"],
    },
    {
        id: "pace_preference",
        text: "What pace feels right for you today?",
        helper: "Not just speed \u2014 describe emotional rhythm.",
        placeholder: "Example: Slow start, steady middle, and no chaotic moments.",
        suggestions: ["Slow and reflective", "Steady and smooth", "Energetic and fast", "Mix of calm and intensity"],
    },
    {
        id: "surrounding_energy",
        text: "What surroundings change your mood in a good way?",
        helper: "Think visually: light, water, skyline, trees, neighborhoods.",
        placeholder: "Example: Water, sunset light, and open roads make me breathe easier.",
        suggestions: ["Ocean or water", "Trees and forest", "City lights", "Mountain elevation"],
    },
    {
        id: "route_tolerance",
        text: "Which route conditions pull you out of flow?",
        helper: "Tell us what to avoid.",
        placeholder: "Example: Stop-and-go traffic and confusing merges make me tense quickly.",
        suggestions: ["Stop-and-go traffic", "Too many lane changes", "Crowded downtown streets", "Unpredictable turns"],
    },
    {
        id: "detour_preference",
        text: "How open are you to meaningful detours if they improve the experience?",
        helper: "This helps balance efficiency vs depth.",
        placeholder: "Example: I am open to a 10-15 minute detour if it feels beautiful and less stressful.",
        suggestions: ["No detours", "Short scenic detours", "Surprise me", "The longer the better"],
    },
    {
        id: "music_mood",
        text: "If this drive had a soundtrack, what would it sound like?",
        helper: "We use this to set audio atmosphere.",
        placeholder: "Example: Lo-fi beats, soft piano, or ambient electronic.",
        suggestions: ["Lo-fi hip hop", "Classical piano", "Ambient electronic", "Silence / nature sounds"],
    },
    {
        id: "social_preference",
        text: "Do you want this to feel like a solo journey or a shared experience?",
        helper: "This affects how interactive the system is.",
        placeholder: "Example: Solo \u2014 I want to be in my own headspace.",
        suggestions: ["Solo and quiet", "Solo with a guide", "I'd share with a friend", "Full social mode"],
    },
    {
        id: "discovery_style",
        text: "How do you feel about discovering unexpected places along the way?",
        helper: "This shapes route suggestions.",
        placeholder: "Example: I love stumbling on hidden spots. Show me things I wouldn't find on my own.",
        suggestions: ["Show me everything", "Subtle suggestions only", "Only if I ask", "Stick to the plan"],
    },
    {
        id: "emotional_goal",
        text: "If you could name one feeling you want to take home from this drive, what is it?",
        helper: "This is the heart of FlowLayer.",
        placeholder: "Example: Clarity. I want to feel like I reset something inside.",
        suggestions: ["Calm clarity", "Joyful energy", "Peaceful acceptance", "Bold confidence"],
    },
    {
        id: "time_preference",
        text: "What time of day feels most alive to you when driving?",
        helper: "We'll tune lighting to match your energy.",
        placeholder: "Example: Golden hour \u2014 that warm 30 minutes before sunset.",
        suggestions: ["Early morning", "Golden hour", "Nighttime", "Any time"],
    },
];

export class PersonalizationEngine {
    private currentQuestion = 0;
    private answers: Record<string, string> = {};

    start(onComplete: () => void) {
        this.renderQuestion();

        const nextBtn = document.getElementById("nextBtn");
        const prevBtn = document.getElementById("prevBtn");

        nextBtn?.addEventListener("click", () => {
            this.saveCurrentAnswer();
            if (this.currentQuestion < QUESTIONS.length - 1) {
                this.currentQuestion++;
                this.renderQuestion();
            } else {
                onComplete();
            }
        });

        prevBtn?.addEventListener("click", () => {
            if (this.currentQuestion > 0) {
                this.saveCurrentAnswer();
                this.currentQuestion--;
                this.renderQuestion();
            }
        });
    }

    private renderQuestion() {
        const q = QUESTIONS[this.currentQuestion];
        const container = document.getElementById("questionContainer");
        const progressFill = document.getElementById("progressFill");
        const progressText = document.getElementById("progressText");
        const prevBtn = document.getElementById("prevBtn") as HTMLButtonElement;
        const nextBtn = document.getElementById("nextBtn");

        if (!container) return;

        const progress = ((this.currentQuestion + 1) / QUESTIONS.length) * 100;
        if (progressFill) progressFill.style.width = `${progress}%`;
        if (progressText) progressText.textContent = `${this.currentQuestion + 1} / ${QUESTIONS.length}`;
        if (prevBtn) prevBtn.disabled = this.currentQuestion === 0;
        if (nextBtn) {
            const span = nextBtn.querySelector("span");
            if (this.currentQuestion === QUESTIONS.length - 1) {
                nextBtn.textContent = "Start Driving ";
                if (span) nextBtn.appendChild(span);
            }
        }

        container.innerHTML = `
            <div class="question">
                <p class="question-text">${q.text}</p>
                <p class="question-helper">${q.helper}</p>
                <div class="question-chip-group">
                    ${q.suggestions.map(s => `<button class="suggestion-chip" type="button">${s}</button>`).join("")}
                </div>
                <div class="question-input-wrap">
                    <textarea class="question-input" id="answerInput" placeholder="${q.placeholder}">${this.answers[q.id] || ""}</textarea>
                </div>
            </div>
        `;

        container.querySelectorAll(".suggestion-chip").forEach(chip => {
            chip.addEventListener("click", () => {
                const input = document.getElementById("answerInput") as HTMLTextAreaElement;
                if (input) {
                    input.value = chip.textContent || "";
                    chip.classList.add("selected");
                }
            });
        });
    }

    private saveCurrentAnswer() {
        const input = document.getElementById("answerInput") as HTMLTextAreaElement;
        if (input && input.value.trim()) {
            this.answers[QUESTIONS[this.currentQuestion].id] = input.value.trim();
        }
    }

    getAnswers(): Record<string, string> {
        return { ...this.answers };
    }
}
