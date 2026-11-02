// The "manager": every call to an outside system (bank API, SMS, email) is a job that goes through here.
// It caps how many run at once, runs urgent jobs first, retries temporary failures, enforces a timeout,
// and writes every job to the audit log, so the system stays predictable under load and nothing is invisible.
import crypto from 'node:crypto';
import { db, now, audit } from './db.js';

db.exec(`CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY, conversation_id TEXT, type TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 5,
  status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, error TEXT, duration_ms INTEGER,
  created_at TEXT NOT NULL, finished_at TEXT
)`);

const concurrency = () => Number(process.env.QUEUE_CONCURRENCY) || 4;
const timeoutMs = () => Number(process.env.JOB_TIMEOUT_MS) || 8000;
const MAX_ATTEMPTS = 3;
const waiting = [];
let running = 0;
let seq = 0;

export const queueStats = () => ({ running, waiting: waiting.length });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(Object.assign(new Error('Job timed out'), { transient: true })), ms))]);

/**
 * Queue a job. Lower priority number runs first (1 = urgent, 5 = normal).
 * fn must return a promise. Errors with `transient === false` (e.g. HTTP 4xx) are not retried.
 */
export function submit(type, fn, { conversationId = null, priority = 5, retry = true } = {}) {
  return new Promise((resolve, reject) => {
    const job = { id: crypto.randomUUID(), type, fn, conversationId, priority, retry, attempts: 0, resolve, reject, seq: seq++ };
    db.prepare('INSERT INTO jobs (id, conversation_id, type, priority, status, created_at) VALUES (?,?,?,?,?,?)').run(job.id, conversationId, type, priority, 'queued', now());
    waiting.push(job);
    waiting.sort((a, b) => a.priority - b.priority || a.seq - b.seq);
    pump();
  });
}

function pump() {
  while (running < concurrency() && waiting.length) run(waiting.shift());
}

function finish(job, status, error, t0) {
  const ms = Math.round(performance.now() - t0);
  db.prepare('UPDATE jobs SET status=?, attempts=?, error=?, duration_ms=?, finished_at=? WHERE id=?').run(status, job.attempts, error ? String(error).slice(0, 300) : null, ms, now(), job.id);
  audit(job.conversationId, null, 'system', `job:${job.type}`, { status, attempts: job.attempts, ms, ...(error ? { error: String(error).slice(0, 160) } : {}) });
}

async function run(job) {
  running++;
  const t0 = performance.now();
  db.prepare("UPDATE jobs SET status='running' WHERE id=?").run(job.id);
  try {
    for (;;) {
      job.attempts++;
      try {
        const out = await withTimeout(job.fn(), timeoutMs());
        finish(job, 'done', null, t0);
        return job.resolve(out);
      } catch (e) {
        if (job.retry && job.attempts < MAX_ATTEMPTS && e.transient !== false) { await sleep(200 * job.attempts); continue; }
        finish(job, 'failed', e.message, t0);
        return job.reject(e);
      }
    }
  } finally { running--; pump(); }
}
