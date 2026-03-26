# FlowLayer Simulator v2 — Technical Plan

**Hamza & Yaroslav | Interactive Systems Project 2**
**Last updated: March 2026**

---

## Overview

We are rebuilding the FlowLayer Driving Simulator from the ground up using a modern 3D web engine and real-world map data. The new simulator replaces the procedural Three.js prototype with a production-grade experience where users drive through **photorealistic real-world cities** streamed from Google Maps, with FlowLayer's emotion-driven vibe system layered on top.

### What's Changing

| Aspect | Current Simulator (v1) | New Simulator (v2) |
|--------|----------------------|---------------------|
| **Engine** | Vanilla Three.js (CDN, r128) | Needle Engine + Vite + TypeScript |
| **Environment** | Procedural boxes, cones, shader sky | Google Photorealistic 3D Tiles (real cities) |
| **Physics** | None (faked road scrolling) | Rapier physics engine (real vehicle dynamics) |
| **Car** | Static hood mesh, no steering | Drivable car with steering, acceleration, braking |
| **Input** | None | Logitech G29 steering wheel + keyboard fallback |
| **Camera** | Fixed first-person | Third-person chase cam + free orbit/zoom mode |
| **Rendering** | Basic materials, no effects | PBR, Bloom, SSAO, tone mapping, particles |
| **AI** | None | OpenAI API for personalized vibe generation |
| **Architecture** | Global script tags, vanilla JS | Modular TypeScript components, npm packages |

### Why These Changes

The progress report states: *"Traditional prototypes demonstrate interaction flows but cannot fully communicate experiential outcomes."* The v2 simulator takes this further — instead of a stylized approximation, users will drive through **places they recognize** (San Francisco, Golden Gate Bridge) while FlowLayer transforms the emotional atmosphere of those real places based on how they want to feel.

---

## Tech Stack

| Technology | Purpose |
|------------|---------|
| **Needle Engine** (v4.17+) | Web-first 3D engine built on three.js. Provides component system, Rapier physics, post-processing, spatial audio, WebXR support |
| **Vite** | Build tool and dev server with hot reload |
| **TypeScript** | Type-safe component development |
| **Google Photorealistic 3D Tiles** | Streams real-world 3D city geometry (buildings, terrain, roads, trees) from Google Maps |
| **3d-tiles-renderer** (NASA-AMMOS) | Three.js library for loading and rendering OGC 3D Tiles |
| **Rapier** (built into Needle) | Physics engine for vehicle dynamics and terrain collision |
| **OpenAI API** | Generates personalized vibe configurations from personality test data and driving habits |
| **Gamepad API** (browser standard) | Reads Logitech G29 steering wheel, pedals, and buttons |

---

## Architecture

```
simulator-v2/
├── package.json              # Dependencies & scripts
├── vite.config.ts            # Vite + Needle Engine plugins
├── tsconfig.json             # TypeScript configuration
├── .env                      # API keys (Google Maps, OpenAI)
├── index.html                # UI overlay + <needle-engine> web component
└── src/
    ├── main.ts               # Bootstrap: initialize all systems
    ├── scripts/              # Needle Engine Behaviour components
    │   ├── GoogleTilesManager.ts   # Stream Google 3D Tiles
    │   ├── CarController.ts        # Vehicle physics & movement
    │   ├── GamepadInput.ts         # G29 steering wheel input
    │   ├── WaypointRoute.ts        # GPS route paths & progress
    │   ├── VibeManager.ts          # Emotional lighting/FX/audio layer
    │   ├── CameraFollow.ts         # Chase cam + free orbit
    │   ├── HUDBridge.ts            # 3D state -> DOM HUD updates
    │   └── AIVibeEngine.ts         # OpenAI API integration
    ├── styles/
    │   └── main.css                # Simulator UI styles
    └── ui/
        ├── story.ts                # Cinematic story intro
        ├── personalization.ts      # Onboarding personality test
        └── voice.ts                # Voice control system
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        USER INTERACTION                             │
│   Personality Test → OpenAI API → Custom Vibe Config (JSON)         │
│   G29 Steering Wheel → Gamepad API → CarController                  │
│   Keyboard (WASD) → Needle Input → CarController (fallback)         │
│   Vibe Buttons → HUDBridge → VibeManager                           │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                     NEEDLE ENGINE SCENE                              │
│                                                                      │
│   Google 3D Tiles ──────── Real-world photorealistic geometry        │
│        +                                                             │
│   VibeManager ──────────── Lighting, fog, sky, post-FX, particles   │
│        +                                                             │
│   CarController ────────── Physics body driving on terrain           │
│        +                                                             │
│   WaypointRoute ────────── Glowing 3D path ribbon on roads          │
│        +                                                             │
│   CameraFollow ─────────── Third-person chase / free orbit          │
│        +                                                             │
│   Spatial Audio ────────── 3D-positioned ambient sounds per vibe    │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────────────┐
│                        HTML/CSS HUD OVERLAY                         │
│   Speed display · Vibe selector · Route cards · Drive stats         │
│   Voice commands · Feedback modal · Playlist · Destination input    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Core Systems — Detail

### 1. Google Photorealistic 3D Tiles

The entire driving environment is real-world geometry streamed from Google Maps. Using the `3d-tiles-renderer` npm library with `GoogleCloudAuthPlugin`, we load the tile root at `https://tile.googleapis.com/v1/3dtiles/root.json` and the renderer progressively streams detailed mesh as the camera moves.

