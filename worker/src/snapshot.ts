import {
  EVENTS_CAP,
  PRIVATE_REPO_BLOCKLIST,
  REPO_ACTIVE_WINDOW_DAYS,
  RepoStatus,
  SITE_DOMAIN,
  SITE_REPO,
  Snapshot,
  StatusEvent,
} from "./types";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function shortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", timeZone: "UTC" });
}

function shortSha(sha: string): string {
  return (sha || "").slice(0, 7);
}

function prependEvent(events: StatusEvent[], next: StatusEvent): StatusEvent[] {
  return [next, ...events].slice(0, EVENTS_CAP);
}

function pruneStaleRepos(snap: Snapshot): Snapshot {
  const cutoff = Date.now() - REPO_ACTIVE_WINDOW_DAYS * MS_PER_DAY;
  const repos: Snapshot["repos"] = {};
  for (const [name, row] of Object.entries(snap.repos)) {
    const t = Date.parse(row.last_push_ts);
    if (!Number.isNaN(t) && t >= cutoff) repos[name] = row;
  }
  return { ...snap, repos };
}

function isBlocked(repoName: string): boolean {
  return PRIVATE_REPO_BLOCKLIST.includes(repoName);
}

export function patchSnapshot(
  prev: Snapshot,
  eventType: string,
  payload: Record<string, unknown>
): Snapshot {
  const now = new Date().toISOString();
  let next: Snapshot = { ...prev, updated_at: now };

  if (eventType === "push") next = handlePush(next, payload);
  else if (eventType === "release") next = handleRelease(next, payload);
  else if (eventType === "workflow_run") next = handleWorkflowRun(next, payload);
  else if (eventType === "create") next = handleCreate(next, payload);
  else if (eventType === "page_build") next = handlePageBuild(next, payload);

  return pruneStaleRepos(next);
}

function handlePush(snap: Snapshot, p: Record<string, unknown>): Snapshot {
  const repo = p.repository as { name: string; private?: boolean } | undefined;
  const headCommit = p.head_commit as { id?: string; message?: string; timestamp?: string } | null;
  if (!repo || !headCommit || !headCommit.id) return snap;
  if (repo.private) return snap;
  if (isBlocked(repo.name)) return snap;

  const ref = p.ref as string | undefined;
  if (ref && !ref.startsWith("refs/heads/")) return snap;

  const ts = headCommit.timestamp ?? new Date().toISOString();
  const sha = shortSha(headCommit.id);
  const summary = firstLine(headCommit.message ?? "").slice(0, 80);
  const isSite = repo.name === SITE_REPO;

  const nextRepos = { ...snap.repos };
  const existing = nextRepos[repo.name];
  nextRepos[repo.name] = {
    version: existing?.version || sha,
    last_push: shortDate(ts),
    last_push_ts: ts,
    status: existing?.status ?? "green",
    commit_count: existing?.commit_count,
  };

  const nextDeploy =
    isSite || !snap.latest_deploy.ts || Date.parse(ts) >= Date.parse(snap.latest_deploy.ts)
      ? {
          repo: repo.name,
          sha,
          date: shortDate(ts),
          ts,
          domain: isSite ? SITE_DOMAIN : snap.latest_deploy.domain,
          summary,
        }
      : snap.latest_deploy;

  const nextEvents = prependEvent(snap.events, {
    verb: isSite ? "deploy" : "commit",
    summary: isSite ? `${SITE_DOMAIN} ${sha} ${summary}` : `${repo.name} · ${sha} ${summary}`,
    ts,
    repo: repo.name,
  });

  return { ...snap, latest_deploy: nextDeploy, events: nextEvents, repos: nextRepos };
}

