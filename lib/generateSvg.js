

import {makeRngFromHex64, intIn, pick, chance} from './prng.js';

const VB = 1000;

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function fmt(n) {
  // Keep SVG compact but stable.
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

function p(x, y) {
  return `${fmt(x)} ${fmt(y)}`;
}

function boxInset({x, y, w, h}, m) {
  return { x: x + m, y: y + m, w: w - 2 * m, h: h - 2 * m };
}

function splitLR({w, x, y, h}, ratio) {
  const wL = Math.round(w * ratio);
  return [
    { x, y, w: wL, h },
    { x: x + wL, y, w: w - wL, h },
  ];
}

function splitTB({h, x, y, w}, ratio) {
  const hT = Math.round(h * ratio);
  return [
    { x, y, w, h: hT },
    { x, y: y + hT, w, h: h - hT },
  ];
}

function moveTo(x, y) {
  return `M ${p(x, y)}`;
}
function lineTo(x, y) {
  return `L ${p(x, y)}`;
}
function quadTo(cx, cy, x, y) {
  return `Q ${p(cx, cy)} ${p(x, y)}`;
}

function arcTo(rx, ry, xAxisRotation, largeArcFlag, sweepFlag, x, y) {
  return `A ${fmt(rx)} ${fmt(ry)} ${fmt(xAxisRotation)} ${largeArcFlag ? 1 : 0} ${sweepFlag ? 1 : 0} ${p(x, y)}`;
}

function polar(cx, cy, r, angRad) {
  return { x: cx + r * Math.cos(angRad), y: cy + r * Math.sin(angRad) };
}

function jitter(rng, v, amount) {
  return v + (rng() * 2 - 1) * amount;
}

function gridPoint(rng, b, gx, gy, gridN, j) {
  const x = b.x + (b.w * gx) / (gridN - 1);
  const y = b.y + (b.h * gy) / (gridN - 1);
  return {
    x: clamp(jitter(rng, x, j), b.x, b.x + b.w),
    y: clamp(jitter(rng, y, j), b.y, b.y + b.h),
  };
}

function strokeLine(x1, y1, x2, y2) {
  return `${moveTo(x1, y1)} ${lineTo(x2, y2)}`;
}

function strokeHookDown(rng, x, y1, y2, hookDir, hookSize) {
  // Vertical stroke down with a small hook at the end.
  const midY = lerp(y1, y2, 0.82);
  const hx = x + hookDir * hookSize;
  const hy = y2 - hookSize * 0.25;
  const c1x = x + hookDir * hookSize * 0.15;
  const c1y = lerp(midY, y2, 0.7);
  return `${moveTo(x, y1)} ${lineTo(x, midY)} ${quadTo(c1x, c1y, hx, hy)}`;
}

function strokeSweep(rng, x1, y1, x2, y2, bow) {
  // Slightly curved diagonal/sweep.
  const cx = lerp(x1, x2, 0.55) + bow * (y2 - y1) * 0.12;
  const cy = lerp(y1, y2, 0.45) - bow * (x2 - x1) * 0.12;
  return `${moveTo(x1, y1)} ${quadTo(cx, cy, x2, y2)}`;
}

function strokeDot(rng, x, y, r) {
  // A "dot" as a tiny stroke, not a filled circle.
  const x2 = x + (rng() * 2 - 1) * r;
  const y2 = y + r * (0.9 + rng() * 0.3);
  return `${moveTo(x, y)} ${quadTo((x + x2) / 2, (y + y2) / 2, x2, y2)}`;
}

function strokeCircle(cx, cy, r) {
  // Full circle, drawn as two arcs (keeps path short and smooth).
  const a0 = polar(cx, cy, r, 0);
  const a1 = polar(cx, cy, r, Math.PI);
  return `${moveTo(a0.x, a0.y)} ${arcTo(r, r, 0, false, true, a1.x, a1.y)} ${arcTo(r, r, 0, false, true, a0.x, a0.y)}`;
}

function strokeArc(cx, cy, r, aStart, aEnd, sweepFlag) {
  const s = polar(cx, cy, r, aStart);
  const e = polar(cx, cy, r, aEnd);
  const delta = Math.abs(aEnd - aStart);
  const large = delta > Math.PI;
  return `${moveTo(s.x, s.y)} ${arcTo(r, r, 0, large, sweepFlag !== false, e.x, e.y)}`;
}

function strokeWaveH(rng, x1, x2, y, amp, cycles) {
  // Horizontal sine-like wave using quadratic segments.
  const n = Math.max(1, Math.floor(cycles));
  const dx = (x2 - x1) / (n * 2);
  let d = moveTo(x1, y);
  for (let i = 0; i < n * 2; i++) {
    const xMid = x1 + dx * (i + 0.5);
    const xEnd = x1 + dx * (i + 1);
    const dir = i % 2 === 0 ? -1 : 1;
    const a = amp * (0.85 + rng() * 0.3);
    d += ` ${quadTo(xMid, y + dir * a, xEnd, y)}`;
  }
  return d;
}

function add(paths, d) {
  if (d && typeof d === 'string') paths.push(d);
}

// --- Component generators (rough CJK-esque radicals/shapes) ---

function compMouth(rng, b, paths) {
  // 口-like: three sides + inner line or full box.
  const m = Math.min(b.w, b.h) * 0.12;
  const bb = boxInset(b, m);
  const x1 = bb.x;
  const x2 = bb.x + bb.w;
  const y1 = bb.y;
  const y2 = bb.y + bb.h;
  add(paths, `${moveTo(x1, y1)} ${lineTo(x2, y1)} ${lineTo(x2, y2)} ${lineTo(x1, y2)}`);
  if (chance(rng, 0.55)) {
    // inner horizontal
    const y = lerp(y1, y2, 0.55);
    add(paths, strokeLine(lerp(x1, x2, 0.12), y, lerp(x1, x2, 0.88), y));
  } else if (chance(rng, 0.25)) {
    // close the box
    add(paths, strokeLine(x1, y1, x1, y2));
  }
}

function compSun(rng, b, paths) {
  // 日-like: box + two inner horizontals
  const m = Math.min(b.w, b.h) * 0.10;
  const bb = boxInset(b, m);
  const x1 = bb.x;
  const x2 = bb.x + bb.w;
  const y1 = bb.y;
  const y2 = bb.y + bb.h;
  add(paths, `${moveTo(x1, y1)} ${lineTo(x2, y1)} ${lineTo(x2, y2)} ${lineTo(x1, y2)} ${lineTo(x1, y1)}`);
  const yA = lerp(y1, y2, 0.38);
  const yB = lerp(y1, y2, 0.68);
  add(paths, strokeLine(lerp(x1, x2, 0.12), yA, lerp(x1, x2, 0.88), yA));
  add(paths, strokeLine(lerp(x1, x2, 0.12), yB, lerp(x1, x2, 0.88), yB));
}

function compField(rng, b, paths) {
  // 田-like: box + one vertical + one horizontal
  const m = Math.min(b.w, b.h) * 0.10;
  const bb = boxInset(b, m);
  const x1 = bb.x;
  const x2 = bb.x + bb.w;
  const y1 = bb.y;
  const y2 = bb.y + bb.h;
  add(paths, `${moveTo(x1, y1)} ${lineTo(x2, y1)} ${lineTo(x2, y2)} ${lineTo(x1, y2)} ${lineTo(x1, y1)}`);
  const xm = lerp(x1, x2, 0.50);
  const ym = lerp(y1, y2, 0.52);
  add(paths, strokeLine(xm, y1, xm, y2));
  add(paths, strokeLine(x1, ym, x2, ym));
}

function compTree(rng, b, paths) {
  // 木-like: vertical + horizontal + two diagonals
  const cx = b.x + b.w * 0.50;
  const top = b.y + b.h * 0.12;
  const bot = b.y + b.h * 0.92;
  add(paths, strokeLine(cx, top, cx, bot));
  const y = b.y + b.h * 0.42;
  add(paths, strokeLine(b.x + b.w * 0.18, y, b.x + b.w * 0.82, y));
  add(paths, strokeSweep(rng, cx, y, b.x + b.w * 0.22, b.y + b.h * 0.80, -1));
  add(paths, strokeSweep(rng, cx, y, b.x + b.w * 0.78, b.y + b.h * 0.80, +1));
}

function compCross(rng, b, paths) {
  // 十-like: vertical + horizontal
  const cx = b.x + b.w * 0.52;
  add(paths, strokeLine(cx, b.y + b.h * 0.14, cx, b.y + b.h * 0.88));
  const y = b.y + b.h * (0.38 + rng() * 0.18);
  add(paths, strokeLine(b.x + b.w * 0.18, y, b.x + b.w * 0.84, y));
}

function compEight(rng, b, paths) {
  // 八-like: two sweeps
  const x = b.x + b.w * 0.50;
  const y = b.y + b.h * 0.26;
  add(paths, strokeSweep(rng, x, y, b.x + b.w * 0.26, b.y + b.h * 0.86, -1));
  add(paths, strokeSweep(rng, x, y, b.x + b.w * 0.76, b.y + b.h * 0.86, +1));
}

// --- Broadened vocabulary (trigrams / zodiac-ish / alchemy-ish motifs) ---

function compTrigram(rng, b, paths, lines) {
  // Bagua trigram / I Ching hexagram: stacked solid/broken bars.
  const n = lines || 3;
  const x1 = b.x + b.w * 0.14;
  const x2 = b.x + b.w * 0.86;
  const gap = b.h / (n + 1);
  const bar = b.w * 0.06; // broken gap size
  for (let i = 0; i < n; i++) {
    const y = b.y + gap * (i + 1);
    const broken = chance(rng, 0.45);
    if (!broken) {
      add(paths, strokeLine(x1, y, x2, y));
    } else {
      const xm = (x1 + x2) / 2;
      add(paths, strokeLine(x1, y, xm - bar, y));
      add(paths, strokeLine(xm + bar, y, x2, y));
    }
  }
  if (chance(rng, 0.25)) {
    // Side rails to feel more "seal/script" stamped.
    add(paths, strokeLine(b.x + b.w * 0.10, b.y + gap * 0.8, b.x + b.w * 0.10, b.y + b.h - gap * 0.8));
    add(paths, strokeLine(b.x + b.w * 0.90, b.y + gap * 0.8, b.x + b.w * 0.90, b.y + b.h - gap * 0.8));
  }
}

function compHexagram(rng, b, paths) {
  compTrigram(rng, b, paths, 6);
}

function compZodiacAries(rng, {x, w, y, h}, paths) {
  // ♈-ish: two "horns" curves.
  const cx = x + w * 0.50;
  const y0 = y + h * 0.74;
  const r = Math.min(w, h) * 0.30;
  add(paths, strokeArc(cx - r * 0.55, y0, r * 0.78, Math.PI * 1.15, Math.PI * 1.95, true));
  add(paths, strokeArc(cx + r * 0.55, y0, r * 0.78, Math.PI * 1.05, Math.PI * 0.25, false));
  if (chance(rng, 0.35)) add(paths, strokeLine(cx, y + h * 0.32, cx, y + h * 0.86));
}

function compZodiacTaurus(rng, {x, w, y, h}, paths) {
  // ♉-ish: circle + horns arc.
  const cx = x + w * 0.50;
  const cy = y + h * 0.62;
  const r = Math.min(w, h) * 0.22;
  add(paths, strokeCircle(cx, cy, r));
  const hr = Math.min(w, h) * 0.32;
  add(paths, strokeArc(cx, cy - r * 0.55, hr, Math.PI * 1.10, Math.PI * 1.90, true));
}

function compZodiacGemini(rng, {x, w, y, h}, paths) {
  // ♊-ish: twin pillars with top/bottom caps.
  const xL = x + w * 0.34;
  const xR = x + w * 0.66;
  const y1 = y + h * 0.18;
  const y2 = y + h * 0.88;
  add(paths, strokeLine(xL, y1, xL, y2));
  add(paths, strokeLine(xR, y1, xR, y2));
  add(paths, strokeArc((xL + xR) / 2, y1, (xR - xL) * 0.60, Math.PI, 0, true));
  add(paths, strokeArc((xL + xR) / 2, y2, (xR - xL) * 0.60, 0, Math.PI, true));
}

function compZodiacAquarius(rng, {x, w, y, h}, paths) {
  // ♒-ish: two stacked waves.
  const x1 = x + w * 0.12;
  const x2 = x + w * 0.88;
  const yA = y + h * 0.40;
  const yB = y + h * 0.66;
  add(paths, strokeWaveH(rng, x1, x2, yA, h * 0.06, 3));
  add(paths, strokeWaveH(rng, x1, x2, yB, h * 0.06, 3));
}

function compZodiacSagittarius(rng, {x, w, y, h}, paths) {
  // ♐-ish: arrow (diagonal + head) with a short crossbar.
  const x1 = x + w * 0.22;
  const y1 = y + h * 0.78;
  const x2 = x + w * 0.82;
  const y2 = y + h * 0.22;
  add(paths, strokeSweep(rng, x1, y1, x2, y2, +1));
  add(paths, strokeLine(x2, y2, x2 - w * 0.10, y2));
  add(paths, strokeLine(x2, y2, x2, y2 + h * 0.10));
  if (chance(rng, 0.35)) {
    const xm = lerp(x1, x2, 0.45);
    const ym = lerp(y1, y2, 0.45);
    add(paths, strokeLine(xm - w * 0.14, ym, xm + w * 0.14, ym));
  }
}

function compAlchSun(rng, {x, w, y, h}, paths) {
  // ☉-ish: circle + dot.
  const cx = x + w * 0.50;
  const cy = y + h * 0.52;
  const r = Math.min(w, h) * 0.30;
  add(paths, strokeCircle(cx, cy, r));
  add(paths, strokeDot(rng, cx, cy, r * 0.06));
}

function compAlchMercury(rng, {x, w, y, h}, paths) {
  // ☿-ish: crescent + circle + cross.
  const cx = x + w * 0.50;
  const cy = y + h * 0.52;
  const r = Math.min(w, h) * 0.22;
  add(paths, strokeCircle(cx, cy, r));
  add(paths, strokeArc(cx, cy - r * 1.05, r * 0.90, Math.PI * 1.10, Math.PI * 1.90, true));
  const yCross = cy + r * 1.25;
  add(paths, strokeLine(cx, cy + r * 0.85, cx, yCross + r * 0.40));
  add(paths, strokeLine(cx - r * 0.55, yCross, cx + r * 0.55, yCross));
}

function compAlchSulfur(rng, b, paths) {
  // 🜍-ish: triangle over cross (stylized).
  const cx = b.x + b.w * 0.50;
  const yTop = b.y + b.h * 0.18;
  const yTri = b.y + b.h * 0.62;
  const w = b.w * 0.46;
  add(paths, `${moveTo(cx, yTop)} ${lineTo(cx - w / 2, yTri)} ${lineTo(cx + w / 2, yTri)} ${lineTo(cx, yTop)}`);
  const yCross = b.y + b.h * 0.76;
  add(paths, strokeLine(cx, yTri, cx, b.y + b.h * 0.92));
  add(paths, strokeLine(cx - w * 0.22, yCross, cx + w * 0.22, yCross));
}

function compAlchAir(rng, b, paths) {
  // △ with a bar (air-ish).
  const cx = b.x + b.w * 0.50;
  const yTop = b.y + b.h * 0.18;
  const yBot = b.y + b.h * 0.86;
  const w = b.w * 0.56;
  add(paths, `${moveTo(cx, yTop)} ${lineTo(cx - w / 2, yBot)} ${lineTo(cx + w / 2, yBot)} ${lineTo(cx, yTop)}`);
  const yBar = lerp(yTop, yBot, 0.62);
  add(paths, strokeLine(cx - w * 0.30, yBar, cx + w * 0.30, yBar));
}

function compAlchEarth(rng, b, paths) {
  // ▽ with a bar (earth-ish).
  const cx = b.x + b.w * 0.50;
  const yTop = b.y + b.h * 0.18;
  const yBot = b.y + b.h * 0.86;
  const w = b.w * 0.56;
  add(paths, `${moveTo(cx, yBot)} ${lineTo(cx - w / 2, yTop)} ${lineTo(cx + w / 2, yTop)} ${lineTo(cx, yBot)}`);
  const yBar = lerp(yTop, yBot, 0.38);
  add(paths, strokeLine(cx - w * 0.30, yBar, cx + w * 0.30, yBar));
}

function radicalWaterLeft(rng, b, paths) {
  // 氵-ish: three dots/short strokes
  const x = b.x + b.w * 0.58;
  const y1 = b.y + b.h * 0.18;
  const y2 = b.y + b.h * 0.46;
  const y3 = b.y + b.h * 0.76;
  add(paths, strokeDot(rng, x, y1, b.w * 0.10));
  add(paths, strokeDot(rng, x - b.w * 0.08, y2, b.w * 0.12));
  add(paths, strokeDot(rng, x + b.w * 0.02, y3, b.w * 0.14));
}

function radicalPersonLeft(rng, b, paths) {
  // 亻-ish: vertical + small sweep
  const x = b.x + b.w * 0.58;
  add(paths, strokeLine(x, b.y + b.h * 0.10, x, b.y + b.h * 0.92));
  add(paths, strokeSweep(rng, x, b.y + b.h * 0.40, b.x + b.w * 0.78, b.y + b.h * 0.86, +1));
}

function radicalHandLeft(rng, b, paths) {
  // 扌-ish: vertical + two horizontals + tiny hook
  const x = b.x + b.w * 0.56;
  add(paths, strokeHookDown(rng, x, b.y + b.h * 0.10, b.y + b.h * 0.92, -1, b.w * 0.12));
  const yA = b.y + b.h * 0.34;
  const yB = b.y + b.h * 0.54;
  add(paths, strokeLine(b.x + b.w * 0.28, yA, b.x + b.w * 0.88, yA));
  add(paths, strokeLine(b.x + b.w * 0.22, yB, b.x + b.w * 0.78, yB));
}

function radicalGrassTop(rng, b, paths) {
  // 艹-ish: two short horizontals + center vertical
  const y = b.y + b.h * 0.36;
  add(paths, strokeLine(b.x + b.w * 0.12, y, b.x + b.w * 0.46, y));
  add(paths, strokeLine(b.x + b.w * 0.54, y, b.x + b.w * 0.88, y));
  add(paths, strokeLine(b.x + b.w * 0.50, b.y + b.h * 0.16, b.x + b.w * 0.50, b.y + b.h * 0.62));
}

function enclosureOuter(rng, b, paths, openSide) {
  // A surrounding box-ish (囗/门-ish), leaving an opening on one side.
  const m = Math.min(b.w, b.h) * 0.08;
  const bb = boxInset(b, m);
  const x1 = bb.x;
  const x2 = bb.x + bb.w;
  const y1 = bb.y;
  const y2 = bb.y + bb.h;
  const gap = Math.min(bb.w, bb.h) * 0.26;

  if (openSide === 'bottom') {
    add(paths, `${moveTo(x1, y1)} ${lineTo(x2, y1)} ${lineTo(x2, y2)} ${moveTo(x1, y1)} ${lineTo(x1, y2)}`);
  } else if (openSide === 'top') {
    add(paths, `${moveTo(x1, y2)} ${lineTo(x2, y2)} ${lineTo(x2, y1)} ${moveTo(x1, y2)} ${lineTo(x1, y1)}`);
  } else if (openSide === 'right') {
    add(paths, `${moveTo(x1, y1)} ${lineTo(x2, y1)} ${moveTo(x1, y1)} ${lineTo(x1, y2)} ${lineTo(x2, y2)}`);
  } else {
    // left
    add(paths, `${moveTo(x2, y1)} ${lineTo(x1, y1)} ${moveTo(x2, y1)} ${lineTo(x2, y2)} ${lineTo(x1, y2)}`);
  }

  if (chance(rng, 0.35)) {
    // add a small "gate" inner stroke for 门-like feel
    const x = openSide === 'left' ? lerp(x1, x2, 0.72) : lerp(x1, x2, 0.28);
    add(paths, strokeLine(x, y1 + gap * 0.55, x, y2 - gap * 0.40));
  }
}

function compRandomStrokes(rng, b, paths, targetCount) {
  // Fallback to ensure complexity: draw additional grid-aligned strokes.
  const gridN = 5;
  const j = Math.min(b.w, b.h) * 0.035;
  let attempts = 0;

  while (paths.length < targetCount && attempts++ < targetCount * 10) {
    const kind = pick(rng, ['h', 'v', 'd1', 'd2', 'hook', 'dot', 'wave', 'circle']);
    const a = gridPoint(rng, b, intIn(rng, 0, gridN - 1), intIn(rng, 0, gridN - 1), gridN, j);
    const b2 = gridPoint(rng, b, intIn(rng, 0, gridN - 1), intIn(rng, 0, gridN - 1), gridN, j);

    if (kind === 'h') {
      const y = a.y;
      const x1 = Math.min(a.x, b2.x);
      const x2 = Math.max(a.x, b2.x);
      if (x2 - x1 < b.w * 0.30) continue;
      add(paths, strokeLine(x1, y, x2, y));
    } else if (kind === 'v') {
      const x = a.x;
      const y1 = Math.min(a.y, b2.y);
      const y2 = Math.max(a.y, b2.y);
      if (y2 - y1 < b.h * 0.30) continue;
      add(paths, strokeLine(x, y1, x, y2));
    } else if (kind === 'd1') {
      // /
      const x1 = b.x + b.w * (0.20 + rng() * 0.20);
      const y1 = b.y + b.h * (0.70 + rng() * 0.18);
      const x2 = b.x + b.w * (0.70 + rng() * 0.20);
      const y2 = b.y + b.h * (0.18 + rng() * 0.20);
      add(paths, strokeSweep(rng, x1, y1, x2, y2, -1));
    } else if (kind === 'd2') {
      // \
      const x1 = b.x + b.w * (0.22 + rng() * 0.20);
      const y1 = b.y + b.h * (0.20 + rng() * 0.20);
      const x2 = b.x + b.w * (0.72 + rng() * 0.20);
      const y2 = b.y + b.h * (0.74 + rng() * 0.18);
      add(paths, strokeSweep(rng, x1, y1, x2, y2, +1));
    } else if (kind === 'hook') {
      const x = b.x + b.w * (0.35 + rng() * 0.40);
      add(paths, strokeHookDown(rng, x, b.y + b.h * 0.12, b.y + b.h * 0.90, chance(rng, 0.5) ? -1 : 1, b.w * (0.10 + rng() * 0.06)));
    } else if (kind === 'dot') {
      add(paths, strokeDot(rng, b.x + b.w * (0.20 + rng() * 0.60), b.y + b.h * (0.15 + rng() * 0.70), b.w * (0.10 + rng() * 0.05)));
    } else if (kind === 'wave') {
      const y = b.y + b.h * (0.20 + rng() * 0.60);
      add(paths, strokeWaveH(rng, b.x + b.w * 0.18, b.x + b.w * 0.82, y, b.h * (0.03 + rng() * 0.03), 2 + intIn(rng, 0, 2)));
    } else if (kind === 'circle') {
      const cx = b.x + b.w * (0.30 + rng() * 0.40);
      const cy = b.y + b.h * (0.30 + rng() * 0.40);
      const r = Math.min(b.w, b.h) * (0.10 + rng() * 0.10);
      add(paths, strokeCircle(cx, cy, r));
    }
  }
}

function pickMainComponent(rng) {
  return pick(rng, [
    // CJK-ish bases
    compSun,
    compField,
    compMouth,
    compTree,
    compCross,
    compEight,
    // Broader motifs
    compHexagram,
    (rrng, b, pths) => compTrigram(rrng, b, pths, 3),
    compZodiacAries,
    compZodiacTaurus,
    compZodiacGemini,
    compZodiacAquarius,
    compZodiacSagittarius,
    compAlchSun,
    compAlchMercury,
    compAlchSulfur,
    compAlchAir,
    compAlchEarth,
  ]);
}

function generateGlyphPaths(hex64, pad) {
  const rng = makeRngFromHex64(hex64);
  const bounds = { x: pad, y: pad, w: VB - pad * 2, h: VB - pad * 2 };
  const paths = [];

  // Layout choice: try to mimic common CJK composition patterns.
  const layout = pick(rng, ['single', 'lr', 'tb', 'enclose']);

  if (layout === 'single') {
    // Top radical sometimes + core
    if (chance(rng, 0.38)) {
      const [top, rest] = splitTB(bounds, 0.26 + rng() * 0.08);
      radicalGrassTop(rng, top, paths);
      pickMainComponent(rng)(rng, boxInset(rest, rest.w * 0.03), paths);
    } else {
      pickMainComponent(rng)(rng, boxInset(bounds, bounds.w * 0.04), paths);
    }
  } else if (layout === 'lr') {
    const ratio = 0.30 + rng() * 0.10;
    const [left, right] = splitLR(bounds, ratio);
    const leftRad = pick(rng, [radicalWaterLeft, radicalPersonLeft, radicalHandLeft]);
    leftRad(rng, boxInset(left, left.w * 0.10), paths);

    // Right side: a main component plus maybe a small top stroke group.
    const rr = boxInset(right, right.w * 0.06);
    if (chance(rng, 0.30)) {
      const [top, rest] = splitTB(rr, 0.22 + rng() * 0.10);
      compCross(rng, top, paths);
      pickMainComponent(rng)(rng, rest, paths);
    } else {
      pickMainComponent(rng)(rng, rr, paths);
    }
  } else if (layout === 'tb') {
    const ratio = 0.36 + rng() * 0.10;
    const [top, bottom] = splitTB(bounds, ratio);
    // Top: grass or cross; bottom: field/tree/sun etc.
    if (chance(rng, 0.55)) radicalGrassTop(rng, boxInset(top, top.h * 0.10), paths);
    else compCross(rng, boxInset(top, top.h * 0.12), paths);
    pickMainComponent(rng)(rng, boxInset(bottom, bottom.w * 0.06), paths);
  } else {
    // Enclosure with an inner component.
    const openSide = pick(rng, ['bottom', 'left', 'right', 'top']);
    enclosureOuter(rng, bounds, paths, openSide);
    const inner = boxInset(bounds, bounds.w * (0.18 + rng() * 0.05));
    pickMainComponent(rng)(rng, inner, paths);
  }

  // Ensure a “complicated character” feel: add extra deterministic strokes.
  const target = intIn(rng, 10, 22);
  compRandomStrokes(rng, bounds, paths, target);

  // Final: add a subtle centerline sometimes (ties composition together)
  if (chance(rng, 0.25)) {
    const cx = bounds.x + bounds.w * 0.50;
    add(paths, strokeLine(cx, bounds.y + bounds.h * 0.10, cx, bounds.y + bounds.h * 0.92));
  }

  return paths;
}

function escapeAttr(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function generateSvg(hex64, opts) {
  const size = (opts && opts.size) || 256;
  const stroke = (opts && opts.stroke) || 16;
  const pad = (opts && opts.pad) == null ? 14 : opts.pad;
  const fg = (opts && opts.fg) || 'black';
  const bg = (opts && opts.bg) == null ? 'none' : opts.bg;

  // `pad` is specified in output pixels; convert to viewBox units so visual padding
  // behaves consistently across different `--size` values.
  const padPx = clamp(Number(pad) || 0, 0, 400);
  const padVb = clamp((padPx * VB) / Math.max(1, Number(size) || 256), 0, 220);
  const paths = generateGlyphPaths(hex64, padVb);

  const bgRect =
    bg && bg !== 'none'
      ? `<rect x="0" y="0" width="${VB}" height="${VB}" fill="${escapeAttr(bg)}"/>`
      : '';

  const pathEls = paths
    .map((d) => `<path d="${d}" />`)
    .join('');

  // vector-effect keeps stroke width constant even if viewBox scales.
  // Also use rounded caps/joins for a brush-like feel.
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${escapeAttr(size)}" height="${escapeAttr(size)}" viewBox="0 0 ${VB} ${VB}" fill="none">` +
    bgRect +
    `<g stroke="${escapeAttr(fg)}" stroke-width="${escapeAttr(stroke)}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke">` +
    pathEls +
    `</g>` +
    `</svg>`
  );
}

export default generateSvg;

