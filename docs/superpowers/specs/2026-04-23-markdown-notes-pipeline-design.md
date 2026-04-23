# Markdown notes pipeline — design spec

**Date:** 2026-04-23
**Owner:** Srivatsa
**Status:** Draft — awaiting review

## Goal

Let notes be authored as markdown files with YAML frontmatter and mermaid diagrams, and rendered to styled HTML pages that match the existing `/notes/*.html` look. Publishing is a local write + `git push`; a GitHub Action converts the markdown to HTML on every push. The existing `build-log-index.mjs` picks up the new note automatically for the homepage feed.

## Non-goals

- **Not a web admin UI.** Authoring happens in a text editor, not a browser form.
- **Not a migration of existing notes.** The five hand-crafted `/notes/*.html` files stay exactly as they are. This pipeline is opt-in for new notes.
- **Not a `/blog/` migration.** Blog posts continue to be hand-authored HTML. If we want to bring them into this pipeline later, that's a separate spec.
- **Not a full static-site generator.** No layouts, no partials, no tag pages, no archive index. Just `.md → .html` with one shared template.
- **Not live reload / preview server.** Running the build once and opening the HTML in a browser is the preview loop.

## Architecture

```
                       notes/*.md
                           │
                           │  scripts/build-notes.mjs
                           │   · parse YAML frontmatter
                           │   · markdown-it → HTML body
                           │   · emit ```mermaid``` as <pre class="mermaid">…</pre>
                           │   · wrap in scripts/templates/note.html
                           │   · inject JSON-LD + og:* from frontmatter
                           ▼
                      notes/<slug>.html
                           │
                           │  build-log-index.mjs  (already exists)
                           │   · reads JSON-LD headline + datePublished
                           │
                           ▼
                  log.json + homepage top-4 rows

                  Runtime (on the published page):
                    mermaid.js (CDN, deferred) → transforms <pre class="mermaid"> → SVG
```

## Components

### 1. Frontmatter schema

Every `.md` file starts with a YAML block:

```yaml
---
title: "Lab note — how I broke RAG"
date: 2026-04-23
slug: how-i-broke-rag
description: "A one-paragraph summary used in meta description and og:description."
type: note          # always "note" for now; reserved so future types slot in
series: null        # or "LocalMind RAG lab notes" for multi-part series
tags: [rag, cloudflare]
---
```

- `title`, `date`, `slug`, `description` — **required**. Build fails fast with a clear message if missing.
- `type` — optional, defaults to `note`. Only `note` is accepted for now; other values error out.
- `series` — optional. If set, drives the `isPartOf` JSON-LD field.
- `tags` — optional array. Drives `<meta name="keywords">` only; no tag pages in this round.

Date must be ISO `YYYY-MM-DD`. Slug must match `/^[a-z0-9-]+$/` and determines the output path (`notes/<slug>.html`). Mismatched filename vs slug is a hard error.

### 2. Build script: `scripts/build-notes.mjs`

Zero-runtime Node script (ESM). Minimal dependencies: `markdown-it`, `gray-matter`. Both pure-JS, no native modules, installable at repo root in a new minimal `package.json`.

Behavior:

1. Scan `notes/*.md`.
2. For each file:
   - Parse frontmatter with `gray-matter`.
   - Validate (schema + date format + slug).
   - Render body with `markdown-it`. Configure with: tables on, HTML on (so the rare raw `<div>` still works), linkify on, typographer on.
   - Custom fence renderer: `mermaid` code blocks → `<pre class="mermaid">${escaped}</pre>`. All other languages go through markdown-it's default (which we can style for syntax highlighting in a later round — out of scope here).
   - Load `scripts/templates/note.html`, interpolate placeholders (`{{title}}`, `{{date}}`, `{{slug}}`, `{{description}}`, `{{body}}`, `{{jsonld}}`, etc.) with simple string replace. No templating library.
   - Write `notes/<slug>.html`.
3. Print a one-line summary per file and exit 0.

Idempotent: running the script twice in a row produces identical bytes. No timestamps in output (same principle we applied to `log.json`).

### 3. Template: `scripts/templates/note.html`

Extracted from the shared structure of the three existing research/lab notes. One file, checked into the repo, edited directly when we want to tweak note styling.

Contains:
- Full `<head>` with meta tags, open graph, twitter card, canonical link, JSON-LD block — all with `{{placeholder}}` slots.
- `<body>` with site header/nav identical to existing notes.
- A single `<article>` container where the rendered markdown body is inserted.
- Footer.
- A `{{mermaid_script}}` placeholder near `</body>`. The build script decides at build time whether the rendered body contains `<pre class="mermaid">`; if yes, it substitutes a deferred `<script>` tag loading a pinned mermaid.js version from jsDelivr with `mermaid.initialize({ startOnLoad: true, theme: 'dark' })`. If no, it substitutes empty string. This keeps mermaid-less notes from pulling ~500KB of JS they don't need, without any runtime feature detection.

The template is the only place where sitewide note styling lives. Changing the header nav across all pipeline-authored notes = edit one file.

### 4. Mermaid rendering

Client-side only. The build script does not render mermaid to SVG.

