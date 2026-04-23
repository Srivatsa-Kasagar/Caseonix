# Caseonix — Brand Voice & Style

Version-controlled brand guide. If you're editing site copy (or asking an AI assistant to), check this file first.

---

## Brand personality

A 25-year financial-services engineer who went solo. Calm, specific, builds in public. Technical first, commercial never. Respects the reader's intelligence. Treats regulation as an engineering input, not a marketing angle.

**Sounds like:** *"End-to-end RAG pipeline on Cloudflare's edge — paragraph-aware chunking, BGE-Small embeddings, Vectorize ANN search, Gemma 4 reranking."*

**Does not sound like:** *"Unlock the power of next-generation AI with our revolutionary platform."*

---

## Voice attributes

### Specific over sweeping

- **We are:** measured numbers, commit SHAs, library names, dates, concrete examples.
- **We are not:** *"fast"*, *"innovative"*, *"revolutionary"*, *"industry-leading"*, *"cutting-edge"*.
- **Sounds like:** *"1.8s p50 latency"*, *"266 commits"*, *"Apr 22 · 09:14"*.
- **Does not sound like:** *"lightning-fast"*, *"battle-tested"*.

### Engineering-first, not authority-first

- **We are:** describing how things are built, what design choices were made, what tradeoffs exist.
- **We are not:** prescribing what readers should do, issuing playbooks, giving compliance/legal advice.
- **Sounds like:** *"Here's how I structured the retrieval layer."*
- **Does not sound like:** *"Here's what your bank should do about OSFI E-23."*

### Personal, without being performative

- **We are:** using "I" where natural, showing git history, linking to actual repos, naming real people and tools.
- **We are not:** personal-brand theater, humblebragging, "thought leadership" phrasing.
- **Sounds like:** *"I built this because I needed it for a wealth-planning engagement."*
- **Does not sound like:** *"As a thought leader in the Canadian AI space…"*

### Dry, sparingly witty

- **We are:** one well-placed one-liner per page. *"Half research, half build"*. *"One operator"*. *"Read the log"*.
- **We are not:** jokes, puns, or emoji (except 🇨🇦 on LocalMind, which earns its place by signalling routing).
- **Sounds like:** *"Both trails public on this site."*
- **Does not sound like:** *"Let's dive into this 🚀"*.

---

## Audience

**Primary:** engineers at Canadian financial institutions, law firms, and regulated startups evaluating AI tooling. They know PIPEDA, OSFI E-23, RAG, and JSON schema.

**Secondary:** fellow AI builders looking for Canadian-specific engineering references.

**Not the audience:** buyers looking for a vendor to outsource compliance to. The site should consistently disqualify that audience rather than try to convert them.

**Reading-level assumption:** expert. Don't over-explain, don't dumb down.

---

## Messaging pillars

Every page should reinforce at least one.

1. **Canadian regulated contexts deserve purpose-built engineering.** Not generic AI wrapped in Canadian marketing.
2. **Solo-built is a feature, not a limitation.** Direct access to the operator, no agency layer, deep technical context retained across projects.
3. **Build in public.** Every project has a repo; every repo has real commit history; the status widget shows live activity.
4. **Research feeds the build, the build feeds the research.** Lab notes are engineering postmortems, not white papers.

---

## Tone by channel

Voice stays fixed. Tone shifts emotional inflection.

| Channel | Tone | Example |
|---|---|---|
| Homepage hero | Calm, confident, short | *"Half research, half build — AI for Canadian regulated work."* |
| Blog posts | Explanatory, practitioner-to-practitioner | *"Eleven techniques to lift RAG quality beyond naïve baselines."* |
| Lab notes | Methodical, numbered, cites code | *"Lab note 1/3 — LocalMind RAG pipeline."* |
| Project cards | Problem → approach → tradeoff | *"Canadian firms can't send sensitive docs to US-hosted AI — here's the architecture."* |
| Footer / disclaimer | Plain, declarative | *"Caseonix is a solo AI lab. Posts and projects are engineering commentary — not legal, compliance, tax, financial, investment, or professional advice."* |
| Commit messages | Imperative, specific | *"soften sovereignty claims"* |
| Social previews (OG / Twitter) | Tighter than the article description; one clean sentence | *"OSFI E-23, agentic AML, and the accountability stack — engineering notes for builders."* |

---

## Style rules (mechanical)

