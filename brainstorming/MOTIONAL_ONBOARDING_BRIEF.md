# Motional Onboarding Brief

This document is for a new AI agent joining the project. It explains what the app is, what the exhibit is, what the `brainstorming` folder already contains, how the simulator fits into the system, and which design decisions already exist in code.

Important naming update:

- `FlowLayer` was the previous app name.
- The app should now be understood as `Motional`.
- The exhibit itself does not need to be renamed by this document.
- In practice, this means older files may still say `FlowLayer`, but conceptually the app brand should now be read as `Motional`.

## Executive Summary

`Motional` is an emotional routing app. Its core idea is simple:

- normal navigation apps optimize for speed and efficiency
- `Motional` optimizes for how a route feels
- users choose a drive based on mood, intention, or experience, not only ETA

The year-end-show installation extends that app into a public experience:

- the app provides the emotional-routing logic
- the simulator provides the embodied driving experience
- the outside screen provides the philosophical and public-facing framing

The exhibit fiction is:

- in the future, nobody drives manually anymore
- manual driving has become obsolete
- the installation reconstructs how people once drove, hesitated, took wrong turns, chose scenic detours, and attached feeling to roads

This means the project has three connected layers:

1. `Motional` the app
2. the simulator, currently centered around the Cesium-based restoration direction
3. the exhibit framing shown to the audience, especially on the outside screen

## Core Product Thesis

The app is not a generic navigation app and not only a driving simulator companion. Its design thesis is:

- the fastest route is not always the best route
- routes have emotional qualities
- roads can feel calm, scenic, intense, easy, adventurous, or draining
- route choice can be treated as a human preference system, not only a logistics problem

The original product logic is built around four route vibes:

- `Fastest`
- `Easy & Chill`
- `Scenic`
- `Adventure`

These vibes were already established in the original landing page and slide deck. They are still important even after the installation pivot. The exhibit should not erase the app concept. It should elevate it.

## Project Structure at a High Level

There are several distinct but related surfaces in this repo:

- root landing page: the original case-study-style product site
- `flowlayer/`: interactive app prototype
- `simulator*` folders: multiple simulator iterations, with the current exhibit-relevant direction centered around the Cesium restore version
- `brainstorming/`: concept work for the installation, especially the outside screen

The `brainstorming` folder is not random notes. It is already the seed of the installation framing layer.

## What the `brainstorming` Folder Contains

### Primary Files

`brainstorming/index.html`

- the current outside-screen page
- built as a public-facing exhibit screen
- introduces the future-archive framing
- cycles through story chapters such as:
  - recovered ritual
  - lost behavior
  - reconstruction machine
  - live archive

`brainstorming/app.js`

- the logic for the outside-screen page
- rotates the conceptual chapters
- manages the chapter progress indicators
- ping-pongs between two looping background videos

`brainstorming/styles.css`

- the dedicated stylesheet for the outside-screen installation page
- contains a more restrained museum-installation visual language than the root landing page
- relies on cool blues, cyan, amber, dark glass surfaces, and monospaced archival labels

`brainstorming/README.md`

- short summary of what the folder is for
- confirms the two-screen installation model:
  - outside screen
  - inside simulator screen

`brainstorming/INSTALLATION_CONCEPTS.md`

- the strongest written articulation of the installation framing so far
- defines the project as a reconstruction of lost manual driving behavior
- identifies several possible framing directions:
  - Museum of Lost Behaviors
  - Traffic Archaeology
  - Driving as Performance
  - Last Manual Driver
  - Archive of the Long Way Home

This file is one of the most important conceptual sources in the repo.

### Prompt Files

`brainstorming/prompts/outside-screen-museum.txt`

- prompt for generating a cinematic concept frame of the outside screen
- emphasizes:
  - future museum exhibit
  - manual driving as lost human practice
  - elegant archival display
  - not a game ad

`brainstorming/prompts/installation-brainstorm.txt`

- asks for installation concepts, naming, queue experience, assistant behavior, and physical staging

`brainstorming/prompts/inside-simulator-hero.txt`

- concept prompt for the interior simulator-facing screen
- describes a premium night-drive interface with route guidance and AI framing

