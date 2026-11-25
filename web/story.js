// Shot plan for "Release Night Became Download Night" — timed to voice.mp3 (28.99 s, 30 fps, 870 frames).
// Real phrase times (s) from work/phrases.json (silence-align):
// 0.27-2.40 "He waited thirteen years, then missed the biggest night." |
// 2.77-5.26 "In Australia, one gamer had prepared for the ultimate midnight launch." |
// 5.67-8.27 "He booked leave, stocked snacks, and polished his ancient controller." |
// 8.74-11.08 "His friends laughed while his chair slowly became a second skeleton." |
// 11.55-13.48 "He built a snack tower tall enough to need planning permission." |
// 13.99-16.12 "Then the countdown ended, and every screen lit up around him." |
// 16.56-19.04 "But when he pressed play, one tiny message stopped everything cold." |
// 19.49-21.52 "You see, downloading a game is like filling a swimming pool." |
// 22.03-24.26 "He'd spent thirteen years choosing the perfect moment to jump in." |
// 24.67-26.42 "He just hadn't turned on the tap until that very moment." |
// 26.93-28.43 "Release night became download night."
export const FPS = 30, TOTAL = 870, DECK = 6;
export const SHOTS = [
  { id: 'hook', a: 0, b: 82, light: 'night' },
  { id: 'reveal', a: 83, b: 169, light: 'night' },
  { id: 'prep', a: 170, b: 261, light: 'night' },
  { id: 'chair', a: 262, b: 345, light: 'night' },
  { id: 'tower', a: 346, b: 418, light: 'night' },
  { id: 'countdown', a: 419, b: 495, light: 'night' },
  { id: 'play', a: 496, b: 583, light: 'night' },
  { id: 'pool', a: 584, b: 659, light: 'pool' },
  { id: 'dive', a: 660, b: 739, light: 'pool' },
  { id: 'tap', a: 740, b: 806, light: 'pool' },
  { id: 'twist', a: 807, b: 869, light: 'night' },
];
export const shotAt = (f) => SHOTS.find((s) => f >= s.a && f <= s.b) || SHOTS[SHOTS.length - 1];

const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const smooth = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };
const lerp = (a, b, t) => a + (b - a) * t;
const lerp3 = (a, b, t) => a.map((v, i) => lerp(v, b[i], t));
const ramp = (f, a, b) => clamp((f - a) / (b - a));

// ---------- lights ----------
export const LIGHTS = {
  night: { az: 140, el: 46, sky: '#1a2340', ground: '#232338', hemi: 0.6, sun: '#8fa8ff', sunI: 0.45, fog: '#141a30', fogNear: 30, fogFar: 300,
    skyTop: '#0b1030', skyHor: '#2a3a6b', sat: 1.05, waterDeep: '#1c4a66', waterShal: '#3f8aa8', glint: '#bfe8ff', vig: 0.26, shadowExt: 12, lamp: 0.7, screen: 1, gain: '#8fa0cc' },
  pool: { az: 140, el: 46, sky: '#1a2340', ground: '#2a2a3a', hemi: 1.0, sun: '#a8c8ff', sunI: 1.0, fog: '#141a30', fogNear: 40, fogFar: 400,
    skyTop: '#0d1a3a', skyHor: '#3a5a8a', sat: 1.05, waterDeep: '#1c4a66', waterShal: '#3f8aa8', glint: '#bfe8ff', vig: 0.24, shadowExt: 14, lamp: 0.3, screen: 0.4 },
};
export const lightFor = (S, f) => {
  const L = { ...LIGHTS[S.light] };
  if (S.id === 'countdown') L.screen = 1 + ramp(f, 419, 483) * 0.7;
  if (S.id === 'play') L.screen = 1.3;
  return L;
};

