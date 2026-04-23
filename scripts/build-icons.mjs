#!/usr/bin/env node
// Renders the site's brand icons in teal with a lowercase 'c' wordmark glyph.
// Outputs:
//   /icon-512.png         (web manifest, 512×512)
//   /apple-touch-icon.png (iOS home screen, 180×180)
//   /favicon.png          (browser favicon, 32×32)
//   /favicon.ico          (legacy favicon, 32×32 wrapped in ICO container)
//
// Brand colors come from the site CSS vars: teal-1 = #7FCBB0, bg = #0F1B2A.

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import pngToIco from 'png-to-ico';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FONTS_DIR = join(__dirname, 'fonts');

const BG = '#7FCBB0';   // brand teal
const FG = '#0F1B2A';   // site dark navy (max contrast on teal)

async function loadFonts() {
  const inter = await readFile(join(FONTS_DIR, 'Inter-ExtraBold.ttf'));
  return [{ name: 'Inter', data: inter, weight: 800, style: 'normal' }];
}

function buildIcon(size) {
  // Rounded-square with a centered lowercase 'c'. Radius ~22% = iOS-like.
  // Glyph tuned to ~62% of canvas to read clearly down to 32px.
  return {
    type: 'div',
    props: {
      style: {
        width: size,
        height: size,
        backgroundColor: BG,
        borderRadius: Math.round(size * 0.22),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter',
        fontWeight: 800,
        fontSize: Math.round(size * 0.72),
        color: FG,
        // Visual nudge: lowercase 'c' sits slightly low without tuning; lift it.
        lineHeight: 1,
        paddingBottom: Math.round(size * 0.04),
      },
      children: 'c',
    },
  };
}

async function renderPng(size) {
  const fonts = await loadFonts();
  const svg = await satori(buildIcon(size), { width: size, height: size, fonts });
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
}

async function main() {
  // Render three PNGs and the ICO (derived from the 32×32 PNG).
  const sizes = [
    { size: 512, name: 'icon-512.png' },
    { size: 180, name: 'apple-touch-icon.png' },
    { size: 32, name: 'favicon.png' },
  ];
  const rendered = {};
  for (const { size, name } of sizes) {
    const png = await renderPng(size);
    const outPath = join(ROOT, name);
    await writeFile(outPath, png);
    rendered[size] = png;
    console.log(`wrote ${outPath} (${png.length} bytes)`);
  }

  // ICO: wrap the 32×32 PNG. png-to-ico accepts buffers of multiple sizes.
  const ico = await pngToIco([rendered[32]]);
  const icoPath = join(ROOT, 'favicon.ico');
  await writeFile(icoPath, ico);
  console.log(`wrote ${icoPath} (${ico.length} bytes)`);
}

main().catch((e) => { console.error(e.message); process.exit(1); });
