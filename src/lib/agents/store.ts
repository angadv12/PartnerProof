/**
 * Run persistence.
 *
 * Runs live in the same JSON store as the rest of the domain. The array is
 * capped so a long-lived dev instance does not grow db.json without bound; runs
 * are an activity log, not a system of record.
 */
import { getDb, saveDb } from "../db";
import type { AgentRun } from "./types";

const MAX_STORED_RUNS = 100;

/**
 * Runs were added after the initial schema, so existing db.json files have no
 * `agentRuns` key. Materialize it on first touch instead of forcing a reseed.
 */
function runsOf(db: ReturnType<typeof getDb>): AgentRun[] {
  if (!Array.isArray(db.agentRuns)) db.agentRuns = [];
  return db.agentRuns;
}

export function saveRun(run: AgentRun): void {
  const db = getDb();
  const runs = runsOf(db);
  const index = runs.findIndex((r) => r.id === run.id);
  if (index >= 0) {
    runs[index] = run;
  } else {
    runs.unshift(run);
    if (runs.length > MAX_STORED_RUNS) runs.length = MAX_STORED_RUNS;
  }
  saveDb(db);
}

export function getRun(id: string): AgentRun | null {
  return runsOf(getDb()).find((r) => r.id === id) ?? null;
}

/** Newest first. Events are stripped — the list view does not render them. */
export function listRuns(limit = 25): Omit<AgentRun, "events">[] {
  return runsOf(getDb())
    .slice(0, limit)
    .map(({ events: _events, ...rest }) => rest);
}
