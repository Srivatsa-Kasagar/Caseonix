---
title: "Research note — AuditLM and the AI governance gap"
date: 2026-03-18
slug: auditlm-ai-governance-gap
description: "A working research note on AuditLM — a provider-agnostic governance layer for LLMs in regulated industries. Context, landscape, and what I'm building."
series: "Research lab notes"
tags:
  - AI governance
  - LLM audit trail
  - OSFI E-23
  - PIPEDA
  - AuditLM
---

Regulated organizations are deploying LLMs far faster than they are governing them. Only **25%** have fully implemented AI governance programs (Pacific AI, 2025). Only **10%** say they are fully prepared to audit an AI system (Ernst & Young, September 2025). **78%** of executives lack confidence they could pass an AI governance audit inside 90 days (Grant Thornton, 2026). The ground beneath this is shifting too: OSFI Guideline E-23 was updated in September 2025 to explicitly cover AI/ML models, and takes effect **May 1, 2027** for every federally regulated Canadian financial institution. The EU AI Act’s high-risk obligations hit **August 2, 2026**, with fines up to 7% of global revenue. This gap — the inability to prove what AI did, who authorized it, and whether policy was enforced on any specific request — is the concrete problem I’ve been researching. I’m calling it the “AI proof gap.”

The existing tools solve pieces. **Langfuse** and **Arize** are built for ML engineers chasing model performance — token counts, drift, latency. They do not produce legally defensible audit trails, track consent, detect PII, or speak in the language of a regulatory examination. GRC platforms like **OneTrust** and **ServiceNow** document that a policy exists but cannot prove it was enforced on any particular request — they are not in the data path. **Credo AI** and **IBM watsonx.governance** do governance documentation and workflow credibly (Mastercard, Cisco, PepsiCo as customers for Credo AI) but again sit alongside the stack, not inside it. No single platform combines **in-data-path enforcement** with governance workflow and regulator-facing compliance reports. That is the structural opening.

What I’m building in the lab: **AuditLM** — a provider-agnostic governance proxy that sits between any application and any LLM provider (Anthropic, OpenAI, Azure, Gemini). Every prompt is SHA-256 hashed before forwarding, records are hash-chained, and hourly Merkle roots anchor to immutable storage — cryptographic proof of what happened at inference time. The proxy is a Cloudflare Workers + Hono edge service with an OpenAI-compatible surface, so integration is a `one-line change` from existing SDKs. On top of that: PII detection (Canadian SIN and provincial health cards, US SSN/EIN, universal entities), a policy engine with consent and purpose-limitation enforcement, pre-deployment gates (Algorithmic Impact Assessment plus red-team records), and signed PDF compliance reports mapped to OSFI E-23, PIPEDA, SOC 2, HIPAA, CCPA, and OCC/Fed SR 11-7. Canada-first, because OSFI E-23 is the single hardest compliance deadline on the calendar; US and EU follow through Canadian customers with cross-border exposure. Phase 1 MVP is in development. The research question I’m chasing in parallel: can compliance infrastructure feel like plumbing — invisible to developers, decisive to compliance officers — or does regulatory defensibility always tax the application layer? If you’re a compliance officer, CISO, or engineering lead wrestling with this, I’d like to hear how you’re framing the gap.
