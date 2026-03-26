# FlowLayer Simulator v3 - Real City Plan

**Hamza & Yaroslav | Interactive Systems Project 2**  
**Last updated: March 2026**

---

## Overview

`sim-v3` is the next version of the FlowLayer driving simulator. It keeps the most important ambition from `v2` - driving through a **real city in 3D** - but changes the world strategy so the project is more stable, more presentable, and more aligned with FlowLayer's emotional design thesis.

Instead of depending on Google photorealistic city mesh as the core experience, `v3` should be built around **Cesium OSM Buildings** and a curated road-driving layer inside Needle Engine. The result is still a real city, but one that is cleaner, easier to art direct, and better suited to a third-person driving experience.

The goal is not to make a generic car simulator. The goal is to make a **profound extension of the FlowLayer app**: a driving experience where route choice, atmosphere, and city context respond to how the user wants to feel.

---

## Core Thesis

FlowLayer is based on one simple but powerful idea:

> The best route is not always the fastest one.  
> The best route is the one that matches how you want to feel.

`sim-v3` turns that idea into a playable PC experience:

- The user enters a real urban environment.
- They drive in **third person**, like a modern driving game.
- The city is not just background scenery. It becomes an emotional medium.
- Route options reflect different vibes like `Fast`, `Chill`, `Scenic`, and `Adventure`.
- AI helps explain and personalize the experience, but does not replace the design.

This version should feel like a **design artifact**, not just a technical demo.

---

## Why V3 Changes Direction

`v2` proved several important things:

- Needle Engine + Vite is a workable foundation.
- A third-person web driving simulator is the right interaction model.
- Real-city context is much more compelling than a fully fictional world.
- Steering wheel support is important for the final exhibition version.

But `v2` also exposed major risks:

- Google photoreal city tiles are visually impressive but fragile in this stack.
- Photogrammetry mesh is hard to use as a reliable drivable surface.
- The world becomes difficult to control artistically.
- Camera, spawn, and road alignment issues make presentation quality unpredictable.

`v3` should therefore keep the **real city** requirement while shifting to a world source that is more controllable and more compatible with a game-like third-person driving setup.

---

## World Strategy

### Recommended World Source

Use **Cesium OSM Buildings** as the base real-city layer.

This gives the project:

- Real city structure and recognizable urban form
- Global building coverage
- Cleaner geometry than photogrammetry mesh
- Better compatibility with custom roads, route ribbons, and chase cameras
- More visual control over lighting, fog, mood, and overlays

### What This Means Visually

`v3` will not look like a raw Google Earth clone.  
It will look like a **designed real city experience**:

- Real building massing
- Real street logic
- Curated routes
- Strong lighting direction
- Emotional color systems
- A cinematic game camera

That is a better fit for an IxDA-style presentation because it reads as an intentional concept, not just a streamed map.

---

## Experience Pillars

### 1. Real City, Not Generic Space

The simulator must feel grounded in a specific city. Toronto is still a strong anchor because:

- it connects to the routes already explored in `v2`
- waterfront, skyline, and urban variation support multiple vibes
- it supports the "City of Experiences" framing well

### 2. Third-Person Driving First

The default view should feel like a driving game such as GTA:

- chase camera by default
- lower field of view than the current prototype
- camera placed low and close behind the vehicle
- smooth follow, but responsive enough to feel playable
- free camera remains optional, not primary

### 3. FlowLayer as Emotional Navigation

The simulator should not only ask "Where do you want to go?"
It should ask:

- What kind of drive do you need right now?
- What should this journey feel like?
- What route would support that feeling?

### 4. Presentation-Ready Atmosphere

The environment should communicate emotion through:

- lighting
- sky color
- fog
- sound
- route highlighting
- POI emphasis
- pacing and visual calm or intensity

---

## Product Vision

`sim-v3` is a **companion experience** to the FlowLayer app.

The mobile or desktop FlowLayer interface helps the user choose a vibe and route intention. The simulator then lets them inhabit that route physically through play. This creates a stronger demo than a static UI prototype because the audience can feel the idea in motion.

