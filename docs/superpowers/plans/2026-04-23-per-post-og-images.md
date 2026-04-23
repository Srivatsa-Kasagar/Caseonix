# Per-Post OG Images Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-generate a unique 1200×630 PNG social share card for every markdown-pipeline note at `/og/<slug>.png`, and point the note's `og:image` + `twitter:image` meta tags at its own card.

**Architecture:** New Node script `scripts/build-og-images.mjs` scans `notes/*.md`, renders a fixed Satori element tree per note (dark bg, `§ CASEONIX · LAB NOTE` eyebrow, title with 2-line clamp, byline + URL row), converts SVG to PNG via `@resvg/resvg-js`, writes to `og/<slug>.png`. Two bundled `.ttf` font files in `scripts/fonts/` provide Inter ExtraBold + JetBrains Mono Medium. The note template's `og:image` + `twitter:image` placeholders switch from a hardcoded site-wide PNG to `og/{{slug}}.png`. New script runs as part of `npm run build` and the existing `.github/workflows/build-notes.yml` Action.

**Tech Stack:** Node 20 (ESM), `satori@^0.10`, `@resvg/resvg-js@^2.6`, `gray-matter` (already installed), GitHub Actions, GitHub Pages.

**Spec reference:** `docs/superpowers/specs/2026-04-23-per-post-og-images-design.md`

**Working directory:** repo root = `/Users/srivatsakasagar/Documents/03-Dev-Projects/caseonix`. All paths below are relative to this. All `git` / `node` / `npm` commands run from this directory.

**Push policy:** commits land locally only. Do NOT run `git push` during plan execution — the owner will review the full commit stack and push once at the end.

---

## Task 1: Install dependencies (satori + resvg)

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json` (auto)

- [ ] **Step 1: Install both deps**

```bash
npm install --save-dev satori@^0.10 @resvg/resvg-js@^2.6
```

Expected: `added N packages` — no peer warnings that block install. `@resvg/resvg-js` pulls a platform-specific native binary (darwin-arm64 on dev, linux-x64 on CI).

- [ ] **Step 2: Verify both imports work**

```bash
node -e "const s = await import('satori'); const r = await import('@resvg/resvg-js'); console.log('satori:', typeof s.default); console.log('resvg:', typeof r.Resvg);"
```

Expected:
```
satori: function
resvg: function
```

- [ ] **Step 3: Inspect the updated `package.json` devDependencies block**

Run:
```bash
node -e "const p = JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log(Object.keys(p.devDependencies).sort().join('\n'))"
```

Expected output (exact, alphabetical):
```
@resvg/resvg-js
gray-matter
markdown-it
satori
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "Add satori + @resvg/resvg-js for OG image generation"
```

---

## Task 2: Bundle font files

**Files:**
- Create: `scripts/fonts/Inter-ExtraBold.ttf`
- Create: `scripts/fonts/JetBrainsMono-Medium.ttf`
- Create: `scripts/fonts/LICENSE.md`

Both fonts are SIL OFL 1.1 licensed — redistributable, commercial-use allowed.

- [ ] **Step 1: Create the fonts directory**

```bash
mkdir -p scripts/fonts
```

- [ ] **Step 2: Download Inter ExtraBold**

```bash
curl -L -o scripts/fonts/Inter-ExtraBold.ttf 'https://github.com/rsms/inter/raw/v4.0/docs/font-files/Inter-ExtraBold.ttf'
```

Verify the download is a real TTF:
```bash
file scripts/fonts/Inter-ExtraBold.ttf
```

Expected: `scripts/fonts/Inter-ExtraBold.ttf: TrueType Font data`. File size should be between 300KB and 500KB. If you get "HTML document" or a size under 10KB, the URL 404'd — find the current release URL at https://github.com/rsms/inter/releases and retry.

- [ ] **Step 3: Download JetBrains Mono Medium**

```bash
curl -L -o scripts/fonts/JetBrainsMono-Medium.ttf 'https://github.com/JetBrains/JetBrainsMono/raw/v2.304/fonts/ttf/JetBrainsMono-Medium.ttf'
```

Verify:
```bash
file scripts/fonts/JetBrainsMono-Medium.ttf
```

Expected: `TrueType Font data`, 100KB–300KB. If the URL 404s, pick a current release at https://github.com/JetBrains/JetBrainsMono/releases and retry.

- [ ] **Step 4: Write a short LICENSE note so the bundled fonts have attribution**

Create `scripts/fonts/LICENSE.md` with this exact content:

```markdown
# Bundled fonts