function handleRelease(snap: Snapshot, p: Record<string, unknown>): Snapshot {
  const action = p.action as string | undefined;
  if (action !== "published" && action !== "released") return snap;

  const repo = p.repository as { name: string; private?: boolean } | undefined;
  const release = p.release as { tag_name?: string; published_at?: string; name?: string } | undefined;
  if (!repo || !release?.tag_name) return snap;
  if (repo.private || isBlocked(repo.name)) return snap;

  const ts = release.published_at ?? new Date().toISOString();
  const nextRepos = { ...snap.repos };
  const existing = nextRepos[repo.name];
  nextRepos[repo.name] = {
    version: release.tag_name,
    last_push: existing?.last_push ?? shortDate(ts),
    last_push_ts: existing?.last_push_ts ?? ts,
    status: existing?.status ?? "green",
    commit_count: existing?.commit_count,
  };

  const nextEvents = prependEvent(snap.events, {
    verb: "release",
    summary: `${repo.name} · ${release.tag_name}${release.name ? ` ${release.name}` : ""}`,
    ts,
    repo: repo.name,
  });

  return { ...snap, events: nextEvents, repos: nextRepos };
}

function handleWorkflowRun(snap: Snapshot, p: Record<string, unknown>): Snapshot {
  const action = p.action as string | undefined;
  if (action !== "completed") return snap;

  const repo = p.repository as { name: string; private?: boolean } | undefined;
  const run = p.workflow_run as { conclusion?: string; updated_at?: string } | undefined;
  if (!repo || !run) return snap;
  if (repo.private || isBlocked(repo.name)) return snap;

  const existing = snap.repos[repo.name];
  if (!existing) return snap;

  const status: RepoStatus =
    run.conclusion === "success" ? "green" :
    run.conclusion === "failure" ? "red" : "yellow";

  const nextRepos = { ...snap.repos, [repo.name]: { ...existing, status } };
  return { ...snap, repos: nextRepos };
}

function handleCreate(snap: Snapshot, p: Record<string, unknown>): Snapshot {
  const refType = p.ref_type as string | undefined;
  if (refType !== "tag") return snap;

  const repo = p.repository as { name: string; private?: boolean } | undefined;
  const ref = p.ref as string | undefined;
  if (!repo || !ref) return snap;
  if (repo.private || isBlocked(repo.name)) return snap;

  const existing = snap.repos[repo.name];
  if (!existing) return snap;

  const nextRepos = { ...snap.repos, [repo.name]: { ...existing, version: ref } };
  return { ...snap, repos: nextRepos };
}

function handlePageBuild(snap: Snapshot, p: Record<string, unknown>): Snapshot {
  const repo = p.repository as { name: string; private?: boolean } | undefined;
  const build = p.build as
    | {
        status?: string;
        commit?: string;
        updated_at?: string;
        created_at?: string;
        error?: { message?: string | null };
      }
    | undefined;
  if (!repo || !build) return snap;
  if (repo.private || isBlocked(repo.name)) return snap;
  if (repo.name !== SITE_REPO) return snap;

  const ts = build.updated_at ?? build.created_at ?? new Date().toISOString();
  const sha = shortSha(build.commit ?? "");

  if (build.status === "built") {
    const nextDeploy = {
      repo: SITE_REPO,
      sha,
      date: shortDate(ts),
      ts,
      domain: SITE_DOMAIN,
      summary: "GitHub Pages build ✓",
    };
    const nextEvents = prependEvent(snap.events, {
      verb: "deploy",
      summary: `${SITE_DOMAIN} ${sha} live`,
      ts,
      repo: SITE_REPO,
    });
    return { ...snap, latest_deploy: nextDeploy, events: nextEvents };
  }

  if (build.status === "errored") {
    const nextEvents = prependEvent(snap.events, {
      verb: "deploy",
      summary: `${SITE_DOMAIN} ${sha} BUILD FAILED`,
      ts,
      repo: SITE_REPO,
    });
    return { ...snap, events: nextEvents };
  }

  return snap;
}

function firstLine(s: string): string {
  const nl = s.indexOf("\n");
  return nl === -1 ? s : s.slice(0, nl);
}
