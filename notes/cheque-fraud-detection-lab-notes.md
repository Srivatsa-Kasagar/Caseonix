---
title: "Research note — Cheque Image Fraud Detection on AWS"
date: 2026-03-18
slug: cheque-fraud-detection-lab-notes
description: "Lab log — exploring an architecture for automated cheque image fraud detection"
tags:
  - cheque-fraud
  - document-fraud
  - tampering-detection
  - vision-language-models
  - architecture-research
---

## What I Was Investigating

Can you build a production-grade cheque image fraud detection platform using AWS services (Textract, Bedrock, SageMaker) combined with open source and/or commercial components? What does the right mix look like?

Starting question was narrow — Textract + Bedrock for image-based cheque fraud. Ended up mapping the full problem space and landing on a specific hybrid architecture.

---

## Key Findings

### Finding 1: There is no managed "cheque fraud detection" service on AWS

Some early marketing-style proposals I looked at implied AWS has turnkey services for document tampering detection. It doesn't. What exists:
- **Textract** — managed OCR and field extraction (real, useful)
- **Bedrock Data Automation** — structured extraction from documents (real, useful)
- **Bedrock Automated Reasoning** — rule validation (real, useful)
- **SageMaker** — platform to build and host *your own* models (real, but you do the building)
- **Amazon Fraud Detector** — exists, but for transactional fraud, not image tampering
- **Rekognition** — has some content moderation but not document tampering specifically

Translation: "AWS intelligent document processing with tampering detection" is a reference architecture, not a managed service. You're assembling components.

### Finding 2: Error Level Analysis (ELA) is oversold for cheques

ELA is a real forensics technique but has significant limitations for this use case:
- Works on JPEG artifacts; degrades with re-encoding
- Cheque images going through image exchange (Check 21) are re-encoded — ELA signal mostly lost
- Catches *digital* manipulation of image files, not *physical* alteration of paper cheques
- Physical fraud (washing, alteration) happens before the scan, so ELA sees nothing

Still worth including as a weak signal in the mobile RDC path where original JPEG encoding survives. Not a headline technique.

### Finding 3: Open source is viable for most layers, 

weak on two Strong open source options:

- **Extraction/OCR:** Docling (IBM, Apache 2.0), PaddleOCR (Apache 2.0), docTR (Apache 2.0)
- **Rules engine:** Open Policy Agent / OPA (CNCF graduated, mature)
- **Forensic signals:** OpenCV, scikit-image, pyIFD
- **Vision-language models:** Qwen2.5-VL, Llama 3.2 Vision, InternVL2.5, Pixtral (Apache 2.0 variants available) Weak or problematic open source:
- **Tampering detection models** — research code only (TruFor, MVSS-Net, CAT-Net v2, ManTraNet). All need domain adaptation with your own labeled data. No drop-in.
- **Signature verification** — SigNet / SigVer architectures exist but research-to-production gap is large. Training data requirements are not realistic for a single institution.


### Finding 4: Tampering detection is the one piece you must build yourself

No path around this. Whether AWS-managed or open source, there is no pre-trained tampering detector for cheques.
- Options: MVSS-Net, CAT-Net v2, or similar architectures as starting points
- Hosting: SageMaker is the pragmatic choice (training jobs + real-time inference endpoints)
- Critical dependency: labeled training data (synthetic + real fraud cases from the institution)
- Synthetic data pipeline is typically 30-40% of the project engineering effort

### Finding 5: Signature verification is the one piece where commercial wins

Commercial vendors (Mitek, Parascript) have 20+ year training corpora built across many institutions. Single-institution in-house development produces meaningfully lower accuracy.

Caveat: in scoping conversations I ended up removing automated signature verification altogether and making it a manual analyst step. Reason: avoids commercial vendor procurement, reduces integration risk, and signature forgery catch rate is acceptable at analyst review volumes for many deployments. Lightweight automated presence check (signature absent / malformed via Textract) stays in the pipeline.

### Finding 6: Bedrock Claude Sonnet 4.5 as a reasoning layer is genuinely useful

Frontier VLM on top of structured signals catches subtle anomalies individual models miss. Key design points:
- Selective invocation (~40% of volume) rather than every cheque — controls cost
- Input: cheque image + all prior signal outputs + context
- Output: structured JSON with risk classification, evidence, bilingual explanation
- Instructed NOT to attempt signature verification — separation of concerns

