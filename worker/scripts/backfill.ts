#!/usr/bin/env tsx
/**
 * One-shot backfill for caseonix-status Worker.
 *
 * Queries the GitHub REST API for recent activity across caseonix/* repos,
 * reduces it into a Snapshot, and POSTs to /admin/seed on the deployed Worker.
 *
 * Usage (from worker/):
 *   export ADMIN_SEED_TOKEN=<the token you set via wrangler secret put>
 *   export GITHUB_READ_TOKEN=<fine-grained PAT, optional but recommended>
 *   npm run backfill
 */

const WORKER_ORIGIN = process.env.WORKER_ORIGIN ?? "https://caseonix.ca";
const OWNER = "caseonix";
const SITE_REPO = "Caseonix";
const SITE_DOMAIN = "caseonix.ca";
const EVENTS_CAP = 6;

const REPOS = [
  "Caseonix",
  "localmind",
  "FinLit",
  "wealth-guide",
  "canadian-tax-cra",
  "canadian-regulatory-compliance",
  "LoonieLog",
  "consol-cloud",
];

// Private repos allowed through with metadata only (no commit messages, no SHAs).
// Must match PRIVATE_REPOS_ALLOWLIST in worker/src/types.ts.
const PRIVATE_ALLOWLIST = new Set(["localmind", "consol-cloud"]);

type EventVerb = "commit" | "deploy" | "release" | "post" | "eval";

type Snapshot = {
  updated_at: string;
  latest_deploy: { repo: string; sha: string; date: string; ts: string; domain?: string; summary?: string };
  events: { verb: EventVerb; summary: string; ts: string; repo: string }[];
  repos: Record<string, { version: string; last_push: string; last_push_ts: string; status: "green" | "yellow" | "red"; commit_count?: number; language?: string }>;
};

function gh(path: string): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "caseonix-status-backfill",
  };
  if (process.env.GITHUB_READ_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_READ_TOKEN}`;
  }
  return fetch(`https://api.github.com${path}`, { headers });
}

function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "2-digit", timeZone: "UTC" });
}

function firstLine(s: string): string {
  const nl = s.indexOf("\n");
  return nl === -1 ? s : s.slice(0, nl);
}

async function latestReleaseTag(repo: string): Promise<string | null> {
  const r = await gh(`/repos/${OWNER}/${repo}/releases/latest`);
  if (!r.ok) return null;
  const j = (await r.json()) as { tag_name?: string };
  return j.tag_name ?? null;
}

async function latestCommit(repo: string): Promise<{ sha: string; date: string; message: string } | null> {
  const r = await gh(`/repos/${OWNER}/${repo}/commits?per_page=1`);
  if (!r.ok) return null;
  const j = (await r.json()) as Array<{ sha: string; commit: { author: { date: string }; message: string } }>;
  if (!Array.isArray(j) || j.length === 0) return null;
  return { sha: j[0].sha, date: j[0].commit.author.date, message: j[0].commit.message };
}

async function repoMeta(repo: string): Promise<{ private: boolean; default_branch: string; language: string | null } | null> {
  const r = await gh(`/repos/${OWNER}/${repo}`);
  if (!r.ok) return null;
  const j = (await r.json()) as { private: boolean; default_branch: string; language: string | null };
  return j;
}

async function commitCount(repo: string, branch: string): Promise<number | undefined> {
  const r = await gh(`/repos/${OWNER}/${repo}/commits?sha=${encodeURIComponent(branch)}&per_page=1`);
  if (!r.ok) return undefined;
  const link = r.headers.get("link");
  if (!link) return undefined;
  const m = link.match(/page=(\d+)>;\s*rel="last"/);
  return m ? parseInt(m[1], 10) : undefined;
}

async function buildSnapshot(): Promise<Snapshot> {
  const snap: Snapshot = {
    updated_at: new Date().toISOString(),
    latest_deploy: { repo: "", sha: "", date: "", ts: new Date(0).toISOString() },
    events: [],
    repos: {},
  };

  for (const repo of REPOS) {
    const meta = await repoMeta(repo);
    if (!meta) {
      console.warn(`skip ${repo}: cannot fetch repo metadata (404 / rate-limited / token missing)`);
      continue;
    }

    const allowPrivate = PRIVATE_ALLOWLIST.has(repo);
    if (meta.private && !allowPrivate) {
      console.log(`skip ${repo}: private (not in allowlist)`);
      continue;
    }

    const commit = await latestCommit(repo);
    if (!commit) {
      console.warn(`skip ${repo}: no commits found`);
      continue;
    }

    const tag = await latestReleaseTag(repo);
    const count = await commitCount(repo, meta.default_branch);

    snap.repos[repo] = {
      version: tag ?? commit.sha.slice(0, 7),
      last_push: shortDate(commit.date),
      last_push_ts: commit.date,
      status: "green",
      commit_count: count,
      language: meta.language ?? undefined,
    };

    // Private repos: metadata only. No events, no latest_deploy.
    if (meta.private) {
      console.log(`private ${repo}: metadata only (${count ?? "?"} commits, ${meta.language ?? "—"})`);
      continue;
    }

    const isSite = repo === SITE_REPO;
    const summary = firstLine(commit.message).slice(0, 80);
    snap.events.push({
      verb: isSite ? "deploy" : "commit",
      summary: isSite
        ? `${SITE_DOMAIN} ${commit.sha.slice(0, 7)} ${summary}`
        : `${repo} · ${commit.sha.slice(0, 7)} ${summary}`,
      ts: commit.date,
      repo,
    });

    const isNewestPush = Date.parse(commit.date) >= Date.parse(snap.latest_deploy.ts);
    if (isSite || isNewestPush) {
      snap.latest_deploy = {
        repo,
        sha: commit.sha.slice(0, 7),
        date: shortDate(commit.date),
        ts: commit.date,
        domain: isSite ? SITE_DOMAIN : snap.latest_deploy.domain,
        summary,
      };
    }
  }

  snap.events.sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));
  snap.events = snap.events.slice(0, EVENTS_CAP);

  return snap;
}

async function main() {
  const seedToken = process.env.ADMIN_SEED_TOKEN;
  if (!seedToken) {
    console.error("ADMIN_SEED_TOKEN env var is required");
    process.exit(1);
  }

  console.log(`Building snapshot from api.github.com for ${REPOS.length} repos…`);
  const snap = await buildSnapshot();

  console.log("\nSnapshot preview:");
  console.log(JSON.stringify(snap, null, 2));

  console.log(`\nPOST ${WORKER_ORIGIN}/api/seed`);
  const r = await fetch(`${WORKER_ORIGIN}/api/seed`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Seed-Token": seedToken },
    body: JSON.stringify(snap),
  });

  if (!r.ok) {
    console.error(`seed failed: ${r.status} ${await r.text()}`);
    process.exit(1);
  }
  console.log("seed ok");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