// ---------- cameras ----------
const GAMER = [0, DECK, 0];
const CAMS = {
  hook: [
    { f: 0, pos: [0.45, 7.75, 3.4], look: [0, 7.7, 0], fov: 34 },
    { f: 82, pos: [0.3, 7.68, 2.9], look: [0, 7.68, 0], fov: 32 },
  ],
  reveal: [
    { f: 83, pos: [-4.6, 8.8, 6.6], look: [0, 7.3, -1.5], fov: 46 },
    { f: 169, pos: [-3.4, 8.4, 6.9], look: [-0.4, 7.4, -1.8], fov: 44 },
  ],
  prep: [
    { f: 170, pos: [-3.4, 7.9, 3.8], look: [-0.9, 7.4, -1.4], fov: 46 },
    { f: 261, pos: [-2.9, 7.7, 4.0], look: [-0.6, 7.4, -1.2], fov: 44 },
  ],
  chair: [
    { f: 262, pos: [1.6, 7.6, 4.0], look: [0, 7.2, -0.3], fov: 42 },
    { f: 345, pos: [1.4, 7.2, 3.8], look: [0, 7.0, -0.3], fov: 40 },
  ],
  tower: [
    { f: 346, pos: [2.8, 7.0, 6.2], look: [0.7, 7.5, -1.0], fov: 48 },
    { f: 418, pos: [2.6, 7.1, 6.0], look: [0.7, 7.6, -1.0], fov: 46 },
  ],
  countdown: [
    { f: 419, pos: [-0.7, 7.9, 4.2], look: [-1.15, 7.7, -2.2], fov: 44 },
    { f: 495, pos: [-0.6, 7.8, 3.8], look: [-1.15, 7.7, -2.2], fov: 42 },
  ],
  play: [
    { f: 496, pos: [1.0, 7.55, 2.1], look: [0, 7.45, 0.3], fov: 32 },
    { f: 583, pos: [0.8, 7.5, 1.8], look: [0, 7.5, 0.2], fov: 30 },
  ],
  pool: [
    { f: 584, pos: [36.4, 2.4, 6.6], look: [40, 0.9, 0], fov: 44 },
    { f: 659, pos: [37.4, 2.1, 6.1], look: [40, 0.8, 0], fov: 42 },
  ],
  dive: [
    { f: 660, pos: [35.6, 2.7, 4.8], look: [39.0, 1.3, 0], fov: 42 },
    { f: 739, pos: [36.4, 2.4, 4.2], look: [39.2, 1.2, 0], fov: 40 },
  ],
  tap: [
    { f: 740, pos: [40.0, 2.1, 4.6], look: [41.6, 0.9, 1.0], fov: 40 },
    { f: 806, pos: [40.4, 1.9, 4.1], look: [41.7, 0.8, 1.1], fov: 38 },
  ],
  twist: [
    { f: 807, pos: [1.7, 7.65, 3.5], look: [0, 7.35, -0.4], fov: 36 },
    { f: 869, pos: [1.2, 7.55, 2.9], look: [0, 7.3, -0.3], fov: 34, roll: 3 },
  ],
};
const KICKS = [{ f: 360, a: 0.04 }, { f: 530, a: 0.03 }, { f: 852, a: 0.05 }];
export const camAt = (f) => {
  const S = shotAt(f), K = CAMS[S.id];
  let c;
  if (f <= K[0].f) c = { ...K[0] };
  else if (f >= K[K.length - 1].f) c = { ...K[K.length - 1] };
  else for (let i = 0; i < K.length - 1; i++) if (f >= K[i].f && f <= K[i + 1].f) {
    const t = smooth((f - K[i].f) / (K[i + 1].f - K[i].f)), a = K[i], b = K[i + 1];
    c = { pos: lerp3(a.pos, b.pos, t), look: lerp3(a.look, b.look, t), fov: lerp(a.fov, b.fov, t), roll: lerp(a.roll || 0, b.roll || 0, t) };
  }
  for (const k of KICKS) { const d = f - k.f; if (d >= 0 && d < 7) { const s = (d % 2 ? -1 : 1) * k.a * (1 - d / 7); c.look = [c.look[0], c.look[1] + s * 3, c.look[2] + s * 2]; c.roll = (c.roll || 0) + s * 20; } }
  // white flash on place/time jumps
  c.flash = f >= 584 && f < 590 ? (1 - (f - 584) / 6) * 0.85 : f >= 807 && f < 813 ? (1 - (f - 807) / 6) * 0.85 : 0;
  if (S.id === 'pool' || S.id === 'dive' || S.id === 'tap') c.shadowAt = [40, 1, 0];
  return c;
};

