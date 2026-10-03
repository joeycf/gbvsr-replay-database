/**
 * Stage 1: walk every live GBVSR channel's uploads playlist through the YouTube
 * Data API v3, hydrate the uploads whose title carries the Rising marker, dump
 * them to raw/<intake>.json, and print a per-channel reconnaissance report. The
 * key is LOCAL/CI-ONLY — the site builds from committed JSON and never sees it.
 *
 * Run: npm run data:fetch   (tsx --env-file-if-exists=.env scripts/fetch.ts)
 *
 * Flags:
 *   --only=<ChannelKey>   fetch one channel.
 *   --include-frozen      ALSO fetch frozen channels. The one legitimate use is
 *                         seeding a freeze pin — see FROZEN in main(). Never on
 *                         the cron.
 * Anything else is refused before a single unit is spent (see main()).
 *
 * Avatar's fetcher — the per-channel fetch floor, the quota accounting, the
 * refusal abort, the unhydrated count — with the client imported from
 * scripts/youtube.ts rather than defined in-file (this repo's second consumer,
 * scripts/fetch-theater.ts, imports it from there too); SF6's dead-channel
 * handling (checklist 7c); Strive's reject printer; and one thing no sibling
 * does: the marker gate runs HERE, before hydration.
 *
 * ── QUOTA (measured 2026-09-29) ─────────────────────────────────────────────
 * The key is shared with seven other games' daily crons, and the platform total
 * on it is ≈5,000 units/day. Both endpoints used here cost 1 unit per call —
 * one per 50 playlist items walked, one per 50 ids hydrated. search.list costs
 * 100 and is never called from anywhere in this repo.
 *
 *   backfill       ≈ 874 units, once.
 *   steady state   ≈ 550 units/day — NOT the "page or two" of Avatar's cron.
 *
 * THE STEADY STATE IS LARGE ON PURPOSE. Every live playlist is walked IN FULL
 * every morning, down to its fetchFrom floor, and every marked upload on it is
 * re-hydrated. parse's per-intake departures line ("records that left the
 * corpus", scripts/parse-finish.ts step 5b) diffs each intake's committed ids
 * against what THIS RUN publishes, so it needs today's whole playlist: a walk
 * that stopped at the newest committed id would report every older record as
 * departed, or the line would have to go — and it is the one signal that sees
 * the dominant channel deleting its own back catalogue at 2–3 videos a day for
 * nine months (Nov 2024–Jul 2025), a loss too slow for the collapse guard and
 * too steady for the silence alarm (scripts/channels.ts). Most of the 550 is
 * that channel: ~9,000 Rising uploads since the floor is ~180 pages to walk and
 * ~180 calls to hydrate.
 *
 * AND IT IS NOT STEADY. Arithmetic, not a measurement: every new marked upload
 * adds 1/50 of a page and 1/50 of a hydration call to EVERY later morning, so at
 * today's 14.4 uploads/day (channels.ts) the daily cost grows by roughly 200
 * units per year. That is the number to hold against the platform budget, and
 * the per-run total printed at the bottom is how to watch it happen.
 *
 * Two rules keep the rest of the budget honest:
 *   · the per-channel `fetchFrom` date floor is applied DURING THE WALK
 *     (checklist 1b). The uploads playlist is newest-first and
 *     `contentDetails.videoPublishedAt` is on the page already, so the floor is
 *     a stop condition that costs no extra call. Every channel with pre-Rising
 *     history carries it — highLevelReplays posted 1,068 `GBVS:` uploads of the
 *     PREVIOUS game, kakuken 1,961 — and without it their old-game back
 *     catalogues would be walked every morning for nothing.
 *   · a refusal (quotaExceeded, rateLimitExceeded, HTTP 429, the bot-check
 *     page) ABORTS the run (checklist 10j). Backing off and retrying into a
 *     shared key turns one exhausted cron into eight. A transient 5xx and a
 *     network error are still retried; a refusal is not (scripts/youtube.ts).
 *
 * Every run prints the units it spent, per channel and in total, counted at the
 * call site (QUOTA in youtube.ts) rather than estimated from a formula in a
 * comment — including this one.
 *
 * ── THE MARKER GATE RUNS HERE, BEFORE HYDRATION ─────────────────────────────
 * Strive and Avatar hydrate everything a channel publishes and let parse
 * filter. Here the walk asks for `part=snippet,contentDetails` — still 1 unit a
 * page: the snippet carries the title, contentDetails the videoPublishedAt the
 * floor reads — and ONLY ids whose playlist title passes hasGbvsrMarker are sent
 * to videos.list and written to raw/. Two intakes are why:
 *   · yumegiwa is multi-game (GGST, GBVSR, Xrd Rev2): 2,676 uploads since the
 *     floor, ~1,000 of them Rising. Hydrating the rest is ~34 units every day
 *     spent on other games' footage, from a budget other games' crons share.
 *   · gbvsrReplay (frozen; walked only to seed its pin) switched to Tekken 8:
 *     126 Rising uploads out of 1,043. The gate is what keeps its Tekken half
 *     out of raw/.
 * An unmarked upload still costs its 1/50 of a playlist page, and nothing else.
 *
 * PARSE KEEPS ITS OWN MARKER GATE AS A SECOND LINE, on the HYDRATED title: the
 * two calls are seconds-to-minutes apart and a retitle can land between them
 * (the recon below counts those), and a stage that trusted its input to be
 * pre-filtered would admit whatever a future fetch forgot to filter.
 *
 * THE TWO GATES MUST STAY ONE FUNCTION. This file calls hasGbvsrMarker from
 * scripts/channels.ts — the same function parse calls, hashtag-run strip
 * included. If parse ever WIDENS its gate (a description read, a per-channel
 * marker, a structural rule), the widening has to land HERE FIRST or it is
 * dead code: parse cannot admit an upload this file never hydrated, and nothing
 * anywhere would say so.
 *
 * And the CotW rule still holds, for a new reason: raw/ is now ≈ the marked set,
 * which makes raw-vs-committed LOOK like a usable collapse measure. It is not —
 * it measures this gate plus the date floor — so the collapse guard compares
 * PARSED-vs-committed.
 *
 * ── A DEAD CHANNEL FAILS ALONE (checklist 7c) ───────────────────────────────
 * SF6, 2026-09-18: a channel's account was deleted, its uploads playlist
 * answered 404, nothing between the client and the top-level await caught it,
 * and the daily cron stayed red for SIX DAYS with the seven healthy channels
 * unrefreshed. The concentration on this archive makes that worse, not better
 * (channels.ts: the dominant channel is ~68% of live volume), so each channel
 * here is fetched inside its own catch:
 *   · PlaylistNotFound / HTTP 404, or a playlist that answers and lists
 *     nothing — named, with the remedy (printDeadChannel); its raw file NOT
 *     written; the other channels continue; the run exits non-zero AFTER they
 *     are written. Not writing is the point: parse then sees the previous dump
 *     or none — a stale-raw or missing-dump line it already knows how to say,
 *     and on a fresh checkout a collapse the guard refuses — never an empty or
 *     partial dump presented as today's.
 *   · any other per-channel failure (the empty results thrown in fetchChannel,
 *     a playlist gone private, retries exhausted) — the same isolation,
 *     without the dead-channel remedy. A failure that is ours rather
 *     than the channel's then repeats on every channel and costs at most what a
 *     normal run costs, and the run still ends red.
 *   · QuotaRefusal — NOT isolated. It is a fact about the KEY, not the channel:
 *     the next channel would be refused too, and every further call spends
 *     quota the other crons still need. The run stops at once.
 *
 * ── WHAT THIS FILE OWNS, AND WHAT IT DELIBERATELY DOES NOT ──────────────────
 * The walk and the hydration, and nothing that writes to data/. The guards that
 * protect the archive all read the committed corpus, which is parse's business,
 * so they live one stage later and are named here only so the boundary is
 * visible from the side that spends the quota:
 *   · the empty-dump refusal, the DATA-ONLY stale-raw guard      scripts/parse.ts
 *   · the collapse guard, the freeze carry and its pin, and the
 *     per-intake departures line                        scripts/parse-finish.ts
 * The one read of data/ here is the dead-channel remedy counting an intake's
 * committed records, so the number it tells a human to pin is on the screen.
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  ACTIVE_CHANNELS,
  CHANNEL_BY_ID,
  CHANNELS,
  hasGbvsrMarker,
  stripHashtagRun,
} from './channels';
import { buildAliasMatcher, loadCharacters, normalizeText } from './roster';
import type { AliasMatcher } from './roster';
import {
  apiGet,
  fetchVideoMeta,
  PlaylistNotFound,
  QUOTA,
  QuotaRefusal,
  requireApiKey,
} from './youtube';
import type {
  ChannelConfig,
  ChannelKey,
  DepartedEvidence,
  MatchVideo,
  RawVideoRecord,
} from '../types/index';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = join(ROOT, 'raw');
const DATA_DIR = join(ROOT, 'data');

/** The steady-state and platform figures from the header, restated on the
 *  bottom line of every run so the printed total is read against them. */
