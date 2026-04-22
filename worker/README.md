# caseonix-status

Cloudflare Worker powering the **Live Status** widget on caseonix.ca — receives GitHub webhooks, maintains a compact status snapshot in KV, and serves it to the homepage.

## Topology

- Worker bound to two Worker Routes on `caseonix.ca`:
  - `caseonix.ca/api/*` — read endpoint for the widget
  - `caseonix.ca/webhooks/*` — write endpoint for GitHub webhooks
- One KV namespace (`STATUS_KV`) holding one key: `status:current`.
- Everything else on `caseonix.ca` continues to proxy to GitHub Pages — same origin, no CORS.

## Routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/status` | Returns current snapshot JSON. Edge-cached 30s. |
| POST | `/webhooks/github` | Receives GitHub webhook. HMAC-validated. |
| POST | `/admin/seed` | Gated one-shot seed endpoint. Auth: `X-Seed-Token` header. |

## First-time setup

```bash
cd worker/
npm install

# 1. Create the KV namespace, paste the returned id into wrangler.toml
wrangler kv namespace create STATUS_KV

# 2. Generate and store secrets
openssl rand -hex 32 | wrangler secret put GITHUB_WEBHOOK_SECRET
openssl rand -hex 32 | wrangler secret put ADMIN_SEED_TOKEN

# 3. Deploy
wrangler deploy
```

The generated `GITHUB_WEBHOOK_SECRET` is the value you paste into each GitHub repo's webhook config.

## GitHub webhook config (per repo)

In each `caseonix/*` repo → Settings → Webhooks → Add webhook:

- **Payload URL**: `https://caseonix.ca/webhooks/github`
- **Content type**: `application/json`
- **Secret**: value of `GITHUB_WEBHOOK_SECRET`
- **Events**: Push, Releases, Workflow runs, Create
- **Active**: ✓

Start with the `Caseonix` repo, verify end-to-end, then add the rest.

## Seed the snapshot (once)

```bash
# In worker/
export ADMIN_SEED_TOKEN=<the value you set above>
export GITHUB_READ_TOKEN=<fine-grained PAT with read on caseonix/* (optional)>
npm run backfill
```

After that first seed, webhooks drive all updates.

## Verify

```bash
curl -s https://caseonix.ca/api/status | jq
```

## Scripts

- `npm run dev` — local dev server (wrangler)
- `npm run deploy` — deploy to Cloudflare
- `npm run typecheck` — `tsc --noEmit`
- `npm run backfill` — one-shot local seed script
