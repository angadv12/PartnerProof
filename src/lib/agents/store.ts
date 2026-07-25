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
 * Events kept per persisted run.
 *
 * A run can emit a tool result per call across a dozen-plus steps, each up to
 * 24k characters. Persisting all of them for 100 runs would grow db.json into
 * the tens of megabytes — and the whole file is re-read and re-written on every
 * mutation. The live SSE stream still delivers every event; this only bounds
 * what is kept afterward.
 */
const MAX_STORED_EVENTS = 200;

/** Keep the head (what the run set out to do) and the tail (how it ended). */
function trimEvents(run: AgentRun): AgentRun {
  if (run.events.length <= MAX_STORED_EVENTS) return run;
  const head = Math.floor(MAX_STORED_EVENTS / 4);
  const tail = MAX_STORED_EVENTS - head;
  return {
    ...run,
    events: [...run.events.slice(0, head), ...run.events.slice(-tail)],
  };
}

/**
 * Runs were added after the initial schema, so existing db.json files have no
 * `agentRuns` key. Materialize it on first touch instead of forcing a reseed.
 */
function runsOf(db: ReturnType<typeof getDb>): AgentRun[] {
  if (!Array.isArray(db.agentRuns)) db.agentRuns = [];
  return db.agentRuns;
}

export function saveRun(run: AgentRun): void {
  const stored = trimEvents(run);
  const db = getDb();
  const runs = runsOf(db);
  const index = runs.findIndex((r) => r.id === stored.id);
  if (index >= 0) {
    runs[index] = stored;
  } else {
    runs.unshift(stored);
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
