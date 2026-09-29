/**
 * The MATCH IDENTITY report — checklist 2b (Avatar's report, ported).
 *
 * ── REPORT ONLY. THIS SCRIPT NEVER DROPS, MERGES OR REWRITES A RECORD ─────
 * It opens data/ read-only and proves it: every file it touches is hashed
 * before the analysis and re-hashed after, and a byte that moved is a throw.
 * That is not ceremony. A signature is a HYPOTHESIS about footage identity, not
 * a verdict, and the thing it is most likely to be wrong about is the case that
 * matters most:
 *
 *   THE RUNBACK IS A LEGITIMATE COLLISION. The same two players, on the same
 *   two fighters, on the same day, is exactly what a winners final followed by
 *   a grand final looks like. Dropping on this key deletes the grand final of
 *   the corpus's biggest event, and every count stays green while it happens.
 *
 * Not computing it is the other half of the same mistake. The intake key
 * (checklist step 2) cannot see the same footage uploaded by two channels: the
 * GBVSR recon (2026-09-29) found ~34 highLevelReplays ↔ gbFightingReplays
 * pairings within ±3 days, and the dominant channel's own rematches (the same
 * two players and fighters, the same day, several uploads) are the legitimate
 * collision this tier must never drop.
 *
 * ── THE VIDEO-ID RATE IS NOT THE ANSWER, AND IT IS PRINTED ANYWAY ─────────
 * The duplicate rate on video ids is zero, and zero is what it will always be:
 * composite `${videoId}@${startSeconds}` ids (checklist 12b) are what keep
 * index-within-VOD records distinct in the first place, so the id key is
 * measuring its own success. It is printed beside the signature rate precisely
 * so the two numbers are read together — a green id rate next to a non-zero
 * signature rate is the shape of this problem.
 *
 * ── WHAT THIS ADDS OVER data/report.md ───────────────────────────────────
 * scripts/parse-finish.ts (step 5c) computes the same signature on every run,
 * queues every group as `duplicate-candidate`, and prints the headline numbers
 * plus the first ten cross-intake groups into data/report.md. This script is the
 * deep-dive: EVERY group, with a field-by-field diff of the colliding records,
 * so a reviewer can answer "one match or two?" without opening five videos. It
 * also READS data/review-queue.json back and checks that the queue and this
 * recomputation agree — a witness with a reader (checklist 12i), pointed at
 * this repo's own output.
 *
 * IT DOES NOT ADD ROWS TO THE QUEUE. data/review-queue.json is DERIVED STATE,
 * regenerated in full by every parse (parse-finish.ts step 7), so anything written
 * here would survive exactly until the next run. `duplicate-candidate` is also
 * the one queue kind whose subject IS published — both records stay in the
 * archive while a human decides — which is what makes a standalone reader
 * useful and a standalone writer meaningless.
 *
 * Run: npm run data:dupes
 */

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { MatchSignature, MatchVideo, ReviewQueueItem } from '../types/index';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DATA = join(ROOT, 'data');

/** Files this script opens. Hashed before and after, so "report only" is a
 *  measurement rather than a promise in a comment. */
const READ_ONLY = ['videos.json', 'review-queue.json'];

const ARG_ALL = process.argv.includes('--all');
const DEFAULT_GROUPS_SHOWN = 40;

const sha = (b: Buffer): string => createHash('sha256').update(b).digest('hex');

async function fingerprint(): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const name of READ_ONLY) {
    const p = join(DATA, name);
    out.set(name, existsSync(p) ? sha(await readFile(p)) : 'absent');
  }
  return out;
}

/**
 * THE SIGNATURE, computed EXACTLY as scripts/parse-finish.ts step 5c computes
 * it. Two implementations of one key would be two answers, and the whole point
 * of this script is to check the queue against a recomputation — which is worth
 * nothing if it recomputes something else.
 *
 *   players    both PLAYER IDS, sorted. The id is the slug of the normalized
 *              handle (scripts/roster.ts playerId), so keying on it IS keying on
 *              the normalized handle pair, and two spellings of one player
 *              cannot split a pair.
 *   characters both sides' FIRST fighter, sorted. `characters[0]` rather than
 *              the whole list because a counter-pick makes the list longer on
 *              one record and not on its duplicate — five such titles are
 *              measured here — and a signature that changes when a set adds a
 *              counter-pick is a signature that never collides.
 *   playedOn   the upload DAY (publishedAt). No GBVSR intake titles a played-
 *              on date (Avatar's STiLL did), so the upload day is the only
 *              date there is; parse-finish.ts uses the same key.
 *
 * Returns null for a side with no fighter, which cannot reach a published
 * record (scripts/emit.ts throws on a zero-character side) but can reach a
 * hand-edited substrate.
 */