Open source VLM alternatives (Qwen2.5-VL 72B, Llama 3.2 Vision) are capable but 6-12 months behind on subtle anomaly reasoning. For the ambiguous-case reasoning layer, quality matters.

### Finding 7: Graph analysis is a different product

Initial architecture included Amazon Neptune for mule/kiting/ring detection. Removed in later iterations — these are cross-account behavioral fraud patterns, not image fraud. Belong in a downstream AML / transaction monitoring system.

Scope discipline: the platform detects fraud visible in the image. Cross-account patterns, velocity rules, and positive pay matching are out. This makes the platform defensible and focused.

### Finding 8: AWS vs Cloudflare — AWS wins for regulated banking

Evaluated a Cloudflare deployment. Showstoppers for this specific use case:
- No good custom GPU model hosting (tampering model)
- No direct R2 equivalent to S3 Object Lock (regulatory immutable storage)
- Frontier VLM quality gap (no Claude Sonnet 4.5 equivalent)
- Regulatory audit posture less established for financial services
- Workflows and Queues newer/less mature than Step Functions and EventBridge

Cloudflare is strong for edge, consumer-facing workloads, and cost-sensitive applications. Not the right fit for regulated banking fraud detection with 7-year retention and active examiner scrutiny.

---

## Final Architecture (Summary)

**Scope:** Cheque image fraud detection only. Out: cross-account behavioral fraud, positive pay, automated signature matching.

**Stack:**
| Layer | Choice |
|---|---|
| API ingress | API Gateway + WAF |
| Orchestration | Step Functions |
| Event bus | EventBridge |
| Extraction | Textract + custom bilingual parser |
| Rules | OPA (open source) |
| Duplicate detection | DynamoDB + perceptual hash |
| Tampering detection | Custom model on SageMaker |
| Signature handling | Textract presence check; evidence packaged for manual analyst review |
| Forensic signals | OpenCV / scikit-image / pyIFD on ECS |
| VLM reasoning | Bedrock Claude Sonnet 4.5 (selective) |
| Scoring | Lambda |
| Storage | S3 Object Lock + Aurora + DynamoDB |
| Search | OpenSearch |
| IaC | Terraform |

**Scoring ensemble weights (after signature verification removed):**
- Tampering model: 40%
- VLM assessment: 30%
- Forensic signals: 20%
- Rules engine soft rules: 10%
- Hard rules override anything else

**Pattern:** Single API entry, event-driven output. External case management system consumes review decisions. Feedback loop via inbound API for retraining.

---

## Open Research Questions

1. What's the actual catch rate on signature forgery when verification is fully manual? Need real-world volume data.
2. Does the tampering model generalize across banks' cheque stock, or does it need per-bank fine-tuning? Hypothesis: needs per-bank.
3. Synthetic training data quality — how well do programmatically-generated tampering examples transfer to real fraud? Need to measure against held-out real fraud set.
4. VLM selective invocation gating — 40% is a starting estimate. What's the actual optimal given cost/catch-rate tradeoffs?
5. At what volume does self-hosting the VLM (Qwen2.5-VL 72B on SageMaker) beat Bedrock on unit economics? Rough estimate: 3M+ cheques/day. Worth modeling precisely.

---

## Lessons Learned

1. **"AWS has a service for that" deserves skepticism.** Marketing descriptions often conflate reference architectures with managed services. Always check the actual service catalog and capabilities.

2. **Scope discipline beats feature breadth.** Every time I tightened scope (removing graph analysis, positive pay, automated signature matching), the architecture got cleaner and more defensible without meaningfully hurting the core fraud catch rate.

3. **Training data access is usually the critical path.** More than model architecture, more than infrastructure — historical labeled fraud cases determine whether the project succeeds.

4. **Hybrid beats pure.** Pure AWS, pure open source, or pure commercial are all worse than a thoughtful mix that uses each approach where it's genuinely best.

5. **Explainability matters more than accuracy alone.** Regulated environments need decisions that can be defended in examinations. Every signal must be traceable and explainable, even at the cost of some ensemble accuracy.

6. **Human-in-the-loop is not a fallback — it's a design choice.** Moving signature verification to manual analyst review simplified the architecture and removed vendor risk. The right automation boundary depends on the task, not on "automate everything."

---

*End of lab notes.*