- `<pre class="mermaid">` elements are emitted as literal text (HTML-escaped inside the pre tag).
- Build script substitutes the `{{mermaid_script}}` template placeholder (see Template section) with either the mermaid.js `<script>` tag or empty string, based on whether the rendered body contains any mermaid blocks.
- Mermaid.js is pinned to a specific version (e.g. `11.x.y`) loaded from jsDelivr. SRI hash is a nice-to-have — documented as a follow-up, not required in v1.
- Trade-offs documented: ~500KB JS payload on mermaid-containing pages only, flash of un-rendered text before transformation. Acceptable for lab notes; we revisit if SEO or perf ever matters for a specific note.

### 5. GitHub Action: `.github/workflows/build-notes.yml`

Triggers on `push` to `main` touching `notes/**/*.md`, `scripts/build-notes.mjs`, `scripts/templates/note.html`, or the workflow file itself. Also exposes `workflow_dispatch`.

Steps:

1. Checkout.
2. Set up Node 20.
3. `npm install` in repo root (we add a minimal `package.json` with `markdown-it` + `gray-matter` pinned).
4. Run `node scripts/build-notes.mjs`.
5. `git diff --quiet notes/` — if clean, exit.
6. Otherwise: commit the generated `notes/*.html` as `github-actions[bot]` with message `chore(notes): regenerate HTML from markdown`. Push.

Permissions: `contents: write`, scoped to this workflow.

Concurrency group: `build-notes` (separate from `build-log-index`) to avoid collisions when both workflows run on the same push.

### 6. Interaction with `build-log-index`

No changes required. The existing workflow already watches `notes/**` and fires on any change there. When `build-notes.yml` pushes a new `.html`, `build-log-index.yml` fires again on that bot push and regenerates `log.json` + homepage rows. Two bot commits per new note is acceptable; can be collapsed later by merging both scripts if it becomes annoying.

## Data flow for a new note

1. You write `notes/how-i-broke-rag.md` locally. Optionally run `node scripts/build-notes.mjs` to preview the HTML.
2. `git add`, `git commit`, `git push`.
3. `build-notes.yml` fires, generates `notes/how-i-broke-rag.html`, commits it.
4. That commit triggers `build-log-index.yml`, which refreshes `log.json` and rewrites the top-4 rows on the homepage.
5. GitHub Pages redeploys. Note is live at `caseonix.ca/notes/how-i-broke-rag.html` and visible on the homepage § RECENT FROM THE LOG.

End-to-end latency: roughly 60-90 seconds from `git push` to live.

## Error handling

- Missing required frontmatter field → build fails with filename + field name.
- Invalid date / slug format → build fails with offending value.
- Slug ≠ filename → build fails.
- Unknown `type` → build fails.
- markdown-it parse error → propagates with file context.
- No `.md` files found → warn but exit 0 (so an empty-tree push doesn't break CI).

All errors surface in the GitHub Action log with the file path, and the Action exits nonzero so the bad push is visible in the Actions tab.

## Pilot

After the pipeline is in place, convert one existing note — `auditlm-ai-governance-gap.html` — to `auditlm-ai-governance-gap.md` as a canary. Rename the original to `auditlm-ai-governance-gap.html.bak` locally (not committed) for side-by-side comparison. Diff the generated output against the original and iterate on the template until the visual diff is trivial. Then delete the `.bak`, leave the generated HTML in place, and consider the pipeline validated.

**Important:** the other four hand-crafted notes are not migrated. They're untouched.

## Testing

No automated tests in this round. Manual verification for the canary:

1. Run the build locally.
2. Serve `/notes/` via `python3 -m http.server` and open the page.
3. Check: title, meta tags, JSON-LD, header/nav, body rendering (headings, code, lists, links, tables), mermaid diagram rendering.
4. Check: homepage § RECENT FROM THE LOG includes the new note after running `build-log-index.mjs`.
5. Check: 404 page still works, `/notes/` directory listing still works (if applicable).

If manual verification passes, ship it. Add tests later if the pipeline grows beyond one script.

## Deliverables

1. `scripts/build-notes.mjs` — the build script.
2. `scripts/templates/note.html` — the note template.
3. `package.json` at repo root — minimal, with `markdown-it` + `gray-matter` pinned.
4. `package-lock.json` — committed.
5. `.github/workflows/build-notes.yml` — the Action.
6. `README.md` — updated "Publishing a post" section documenting the new flow.
7. One pilot note converted (`auditlm-ai-governance-gap.md` + regenerated `.html`).

## Open decisions made during brainstorming

- **Mermaid: client-side.** No headless chromium dependency. Accept ~500KB JS payload on mermaid-containing pages only.
- **Frontmatter schema:** `title`, `date`, `slug`, `description` required; `type`, `series`, `tags` optional. `type` defaults to `note`.
- **Existing notes: leave alone.** Only new notes flow through the pipeline.
- **Scope: `/notes/` only.** `/blog/` stays hand-authored.

## Risks / follow-ups worth noting (not in scope)

- Syntax highlighting for code blocks — currently plain `<pre><code>`. Adding Prism/Shiki is a separate concern.
- Image handling — markdown `![alt](path)` works for images in `/notes/images/`, but upload tooling isn't part of this. Drop the image in, reference it.
- Draft support (author a note that doesn't publish) — not supported. Don't commit notes you don't want published. If this becomes painful, add a `draft: true` frontmatter field in v2.
- Old hand-crafted notes styling drift — if we tweak the template, new notes diverge from old ones. Acceptable; the old notes are frozen.
