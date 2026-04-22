import { Hono } from "hono";
import { verifyGithubSignature } from "./hmac";
import { applyPingResults, pingAllEndpoints } from "./pings";
import { patchSnapshot } from "./snapshot";
import { DEFAULT_SNAPSHOT, Env, Snapshot } from "./types";

const STATUS_KEY = "status:current";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/status", async (c) => {
  const raw = await c.env.STATUS_KV.get(STATUS_KEY);
  const snap: Snapshot = raw ? JSON.parse(raw) : DEFAULT_SNAPSHOT;
  return new Response(JSON.stringify(snap), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
    },
  });
});

app.post("/webhooks/github", async (c) => {
  const raw = await c.req.text();
  const sig = c.req.header("x-hub-signature-256");
  const ok = await verifyGithubSignature(raw, sig ?? null, c.env.GITHUB_WEBHOOK_SECRET);
  if (!ok) return c.text("invalid signature", 401);

  const eventType = c.req.header("x-github-event") ?? "";
  const handled = new Set(["push", "release", "workflow_run", "create", "page_build"]);
  if (!handled.has(eventType)) return new Response(null, { status: 204 });

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return c.text("invalid payload", 400);
  }

  const current = await c.env.STATUS_KV.get(STATUS_KEY);
  const prev: Snapshot = current ? JSON.parse(current) : DEFAULT_SNAPSHOT;
  const next = patchSnapshot(prev, eventType, payload);
  await c.env.STATUS_KV.put(STATUS_KEY, JSON.stringify(next));

  return new Response(null, { status: 204 });
});

app.post("/api/seed", async (c) => {
  const token = c.req.header("x-seed-token");
  if (!token || token !== c.env.ADMIN_SEED_TOKEN) {
    return c.text("forbidden", 403);
  }

  let snap: Snapshot;
  try {
    snap = (await c.req.json()) as Snapshot;
  } catch {
    return c.text("invalid json", 400);
  }

  if (!snap || typeof snap !== "object" || !snap.latest_deploy || !Array.isArray(snap.events) || !snap.repos) {
    return c.text("invalid snapshot shape", 400);
  }

  snap.updated_at = new Date().toISOString();
  await c.env.STATUS_KV.put(STATUS_KEY, JSON.stringify(snap));
  return c.text("seeded", 200);
});

app.all("*", (c) => c.text("not found", 404));

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        const raw = await env.STATUS_KV.get(STATUS_KEY);
        const prev: Snapshot = raw ? JSON.parse(raw) : DEFAULT_SNAPSHOT;
        const results = await pingAllEndpoints();
        const next = applyPingResults(prev, results);
        await env.STATUS_KV.put(STATUS_KEY, JSON.stringify(next));
      })()
    );
  },
};