const STEADY_STATE_UNITS = 550;
const PLATFORM_UNITS_PER_DAY = 5000;

// ── the walk ────────────────────────────────────────────────────────────────

interface PlaylistItemsResponse {
  items: {
    /** Present because we ask for it. `title` is the video's CURRENT title —
     *  "Private video" / "Deleted video" for one that is already gone, which
     *  fails the marker and is counted as unmarked, never as unhydrated. */
    snippet?: { title?: string };
    contentDetails: { videoId: string; videoPublishedAt?: string };
  }[];
  nextPageToken?: string;
}

export interface ChannelFetch {
  records: RawVideoRecord[];
  /** Playlist pages read — 1 unit each. */
  pages: number;
  /** Items on those pages, below-floor ones on the last page included. */
  items: number;
  /** Items older than fetchFrom (skipped; they end the walk). */
  belowFloor: number;
  /** Ids the playlist listed twice during one walk. */
  duplicates: number;
  /** Ids at or above the floor whose playlist title passed hasGbvsrMarker —
   *  exactly the ids sent to videos.list. */
  marked: number;
  /** Marked ids videos.list did not return — private, deleted or
   *  region-blocked between the two calls. Reported, never swallowed. */
  unhydrated: string[];
  /** True when the floor ended the walk; false when the playlist ran out. */
  stoppedAtFloor: boolean;
}

