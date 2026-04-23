# Per-post OG images (markdown-pipeline notes only) — design spec

**Date:** 2026-04-23
**Owner:** Srivatsa
**Status:** Draft — awaiting review

## Goal

Auto-generate a unique social share (Open Graph) image for every markdown-pipeline note, showing the post's title in the site's dark aesthetic. The image is 1200×630 PNG, written to `/og/<slug>.png`, and each note's `<meta property="og:image">` + `<meta name="twitter:image">` point at its own unique PNG. Every LinkedIn / X share of a note will show a card with that specific note's title instead of a generic site-wide image.

## Non-goals

- **Not for hand-crafted notes.** The five existing hand-crafted notes (`localmind-nlp-layer`, `localmind-rag-pipeline`, `localmind-rag-quality`, `nordid-canadian-business-identity`, plus any future hand-crafted notes) keep pointing at the existing site-wide `og-image-v2.png`.
- **Not for blog posts.** The five `/blog/*.html` posts keep pointing at the site-wide image.
- **Not a rework of `og-image-v2.png`.** The site-wide fallback stays exactly as it is. We may revisit it as a separate exercise.
- **No subtitle / description on the card.** Title only (Option A from the brainstorming).
- **No frontmatter changes required.** Generator reads only what's already there (`title`, `date`, `slug`).

## Design

Every per-post card is 1200×630 PNG with this fixed layout:

```
┌──────────────────────────────────────────────────────────────┐
│                                                              │
│  § CASEONIX · LAB NOTE                                       │   ← eyebrow
│                                                              │
│                                                              │
│  [Post title, Inter 800, 64 → 56 → 48px adaptive,            │
│   up to 2 lines, wrapped on word boundaries, tracked -0.02em]│
│                                                              │
│                                                              │
│                                                              │
│                                                              │
│  Srivatsa Kasagar · Apr 23, 2026          caseonix.ca  ↗    │   ← byline / URL
│                                                              │
└──────────────────────────────────────────────────────────────┘
  80px padding all around
```

**Colors** (same CSS vars as the site):
- Background: `#0F1B2A` (site `--bg`)
- Eyebrow + URL + arrow: `#7FCBB0` (site `--teal-1`)
- Title: `#E8ECF1` (site `--text`)
- Byline: `#64748B` (site `--text-3`)

**Typography:**
- Eyebrow: JetBrains Mono 500, 24px, letter-spacing 0.16em, uppercase.
- Title: Inter ExtraBold 800, 60px, line-clamp 2, line-height 1.18, tracked -0.02em, word-break word-boundaries.
- Byline: Inter Regular 400, 22px.
- URL: JetBrains Mono 500, 22px.

**Overflow behavior:** title uses Satori's CSS `line-clamp: 2` + `overflow: hidden` with `text-overflow: ellipsis`. Titles that would render more than 2 lines at 60px get `…` appended on the second line. Build does NOT fail on long titles — just clamps. Authors can see the clipped title in the generated PNG and shorten the frontmatter if they don't like the clamp.

## Architecture

```
notes/*.md  ──(build-notes.mjs)──►  notes/<slug>.html
     │                                     │
     │                                     ▼
     │                            <meta og:image="/og/<slug>.png">
     │                                     │
     └──(build-og-images.mjs)────►   og/<slug>.png
```

Two independent scripts. Both called from `npm run build`. The HTML references `/og/<slug>.png` via a placeholder in the template; the PNG is produced by the OG script. If the HTML builds but the OG image doesn't, the HTML still renders fine (404 on og:image just means LinkedIn falls back to the site-wide image — graceful degradation).

## Components

### 1. `scripts/build-og-images.mjs`

