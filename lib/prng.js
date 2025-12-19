
// Deterministic PRNG (xorshift32) from a 64-bit (16 hex chars) seed.
// Returns floats in [0, 1).
function makeRngFromHex64(hex64) {
  // hex64 should be exactly 16 hex chars (validated by CLI), but keep this resilient.
  const s = String(hex64).replace(/^0x/i, '');
  let v;
  try {
    v = BigInt('0x' + s);
  } catch {
    v = 0n;
  }

  const lo = Number(v & 0xffffffffn) >>> 0;
  const hi = Number((v >> 32n) & 0xffffffffn) >>> 0;

  // Mix down to a 32-bit state with a few avalanching steps.
  // Avoid simple collisions like lo===hi (e.g. all-zeros vs all-ones) by mixing
  // the halves asymmetrically before avalanching.
  let x = (lo ^ 0x9e3779b9) | 0;
  x = (x + Math.imul(hi ^ 0x85ebca6b, 0xc2b2ae35)) | 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d) | 0;
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b) | 0;
  x ^= x >>> 16;
  x |= 0;

  return function rng() {
    // xorshift32
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    x |= 0;
    return (x >>> 0) / 4294967296;
  };
}

function intIn(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pick(rng, arr) {
  return arr[intIn(rng, 0, arr.length - 1)];
}

function chance(rng, p) {
  return rng() < p;
}

export {
  makeRngFromHex64,
  intIn,
  pick,
  chance,
};

