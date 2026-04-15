const chapters = [
  {
    kicker: "THE EXHIBIT",
    title: 'Nobody Drives <em>Anymore</em>',
    body: "Manual driving disappeared decades ago. This simulator lets you try it — sit down, grab the wheel, and steer yourself through a real city. No autopilot. No routing algorithm. Just you, the road, and whatever you decide to do with it.",
    vibe: "CURIOUS",
    cards: [
      { label: "LAST MANUAL DRIVER", val: "2071" },
      { label: "SESSION LENGTH", val: "~5 MIN" },
      { label: "VISITORS TODAY", val: "38" },
    ]
  },
  {
    kicker: "THE BEHAVIOR",
    title: 'Driving Was <em>Strange</em>',
    body: "People sat in metal boxes and navigated traffic for hours every day. They got lost. They took wrong turns on purpose. They picked the slow road because it looked nice. None of this was efficient, and all of it mattered.",
    vibe: "NOSTALGIC",
    cards: [
      { label: "AVG DAILY COMMUTE", val: "41 MIN" },
      { label: "GLOBAL DRIVERS (2025)", val: "1.4B" },
      { label: "ROAD RAGE INCIDENTS/YR", val: "1,800+" },
    ]
  },
  {
    kicker: "THE MACHINE",
    title: 'Built to <em>Feel Real</em>',
    body: "Built on CesiumJS — a geospatial 3D engine that renders real cities at 1:1 scale using satellite imagery, world terrain, and OpenStreetMap building data as 3D Tiles. Google Routes API computes the raw route, then Gemini 3.1 Pro with Google Maps grounding augments it with context — street history, landmarks, what's around the next corner.",
    vibe: "READY",
    cards: [
      { label: "3D ENGINE", val: "CESIUMJS" },
      { label: "BUILDINGS", val: "OSM 3D TILES" },
      { label: "TERRAIN", val: "WGS84 GLOBE" },
    ]
  },
  {
    kicker: "THE ROUTE",
    title: 'Real Roads, <em>Real Cities</em>',
    body: "Google Routes API computes the raw route — real turn-by-turn directions on real roads. That route data is then augmented by Gemini 3.1 Pro with Google Maps grounding, which layers in context about what you're passing, where you are, and what makes each stretch interesting. A Leaflet mini-map tracks your position live.",
    vibe: "ANALYTICAL",
    cards: [
      { label: "ROUTING", val: "GOOGLE API" },
      { label: "ROAD DATA", val: "OSM EXTRACT" },
      { label: "AI NAV", val: "GEMINI 3.1 PRO" },
    ]
  },
  {
    kicker: "THE CALIBRATION",
    title: 'Tell Us How <em>You Drive</em>',
    body: "Before you drive, we ask a few questions. Not a test — a conversation about how you want this to feel. Your answers feed a personalization engine that picks your route type, time of day, and driving vibe. Scenic coastline or fastest highway. Golden hour or midnight. It's your call.",
    vibe: "PERSONAL",
    cards: [
      { label: "QUESTIONS", val: "3–5" },
      { label: "MODES", val: "SCENIC · RUSH · ZEN" },
      { label: "PERSONALIZATION", val: "REAL-TIME" },
    ]
  }
];

const prompts = [
  { text: "How do you want this drive to feel?", chips: ["Scenic and slow", "Fast and direct", "Calm and quiet", "Surprise me"] },
  { text: "What kind of road sounds right?", chips: ["Coastal highway", "Mountain pass", "City streets", "Quiet backroads"] },
  { text: "What are you in the mood for?", chips: ["Something beautiful", "Something intense", "Something unfamiliar", "I just want to drive"] },
  { text: "Pick a time of day.", chips: ["Golden hour", "Night", "Early morning", "High noon"] },
  { text: "What would make this drive worth it?", chips: ["A great view", "The feeling of speed", "Getting lost somewhere", "Arriving different"] },
  { text: "What kind of energy do you want?", chips: ["Relaxed", "Focused", "Adventurous", "Meditative"] },
  { text: "Fastest route or the scenic one?", chips: ["Fastest", "Scenic", "Whichever looks better", "I don't care"] },
  { text: "When this drive ends, how should you feel?", chips: ["Calm", "Awake", "Reset", "Like I went somewhere"] }
];

const quotes = [
  "The average commute in 2025 was 41 minutes. Most people hated it.",
  "A 'scenic route' meant choosing a road because it was pretty, not fast.",
  "People got angry at other drivers. This was called 'road rage.'",
  "'Are we there yet?' — something children said from the back seat.",
  "GPS told you the fastest way. You ignored it sometimes.",
  "Parking meant leaving your car somewhere and hoping nobody hit it.",
  "Rush hour. Twice a day, every road became useless."
];