`brainstorming/prompts/veo-outside-intro.txt`

- prompt for a cinematic intro video for the outside screen
- focuses on slow, exhibition-like motion and premium museum tone

### Output Files

`brainstorming/outputs/outside-screen-page-styled.png`

- screenshot of the current outside-screen concept
- useful as a visual reference for layout, mood, scale, and tone

`brainstorming/outputs/API_STATUS.md`

- confirms the local Google Gen AI scripts can authenticate and list models
- also confirms generation is blocked by quota / project access, not by local setup

### Scripts

`brainstorming/scripts/generate-images.mjs`
`brainstorming/scripts/generate-veo.mjs`
`brainstorming/scripts/generate-ideas.mjs`

- tooling for generating visual and concept assets
- not the main product logic
- support material for installation ideation

## The Actual Conceptual Model

The cleanest way to understand the whole system is:

### 1. Motional is the app

The app does the following:

- turns emotional intention into route options
- frames different routes as experiential choices
- gives the user a way to choose how they want the drive to feel

### 2. The simulator is embodiment

The simulator does the following:

- lets the audience inhabit a route physically
- translates route choice into motion, steering, spatial context, and spectacle
- makes the app concept legible in the body

### 3. The outside screen is interpretation

The outside screen does the following:

- explains the fiction to people not yet inside the simulator
- makes the installation readable from a distance
- turns the participant into a public performer
- frames each drive as a recovered human behavior rather than just a demo session

This distinction is critical. Without it, the exhibit can collapse into:

- an app demo
- a student driving setup
- a generic “AI simulator”

The strongest version keeps these roles separate and coordinated.

## How the Simulator Fits the Story

The relevant simulator direction in the repo is the Cesium-based restoration path, especially:

- `SIMULATOR_V3_PLAN.md`
- `SIMULATOR_STATE_REVIEW.md`

The simulator direction already aligns with the installation in several ways:

- real city context
- route-dependent emotional framing
- AI-assisted interpretation
- projector-friendly spectacle
- possibility of steering wheel and motion-chair embodiment

The simulator is not supposed to be a hardcore driving sim. It is a design artifact and public experience. The priorities are:

- legibility
- emotional differentiation between route types
- spatial atmosphere
- stability during exhibition
- spectacle without clutter

The user specifically mentioned the `cesium restore simulator`. That should be treated as the active exhibit-driving core unless directed otherwise.

## What the Outside Screen Is Trying to Do

The current outside screen is already moving in the right direction. It currently emphasizes:

- future archive framing
- manual driving as obsolete
- participant as performer
- installation machine logic:
  - world
  - AI
  - rig
  - participant

The strongest conceptual move here is that manual driving is treated as a lost ritual rather than a routine task.

That makes the waiting audience think in a more reflective way:

- humans once physically steered themselves through cities
- they made wrong turns
- they got stuck
- they chose inefficient routes for emotional reasons
- route choice becomes evidence of human temperament

This is where the project becomes philosophical rather than merely technical.

## Recommended Mental Model for a New Agent

If a new AI agent joins this project, it should not think:

- “I am working on a driving game”
- “I am working on a navigation UI”
- “I am working on a museum title screen”

It should think:

- “I am working on an emotional navigation system called Motional”
- “This system is being expanded into an exhibit about the lost practice of manual driving”
- “Every surface should support either route feeling, embodied driving, or public interpretation”

## Product and Exhibit Relationship

This distinction should stay stable:

### Motional

- app brand
- emotional routing logic
- route vibe system
- AI route interpretation

### Exhibit

- public installation
- future archive framing
- simulator, queue, and outside-screen choreography

### Cesium Restore Simulator

- embodied real-city driving layer
- connected to Motional’s route-selection logic
- used to perform and demonstrate the app’s ideas

## App Naming Update

For onboarding purposes, the current naming rule should be:

- when talking about the app in future-facing product language, say `Motional`
- when reading older files, expect to see `FlowLayer`
- treat those files as historical artifacts unless explicitly asked to rename them in code

This means a new agent should mentally translate:

- `FlowLayer` -> old brand name
- `Motional` -> current app name