/** An uploads playlist that answers 200 and lists nothing: every upload deleted
 *  or hidden while the account survives. The catalogue is gone either way, so
 *  it takes the 404's remedy (isDeadChannel below). */
export class EmptyPlaylist extends Error {
  constructor(readonly playlistId: string) {
    super(`uploads playlist ${playlistId} lists no items at all`);
    this.name = 'EmptyPlaylist';
  }
}

export async function fetchChannel(ch: ChannelConfig): Promise<ChannelFetch> {
  // An index source has no channel and no playlist; it is pulled by
  // `npm run data:theater` and skipped by the caller. Asserted rather than
  // assumed, because reaching here with one would page YouTube for
  // `playlistId=undefined` and come back with a failure that reads like a dead
  // channel — the 7c remedy, printed about our own bug.
  if (!ch.uploadsPlaylist) {
    throw new Error(
      `${ch.id} has no uploadsPlaylist — an index source must be skipped before fetchChannel.`,
    );
  }

  // 1) The uploads playlist, newest first, 50 per page, 1 unit per page.
  //
  // THE `fetchFrom` FLOOR IS A STOP CONDITION, NOT A FILTER (checklist 1b). The
  // walk stops after the first page whose NEWEST item is already below the
  // floor — one page of slack, because an uploads playlist is newest-first by
  // publish time and a manual re-upload or a premiere can put a single id out
  // of order. Items below the floor on the pages we did read are skipped, not
  // hydrated: parse's own floor (seasons.ts PRE_RELEASE) would drop them anyway.
  //
  // THE MARKER GATE IS A FILTER, NOT A STOP CONDITION. A multi-game channel
  // interleaves its games, so an unmarked stretch says nothing about the page
  // after it.
  //
  // DE-DUPLICATED BY ID. The dominant channel's walk is ~180 pages, and an
  // upload landing mid-walk shifts every later page by one, so the id on a page
  // boundary is listed twice. Hydrating it twice costs a fraction of a unit;
  // writing it twice hands parse two records with one id.
  const floor = ch.fetchFrom;
  const seen = new Set<string>();
  const markedIds: string[] = [];
  let pageToken: string | undefined;
  let pages = 0;
  let items = 0;
  let belowFloor = 0;
  let duplicates = 0;
  let stoppedAtFloor = false;
  do {
    const page = await apiGet<PlaylistItemsResponse>('playlistItems', {
      part: 'snippet,contentDetails',
      playlistId: ch.uploadsPlaylist,
      maxResults: '50',
      ...(pageToken ? { pageToken } : {}),
    });
    pages++;
    let newestOnPage = '';
    for (const it of page.items) {
      items++;
      const id = it.contentDetails.videoId;
      const at = it.contentDetails.videoPublishedAt ?? '';
      if (at > newestOnPage) newestOnPage = at;
      if (floor && at && at.slice(0, 10) < floor) {
        belowFloor++;
        continue;
      }
      if (seen.has(id)) {
        duplicates++;
        continue;
      }
      seen.add(id);
      if (!hasGbvsrMarker(it.snippet?.title ?? '')) continue;
      markedIds.push(id);
    }
    if (floor && newestOnPage && newestOnPage.slice(0, 10) < floor) {
      stoppedAtFloor = true;
      break;
    }
    pageToken = page.nextPageToken;
  } while (pageToken);

  // 2) Hydrate the marked ids, 50 per call. This is the ONLY place duration,
  //    liveBroadcastContent, view count and tags are read for the title arm,
  //    and checklist 5o is why it is not optional: a parse rate computed from
  //    titles alone omits every miss class that needs a duration (the 120 s
  //    floor, the live/upcoming exclusion). Records keep the playlist's order,
  //    newest first.
  const meta = await fetchVideoMeta(markedIds);
  const records: RawVideoRecord[] = [];
  const unhydrated: string[] = [];
  for (const id of markedIds) {
    const v = meta.get(id);
    if (!v) {
      unhydrated.push(id);
      continue;
    }
    records.push({
      id: v.id,
      channel: ch.id,
      title: v.title,
      description: v.description,
      publishedAt: v.publishedAt,
      durationSec: v.durationSec,
      ...(v.viewCount ? { viewCount: v.viewCount } : {}),
      liveBroadcastContent: v.liveBroadcastContent,
      ...(v.tags ? { tags: v.tags } : {}),
    });
  }

  // THREE EMPTY RESULTS, ALL THROWN FOR THIS CHANNEL, NONE WRITTEN. Every
  // intake here carries hundreds to thousands of Rising uploads since the floor,
  // so an empty result is never a quiet day — and an empty dump would be
  // refused by parse anyway, after overwriting the last good one on the way.
  // Thrown here rather than left for the collapse guard because the guard runs
  // on PARSED counts two stages later.
  //   · the playlist answered and listed NOTHING — the other shape a purged
  //     channel takes; same remedy as the 404 (EmptyPlaylist, isDeadChannel).
  //   · it listed uploads and none carries the marker — a rebrand to another
  //     game or a mass retitle; a human decides between a freeze and a gate fix.
  //   · it listed marked ids and videos.list returned none — a bug or an outage.
  if (items === 0) throw new EmptyPlaylist(ch.uploadsPlaylist);
  if (markedIds.length === 0) {
    throw new Error(
      `${ch.id}: walked ${items} item(s) and none on or after ${floor ?? 'the start'} carries the ` +
        'Rising marker. A live intake does not do this: check it for a rebrand or a mass retitle. If ' +
        'it has stopped publishing Rising, freeze it in place (see FROZEN in main()).',
    );
  }
  if (records.length === 0) {
    throw new Error(
      `${ch.id}: playlist listed ${markedIds.length} marked id(s) but videos.list returned none`,
    );
  }
  return {
    records,
    pages,
    items,
    belowFloor,
    duplicates,
    marked: markedIds.length,
    unhydrated,
    stoppedAtFloor,
  };
}

