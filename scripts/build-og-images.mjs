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

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const NOTES_DIR = join(ROOT, 'notes');
const OG_DIR = join(ROOT, 'og');
const FONTS_DIR = join(__dirname, 'fonts');

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
  console.log(`loaded fonts: ${fonts.map((f) => `${f.name} ${f.weight}`).join(', ')}`);
  console.log(`found ${mdFiles.length} .md files`);
  for (const p of mdFiles) {
    const raw = await readFile(p, 'utf8');
    const { data: fm } = matter(raw);
    const date = coerceDateString(fm.date);
    console.log(`  · ${basename(p)} · slug=${fm.slug} date=${formatDatePretty(date)}`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
