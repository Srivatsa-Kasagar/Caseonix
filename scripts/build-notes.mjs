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

const MERMAID_CDN = 'https://cdn.jsdelivr.net/npm/mermaid@11.4.0/dist/mermaid.esm.min.mjs';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function formatDatePretty(iso) {
  const d = new Date(iso + 'T00:00:00Z');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${MONTHS[d.getUTCMonth()]} ${day}, ${d.getUTCFullYear()}`;
}

function escapeAttr(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function buildJsonLd(fm) {
  const obj = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: fm.title,
    description: fm.description,
    author: {
      '@type': 'Person',
      name: 'Srivatsa Kasagar',
      url: 'https://caseonix.ca',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Caseonix',
      url: 'https://caseonix.ca',
      logo: { '@type': 'ImageObject', url: 'https://caseonix.ca/icon-512.png' },
    },
    datePublished: fm.date,
    dateModified: fm.date,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `https://caseonix.ca/notes/${fm.slug}.html`,
    },
  };
  if (fm.series) {
    obj.isPartOf = { '@type': 'CreativeWorkSeries', name: fm.series };
  }
  // Neutralize any literal </script that leaked from title/description into
  // JSON string values — otherwise it'd break out of the inline JSON-LD block.
  return JSON.stringify(obj, null, 2).replace(/<\/script/gi, '<\\/script');
}

function mermaidScriptTag() {
  return `<script type="module">
    import mermaid from '${MERMAID_CDN}';
    mermaid.initialize({ startOnLoad: true, theme: 'dark' });
  </script>`;
}

function substitute(template, values) {
  return template.replace(/\{\{([a-z_]+)\}\}/g, (_, key) => {
    if (!(key in values)) throw new Error(`Unknown template placeholder: {{${key}}}`);
    return values[key];
  });
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
  const template = await readFile(TEMPLATE_PATH, 'utf8');
  for (const p of mdFiles) {
    const raw = await readFile(p, 'utf8');
    const { data: fm, content } = matter(raw);
    validateFrontmatter(fm, basename(p));
    const body = md.render(content);
    const hasMermaid = body.includes('<pre class="mermaid">');
    const keywords = Array.isArray(fm.tags) ? fm.tags.join(', ') : '';
    const html = substitute(template, {
      title: escapeAttr(fm.title),
      description: escapeAttr(fm.description),
      date: fm.date,
      date_pretty: formatDatePretty(fm.date),
      slug: fm.slug,
      keywords: escapeAttr(keywords),
      jsonld: buildJsonLd(fm),
      body,
      mermaid_script: hasMermaid ? mermaidScriptTag() : '',
      share_text: encodeURIComponent(fm.title),
    });
    const outPath = join(NOTES_DIR, `${fm.slug}.html`);
    await writeFile(outPath, html);
    console.log(`  · ${basename(p)} → ${fm.slug}.html${hasMermaid ? ' [with mermaid]' : ''}`);
  }
  console.log(`built ${mdFiles.length} note(s)`);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