// ── THE DEAD-CHANNEL REMEDY (checklist 7c) ──────────────────────────────────
//
// SF6's lesson in its own words: the raw API dump it printed "named a playlist
// id and nothing a reader could act on". So the failure prints the action, with
// the numbers the action needs already counted.

/** Is this per-channel failure the deleted-channel signature? youtube.ts turns
 *  a playlistItems 404 into PlaylistNotFound; the message test is the belt to
 *  that brace, for a 404 that reaches here any other way. */
export const isDeadChannel = (err: unknown): boolean =>
  err instanceof PlaylistNotFound ||
  err instanceof EmptyPlaylist ||
  (err instanceof Error && /playlistNotFound|HTTP 404/.test(err.message));

interface Committed {
  count: number;
  /** Distinct YouTube ids — what a videos.list measurement would be run over. */
  videoIds: number;
  newest: string;
}

/** The committed corpus, or null when data/videos.json is absent or
 *  unreadable. Local file, no quota. Read once per run for the departure check
 *  below, and again by the dead-channel printer on its failure path. */
async function readCommitted(): Promise<MatchVideo[] | null> {
  const p = join(DATA_DIR, 'videos.json');
  if (!existsSync(p)) return null;
  try {
    const all = JSON.parse(await readFile(p, 'utf8')) as MatchVideo[];
    return Array.isArray(all) ? all : null;
  } catch {
    return null;
  }
}

/** This intake's committed records, summarised for the dead-channel remedy. */
async function committedFor(id: ChannelKey): Promise<Committed | null> {
  const all = await readCommitted();
  if (!all) return null;
  const mine = all.filter((v) => v.intake === id);
  return {
    count: mine.length,
    videoIds: new Set(mine.map((v) => v.videoId ?? v.id)).size,
    newest: mine.reduce((a, v) => (v.publishedAt > a ? v.publishedAt : a), '').slice(0, 10),
  };
}

// ── DEPARTURES: the one case the stale-raw guard cannot judge from data ─────
//
// parse.ts refuses a dump when the committed corpus holds a record for that
// intake newer than anything in it. That proves the dump stale, EXCEPT when the
// record can no longer reach the dump: delete a channel's newest upload, post
// nothing after it, and a dump fetched a minute ago fails the same test a
// month-old one does. Observed on Strive on 2026-10-02 (ggstBattleCollection,
// 5VB5RbRr9Ck): that cron died in Parse with every dump in hand fresh.
//
// Here "can no longer reach" has one more way in than on Strive: the walk's
// marker gate. An upload retitled without `GBVSR` is never hydrated, so it is
// out of the dump exactly as a deleted one is, and parse would drop it from
// the dump anyway (the recon line above counts the same thing between calls).
//
// The data cannot separate those cases from a stale dump, so this asks YouTube,
// and only about committed records newer than the dump, selected by the
// guard's own rule (same intake, publishedAt after the dump's newest). On an
// ordinary morning there are none, so it makes no call and costs nothing.
// snippet+status is still 1 unit per 50 ids, counted by QUOTA like any call.
interface StatusResponse {
  items: { id: string; snippet?: { title?: string }; status?: { privacyStatus?: string } }[];
}

