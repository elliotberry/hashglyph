#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import generateSvg from '../lib/generateSvg.js';

function randomHex64() {
  // 64-bit (16 hex chars)
  return crypto.randomBytes(8).toString('hex');
}

function toDataUriSvg(svgText) {
  const b64 = Buffer.from(svgText, 'utf8').toString('base64');
  return `data:image/svg+xml;base64,${b64}`;
}

async function maybeWritePng({ svgPath, pngPath }) {
  // Lazy import so the script can still emit SVG if sharp isn’t installed.
  let sharp;
  try {
    ({ default: sharp } = await import('sharp'));
  } catch (e) {
    process.stderr.write(
      `Skipping PNG render (missing optional dependency "sharp"). Wrote SVG only: ${svgPath}\n`,
    );
    return;
  }

  const svgBuf = fs.readFileSync(svgPath);
  await sharp(svgBuf).png().toFile(pngPath);
  process.stderr.write(`Wrote ${pngPath}\n`);
}

async function main() {
  const argv = yargs(hideBin(process.argv))
    .scriptName('hashglyph-aesthetics')
    .usage('$0 [options]')
    .option('count', {
      type: 'number',
      default: 20,
      describe: 'How many random glyphs to generate',
    })
    .option('cols', {
      type: 'number',
      default: 5,
      describe: 'How many columns in the tile grid',
    })
    .option('size', {
      type: 'number',
      default: 256,
      describe: 'Per-tile width/height in px',
    })
    .option('stroke', {
      type: 'number',
      default: 16,
      describe: 'Stroke width in px',
    })
    .option('pad', {
      type: 'number',
      default: 14,
      describe: 'Padding in px (same meaning as CLI)',
    })
    .option('fg', {
      type: 'string',
      default: 'black',
      describe: 'Stroke color',
    })
    .option('bg', {
      type: 'string',
      default: 'white',
      describe: 'Tile background fill (use "none" for transparent)',
    })
    .option('outDir', {
      type: 'string',
      default: './out',
      describe: 'Directory to write output files',
    })
    .option('name', {
      type: 'string',
      default: 'aesthetics',
      describe: 'Base filename (without extension)',
    })
    .help('help')
    .alias('help', 'h')
    .strictOptions(true)
    .parseSync();

  const count = Math.max(1, Math.floor(argv.count));
  const cols = Math.max(1, Math.floor(argv.cols));
  const size = Math.max(1, Math.floor(argv.size));

  const rows = Math.ceil(count / cols);
  const W = cols * size;
  const H = rows * size;

  const outDirAbs = path.resolve(process.cwd(), argv.outDir);
  fs.mkdirSync(outDirAbs, { recursive: true });

  const ids = Array.from({ length: count }, () => randomHex64());
  const tiles = ids.map((hex) =>
    generateSvg(hex, {
      size,
      stroke: argv.stroke,
      pad: argv.pad,
      fg: argv.fg,
      bg: argv.bg,
    }),
  );

  // Build a single “contact sheet” SVG by embedding each tile SVG as an <image>.
  const images = tiles
    .map((svg, i) => {
      const x = (i % cols) * size;
      const y = Math.floor(i / cols) * size;
      const href = toDataUriSvg(svg);
      return `<image x="${x}" y="${y}" width="${size}" height="${size}" href="${href}" />`;
    })
    .join('');

  const sheetSvg =
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    images +
    `</svg>`;

  const svgPath = path.join(outDirAbs, `${argv.name}.svg`);
  const pngPath = path.join(outDirAbs, `${argv.name}.png`);
  const idsPath = path.join(outDirAbs, `${argv.name}-ids.txt`);

  fs.writeFileSync(svgPath, sheetSvg, 'utf8');
  fs.writeFileSync(idsPath, ids.join('\n') + '\n', 'utf8');
  process.stderr.write(`Wrote ${svgPath}\n`);
  process.stderr.write(`Wrote ${idsPath}\n`);

  await maybeWritePng({ svgPath, pngPath });
}

main().catch((err) => {
  process.stderr.write(String(err?.stack || err) + '\n');
  process.exit(1);
});

