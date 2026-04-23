---
title: "Dug into Pega GenAI Autopilot to figure out what it actually takes to adopt it"
date: 2026-03-23
slug: pega-autopilot-lab-notes
description: "Pega GenAI Autopilot is an AI assistant embedded in Pega App Studio. It generates Case Types, workflows, data models, personas, sample data, and forms from natural-language prompts. Pega positions it as a developer productivity accelerator."
tags:
  - pega
  - dconstellation
  - autopilot
  - blueprint
  - architecture-research
  - caseonix-research
  - infosec
---

## What I was trying to answer

1. What does Autopilot actually do?
2. What do you need to have in place before you can use it?
3. Does Pega Cloud 3 actually matter for the GenAI addendum, or is that just Pega pushing upgrades?
4. Does it work on old UI-Kit apps, or is it Constellation-only?

---

## Notes

### What Autopilot is

- AI assistant baked into App Studio.
- Takes a plain-English prompt and spits out Case Types, workflows, data models, personas, sample data, forms.
- Design-time only. Not a runtime thing.
- Don't confuse with Blueprint (pre-build SaaS design tool) or Coach (runtime mentor for end users). All three are separate.

### Platform stuff

- Needs Infinity '23 or later. No path from 7.x or 8.x — not even with a patch.
- Off by default on '23 and '24. Have to turn it on per application.
- Runs on Azure OpenAI under the hood. Pega provisions the model. You can't bring your own key.

### Cloud 3 — yes, it's actually mandatory

- Pega Academy is very explicit about this: Cloud 2 clients have to migrate to Cloud 3. No way around it.
- The GenAI addendum can't even be signed against a Cloud 2 tenant.
- Cloud 2 → Cloud 3 isn't a toggle. It's a proper project:
  - SRS migration
  - Deployment Manager rework
  - Platform upgrade to '23+
  - Environment re-provisioning
  - Regression testing
- Months of work, not weeks.
- One escape hatch: Blueprint runs as standalone SaaS, no Cloud 3 needed. So legacy tenants can at least use Blueprint.

### UI-Kit vs Constellation — it's not a clean yes/no

- App Studio itself works for both. So you can *open* Autopilot on a UI-Kit app.
- But — and this is the catch — Autopilot only generates Constellation Views. It does not generate UI-Kit Sections or Harnesses.
- So on a pure UI-Kit app you get partial value only: data model suggestions, sample data, personas. Any generated screens won't render in the UI-Kit portal.
- Hybrid path exists from Infinity '23 onward:
  - Set `pyEnableTraditionalUICoexistence` to true
  - Add new Constellation case types via App Studio → Settings → Traditional UI in Constellation
  - Keeps existing UI-Kit case types untouched, lets new ones use Autopilot
- Worth noting: UI-Kit 15 is still supported. Pega isn't forcing anyone off it. So this is a call to make, not a gun-to-head migration.

### Data handling — the InfoSec conversation

- App metadata leaves the tenant. Case names, field labels, prompts, sample data requests all go to Azure OpenAI via Pega's gateway.
- You can't route through your own Azure tenant. You can't swap in your own key.
- For any regulated FS client, this needs InfoSec and data-residency sign-off before anyone touches production.

### Commercial side

- GenAI Addendum is a separate thing on top of the normal Pega Cloud contract.
- Can't sign it until you're on Cloud 3.
- Pricing isn't public — have to talk to the Account Executive.

### Warranty on output (or lack of it)

- Pega explicitly says: not our problem if Autopilot gives you bad suggestions. Always review.
- Which means architect review of everything is still mandatory before anything ships.
- So the speed-up is at the authoring step. Governance doesn't get any faster.

---

## Constraints I want to flag

- Data exits the tenant to Azure OpenAI. Needs InfoSec sign-off.
- Can't pick your own LLM. Azure OpenAI only.
- Pega doesn't stand behind the output quality.
- UI-Kit apps drag a Constellation migration in behind them if you want the full thing.
- Anything off the supported path will probably break eventually — Pega's own warning.

---

## Gates, in order

1. Check what Cloud generation the tenant is on. If Cloud 2, stop — migration is the first project.
2. Confirm platform is Infinity '23 or later.
3. Go through the app inventory. For each UI-Kit app, decide: coexistence, full Constellation migration, or skip.
4. Get InfoSec and data-residency to sign off on metadata going to Azure OpenAI.
5. Sign the GenAI addendum.
6. Turn it on per app in App Studio.
7. Pilot on a throwaway Constellation app before rolling out.

---

## Fit

**Works well:**
- Greenfield Constellation app, tenant already on Cloud 3, InfoSec happy.

**Don't bother yet:**
- Stuck on Cloud 2 — the real decision is whether to pay for the migration.
- Target app is UI-Kit — the real discussion is the Constellation work.
- Data residency blocks Azure OpenAI routing.

**Fallback for legacy estates:**
- Blueprint. Standalone SaaS, doesn't care about your Cloud generation or UI architecture. Covers the requirements/early-design bit.

---

## Blueprint — quick notes

- Who uses it: Business Architects, Product Owners, LSAs, and basically anyone in a joint business/IT requirements workshop.
- The win: requirements and alignment cycles go from weeks of workshops to days. Pega has a customer example of a 7-month requirements phase cut down to 1 month.
- Outputs: PDF for sign-off, Blueprint file you can import into a Pega environment when the build starts.
- Catch: it's a design artefact, not a working app. Still need a build afterwards. And if that build uses Autopilot, you're back at the Cloud 3 + Constellation gates.

---

## Still need to chase down

- What does the GenAI addendum actually cost? Usage tiers? Metering model?
- How much of a Blueprint export actually survives the import into a real Pega environment?
- Does Autopilot behave consistently on hybrid coexistence apps, or are there edge cases when UI-Kit and Constellation case types sit side-by-side?
- Can you pick the Azure OpenAI region? Canadian region available? This one matters a lot for Canadian regulated clients.
- Does the coexistence model give you all Autopilot features, or just some?

---

## Sources

- Pega Academy: *Implementation of Pega GenAI*
- Pega Docs: *Pega GenAI Autopilot in application development*
- Pega Docs: *Enabling Pega GenAI in Pega Cloud*, *Process to update to Pega Cloud 3*
- Pega Docs: *Limitations when using traditional UI with Constellation*
- Pega Community: *CLSA thread on integrating Constellation with existing Infinity '23 apps*
- Pega Community: *Autopilot — Accelerate Development with Context-Aware Assistance*
- Pega Support Center posts on Cloud 2 GenAI limitations
