export type EventVerb = "commit" | "deploy" | "release" | "post" | "eval";
export type RepoStatus = "green" | "yellow" | "red";

export type StatusEvent = {
  verb: EventVerb;
  summary: string;
  ts: string;
  repo: string;
};

export type RepoRow = {
  version: string;
  last_push: string;
  status: RepoStatus;
  commit_count?: number;
  last_push_ts: string;
};

export type LatestDeploy = {
  repo: string;
  sha: string;
  date: string;
  ts: string;
  domain?: string;
  summary?: string;
};

export type Snapshot = {
  updated_at: string;
  latest_deploy: LatestDeploy;
  events: StatusEvent[];
  repos: Record<string, RepoRow>;
};

export type Env = {
  STATUS_KV: KVNamespace;
  GITHUB_WEBHOOK_SECRET: string;
  ADMIN_SEED_TOKEN: string;
};

export const EVENTS_CAP = 4;
export const REPO_ACTIVE_WINDOW_DAYS = 90;
export const SITE_REPO = "Caseonix";
export const SITE_DOMAIN = "caseonix.ca";

export const PRIVATE_REPO_BLOCKLIST: readonly string[] = [];

export const DEFAULT_SNAPSHOT: Snapshot = {
  updated_at: new Date(0).toISOString(),
  latest_deploy: { repo: "", sha: "", date: "", ts: new Date(0).toISOString() },
  events: [],
  repos: {},
};