Both font files in this directory ship under the SIL Open Font License 1.1
(https://scripts.sil.org/OFL), which permits bundling and redistribution.

- **Inter-ExtraBold.ttf** — Inter by Rasmus Andersson, https://github.com/rsms/inter
- **JetBrainsMono-Medium.ttf** — JetBrains Mono by JetBrains, https://github.com/JetBrains/JetBrainsMono

Used at build time only by `scripts/build-og-images.mjs` to render social share
card PNGs; not served to site visitors.
```

- [ ] **Step 5: Commit**

```bash
git add scripts/fonts/Inter-ExtraBold.ttf scripts/fonts/JetBrainsMono-Medium.ttf scripts/fonts/LICENSE.md
git commit -m "Bundle Inter + JetBrains Mono TTFs for OG image rendering"
```

---

## Task 3: Write `scripts/build-og-images.mjs` — scaffold + font loading

**Files:**
- Create: `scripts/build-og-images.mjs`

This task gets the script to the point where it loads fonts and scans `.md` files, but does NOT render yet. Rendering comes in Task 4.

- [ ] **Step 1: Create `scripts/build-og-images.mjs` with scaffold**

Write this exact content:

```js
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
```

- [ ] **Step 2: Run and verify**

```bash
node scripts/build-og-images.mjs
```

Expected output (the three pipeline notes are listed, with formatted dates):
```
loaded fonts: Inter 800, JetBrains Mono 500
found 3 .md files
  · auditlm-ai-governance-gap.md · slug=auditlm-ai-governance-gap date=Mar 18, 2026
  · cheque-fraud-detection-lab-notes.md · slug=cheque-fraud-detection-lab-notes date=Apr 23, 2026
  · pega-autopilot-lab-notes.md · slug=pega-autopilot-lab-notes date=Apr 23, 2026
```

(Actual slugs and dates depend on current state of `notes/*.md`; the key is all three files are listed.)

- [ ] **Step 3: Commit**

```bash
git add scripts/build-og-images.mjs
git commit -m "Add build-og-images.mjs scaffold: font loading + .md scanning"
```

---

## Task 4: Wire Satori + Resvg rendering

**Files:**
- Modify: `scripts/build-og-images.mjs`
- Create: `og/auditlm-ai-governance-gap.png` (generated)
- Create: `og/cheque-fraud-detection-lab-notes.png` (generated)
- Create: `og/pega-autopilot-lab-notes.png` (generated)

- [ ] **Step 1: Add imports at the top of `scripts/build-og-images.mjs`**

Directly after `import matter from 'gray-matter';`, add:

```js
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
```

- [ ] **Step 2: Add color + layout constants above `loadFonts()`**

Insert these constants after the `FONTS_DIR` constant and before `async function loadFonts()`:

```js
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
```

- [ ] **Step 3: Add the Satori element tree builder**

Directly below the constants, before `async function loadFonts()`, add:

```js
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
        // Title (flex-grow: 1, vertically centered via its own flex column)
        {
          type: 'div',
          props: {
            style: {
              display: 'flex',
              alignItems: 'center',
              flexGrow: 1,
              // Satori renders a single block child; line-clamp here enforces 2 lines max.
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
```

Note on `fontWeight: 800` for the byline: we only bundled Inter ExtraBold (weight 800), so every `fontFamily: 'Inter'` element must render at 800. Satori uses whatever weight matches closest; keeping a single weight means no font fallback surprises. Visually, the byline reads as normal weight because it's 22px vs the title's 60px — size dominates.

- [ ] **Step 4: Replace `main()` to render + write PNGs**

Replace the existing `main()` function (keep the `main().catch(...)` wrapper) with:

```js
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
```

- [ ] **Step 5: Run the build**

```bash
node scripts/build-og-images.mjs
```

Expected output (exact slugs/bytes vary):
```
  · auditlm-ai-governance-gap.md → og/auditlm-ai-governance-gap.png (NNNNN bytes)
  · cheque-fraud-detection-lab-notes.md → og/cheque-fraud-detection-lab-notes.png (NNNNN bytes)
  · pega-autopilot-lab-notes.md → og/pega-autopilot-lab-notes.png (NNNNN bytes)
built 3 OG image(s)
```

Byte counts should each be between 20KB and 80KB. A 0-byte or >200KB file usually means a rendering bug.

- [ ] **Step 6: Visually inspect one of the PNGs**

```bash
open og/auditlm-ai-governance-gap.png
```

Check the image shows:
- Dark navy background.
- Teal `§ CASEONIX · LAB NOTE` eyebrow at top-left.
- Large white title in center (may wrap to 2 lines).
- Byline `Srivatsa Kasagar · Mar 18, 2026` at bottom-left.
- `caseonix.ca ↗` in teal at bottom-right.
- No clipping, no overlap, no huge empty bands.

If the layout looks visibly wrong (e.g. text missing, byline overlapping title, background not dark), stop and debug before committing. Likely culprits: wrong fontFamily name string (must match the `name:` in `loadFonts` exactly), wrong flex axis, wrong font weight.

- [ ] **Step 7: Verify idempotency**

```bash
node scripts/build-og-images.mjs
cp og/auditlm-ai-governance-gap.png /tmp/og-first.png
node scripts/build-og-images.mjs
diff -q og/auditlm-ai-governance-gap.png /tmp/og-first.png
```

Expected: `diff -q` prints nothing (files are byte-identical). If they differ, something non-deterministic is leaking in — investigate before committing.

- [ ] **Step 8: Commit**

```bash
git add scripts/build-og-images.mjs og/
git commit -m "Render OG images via Satori + Resvg for markdown-pipeline notes"
```

---

## Task 5: Update note template to reference per-slug OG image

**Files:**
- Modify: `scripts/templates/note.html` (lines ~19 and ~32)
- Modify: `notes/auditlm-ai-governance-gap.html` (regenerated)
- Modify: `notes/cheque-fraud-detection-lab-notes.html` (regenerated)
- Modify: `notes/pega-autopilot-lab-notes.html` (regenerated)

- [ ] **Step 1: Replace the `og:image` tag in the template**

In `scripts/templates/note.html`, find:

```html
  <meta property="og:image" content="https://caseonix.ca/og-image-v2.png" />
```

Replace with:

```html
  <meta property="og:image" content="https://caseonix.ca/og/{{slug}}.png" />
```

- [ ] **Step 2: Replace the `twitter:image` tag in the template**

In the same file, find:

```html
  <meta name="twitter:image" content="https://caseonix.ca/og-image-v2.png" />
```

Replace with:

```html
  <meta name="twitter:image" content="https://caseonix.ca/og/{{slug}}.png" />
```

Leave the `og:image:width` and `og:image:height` tags (1200 / 630) exactly as they are.

- [ ] **Step 3: Verify the template now has both placeholders**

```bash
grep -c 'caseonix.ca/og/{{slug}}.png' scripts/templates/note.html
```

Expected: `2`.

```bash
grep -c 'caseonix.ca/og-image-v2.png' scripts/templates/note.html
```

Expected: `0`.

- [ ] **Step 4: Regenerate all note HTML so their og:image paths update**

```bash
node scripts/build-notes.mjs
```

Expected: all three notes rebuild successfully.

- [ ] **Step 5: Verify each regenerated .html now points at its own PNG**

```bash
for f in notes/auditlm-ai-governance-gap.html notes/cheque-fraud-detection-lab-notes.html notes/pega-autopilot-lab-notes.html; do
  echo "=== $f ==="
  grep 'og:image\|twitter:image' "$f" | grep -v 'width\|height'
done
```

Expected: each file shows its own slug in both meta tags, e.g.:
```
=== notes/auditlm-ai-governance-gap.html ===
  <meta property="og:image" content="https://caseonix.ca/og/auditlm-ai-governance-gap.png" />
  <meta name="twitter:image" content="https://caseonix.ca/og/auditlm-ai-governance-gap.png" />
```

No file should still point at `og-image-v2.png`.

- [ ] **Step 6: Commit**

```bash
git add scripts/templates/note.html notes/auditlm-ai-governance-gap.html notes/cheque-fraud-detection-lab-notes.html notes/pega-autopilot-lab-notes.html
git commit -m "Point note template og:image + twitter:image at per-slug PNG"
```

---

## Task 6: Wire into `npm run build`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add `build:og` and update `build` in the `scripts` block**

Find the existing `scripts` block in `package.json`:

```json
  "scripts": {
    "build:notes": "node scripts/build-notes.mjs",
    "build:log": "node scripts/build-log-index.mjs",
    "build": "npm run build:notes && npm run build:log"
  },
```

Replace with:

```json
  "scripts": {
    "build:notes": "node scripts/build-notes.mjs",
    "build:og": "node scripts/build-og-images.mjs",
    "build:log": "node scripts/build-log-index.mjs",
    "build": "npm run build:notes && npm run build:og && npm run build:log"
  },
```

- [ ] **Step 2: Run the full build**

```bash
npm run build
```

Expected: three stages run in order (`build:notes` prints `built N note(s)`, `build:og` prints `built N OG image(s)`, `build:log` prints the log regeneration output). No errors.

- [ ] **Step 3: Verify nothing unexpected changed in the working tree**

```bash
git status -s
```

Expected: only `M package.json` and `M package-lock.json` (from Task 1 dep install — should already be committed) OR a clean working tree. No changes under `og/`, `notes/`, `index.html`, `log.json` because the build is idempotent and ran against the current state (which already reflects all three stages).

If the working tree has changes under `notes/*.html`, `og/*.png`, `index.html`, `blog/index.html`, or `log.json`, investigate — they should be no-ops on a clean rebuild.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "Chain build:og into npm run build"
```

---

## Task 7: Wire into GitHub Action

**Files:**
- Modify: `.github/workflows/build-notes.yml`

- [ ] **Step 1: Read the current workflow**

```bash
cat .github/workflows/build-notes.yml
```

Note the current structure: `on.push.paths` filter, `Install dependencies` step, `Build notes from markdown` step, `Commit if changed` step.

- [ ] **Step 2: Add the build-og-images step after build-notes**

In `.github/workflows/build-notes.yml`, find this block:

```yaml
      - name: Build notes from markdown
        run: node scripts/build-notes.mjs

      - name: Commit if changed
```

Insert a new step between them so it becomes:

```yaml
      - name: Build notes from markdown
        run: node scripts/build-notes.mjs

      - name: Build OG images
        run: node scripts/build-og-images.mjs

      - name: Commit if changed
```

- [ ] **Step 3: Widen the `paths:` filter so OG-related file changes also trigger the workflow**

In the same file, find the `paths:` block (under `on.push`):

```yaml
    paths:
      - 'notes/**/*.md'
      - 'scripts/build-notes.mjs'
      - 'scripts/templates/note.html'
      - 'package.json'
      - 'package-lock.json'
      - '.github/workflows/build-notes.yml'
```

Replace with:

```yaml
    paths:
      - 'notes/**/*.md'
      - 'scripts/build-notes.mjs'
      - 'scripts/build-og-images.mjs'
      - 'scripts/templates/note.html'
      - 'scripts/fonts/**'
      - 'package.json'
      - 'package-lock.json'
      - '.github/workflows/build-notes.yml'
```

- [ ] **Step 4: Widen the `Commit if changed` step to also stage new/modified PNGs**

Find this block inside `Commit if changed`:

```yaml
          if git diff --quiet -- notes/; then
            echo "No changes under notes/ — skipping commit."
            exit 0
          fi
          git config user.name  "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add notes/
          git commit -m "chore(notes): regenerate HTML from markdown"
          git push
```

Replace with:

```yaml
          if git diff --quiet -- notes/ og/; then
            echo "No changes under notes/ or og/ — skipping commit."
            exit 0
          fi
          git config user.name  "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add notes/ og/
          git commit -m "chore(notes): regenerate HTML + OG images"
          git push
```

- [ ] **Step 5: Verify the workflow still parses as YAML**

```bash
python3 -c "import yaml; y=yaml.safe_load(open('.github/workflows/build-notes.yml')); print('jobs.build.steps =', len(y['jobs']['build']['steps']))"
```

Expected: `jobs.build.steps = 5` (checkout, setup-node, install deps, build-notes, build-og, commit) — wait, that's 6. Adjust the expected value depending on the original step count; the new number should be exactly one more than before (we inserted one step).

Actually run this to get the current count:
```bash
python3 -c "import yaml; y=yaml.safe_load(open('.github/workflows/build-notes.yml')); [print(i, s.get('name','(uses '+s.get('uses','?')+')')) for i,s in enumerate(y['jobs']['build']['steps'])]"
```

Expected steps (order matters):
```
0 (uses actions/checkout@v4)
1 (uses actions/setup-node@v4)
2 Install dependencies
3 Build notes from markdown
4 Build OG images
5 Commit if changed
```

If the count or order differs, fix before committing.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/build-notes.yml
git commit -m "GH Action: run build-og-images after build-notes, commit PNGs too"
```

---

## Task 8: Update README publishing section

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Find the "Lab notes (`/notes/`)" subsection in the publishing section**

```bash
grep -n 'Lab notes (`/notes/`)' README.md
```

Expected: one line number.

- [ ] **Step 2: Locate the exact paragraph that describes what happens on push**

In `README.md`, find this exact paragraph (may span multiple lines):

```markdown
Commit and push. A GitHub Action (`.github/workflows/build-notes.yml`) runs `scripts/build-notes.mjs`, generates the HTML, and commits it back to `main`. A second Action (`build-log-index.yml`) then updates `log.json` and the homepage § RECENT FROM THE LOG rows. End-to-end latency: ~60-90s from `git push` to live.
```

Replace with:

```markdown
Commit and push. A GitHub Action (`.github/workflows/build-notes.yml`) runs `scripts/build-notes.mjs` (generates the HTML) and `scripts/build-og-images.mjs` (generates a 1200×630 social share card at `/og/<slug>.png`), then commits both back to `main`. A second Action (`build-log-index.yml`) updates `log.json` and the homepage § RECENT FROM THE LOG rows. End-to-end latency: ~60-90s from `git push` to live.
```

- [ ] **Step 3: Update the local-build instruction**

In `README.md`, find:

```markdown
To run the build locally: `npm run build:notes` (or `npm run build` to also refresh the log index).
```

Replace with:

```markdown
To run the build locally: `npm run build:notes` for HTML only, `npm run build:og` for just OG images, or `npm run build` to do everything (HTML + OG images + log index).
```

- [ ] **Step 4: Verify the edits landed**

```bash
grep -c 'build-og-images' README.md
```

Expected: at least `2` (one in the paragraph about the Action, one in the local-build instructions).

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "README: document OG image auto-generation in publishing flow"
```

---

## Task 9: Final end-to-end verification

**Files:** none — pure verification.

- [ ] **Step 1: Clean build from scratch**

```bash
npm run build
```

Expected: all three stages run without error. Last line of output from `build:og` should be `built 3 OG image(s)`.

- [ ] **Step 2: Confirm each markdown-pipeline note has a matching PNG**

```bash
for md in notes/auditlm-ai-governance-gap.md notes/cheque-fraud-detection-lab-notes.md notes/pega-autopilot-lab-notes.md; do
  slug=$(basename "$md" .md)
  if [ -f "og/$slug.png" ]; then
    size=$(wc -c < "og/$slug.png" | tr -d ' ')
    echo "✓ og/$slug.png ($size bytes)"
  else
    echo "✗ MISSING og/$slug.png"
  fi
done
```

Expected: three lines starting with `✓`, each with a byte count between 20000 and 80000.

- [ ] **Step 3: Confirm each note's HTML references its own PNG**

```bash
for f in notes/auditlm-ai-governance-gap.html notes/cheque-fraud-detection-lab-notes.html notes/pega-autopilot-lab-notes.html; do
  slug=$(basename "$f" .html)
  count=$(grep -c "caseonix.ca/og/$slug.png" "$f")
  echo "$f: $count references (expected 2)"
done
```

Expected: each file reports `2 references` (one in `og:image`, one in `twitter:image`).

- [ ] **Step 4: Confirm no note HTML still references the generic site-wide image in its og:image / twitter:image**

```bash
for f in notes/auditlm-ai-governance-gap.html notes/cheque-fraud-detection-lab-notes.html notes/pega-autopilot-lab-notes.html; do
  stale=$(grep -E 'og:image|twitter:image' "$f" | grep -c 'og-image-v2.png')
  echo "$f: stale refs = $stale"
done
```

Expected: all three show `stale refs = 0`.

(Hand-crafted notes and blog posts are allowed to keep referencing `og-image-v2.png` — this check only covers the 3 pipeline notes in scope.)

- [ ] **Step 5: Review recent git log**

```bash
git log --oneline -12
```

Expected to see (in reverse chronological order) approximately these eight new commits from this plan, on top of earlier history:

```
<hash> README: document OG image auto-generation in publishing flow
<hash> GH Action: run build-og-images after build-notes, commit PNGs too
<hash> Chain build:og into npm run build
<hash> Point note template og:image + twitter:image at per-slug PNG
<hash> Render OG images via Satori + Resvg for markdown-pipeline notes
<hash> Add build-og-images.mjs scaffold: font loading + .md scanning
<hash> Bundle Inter + JetBrains Mono TTFs for OG image rendering
<hash> Add satori + @resvg/resvg-js for OG image generation
```

If any commit is missing, go back and complete that task.

- [ ] **Step 6: Optional — preview on the live site after push**

(Post-push verification, not part of plan execution.) After the owner pushes and the `pages-build-deployment` Action goes green, paste one note URL into the LinkedIn Post Inspector at `https://www.linkedin.com/post-inspector/`. Confirm the preview shows the generated per-post card, not the old site-wide `og-image-v2.png`.

---

## Follow-ups explicitly out of scope

(Listed in the spec's Risks/follow-ups section; do NOT implement any of these as part of this plan.)

- Reworking the site-wide `og-image-v2.png` (drop pills + byline).
- Extending OG generation to the 5 `/blog/*.html` posts.
- Per-post OG images for the 4 hand-crafted notes (`localmind-nlp-layer`, `localmind-rag-pipeline`, `localmind-rag-quality`, `nordid-canadian-business-identity`).
- Series indicators, multi-language tags, or any additional card elements.
- Using the generator for the homepage's og:image.
