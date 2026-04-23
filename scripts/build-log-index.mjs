#!/usr/bin/env node
// Scans /blog and /notes for published HTML, extracts headline + datePublished
// from each file's JSON-LD, and does two things:
//   1. Writes /log.json — the full combined feed, sorted by date desc.
//   2. Rewrites the rows inside index.html between the
//      <!-- log:auto-start --> ... <!-- log:auto-end --> markers
//      with the top N_HOME most-recent items.
//
// Run before every push:  node scripts/build-log-index.mjs

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SECTIONS = [
  { dir: 'blog', type: 'blog' },
  { dir: 'notes', type: 'note' },
];
const N_HOME = 4;

const START = '<!-- log:auto-start -->';
const END = '<!-- log:auto-end -->';

function extractJsonLd(html) {
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const blocks = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    try { blocks.push(JSON.parse(m[1].trim())); } catch { /* skip malformed block */ }
  }
  return blocks;
}

function extractMeta(html) {
  for (const b of extractJsonLd(html)) {
    const arr = Array.isArray(b) ? b : [b];
    for (const obj of arr) {
      if (obj && obj.headline && obj.datePublished) {
        return { headline: String(obj.headline), datePublished: String(obj.datePublished) };
      }
    }
  }
  return null;
}

async function buildSection({ dir, type }) {
  const abs = join(ROOT, dir);
  const entries = await readdir(abs);
  const out = [];
  for (const name of entries) {
    if (!name.endsWith('.html')) continue;
    if (name === 'index.html') continue;
    const html = await readFile(join(abs, name), 'utf8');
    const meta = extractMeta(html);
    if (!meta) {
      console.warn(`[skip] ${dir}/${name} — no headline + datePublished in JSON-LD`);
      continue;
    }
    out.push({
      href: `/${dir}/${name}`,
      title: meta.headline,
      date: meta.datePublished,
      type,
    });
  }
  return out;
}

function formatDate(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  if (isNaN(d.getTime())) return iso;
  const m = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][d.getUTCMonth()];
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${m} ${day}`;
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function titleToHtml(s) {
  return escapeHtml(s).replace(/—/g, '&mdash;').replace(/–/g, '&ndash;');
}

function renderRows(items) {
  return items.map((it, i) => {
    const stagger = i + 1;
    return `        <a href="${it.href}" class="log-teaser-row" data-reveal data-reveal-stagger="${stagger}">
          <span class="log-teaser-date">${formatDate(it.date)}</span>
          <span class="log-teaser-sep" aria-hidden="true">&#9617;</span>
          <span class="log-teaser-row-title">${titleToHtml(it.title)}</span>
        </a>`;
  }).join('\n');
}

async function main() {
  const all = [];
  for (const s of SECTIONS) all.push(...(await buildSection(s)));
  // Date desc, then href asc as a stable tie-break so same-day posts have a deterministic order.
  all.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.href < b.href ? -1 : a.href > b.href ? 1 : 0;
  });

  const logJsonPath = join(ROOT, 'log.json');
  await writeFile(logJsonPath, JSON.stringify({ items: all }, null, 2) + '\n');

  const indexPath = join(ROOT, 'index.html');
  const indexHtml = await readFile(indexPath, 'utf8');
  const startIdx = indexHtml.indexOf(START);
  const endIdx = indexHtml.indexOf(END);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(`Missing markers in index.html — expected ${START} ... ${END} inside .log-teaser-list.`);
  }
  const block = renderRows(all.slice(0, N_HOME));
  const next =
    indexHtml.slice(0, startIdx + START.length) +
    '\n' + block + '\n        ' +
    indexHtml.slice(endIdx);
  await writeFile(indexPath, next);

  console.log(`wrote ${logJsonPath} · ${all.length} total items`);
  console.log(`rewrote ${indexPath} · top ${Math.min(N_HOME, all.length)} rows:`);
  for (const it of all.slice(0, N_HOME)) {
    console.log(`  · ${it.date} [${it.type}] ${it.title}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