**Key capabilities:**
- 2,500+ cities available in photorealistic 3D
- Tiles are standard glTF format (compatible with three.js/Needle)
- Progressive LOD — nearby tiles load at high detail, distant tiles stay low-poly
- WGS84 (lat/lng) coordinate system with conversion to scene-local positions

**Starting location:** Golden Gate Bridge area, San Francisco — matching our existing route themes (Coastal Highway, Mountain Pass, Forest Trail).

### 2. Car Controller (Rapier Physics)

A physics-based vehicle using Needle Engine's built-in Rapier physics:

- Invisible `Rigidbody` + `BoxCollider` as the car's physics body
- Accepts normalized steering (-1 to 1) and throttle (0 to 1) input
- Applies forces and torques for realistic acceleration, turning, and braking
- Raycasts downward to stay on terrain surface (important for 3D Tiles' uneven geometry)
- Exposes real-time `speed`, `heading`, `position` for HUD and camera

### 3. Logitech G29 Support (Gamepad API)

Polls `navigator.getGamepads()` every frame to read G29 hardware:

| G29 Input | Mapped To |
|-----------|-----------|
| Steering wheel (axis 0) | Car steering angle |
| Gas pedal (axis 1/2) | Car throttle |
| Brake pedal (axis 1/2) | Car braking force |
| D-pad buttons | Cycle through vibes |
| Paddle shifters | Speed presets / gear simulation |

Falls back to keyboard (WASD/arrows) when no gamepad is connected. HUD shows connection status indicator.

### 4. Waypoint Route System

Routes are defined as arrays of GPS coordinates `{ lat, lng }` that map to real roads in the Google 3D Tiles world:

- Coordinates are converted to scene-local positions using the tiles' WGS84-to-scene transform
- A glowing 3D ribbon (tube geometry) is drawn along the route path
- Car progress along the route is tracked (distance covered, ETA, next turn)
- HUD shows compass arrow pointing to next waypoint

**Pre-defined routes:**
- **Coastal Highway** — SF Embarcadero / waterfront
- **Mountain Pass** — Twin Peaks / elevated terrain
- **Forest Trail** — Golden Gate Park / Presidio area

### 5. Vibe Manager (Emotional Layer)

The core FlowLayer innovation — real-world geometry transformed by mood. Each vibe applies a distinct atmospheric configuration on top of the photorealistic tiles:

| Parameter | Scenic | Chill | Adventure | Fastest |
|-----------|--------|-------|-----------|---------|
| **Lighting** | Warm golden sunset | Cool blue twilight | Dynamic, high contrast | Neutral, clear |
| **Fog** | Warm amber haze | Soft lavender mist | Dusty, low visibility | Minimal/none |
| **Bloom** | Strong (sun glow) | Subtle (soft edges) | Moderate (highlights) | Off |
| **Tone Mapping** | Warm AgX | Cool filmic | Punchy ACES | Neutral |
| **SSAO** | Gentle | Strong (moody) | Strong (gritty) | Off (performance) |
| **Particles** | Fireflies, golden dust | Rain drops, mist | Dust, leaves | None |
| **Audio** | Ocean waves, birds | Lo-fi ambient | Wind, engine emphasis | Minimal |
| **Sky** | Sunset HDR | Overcast/twilight | Dramatic clouds | Clear blue |

Transitions between vibes are smoothly lerped over ~2 seconds.

### 6. Camera System

Two modes, switchable at any time:

- **Chase Camera** (default): Third-person, positioned behind and above the car. Smooth damped follow with slight lag for cinematic feel. FOV widens at high speed for a sense of velocity.
- **Free Camera**: Detach from car and orbit/zoom freely using mouse/touch. Explore the 3D tiles environment, look at buildings, POIs. Press a button to snap back to chase mode.

### 7. OpenAI-Powered Personalization

The existing 10-question personality test feeds into the OpenAI API to generate a unique vibe configuration for each user:

**Flow:**
1. User completes the personality test (free-form text answers)
2. Answers are sent to OpenAI API with a structured system prompt
3. GPT returns a JSON vibe configuration (lighting values, fog settings, route preference, audio mood, speed suggestion)
4. `VibeManager` applies this as a custom "Your Vibe" preset alongside the standard four
5. As users drive and interact (switching vibes, replaying routes, feedback ratings), their habits refine future AI calls

**Example API response:**
```json
{
  "vibe_name": "Twilight Drift",
  "lighting": { "warmth": 0.8, "intensity": 0.4, "color": "#ff9f6b" },
  "fog": { "density": 0.015, "color": "#2a1a3e" },
  "bloom": { "intensity": 0.3, "threshold": 1.5 },
  "route_preference": "coastal_quiet",
  "speed_suggestion": 35,
  "avoid": ["highways", "busy_intersections"],
  "audio_mood": "ambient_reflective",
  "narration_tone": "calm"
}
```

### 8. Simulated Popular Times Data

POIs along routes display simulated busyness data following realistic patterns (restaurants busy at mealtimes, parks quiet in morning, bars busy at night). This data:
- Color-codes POI markers on the 3D map (green = quiet, red = crowded)
- Feeds into vibe routing: "Chill" avoids busy areas, "Adventure" seeks them
- Shows info cards: "This area is usually quiet at this hour"
- Can be swapped for real data (BestTime.app API) if budget allows

---

## UI Layer (HTML/CSS Overlay)

The entire UI remains as HTML/CSS layered on top of the 3D canvas — same approach as v1 but migrated to TypeScript modules:

- **Cinematic Story Intro**: Year 2126 narrative crawl with typewriter effect
- **Onboarding**: 10 personality questions with voice input support
- **Driving HUD**: Speed display, vibe selector, route cards, drive stats
- **FlowLayer Assistant Panel**: Current vibe, suggested routes, voice commands
- **Modals**: Post-ride feedback, drive playlist, settings

---

## API Keys Required

| Service | Key | Notes |
|---------|-----|-------|
| **Google Maps Platform** | `VITE_GOOGLE_MAPS_API_KEY` | Enable "Map Tiles API" in Cloud Console. 3D Tiles currently in free Preview. |
| **OpenAI** | `VITE_OPENAI_API_KEY` | For GPT-powered vibe generation. Standard API pricing. |

Both stored in `.env` (gitignored).

---

## Development Workflow

```bash
# Install dependencies
cd simulator-v2
npm install

# Start dev server (hot reload)
npm run dev
# Opens at http://localhost:3000

# Production build
npm run build
# Output in simulator-v2/dist/
```

The existing `simulator/` folder is preserved unchanged. The deploy workflow can be updated later to serve `simulator-v2/` instead.

---

## Task Breakdown

| # | Task | Description | Status |
|---|------|-------------|--------|
| 1 | Project scaffold | package.json, Vite config, TypeScript config, index.html | Pending |
| 2 | Google 3D Tiles | Stream photorealistic tiles, coordinate system, camera positioning | Pending |
| 3 | Car controller | Rapier physics vehicle, steering/throttle, keyboard input | Pending |
| 4 | G29 gamepad | Gamepad API polling, axis/button mapping, fallback | Pending |
| 5 | Waypoint routes | GPS waypoints, coordinate conversion, 3D path ribbon | Pending |
| 6 | Vibe system | Per-vibe lighting, fog, post-processing, particles, audio | Pending |
| 7 | Camera system | Third-person chase + free orbit mode | Pending |
| 8 | HUD bridge | Connect 3D state to DOM overlay, migrate UI | Pending |
| 9 | AI vibe engine | OpenAI API integration, personality-to-vibe pipeline | Pending |
| 10 | Story + onboarding | Migrate cinematic intro and personalization to TypeScript | Pending |
| 11 | Integration | Wire all systems together, screen transitions, drive flow | Pending |

---

## Key Dependencies

```json
{
  "dependencies": {
    "@needle-tools/engine": "^4.17.0-alpha",
    "three": "npm:@needle-tools/three@^0.169.19",
    "3d-tiles-renderer": "^0.4.23",
    "openai": "^4.x"
  },
  "devDependencies": {
    "vite": "^5.x",
    "typescript": "^5.x",
    "@types/three": "0.169.0",
    "@vitejs/plugin-basic-ssl": "^1.0.1",
    "vite-plugin-compression": "^0.5.1"
  }
}
```

---

## Why Needle Engine (not plain Three.js)

Needle Engine is built on top of three.js but adds:

- **Component system** — modular `Behaviour` classes instead of tangled global scripts
- **Rapier physics** — built in, zero setup (rigidbodies, colliders, raycasting)
- **Post-processing** — Bloom, SSAO, Depth of Field, Tone Mapping as simple components
- **Spatial audio** — 3D positioned sounds with distance attenuation
- **WebXR** — VR/AR support (Meta Quest, Vision Pro) with zero extra code if we want it later
- **Progressive loading** — automatic LOD and asset streaming
- **Full three.js access** — all three.js APIs still work, plus any three.js library (like 3d-tiles-renderer)

We still write three.js code when we need to — Needle Engine enhances it, not replaces it.
