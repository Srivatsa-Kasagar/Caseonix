import { PING_TIMEOUT_MS, REPO_ENDPOINTS, RepoStatus, Snapshot } from "./types";

export type PingResult = { status: RepoStatus; latencyMs?: number };

export async function pingAllEndpoints(): Promise<Record<string, PingResult>> {
  const entries = Object.entries(REPO_ENDPOINTS);
  const out: Record<string, PingResult> = {};
  await Promise.all(
    entries.map(async ([repo, url]) => {
      out[repo] = await pingOne(url);
    })
  );
  return out;
}

async function pingOne(url: string): Promise<PingResult> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
  const start = Date.now();
  try {
    // HEAD first; fall back to GET for servers that reject HEAD (some CF
    // Access walls, some Worker routes). We don't read the body either way.
    let r = await fetch(url, { method: "HEAD", redirect: "follow", signal: controller.signal });
    if (r.status === 405 || r.status === 501) {
      r = await fetch(url, { method: "GET", redirect: "follow", signal: controller.signal });
    }
    clearTimeout(t);
    const latencyMs = Date.now() - start;
    if (r.ok) return { status: "green", latencyMs };
    if (r.status >= 500) return { status: "red", latencyMs };
    return { status: "yellow", latencyMs };
  } catch {
    clearTimeout(t);
    return { status: "red" };
  }
}

export function applyPingResults(
  prev: Snapshot,
  results: Record<string, PingResult>
): Snapshot {
  const repos = { ...prev.repos };
  for (const [name, result] of Object.entries(results)) {
    if (repos[name]) {
      repos[name] = {
        ...repos[name],
        status: result.status,
        latency_ms: result.latencyMs,
      };
    }
  }
  return { ...prev, repos, updated_at: new Date().toISOString() };
}