- **Headings:** sentence case. Proper nouns and product names stay capitalized (Claude Code, Cloudflare Workers AI, LocalMind, PIPEDA, OSFI).
- **Oxford comma:** yes.
- **Em dashes:** literal `—`, no surrounding spaces. Avoid `&mdash;` in new code.
- **Brand name:** `caseonix` in the logo / wordmark only. `Caseonix` everywhere else — titles, body, JSON-LD, social previews.
- **Author name:** `Srivatsa Kasagar` (title case), in `<meta name="author">` and JSON-LD `founder.name`.
- **Contractions:** use them (*"can't"*, *"won't"*, *"here's"*). The brand isn't corporate-formal.
- **Numbers:** numerals for perf/scale (`<2s`, `94%`, `266 commits`). Spell out one through nine in prose where it isn't a measurement.
- **Acronyms:** spell out on first use per page if the audience might not know them (OSFI, FINTRAC, FRFI, UBO). Well-known ones (AI, API, PDF) need no explanation.
- **Exclamation marks:** none. Specificity does the work.
- **Emoji:** one per context maximum, only with semantic weight (🇨🇦 on LocalMind = routed through Canada). No decorative use.
- **SERP-length discipline:**
  - `<title>` ≤ 60 characters
  - `<meta name="description">` ≤ 160 characters
- **Structured data:** every article needs `<meta property="article:modified_time">` alongside `article:published_time`. Every page needs `<link rel="alternate" hreflang="en-ca">` plus `x-default`.

---

## Terminology — preferred / avoided

| Use this | Not this | Why |
|---|---|---|
| AI builds, AI engineering, agentic architectures | AI solutions, AI-powered, AI-enabled | "Builds" is concrete; "solutions" is vendor-speak. |
| Canadian regulated contexts | Canadian compliance / compliance-grade | You're not a compliance authority — you build *for* the context. |
| Engineering notes, lab notes, research notes | Playbook, framework, methodology | Notes are observational, playbooks are prescriptive. |
| Configurable review workflows | Compliance checklists | Tool feature vs. service claim. |
| Routed through Canadian region / CA-routed inference | Sovereign, 100% Canadian residency | Describes the architecture, avoids a guarantee. |
| PIPEDA-aligned, PIPEDA-aware | PIPEDA-safe, PIPEDA-compliant | "Aligned" is a posture; "safe/compliant" are claims. |
| Solo AI lab, one operator | Solo founder | "Founder" implies equity/company structure. |
| Open-source, MIT-licensed | Free, community-driven | Precise, legally accurate. |
| Canadian-edge | Sovereign | Geographic fact vs. loaded term. |
| Engineering-first | Compliance-first | Describes posture honestly. |

---

## Claim hygiene

Every quantified or categorical claim needs one of these backings within one click:

| Claim type | Backing |
|---|---|
| Performance (`<2s p50`, `94% t-slip recall`) | Repo README or lab note with measurement method + sample size |
| Geographic (CA-routed inference) | Architecture note documenting routing (Cloudflare region, jurisdiction pin, data-store regions) |
| Tech stack ("runs on Cloudflare Workers") | Repo tag list or `package.json` |
| Experience ("25 years in financial services") | LinkedIn or about page |

If a claim can't be backed, soften or remove it.

---

## Disclaimer discipline

- **Site-wide footer disclaimer** (already live): covers the perimeter.
- **Project-level disclaimers** stay specific to the risk:
  - **wealth-guide, portfolio tool:** *"Educational — not licensed advice, not a registered investment advisor."*
  - **NordID:** *"Not a compliance authority. Provides compliance intelligence; the regulated reporting entity makes the final determination."*
  - **LocalMind:** *"LocalMind is a document intelligence tool — it does not render legal, compliance, or privacy advice. Configure with your counsel."*
- **Lab notes on regulation:** rely on site footer; a one-line inline caveat is optional.

---

## Things to stop doing

1. Compliance-authority framing (*"compliance-grade"*, *"compliance-first playbook"*, *"governance infrastructure"*). Each is a claim a solo lab cannot substantiate.
2. *"Sovereign"* as a product or descriptor. Strong geopolitical weight; undermines specificity.
3. Mixing `&mdash;` and `—`. Literal `—` only.
4. Title case and sentence case mixed across headings. Sentence case is the standard.

## Things to keep doing

1. `§` section markers and `//` eyebrow comments. Signature visual vocabulary.
2. The live status widget. Strongest trust signal; uniquely hard to fake.
3. Linking every project to a real, public repo with commit history.
4. Writing lab notes in series (1/3 → 2/3 → 3/3). Engineering discipline + SEO topical clusters.
5. Quantifying everything in project cards. Back it up in the repo README.

---

## Quick checklist before shipping copy

- [ ] No compliance / authority claims about Caseonix itself.
- [ ] Title ≤ 60 chars, meta description ≤ 160 chars.
- [ ] Sentence case headings.
- [ ] Literal `—`, not `&mdash;`.
- [ ] Any quantified claim has a one-click backing.
- [ ] `hreflang="en-ca"` + `x-default` present.
- [ ] `article:modified_time` present on articles.
- [ ] Footer disclaimer rendered.
- [ ] If a project description: does it have a project-level disclaimer appropriate to the risk?
