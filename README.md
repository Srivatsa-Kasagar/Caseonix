# caseonix

> A solo AI lab building tools for Canadian regulated markets — residency, privilege, audit trails, agentic reliability. Waterloo, ON · Est. 2024.

**Live:** [caseonix.ca](https://caseonix.ca)

This repo is the source of the site itself — the homepage, blog, lab notes, and the Cloudflare Worker that powers the hero's Live Status widget. The site is where I think out loud; the `/blog/` and `/notes/` directories are the public trail.

---

## What's in here

```
/                       Static homepage (index.html) — deployed by GitHub Pages
/blog/                  Long-form posts (HTML with JSON-LD)
/notes/                 Shorter lab + research notes
/worker/                Cloudflare Worker — /api/status + GitHub webhook sink
/scripts/               Build scripts (log index generator)
/.github/workflows/     Automations (auto-rebuild log index on publish)
```

## Architecture

- **Site:** plain HTML/CSS, zero build step, served by GitHub Pages from `main`.
- **Worker:** [`worker/`](./worker) — Cloudflare Worker bound to `caseonix.ca/api/*` and `caseonix.ca/webhooks/*`. Receives GitHub webhook events from the sub-project repos, maintains a compact status snapshot in Workers KV, serves it to the homepage widget. Details in [`worker/README.md`](./worker/README.md).
- **Single origin:** everything is `caseonix.ca` — Pages for static, Worker for `/api/*`. No CORS, no subdomain.

## Major builds

Each project below has its own repo. They're all tools I use myself or built for real Canadian compliance problems.

| Project | What it is | Repo |
|---|---|---|
| **LocalMind Sovereign** | Sovereign document intelligence — classification, PII redaction, compliance checklists on Cloudflare's Canadian edge | [localmind](https://github.com/caseonix/localmind) |
| **Consul** | AI-assisted portfolio analysis with deterministic math (Sharpe, VaR) + AI narratives | [consul.caseonix.ca](https://consul.caseonix.ca) |
| **FinLit** | Python library for extracting structured data from Canadian financial documents (T-slips, SEDAR, bank statements) with PIPEDA PII detection | [FinLit](https://github.com/caseonix/FinLit) |
| **wealth-guide** | Claude Code skill that dispatches six specialist agents to produce a 12-section financial plan | [wealth-guide](https://github.com/caseonix/wealth-guide) |
| **Canadian Tax & CRA** | Claude Code plugin — eight slash commands for CRA compliance across 13 jurisdictions | [canadian-tax-cra](https://github.com/caseonix/canadian-tax-cra) |
| **Canadian Regulatory** | Claude Code plugin covering 11 domains: PIPEDA, CASL, FINTRAC, OSFI, FCAC, and more | [canadian-regulatory-compliance](https://github.com/caseonix/canadian-regulatory-compliance) |
| **LoonieLog** | Receipt tracking for Canadian freelancers — auto-scans Gmail/Drive, T2125-mapped | [LoonieLog](https://github.com/caseonix/LoonieLog) |

## Stack

What actually powers this site and the broader work:

- **Languages:** Python, TypeScript, SQL
- **Models:** Claude (Opus, Sonnet), Gemini (extraction), MCP protocol, pydantic-ai
- **Infra:** Cloudflare Workers, D1, R2, Vectorize, Workers AI
- **Framework:** Hono (Workers), plain HTML for this site

## Publishing a post

1. Drop a new HTML file into `/blog/` or `/notes/`. Make sure its JSON-LD includes `headline` and `datePublished`.
2. Commit and push.
3. A GitHub Action (`.github/workflows/build-log-index.yml`) runs `scripts/build-log-index.mjs`, which regenerates `log.json` (full feed) and rewrites the top 4 rows in `index.html` between the `<!-- log:auto-start -->` markers. It commits the refresh back to `main` automatically.

To run the build locally instead: `node scripts/build-log-index.mjs`.

## Why public

Threads land with me directly — no agency layer, no SDR queue. Keeping the site repo public is part of that. If you want to see how something on the homepage is built, it's here.

## Contact

- **Email:** srivatsa.kasagar@gmail.com
- **LinkedIn:** [linkedin.com/in/skasagar](https://linkedin.com/in/skasagar)
- **GitHub:** [github.com/caseonix](https://github.com/caseonix)