function signatureOf(r: MatchVideo): MatchSignature | null {
  const a = r.sides[0].characters[0];
  const b = r.sides[1].characters[0];
  if (!a || !b) return null;
  return {
    players: [r.sides[0].player, r.sides[1].player].sort() as [string, string],
    characters: [a, b].sort() as [string, string],
    playedOn: r.publishedAt.slice(0, 10),
  };
}

const keyOf = (s: MatchSignature): string =>
  `${s.players.join('|')}~${s.characters.join('|')}~${s.playedOn}`;

/** The fields a reviewer actually compares. Stringified so "what differs" is a
 *  set difference rather than a hand-written branch per field. */
function facets(r: MatchVideo): Record<string, string> {
  return {
    intake: r.intake,
    source: r.channel,
    video: r.videoId ?? r.id,
    start: r.startSeconds === undefined ? '—' : `${r.startSeconds}s`,
    duration: `${r.durationSec}s`,
    published: r.publishedAt.slice(0, 10),
    event: r.event ?? r.channelName ?? '—',
    ex: `${(r.sides[0].ex ?? []).join('+') || '—'} / ${(r.sides[1].ex ?? []).join('+') || '—'}`,
    handles: `${r.sides[0].handle} vs ${r.sides[1].handle}`,
    fighters: `${r.sides[0].characters.join('+')} vs ${r.sides[1].characters.join('+')}`,
  };
}