## Design System: Source of Truth

The visual source of truth for the original app/landing-page design system is primarily:

- `C:\Users\HAMZA\Desktop\Flowlayer\styles.css`
- `C:\Users\HAMZA\Desktop\Flowlayer\app.js`
- `C:\Users\HAMZA\Desktop\Flowlayer\index.html`

The visual source of truth for the outside-screen installation layer is:

- `C:\Users\HAMZA\Desktop\Flowlayer\brainstorming\styles.css`
- `C:\Users\HAMZA\Desktop\Flowlayer\brainstorming\index.html`
- `C:\Users\HAMZA\Desktop\Flowlayer\brainstorming\app.js`

The agent should understand both systems because the installation grows out of the app. But the user specifically asked for the design system from the original landing page, so that is documented below with code excerpts.

## Motional Landing Page Design System

### Core Brand Character

The original app site uses a premium, dark, futuristic design language. It is more product-brand expressive than the outside-screen page.

Its key qualities are:

- dark mode first
- emotionally coded accent colors
- large high-contrast typography
- strong gradient usage
- glassy surfaces and subtle borders
- motion and parallax for atmosphere

### Design Tokens From Code

From `styles.css`:

```css
:root {
    --bg-dark: #050508;
    --bg-darker: #020203;
    --bg-card: rgba(255, 255, 255, 0.02);
    --bg-card-hover: rgba(255, 255, 255, 0.04);
    --border-subtle: rgba(255, 255, 255, 0.06);
    --border-medium: rgba(255, 255, 255, 0.1);
    
    --cyan: #00f5d4;
    --purple: #9b5de5;
    --blue: #4361ee;
    --pink: #f72585;
    --orange: #ff9f1c;
    --green: #06d6a0;
    
    --text-primary: #ffffff;
    --text-secondary: rgba(255, 255, 255, 0.7);
    --text-dim: rgba(255, 255, 255, 0.4);
    --text-muted: rgba(255, 255, 255, 0.25);
    
    --font-display: 'Syne', sans-serif;
    --font-body: 'DM Sans', sans-serif;
    --font-mono: 'JetBrains Mono', monospace;
    
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

This token block explains most of the visual system:

- background is near-black, not neutral gray
- cards are translucent and soft, not flat panels
- borders are subtle and atmospheric
- each route vibe gets a distinct accent color
- typography is split into display, body, and mono roles
- motion uses custom easing instead of default browser timing

### Color Logic

The main app color system is emotion-based, not merely decorative:

- `--cyan`: chill / clarity / primary hero accent
- `--orange`: fastest / energy / directness
- `--green`: scenic / nature / softness
- `--pink`: adventure / intensity / discovery
- `--purple`: premium layer / AI / futuristic accent
- `--blue`: supporting tech accent and gradient support

This mapping is reinforced in the content of the site and slide deck. The colors are not arbitrary branding. They are part of the route model.

### Typography

The type system in the landing page is:

- `Syne` for major brand and display moments
- `DM Sans` for body copy and interface readability
- `JetBrains Mono` for labels, data, and system language

This creates a three-tier tone:

- expressive
- readable
- technical

Example from the landing page CSS:

```css
.hero-title {
    font-family: var(--font-display);
    font-size: clamp(48px, 8vw, 80px);
    font-weight: 700;
    line-height: 1.1;
}

.hero-subtitle {
    font-size: 18px;
    color: var(--text-secondary);
    line-height: 1.7;
}

.preview-header {
    display: flex;
    justify-content: space-between;
    font-family: var(--font-mono);
    font-size: 12px;
    color: var(--text-secondary);
}
```

### Signature Hero Treatment

The app landing page hero establishes the product’s visual identity. Important ingredients:

- radial gradient atmosphere
- faint grid structure
- floating vibe icons
- huge `Syne` typography
- multicolor gradient text for emotional futurism
- app-preview phone mockup

Key code:

```css
.hero-gradient {
    position: absolute;
    inset: 0;
    background: 
        radial-gradient(ellipse at 20% 30%, rgba(0, 245, 212, 0.12) 0%, transparent 50%),
        radial-gradient(ellipse at 80% 70%, rgba(155, 93, 229, 0.1) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 100%, rgba(67, 97, 238, 0.08) 0%, transparent 40%);
}

