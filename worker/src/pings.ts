import { PING_TIMEOUT_MS, REPO_ENDPOINTS, RepoStatus, Snapshot } from "./types";

export async function pingAllEndpoints(): Promise<Record<string, RepoStatus>> {
  const entries = Object.entries(REPO_ENDPOINTS);
  const out: Record<string, RepoStatus> = {};
  await Promise.all(
    entries.map(async ([repo, url]) => {
      out[repo] = await pingOne(url);
    })
  );
  return out;
}

async function pingOne(url: string): Promise<RepoStatus> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  try {
    // HEAD first; fall back to GET for servers that reject HEAD (some CF
    // Access walls, some Worker routes). We don't read the body either way.
    let r = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
    if (r.status === 405 || r.status === 501) {
      r = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
    }
    clearTimeout(t);
    if (r.ok) return "green";
    if (r.status >= 500) return "red";
    return "yellow";
  } catch {
    clearTimeout(t);
    return "red";
  }
}

export function applyPingResults(
  prev: Snapshot,
  results: Record<string, RepoStatus>
): Snapshot {
  const repos = { ...prev.repos };
  for (const [name, status] of Object.entries(results)) {
    if (repos[name]) {
      repos[name] = { ...repos[name], status };
    }
  }
  return { ...prev, repos, updated_at: new Date().toISOString() };
}
