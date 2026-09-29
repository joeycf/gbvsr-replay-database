/**
 * THE MAINTENANCE RITUAL, AS ONE COMMAND.
 *
 * Run: npm run data:catchup
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT A CONVENIENCE WRAPPER (checklist 9c).
 * `raw/` is gitignored, so it is local and the daily cron never writes it. That
 * means a local `raw/` is routinely OLDER than the committed `data/` the cron
 * produced in CI — and running `data:parse` on its own then silently DELETES
 * every record the local dump cannot reproduce.
 *
 * NEITHER GUARD CLOSES THAT GAP. The collapse guard needs >10% AND >20 records
 * lost from one intake — ~880 records on the dominant channel, ~94 on the
 * smallest live intake — and a stale dump arrives as a record or two missing
 * from each. The data-only stale-raw guard in parse.ts catches the clear-cut
 * case, a dump that provably predates a committed record, but a dump that is
 * merely INCOMPLETE is invisible to it. The per-intake departures line in
 * data/report.md would list the losses, but it is a report, not a refusal —
 * by the time a human reads it the smaller archive is committed. Ordering is
 * what closes the gap, and making the mistake unhittable by accident is worth
 * more than either guard.
 *
 * THE ORDER IS THE POINT: fetch → theater → parse → emit.
 *   1. data:fetch   scripts/fetch.ts — the live channels' uploads walks.
 *   2. data:theater scripts/fetch-theater.ts — the Replay Theater index. It runs
 *      BEFORE parse because parse merges its dump, and it is allowed to FAIL
 *      without stopping the run — the same rule the cron follows, for the same
 *      reason: on any failure there is simply no fresh dump, parse carries the
 *      committed index records against the pin, and the day stays green
 *      (checklist 12d).
 *   3. data:parse   scripts/parse.ts (+ parse-finish.ts) — the guards run here.
 *   4. data:emit    scripts/emit.ts — the engine-shaped JSON the site builds.
 *
 * A DEAD CHANNEL STOPS THE RITUAL AT STEP 1, ON PURPOSE. fetch.ts isolates a
 * channel whose uploads playlist is gone (checklist 7c): it writes every
 * healthy channel, prints the freeze remedy for the dead one, and exits
 * non-zero. Parsing on past that would read the dead channel's dump as stale or
 * missing and drop its records into the collapse guard — the remedy is a human
 * edit to scripts/channels.ts (freeze it IN PLACE, pin its committed count),
 * after which this command is simply run again. A quota refusal stops it here
 * too, for the plainer reason that nothing after it was fetched.
 *
 * Nothing here resolves a review item. A verdict stays a human decision.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { MatchVideo, ReviewQueueItem } from '../types/index';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');

const read = <T>(p: string, fallback: T): T =>
  existsSync(join(DATA, p)) ? (JSON.parse(readFileSync(join(DATA, p), 'utf8')) as T) : fallback;

function step(label: string, args: string[], allowFailure = false): boolean {
  console.log(`\n\x1b[1m── ${label}\x1b[0m`);
  const r = spawnSync('npm', ['run', ...args], { stdio: 'inherit', cwd: ROOT });
  if (r.status !== 0) {
    if (allowFailure) {
      console.warn(`  ⚠ ${label} failed — continuing. This step is allowed to fail by design.`);
      return false;
    }
    console.error(`\n✖ ${label} failed. Nothing after it has run.`);
    process.exit(r.status ?? 1);
  }
  return true;
}

const before = {
  records: read<MatchVideo[]>('videos.json', []).length,
  pending: read<ReviewQueueItem[]>('review-queue.json', []).length,
};

step('1/4  fetch channel uploads', ['data:fetch']);
step('2/4  pull the Replay Theater index', ['data:theater'], true);
step('3/4  parse', ['data:parse']);
step('4/4  emit', ['data:emit']);

const after = {
  records: read<MatchVideo[]>('videos.json', []).length,
  pending: read<ReviewQueueItem[]>('review-queue.json', []).length,
};
const delta = (n: number) => (n > 0 ? `+${n}` : String(n));
console.log(
  `\n\x1b[1m✓ catchup complete\x1b[0m\n` +
    `  records ${before.records} → ${after.records} (${delta(after.records - before.records)})\n` +
    `  pending review ${before.pending} → ${after.pending} (${delta(after.pending - before.pending)})\n` +
    `  Nothing was drained to the site: resolving a review item stays a human decision.`,
);
