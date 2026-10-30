/**
 * Self-expiring gates: things the DATA can say are due, so nobody has to
 * remember them. `--check` runs in the "Pending work" workflow after every
 * completed data run and is DESIGNED to go red; the data run is never held by it.
 *
 * FIVE ARMS, EACH CLOCK- OR CORPUS-DRIVEN — nothing upstream can blind them:
 *
 *  1. unreleased-character — EMPTY on day one, measured, not assumed. The
 *     vendor roster (rising.granbluefantasy.jp/en/characters/) lists 40 and
 *     the DLC page lists Character Passes 1 and 2 complete through Id (Ver 2.60,
 *     2026-09-15). No announced-but-unshipped fighter exists to gate. When one
 *     is announced, its row carries the vendor's own WINDOW words and a
 *     backstop computed from them (checklist 11d) — never a fan wiki's date.
 *  2. stale-patch-table — STALE_PATCH_DAYS, imported from seasons.ts where it
 *     sits beside the cadence it was measured from (190: the widest real gap
 *     is 183 d, 2.51 → 2.60).
 *  3. silent-channel — any channel with `silenceAlarmDays`: red when its newest
 *     COMMITTED upload is older than that. Only the dominant channel sets it
 *     (7 days, from its own measured 4.42-day longest silence — see
 *     types/index.ts). This is the Invincible VS alarm: a one-channel-heavy
 *     corpus whose main source stops is the failure that has killed an archive.
 *  4. frozen-watch — every frozen channel is re-looked-at on a cadence: has it
 *     resumed (unfreeze), or have its videos gone (checklist 7c — mark
 *     `unplayable` with a measured check, never inferred)?
 *  5. art-licence — the Fan Kit terms are revocable (Article 3); re-read them
 *     on a cadence and record the date in data/art-provenance.json.
 *
 * AND ONE UNDATED TASK (checklist 5n, since 2026-10-30): every
 * 'fighter-named-handle' item in data/review-queue.json. parse holds a NEW
 * record whose handle resolves to a fighter with no CONFIRMED row and ships the
 * rest of the day; `--check` goes red naming each handle and its record count.
 * Until then the registry invariant refused the whole day instead.
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Expiry, MatchVideo, ReviewQueueItem } from '../types/index';
import { CHANNELS } from './channels';
import { PATCHES, SEASONS, STALE_PATCH_DAYS } from './seasons';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Announced fighters not yet playable. EMPTY — see arm 1 above. The shape is
 *  Avatar's: vendor window words verbatim, a backstop from arithmetic on them,
 *  and a review date that is never presented as a release date. */
export const UNRELEASED: {
  id: string;
  name: string;
  aliases: string[];
  window: string;
  source: string;
  backstop: string | null;
  reviewAfter: string;
  accent?: string;
}[] = [];

/** Days between frozen-channel reviews. Quarterly: long enough that a review
 *  is not noise, short enough that a deleted channel (SF6 lost 8.2% of its
 *  archive to one) is noticed within a season. */
export const FROZEN_REVIEW_DAYS = 90;
/** Days between Fan Kit licence re-reads. Same quarter, same reasoning. */
export const LICENCE_REVIEW_DAYS = 90;

