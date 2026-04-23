#!/usr/bin/env node
// Scans /blog and /notes for published HTML, extracts headline + datePublished
// from each file's JSON-LD, and does three things:
//   1. Writes /log.json — the full combined feed, sorted by date desc.
//   2. Rewrites the top N_HOME rows inside index.html between the
//      <!-- log:auto-start --> ... <!-- log:auto-end --> markers.
//   3. Rewrites the two tab sections inside blog/index.html between the
//      <!-- log-notes:auto-start/end --> and <!-- log-posts:auto-start/end -->
//      markers, and updates the tab counts (<span data-count-for="...">).
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

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Groups date-desc-sorted items into [{ year, months: [{ monthIdx, items }] }].
function groupByYearMonth(items) {
  const byYear = new Map();
  for (const it of items) {
    const y = it.date.slice(0, 4);
    const m = it.date.slice(5, 7);
    if (!byYear.has(y)) byYear.set(y, new Map());
    const byMonth = byYear.get(y);
    if (!byMonth.has(m)) byMonth.set(m, []);
    byMonth.get(m).push(it);
  }
  const years = [...byYear.keys()].sort().reverse();
  return years.map((y) => {
    const months = [...byYear.get(y).entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([m, group]) => ({ monthIdx: parseInt(m, 10) - 1, items: group }));
    return { year: y, months };
  });
}

// Render the log-pane body (year + month headers + rows) for blog/index.html.
// Items must already be date-desc sorted.
function renderLogIndexSection(items) {
  const groups = groupByYearMonth(items);
  const lines = [];
  let stagger = 1;
  groups.forEach((g, gi) => {
    if (gi > 0) lines.push('');
    lines.push(`      <div class="log-year"><span>${g.year}</span></div>`);
    g.months.forEach((mo) => {
      lines.push('');
      lines.push(`      <div class="log-month"><span>${MONTH_NAMES[mo.monthIdx]}</span></div>`);
      for (const it of mo.items) {
        const day = it.date.slice(8, 10);
        lines.push(`      <a href="${it.href}" class="log-row" data-reveal data-reveal-stagger="${stagger}">`);
        lines.push(`        <span class="log-date">${MONTH_NAMES[mo.monthIdx]} ${day}</span>`);
        lines.push(`        <span class="log-sep" aria-hidden="true">&#9617;</span>`);
        lines.push(`        <span class="log-title">${titleToHtml(it.title)}</span>`);
        lines.push(`      </a>`);
        stagger++;
      }
    });
  });
  return lines.join('\n');
}

function replaceBetweenMarkers(source, startMarker, endMarker, inner) {
  const startIdx = source.indexOf(startMarker);
  const endIdx = source.indexOf(endMarker);
  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    throw new Error(`Missing markers: expected ${startMarker} ... ${endMarker}`);
  }
  return (
    source.slice(0, startIdx + startMarker.length) +
    '\n' + inner + '\n      ' +
    source.slice(endIdx)
  );
}

function updateTabCount(source, tabName, count) {
  const re = new RegExp(
    `(<span class="log-tab-count" data-count-for="${tabName}">)\\s*\\d+\\s*(</span>)`,
  );
  if (!re.test(source)) {
    throw new Error(`Missing tab-count span for "${tabName}" in blog/index.html`);
  }
  return source.replace(re, `$1${count}$2`);
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

  // Regenerate blog/index.html: both tab sections + both counts.
  const logIndexPath = join(ROOT, 'blog', 'index.html');
  let logIndex = await readFile(logIndexPath, 'utf8');
  const notes = all.filter((it) => it.type === 'note');
  const posts = all.filter((it) => it.type === 'blog');
  logIndex = replaceBetweenMarkers(
    logIndex,
    '<!-- log-notes:auto-start -->',
    '<!-- log-notes:auto-end -->',
    renderLogIndexSection(notes),
  );
  logIndex = replaceBetweenMarkers(
    logIndex,
    '<!-- log-posts:auto-start -->',
    '<!-- log-posts:auto-end -->',
    renderLogIndexSection(posts),
  );
  logIndex = updateTabCount(logIndex, 'notes', notes.length);
  logIndex = updateTabCount(logIndex, 'posts', posts.length);
  await writeFile(logIndexPath, logIndex);
  console.log(`rewrote ${logIndexPath} · notes=${notes.length} posts=${posts.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
