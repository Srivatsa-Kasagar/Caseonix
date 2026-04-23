# Adding a new repo to the Live Status widget

Checklist for wiring a new `caseonix/<repo>` into the widget on caseonix.ca.

Run from `worker/` unless noted.

## 1. Code changes

### 1a. Always: add the repo to the backfill list

`worker/scripts/backfill.ts` — append to `REPOS`:

```ts
const REPOS = [
  "Caseonix",
  "localmind",
  "FinLit",
  // ...
  "<new-repo>",   // ← add here
];
```

Without this, `make backfill` skips the repo and its row stays missing until the first webhook push lands.

### 1b. If the repo is **private**: allow it through

`worker/src/types.ts` — add to `PRIVATE_REPOS_ALLOWLIST`:

```ts
export const PRIVATE_REPOS_ALLOWLIST: readonly string[] = ["localmind", "consul-ai", "<new-repo>"];
```

And add the same name to the `PRIVATE_ALLOWLIST` set at the top of `backfill.ts`. The two lists must match.

Private repos appear in the widget with metadata only — no SHAs, no commit messages (see `handlePush` in `snapshot.ts`).

Public repos need nothing in this file.

### 1c. If the repo has a **live URL**

`worker/src/types.ts` — add to `REPO_ENDPOINTS`:

```ts
export const REPO_ENDPOINTS: Readonly<Record<string, string>> = {
  Caseonix: "https://caseonix.ca",
  // ...
  "<new-repo>": "https://<url>",   // ← add here
};
```

This single entry drives two things:

1. **Uptime pings** — scheduled cron HEAD-checks the URL and writes `status` + `latency_ms` into the repo row.
2. **LATEST DEPLOY tile label** — `/api/status` exposes `REPO_ENDPOINTS` as `snap.endpoints`, and the widget extracts the host to render `<domain> | <repo>` when this repo is the newest deploy. No `index.html` edit needed.

Skip if there's no live endpoint — the tile just shows the repo name.

### 1d. Deploy (only if `types.ts` changed)

```bash
make typecheck
make deploy
```

Changes to `backfill.ts` alone don't require a Worker redeploy — backfill runs locally.

## 2. Create the GitHub webhook

Needs `GITHUB_WEBHOOK_SECRET` — the value you saved when you last ran `make secrets` / `make secret-webhook`. Paste it into `$SECRET` below.

```bash
SECRET='<paste the saved webhook secret here>'

gh api -X POST repos/caseonix/<new-repo>/hooks \
  -f name=web \
  -F active=true \
  -f 'events[]=push' \
  -f 'events[]=release' \
  -f 'events[]=workflow_run' \
  -f 'events[]=create' \
  -f 'config[url]=https://caseonix.ca/webhooks/github' \
  -f 'config[content_type]=json' \
  -f "config[secret]=$SECRET" \
  -f 'config[insecure_ssl]=0'
```

Or via the GitHub UI: repo → Settings → Webhooks → Add webhook, same payload URL + events + secret.

> **If you've lost `GITHUB_WEBHOOK_SECRET`:** it can't be read from anywhere (Cloudflare encrypts Worker secrets at rest, GitHub masks as `********`). You have to rotate — see `ROTATING_SECRETS.md` (TODO if needed) or re-run `make secret-webhook` and update **every** existing hook with the new value.

## 3. Verify the webhook

```bash
HOOK_ID=$(gh api repos/caseonix/<new-repo>/hooks \
  --jq '.[] | select(.config.url | contains("caseonix.ca/webhooks/github")) | .id')

gh api -X POST repos/caseonix/<new-repo>/hooks/$HOOK_ID/pings
sleep 3

gh api repos/caseonix/<new-repo>/hooks \
  --jq '.[] | "\(.last_response.code)/\(.last_response.status) \(.last_response.message)"'
```

Expect `204/active OK`. If you see `401` — secret mismatch between GitHub and the Worker.

## 4. Backfill so the row appears immediately

Without this, the row shows up only on the next push to the new repo.

```bash
export ADMIN_SEED_TOKEN='<paste the saved seed token>'
export GITHUB_READ_TOKEN=$(gh auth token)   # optional, avoids rate limits
make backfill
```

Then verify:

```bash
curl -s https://caseonix.ca/api/status | jq '.repos["<new-repo>"]'
```

Expect a row with the current SHA, last_push, and commit count.

## 5. (Optional) Portfolio tile wiring

Only needed if you also want the repo visible as a **project card** on the portfolio page — separate from the live widget. Not required for the widget to work.

In `index.html`:

- **Fallback repos list** (lines ~1595–1660): one `<div class="status-repo-item">` per repo. These show on initial page load before `/api/status` responds; the JS replaces them with live data. Safe to leave as-is — new repos auto-appear in the widget from the KV snapshot.
- **Project card**: add a `<div class="project-card ... data-project="<slug>">` block in the projects grid.
- **Project modal data**: add an entry keyed by `<slug>` in the `PROJECTS` object (search for `finlit: {` around line 2296) with icon, badge, links, etc.

These are portfolio-content concerns, not widget plumbing. Skip if the repo is internal-only.

## Summary — minimum steps for a new repo to appear in the widget

1. Append name to `REPOS` in `scripts/backfill.ts`.
2. If private → add to `PRIVATE_REPOS_ALLOWLIST` in `src/types.ts` **and** `PRIVATE_ALLOWLIST` in `scripts/backfill.ts`; `make deploy`.
3. If live URL → add to `REPO_ENDPOINTS` in `src/types.ts`; `make deploy`.
4. `gh api … hooks` to create the webhook with `GITHUB_WEBHOOK_SECRET`.
5. Ping the hook, expect 204/active.
6. `make backfill` to populate the row now.
