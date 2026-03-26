import { GoogleGenAI } from "@google/genai";
import type { VibeManager, VibePreset } from "./VibeManager.js";

interface PersonalityAnswers {
    [questionId: string]: string;
}

interface DrivingHabits {
    preferredVibes: string[];
    averageSpeed: number;
    routeReplays: Record<string, number>;
    feedbackHistory: Array<{ vibe: string; rating: number }>;
}

export class AIVibeEngine {
    private vibeManager: VibeManager;
    private apiKey: string;
    private model = "gemini-3.1-pro-preview";

    constructor(vibeManager: VibeManager) {
        this.vibeManager = vibeManager;
        this.apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
    }

    async generateVibeFromPersonality(answers: PersonalityAnswers, habits?: DrivingHabits): Promise<VibePreset | null> {
        if (!this.apiKey || this.apiKey === "YOUR_GEMINI_API_KEY_HERE") {
            console.warn("[AIVibeEngine] No Gemini API key. Using default vibe.");
            return null;
        }

        const ai = new GoogleGenAI({ apiKey: this.apiKey });
        const userPrompt = this.formatAnswersForPrompt(answers, habits);

        try {
            const response = await ai.models.generateContent({
                model: this.model,
                contents: userPrompt,
                config: {
                    systemInstruction: `You are FlowLayer's emotion engine. Convert personality answers into a single polished driving vibe preset.
Return only a valid JSON object that matches the provided schema.
The result should feel emotionally coherent, visually cinematic, and practical for a driving simulator.`,
                    temperature: 0.8,
                    responseMimeType: "application/json",
                    responseJsonSchema: {
                        type: "object",
                        properties: {
                            name: { type: "string", description: "Creative 2-3 word vibe name" },
                            lighting: {
                                type: "object",
                                properties: {
                                    color: { type: "string" },
                                    intensity: { type: "number" },
                                    ambient: { type: "string" },
                                    ambientIntensity: { type: "number" }
                                },
                                required: ["color", "intensity", "ambient", "ambientIntensity"]
                            },
                            fog: {
                                type: "object",
                                properties: {
                                    color: { type: "string" },
                                    density: { type: "number" }
                                },
                                required: ["color", "density"]
                            },
                            bloom: {
                                type: "object",
                                properties: {
                                    intensity: { type: "number" },
                                    threshold: { type: "number" },
                                    scatter: { type: "number" }
                                },
                                required: ["intensity", "threshold", "scatter"]
                            },
                            sky: {
                                type: "object",
                                properties: {
                                    topColor: { type: "string" },
                                    bottomColor: { type: "string" }
                                },
                                required: ["topColor", "bottomColor"]
                            },
                            particles: {
                                type: "object",
                                properties: {
                                    type: { type: "string", enum: ["fireflies", "mist", "dust", "rain", "none"] },
                                    count: { type: "integer" },
                                    color: { type: "string" }
                                },
                                required: ["type", "count", "color"]
                            },
                            audioMood: { type: "string" }
                        },
                        required: ["name", "lighting", "fog", "bloom", "sky", "particles", "audioMood"]
                    }
                }
            });

            const content = response.text;
            if (!content) return null;

            const preset: VibePreset = JSON.parse(content);
            this.vibeManager.setCustomPreset(preset);
            return preset;
        } catch (err) {
            console.error("[AIVibeEngine] Gemini generation failed:", err);
            return null;
        }
    }

    private formatAnswersForPrompt(answers: PersonalityAnswers, habits?: DrivingHabits): string {
        let prompt = "User's personality test answers:\n\n";

        for (const [questionId, answer] of Object.entries(answers)) {
            const label = questionId.replace(/_/g, " ");
            prompt += `- ${label}: ${answer}\n`;
        }

        if (habits) {
            prompt += "\nDriving habits:\n";
            prompt += `- Most used vibes: ${habits.preferredVibes.join(", ")}\n`;
            prompt += `- Average driving speed: ${habits.averageSpeed} mph\n`;

            if (habits.feedbackHistory.length > 0) {
                const avgRating = habits.feedbackHistory.reduce((s, f) => s + f.rating, 0) / habits.feedbackHistory.length;
                prompt += `- Average satisfaction: ${avgRating.toFixed(1)}/5\n`;
            }
        }

        return prompt;
    }

    async applyGeneratedVibe(answers: PersonalityAnswers, habits?: DrivingHabits): Promise<boolean> {
        const preset = await this.generateVibeFromPersonality(answers, habits);
        if (preset) {
            this.vibeManager.setCustomPreset(preset);
            const customButton = document.getElementById("customVibeBtn");
            const customLabel = document.getElementById("customVibeLabel");
            customButton?.classList.remove("hidden");
            if (customLabel) customLabel.textContent = preset.name;
            this.vibeManager.setVibe("custom");
            return true;
        }
        return false;
    }
}
