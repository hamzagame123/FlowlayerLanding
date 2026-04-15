const chapters = [
  {
    kicker: "THE EXHIBIT",
    title: 'Nobody Drives <em>Anymore</em>',
    body: "Manual driving disappeared decades ago. This machine lets you try it. Sit down, grab the wheel, and steer yourself through a real city. No autopilot. No algorithm. Just you and the road.",
    vibe: "CURIOUS"
  },
  {
    kicker: "THE BEHAVIOR",
    title: 'Driving Was <em>Strange</em>',
    body: "People sat in metal boxes and steered themselves through traffic for hours every day. They got lost. They took wrong turns on purpose. They picked the slow road because it looked nice. None of this made sense, and all of it mattered.",
    vibe: "NOSTALGIC"
  },
  {
    kicker: "THE MACHINE",
    title: 'Wheel. Chair. City. <em>Go.</em>',
    body: "A steering wheel. A motion seat. Cities rendered in Cesium, a geospatial 3D engine that rebuilds real places at actual scale. You drive through streets that exist, make turns that matter, and an AI watches what you do.",
    vibe: "READY"
  },
  {
    kicker: "THE ROUTE",
    title: 'Real Roads, <em>Real Places</em>',
    body: "The routes come from real cities. The intersections are real. The AI reads your driving — why you slowed down, why you went left, why you stopped at that corner — and turns it into a portrait of how you move.",
    vibe: "ANALYTICAL"
  },
  {
    kicker: "THE ARCHIVE",
    title: 'You Leave Something <em>Behind</em>',
    body: "Every session is saved. How you drove, where you paused, what you skipped. The next person sees what you left behind. Over time, it builds a record of how humans used to navigate — not efficiently, but humanly.",
    vibe: "REFLECTIVE"
  }
];

const prompts = [
  {
    text: "How do you want this drive to feel?",
    chips: ["Scenic and slow", "Fast and direct", "Calm and quiet", "Surprise me"]
  },
  {
    text: "What kind of road sounds right?",
    chips: ["Coastal highway", "Mountain pass", "City streets", "Quiet backroads"]
  },
  {
    text: "What are you in the mood for?",
    chips: ["Something beautiful", "Something intense", "Something unfamiliar", "I just want to drive"]
  },
  {
    text: "Pick a time of day.",
    chips: ["Golden hour", "Night", "Early morning", "High noon"]
  },
  {
    text: "What would make this drive worth it?",
    chips: ["A great view", "The feeling of speed", "Getting lost somewhere", "Arriving different"]
  },
  {
    text: "What kind of energy do you want?",
    chips: ["Relaxed", "Focused", "Adventurous", "Meditative"]
  },
  {
    text: "Fastest route or the scenic one?",
    chips: ["Fastest", "Scenic", "Whichever looks better", "I don't care"]
  },
  {
    text: "When this drive ends, how should you feel?",
    chips: ["Calm", "Awake", "Reset", "Like I went somewhere"]
  }
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

const queue = [];
const EST_MINUTES_PER = 5;

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];

const dom = {
  loader: $("#loader"), hud: $("#hud"),
  kickerText: $("#kickerText"), kickerNum: $(".kicker-num"),
  title: $("#title"), body: $("#body"),
  progress: $("#progress"), grain: $("#grain"), clock: $("#clock"),
  quote: $("#quote"), ringNum: $("#ringNum"),
  telemSession: $("#telemSession"), telemVibe: $("#telemVibe"),
  vidFwd: $("#vidFwd"), vidRev: $("#vidRev"),
  particles: $("#particles"),
  prompt: $("#prompt"), promptChips: $("#promptChips"),
  answerInput: $("#answerInput"), micBtn: $("#micBtn"), transcript: $("#transcript"),
  startBtn: $("#startBtn"),
  nameInput: $("#nameInput"), joinBtn: $("#joinBtn"),
  queueCount: $("#queueCount"), queueWait: $("#queueWait"),
  queueNames: $("#queueNames"), dock: $("#dock"),
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
    dom.quote.textContent = quotes[quoteIdx];
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

function showChapter(i) {
  const ch = chapters[i];
  const num = String(i + 1).padStart(2, "0");

  dom.kickerNum.textContent = num;
  dom.ringNum.textContent = num;
  dom.telemVibe.textContent = ch.vibe;

  dom.body.textContent = ch.body;
  updateProgress(i);

  scramble(dom.kickerText, ch.kicker, 400);
  scramble(dom.title, ch.title, 1000);

  const tl = gsap.timeline({ defaults: { ease: "power4.out" } });
  tl.fromTo(dom.body, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: .6 }, .5);

  return tl;
}

function hideChapter() {
  const tl = gsap.timeline({ defaults: { ease: "power2.in" } });
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

/* ── Prompts (philosophical questions) ───────── */

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

function pickChip(btn, pi) {
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
  dom.queueCount.textContent = queue.length === 0 ? "Empty" : `${queue.length} in queue`;
  dom.queueWait.textContent = queue.length === 0 ? "Walk in" : `~${queue.length * EST_MINUTES_PER} min`;
  dom.queueNames.innerHTML = queue.map((name, i) =>
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
  queue.push(name);
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
  gsap.set([".bar", ".hero", ".dock", ".base", ".corner"], { opacity: 0 });

  const m = gsap.timeline({ onComplete() { startChapterLoop(); startPromptTimer(); } });

  m.to(dom.loader, { delay: 1.4, onComplete() { dom.loader.classList.add("done"); } });
  m.set(dom.hud, { opacity: 1 }, "+=.1");

  m.to(".corner", { opacity: 1, duration: .4, stagger: .08 }, "+=.05");
  m.fromTo(".bar", { opacity: 0 }, { opacity: 1, duration: .6 }, "-=.2");
  m.set(".hero", { opacity: 1 }, "-=.3");
  m.add(() => showChapter(0), "-=.2");
  m.fromTo(".dock", { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: .6 }, "-=.1");
  m.add(() => showPrompt(0), "-=.4");
  m.fromTo(".base", { opacity: 0 }, { opacity: 1, duration: .5 }, "-=.3");
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
