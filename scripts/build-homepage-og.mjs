#!/usr/bin/env node
// Renders the site-wide "generic" OG image using Satori + Resvg, then writes
// the same PNG to every fallback filename referenced across the site:
//   - /og-image-v2.png   (homepage, blog index, 4 blog posts, nordid note)
//   - /og-localmind-rag-v2.png   (3 localmind lab notes — series fallback)
//   - /og-pillar-finserv.png     (finserv pillar blog post)
// Per-post markdown notes use build-og-images.mjs and point at
// /og/<slug>.png, not at these generic fallbacks.

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FONTS_DIR = join(__dirname, 'fonts');

const WIDTH = 1200;
const HEIGHT = 630;

const COLORS = {
  bg: '#0F1B2A',
  teal: '#7FCBB0',
  text: '#E8ECF1',
  textDim: '#64748B',
};

async function loadFonts() {
  const [inter, mono] = await Promise.all([
    readFile(join(FONTS_DIR, 'Inter-ExtraBold.ttf')),
    readFile(join(FONTS_DIR, 'JetBrainsMono-Medium.ttf')),
  ]);
  return [
    { name: 'Inter', data: inter, weight: 800, style: 'normal' },
    { name: 'JetBrains Mono', data: mono, weight: 500, style: 'normal' },
  ];
}

function buildCard() {
  return {
    type: 'div',
    props: {
      style: {
        width: WIDTH,
        height: HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.bg,
        position: 'relative',
      },
      children: [
        // Wordmark "caseonix" with teal 'onix'
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              fontFamily: 'Inter',
              fontWeight: 800,
              fontSize: 180,
              letterSpacing: '-0.045em',
              lineHeight: 1,
            },
            children: [
              { type: 'span', props: { style: { color: COLORS.text }, children: 'case' } },
              { type: 'span', props: { style: { color: COLORS.teal }, children: 'onix' } },
            ],
          },
        },
        // Eyebrow under the wordmark
        {
          type: 'div',
          props: {
            style: {
              fontFamily: 'JetBrains Mono',
              fontWeight: 500,
              fontSize: 22,
              letterSpacing: '0.2em',
              color: COLORS.textDim,
              textTransform: 'uppercase',
              marginTop: 28,
            },
            children: 'A SOLO AI LAB · WATERLOO, ON',
          },
        },
        // URL bottom-right
        {
          type: 'div',
          props: {
            style: {
              position: 'absolute',
              bottom: 56,
              right: 80,
              fontFamily: 'JetBrains Mono',
              fontWeight: 500,
              fontSize: 22,
              color: COLORS.teal,
            },
            children: 'caseonix.ca ↗',
          },
        },
      ],
    },
  };
}

const OUT_FILES = [
  'og-image-v2.png',
  'og-localmind-rag-v2.png',
  'og-pillar-finserv.png',
];

async function main() {
  const fonts = await loadFonts();
  const svg = await satori(buildCard(), { width: WIDTH, height: HEIGHT, fonts });
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng();
  for (const name of OUT_FILES) {
    const outPath = join(ROOT, name);
    await writeFile(outPath, png);
    console.log(`wrote ${outPath} (${png.length} bytes)`);
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
