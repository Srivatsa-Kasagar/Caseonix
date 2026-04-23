#!/usr/bin/env node
// Converts notes/*.md → notes/<slug>.html using scripts/templates/note.html.
// Frontmatter required: title, date, slug, description.
// Frontmatter optional: type (default 'note'), series, tags.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const NOTES_DIR = join(ROOT, 'notes');
const TEMPLATE_PATH = join(__dirname, 'templates', 'note.html');

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

// Custom fence for mermaid code blocks — emit as <pre class="mermaid">
// so mermaid.js can transform them client-side.
const defaultFence = md.renderer.rules.fence;
md.renderer.rules.fence = function (tokens, idx, options, env, self) {
  const token = tokens[idx];
  if (token.info.trim() === 'mermaid') {
    return `<pre class="mermaid">${md.utils.escapeHtml(token.content)}</pre>\n`;
  }
  return defaultFence(tokens, idx, options, env, self);
};

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function validateFrontmatter(fm, filename) {
  const required = ['title', 'date', 'slug', 'description'];
  for (const key of required) {
    assert(
      fm[key] != null && fm[key] !== '',
      `${filename}: missing required frontmatter field '${key}'`,
    );
  }
  // YAML parses unquoted YYYY-MM-DD as a Date object. Coerce to ISO-date string
  // so notes can be authored with or without quotes around the date.
  if (fm.date instanceof Date) {
    fm.date = fm.date.toISOString().slice(0, 10);
  }
  assert(
    typeof fm.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fm.date),
    `${filename}: date must be YYYY-MM-DD, got '${fm.date}'`,
  );
  assert(
    /^[a-z0-9-]+$/.test(fm.slug),
    `${filename}: slug must match /^[a-z0-9-]+$/, got '${fm.slug}'`,
  );
  const expectedSlug = basename(filename, '.md');
  assert(
    fm.slug === expectedSlug,
    `${filename}: slug '${fm.slug}' must match filename '${expectedSlug}'`,
  );
  if (fm.type != null && fm.type !== 'note') {
    throw new Error(`${filename}: only type='note' supported in v1, got '${fm.type}'`);
  }
}

async function main() {
  const entries = await readdir(NOTES_DIR);
  const mdFiles = entries.filter((n) => extname(n) === '.md').map((n) => join(NOTES_DIR, n));
  if (mdFiles.length === 0) {
    console.warn('no .md files found in notes/, nothing to build');
    return;
  }
  for (const p of mdFiles) {
    const raw = await readFile(p, 'utf8');
    const { data: fm, content } = matter(raw);
    validateFrontmatter(fm, basename(p));
    const body = md.render(content);
    const hasMermaid = body.includes('<pre class="mermaid">');
    console.log(`  · ${basename(p)} — body rendered${hasMermaid ? ' [with mermaid]' : ''}`);
  }
  console.log(`processed ${mdFiles.length} note(s)`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