// ---------- lens ----------
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const dofAt = (f) => {
  const S = shotAt(f), C = camAt(f);
  const eye = S.light === 'pool' ? [39, 1.4, 0] : [0, 7.6, 0];
  switch (S.id) {
    case 'hook': return { focus: dist(C.pos, eye), cinf: 13 };
    case 'reveal': return { focus: 12, cinf: 0 };
    case 'prep': return { focus: dist(C.pos, [-1, 7.4, -1.6]), cinf: 10 };
    case 'chair': return { focus: dist(C.pos, eye), cinf: 11 };
    case 'tower': return { focus: dist(C.pos, [1.4, 7.8, -1.6]), cinf: 10 };
    case 'countdown': return { focus: dist(C.pos, [-1.5, 8.0, -3.4]), cinf: 9 };
    case 'play': return { focus: dist(C.pos, eye), cinf: 13 };
    case 'pool': return { focus: 10, cinf: 0 };
    case 'dive': return { focus: dist(C.pos, [39, 1.4, 0]), cinf: 9 };
    case 'tap': return { focus: dist(C.pos, [42.0, 0.9, 1.3]), cinf: 12 };
    case 'twist': return { focus: dist(C.pos, eye), cinf: 12 };
  }
  return { focus: 10, cinf: 0 };
};

// ---------- world state ----------
export const worldAt = (f) => {
  const S = shotAt(f);
  const W = { tower: 0, wobble: 0, clockT: 0, screens: 1, tap: 0, trickle: 0, waterLevel: 0, helmet: null };
  if (S.id === 'tower') { W.tower = ramp(f, 346, 404); W.wobble = f >= 360 ? ramp(f, 360, 390) : 0; }
  if (['countdown', 'play', 'twist'].includes(S.id)) W.tower = 1;
  if (f >= 83) W.clockT = ramp(f, 83, 483);
  if (S.id === 'countdown') W.screens = 1 + ramp(f, 419, 483) * 0.6;
  if (S.id === 'play') W.screens = 1.4;
  if (S.id === 'tap') { W.tap = ramp(f, 760, 795); W.trickle = ramp(f, 782, 806); W.waterLevel = ramp(f, 792, 806) * 0.5; }
  return W;
};

// ---------- actors (2D cards) ----------
const blinkAt = (f, seed) => { const per = 38 + (seed * 17) % 31, ph = (f + seed * 13) % per; return ph < 2 ? 0.5 : ph < 4 ? 1 : 0; };
const R = (T, who, o, pos, extra = {}) => ({ key: who + JSON.stringify(o), draw: (p) => T.romanFront(p, who, o), x: pos[0], y: pos[1], z: pos[2], ...extra });
const q = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n;
const idleBob = (f, seed) => q(0.006 * Math.sin((f + seed * 11) * 0.11), 3);