const today = (): string => new Date().toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) =>
  Math.floor((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 86_400_000);
const addDays = (iso: string, n: number) =>
  new Date(Date.parse(iso.slice(0, 10)) + n * 86_400_000).toISOString().slice(0, 10);

function readCommitted(): MatchVideo[] {
  const p = join(ROOT, 'data', 'videos.json');
  if (!existsSync(p)) return [];
  return JSON.parse(readFileSync(p, 'utf8')) as MatchVideo[];
}

function readLicenceVerified(): string | null {
  const p = join(ROOT, 'data', 'art-provenance.json');
  if (!existsSync(p)) return null;
  const prov = JSON.parse(readFileSync(p, 'utf8')) as { licenceVerified?: string };
  return prov.licenceVerified ?? null;
}

/** Everything whose date has now passed. Empty is the happy path. `videos` and
 *  `licenceVerified` are injectable so a control can pin them. */
export function dueExpiries(
  asOf: string = today(),
  videos: MatchVideo[] = readCommitted(),
  licenceVerified: string | null = readLicenceVerified(),
): Expiry[] {
  const due: Expiry[] = [];

  for (const u of UNRELEASED) {
    const trigger =
      u.backstop && asOf >= u.backstop ? u.backstop : asOf >= u.reviewAfter ? u.reviewAfter : null;
    if (!trigger) continue;
    due.push({
      kind: 'unreleased-character',
      id: u.id,
      date: trigger,
      action:
        `${u.name} (${u.id}) was announced "${u.window}" (${u.source}). If playable now: add ` +
        `the row to ROSTER in scripts/characters.ts with the vendor's EN and JP names and the ` +
        `aliases its uploaders use, get --char-${u.id} into design/handoff/tokens.css from a ` +
        `design session, add the patch that shipped them to scripts/seasons.ts, drop this row, ` +
        `and run \`npm run data:characters\`, \`npm run data:art\`, \`npm run data:og\`. If not, ` +
        `move reviewAfter — never delete the row.`,
    });
  }

  for (const s of SEASONS) {
    if (!s.confirmed && asOf >= s.start) {
      due.push({
        kind: 'unconfirmed-season',
        id: `S${s.season}`,
        date: s.start,
        action:
          `Season ${s.season} was scheduled for ${s.start} and is still unconfirmed. Confirm it ` +
          `from the vendor's own news post naming the season, set confirmed: true in ` +
          `scripts/seasons.ts, and re-run \`npm run data:seasons\`.`,
      });
    }
  }

  const newest = [...PATCHES].sort((a, b) => a.start.localeCompare(b.start)).at(-1);
  if (newest && daysBetween(newest.start, asOf) > STALE_PATCH_DAYS) {
    due.push({
      kind: 'stale-patch-table',
      id: 'patch-table',
      date: addDays(newest.start, STALE_PATCH_DAYS),
      action:
        `The newest patch in scripts/seasons.ts is ${newest.version}, ` +
        `${daysBetween(newest.start, asOf)} days old (threshold ${STALE_PATCH_DAYS}). Run ` +
        `\`npm run data:patch-check\` against Cygames' own news feed. If a patch shipped and is ` +
        `not in the table, every replay since is filed under the previous token.`,
    });
  }

  const newestBy = new Map<string, string>();
  for (const v of videos) {
    const prev = newestBy.get(v.intake);
    if (!prev || v.publishedAt > prev) newestBy.set(v.intake, v.publishedAt);
  }
  for (const c of CHANNELS) {
    if (!c.silenceAlarmDays || c.frozen) continue;
    const last = newestBy.get(c.id);
    if (!last) continue; // empty corpus: nothing to be silent against yet
    if (daysBetween(last, asOf) > c.silenceAlarmDays) {
      due.push({
        kind: 'silent-channel',
        id: c.id,
        date: addDays(last, c.silenceAlarmDays),
        action:
          `${c.name} (${c.id}) has published nothing committed since ${last.slice(0, 10)} — ` +
          `${daysBetween(last, asOf)} days, past its ${c.silenceAlarmDays}-day alarm (its longest ` +
          `silence in the year before launch was 4.42 days). It is ~68% of this archive's live ` +
          `flow. Check the channel: a quiet week is a note in the README; a deleted channel is ` +
          `checklist 7c — freeze it IN PLACE with a measured \`unplayable\` block, never prune.`,
      });
    }
  }

  for (const c of CHANNELS) {
    if (!c.frozen) continue;
    const reviewed = c.frozen.reviewedAt ?? c.frozen.since;
    // `>=`: a review is DUE on the day it names. (The silence alarm is the
    // other convention on purpose — "more than 7 silent days" fires on day 8.)
    if (daysBetween(reviewed, asOf) >= FROZEN_REVIEW_DAYS) {
      due.push({
        kind: 'frozen-watch',
        id: c.id,
        date: addDays(reviewed, FROZEN_REVIEW_DAYS),
        action:
          `${c.name} (${c.id}) has been frozen since ${c.frozen.since}, last looked at ` +
          `${reviewed}. Quarterly look: has it resumed Rising uploads (unfreeze and refetch), or ` +
          `are its videos gone (run a videos.list over its carried ids and record an ` +
          `\`unplayable\` block — checklist 7c)? Then set frozen.reviewedAt to today in ` +
          `scripts/channels.ts.`,
      });
    }
  }

  if (licenceVerified && daysBetween(licenceVerified, asOf) >= LICENCE_REVIEW_DAYS) {
    due.push({
      kind: 'art-licence',
      id: 'fan-kit',
      date: addDays(licenceVerified, LICENCE_REVIEW_DAYS),
      action:
        `The Fan Kit terms were last verified ${licenceVerified}. Re-run \`npm run data:art\`, ` +
        `which re-reads Articles 1–3 before any fetch. If Cygames has revoked the licence ` +
        `(Article 3), run \`npm run data:art:revoked\` — ONE command replaces every Fan Kit ` +
        `derivative with generated tiles and deletes the rest.`,
    });
  }

  return due;
}

// ── held fighter-named handles (checklist 5n) ────────────────────────────────
// Not dated, so not an Expiry — a TASK the review queue already holds. Until
// 2026-10-30 the registry invariant refused the WHOLE DAY for one unconfirmed
// handle (never in this repo's cron; on Strive, "Plugging on ram" held 25,485
// records for four days from 10-25). parse-finish.ts now routes a NEW record
// whose handle resolves to a fighter with no CONFIRMED row into
// data/review-queue.json as kind 'fighter-named-handle', ships the rest of the
// day, and this is the red that makes the held record impossible to miss.
// Refuse the record, not the day.

export interface HeldHandle {
  player: string;
  /** The handle as the first held record spells it. */
  handle: string;
  resolvesTo: string[];
  /** Held record ids, queue order. */
  ids: string[];
}

/** The queue's 'fighter-named-handle' items, one row per player id. */
export function heldHandles(queue: ReviewQueueItem[]): HeldHandle[] {
  const by = new Map<string, HeldHandle>();
  for (const q of queue) {
    if (q.kind !== 'fighter-named-handle') continue;
    for (const h of q.held ?? []) {
      const row = by.get(h.player) ?? {
        player: h.player,
        handle: h.handle,
        resolvesTo: [],
        ids: [],
      };
      for (const id of h.resolvesTo) if (!row.resolvesTo.includes(id)) row.resolvesTo.push(id);
      if (!row.ids.includes(q.id)) row.ids.push(q.id);
      by.set(h.player, row);
    }
  }
  return [...by.values()].sort(
    (a, b) => b.ids.length - a.ids.length || a.player.localeCompare(b.player),
  );
}

/** One line per handle — report.md, the parse console and `--check` all print it. */
export const heldLine = (h: HeldHandle): string =>
  `${h.ids.length} record(s) held on unconfirmed fighter-named handle "${h.handle}" — confirm ` +
  `with a video id (scripts/roster.ts) or reject  [${h.player} → ${h.resolvesTo.join(', ')}; ` +
  `e.g. ${h.ids[0]}]`;

/** How a held handle is cleared, for the two places that tell a person. */
export const HELD_HOW = [
  'A person named after a fighter: add the CONFIRMED_FIGHTER_NAMED_PLAYERS row WITH its video',
  'id, push, then dispatch "Daily data refresh" — the record publishes and the item clears. A',
  "fighter filed as a person: a `sides` override in data/overrides.json (resolvedBy: 'human').",
];

/** Rendered into data/report.md by parse when anything is due. */
export function expiryBlock(due: Expiry[]): string[] {
  if (!due.length) return [];
  return [
    '## ⚠ ACTION REQUIRED',
    '',
    `${due.length} self-expiring gate(s) are due:`,
    '',
    ...due.flatMap((d) => [`- **${d.id}** (${d.kind}, due ${d.date})`, `  ${d.action}`, '']),
  ];
}

const isMain = !!process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!);
if (isMain && process.argv.includes('--check')) {
  const due = dueExpiries();
  // The committed queue: Pending work checks out main after the data run, so
  // this is exactly what that run published. An unreadable queue is a red, not
  // a clean bill — "could not look" must never read as "nothing held".
  const queuePath = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'data',
    'review-queue.json',
  );
  let held: HeldHandle[] = [];
  let unreadable: string | null = null;
  try {
    const q: unknown = JSON.parse(readFileSync(queuePath, 'utf8'));
    if (Array.isArray(q)) held = heldHandles(q as ReviewQueueItem[]);
    else unreadable = 'not a JSON array';
  } catch (err) {
    unreadable = (err as Error).message;
  }
  if (!due.length && !held.length && unreadable === null) {
    console.log(
      `✓ no expiries due — ${UNRELEASED.length} unreleased row(s), newest patch ` +
        `${[...PATCHES].sort((a, b) => a.start.localeCompare(b.start)).at(-1)?.version}; ` +
        'no record held on a fighter-named handle',
    );
    process.exit(0);
  }
  if (due.length) {
    console.error(`\n✖ ${due.length} EXPIRY(S) DUE — this step is designed to go red.\n`);
    for (const d of due) {
      console.error(`  ${d.id}  (${d.kind}, due ${d.date})`);
      console.error(`    ${d.action}\n`);
    }
  }
  if (held.length) {
    const n = new Set(held.flatMap((h) => h.ids)).size;
    console.error(
      `\n✖ ${n} RECORD(S) HELD ON ${held.length} UNCONFIRMED FIGHTER-NAMED HANDLE(S) — this step ` +
        `is designed to go red.\n`,
    );
    for (const h of held) console.error(`  ${heldLine(h)}`);
    console.error('');
    for (const l of HELD_HOW) console.error(`  ${l}`);
    console.error('');
  }
  if (unreadable !== null) {
    console.error(
      `\n✖ data/review-queue.json is unreadable (${unreadable}) — held handles unknown.\n`,
    );
  }
  console.error('  Clear these by doing the work above. Never by deleting the check.');
  process.exit(1);
}