export async function confirmDepartures(
  id: ChannelKey,
  dump: RawVideoRecord[],
  committed: MatchVideo[],
): Promise<DepartedEvidence> {
  const newestInDump = dump.reduce((a, v) => (v.publishedAt > a ? v.publishedAt : a), '');
  const ahead = newestInDump
    ? committed.filter((v) => v.intake === id && v.publishedAt > newestInDump).map((v) => v.id)
    : [];
  const ids: string[] = [];
  for (let i = 0; i < ahead.length; i += 50) {
    const batch = ahead.slice(i, i + 50);
    const res = await apiGet<StatusResponse>('videos', {
      part: 'snippet,status',
      id: batch.join(','),
      maxResults: '50',
    });
    const reachable = new Set(
      res.items
        .filter(
          (v) => v.status?.privacyStatus === 'public' && hasGbvsrMarker(v.snippet?.title ?? ''),
        )
        .map((v) => v.id),
    );
    ids.push(...batch.filter((x) => !reachable.has(x)));
  }
  return { channel: id, newestInDump, checkedAt: new Date().toISOString(), ids };
}

async function printDeadChannel(ch: ChannelConfig, err: unknown): Promise<void> {
  const c = await committedFor(ch.id);
  const what =
    err instanceof EmptyPlaylist
      ? `its uploads playlist is EMPTY — ${ch.uploadsPlaylist} answers, and lists nothing.`
      : `its uploads playlist is GONE — HTTP 404 / playlistNotFound on ${ch.uploadsPlaylist}.`;
  const today = new Date().toISOString().slice(0, 10);
  const records = c ? String(c.count) : '<committed count>';
  const units = c ? `${Math.ceil(c.videoIds / 50)} unit(s)` : '1 unit per 50 ids';
  const pin =
    `      frozen: { since: '${c?.newest || '<its last upload>'}', reason: '<what happened>', ` +
    `records: ${records}, reviewedAt: '${today}' },`;
  console.error(
    [
      ``,
      `✖ ${ch.id} (${ch.name}): ${what}`,
      // Not "renamed": a handle change keeps the UC id, and with it the playlist.
      `  The account has been deleted or terminated, or its uploads made private. Look before acting:`,
      `    https://www.youtube.com/channel/${ch.channelId ?? '?'}`,
      ``,
      ...(ch.frozen
        ? [
            `  It is ALREADY FROZEN, so nothing moves and no dump can seed its pin any more: set`,
            `  frozen.records in scripts/channels.ts from its committed count instead. If it was never`,
            `  seeded, nothing was committed to carry — the pin is then 0 and the reason says why:`,
          ]
        : [
            `  If it is gone for good, freeze it IN PLACE in scripts/channels.ts with frozen.records = its`,
            `  committed count. IN PLACE because array order IS dedupe precedence: moving the entry under the`,
            `  FROZEN banner would change which copy of a cross-posted match wins. Its records were parsed`,
            `  from real matches, so they are carried, never deleted:`,
          ]),
      ``,
      pin,
      ``,
      c
        ? `  (data/videos.json holds ${c.count} record(s) from this intake today, newest ${c.newest || '—'}.)`
        : `  (data/videos.json is absent or unreadable here — take the count from the committed file.)`,
      ``,
      `  If its videos are gone too, measure it with a videos.list over its ${c ? `${c.videoIds} ` : ''}carried`,
      `  id(s) — ${units} — and record an \`unplayable\` block { checked, alive, checkedIds, note } —`,
      `  never infer it from a sample. parse then stamps every carried record unplayable.`,
      ``,
      `  raw/${ch.id}.json was NOT written: parse sees the previous dump or none, never an empty one.`,
      `  The other channels continue; this run exits non-zero once they are written.`,
    ].join('\n'),
  );
}