export const actorsAt = (f, T) => {
  const S = shotAt(f), out = [];
  const tint = '#ffffff';
  const gamer = (o, pos = GAMER, extra = {}) => out.push(R(T, 'gamer', { L: 'belly', R: 'belly', expr: 'neutral', seed: 3, blink: blinkAt(f, 3), bob: idleBob(f, 3), ...o }, pos, { tint, ...extra }));
  // friends as small chat portraits near the monitor
  const friend = (who, seed, expr, x, y, z, bob) => {
    out.push({ key: 'bubble' + who + seed, draw: (p) => T.fxChat(p), x: x - 0.1, y: y - 0.05, z: z - 0.05, s: 0.3, blob: false, shadow: false, order: 1 });
    out.push(R(T, who, { seed, expr, blink: blinkAt(f, seed), bob: q(bob, 3) }, [x, y, z], { s: 0.24, tint, blob: false, shadow: false, order: 2 }));
  };
  switch (S.id) {
    case 'hook': {
      gamer({ expr: f < 40 ? 'stubborn' : 'grin', look: f < 30 ? 0 : 0.3 });
      break;
    }
    case 'reveal': {
      gamer({ L: 'up', R: 'hang', expr: 'grin', look: 0.4 });
      friend('friendA', 11, 'laugh', -1.7, DECK + 1.6, -2.0, 0.01 * Math.sin(f * 0.5));
      friend('friendB', 12, 'grin', -0.9, DECK + 1.9, -2.4, 0.01 * Math.sin(f * 0.5 + 1));
      break;
    }
    case 'prep': {
      gamer({ L: 'point', R: 'thumb', expr: 'grin', look: 0.4 }, [-1.3, DECK, -1.4]);
      break;
    }
    case 'chair': {
      gamer({ expr: f > 300 ? 'squint' : 'stubborn', look: -0.5, headTilt: q(3 * Math.sin(f * 0.2), 1) });
      const lb = q(Math.abs(Math.sin(f * 0.55)) * 0.02, 3);
      friend('friendA', 11, 'laugh', -1.3, DECK + 2.0, -1.2, lb);
      friend('friendC', 13, 'laugh', 1.3, DECK + 2.2, -1.4, lb);
      break;
    }
    case 'tower': {
      gamer({ L: 'lift', R: 'hang', expr: f > 390 ? 'shock' : 'grin', look: 0.3 });
      break;
    }
    case 'countdown': {
      gamer({ L: 'up', R: 'up', expr: 'grin', look: 0.2 }, [-0.8, DECK, -1.2]);
      friend('friendA', 11, 'grin', -2.0, DECK + 2.6, -2.8, 0.01 * Math.sin(f * 0.6));
      friend('friendB', 12, 'laugh', -0.6, DECK + 2.7, -2.6, 0.01 * Math.sin(f * 0.6 + 1));
      break;
    }
    case 'play': {
      gamer({ expr: 'shock', look: 0, blink: f > 560 ? 1 : blinkAt(f, 3) });
      break;
    }
    case 'pool': {
      out.push(R(T, 'gamer', { L: 'point', R: 'temple', expr: 'neutral', seed: 3, blink: blinkAt(f, 3), bob: idleBob(f, 3) }, [39.0, 0, 0.6], { tint, ground: 0 }));
      break;
    }
    case 'dive': {
      out.push(R(T, 'gamer', { L: 'up', R: 'up', expr: 'grin', seed: 3, blink: blinkAt(f, 3), bob: idleBob(f, 3) }, [38.6, 1.0, 0], { tint, ground: 1.0 }));
      break;
    }
    case 'tap': {
      out.push(R(T, 'gamer', { L: 'reach', R: 'hang', expr: f > 780 ? 'grin' : 'neutral', seed: 3, blink: blinkAt(f, 3), bob: idleBob(f, 3) }, [41.2, 0, 1.9], { tint, ground: 0 }));
      break;
    }
    case 'twist': {
      gamer({ L: 'cheek', R: 'cheek', expr: 'squint', blink: f > 840 && f < 845 ? 1 : blinkAt(f, 3) });
      break;
    }
  }
  return out;
};

// ---------- 2D effects ----------
const FX = (key, draw, pos, s, extra = {}) => ({ key, draw, x: pos[0], y: pos[1], z: pos[2], s, blob: false, shadow: false, order: 5, ...extra });
export const fxAt = (f, T) => {
  const S = shotAt(f), out = [];
  if (S.id === 'hook' || S.id === 'play') {
    // generic controller held in front of the gamer
    out.push(FX('ctrl', (p) => T.controllerCard(p), [0, DECK + 0.55, 0.55], 0.42, { order: 4 }));
  }
  if (S.id === 'twist') {
    const k = S.id === 'play' ? 0.02 : 0.04;
    out.push(FX('dl' + k, (p) => T.fxDownload(p, k), [0.65, DECK + 1.1, 0.7], 0.55, { order: 4 }));
  }
  if (S.id === 'countdown' && f >= 470) {
    // restrained paper confetti, no logos
    for (let i = 0; i < 8; i++) {
      const t = ((f - 470) * 0.02 + i / 8) % 1, cols = ['#e8b23a', '#c4452c', '#5d8a3a', '#3f7fb8'];
      const x = -3.5 + ((i * 0.9 + f * 0.004) % 3.2), y = DECK + 3.4 - t * 2.6, z = -2.2 + (i % 3) * 0.5;
      out.push(FX('conf' + i, (p) => T.fxLeaf(p, cols[i % 4]), [x, y, z], 0.1, { roll: q(t * 6 + i, 1) }));
    }
  }
  if (S.id === 'dive' && f >= 700) {
    const t = q((f - 700) / 22, 2);
    out.push(FX('board' + t, (p) => T.fxCreak(p, t), [38.6, 1.2, 0.4], 0.4));
  }
  return out;
};