The simulator should answer the question:

**What would it feel like if navigation were designed around emotional outcome instead of only efficiency?**

---

## Proposed Tech Stack

| Layer | Technology | Purpose |
|------|------------|---------|
| Engine | Needle Engine + Vite + TypeScript | Main runtime and project structure |
| Real city layer | Cesium OSM Buildings | Real 3D city buildings |
| Optional terrain/context | Cesium terrain or simplified ground layer | Additional depth where needed |
| Roads and route layer | Custom road splines / simplified drivable network | Reliable driving surface |
| Vehicle input | Gamepad API + keyboard fallback | Logitech G29 and standard controls |
| Personalization AI | Gemini API | Vibe generation, route framing, narrative assistance |
| Grounding | Gemini with Google Search grounding | Live city context, POI summaries, current relevance |
| UI | HTML/CSS overlay + Needle scene state bridge | HUD, route cards, vibe controls |

---

## High-Level Architecture

```text
User onboarding -> FlowLayer vibe selection -> Gemini interpretation
                                      -> route intent + emotional profile

Cesium OSM Buildings -> real city form
Custom road layer    -> drivable gameplay surface
Needle Engine        -> car, camera, scene, route visualization, mood systems
HUD/UI               -> route selection, metrics, vibe switching, assistant prompts
Gamepad API          -> steering wheel / pedals / keyboard fallback
Gemini grounding     -> city-aware route descriptions, POI meaning, contextual prompts
```

The important separation is this:

- **Cesium provides city context**
- **Needle provides the game experience**
- **Gemini provides interpretation and personalization**

---

## Core Systems

### 1. Real City Scene Layer

Cesium OSM Buildings should provide the urban massing layer for the city.

Use it for:

- skyline
- street walls
- district identity
- urban depth
- recognizable city form

Do not treat it as the main drivable surface.

### 2. Drivable Road System

The drivable road layer should be authored separately from the buildings.

This is critical.

Instead of trying to drive directly on raw streamed city geometry, `v3` should use:

- simplified road meshes
- route-aligned splines
- curated drivable corridors
- invisible collision lanes if needed

This makes the simulator controllable and exhibition-safe.

### 3. Car Controller

The car system should prioritize feel over realism.

Requirements:

- responsive acceleration and braking
- readable turning behavior
- stable low-speed control
- easy keyboard fallback
- steering wheel compatibility for final presentation

This should feel like an accessible driving game, not a hardcore simulator.

### 4. Camera System

The camera must support the whole concept.

Primary mode:

- `Chase`
- default mode on load
- lower FOV
- low and close follow framing
- tuned for city readability

Secondary mode:

- `Free`
- for looking around and presenting the city

The camera should never feel like a detached map viewer by default.

### 5. Route Experience System

Routes should still be organized around the four FlowLayer vibes:

- `Fast`
- `Chill`
- `Scenic`
- `Adventure`

Each route should differ in:

- pacing
- path geometry
- district choice
- POI emphasis
- visual atmosphere
- assistant narration

This preserves the core FlowLayer promise: same destination, different emotional experience.

### 6. Vibe Manager

The city should transform based on mood.

Examples:

- `Chill`: softer blue lighting, lower contrast, quieter districts, gentler sound
- `Scenic`: warm light, open waterfront framing, landmark emphasis
- `Adventure`: sharper contrast, stronger accent colors, more surprising route moments
- `Fast`: cleaner visuals, stronger lane guidance, less atmospheric distraction

The vibe system is what makes this a FlowLayer simulator rather than only a city driver.

### 7. Gemini Layer

Gemini should be used for high-value interpretive features, not gimmicks.

Best uses:

- generating a short personalized vibe summary after onboarding
- reframing route options in emotional language
- surfacing city context with grounding
- describing neighborhoods, landmarks, and route tradeoffs
- adapting suggestions based on user responses and habits

Avoid using Gemini for:

