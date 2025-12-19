#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import generateSvg from './lib/generateSvg.js';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

function normalizeHex64(input) {
  if (typeof input !== 'string' || input.trim() === '') return null;
  let s = input.trim();
  if (s.startsWith('0x') || s.startsWith('0X')) s = s.slice(2);
  if (!/^[0-9a-fA-F]{16}$/.test(s)) return null;
  s = s.toLowerCase();
  return s;
}

function main() {
  const parser = yargs(hideBin(process.argv))
    .scriptName('character-hash')
    .usage('$0 <16-hex-chars> [out.svg]')
    .example('$0 0123456789abcdef > glyph.svg')
    .example('$0 0x0123456789ABCDEF glyph.svg')
    .example('$0 deadbeefcafebabe --size 512 --stroke 18 --fg "#111" --bg "white" --pad 20 > deadbeef.svg')
    .option('out', {
      type: 'string',
      describe: 'Write SVG to a file instead of stdout',
    })
    .option('size', {
      type: 'number',
      default: 256,
      describe: 'Output width/height in px',
    })
    .option('stroke', {
      type: 'number',
      default: 16,
      describe: 'Stroke width in px',
    })
    .option('pad', {
      type: 'number',
      default: 14,
      describe: 'Padding inside viewBox units',
    })
    .option('fg', {
      type: 'string',
      default: 'black',
      describe: 'Stroke color',
    })
    .option('bg', {
      type: 'string',
      default: 'none',
      describe: 'Background fill (use "none" for transparent)',
    })
    .help('help')
    .alias('help', 'h')
    .strictOptions(true)
    .fail((msg, err, y) => {
      const text = msg || (err ? err.message : 'Unknown error');
      if (text) process.stderr.write(`${text}\n\n`);
      y.showHelp((s) => process.stderr.write(s.endsWith('\n') ? s : `${s}\n`));
      process.exit(1);
    });

  const argv = parser.parseSync();

  const positionals = (argv._ || []).map((v) => String(v));
  if (positionals.length > 2) {
    process.stderr.write('Too many positional arguments.\n\n');
    parser.showHelp((s) => process.stderr.write(s.endsWith('\n') ? s : `${s}\n`));
    process.exit(1);
  }

  const hexRaw = positionals[0] ?? null;
  const outPositional = positionals[1] ?? null;
  const args = {
    hex: hexRaw ?? null,
    out: argv.out ?? outPositional ?? null,
    size: argv.size,
    stroke: argv.stroke,
    pad: argv.pad,
    fg: argv.fg,
    bg: argv.bg,
  };

  const hex = normalizeHex64(args.hex);
  if (!hex) {
    process.stderr.write('Expected a 16-hex-character string (64-bit), e.g. "0123456789abcdef" or "0xDEADBEEFCAFEBABE".\n\n');
    parser.showHelp((s) => process.stderr.write(s.endsWith('\n') ? s : `${s}\n`));
    process.exit(1);
  }

  if (!Number.isFinite(args.size) || args.size <= 0) {
    process.stderr.write('--size must be a positive number.\n');
    process.exit(1);
  }
  if (!Number.isFinite(args.stroke) || args.stroke <= 0) {
    process.stderr.write('--stroke must be a positive number.\n');
    process.exit(1);
  }
  if (!Number.isFinite(args.pad) || args.pad < 0) {
    process.stderr.write('--pad must be >= 0.\n');
    process.exit(1);
  }

  const svg = generateSvg(hex, {
    size: Math.round(args.size),
    stroke: args.stroke,
    pad: args.pad,
    fg: args.fg,
    bg: args.bg,
  });

  if (args.out) {
    const outPath = path.resolve(process.cwd(), args.out);
    fs.writeFileSync(outPath, svg, 'utf8');
  } else {
    process.stdout.write(svg);
  }
}

main();

