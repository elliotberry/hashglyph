# hashglyph

Deterministically generate clean, CJK-inspired pseudo-glyph SVGs from a 64-bit hash string.

Each hash selects a balanced single, left-right, top-bottom, or enclosure
composition from a constrained vocabulary of radical-like shapes and strokes.
The results are intentionally not real characters, but use a consistent,
font-like CJK construction rather than decorative symbols.

## Install / run

Local run:

```bash
node index.js 0123456789abcdef > glyph.svg
```

Customize the output dimensions, stroke, colors, and padding:

```bash
node index.js deadbeefcafebabe --size 512 --stroke 18 --fg "#111" --bg white --pad 20 > glyph.svg
```

## Test

```bash
npm test
```