async function main(): Promise<void> {
  const videosPath = join(DATA, 'videos.json');
  if (!existsSync(videosPath)) {
    throw new Error(
      'data/videos.json does not exist — there is no corpus to report a rate over.\n' +
        '  Build one first: `npm run data:catchup` (fetch → index pull → parse), then re-run.\n' +
        '  This exits non-zero on purpose: a duplicate report that prints 0 because it read\n' +
        '  nothing is indistinguishable from one that prints 0 because nothing collided.',
    );
  }

  const before = await fingerprint();

  const records = JSON.parse(await readFile(videosPath, 'utf8')) as MatchVideo[];
  const queue: ReviewQueueItem[] = existsSync(join(DATA, 'review-queue.json'))
    ? (JSON.parse(await readFile(join(DATA, 'review-queue.json'), 'utf8')) as ReviewQueueItem[])
    : [];

  // ── the two rates ─────────────────────────────────────────────────────────
  const byVideo = new Map<string, MatchVideo[]>();
  for (const r of records) {
    const v = r.videoId ?? r.id;
    byVideo.set(v, [...(byVideo.get(v) ?? []), r]);
  }
  // Records sharing a VIDEO id are the ordinary segment case, not a duplicate:
  // a VOD holding fourteen matches publishes fourteen records with fourteen
  // composite ids. The duplicate the id key would report is a repeated RECORD
  // id, and parse refuses to build one (parse-finish.ts buildTheaterRecords).
  const repeatedRecordIds = records.length - new Set(records.map((r) => r.id)).size;
  const multiRowVideos = [...byVideo.values()].filter((g) => g.length > 1).length;

  const groups = new Map<string, { sig: MatchSignature; rs: MatchVideo[] }>();
  let noFighter = 0;
  for (const r of records) {
    const sig = signatureOf(r);
    if (!sig) {
      noFighter += 1;
      continue;
    }
    const k = keyOf(sig);
    const g = groups.get(k) ?? { sig, rs: [] };
    g.rs.push(r);
    groups.set(k, g);
  }

  const dupes = [...groups.values()]
    .filter((g) => g.rs.length > 1)
    .sort(
      (a, b) =>
        b.rs.length - a.rs.length ||
        a.sig.playedOn.localeCompare(b.sig.playedOn) ||
        keyOf(a.sig).localeCompare(keyOf(b.sig)),
    );
  const inGroups = dupes.reduce((n, g) => n + g.rs.length, 0);
  const crossIntake = dupes.filter((g) => new Set(g.rs.map((r) => r.intake)).size > 1);
  const crossVideo = dupes.filter((g) => new Set(g.rs.map((r) => r.videoId ?? r.id)).size > 1);
  const widest = dupes[0]?.rs.length ?? 0;
  const pct = (n: number, d: number) => (d === 0 ? '—' : `${((n / d) * 100).toFixed(2)}%`);

  console.log(
    `\n▶ match identity over ${records.length} committed record(s) — REPORT ONLY (checklist 2b)\n`,
  );
  console.log(
    `  signature (handle pair × fighter pair × played-on day)\n` +
      `    ${dupes.length} signature(s) cover more than one record\n` +
      `    ${inGroups} record(s) in all — ${pct(inGroups, records.length)} of the archive\n` +
      `    ${crossIntake.length} group(s) span more than one INTAKE — the case the intake key\n` +
      `      cannot see, and the only one that needs this tier\n` +
      `    ${crossVideo.length} group(s) span more than one VIDEO id\n` +
      `    widest group: ${widest} record(s)` +
      (noFighter ? `\n    ${noFighter} record(s) skipped: a side names no fighter` : ''),
  );
  console.log(
    `\n  video id (the number that means nothing)\n` +
      `    ${repeatedRecordIds} repeated record id(s) — parse refuses to build one, so this is\n` +
      `      structurally 0 and says nothing about whether two records are one match\n` +
      `    ${multiRowVideos} video(s) carry more than one record, which is the SEGMENT design\n` +
      `      working (composite ids, checklist 12b), not duplication`,
  );

  // ── the groups ────────────────────────────────────────────────────────────
  if (dupes.length === 0) {
    console.log('\n  no signature covers more than one record.\n');
  } else {
    const shown = ARG_ALL ? dupes : dupes.slice(0, DEFAULT_GROUPS_SHOWN);
    console.log(`\n  ── candidates ─────────────────────────────────────────────────────\n`);
    for (const [i, g] of shown.entries()) {
      const label = `${g.sig.players.join(' vs ')} · ${g.sig.characters.join(' / ')} · ${g.sig.playedOn}`;
      console.log(`  ${String(i + 1).padStart(3)}. ${label}   (${g.rs.length} records)`);
      // WHAT DIFFERS, field by field. A group whose records differ ONLY by
      // intake and video id is the VOD-versus-cut case and is probably one
      // match; a group that also differs by duration, offset or event is
      // probably a runback and is probably two. Neither is decided here.
      const all = g.rs.map(facets);
      const keys = Object.keys(all[0]!);
      const differing = keys.filter((k) => new Set(all.map((f) => f[k])).size > 1);
      const same = keys.filter((k) => !differing.includes(k));
      for (const [j, r] of g.rs.entries()) {
        console.log(
          `        ${r.id.padEnd(26)} ${differing.map((k) => `${k}=${all[j]![k]}`).join('  ')}`,
        );
      }
      console.log(`        identical: ${same.join(', ') || 'nothing'}`);
      console.log('');
    }
    if (!ARG_ALL && dupes.length > shown.length) {
      console.log(`  … ${dupes.length - shown.length} more group(s). Re-run with --all.\n`);
    }
  }

  // ── the queue, READ (checklist 12i: a witness must have a reader) ─────────
  // The queue is parse's output, not this script's input contract, so a
  // disagreement is reported and never repaired. Two directions and they mean
  // different things: a group with no queue row means the queue is stale
  // (videos.json changed without a parse), and a queue row with no group means
  // the corpus moved under it.
  const queuedDupes = queue.filter((q) => q.kind === 'duplicate-candidate');
  if (!existsSync(join(DATA, 'review-queue.json'))) {
    console.log('  ⓘ data/review-queue.json is absent — nothing to cross-check against.\n');
  } else {
    const queuedKeys = new Set(
      queuedDupes.filter((q) => q.duplicates).map((q) => keyOf(q.duplicates!.signature)),
    );
    const computedKeys = new Set(dupes.map((g) => keyOf(g.sig)));
    const missing = [...computedKeys].filter((k) => !queuedKeys.has(k));
    const stale = [...queuedKeys].filter((k) => !computedKeys.has(k));
    if (missing.length === 0 && stale.length === 0) {
      console.log(
        `  ✓ data/review-queue.json holds ${queuedDupes.length} 'duplicate-candidate' row(s) and ` +
          `agrees with this recomputation.\n`,
      );
    } else {
      console.log(
        `  ⚠ the queue and this recomputation disagree: ${missing.length} group(s) are not ` +
          `queued,\n    ${stale.length} queued row(s) no longer collide. Re-run ` +
          `\`npm run data:parse\` — the queue is regenerated, never patched.\n`,
      );
      for (const k of missing.slice(0, 10)) console.log(`      not queued: ${k}`);
      for (const k of stale.slice(0, 10)) console.log(`      stale row:  ${k}`);
      if (missing.length || stale.length) console.log('');
    }
  }

  // ── the proof that nothing was written ────────────────────────────────────
  const after = await fingerprint();
  const moved = READ_ONLY.filter((n) => before.get(n) !== after.get(n));
  if (moved.length) {
    throw new Error(
      `match-dupes wrote to ${moved.join(', ')}. This script is REPORT ONLY (checklist 2b) — ` +
        `it must never drop, merge or rewrite a record, and the runback is why. Nothing here ` +
        `is allowed to open data/ for writing.`,
    );
  }
  console.log(
    `  nothing written — ${READ_ONLY.join(', ')} are byte-identical to before this run.\n` +
      `  Every candidate above is still PUBLISHED. A signature is a hypothesis; the runback\n` +
      `  (winners final then grand final) is a legitimate collision and dropping on it would\n` +
      `  delete the grand final of the corpus's biggest event.\n`,
  );
}

main().catch((e: unknown) => {
  console.error(`\n✖ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
