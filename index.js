#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import generateSvg from './lib/generateSvg.js';

function printHelp(exitCode = 0) {
  const msg = `
character-hash

Usage:
  character-hash <16-hex-chars> [out.svg]

Examples:
  character-hash 0123456789abcdef > glyph.svg
  character-hash 0x0123456789ABCDEF glyph.svg
  character-hash deadbeefcafebabe --size 512 --stroke 18 --fg "#111" --bg "white" --pad 20 > deadbeef.svg

Options:
  --out <file>        Write SVG to a file instead of stdout
  --size <px>         Output width/height in px (default: 256)
  --stroke <px>       Stroke width in px (default: 16)
  --pad <px>          Padding inside viewBox units (default: 14)
  --fg <color>        Stroke color (default: black)
  --bg <color|none>   Background fill (default: none)
  -h, --help          Show help
`;
  process.stdout.write(msg.trimStart());
  process.stdout.write('\n');
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = {
    hex: null,
    out: null,
    size: 256,
    stroke: 16,
    pad: 14,
    fg: 'black',
    bg: 'none',
  };

  const positionals = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') printHelp(0);
    if (!a.startsWith('-')) {
      positionals.push(a);
      continue;
    }

    const next = () => {
      if (i + 1 >= argv.length) {
        throw new Error(`Missing value for ${a}`);
      }
      return argv[++i];
    };

    if (a === '--out') args.out = next();
    else if (a === '--size') args.size = Number(next());
    else if (a === '--stroke') args.stroke = Number(next());
    else if (a === '--pad') args.pad = Number(next());
    else if (a === '--fg') args.fg = next();
    else if (a === '--bg') args.bg = next();
    else throw new Error(`Unknown option: ${a}`);
  }

  if (positionals.length > 0) args.hex = positionals[0];
  if (positionals.length > 1 && !args.out) args.out = positionals[1];
  if (positionals.length > 2) throw new Error('Too many positional arguments.');
  return args;
}

function normalizeHex64(input) {
  if (typeof input !== 'string' || input.trim() === '') return null;
  let s = input.trim();
  if (s.startsWith('0x') || s.startsWith('0X')) s = s.slice(2);
  if (!/^[0-9a-fA-F]{16}$/.test(s)) return null;
  s = s.toLowerCase();
  return s;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    process.stderr.write(`${String(e && e.message ? e.message : e)}\n\n`);
    printHelp(1);
    return;
  }

  const hex = normalizeHex64(args.hex);
  if (!hex) {
    process.stderr.write('Expected a 16-hex-character string (64-bit), e.g. "0123456789abcdef" or "0xDEADBEEFCAFEBABE".\n\n');
    printHelp(1);
    return;
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