Zero-runtime Node ESM script. Reads `notes/*.md`, renders an SVG via [satori](https://github.com/vercel/satori) using a compact element tree, converts SVG to PNG via [@resvg/resvg-js](https://github.com/yisibl/resvg-js), writes to `og/<slug>.png`.

Flow per `.md`:

1. Parse frontmatter (reuse pattern from `build-notes.mjs`).
2. Build a Satori element tree: outer flex-column container → eyebrow text → flex-grow spacer → title (line-clamp:2) → flex-grow spacer → byline row (flex-row, space-between).
3. Call `satori(tree, { width: 1200, height: 630, fonts: [...bundled...] })` → SVG string.
4. `new Resvg(svg).render().asPng()` → PNG buffer.
5. Write to `og/<slug>.png`.

Idempotent: same input always produces the same PNG bytes. No timestamps, no random IDs, no anti-aliasing drift (resvg is deterministic).

### 2. Bundled fonts

Satori needs font buffers. We bundle two font files in `scripts/fonts/`:
- `Inter-ExtraBold.ttf` (Inter 800) — Google Fonts, SIL OFL licensed.
- `JetBrainsMono-Medium.ttf` (JetBrains Mono 500) — Google Fonts, SIL OFL licensed.

Both committed to the repo. Combined size ~500KB. Fetched once manually; no runtime downloads.

### 3. Template update

In `scripts/templates/note.html`, replace:
```html
<meta property="og:image" content="https://caseonix.ca/og-image-v2.png" />
<meta name="twitter:image" content="https://caseonix.ca/og-image-v2.png" />
```

With:
```html
<meta property="og:image" content="https://caseonix.ca/og/{{slug}}.png" />
<meta name="twitter:image" content="https://caseonix.ca/og/{{slug}}.png" />
```

(There may also be og:image:width / og:image:height that stay unchanged.)

### 4. `package.json`

Add two dev dependencies:
- `satori` — pinned to a 0.x minor.
- `@resvg/resvg-js` — pinned to a 2.x minor.

Add a new script:
```json
"build:og": "node scripts/build-og-images.mjs"
```

Update `build`:
```json
"build": "npm run build:notes && npm run build:og && npm run build:log"
```

### 5. GitHub Action update

Extend `.github/workflows/build-notes.yml` to also run `node scripts/build-og-images.mjs` after `build-notes.mjs`. Commit any new/updated PNGs in the same bot commit as the regenerated HTML.

Path filter stays the same (`notes/**/*.md`, `scripts/build-notes.mjs`, etc.) — adding `scripts/build-og-images.mjs` and `scripts/fonts/**` to the filter.

## Error handling

- Missing font file → fail build with clear path.
- Satori / Resvg render error → propagates with filename context.
- Long title → does NOT error; clamps to 2 lines with ellipsis (see Overflow behavior above).

## Output file layout

```
og/
  auditlm-ai-governance-gap.png
  cheque-fraud-detection-lab-notes.png
  pega-autopilot-lab-notes.png
```

At repo root. Served by GitHub Pages at `https://caseonix.ca/og/<slug>.png`.

**Why root-level, not `/notes/og/`:** keeps the URL pattern portable if we later extend to blog posts. `/og/<slug>.png` works regardless of whether the source was a note or post.

## Testing

No automated tests — consistent with `build-notes.mjs`. Manual verification:
1. Run `npm run build:og`.
2. Open each generated PNG in Preview / an image viewer. Check: readable title, correct colors, no clipping, byline + URL visible.
3. After deploy: paste a note URL into the LinkedIn Post Inspector (`https://www.linkedin.com/post-inspector/`) and the X Card Validator (legacy but still usable). Confirm the per-post card renders.

## Deliverables

1. `package.json` + `package-lock.json` — add deps.
2. `scripts/fonts/Inter-ExtraBold.ttf`.
3. `scripts/fonts/JetBrainsMono-Medium.ttf`.
4. `scripts/build-og-images.mjs` — the generator.
5. `scripts/templates/note.html` — update og:image + twitter:image placeholders.
6. `og/auditlm-ai-governance-gap.png` + `og/cheque-fraud-detection-lab-notes.png` + `og/pega-autopilot-lab-notes.png` — the three initial images (generated by running the script).
7. Regenerated `notes/auditlm-ai-governance-gap.html` + `notes/cheque-fraud-detection-lab-notes.html` + `notes/pega-autopilot-lab-notes.html` — will include the updated `og:image` paths.
8. `.github/workflows/build-notes.yml` — adds the `build-og-images.mjs` step.
9. `README.md` — short note in the publishing section that OG images auto-generate.

## Open decisions made

- **Scope:** markdown-pipeline notes only. Other notes + blog posts unchanged.
- **Design:** title-only minimal (Option A from brainstorm).
- **Tooling:** Satori + Resvg (pure JS, no browser). Same stack Vercel/Linear use.
- **Commit generated PNGs to repo:** yes. ~1MB for 3 images; scales to ~10MB at ~30 notes. Acceptable for a portfolio repo. Avoids CI image-generation complexity.
- **Fonts bundled:** yes. Two .ttf files in `scripts/fonts/`.

## Risks / follow-ups worth noting (not in scope)

- Rework of site-wide `og-image-v2.png` (drop pills + byline). Easy to do using the same Satori framework once established.
- Extending to blog posts — would need the posts to run through a similar script. Uses the same OG renderer; just a scope change.
- Per-post images for the 4 hand-crafted notes — add to scope later if desired.
- Multi-language / series info on the card — out of scope.
