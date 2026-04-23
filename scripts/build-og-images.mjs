#!/usr/bin/env node
// Generates a 1200×630 PNG social share card for every notes/*.md.
// Title-only minimal design. Output: og/<slug>.png.
//
// Run:  node scripts/build-og-images.mjs
//
// Required inputs at build time:
//   - scripts/fonts/Inter-ExtraBold.ttf
//   - scripts/fonts/JetBrainsMono-Medium.ttf
//   - notes/*.md (with title, date, slug frontmatter)

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const NOTES_DIR = join(ROOT, 'notes');
const OG_DIR = join(ROOT, 'og');
const FONTS_DIR = join(__dirname, 'fonts');

const WIDTH = 1200;
const HEIGHT = 630;

const COLORS = {
  bg: '#0F1B2A',
  teal: '#7FCBB0',
  text: '#E8ECF1',
  textDim: '#64748B',
};

const EYEBROW = '§ CASEONIX · LAB NOTE';
const AUTHOR = 'Srivatsa Kasagar';
const SITE_URL = 'caseonix.ca';

function buildCard({ title, datePretty }) {
  return {
    type: 'div',
    props: {
      style: {
        width: WIDTH,
        height: HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: 80,
        backgroundColor: COLORS.bg,
        fontFamily: 'Inter',
      },
      children: [
        // Eyebrow
        {
          type: 'div',
          props: {
            style: {
              fontFamily: 'JetBrains Mono',
              fontWeight: 500,
              fontSize: 24,
              letterSpacing: '0.16em',
              color: COLORS.teal,
              textTransform: 'uppercase',
            },
            children: EYEBROW,
          },
        },
        // Title row — flex container so title gets vertical centering room
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              flexGrow: 1,
            },
            children: {
              type: 'div',
              props: {
                style: {
                  fontFamily: 'Inter',
                  fontWeight: 800,
                  fontSize: 60,
                  lineHeight: 1.18,
                  letterSpacing: '-0.02em',
                  color: COLORS.text,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                },
                children: title,
              },
            },
          },
        },
        // Byline row
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'baseline',
            },
            children: [
              {
                type: 'div',
                props: {
                  style: {
                    fontFamily: 'Inter',
                    fontWeight: 800,
                    fontSize: 22,
                    color: COLORS.textDim,
                  },
                  children: `${AUTHOR} · ${datePretty}`,
                },
              },
              {
                type: 'div',
                props: {
                  style: {
                    fontFamily: 'JetBrains Mono',
                    fontWeight: 500,
                    fontSize: 22,
                    color: COLORS.teal,
                  },
                  children: `${SITE_URL} ↗`,
                },
              },
            ],
          },
        },
      ],
    },
  };
}

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

function formatDatePretty(iso) {
  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const d = new Date(iso + 'T00:00:00Z');
  if (isNaN(d.getTime())) return iso;
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${MONTHS[d.getUTCMonth()]} ${day}, ${d.getUTCFullYear()}`;
}

function coerceDateString(d) {
  // YAML sometimes parses an unquoted YYYY-MM-DD as a Date object.
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return String(d);
}

async function main() {
  const entries = await readdir(NOTES_DIR);
  const mdFiles = entries
    .filter((n) => extname(n) === '.md')
    .sort()
    .map((n) => join(NOTES_DIR, n));
  if (mdFiles.length === 0) {
    console.warn('no .md files found in notes/, nothing to build');
    return;
  }
  const fonts = await loadFonts();
  await mkdir(OG_DIR, { recursive: true });
  for (const p of mdFiles) {
    const raw = await readFile(p, 'utf8');
    const { data: fm } = matter(raw);
    if (!fm.title || !fm.slug || !fm.date) {
      throw new Error(`${basename(p)}: missing required frontmatter (title, slug, date)`);
    }
    const datePretty = formatDatePretty(coerceDateString(fm.date));
    const svg = await satori(buildCard({ title: String(fm.title), datePretty }), {
      width: WIDTH,
      height: HEIGHT,
      fonts,
    });
    const png = new Resvg(svg, { fitTo: { mode: 'width', value: WIDTH } }).render().asPng();
    const outPath = join(OG_DIR, `${fm.slug}.png`);
    await writeFile(outPath, png);
    console.log(`  · ${basename(p)} → og/${fm.slug}.png (${png.length} bytes)`);
  }
  console.log(`built ${mdFiles.length} OG image(s)`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
