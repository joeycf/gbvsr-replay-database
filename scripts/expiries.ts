/**
 * Self-expiring gates: things the DATA can say are due, so nobody has to
 * remember them. `--check` is the cron's last-but-one step and is DESIGNED to go
 * red; it runs after the commit, so a red run never costs a refresh.
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
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Expiry, MatchVideo } from '../types/index';
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
  if (!due.length) {
    console.log(
      `✓ no expiries due — ${UNRELEASED.length} unreleased row(s), newest patch ` +
        `${[...PATCHES].sort((a, b) => a.start.localeCompare(b.start)).at(-1)?.version}`,
    );
    process.exit(0);
  }
  console.error(`\n✖ ${due.length} EXPIRY(S) DUE — this step is designed to go red.\n`);
  for (const d of due) {
    console.error(`  ${d.id}  (${d.kind}, due ${d.date})`);
    console.error(`    ${d.action}\n`);
  }
  console.error('  Clear these by doing the work above. Never by deleting the check.');
  process.exit(1);
}
