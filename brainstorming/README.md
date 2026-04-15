# FlowLayer Brainstorming

This folder is for concept generation only.

It reuses the existing Gemini API key already present in the workspace env files instead of requiring a second manual setup.

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

## Notes

- The scripts look for `VITE_GEMINI_API_KEY` or `GEMINI_API_KEY`.
- They will automatically search sibling env files in:
  - `../simulator/.env`
  - `../simulator-cesium-restore/.env`
  - `../simulator-v3/.env`
- Image and video model names are configurable in the scripts.