- low-level control logic
- physics
- camera behavior
- anything that must be deterministic every frame

### 8. Contextual Grounding

Gemini grounding can support the "City of Experiences" story by bringing live or current relevance into the route layer.

Examples:

- why a district feels busy right now
- what makes a place culturally meaningful
- suggestions for emotionally aligned stops
- contextual previews before the drive starts

This helps the simulator feel more intelligent without overcomplicating the core gameplay.

---

## Design Direction

The visual system should inherit from the slide deck language:

- dark mode first
- cyan, orange, pink, green, and purple as emotional accent colors
- premium and minimal UI
- strong white space
- motion-ready transitions

The city should feel:

- futuristic
- emotionally intelligent
- elegant
- legible on a projector or large screen

This is not a gritty sim.  
It is a polished design prototype with game-like interaction.

---

## Example Exhibition Flow

1. The audience sees the FlowLayer interface asking how the user wants to feel.
2. A vibe is selected, such as `Scenic` or `Chill`.
3. Gemini generates a short explanation of the route approach.
4. The simulator opens into a real 3D city in third person.
5. The user drives a curated route using keyboard or steering wheel.
6. The city atmosphere shifts to match the chosen vibe.
7. The route reveals a different emotional reading of the city.

This is much stronger than showing a flat route map alone.

---

## MVP Scope

The first playable `sim-v3` should include only the systems that are essential to proving the concept.

### MVP Features

- real 3D city layer using Cesium OSM Buildings
- one city area
- one drivable car
- third-person chase camera by default
- keyboard driving
- basic steering wheel support
- four vibes
- three curated routes
- simple HUD
- Gemini-generated vibe summary

### Nice-to-Have Later

- richer POI interactions
- route comparison previews
- dynamic city pulse overlays
- replay mode
- social route sharing
- voice interaction

---

## Production Phases

### Phase 1 - Foundation

- clone `simulator-v2` into `sim-v3`
- remove Google 3D tile dependency
- integrate Cesium OSM Buildings
- keep Needle/Vite project structure
- restore a stable third-person car loop

### Phase 2 - Drivable City

- create a reliable road-driving layer
- place the car correctly on route start
- tune chase camera and low FOV
- confirm keyboard and wheel input

### Phase 3 - FlowLayer Identity

- reapply vibe system with stronger art direction
- build route selection logic around emotional outcomes
- redesign HUD for clarity and presentation polish

### Phase 4 - Intelligence Layer

- integrate Gemini personalization
- add grounding-backed route descriptions and city context
- support short assistant prompts and previews

### Phase 5 - Exhibition Polish

- smooth transitions
- route intro moments
- soundscape tuning
- projector-safe UI
- fail-safe demo flow

---

## Risks And Mitigations

### Risk: Cesium buildings look too abstract

Mitigation:

- lean into art direction instead of chasing photorealism
- use lighting, sound, and route design to create emotional richness

### Risk: Real roads are still hard to drive

Mitigation:

- decouple roads from building source
- build a curated drivable layer

### Risk: The simulator becomes just "car in city"

Mitigation:

- keep the FlowLayer vibe system at the center
- make every route emotionally distinct
- use Gemini only where it deepens meaning

### Risk: Too much scope before presentation

Mitigation:

- define MVP clearly
- prioritize one polished city slice over large coverage

---

## Final Recommendation

`sim-v3` should be positioned as:

**A real-city, third-person emotional driving experience that extends the FlowLayer app into a playable design prototype.**

The strongest version is not the most photoreal one.  
The strongest version is the one that:

- clearly communicates the FlowLayer idea
- feels playable and legible
- looks intentional in a design presentation
- runs reliably in a live demo

That is why the recommended path is:

**Needle Engine + Vite + Cesium OSM Buildings + curated road layer + Gemini personalization and grounding**

---

## One-Sentence Pitch

FlowLayer Simulator v3 is a third-person driving experience set in a real 3D city, where routes and atmosphere adapt to how the user wants to feel rather than only where they want to go.

