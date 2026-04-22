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

Use the Makefile — every command has a `make` target. `make help` shows them all.

```bash
cd worker/
make install

# 1. Create the KV namespace (auto-patches the id into wrangler.toml)
make kv-create

# 2. Generate + store both secrets. Values print to your terminal — copy them.
#    GITHUB_WEBHOOK_SECRET is what you paste into each GitHub repo webhook.
#    ADMIN_SEED_TOKEN is what you export for 'make backfill'.
make secrets

# 3. Deploy
make deploy
```

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
export ADMIN_SEED_TOKEN=<the value 'make secrets' printed for you>
export GITHUB_READ_TOKEN=<fine-grained PAT, read-only on caseonix/*, optional>
make backfill
```

After that first seed, webhooks drive all updates.

## Verify

```bash
make status     # curl caseonix.ca/api/status | jq
make logs       # wrangler tail
```

## All Make targets

- `make help` — full target list
- `make install` — `npm install`
- `make typecheck` — tsc across src/ + scripts/
- `make dev` — local wrangler dev
- `make deploy` — deploy Worker
- `make kv-create` — create KV namespace + auto-patch wrangler.toml
- `make secrets` — generate + store both secrets
- `make secret-webhook` / `make secret-seed` — individual secret targets
- `make backfill` — one-shot seed
- `make status` / `make logs` — runtime checks
- `make clean` — remove node_modules, .wrangler, dist