const CHAPTER_MS = 15000;
const PROMPT_AUTO_MS = 20000;
let cur = 0, chapterTimer = null, quoteIdx = 0;
let promptIdx = 0, promptTimer = null;

const queue_list = [];
const EST_MINUTES_PER = 5;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const dom = {
  loader: $("#loader"), hud: $("#hud"),
  kickerText: $("#kickerText"), kickerNum: $(".kicker-num"),
  title: $("#title"), body: $("#body"),
  progress: $("#progress"), grain: $("#grain"), clock: $("#clock"),
  quote: $("#quote"), ringNum: $("#ringNum"),
  telemVibe: $("#telemVibe"),
  vidFwd: $("#vidFwd"), vidRev: $("#vidRev"),
  particles: $("#particles"),
  prompt: $("#prompt"), promptChips: $("#promptChips"),
  answerInput: $("#answerInput"), micBtn: $("#micBtn"), transcript: $("#transcript"),
  startBtn: $("#startBtn"),
  nameInput: $("#nameInput"), joinBtn: $("#joinBtn"),
  queueCount: $("#queueCount"), queueWait: $("#queueWait"),
  queueNames: $("#queueNames"),
  colNarrative: $("#colNarrative"), colSim: $("#colSim"), colInteract: $("#colInteract"),
  cards: $("#cards"),
};

let activeVid = dom.vidFwd, idleVid = dom.vidRev;

/* ── Text scramble decode ────────────────────── */

function scramble(el, text, duration = 900) {
  const pool = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  const plain = text.replace(/<[^>]+>/g, "");
  const len = plain.length;
  const start = performance.now();

  return new Promise(resolve => {
    (function tick() {
      const t = Math.min((performance.now() - start) / duration, 1);
      let out = "";
      let pi = 0;
      for (let i = 0; i < text.length; i++) {
        if (text[i] === "<") {
          const close = text.indexOf(">", i);
          out += text.slice(i, close + 1);
          i = close;
          continue;
        }
        const ch = text[i];
        const threshold = pi / len;
        if (ch === " " || ch === "." || ch === "," || ch === "'" || ch === "?" || ch === "—" || t > threshold + 0.3) {
          out += ch;
        } else {
          out += pool[(Math.random() * pool.length) | 0];
        }
        pi++;
      }
      el.innerHTML = out;
      if (t < 1) requestAnimationFrame(tick);
      else { el.innerHTML = text; resolve(); }
    })();
  });
}

/* ── Particles ───────────────────────────────── */

function initParticles() {
  const c = dom.particles;
  if (!c) return;
  const ctx = c.getContext("2d");
  let w, h;
  const pts = [];
  const N = 50;

  function resize() { w = c.width = window.innerWidth; h = c.height = window.innerHeight; }
  resize();
  window.addEventListener("resize", resize);

  for (let i = 0; i < N; i++) {
    pts.push({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - .5) * .25,
      vy: -(Math.random() * .15 + .05),
      r: Math.random() * 1.2 + .4,
      a: Math.random() * .25 + .08,
    });
  }

  (function draw() {
    ctx.clearRect(0, 0, w, h);
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy;
      if (p.y < -10) { p.y = h + 10; p.x = Math.random() * w; }
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,245,212,${p.a})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  })();
}

/* ── Film grain ──────────────────────────────── */

function initGrain() {
  const c = dom.grain; if (!c) return;
  const ctx = c.getContext("2d");
  let w, h;
  function resize() { w = c.width = window.innerWidth / 2; h = c.height = window.innerHeight / 2; }
  function draw() {
    const d = ctx.createImageData(w, h);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      d.data[i] = d.data[i+1] = d.data[i+2] = v; d.data[i+3] = 12;
    }
    ctx.putImageData(d, 0, 0);
  }
  resize(); window.addEventListener("resize", resize);
  let f = 0;
  (function loop() { f++; if (f % 4 === 0) draw(); requestAnimationFrame(loop); })();
}

/* ── Clock (+100 years) ──────────────────────── */

function initClock() {
  function tick() {
    const n = new Date();
    const futureYear = n.getFullYear() + 100;
    const time = n.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const month = n.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase();
    dom.clock.textContent = `${time}  ·  ${month} ${futureYear}`;
  }
  tick(); setInterval(tick, 1000);
}

/* ── Quote rotation ──────────────────────────── */

function cycleQuote() {
  quoteIdx = (quoteIdx + 1) % quotes.length;
  gsap.to(dom.quote, { opacity: 0, duration: .3, onComplete() {
    dom.quote.textContent = `"${quotes[quoteIdx]}"`;
    gsap.to(dom.quote, { opacity: 1, duration: .4 });
  }});
}