.gradient-text {
    background: linear-gradient(135deg, var(--cyan) 0%, var(--purple) 50%, var(--pink) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}
```

This is the clearest expression of the old `FlowLayer`, now `Motional`, brand language.

### Buttons and Interaction Surfaces

Buttons use three distinct levels:

- bold primary gradient CTA
- subtle glass secondary button
- simulator-specific green button

Example:

```css
.btn-primary {
    background: linear-gradient(135deg, var(--cyan) 0%, var(--blue) 100%);
    color: var(--bg-dark);
    box-shadow: 0 4px 24px rgba(0, 245, 212, 0.3);
}

.btn-secondary {
    background: var(--bg-card);
    border: 1px solid var(--border-medium);
    color: var(--text-primary);
}

.btn-simulator {
    background: rgba(6, 214, 160, 0.12);
    border: 1px solid rgba(6, 214, 160, 0.45);
    color: #8bffe0;
}
```

This tells a new agent that the system already uses clear visual hierarchy for action types.

### Card System

The card pattern is consistent across:

- problem cards
- vibe cards
- feature cards
- result cards
- learning cards

The card language is:

- translucent
- softly bordered
- rounded
- elevated on hover
- color-activated by theme or accent

Example vibe-card pattern:

```css
.vibe-card-large {
    padding: 32px 24px;
    background: var(--bg-card);
    border: 2px solid var(--border-subtle);
    border-radius: 24px;
    transition: all 0.4s var(--ease-out);
    position: relative;
    overflow: hidden;
}

.vibe-card-large::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--vibe-color);
    transform: scaleX(0);
    transition: transform 0.4s ease;
}
```

This is a useful reusable motif for future design work.

### Motion System

The landing page relies on motion to feel premium rather than static. It uses:

- fade-in-up sequences
- fade-in-right hero reveal
- count-up stats
- cursor glow interpolation
- hover elevation
- section reveal via intersection observer
- mild parallax on floating icons

Important JavaScript patterns from `app.js`:

```js
document.addEventListener('DOMContentLoaded', () => {
    initCursorGlow();
    initSmoothScroll();
    initScrollAnimations();
    initNavHighlight();
    initParallaxEffects();
    initVibeCardHover();
    initCountUpAnimations();
});
```

And the animation-injection pattern:

```js
const style = document.createElement('style');
style.textContent = `
    .animate-element {
        opacity: 0;
        transform: translateY(30px);
        transition: opacity 0.8s cubic-bezier(0.23, 1, 0.32, 1), 
                    transform 0.8s cubic-bezier(0.23, 1, 0.32, 1);
    }
    
    .animate-element.animate-in {
        opacity: 1;
        transform: translateY(0);
    }
`;
document.head.appendChild(style);
```

This tells a new agent that the site is not supposed to feel inert. Motion is part of the brand.

### Layout System

The landing page layout language is:

- large horizontal sections
- generous side padding
- wide grids
- big content blocks broken into digestible cards
- large hero plus structured sections below

Important spacing and container rules:

```css
.section {
    padding: 120px 0;
    position: relative;
}

