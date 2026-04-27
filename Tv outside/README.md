# FlowLayer Brainstorming

This folder is the outside-facing installation screen and concept-generation workspace.

Generation scripts use Google Gen AI through a server-side Gemini API key, or Vertex AI through Google Cloud Application Default Credentials (ADC).

## What is here

- `prompts/`
  - curated prompts for year-end show concept work
- `scripts/generate-images.mjs`
  - generates still-image concepts with the Google Gen AI SDK
- `scripts/generate-veo.mjs`
  - submits a Veo 3.1 generation job
- `outputs/`
  - generated images, videos, and metadata

## Current concept direction

The installation has two surfaces:

1. `outside screen`
   - future museum framing
   - "manual driving" as a reconstructed ritual
   - queue / archive / observer mode
2. `inside screen`
   - the actual simulator interface
   - route, vibe, motion chair, steering wheel

## AI auth notes

- API key mode: set `GEMINI_API_KEY` or `GOOGLE_API_KEY`. Legacy `VERTEX_API_KEY` still works as a fallback.
- Vertex ADC mode: set `GOOGLE_CLOUD_PROJECT`, `GOOGLE_CLOUD_LOCATION`, and `GOOGLE_GENAI_USE_VERTEXAI=true`.
- Vercel can use `GEMINI_API_KEY` or a service account JSON in `GOOGLE_APPLICATION_CREDENTIALS_JSON`.
- Text, image, and video model names are configurable with `GEMINI_TEXT_MODEL`, `GEMINI_IMAGE_MODEL`, and `GEMINI_VIDEO_MODEL`.
- Route narration uses Gemini with Google Maps grounding through `/api/gemini-narrate`.
