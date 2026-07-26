import assert from 'node:assert/strict';
import test from 'node:test';

import generateSvg from '../lib/generateSvg.js';

const hashes = [
  '0000000000000000',
  '0123456789abcdef',
  'deadbeefcafebabe',
  'ffffffffffffffff',
  '13579bdf2468ace0',
  'a5a5a5a55a5a5a5a',
];

test('generates deterministic well-formed SVG output', () => {
  for (const hash of hashes) {
    const first = generateSvg(hash, { size: 256, stroke: 16, pad: 14 });
    const second = generateSvg(hash, { size: 256, stroke: 16, pad: 14 });

    assert.equal(first, second);
    assert.match(first, /^<\?xml version="1\.0" encoding="UTF-8"\?><svg /);
    assert.match(first, /viewBox="0 0 1000 1000"/);
    assert.match(first, /stroke-linecap="square"/);
    assert.match(first, /stroke-linejoin="miter"/);
    assert.match(first, /<path d="[^"]+" \/>/);
    assert.match(first, /<\/svg>$/);
  }
});

test('keeps the default glyph vocabulary free of circular arc paths', () => {
  for (const hash of hashes) {
    const svg = generateSvg(hash);

    assert.doesNotMatch(svg, /\sA\s/);
    assert.doesNotMatch(svg, /strokeWaveH/);
  }
});

test('varies output across representative hashes', () => {
  const glyphs = new Set(hashes.map((hash) => generateSvg(hash)));

  assert.ok(glyphs.size >= hashes.length - 1);
});

test('honors rendering options', () => {
  const svg = generateSvg('0123456789abcdef', {
    size: 512,
    stroke: 20,
    pad: 24,
    fg: '#123456',
    bg: 'white',
  });

  assert.match(svg, /width="512" height="512"/);
  assert.match(svg, /stroke="#123456" stroke-width="20"/);
  assert.match(svg, /<rect x="0" y="0" width="1000" height="1000" fill="white"\/>/);
});