// ── THE RECON / REJECT PRINTER (checklist 5e) ───────────────────────────────
//
// Console only, and deliberately NOT a gate — it runs AFTER the dump is
// written, inside its own catch, so it can neither drop a record nor stop the
// fetch. Its job is to make a grammar drift visible the DAY it lands rather
// than the week someone notices the counts sagging. An approximate regex that
// REJECTS a real title is a silent data loss; the same regex printing a line a
// human reads is free. The precise version — misses that name a roster
// fighter, per channel, straight from the real parser — is in data/report.md.
//
// THE EXPECTED SHAPE IS PER SLOT ORDER, NOT PER GAME (types/index.ts
// SlotOrder), because one regex would flag a whole channel: a "bracket on each
// side of vs" shape scores 0 on gbvsReplayChannel, which has no brackets.
//   · handle-outside / chars-outside: a bracket group, then `vs`, then another
//     group. Groups are matched BY TYPE — round with one level of nesting,
//     square — because highLevelReplays puts a SQUARE skin inside the ROUND
//     fighter slot, `(Character [skin])`, and gbvsrReplay puts a ROUND fighter
//     inside a SQUARE side, `[Handle(Char)]`; a generic "any bracket" class
//     reads the inner one as the slot. FULLWIDTH brackets need no class of
//     their own: the title goes through normalizeText (the fold parse uses)
//     first, which turns yumegiwa's `（EN JP）` into `(EN JP)`. Decoration may
//     sit between the group and the `vs` — highLevelReplays writes
//     `(Character)🔥 Vs`, so Strive's `\s*` there would flag its whole corpus.
//   · handle-first-bare: exactly one `vs`, and each half names a
//     roster fighter OUTSIDE any bracket — `… Handle Char VS Handle Char`. A
//     paren variant from that channel's history is flagged on purpose: it is
//     the other orientation's shape, where the declared order would break a
//     tie the wrong way.
//
// `VERSUS` IS NOT A PAIRING TOKEN HERE, unlike Strive's shape: it is this
// game's own name. kakuken writes "Granblue Fantasy Versus Rising" in every
// title, so a split on it cuts that channel's titles in three.
// The `vs` boundary is LATIN-ONLY, the roster.ts lesson: yumegiwa can glue the
// token to a Japanese handle (`VS加奈人`), and a `\p{L}` guard refuses that.
const ROUND = String.raw`\((?:[^()]|\([^()]*\))*\)`;
const SQUARE = String.raw`\[[^\[\]]*\]`;
const GROUP = `(?:${ROUND}|${SQUARE})`;
const VS = String.raw`(?<![A-Za-z0-9])(?:vs\.?|×)(?![A-Za-z0-9])`;
const BRACKETED_SHAPE = new RegExp(`${GROUP}[^\\p{L}\\p{N}]*${VS}[\\s\\S]*?${GROUP}`, 'iu');
const VS_SPLIT = new RegExp(VS, 'iu');
const GROUPS = new RegExp(GROUP, 'gu');

export function matchesShape(ch: ChannelConfig, title: string, matcher: AliasMatcher): boolean {
  if (ch.slotOrder === 'handle-outside' || ch.slotOrder === 'chars-outside') {
    return BRACKETED_SHAPE.test(normalizeText(title));
  }
  const halves = normalizeText(stripHashtagRun(title)).split(VS_SPLIT);
  return halves.length === 2 && halves.every((h) => matcher.ids(h.replace(GROUPS, ' ')).length > 0);
}

function recon(ch: ChannelConfig, records: RawVideoRecord[], matcher: AliasMatcher): void {
  // Re-tested on the HYDRATED title — parse's second line, previewed. Anything
  // the playlist title passed and this fails was retitled between the calls.
  const marked = records.filter((r) => hasGbvsrMarker(r.title));
  const retitled = records.length - marked.length;
  let shaped = 0;
  // A title that names a fighter but does NOT match the shape is the signal
  // that matters: match-shaped content the parser may drop, or — worse — read
  // with the slots swapped.
  const suspicious: RawVideoRecord[] = [];
  for (const r of marked) {
    if (matchesShape(ch, r.title, matcher)) shaped++;
    else if (matcher.ids(r.title).length > 0) suspicious.push(r);
  }
  console.log(
    `    recon: ${shaped}/${marked.length} marked title(s) match the ${ch.slotOrder} shape` +
      (retitled
        ? `  · ${retitled} hydrated title(s) lost the marker between the two calls (parse drops them)`
        : ''),
  );
  if (suspicious.length) {
    console.log(`           ⚠ ${suspicious.length} title(s) name a fighter but miss the shape:`);
    for (const r of suspicious.slice(0, 8))
      console.log(`             · [${r.id}] ${r.title.slice(0, 96)}`);
    if (suspicious.length > 8) console.log(`             … and ${suspicious.length - 8} more`);
  }
}

// ── main ────────────────────────────────────────────────────────────────────

const fmt = (n: number, width: number): string => n.toLocaleString('en-US').padStart(width);