/* ── Progress ────────────────────────────────── */

function buildProgress() {
  dom.progress.innerHTML = "";
  chapters.forEach(() => {
    const b = document.createElement("div");
    b.className = "prog-bar";
    b.innerHTML = '<div class="prog-fill"></div>';
    dom.progress.appendChild(b);
  });
}

function updateProgress(i) {
  $$(".prog-bar").forEach((b, idx) => {
    b.classList.remove("active", "past");
    b.querySelector(".prog-fill").style.animation = "none";
    if (idx < i) b.classList.add("past");
    else if (idx === i) {
      b.classList.add("active");
      const f = b.querySelector(".prog-fill");
      void f.offsetWidth; f.style.animation = "";
    }
  });
}

/* ── Chapter transitions ─────────────────────── */

function renderCards(cards) {
  dom.cards.innerHTML = "";
  cards.forEach((c, ci) => {
    const el = document.createElement("div");
    el.className = "info-card";
    el.innerHTML = `<span class="info-label">${c.label}</span><span class="info-val">${c.val}</span>`;
    el.style.opacity = "0";
    dom.cards.appendChild(el);
    gsap.to(el, { opacity: 1, duration: .35, delay: .7 + ci * .1 });
  });
}

function showChapter(i) {
  const ch = chapters[i];
  const num = String(i + 1).padStart(2, "0");

  dom.kickerNum.textContent = num;
  dom.ringNum.textContent = num;
  dom.telemVibe.textContent = ch.vibe;

  dom.body.textContent = ch.body;
  updateProgress(i);
  renderCards(ch.cards);

  scramble(dom.kickerText, ch.kicker, 400);
  scramble(dom.title, ch.title, 1000);

  const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
  tl.fromTo(dom.body, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .6 }, .5);

  return tl;
}

function hideChapter() {
  const tl = gsap.timeline({ defaults: { ease: "power2.in" } });
  tl.to(dom.cards.children, { opacity: 0, duration: .15, stagger: .03 }, 0);
  tl.to(dom.body, { opacity: 0, duration: .2 }, 0);
  tl.to(dom.title, { opacity: 0, duration: .25 }, .04);
  tl.to(dom.kickerText, { opacity: 0, duration: .15 }, .06);
  return tl;
}

async function nextChapter() {
  cur = (cur + 1) % chapters.length;
  await hideChapter();
  gsap.set([dom.title, dom.kickerText], { opacity: 1 });
  showChapter(cur);
  cycleQuote();
}

function startChapterLoop() {
  if (chapterTimer) clearInterval(chapterTimer);
  chapterTimer = setInterval(nextChapter, CHAPTER_MS);
}

/* ── Prompts ─────────────────────────────────── */

function showPrompt(i) {
  const p = prompts[i];
  scramble(dom.prompt, p.text, 700);

  dom.promptChips.innerHTML = "";
  p.chips.forEach((label, ci) => {
    const btn = document.createElement("button");
    btn.className = "dock-chip";
    btn.textContent = label;
    btn.style.opacity = "0";
    btn.addEventListener("click", () => pickChip(btn, i));
    dom.promptChips.appendChild(btn);
    gsap.to(btn, { opacity: 1, duration: .3, delay: .4 + ci * .07 });
  });
}

function pickChip(btn) {
  btn.classList.add("picked");
  clearTimeout(promptTimer);
  setTimeout(() => nextPrompt(), 1200);
}

function nextPrompt() {
  promptIdx = (promptIdx + 1) % prompts.length;
  gsap.to([dom.prompt, dom.promptChips], { opacity: 0, duration: .25, onComplete() {
    gsap.set([dom.prompt, dom.promptChips], { opacity: 1 });
    showPrompt(promptIdx);
  }});
  startPromptTimer();
}

function startPromptTimer() {
  clearTimeout(promptTimer);
  promptTimer = setTimeout(nextPrompt, PROMPT_AUTO_MS);
}

function submitAnswer(text) {
  if (!text.trim()) return;
  dom.transcript.textContent = `"${text.trim()}"`;
  dom.answerInput.value = "";
  gsap.fromTo(dom.transcript, { opacity: 0 }, { opacity: .7, duration: .3 });
  clearTimeout(promptTimer);
  setTimeout(() => nextPrompt(), 2000);
}

/* ── Speech recognition ──────────────────────── */

let recognition = null;
let isListening = false;

function initSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    dom.micBtn.style.opacity = ".3";
    dom.micBtn.style.cursor = "default";
    dom.micBtn.title = "Speech not supported in this browser";
    return;
  }

  recognition = new SR();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = "en-US";

  recognition.onresult = (e) => {
    const text = [...e.results].map(r => r[0].transcript).join("").trim();
    dom.answerInput.value = text;
    if (e.results[0].isFinal) {
      stopListening();
      submitAnswer(text);
    }
  };

  recognition.onerror = () => stopListening();
  recognition.onend = () => stopListening();

  dom.micBtn.addEventListener("click", () => {
    if (isListening) { recognition.stop(); return; }
    isListening = true;
    dom.micBtn.classList.add("listening");
    dom.answerInput.placeholder = "Listening...";
    recognition.start();
  });
}

function stopListening() {
  isListening = false;
  dom.micBtn.classList.remove("listening");
  dom.answerInput.placeholder = "Or type your own answer...";
}

function initAnswerInput() {
  dom.answerInput.addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); submitAnswer(dom.answerInput.value); }
  });
}

function initStartBtn() {
  dom.startBtn.addEventListener("click", () => {
    dom.startBtn.classList.add("active");
    promptIdx = 0;
    gsap.to([dom.prompt, dom.promptChips], { opacity: 0, duration: .2, onComplete() {
      gsap.set([dom.prompt, dom.promptChips], { opacity: 1 });
      showPrompt(0);
    }});
    clearTimeout(promptTimer);
    startPromptTimer();
    dom.answerInput.focus();
  });
}

/* ── Queue system ────────────────────────────── */

function renderQueue() {
  dom.queueCount.textContent = queue_list.length === 0 ? "Empty" : `${queue_list.length} in queue`;
  dom.queueWait.textContent = queue_list.length === 0 ? "Walk in" : `~${queue_list.length * EST_MINUTES_PER} min`;
  dom.queueNames.innerHTML = queue_list.map((name, i) =>
    `<span class="dock-name">${i === 0 ? "▸ " : ""}${name}</span>`
  ).join("");
}

function joinQueue() {
  const name = dom.nameInput.value.trim();
  if (!name) {
    dom.nameInput.style.borderColor = "rgba(247,37,133,.5)";
    setTimeout(() => dom.nameInput.style.borderColor = "", 800);
    return;
  }
  queue_list.push(name);
  dom.nameInput.value = "";
  renderQueue();

  gsap.fromTo(dom.queueNames.lastElementChild,
    { opacity: 0, x: 8 }, { opacity: 1, x: 0, duration: .3 });
}

function initQueue() {
  dom.joinBtn.addEventListener("click", joinQueue);
  dom.nameInput.addEventListener("keydown", e => { if (e.key === "Enter") joinQueue(); });
  renderQueue();
}

/* ── Video ping-pong ─────────────────────────── */

function swap() {
  idleVid.currentTime = 0; idleVid.play().catch(() => {});
  idleVid.classList.add("active"); activeVid.classList.remove("active");
  [activeVid, idleVid] = [idleVid, activeVid];
}

function initVideo() {
  dom.vidFwd.addEventListener("ended", swap);
  dom.vidRev.addEventListener("ended", swap);
  dom.vidFwd.play().catch(() => {});
}


/* ── Intro ───────────────────────────────────── */

function intro() {
  gsap.set([".bar", ".columns", ".base", ".corner"], { opacity: 0 });

  const m = gsap.timeline({ onComplete() { startChapterLoop(); startPromptTimer(); } });

  m.to(dom.loader, { delay: 1.4, onComplete() { dom.loader.classList.add("done"); } });
  m.set(dom.hud, { opacity: 1 }, "+=.1");

  m.to(".corner", { opacity: 1, duration: .4, stagger: .08 }, "+=.05");
  m.fromTo(".bar", { opacity: 0 }, { opacity: 1, duration: .6 }, "-=.2");

  m.set(".columns", { opacity: 1 });
  m.fromTo(".col-narrative", { opacity: 0, x: -20 }, { opacity: 1, x: 0, duration: .7 }, "-=.1");
  m.add(() => showChapter(0), "-=.5");
  m.fromTo(".col-sim", { opacity: 0, y: 15 }, { opacity: 1, y: 0, duration: .7 }, "-=.5");
  m.fromTo(".col-interact", { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: .7 }, "-=.5");
  m.add(() => showPrompt(0), "-=.3");

  m.fromTo(".base", { opacity: 0 }, { opacity: 1, duration: .5 }, "-=.2");
}

/* ── Boot ────────────────────────────────────── */

buildProgress();
initGrain();
initParticles();
initClock();
initVideo();
initQueue();
initSpeech();
initAnswerInput();
initStartBtn();
intro();