.section-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 0 60px;
}
```

The site is clearly designed for strong presentation-scale viewing, not cramped dashboard density.

## Outside-Screen Design System

The outside-screen page intentionally departs from the original app branding. It is still related, but the tone is more archival and installation-like.

From `brainstorming/styles.css`:

```css
:root {
  --bg: #040710;
  --surface: rgba(9, 14, 22, 0.72);
  --surface-strong: rgba(8, 13, 20, 0.88);
  --border: rgba(179, 219, 255, 0.16);
  --border-soft: rgba(179, 219, 255, 0.08);
  --text: #edf6ff;
  --text-soft: rgba(237, 246, 255, 0.76);
  --text-muted: rgba(208, 225, 245, 0.46);
  --cyan: #67e8f9;
  --blue: #60a5fa;
  --amber: #fbbf24;
  --shadow: 0 24px 80px rgba(0, 0, 0, 0.36);
}
```

Compared to the main site:

- purple and pink are largely removed
- cyan and blue dominate
- amber becomes a restrained support color
- the mood is less “product reveal” and more “museum installation”

Typography shifts too:

- `Syne` remains for major titles
- `Inter` becomes the main readable body face
- `Geist Mono` becomes the archival/systems layer

This is the correct direction for the queue-facing exhibit screen.

## Relationship Between the Two Design Systems

A new agent should understand the two systems as related but not identical:

### Motional app design system

- expressive
- premium
- emotionally coded
- vibrant
- startup-meets-concept-product energy

### Outside-screen exhibit system

- restrained
- institutional
- speculative
- architectural
- designed for distance readability and philosophical framing

The outside screen should inherit from the app, but it should not simply restyle the landing page one-to-one.

## Existing Story Chapters on the Outside Screen

From `brainstorming/app.js`, the current screen cycles through these chapter ideas:

- `Driving, Before Automation`
- `Humans Once Steered by Feeling`
- `Wheel, Chair, City, AI`
- `Real Routes. Real Places. Interpretive Intelligence.`
- `Each Participant Performs a Recovered Habit`

This is already a good structure for onboarding. It defines:

- the fiction
- the human behavior
- the machine stack
- the technical claim
- the live-public framing

## What a New Agent Should Preserve

The following ideas are already strong and should be preserved unless the user explicitly changes them:

- manual driving as a lost future behavior
- route choice as emotional logic
- public audience plus waiting-line context
- simulator as performance, not just interaction
- outside screen as philosophical and explanatory layer
- wheel and motion chair as ceremonial hardware
- real city context through the Cesium-based simulator direction

## What a New Agent Can Change Freely

A new agent can likely explore these areas:

- new copywriting for the outside screen
- better naming for route personas or archive labels
- revised outside-screen section choreography
- stronger queue-state logic
- better relationship between live participant telemetry and poetic language
- renaming `FlowLayer` references to `Motional` when asked
- cleaner separation between app language and exhibit language

## Recommended Content Hierarchy for Future Work

When working on the outside-screen page, prioritize information in this order:

1. big idea
2. current participant / current session
3. why this matters philosophically
4. how the installation is built
5. archive or queue context

Do not let the page become:

- too dashboard-like
- too lore-heavy
- too text-dense
- too much like a product landing page

## Suggested One-Sentence Internal Description

Use this as the shortest accurate mental model:

`Motional is an emotional routing app that has been extended into a future-archive driving installation, where a Cesium-based simulator reconstructs manual driving as a lost human ritual.`

## Key Source Files for a New Agent

Read these first:

- `C:\Users\HAMZA\Desktop\Flowlayer\brainstorming\INSTALLATION_CONCEPTS.md`
- `C:\Users\HAMZA\Desktop\Flowlayer\brainstorming\index.html`
- `C:\Users\HAMZA\Desktop\Flowlayer\brainstorming\app.js`
- `C:\Users\HAMZA\Desktop\Flowlayer\brainstorming\styles.css`
- `C:\Users\HAMZA\Desktop\Flowlayer\SLIDE_DECK_CONCEPT.md`
- `C:\Users\HAMZA\Desktop\Flowlayer\SIMULATOR_V3_PLAN.md`
- `C:\Users\HAMZA\Desktop\Flowlayer\SIMULATOR_STATE_REVIEW.md`
- `C:\Users\HAMZA\Desktop\Flowlayer\index.html`
- `C:\Users\HAMZA\Desktop\Flowlayer\styles.css`
- `C:\Users\HAMZA\Desktop\Flowlayer\app.js`

## Final Guidance

If you are a new AI agent working on this project, assume the following unless told otherwise:

- the app is now called `Motional`
- the emotional routing concept is still the foundation
- the exhibit is about manual driving becoming obsolete in the future
- the outside screen should feel thoughtful, cinematic, and museum-grade
- the simulator should embody route feeling, not just vehicle movement
- the design system for the app already exists in code and should be reused intentionally rather than reinvented

The most important strategic rule is this:

- do not treat the installation and the app as separate unrelated ideas
- treat the installation as the public, physical, and philosophical extension of `Motional`