async function main(): Promise<void> {
  await mkdir(RAW_DIR, { recursive: true });
  requireApiKey('data:fetch');

  // UNKNOWN ARGUMENTS ARE REFUSED, not ignored. `--only kakuken` (a space, not
  // `=`) or a misspelt `--include-frozn` would otherwise fall through to the
  // full walk — ~550 units spent to answer a ~40-unit question.
  const args = process.argv.slice(2);
  const unknown = args.filter((a) => !/^--only=.+$/.test(a) && a !== '--include-frozen');
  if (unknown.length) {
    console.error(
      `✖ unknown argument(s): ${unknown.join(' ')}\n` +
        '  Accepted: --only=<ChannelKey>  --include-frozen   (nothing was fetched)',
    );
    process.exit(1);
  }
  const only = args.find((a) => a.startsWith('--only='))?.slice('--only='.length);
  const includeFrozen = args.includes('--include-frozen');

  // FROZEN CHANNELS ARE SKIPPED — their committed records are carried forward
  // byte-stable by parse against a pinned count (types/index.ts FreezePin), so
  // fetching them would spend quota to produce a dump nothing reads.
  //
  // `--include-frozen` is the ONE exception and it exists for ONE job: seeding
  // the pin. All four frozen channels (risingReplays, gbFightingReplays,
  // gbvsrReplay, fgHighLevel) ship with `frozen.records: -1`, a sentinel no
  // carry can ever equal, so parse throws until a human has measured the real
  // count. The ritual, in order, per channel (or for all four at once without
  // --only):
  //   1. npm run data:fetch -- --only=<key> --include-frozen
  //   2. npx tsx scripts/parse.ts --seed-freeze-pins   (prints the count, writes nothing)
  //   3. set frozen.records on <key> in scripts/channels.ts to that count
  //   4. npm run data:parse                            (asserts the parse against the
  //                                                     pin and writes the records)
  // Every later run carries the committed records and re-asserts the pin. There
  // is no other legitimate use of this flag and it must never appear in the cron.
  const pool = includeFrozen ? CHANNELS.filter((c) => !c.index) : ACTIVE_CHANNELS;
  const targets = only ? pool.filter((c) => c.id === only) : pool;
  if (only && targets.length === 0) {
    const named = CHANNEL_BY_ID.get(only as ChannelKey);
    console.error(
      `✖ --only=${only} matches no ${includeFrozen ? 'YouTube' : 'active'} channel` +
        (named?.index
          ? ` — ${only} is an index source; it is pulled by \`npm run data:theater\``
          : named?.frozen
            ? ` — ${only} is frozen; add --include-frozen if you are seeding its pin`
            : `. Known: ${CHANNELS.filter((c) => !c.index)
                .map((c) => c.id)
                .join(', ')}`) +
        '\n  (nothing was fetched)',
    );
    process.exit(1);
  }

  // The matcher is used ONLY by the reject printer. It reads
  // data/characters.json — a local file, no quota — and is built BEFORE the
  // first call, so a missing roster fails the run while it has cost nothing.
  const matcher = buildAliasMatcher(await loadCharacters());

  console.log(
    `▶ Fetching ${targets.length} channel(s)` +
      (includeFrozen ? ' (--include-frozen: seeding a freeze pin)' : '') +
      '…',
  );
  for (const c of CHANNELS) {
    if (targets.includes(c)) continue;
    if (c.index) console.log(`  ↷ ${c.id} — index source, pulled by \`npm run data:theater\``);
    else if (c.frozen)
      console.log(
        `  ↷ ${c.id} (${c.name}) FROZEN since ${c.frozen.since} — ` +
          (c.frozen.records < 0
            ? `pin UNSEEDED; parse throws until it is (--only=${c.id} --include-frozen)`
            : `${c.frozen.records} record(s) carried, not fetched`) +
          (c.frozen.unplayable ? ' · unplayable' : ''),
      );
  }
  console.log('');

  // Absent or unreadable is treated as empty here: no departure check runs, so
  // no departure is recorded and the guard stays strict. parse.ts refuses an
  // unreadable videos.json itself.
  const committed = (await readCommitted()) ?? [];
  const written: { id: ChannelKey; out: ChannelFetch }[] = [];
  const failed: { ch: ChannelConfig; dead: boolean; message: string }[] = [];
  for (const ch of targets) {
    const before = QUOTA.units;
    let out: ChannelFetch;
    let departed: DepartedEvidence;
    try {
      out = await fetchChannel(ch);
      // INSIDE the channel's try, so a failed check is a failed CHANNEL: neither
      // file is written and the previous dump keeps the departure file it was
      // bound to. Writing the dump first and dropping the departure file on
      // failure would leave a fresh dump with no evidence beside it, and parse
      // would then refuse it as "stale — refresh first", which is the wrong
      // diagnosis and the wrong remedy. A refusal still aborts the run below.
      departed = await confirmDepartures(ch.id, out.records, committed);
    } catch (err) {
      if (err instanceof QuotaRefusal) {
        console.error(
          `\n✖ ${ch.id}: ${err.message}\n` +
            `  Nothing after it was fetched. raw/ files written this run: ` +
            `${written.map((w) => w.id).join(', ') || 'none'}; raw/${ch.id}.json and every later ` +
            `channel's were left as they were.\n` +
            `  quota spent before the refusal: ${QUOTA.units} unit(s) over ${QUOTA.calls} call(s). ` +
            `Try again after the reset (midnight Pacific).`,
        );
        process.exitCode = 1;
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      const dead = isDeadChannel(err);
      if (dead) await printDeadChannel(ch, err);
      else
        console.error(
          `\n✖ ${ch.id} (${ch.name}) FAILED — raw/${ch.id}.json was NOT written; continuing.\n  ${message}`,
        );
      console.error(`    (${QUOTA.units - before} unit(s) spent on ${ch.id} before it failed)\n`);
      failed.push({ ch, dead, message });
      continue;
    }

    await writeFile(join(RAW_DIR, `${ch.id}.json`), JSON.stringify(out.records));
    // Written beside EVERY dump, empty or not, so a dump never sits next to a
    // departure file from an earlier fetch. parse.ts also checks the binding.
    await writeFile(join(RAW_DIR, `${ch.id}.departed.json`), JSON.stringify(departed));
    written.push({ id: ch.id, out });
    const newest = out.records.reduce((a, v) => (v.publishedAt > a ? v.publishedAt : a), '');
    console.log(
      `  ${ch.id.padEnd(18)} ${fmt(out.pages, 4)} page(s) ${fmt(out.items, 6)} item(s) ` +
        `${fmt(out.marked, 6)} marked ${fmt(out.records.length, 6)} hydrated ` +
        `${fmt(out.unhydrated.length, 3)} unhydrated ${fmt(QUOTA.units - before, 4)} unit(s)  ` +
        `newest ${newest.slice(0, 10) || '—'}` +
        (ch.frozen ? '  [FROZEN — seeding]' : ''),
    );
    console.log(
      `    walk: ` +
        (out.stoppedAtFloor
          ? `stopped at fetchFrom ${ch.fetchFrom}`
          : 'reached the end of the playlist') +
        (out.belowFloor ? ` (${out.belowFloor} item(s) below the floor skipped)` : '') +
        `; ${out.items - out.belowFloor - out.duplicates - out.marked} unmarked title(s) not hydrated` +
        (out.duplicates
          ? `; ${out.duplicates} id(s) listed twice (an upload shifted the pages mid-walk)`
          : ''),
    );
    if (departed.ids.length)
      console.log(
        `    ↘ ${departed.ids.length} committed upload(s) newer than this dump can no longer reach ` +
          `it (deleted, private, unlisted or unmarked): ${departed.ids.join(', ')}. parse prunes them.`,
      );
    if (out.unhydrated.length)
      console.log(
        `    ⚠ ${out.unhydrated.length} marked id(s) did not hydrate (private, deleted or region-blocked ` +
          `between the two calls): ${out.unhydrated.slice(0, 5).join(', ')}` +
          (out.unhydrated.length > 5 ? ', …' : ''),
      );
    try {
      recon(ch, out.records, matcher);
    } catch (err) {
      console.warn(`    ⚠ recon failed (never a gate; the dump is written): ${String(err)}`);
    }
  }

  const sum = (f: (o: ChannelFetch) => number) => written.reduce((n, w) => n + f(w.out), 0);
  const frozenSkipped = CHANNELS.filter((c) => c.frozen && !targets.includes(c)).length;
  const indexSources = CHANNELS.filter((c) => c.index).length;
  console.log(
    `\n${failed.length ? '✖' : '✓'} raw/ written for ${written.length} of ${targets.length} channel(s) — ` +
      `${sum((o) => o.pages)} page(s), ${sum((o) => o.items)} item(s), ${sum((o) => o.marked)} marked, ` +
      `${sum((o) => o.records.length)} hydrated, ${sum((o) => o.unhydrated.length)} unhydrated` +
      (frozenSkipped ? `; ${frozenSkipped} frozen channel(s) skipped` : '') +
      (indexSources ? `; ${indexSources} index source(s) pulled by \`npm run data:theater\`` : '') +
      `\n  quota: ${QUOTA.units} unit(s) over ${QUOTA.calls} call(s) — steady state ≈${STEADY_STATE_UNITS}/day; ` +
      `the key is shared with seven other games' crons (≈${PLATFORM_UNITS_PER_DAY.toLocaleString('en-US')} units/day in total)`,
  );

  // Non-zero AFTER every healthy channel is written — the 7c rule. A channel
  // that vanished is a fact about the archive, not a bad morning, so the run is
  // red until a human freezes it; but it is red WITH seven fresh dumps, not red
  // instead of them.
  if (failed.length) {
    console.error(
      `\n✖ ${failed.length} channel(s) FAILED and were not written: ` +
        failed
          .map(
            (f) => `${f.ch.id}${f.dead ? ' (uploads playlist GONE — see the remedy above)' : ''}`,
          )
          .join(', '),
    );
    process.exitCode = 1;
  }
}

// isMain, not a bare call: fetchChannel, matchesShape and isDeadChannel are
// exported so a gate check can drive them against a stubbed fetch, and
// importing this module must not start a walk or demand a key.
const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(resolve(entry)).href) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
