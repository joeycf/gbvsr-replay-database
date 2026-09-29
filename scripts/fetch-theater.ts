// Stage 1 for the INDEX intake: pull Replay Theater's Granblue Fantasy Versus
// catalogue, keep the RISING half of it, join each entry to the YouTube
// metadata of the VOD it points at or is, and dump the result to
// raw/replayTheater.json.
//
// Run: npm run data:theater   (and every morning, from the cron)
//      npm run data:theater -- --full          whole-catalogue reconcile; resumes
//                                              a partial sweep if one is cached
//      npm run data:theater -- --fresh         the same, discarding any cache
//      npm run data:theater -- --full --limit=N  read at most N pages and CACHE
//                                              (no dump), so a sweep can be
//                                              driven in pieces
//      npm run data:theater -- --full --allow-shrink   accept a full sweep that
//                                              falls under the record floor
//
// ── THE BASE ────────────────────────────────────────────────────────────────
// Strive's fetcher (ggst-replay-database/scripts/fetch-theater.ts, itself
// "SF6's base + FF's additions"), kept whole: the cursor-gated dump
// (theater-delta.ts, checklist 12g), the HARD refusal on a cursor ahead of the
// catalogue (12f, exit 1, never a warning), the byte-identical partial-resume
// cache with its signal flush, the offset-past-the-end refusal, the non-fatal
// collision counter, the full-sweep record floor (--allow-shrink) and the
// witness envelope. From Avatar, the newest sibling: the checklist 12k fixes
// (h/m/s offsets, the intro-skip floor, a t=0 row inside a multi-row VOD is a
// segment, the one-symbol handle), the whole-video completion of a cursor
// delta, and its module hygiene (the API key is asked for inside main, never at
// import; importing this file starts no pull; a quota refusal ends the run).
//
// It writes raw/ only. Every data/ write belongs to parse (checklist 12e): the
// cursor this run reaches is REPORTED in the stats file and WRITTEN by parse
// into data/theater-cursor.json, and the record pin in data/source-pins.json
// is read here only as the floor. A fetcher that advanced the cursor itself
// would advance it for a pull whose records parse then refused.
//
// ── WHAT MAKES IT SAFE ─────────────────────────────────────────────────────
//   1. ADD-ONLY. This intake can only ADD records. A committed record is
//      carried whether or not the catalogue still lists it; entries that vanish
//      are COUNTED in report.md, never removed, and the pin only grows.
//   2. THE CRON NEVER DEPENDS ON THIS SUCCEEDING. The step runs LAST and is
//      allowed to fail. On any failure (network, non-200, malformed page, a
//      refused floor, a quota refusal) there is simply no dump, parse carries
//      exactly as it does today, and the cron stays green.
//
// replaytheater.app/robots.txt is `User-agent: * / Disallow:`; requests carry a
// contactable user-agent and the catalogue's own 1.2 s pacing. That is
// politeness to a collaborator, not rate-limit avoidance.
//
// ── WHAT THIS CATALOGUE IS ──────────────────────────────────────────────────
// Measured over the full sweep of 2026-09-29: 23,894 entries pointing at 15,458
// videos, 478 pages of 50 (23,898 on a read later the same day: IT MOVES, so
// nothing here pins the count). A full sweep is 478 paced GETs (~10 minutes)
// plus one videos.list unit per 50 distinct RISING-ERA videos; the cursor reads
// two or three pages on a quiet morning.
//
// ROWS ARE SETS, NOT MATCHES. Strive's header says "matches" and it is wrong
// here: consecutive different-pair rows on one VOD sit a median 573 s apart
// (2026-09-29), which is a set, and the catalogue splits a set into two rows
// only at a counter-pick. Nothing in the code changes for this (a row is a
// record either way), but every count below is a count of sets, and the
// recon prints the gap so the claim is re-measured on every pull.
//
// ── THE GBVSR DELTAS, EACH MEASURED ON THAT SWEEP ──────────────────────────
//
// 1. ONE LABEL, TWO GAMES. Every row reads `game: "Granblue Fantasy: Versus"`,
//    including the 10,459 rows (43.8%) from 2019-12 to 2023-11 that are the
//    ORIGINAL game. The per-entry label check (12a) stays, and passes all of
//    them, so it cannot be the game gate here. THE RISING GATE is: the VIDEO's
//    own publishedAt must be on or after ChannelIndex.admitFrom (the vendor's
//    early access, 2023-12-11). It is a date gate, not a title marker, because
//    23 post-launch VODs title Rising "GBVS". It runs twice: a PRE-gate on the
//    catalogue's own upload_date (the video's upload date) BEFORE hydration, so
//    the original game's videos are never sent to videos.list at all (~70
//    units a full sweep), and a CONFIRM on the hydrated publishedAt, which is
//    the authority and is the same test parse's date floor applies. Rows
//    refused by either are counted as `preRising`.
//
// 2. SET-FORMAT TAGS ARE NOT EVENTS (12k). The catalogue's single most common
//    tag is `FT5` (732 rows); FT2, FT3, FT7, FT10, FT15, FT20 and the fullwidth
//    `FT５` are there too. Published as `Replay.event` (12j) each would be a
//    chip naming a tournament that does not exist. After normalizeText (which
//    folds the fullwidth digit) a tag matching FORMAT_TAG becomes `tag: ''`
//    with the spelling kept in `rawTag`, and the count goes in the stats.
//
// 3. OFFSETS. Four rules: `t=` values in h/m/s form (`1h11m20s`) parse (0 rows
//    here today; Avatar's parser is ported anyway because Strive's seconds-only
//    pattern DROPS the row as a bad link the day one appears); an intro-skip
//    offset on a single-row video is the WHOLE video, not a segment (Avatar's
//    floor; see INTRO_SKIP_MIN_SHARE); a t=0 row inside a multi-row VOD is a
//    SEGMENT at zero, `vid@0`, not the whole VOD (104 such rows here, each of
//    which Strive's `secs > 0` rule would publish as one record standing for a
//    whole tournament); and the 443 concatenated `youtu.be/<id>&t=Ns` links are
//    read by the id's SHAPE. Composite collisions: 11, of which 9 carry
//    different content. Counted, never a hard failure.
//
// 4. PLACEHOLDERS. 5,057 sides read `Unknown Player` over the whole catalogue
//    and only ~10 in the Rising era, so the Rising gate removes nearly all of
//    them before anything here counts. The rest pass through untouched (parse
//    drops them on crosscheck.ts isPlaceholderHandle, which exempts a handle
//    that is one symbol: checklist 12k's `♱`). Handles are carried VERBATIM:
//    274 handle groups differ only by case, and the case vote is parse's.
//
// 5. CHARACTER LABELS ARE CARRIED VERBATIM. That includes `Gran (EX)`,
//    `Djeeta (EX)` and `Narmaya (EX)`, the EX mode mark parse reads (never
//    stripped here), and the label typos `Cgliostro`, `Lucillius`, `Meterra`,
//    `Zoeey`, which the roster's aliases already resolve.
//
// 6. LIVENESS IS THIS SOURCE'S OWN, AND IT HAS A SHAPE (12h). 5.22% of rows and
//    6.85% of videos no longer resolve over the whole catalogue. In the Rising
//    era that is 681 dead rows in one DELETION WINDOW: 0-1 a month up to
//    2024-10, 71-97 a month from Nov 2024 to Jul 2025, 0 since Aug 2025, and by
//    RT-id adjacency they sit among the dominant channel's uploads (that channel
//    deleted a stretch of its own back catalogue; channels.ts says the same).
//    Not age-graded decay, and not any sibling's shape. This file never
//    hydrates a pre-Rising video, so the rate it reports is the Rising-era rate
//    only, by upload year and month in the stats file. The daily cursor window
//    is all recent rows and reads ~0% forever; only a --full sweep sees the
//    window.

import { existsSync, writeFileSync } from 'node:fs';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CHANNEL_BY_ID, stripTheaterSponsor } from './channels';
import { exactAliasWithMark, isPlaceholderHandle } from './crosscheck';
import { aliasKey, buildAliasMatcher, loadCharacters, normalizeText } from './roster';
import { LAUNCH } from './seasons';
import { newerThanCursor } from './theater-delta';
import {
  QUOTA,
  QuotaRefusal,
  fetchVideoMeta,
  requireApiKey,
  sleep,
  type VideoMeta,
} from './youtube';
import type { ChannelConfig, ChannelIndex, TheaterRawRecord } from '../types/index';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = join(ROOT, 'raw');
/** THE INTAKE. parse builds one record per row of this file. */
const OUT = join(RAW_DIR, 'replayTheater.json');
/** What the pull learned about ITSELF, beside the dump. parse reads it, and the
 *  `mode` is LOAD-BEARING there: it is how "committed but absent from the dump"
 *  is told apart between "vanished upstream" (full) and "not in the pages we
 *  read" (cursor). Absent on a run that never pulled. */
const STATS = join(RAW_DIR, '.replayTheater.stats.json');
/** EVERY entry of the read window that passed the per-entry game gate AND the
 *  Rising gate, tagged and untagged, in the catalogue's own shape, inside SF6's
 *  envelope. Kept OUT of the intake file and NOT cursor-gated: this file is the
 *  WITNESS. crosscheck.ts reads it and builds nothing. */
const WITNESS = join(RAW_DIR, 'replayTheater.witness.json');
/** The cursor's committed state, `{ replayTheater: <highest id> }`, the
 *  sibling shape keyed by channel id. Written by parse on the pull, only ever
 *  forward, and READ here. */
const CURSOR = join(ROOT, 'data', 'theater-cursor.json');
/** The carry pin parse writes; read here for the full-sweep floor only. */
const PINS = join(ROOT, 'data', 'source-pins.json');
/** Resume cache for a FULL sweep. See "PARTIAL RESUME" below. */
const PARTIAL = join(RAW_DIR, '.replayTheater.partial.json');

const found = CHANNEL_BY_ID.get('replayTheater');
if (!found?.index) throw new Error('replayTheater is not registered as an index channel');
// Re-bound as non-optional so the narrowing survives into main() and the
// signal handler; a closure cannot see a top-level type guard.
const CH: ChannelConfig = found;
const INDEX: ChannelIndex = found.index;

// ── flags ───────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const FRESH = argv.includes('--fresh');
/** THE DAILY PATH is the cursor. `--full` forces the whole-catalogue sweep,
 *  which is what a periodic reconcile wants and what the first run ever must
 *  be: a cursor run against an empty cursor reads its ten-page bound, dumps
 *  that window, and reports the bound. */
const FULL = argv.includes('--full') || FRESH;
const CURSOR_MODE = !FULL;
const ALLOW_SHRINK = argv.includes('--allow-shrink');
/** Two clean pages, not one. The catalogue orders by upload_date DESC, so a
 *  day's submissions can straddle a page boundary and a single clean page is
 *  not proof there is nothing behind it. */
const CLEAN_PAGES_TO_STOP = 2;
/** A hard ceiling on the daily path, so a catalogue-side reordering can never
 *  turn the cron into a sweep: 10 of 478 pages, 2.1% of the catalogue. Hitting
 *  it is reported (`hitCursorBound`), not silent, and under add-only nothing is
 *  lost, only late. The reconcile is `npm run data:theater -- --full`. */
const CURSOR_MAX_PAGES = 10;
/** How often a full sweep checkpoints its cache. An interrupt (SIGINT/SIGTERM)
 *  flushes regardless. */
const CACHE_EVERY_PAGES = 5;

/** `--limit=N` or `--limit N`: the highest page number this run may read. A
 *  flag that is present must carry a usable number or stop the run:
 *  `Number(undefined)` is NaN, `Math.min(pages, NaN)` is NaN, and the walk
 *  would then silently read page 1 alone. Read inside main, so importing this
 *  module for its helpers can never exit somebody else's process. */
function parseLimit(): number {
  const eq = argv.find((a) => a.startsWith('--limit='));
  const bare = argv.indexOf('--limit');
  if (!eq && bare === -1) return Infinity;
  const raw = eq ? eq.slice('--limit='.length) : argv[bare + 1];
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    console.error(`✖ --limit needs a positive integer (got ${JSON.stringify(raw)}).`);
    process.exit(1);
  }
  return n;
}

/** THE TEST SEAM. The endpoint is committed config (channels.ts) and the live
 *  catalogue moves, so a positive control that needs two pulls to be
 *  byte-identical cannot be run against it. A gate serves a frozen fixture and
 *  points this at it. Logged loudly whenever it is in effect, so a stray shell
 *  variable cannot quietly turn the cron into a fixture read. */
const ENDPOINT = process.env.REPLAY_THEATER_ENDPOINT ?? INDEX.endpoint;

const UA = 'replay-database/gbvsr (+https://github.com/joeycf) data:theater';

const pct = (n: number, total: number) => (total === 0 ? '0.0' : ((n / total) * 100).toFixed(1));
const median = (xs: number[]): number | undefined => {
  if (!xs.length) return undefined;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

// ── the index API ───────────────────────────────────────────────────────────

/** One entry exactly as the catalogue publishes it. Everything is nullable:
 *  this is someone else's schema and we do not get to assume. */
export interface TheaterEntry {
  id?: number;
  game?: string | null;
  video_link?: string | null;
  tag?: string | null;
  /** `YYYY-MM-DD`, the VIDEO's upload date (read 2026-09-29), no timezone. */
  upload_date?: string | null;
  p1_name?: string | null;
  p2_name?: string | null;
  p1_char?: string | null;
  p1_char2?: string | null;
  p1_char3?: string | null;
  p1_char4?: string | null;
  p2_char?: string | null;
  p2_char2?: string | null;
  p2_char3?: string | null;
  p2_char4?: string | null;
}
interface TheaterPage {
  matches?: TheaterEntry[];
  total_count?: number | string;
}

async function getPage(page: number, retries = 4): Promise<TheaterPage> {
  const url = `${ENDPOINT}?game=${encodeURIComponent(INDEX.slug)}&page=${page}`;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': UA } });
      if (res.ok) return (await res.json()) as TheaterPage;
      if (res.status >= 500 || res.status === 429) throw new Error(`HTTP ${res.status}`);
      throw new Error(`HTTP ${res.status} (not retryable)\n${await res.text().catch(() => '')}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (attempt >= retries || msg.includes('not retryable')) {
        throw new Error(`Replay Theater page ${page} failed: ${msg}`, { cause: err });
      }
      const wait = Math.min(1500 * 2 ** (attempt - 1), 10_000);
      console.warn(
        `  ⚠ page ${page} (attempt ${attempt}/${retries}): ${msg}; retrying in ${wait}ms`,
      );
      await sleep(wait);
    }
  }
  throw new Error(`Exhausted retries for page ${page}`);
}

// ── THE RISING GATE ─────────────────────────────────────────────────────────
//
// See delta 1 in the header. Two halves with two different jobs:
//
//   PRE-GATE (upload_date, before hydration) exists to SAVE QUOTA. The key is
//   shared with seven production crons, and hydrating the original game's
//   videos only to refuse them would spend ~70 units a full sweep on footage
//   this archive does not cover. It refuses only what is certainly too early:
//   upload_date is a bare calendar date in a timezone the catalogue does not
//   state, publishedAt is UTC, so a day of slack sits under admitFrom. A row
//   whose upload_date is missing or unreadable is NOT refused; it is hydrated
//   and decided on publishedAt.
//
//   CONFIRM (the hydrated publishedAt) is the AUTHORITY, and it is exactly the
//   test parse's date floor applies (the UTC day of publishedAt against
//   seasons.ts PRE_RELEASE). Nothing reaches the dump on the catalogue's say-so
//   about a date.
//
// The pre-gate's one failure mode is a catalogue date that runs EARLY by more
// than the slack for a video published on or after admitFrom. The recon
// measures how often upload_date and publishedAt disagree on every hydrated
// row, so that bound is re-read on each sweep rather than assumed.
const PRE_GATE_SLACK_DAYS = 1;
const ISO_DAY = /^(\d{4}-\d{2}-\d{2})/;

const shiftDay = (iso: string, days: number): string =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** True only when the catalogue's own upload_date is readable AND more than
 *  PRE_GATE_SLACK_DAYS before `admitFrom`. Everything else goes to hydration. */
export function preRisingByUploadDate(
  uploadDate: string | null | undefined,
  admitFrom: string,
): boolean {
  const m = ISO_DAY.exec((uploadDate ?? '').trim());
  if (!m) return false;
  return m[1]! < shiftDay(admitFrom, -PRE_GATE_SLACK_DAYS);
}

/** The authority: the VOD's own publish day (UTC) is on or after `admitFrom`. */
export const risingByPublishedAt = (publishedAt: string, admitFrom: string): boolean =>
  publishedAt.slice(0, 10) >= admitFrom;

// ── SET-FORMAT TAGS ─────────────────────────────────────────────────────────
//
// See delta 2 in the header. Tested on the NORMALIZED tag, because the
// catalogue writes the fullwidth `FT５` and normalizeText folds it to `FT5`.
// Anchored at both ends: `Top 8 FT3` names an event and stays one.
export const FORMAT_TAG = /^(?:FT|BO|first\s*to|best\s*of)\s*\d+$/i;
export const isFormatTag = (tag: string): boolean => FORMAT_TAG.test(normalizeText(tag));

// ── video link → (videoId, startSeconds?) ───────────────────────────────────
//
// THE LINKS ARE CONCATENATED, NOT BUILT. The submission form does
// `video_link = base + "&t=" + t + "s"` regardless of what `base` looks like, so
// a youtu.be submission produces `https://youtu.be/<id>&t=554s`: a PATH with no
// query string at all. 443 of this catalogue's links are that shape. A
// URL-parsing extractor reads the id as "abcdefghijk&t=554s"; this matches the
// id SHAPE explicitly and refuses anything else rather than guessing.
export const VIDEO_ID =
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/(?:live|shorts|embed)\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/;
// GLOBAL, and the LAST match wins. The form appends its own offset last, so an
// earlier `t=` is whatever the submitter's clipboard carried in.
const START_ALL = /[?&]t=([^&#]*)/g;
/** Strive's seconds-only reading, kept for the recon line that counts how many
 *  rows it would have dropped. */
const START_SECONDS = /^(\d+)s?$/;
/** Avatar's h/m/s grammar: `26m55s`, `35m`, `1h11m20s`, `2h41m`, and plain
 *  seconds. A superset of START_SECONDS, so it is the only grammar read. */
const START_HMS = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/;

/**
 * One `t=` value in seconds, or null when it is not readable. A `t=` we cannot
 * read is NOT the same as no `t=`: falling through to "whole video" would
 * publish a three-hour VOD as one set and render exactly like a correct
 * record, so the row is dropped as a bad link instead.
 *
 * The all-optional h/m/s form matches the EMPTY string with every group
 * undefined, which would silently read `t=` as offset 0; hence the explicit
 * "at least one group" test.
 */
export function offsetSeconds(value: string): number | null {
  const v = value.trim();
  if (v === '') return null;
  const m = START_HMS.exec(v);
  if (!m || (m[1] === undefined && m[2] === undefined && m[3] === undefined)) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

export interface Link {
  videoId: string;
  /** Absent when the entry carried no `t=`. PRESENT AND ZERO when the link
   *  states `t=0`, which Strive throws away: a t=0 row inside a multi-row VOD
   *  is a segment at zero (delta 3). Whether an offset makes the row a segment
   *  is decided by isSegmentEntry, where the rows-per-video count exists. */
  startSeconds?: number;
  /** How many `t=` params the link carried; >1 is worth seeing in recon. */
  tCount: number;
}

export function parseLink(link: string): Link | { error: string } {
  const id = VIDEO_ID.exec(link ?? '');
  if (!id) return { error: 'no extractable YouTube id' };
  const values = [...(link ?? '').matchAll(START_ALL)].map((m) => m[1] ?? '');
  if (values.length === 0) return { videoId: id[1]!, tCount: 0 };
  const last = values[values.length - 1]!;
  const secs = offsetSeconds(last);
  if (secs === null) return { error: `unreadable t= value ${JSON.stringify(last)}` };
  return { videoId: id[1]!, startSeconds: secs, tCount: values.length };
}

/**
 * THE INTRO-SKIP FLOOR (checklist 12k): on a video the catalogue lists ONCE, an
 * offset is a SEGMENT only when it is at least this share of the VOD. Below it
 * the offset is a submitter skipping the intro of a whole upload, and a `vid@N`
 * id would mint a segment for a video that is not a clip of itself, one that
 * can never dedupe against the same upload arriving from a channel.
 *
 * THE VALUE IS AVATAR'S, NOT MEASURED HERE. Avatar's populations did not touch
 * (26 intro skips at 5-51 s, one at 13.1%, the real single-row segments at 50%
 * and 56%) and 0.2 sits in its gap. This catalogue has the same shape (page 269
 * alone, read 2026-09-29, holds single-row `t=1s`, `t=2s`, `t=3s` and `t=5s` on
 * whole uploads), but its distribution has not been hydrated, so the recon
 * prints the share histogram of every single-row offset on each full sweep.
 * Re-set this from the first one if the gap is somewhere else.
 */
export const INTRO_SKIP_MIN_SHARE = 0.2;

/**
 * IS THIS ROW A SEGMENT? (checklist 12b, with 12k's floor.) Avatar's rule:
 * no offset is the whole video; EVERY row of a multi-row video is a segment,
 * t=0 included; a single-row offset is a segment only at or above the floor.
 * Exported so a gate can exercise both sides of the rule without a pull.
 */
export function isSegmentEntry(
  rowsForVideo: number,
  startSeconds: number | undefined,
  durationSec: number,
  minShare = INTRO_SKIP_MIN_SHARE,
): boolean {
  if (startSeconds === undefined) return false;
  if (rowsForVideo > 1) return true;
  if (startSeconds <= 0 || durationSec <= 0) return false;
  return startSeconds / durationSec >= minShare;
}

/** THE RECORD ID FOLLOWS THE ENTRY. `vid@start` for a segment, the bare video
 *  id otherwise. Both arms are load-bearing: `vid@0` for a whole video could
 *  never dedupe against the same upload arriving from a channel, and a bare id
 *  for a segment would collapse a VOD's sets into one record. */
const recId = (videoId: string, isSegment: boolean, start: number | undefined): string =>
  isSegment ? `${videoId}@${start}` : videoId;

/** A side's declared fighters, in slot order, blanks dropped, TRIMMED AND
 *  OTHERWISE VERBATIM (delta 5: `Gran (EX)` stays `Gran (EX)`). Four columns
 *  are read and the length is OBSERVED, never assumed: a second column is a
 *  counter-pick inside the set, which is where the catalogue splits rows. */
const chars = (e: TheaterEntry, side: 1 | 2): string[] =>
  ([`p${side}_char`, `p${side}_char2`, `p${side}_char3`, `p${side}_char4`] as const)
    .map((k) => (e as unknown as Record<string, unknown>)[k])
    .filter((c): c is string => typeof c === 'string' && c.trim() !== '')
    .map((c) => c.trim());

const videoIdOf = (e: TheaterEntry): string | undefined =>
  VIDEO_ID.exec(e.video_link ?? '')?.[1] ?? undefined;

// ── A VIDEO ARRIVES WHOLE (Avatar's completeVideos) ─────────────────────────
//
// With the intro-skip floor and the t=0 rule, the record id is no longer a
// property of a ROW: it depends on how many of the video's rows are in the
// dump. The cursor gate can cut a video's rows in half, and a half-delivered
// video mints the wrong id shape (Avatar's live specimen: a 1,722 s set split
// at a counter-pick, whose second row alone reads as a 15% single-row offset
// and becomes the bare video id beside the committed `@0` segment). So when
// the delta touches a video, it takes every row of that video the read WINDOW
// holds. Bounded by the data, a no-op on a quiet morning, and the companions
// are counted separately so the 12g "newer than the cursor" figure stays
// honest.
//
// Kept here rather than in theater-delta.ts, which is Strive's file unchanged.
//
// WHAT IT CANNOT PROMISE: a video's rows beyond the pages this run read, and a
// video whose FIRST row was committed on an earlier morning as a single-row
// whole video before its second row existed. Under add-only both are late or
// doubled, never lost; a --full sweep rebuilds the id shapes from the whole
// catalogue.
export function completeVideos<T extends { id?: number | null }>(
  delta: T[],
  window: T[],
  videoOf: (e: T) => string | undefined,
): { entries: T[]; companions: number; videos: number } {
  const touched = new Set<string>();
  for (const e of delta) {
    const v = videoOf(e);
    if (v) touched.add(v);
  }
  if (touched.size === 0) return { entries: delta, companions: 0, videos: 0 };
  const have = new Set(delta.map((e) => e.id).filter((id): id is number => typeof id === 'number'));
  const added: T[] = [];
  const grew = new Set<string>();
  for (const e of window) {
    const v = videoOf(e);
    if (!v || !touched.has(v)) continue;
    if (typeof e.id !== 'number' || have.has(e.id)) continue;
    have.add(e.id);
    added.push(e);
    grew.add(v);
  }
  return {
    entries: added.length ? [...delta, ...added] : delta,
    companions: added.length,
    videos: grew.size,
  };
}

// ── chapters, derived from the description (RECON ONLY) ────────────────────
//
// This produces no field and gates nothing. It re-runs the trust measurement
// the intake was admitted on (the catalogue's offsets against the uploaders'
// own chapter markers) on every pull. The rule YouTube applies: timestamped
// lines, at least three, the first at 0:00.
const CHAPTER_LINE =
  /^\s*(?:\[|\()?(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\]|\))?\s*[-–—:|]?\s*(.+?)\s*$/;

export interface Chapter {
  start: number;
  title: string;
}

export function chaptersOf(description: string): Chapter[] {
  const out: Chapter[] = [];
  for (const line of (description ?? '').split('\n')) {
    const m = CHAPTER_LINE.exec(line);
    if (!m) continue;
    const [, a, b, c, title] = m;
    const start = c ? Number(a) * 3600 + Number(b) * 60 + Number(c) : Number(a) * 60 + Number(b);
    if (title?.trim()) out.push({ start, title: title.trim() });
  }
  if (out.length < 3 || out[0]!.start !== 0) return [];
  return out.sort((x, y) => x.start - y.start);
}

// ── PARTIAL RESUME ──────────────────────────────────────────────────────────
//
// A 478-page sweep has to be interruptible, and a resumed sweep has to produce
// THE SAME DUMP an uninterrupted one would, byte for byte, or the resume is a
// second source of truth. Three things make that hold:
//
//   1. The cache is the raw pages as served, keyed by entry id and by page
//      number. Resuming re-fetches page 1 (the cursor bound and total_count
//      live there) and then only the pages not yet cached.
//   2. Nothing downstream depends on READ ORDER. The catalogue is sorted by
//      entry id before any processing, every tie-break below is total, and the
//      dump carries no timestamp, no view count and no per-process counter.
//   3. `pagesRead` in the stats and the witness is the number of pages the dump
//      is DRAWN FROM (cached + fetched); `pagesFetched` is this process's.
//
// WHAT A PAGE-NUMBER CACHE CANNOT PROMISE, stated rather than hidden. The
// catalogue grows at the FRONT, so between two halves every cached page shifts
// down by however many entries arrived: re-reads at the seam, nothing lost. A
// DELETION upstream between the halves shifts entries UP, and up to that many
// can slide from the first unread page onto the last cached one, where this run
// will not look. Under add-only that is late, never lost, and the stats say
// `resumed: true` so a stitched sweep is never mistaken for a clean one. A
// completed full sweep deletes the cache.
//
// The cache is REFUSED, not merely ignored, when it was cut for a different
// slug or game label: a sibling once resumed a cache from an era when the
// endpoint returned everything and wrote another game's rows into its witness.
interface PartialCache {
  slug: string;
  gameLabel: string;
  /** The newest id on page 1 when the cache was cut, for the log. */
  newestOnPage1: number;
  pages: number[];
  entries: TheaterEntry[];
}

const byTheaterId = new Map<number, TheaterEntry>();
const seenPages = new Set<number>();
let cacheNewestOnPage1 = 0;
let walking = false;

const cacheShape = (): PartialCache => ({
  slug: INDEX.slug,
  gameLabel: INDEX.gameLabel,
  newestOnPage1: cacheNewestOnPage1,
  pages: [...seenPages].sort((a, b) => a - b),
  entries: [...byTheaterId.entries()].sort((a, b) => a[0] - b[0]).map(([, e]) => e),
});

const flushCache = (): void => {
  writeFileSync(PARTIAL, JSON.stringify(cacheShape()), 'utf8');
};

// ── the pull ────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  // BEFORE ANYTHING IS DELETED. Strive calls requireApiKey at module scope,
  // which kills any script that merely imports the module and, because the
  // removals below run first, would destroy a good dump over a missing
  // environment variable.
  requireApiKey('data:theater');
  const LIMIT = parseLimit();

  await mkdir(RAW_DIR, { recursive: true });

  // Flush the resume cache on interrupt, synchronously, then exit with the
  // conventional code. A SIGKILL cannot be caught and loses at most
  // CACHE_EVERY_PAGES - 1 pages. Registered HERE rather than at module scope so
  // importing this file installs no signal handlers in somebody else's process.
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, () => {
      if (FULL && walking) {
        flushCache();
        console.error(
          `\n  interrupted by ${sig} — cached ${seenPages.size} page(s), ${byTheaterId.size} entr(ies). ` +
            `Resume with: npm run data:theater -- --full`,
        );
      }
      process.exit(sig === 'SIGINT' ? 130 : 143);
    });
  }

  // CLEAR THE PREVIOUS RUN'S ARTIFACTS BEFORE FETCHING ANYTHING. parse reads
  // the stats file to learn what this pull did (its mode, its page count, the
  // cursor it reached), and a file left over from yesterday would answer those
  // questions about the wrong run. The dump goes too, so a failed local pull
  // looks exactly like a failed CI pull (rule 2: no dump).
  await rm(STATS, { force: true });
  await rm(WITNESS, { force: true });
  await rm(OUT, { force: true });

  if (ENDPOINT !== INDEX.endpoint) {
    console.warn(
      `  ⚠ REPLAY_THEATER_ENDPOINT is set — reading ${ENDPOINT}, not the live catalogue`,
    );
  }

  // THE CURSOR. Entry ids increase with submission and the feed is newest-first
  // by upload date, so "have I seen everything new?" is answerable from the
  // front of the feed: keep paging until CLEAN_PAGES_TO_STOP consecutive pages
  // offer no id above the cursor. There is no `?since=`: only `game` and `page`
  // are honoured, and `game` takes the catalogue's token (`gbvs`), not ours.
  //
  // WHAT THE CURSOR CANNOT SEE, stated rather than hidden: the ordering key is
  // the VIDEO's upload date, not the submission's. Someone submitting a 2024 VOD
  // today lands deep in the feed, behind the bound. Under add-only that is late,
  // never lost: the entry keeps its id and a --full sweep collects it.
  const cursorFile = await readFile(CURSOR, 'utf8')
    .then((t) => JSON.parse(t) as Record<string, number>)
    .catch(() => ({}) as Record<string, number>);
  const cursorAt = Number(cursorFile[CH.id] ?? 0) || 0;

  let resumed = false;
  if (FRESH) {
    await rm(PARTIAL, { force: true });
  } else if (FULL && existsSync(PARTIAL)) {
    const cache = JSON.parse(await readFile(PARTIAL, 'utf8')) as Partial<PartialCache>;
    if (cache.slug !== INDEX.slug || cache.gameLabel !== INDEX.gameLabel) {
      console.warn(
        `  ⚠ ignoring raw/.replayTheater.partial.json: cut for game=${JSON.stringify(cache.slug)} ` +
          `${JSON.stringify(cache.gameLabel)}, this run is game=${INDEX.slug} ${JSON.stringify(INDEX.gameLabel)}`,
      );
      await rm(PARTIAL, { force: true });
    } else {
      for (const p of cache.pages ?? []) if (Number.isInteger(p) && p >= 1) seenPages.add(p);
      for (const e of cache.entries ?? []) if (typeof e.id === 'number') byTheaterId.set(e.id, e);
      cacheNewestOnPage1 = Number(cache.newestOnPage1 ?? 0) || 0;
      resumed = seenPages.size > 0;
      if (resumed) {
        console.log(
          `  resuming a partial sweep: ${seenPages.size} page(s), ${byTheaterId.size} entr(ies) cached`,
        );
      }
    }
  } else if (CURSOR_MODE && existsSync(PARTIAL)) {
    console.log(
      '  (a partial full-sweep cache is present and untouched by this cursor run; ' +
        '`--full` resumes it, `--fresh` discards it)',
    );
  }

  console.log(`\n▶ Pulling the Replay Theater index (${ENDPOINT}, game=${INDEX.slug})…`);
  const first = await getPage(1);

  // ── THE CURSOR CANNOT BE AHEAD OF THE CATALOGUE (checklist 12f) ───────────
  // Page 1 holds the newest entries, so the highest id ON IT is the highest id
  // the catalogue has. A committed cursor above that is not "nothing new today":
  // it is impossible, and it is SILENT. Every page reads as clean, the stop
  // rule fires after two, and this intake never ingests another entry for as
  // long as the file says so, with the cron green the whole time.
  //
  // REFUSE RATHER THAN CLAMP, AND RATHER THAN FALL BACK. A warning plus a full
  // sweep cannot heal, because parse only writes the cursor forward and a real
  // sweep's highest id is never above the poisoned one: that is a 478-page sweep
  // every morning forever, visible only as a console.warn inside a step already
  // expected to be yellow. Clamping hides which entries were skipped. Red until
  // a human fixes the file, on the daily path AND on --full, because --full is
  // exactly the run that would otherwise mask it.
  const newestOnPage1 = (first.matches ?? []).reduce((m, e) => Math.max(m, e.id ?? 0), 0);
  if (cursorAt > 0 && newestOnPage1 > 0 && cursorAt > newestOnPage1) {
    console.error(
      [
        `\n✖ The committed cursor is AHEAD of the catalogue.`,
        ``,
        `  data/theater-cursor.json  ${cursorAt}`,
        `  newest id on page 1       ${newestOnPage1}`,
        ``,
        `  Page 1 is the newest entries, so nothing in the catalogue can be above it.`,
        `  Left alone this is silent: every page reads as already-seen, the pull stops`,
        `  after two, and this intake never ingests again while the file says so.`,
        ``,
        `  Set data/theater-cursor.json to the highest id this repo has actually SEEN`,
        `  (the maxEntryId of its last full sweep) and re-run. If in doubt, 0 is`,
        `  always safe: a full sweep re-reads everything and the intake is add-only.`,
      ].join('\n'),
    );
    process.exit(1);
  }
  if (resumed && cacheNewestOnPage1 > 0 && cacheNewestOnPage1 !== newestOnPage1) {
    console.log(
      `  the catalogue moved since the cache was cut (page-1 newest ${cacheNewestOnPage1} → ${newestOnPage1}); ` +
        `pages re-read at the seam, and a deletion in between stays invisible until --fresh`,
    );
  }
  cacheNewestOnPage1 = newestOnPage1;

  const total = Number(first.total_count ?? 0) || 0;
  const fullPages = Math.ceil(total / INDEX.pageSize);
  const pages = CURSOR_MODE
    ? Math.min(CURSOR_MAX_PAGES, fullPages, LIMIT)
    : Math.min(fullPages, LIMIT);
  console.log(
    CURSOR_MODE
      ? `  catalogue reports ${total} entr(ies) (${fullPages} page(s) of ${INDEX.pageSize}); cursor at entry id ${cursorAt || '—'}, reading at most ${pages}`
      : `  catalogue reports ${total} entr(ies) → ${pages} of ${fullPages} page(s) of ${INDEX.pageSize}`,
  );
  let noId = 0;
  const add = (rows: TheaterEntry[]): void => {
    for (const e of rows) {
      if (typeof e.id === 'number') byTheaterId.set(e.id, e);
      else noId++;
    }
  };
  add(first.matches ?? []);
  seenPages.add(1);

  // cleanRun is SEEDED FROM PAGE 1: a fully quiet morning is two pages, which
  // is the number the stop rule was argued for, not three.
  let cleanRun = (first.matches ?? []).some((e) => (e.id ?? 0) > cursorAt) ? 0 : 1;
  let pagesFetched = 1;
  let stoppedEarly = false;
  walking = true;
  for (let page = 2; page <= pages; page++) {
    if (CURSOR_MODE && cleanRun >= CLEAN_PAGES_TO_STOP) {
      stoppedEarly = true;
      break;
    }
    if (seenPages.has(page)) continue;
    await sleep(INDEX.pacingMs);
    const body = await getPage(page);
    const rows = body.matches ?? [];
    add(rows);
    seenPages.add(page);
    pagesFetched++;
    cleanRun = rows.some((e) => (e.id ?? 0) > cursorAt) ? 0 : cleanRun + 1;
    // An empty page is the end of the catalogue, not a clean page to count.
    if (rows.length === 0) {
      stoppedEarly = true;
      break;
    }
    if (FULL && (page % CACHE_EVERY_PAGES === 0 || page % 50 === 0)) {
      flushCache();
      if (page % 50 === 0) console.log(`  page ${page}/${pages} — ${byTheaterId.size} entr(ies)`);
    }
  }
  walking = false;
  if (CURSOR_MODE && cleanRun >= CLEAN_PAGES_TO_STOP) stoppedEarly = true;
  // Checkpoint once more at the END of the walk: the join below spends API
  // units and the signal handler only flushes while walking, so an interrupt or
  // a quota refusal during the join would otherwise resume with re-reads. A
  // completed sweep still retires the cache at the very end.
  if (FULL) flushCache();

  // ── a PARTIAL sweep stops here, with the cache and without a dump ─────────
  // A truncated full sweep written as a dump would be a lie in either mode
  // label: as `full`, parse would read every committed row it does not contain
  // as vanished upstream; as `cursor`, the delta gate would apply to a window it
  // was never meant for. So --limit on the full path is a checkpoint, not a
  // deliverable. Exit 0: the run did what it was asked.
  if (FULL && pages < fullPages && !stoppedEarly) {
    flushCache();
    console.log(
      `\n  partial sweep: ${seenPages.size} of ${fullPages} page(s) cached (${byTheaterId.size} entr(ies)), no dump written.\n` +
        `  Resume with: npm run data:theater -- --full`,
    );
    return;
  }

  // EVERYTHING BELOW IS ORDER-INDEPENDENT. Sorted by the catalogue's own entry
  // id, a total order that does not depend on which pages were cached and which
  // were fetched, so a resumed sweep and a clean one process identical
  // sequences.
  const catalogue = [...byTheaterId.values()].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  /** The highest id THIS RUN observed, PRE-GAME-GATE and PRE-RISING-GATE: the
   *  cursor is a position in the feed and a refused row it passed was still
   *  passed. parse writes it into the cursor file when it is above the
   *  committed value (on the PULL, never on the rebuild). */
  const highestId = catalogue.reduce((m, e) => Math.max(m, e.id ?? 0), 0);
  /** Seeded with the committed cursor so a bounded window cannot report a value
   *  below it. This is the field parse reads. */
  const maxEntryId = Math.max(highestId, cursorAt);
  const hitBound = CURSOR_MODE && !stoppedEarly && pagesFetched >= pages && fullPages > pages;
  console.log(
    CURSOR_MODE
      ? `  read ${pagesFetched} page(s), ${catalogue.length} entr(ies); ${catalogue.filter((e) => (e.id ?? 0) > cursorAt).length} newer than the cursor → new cursor ${maxEntryId}`
      : `  ${catalogue.length} unique entr(ies) over ${seenPages.size} page(s)${resumed ? ` (${pagesFetched} fetched this run, the rest resumed)` : ''}`,
  );
  if (noId)
    console.log(
      `  ⚠ ${noId} row(s) carried no entry id and were dropped — not resumable, not cursorable`,
    );
  if (hitBound) {
    console.warn(
      `  ⚠ the cursor hit its ${pages}-page bound without going quiet — entries may be\n` +
        `    unreached this run. Nothing is lost (add-only); run \`npm run data:theater -- --full\`\n` +
        `    to reconcile. Recorded as hitCursorBound in the stats file.`,
    );
  }

  // ── the game gate, PER ENTRY (checklist 12a) ──────────────────────────────
  // `?game=gbvs` is a query someone else answers, and a mistagged submission
  // arrives looking exactly like a real one. Every entry states its own game,
  // so check that instead of the query, exactly, against the committed label.
  // NECESSARY, NOT SUFFICIENT: on this catalogue the label is the same for both
  // games (delta 1), and the Rising gate below is what separates them.
  const wrongGame = catalogue.filter((e) => (e.game ?? '').trim() !== INDEX.gameLabel);
  const rightGame = catalogue.filter((e) => (e.game ?? '').trim() === INDEX.gameLabel);
  if (wrongGame.length) {
    console.log(
      `  ⚠ ${wrongGame.length} entr(ies) rejected — entry.game is not ${JSON.stringify(INDEX.gameLabel)}:`,
    );
    for (const e of wrongGame.slice(0, 5)) {
      console.log(`      #${e.id} game=${JSON.stringify(e.game)} ${e.video_link ?? ''}`);
    }
    if (wrongGame.length > 5) console.log(`      … ${wrongGame.length - 5} more`);
  }

  // ── the Rising PRE-gate, on the catalogue's own upload_date ───────────────
  // BEFORE the delta, the completion and the join: nothing refused here is ever
  // hydrated. See "THE RISING GATE" above for why a day of slack and why an
  // unreadable date is let through to the confirm.
  const preGated = rightGame.filter((e) => preRisingByUploadDate(e.upload_date, INDEX.admitFrom));
  const risingWindow = rightGame.filter(
    (e) => !preRisingByUploadDate(e.upload_date, INDEX.admitFrom),
  );
  const unreadableDates = risingWindow.filter((e) => !ISO_DAY.test((e.upload_date ?? '').trim()));

  // ── scope: IN CURSOR MODE, ONLY WHAT IS NEWER THAN THE CURSOR (12g) ───────
  // See theater-delta.ts. The walk window is fixed-size whether or not anything
  // in it is new; an ungated dump makes the intake's reported number a function
  // of the walk length.
  const delta = newerThanCursor(risingWindow, CURSOR_MODE, cursorAt);

  // ── scope: WHICH ARMS ENTER THE INTAKE, read off the config ───────────────
  // `admitUntagged` (channels.ts) decides whether the untagged arm is a SOURCE
  // here or only a witness. It gates what gets BUILT and nothing else; the
  // witness holds both arms regardless. With it true, parse's known-anywhere
  // ignore is what keeps the untagged arm from re-minting our own uploads (the
  // dominant channel's uploads are re-indexed the same day, 96.5%). The arm is
  // the catalogue's own tag column: a format tag is still the tagged arm (the
  // submitter filled the column), it just never becomes an event.
  const isTagged = (e: TheaterEntry): boolean => (e.tag ?? '').trim() !== '';
  const armed = INDEX.admitUntagged ? delta : delta.filter(isTagged);
  const completion = completeVideos(
    armed,
    INDEX.admitUntagged ? risingWindow : risingWindow.filter(isTagged),
    videoIdOf,
  );
  const inScope = [...completion.entries].sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  const taggedInDelta = delta.filter(isTagged).length;
  console.log(
    `  ${preGated.length} entr(ies) refused before hydration by the Rising pre-gate ` +
      `(upload_date before ${shiftDay(INDEX.admitFrom, -PRE_GATE_SLACK_DAYS)}); ${risingWindow.length} left`,
  );
  console.log(
    `  ${delta.length} entr(ies)${CURSOR_MODE ? ` newer than the cursor, of ${risingWindow.length} read` : ''}: ` +
      `${taggedInDelta} tagged, ${delta.length - taggedInDelta} untagged` +
      (INDEX.admitUntagged
        ? ' — both arms admitted (admitUntagged)'
        : ` — untagged arm is witness only (admitUntagged: false)`),
  );
  if (completion.companions) {
    console.log(
      `  + ${completion.companions} companion row(s) across ${completion.videos} video(s) the delta ` +
        `touched — the record id depends on rows-per-video, so a video arrives whole`,
    );
  }

  // ── links ─────────────────────────────────────────────────────────────────
  // COUNTED, NOT FATAL. A bad link costs its own row and nothing else; the
  // count is in the stats file and five examples are in the log. The malformed
  // youtu.be shape (443 rows) is READ, which is the point of matching the id by
  // shape rather than parsing a URL.
  const linked: Array<{ e: TheaterEntry; link: Link }> = [];
  const badLinks: Array<{ e: TheaterEntry; why: string }> = [];
  for (const e of inScope) {
    const got = parseLink(e.video_link ?? '');
    if ('error' in got) badLinks.push({ e, why: got.error });
    else linked.push({ e, link: got });
  }
  if (badLinks.length) {
    console.log(
      `  ⚠ ${badLinks.length} entr(ies) have an unusable video link — dropped, not guessed:`,
    );
    for (const u of badLinks.slice(0, 5)) {
      console.log(`      #${u.e.id} ${u.why} — ${JSON.stringify(u.e.video_link)}`);
    }
    if (badLinks.length > 5) console.log(`      … ${badLinks.length - 5} more`);
  }

  // ── join to the VODs (checklist 12h) ──────────────────────────────────────
  // LIVENESS IS THIS JOIN. videos.list silently omits a deleted or private id,
  // so absence from the map IS the dead signal: no HEAD, no oEmbed. Reported as
  // a RATE (with its shape by upload month in the stats), never enumerated.
  const vodIds = [...new Set(linked.map((l) => l.link.videoId))].sort();
  const hydrating = new Set(vodIds);
  const preGatedVideos = new Set(
    preGated.map(videoIdOf).filter((v): v is string => !!v && !hydrating.has(v)),
  );
  console.log(
    `\n▶ Resolving ${vodIds.length} video(s) on YouTube — ${Math.ceil(vodIds.length / 50)} quota unit(s) ` +
      `(1 per 50; the key is shared with seven production crons). The pre-gate kept ` +
      `${preGatedVideos.size} pre-Rising video(s) out of the call (~${Math.ceil(preGatedVideos.size / 50)} unit(s)).`,
  );
  const vods = await fetchVideoMeta(vodIds);
  const missing = vodIds.filter((id) => !vods.has(id));

  // ── the Rising CONFIRM, on the hydrated publishedAt (the authority) ───────
  const confirmRefused = new Set(
    vodIds.filter((id) => {
      const v = vods.get(id);
      return !!v && !risingByPublishedAt(v.publishedAt, INDEX.admitFrom);
    }),
  );
  const preRisingByPublishedAt = linked.filter((l) => confirmRefused.has(l.link.videoId)).length;
  if (confirmRefused.size) {
    console.log(
      `  ${preRisingByPublishedAt} row(s) over ${confirmRefused.size} video(s) refused by the Rising confirm ` +
        `— the VOD was published before ${INDEX.admitFrom}`,
    );
  }
  /** Rising-era videos this run can speak for: alive and confirmed, or dead
   *  (a dead video has no publishedAt; its era was decided by the pre-gate). */
  const risingVideos = vodIds.filter((id) => !confirmRefused.has(id));
  const unresolvablePct = risingVideos.length
    ? Number(((missing.length / risingVideos.length) * 100).toFixed(1))
    : 0;

  // ── candidates: resolved, Rising, and inside their own VOD ────────────────
  interface Candidate {
    e: TheaterEntry;
    link: Link;
    vod: VideoMeta;
  }
  const candidates: Candidate[] = [];
  /** Offsets past the end of their own VOD: counted and dropped, never fatal. */
  const pastEnd: string[] = [];
  for (const { e, link } of linked) {
    const vod = vods.get(link.videoId);
    if (!vod) continue; // dead: counted above and by month below, never built
    if (confirmRefused.has(link.videoId)) continue; // the original game
    // AN OFFSET PAST THE END OF ITS OWN VOD IS NOT A SET. The last place both
    // numbers are in scope: a segment record carries `durationSec: 0`, so from
    // here on nothing downstream can compare them. It also fails safe for the
    // h/m/s grammar: `1h11m20s` read right is 4,280 s, and this check is the only
    // thing bounding it. Counted and dropped, never fatal: upstream data errors
    // are a standing condition of a third-party catalogue.
    if (
      link.startSeconds !== undefined &&
      vod.durationSec > 0 &&
      link.startSeconds >= vod.durationSec
    ) {
      pastEnd.push(
        `${link.videoId}@${link.startSeconds} — RT #${e.id}, but the VOD runs ${vod.durationSec}s`,
      );
      continue;
    }
    candidates.push({ e, link, vod });
  }
  if (pastEnd.length) {
    console.log(
      `  ⚠ ${pastEnd.length} offset(s) start past the end of their own VOD — dropped, not published:`,
    );
    for (const l of pastEnd.slice(0, 5)) console.log(`      ${l}`);
    if (pastEnd.length > 5) console.log(`      … ${pastEnd.length - 5} more`);
  }

  // ── the same moment, submitted twice ──────────────────────────────────────
  //
  // THE KEY IS (videoId, startSeconds), NOT THE RECORD ID, and that follows
  // from the segment rule (Avatar's reasoning): the id needs the rows-per-video
  // count, which needs the deduplicated set. Keying on the physical moment
  // breaks the circle, and it is the stronger key anyway.
  //
  // A group whose entries describe the same set is a double submission and
  // collapses deterministically (tag spelling, then ENTRY ID, so a resumed
  // sweep collapses the way a clean one does). A group that does not is a
  // genuine upstream data error, two different sets at one moment: the lower
  // entry id survives and the rest are COUNTED, NEVER FATAL. Measured
  // 2026-09-29: 11 composite collisions, 9 of them with different content.
  // Refusing 23,000 rows every morning over nine would be the wrong trade.
  const byMoment = new Map<string, Candidate[]>();
  for (const c of candidates) {
    const key = `${c.link.videoId} @${c.link.startSeconds ?? '-'}`;
    byMoment.set(key, [...(byMoment.get(key) ?? []), c]);
  }
  const matchKey = (e: TheaterEntry): string =>
    JSON.stringify([
      (e.p1_name ?? '').trim(),
      (e.p2_name ?? '').trim(),
      chars(e, 1).join('/'),
      chars(e, 2).join('/'),
    ]);
  const deduped: Candidate[] = [];
  const collapsedTags = new Map<string, number>();
  let collapsed = 0;
  const collisions: string[] = [];
  for (const [key, group] of byMoment) {
    if (group.length === 1) {
      deduped.push(group[0]!);
      continue;
    }
    const sorted = [...group].sort(
      (a, b) =>
        (a.e.tag ?? '').trim().localeCompare((b.e.tag ?? '').trim()) ||
        (a.e.id ?? 0) - (b.e.id ?? 0),
    );
    if (group.every((g) => matchKey(g.e) === matchKey(group[0]!.e))) {
      deduped.push(sorted[0]!);
      collapsed += group.length - 1;
      const pair = [...new Set(group.map((g) => (g.e.tag ?? '').trim()))].sort().join('  ||  ');
      collapsedTags.set(pair, (collapsedTags.get(pair) ?? 0) + group.length - 1);
      continue;
    }
    collisions.push(
      [
        `  ${key}`,
        ...sorted.map(
          (g) => `    #${g.e.id}  ${g.e.p1_name} vs ${g.e.p2_name}  [${(g.e.tag ?? '').trim()}]`,
        ),
      ].join('\n'),
    );
    deduped.push([...group].sort((a, b) => (a.e.id ?? 0) - (b.e.id ?? 0))[0]!);
  }
  if (collapsed > 0) {
    console.log(`\n  collapsed ${collapsed} double-submitted entr(ies) — same moment, same set:`);
    for (const [pair, n] of [...collapsedTags].sort((a, b) => b[1] - a[1]).slice(0, 10)) {
      console.log(`      ${n}×  ${pair || '(untagged)'}`);
    }
  }
  if (collisions.length) {
    console.log(
      `\n  ⚠ ${collisions.length} collision(s) the collapse cannot explain — two different sets at one ` +
        `(video, offset); the lower entry id survives, the rest are counted:`,
    );
    console.log(collisions.slice(0, 5).join('\n'));
    if (collisions.length > 5) console.log(`      … ${collisions.length - 5} more`);
  }

  // ── rows per video, and only then the id ──────────────────────────────────
  // Counted over the SURVIVORS, the rows this file is about to write, so a
  // double-submitted single-row video cannot read as multi-row.
  const rowsPerVideo = new Map<string, number>();
  for (const c of deduped) {
    rowsPerVideo.set(c.link.videoId, (rowsPerVideo.get(c.link.videoId) ?? 0) + 1);
  }

  const records: TheaterRawRecord[] = [];
  const seenIds = new Set<string>();
  const formatSpellings = new Map<string, number>();
  for (const { e, link, vod } of deduped) {
    const isSegment = isSegmentEntry(
      rowsPerVideo.get(link.videoId) ?? 1,
      link.startSeconds,
      vod.durationSec,
    );
    const id = recId(link.videoId, isSegment, link.startSeconds);
    if (seenIds.has(id)) {
      // Unreachable by construction: the moment key above is unique and the id
      // is a function of it. An invariant, not a counter. If it fires, the id
      // rule and the moment key have drifted apart; no dump, parse carries.
      throw new Error(
        `Two rows resolved to record id ${JSON.stringify(id)} (entry #${e.id}). The (videoId, ` +
          `startSeconds) key is supposed to make that impossible. Nothing written.`,
      );
    }
    seenIds.add(id);

    const c1 = chars(e, 1);
    const c2 = chars(e, 2);
    // TRIMMED, AND OTHERWISE VERBATIM. parse puts the tag through the title's
    // normalizer (12j) and strips sponsor prefixes from the handles; a dump that
    // rewrote them could not be audited against the catalogue. Placeholder
    // handles pass through untouched: dropping them is parse's rule.
    //
    // THE ONE EXCEPTION IS A SET FORMAT (delta 2): it leaves `tag` empty, so it
    // can never reach Replay.event, and keeps its spelling in `rawTag`.
    // `rawTag` is present exactly when that happened.
    const rawCell = String(e.tag ?? '').trim();
    const format = rawCell !== '' && isFormatTag(rawCell);
    const tag = format ? '' : rawCell;
    if (format) {
      const k = normalizeText(rawCell).toUpperCase().replace(/\s+/g, '');
      formatSpellings.set(k, (formatSpellings.get(k) ?? 0) + 1);
    }
    const p1 = String(e.p1_name ?? '').trim();
    const p2 = String(e.p2_name ?? '').trim();
    records.push({
      id,
      channel: 'replayTheater',
      // SYNTHESIZED: the catalogue carries no title. It follows this corpus's
      // handle-outside grammar (the slot order channels.ts declares for this
      // intake) so cards read consistently, and it carries the tag in the
      // trailing slot because `title` is the engine's search haystack. A set
      // format rides there too (a person may search "FT5"); the title is not the
      // event field, and the event field never sees it.
      title:
        `GBVSR ▰ ${p1 || '?'} (${c1.join('/')}) vs ${p2 || '?'} (${c2.join('/')})` +
        (rawCell ? ` ▰ ${rawCell}` : ''),
      description: '',
      // The VOD's real publish time. Deliberately NOT offset by startSeconds:
      // that could cross a day-grained patch boundary, which is the authority
      // season and patch are derived from. Segments inside one VOD therefore
      // share a timestamp, which is why the sort below carries a tie-break.
      publishedAt: vod.publishedAt,
      // The catalogue publishes no per-set duration. For a whole-video entry
      // the video's own duration IS the record's; for a segment there is
      // nothing honest to derive one from, so 0 means unknown (Strive's rule;
      // the id is decided HERE, so parse never needs the VOD's length).
      durationSec: isSegment ? 0 : vod.durationSec,
      // The VOD's own value, not a constant: an entry pointing at a stream that
      // is still live is footage parse should exclude, and 'none' would hide it.
      liveBroadcastContent: vod.liveBroadcastContent,
      theaterId: e.id!,
      videoId: link.videoId,
      // PRESENT EXACTLY WHEN THE RECORD IS A SEGMENT, 0 included (a t=0 row in a
      // multi-row VOD), so `id === videoId@startSeconds` whenever it is set. An
      // intro-skip offset on a whole video is DROPPED: the record is the whole
      // upload and its id is the bare video id.
      ...(isSegment ? { startSeconds: link.startSeconds! } : {}),
      tag,
      ...(format ? { rawTag: rawCell } : {}),
      uploader: vod.uploader,
      players: [p1, p2],
      characters: [c1, c2],
    });
  }

  // Stable, TOTAL order: newest VOD first, then by offset within the VOD, then
  // by id. A comparator without the final tie-break would be free to return a
  // different permutation per run.
  records.sort(
    (a, b) =>
      b.publishedAt.localeCompare(a.publishedAt) ||
      (a.startSeconds ?? 0) - (b.startSeconds ?? 0) ||
      a.id.localeCompare(b.id),
  );

  const preRising = preGated.length + preRisingByPublishedAt;

  // ── the floor, on a FULL sweep only ───────────────────────────────────────
  // A cursor run's dump is a DELTA and is legitimately tiny; parse merges it and
  // add-only does the protecting. A FULL sweep claims to be the whole catalogue,
  // so a collapse in it is a claim that most of the catalogue is gone. The day
  // the label is respelled upstream, `rightGame` is 0 and a fetcher without
  // this check writes `[]` over a good dump; the day the Rising gate misreads a
  // date, every row is "pre-Rising". Refuse here, where the cause is visible.
  if (FULL) {
    const pins = await readFile(PINS, 'utf8')
      .then((t) => JSON.parse(t) as Record<string, number>)
      .catch(() => ({}) as Record<string, number>);
    const pinned = Number(pins[CH.id] ?? 0) || 0;
    if (pinned > 0 && records.length < pinned * 0.9) {
      console.error(
        [
          `\n✖ A full sweep produced ${records.length} record(s) against a committed pin of ${pinned}.`,
          `  That is a claim that ${pinned - records.length} sets left the catalogue at once.`,
          ``,
          `  The likeliest cause is not deletion. Every entry is checked against`,
          `  gameLabel ${JSON.stringify(INDEX.gameLabel)}, and ${wrongGame.length} of ${catalogue.length} entr(ies) failed that check`,
          `  this run; the Rising gate refused ${preRising} more (admitFrom ${INDEX.admitFrom}). If the`,
          `  catalogue respelled the game or its dates, every row fails and this file`,
          `  would be overwritten with almost nothing. The other cause is the YouTube`,
          `  join: ${missing.length} of ${vodIds.length} video(s) did not resolve this run.`,
          ``,
          `  Refusing to write. The committed records are untouched and the cron`,
          `  carries them exactly as it does on a day this never ran.`,
          `  If the drop is real: npm run data:theater -- --full --allow-shrink`,
        ].join('\n'),
      );
      if (!ALLOW_SHRINK) process.exit(1);
      console.error('  --allow-shrink given: writing anyway.');
    }
  }

  await writeFile(OUT, JSON.stringify(records) + '\n', 'utf8');

  // ── the witness (checklist 12i) ───────────────────────────────────────────
  // EVERY entry of the read window, tagged and untagged, in the catalogue's own
  // shape, NOT cursor-gated: the cross-check compares whatever the window holds
  // against whatever we hold, and the delta gate is about what gets BUILT.
  //
  // BEHIND BOTH GATES. The label gate, because the witness feeds a comparison
  // whose whole claim is that it is reading THIS game; the Rising gate for the
  // same reason, because on this catalogue the label does not say which game
  // (delta 1). The pre-gate applies to every window row; the confirm applies
  // where this run hydrated the VOD.
  //
  // Plus the uploader of every VOD this run hydrated, so crosscheck.ts can say
  // how much of its reach sits on channels we do not intake (12i: measure the
  // independence before banking the number).
  const witnessEntries = risingWindow.filter((e) => {
    const v = videoIdOf(e);
    return !(v && confirmRefused.has(v));
  });
  const witnessVideos: Record<
    string,
    { uploader: string; channelId: string; publishedAt: string }
  > = {};
  for (const id of risingVideos) {
    const v = vods.get(id);
    if (v)
      witnessVideos[id] = {
        uploader: v.uploader,
        channelId: v.channelId,
        publishedAt: v.publishedAt,
      };
  }
  await writeFile(
    WITNESS,
    JSON.stringify({
      mode: CURSOR_MODE ? 'cursor' : 'full',
      maxEntryId,
      pagesRead: seenPages.size,
      hitBound,
      entries: witnessEntries,
      videos: witnessVideos,
    }) + '\n',
    'utf8',
  );

  // ── liveness, as a RATE with its shape (12h) ──────────────────────────────
  // Over the Rising-era rows this run joined: alive-and-confirmed plus dead. A
  // dead video has no publishedAt, so its month is the catalogue's upload_date,
  // the only date a dead row still has.
  const liveRows = linked.filter((l) => !confirmRefused.has(l.link.videoId));
  const isDead = (l: { link: Link }): boolean => !vods.has(l.link.videoId);
  const deadRows = liveRows.filter(isDead).length;
  const deadByMonth: Record<string, { rows: number; dead: number }> = {};
  const deadByYear: Record<string, { rows: number; dead: number }> = {};
  for (const l of liveRows) {
    const day = ISO_DAY.exec((l.e.upload_date ?? '').trim())?.[1];
    const month = day ? day.slice(0, 7) : 'unknown';
    const year = day ? day.slice(0, 4) : 'unknown';
    const dead = isDead(l) ? 1 : 0;
    deadByMonth[month] = {
      rows: (deadByMonth[month]?.rows ?? 0) + 1,
      dead: (deadByMonth[month]?.dead ?? 0) + dead,
    };
    deadByYear[year] = {
      rows: (deadByYear[year]?.rows ?? 0) + 1,
      dead: (deadByYear[year]?.dead ?? 0) + dead,
    };
  }
  const sortKeys = <T>(o: Record<string, T>): Record<string, T> =>
    Object.fromEntries(Object.entries(o).sort((a, b) => a[0].localeCompare(b[0])));
  // BY RT-ID ADJACENCY: a dead row's nearest live neighbours in entry-id order
  // (submissions are batched, so a deleted stretch sits inside its channel's
  // own block). Attributed only when both neighbours, or the only one at an
  // edge, come from the same channel.
  const byId = [...liveRows].sort((a, b) => (a.e.id ?? 0) - (b.e.id ?? 0));
  const deadAttribution = new Map<string, number>();
  for (let i = 0; i < byId.length; i++) {
    if (!isDead(byId[i]!)) continue;
    let lo: VideoMeta | undefined;
    let hi: VideoMeta | undefined;
    for (let j = i - 1; j >= 0 && !lo; j--) lo = vods.get(byId[j]!.link.videoId);
    for (let j = i + 1; j < byId.length && !hi; j++) hi = vods.get(byId[j]!.link.videoId);
    const who =
      lo && hi
        ? lo.channelId === hi.channelId
          ? lo.uploader
          : '(unattributed: neighbours disagree)'
        : ((lo ?? hi)?.uploader ?? '(unattributed: no live neighbour)');
    deadAttribution.set(who, (deadAttribution.get(who) ?? 0) + 1);
  }
  const deadAttributionTop = Object.fromEntries(
    [...deadAttribution].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8),
  );

  // ── the segment decision, broken out (12k) ────────────────────────────────
  const singleRowOffsets = deduped.filter(
    ({ link }) =>
      (rowsPerVideo.get(link.videoId) ?? 1) === 1 &&
      link.startSeconds !== undefined &&
      link.startSeconds > 0,
  );
  const introSkips = singleRowOffsets.filter(
    ({ link, vod }) => !isSegmentEntry(1, link.startSeconds, vod.durationSec),
  );
  const zeroInMulti = deduped.filter(
    ({ link }) => (rowsPerVideo.get(link.videoId) ?? 1) > 1 && link.startSeconds === 0,
  ).length;
  const noOffsetInMulti = deduped.filter(
    ({ link }) => (rowsPerVideo.get(link.videoId) ?? 1) > 1 && link.startSeconds === undefined,
  ).length;

  const segments = records.filter((r) => r.startSeconds !== undefined).length;
  const tagged = records.filter((r) => r.tag !== '').length;
  const formatTagged = records.filter((r) => r.rawTag !== undefined).length;
  const placeholderSides = records.reduce(
    (n, r) => n + r.players.filter((p) => isPlaceholderHandle(p)).length,
    0,
  );
  const catalogueSides = (rows: TheaterEntry[]): number =>
    rows.reduce(
      (n, e) =>
        n +
        [e.p1_name, e.p2_name].filter((h) => typeof h === 'string' && isPlaceholderHandle(h))
          .length,
      0,
    );
  const EX_LABEL = /(?<![\p{L}\p{N}])EX(?![\p{L}\p{N}])/iu;
  const exLabelSides = records.reduce(
    (n, r) => n + r.characters.filter((side) => side.some((c) => EX_LABEL.test(c))).length,
    0,
  );
  const earlyAccessRows = records.filter((r) => r.publishedAt.slice(0, 10) < LAUNCH).length;

  const stats = {
    // ── the shared contract (parse-finish TheaterStats) ─────────────────────
    // THE MODE IS LOAD-BEARING, not a diagnostic: parse reads it to decide
    // whether this dump is the whole catalogue or a delta, which decides whether
    // "committed but absent from the dump" means "vanished upstream" or "simply
    // not in the pages we read".
    mode: CURSOR_MODE ? 'cursor' : 'full',
    highestId,
    maxEntryId,
    pagesRead: seenPages.size,
    hitCursorBound: hitBound,
    seen: catalogue.length,
    records: records.length,
    /** Dead VIDEOS, and their share of the Rising-era videos this run joined. */
    unresolvable: missing.length,
    unresolvablePct,
    badLinks: badLinks.length,
    collisions: collisions.length,
    wrongGame: wrongGame.length,
    // ── beyond the contract: for the log, the report and the gates ──────────
    // The Rising gate (delta 1).
    preRising,
    preRisingByUploadDate: preGated.length,
    preRisingByPublishedAt,
    preRisingVideosNeverHydrated: preGatedVideos.size,
    unreadableUploadDates: unreadableDates.length,
    admitFrom: INDEX.admitFrom,
    // Liveness, as rates with a shape (delta 6). Rising-era rows only.
    deadRows,
    deadRowsPct: Number(pct(deadRows, liveRows.length)),
    deadByYear: sortKeys(deadByYear),
    deadByMonth: sortKeys(deadByMonth),
    deadAttribution: deadAttributionTop,
    // Offsets and ids (delta 3).
    pastEnd: pastEnd.length,
    segments,
    wholeVideos: records.length - segments,
    introSkips: introSkips.length,
    introSkipMinShare: INTRO_SKIP_MIN_SHARE,
    zeroInMulti,
    noOffsetInMulti,
    // Tags (delta 2). `tagged` is the EVENT arm only; a format is its own
    // count, under the name parse-finish's TheaterStats reads.
    tagged,
    setFormatTags: formatTagged,
    formatTagSpellings: sortKeys(Object.fromEntries(formatSpellings)),
    untagged: records.length - tagged - formatTagged,
    // Handles and labels (deltas 4 and 5).
    placeholderSides,
    exLabelSides,
    earlyAccessRows,
    // The walk.
    cursorAt,
    totalReported: total,
    fullPages,
    pagesFetched,
    resumed,
    noId,
    rightGame: rightGame.length,
    risingWindow: risingWindow.length,
    delta: delta.length,
    companions: completion.companions,
    companionVideos: completion.videos,
    admitUntagged: INDEX.admitUntagged,
    inScope: inScope.length,
    videos: vodIds.length,
    quotaUnits: QUOTA.units,
    collapsed,
    collapsedTags: Object.fromEntries([...collapsedTags].sort((a, b) => a[0].localeCompare(b[0]))),
  };
  await writeFile(STATS, JSON.stringify(stats, null, 2) + '\n', 'utf8');

  // A completed FULL sweep retires its cache: the cursor is the daily resume
  // mechanism, and two that disagree would be worse than one. A cursor run
  // leaves a partial cache alone; it belongs to a sweep somebody is driving.
  if (FULL && existsSync(PARTIAL)) await rm(PARTIAL, { force: true });

  console.log(
    `\n✓ raw/replayTheater.json — ${records.length} record(s)${CURSOR_MODE ? ', a delta' : ''} ` +
      `(${tagged} event-tagged, ${formatTagged} set-format-tagged, ${records.length - tagged - formatTagged} untagged; ` +
      `${segments} segment(s), ${records.length - segments} whole video(s))`,
  );
  console.log(
    `  → raw/replayTheater.witness.json (${witnessEntries.length} of ${catalogue.length} catalogue entr(ies), ` +
      `this game and the Rising era, ${seenPages.size} page(s), ${Object.keys(witnessVideos).length} VOD(s))`,
  );
  console.log(
    `  Rising gate: ${preRising} row(s) refused — ${preGated.length} on upload_date before hydration, ` +
      `${preRisingByPublishedAt} on the hydrated publishedAt; ${unreadableDates.length} row(s) with no ` +
      `readable upload_date were hydrated and decided on publishedAt`,
  );
  console.log(
    `  ${missing.length}/${risingVideos.length} Rising-era video(s) no longer resolve (${unresolvablePct}%), ` +
      `${deadRows}/${liveRows.length} row(s) (${pct(deadRows, liveRows.length)}%) — dropped, not published` +
      (CURSOR_MODE
        ? '. A cursor window is all recent rows and reads ~0% forever; only a --full sweep sees the' +
          ' Nov 2024–Jul 2025 deletion window'
        : ''),
  );
  console.log(
    `  YouTube quota spent by this run: ${QUOTA.units} unit(s) in ${QUOTA.calls} call(s).`,
  );

  // ── reconnaissance ────────────────────────────────────────────────────────
  console.log(`\n${'█'.repeat(72)}`);
  console.log('  RECON — nothing below gates anything; it is what the pull learned.');
  console.log('█'.repeat(72));

  const perVod = new Map<string, TheaterRawRecord[]>();
  for (const r of records) perVod.set(r.videoId, [...(perVod.get(r.videoId) ?? []), r]);
  const shared = records.filter((r) => (perVod.get(r.videoId)?.length ?? 0) > 1).length;
  const counts = [...perVod.values()].map((v) => v.length).sort((a, b) => b - a);
  console.log(`\n  records / source VODs:                 ${records.length} / ${perVod.size}`);
  console.log(
    `  a set inside a shared VOD:             ${shared} (${pct(shared, records.length)}%), max ${counts[0] ?? 0} per VOD, median ${counts[Math.floor(counts.length / 2)] ?? 0}`,
  );
  console.log(
    `  distinct event tags:                   ${new Set(records.filter((r) => r.tag).map((r) => r.tag)).size}`,
  );
  console.log(
    `  set-format tags (tag '' + rawTag):     ${formatTagged} — ${
      [...formatSpellings]
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${k} ${n}`)
        .join(' · ') || 'none'
    } (FT5 alone was 732 rows on 2026-09-29)`,
  );

  // THE RISING GATE'S OWN ERROR BOUND. The pre-gate trusts upload_date; the
  // only rows it could wrongly refuse are ones whose catalogue date runs EARLY
  // by more than the slack. Measured on every row this run hydrated.
  let sameDay = 0;
  let withinOne = 0;
  let early = 0;
  let late = 0;
  let compared = 0;
  for (const { e, vod } of candidates) {
    const d = ISO_DAY.exec((e.upload_date ?? '').trim())?.[1];
    if (!d) continue;
    compared++;
    const gap =
      (Date.parse(`${d}T00:00:00Z`) - Date.parse(`${vod.publishedAt.slice(0, 10)}T00:00:00Z`)) /
      86_400_000;
    if (gap === 0) sameDay++;
    if (Math.abs(gap) <= PRE_GATE_SLACK_DAYS) withinOne++;
    else if (gap < 0) early++;
    else late++;
  }
  console.log(
    `\n  upload_date vs the VOD's publishedAt:  ${compared} hydrated row(s) — ${sameDay} same day ` +
      `(${pct(sameDay, compared)}%), ${withinOne} within the ${PRE_GATE_SLACK_DAYS}-day slack, ${early} EARLY by more ` +
      `(the only class the pre-gate could wrongly refuse, and only near ${INDEX.admitFrom}), ${late} late`,
  );
  console.log(
    `  pre-Rising rows, pre-gate / confirm:   ${preGated.length} / ${preRisingByPublishedAt} ` +
      `(10,459 of 23,894 rows were the original game on 2026-09-29)`,
  );
  console.log(
    `  early-access rows (before ${LAUNCH}): ${earlyAccessRows} — admitted from ${INDEX.admitFrom}`,
  );

  // THE SEGMENT DECISION, BROKEN OUT: the numbers checklist 12k exists for.
  const shares = singleRowOffsets
    .filter(({ vod }) => vod.durationSec > 0)
    .map(({ link, vod }) => link.startSeconds! / vod.durationSec);
  const bucket = (lo: number, hi: number) => shares.filter((s) => s >= lo && s < hi).length;
  console.log(
    `\n  single-row offsets, share of the VOD:  ${shares.length} — <5% ${bucket(0, 0.05)} · 5-10% ` +
      `${bucket(0.05, 0.1)} · 10-20% ${bucket(0.1, 0.2)} · 20-50% ${bucket(0.2, 0.5)} · ≥50% ${bucket(0.5, Infinity)}`,
  );
  console.log(
    `  → INTRO SKIPS (whole video, bare id):  ${introSkips.length} under ${(INTRO_SKIP_MIN_SHARE * 100).toFixed(0)}% ` +
      `(Avatar's floor, unmeasured here: re-set it if the histogram's gap is elsewhere)`,
  );
  console.log(
    `  t=0 rows inside a MULTI-row VOD:       ${zeroInMulti} — each a SEGMENT at zero, vid@0 (104 on 2026-09-29)`,
  );
  console.log(
    `  no-offset rows inside a multi-row VOD: ${noOffsetInMulti} — kept as the whole video (bare id); a count to watch`,
  );

  const malformed = deduped.filter(({ e }) => {
    const s = e.video_link ?? '';
    if (!s.includes('youtu.be/')) return false;
    const tail = s.split('youtu.be/')[1] ?? '';
    return tail.includes('&t=') && !tail.includes('?');
  }).length;
  const multiT = deduped.filter(({ link }) => link.tCount > 1).length;
  const hmsRows = deduped.filter(({ e }) => {
    const vals = [...(e.video_link ?? '').matchAll(START_ALL)].map((m) => m[1] ?? '');
    const last = vals[vals.length - 1];
    return last !== undefined && last.trim() !== '' && !START_SECONDS.test(last.trim());
  }).length;
  console.log(
    `\n  concatenated youtu.be/<id>&t=Ns links: ${malformed} (${pct(malformed, deduped.length)}%) — 443 on 2026-09-29`,
  );
  console.log(`  links carrying more than one t=:       ${multiT} (last one wins)`);
  console.log(
    `  offsets in h/m/s rather than seconds:  ${hmsRows} — Strive's /^(\\d+)s?$/ would drop each as a bad link (0 on 2026-09-29)`,
  );

  // The catalogue's own hygiene, so the parse-side rules stay measured.
  const IDEOGRAPHIC_SPACE = String.fromCodePoint(0x3000);
  const tagUntrimmed = witnessEntries.filter(
    (e) => typeof e.tag === 'string' && e.tag !== e.tag.trim(),
  ).length;
  const u3000 = witnessEntries.filter((e) =>
    [e.tag, e.p1_name, e.p2_name].some(
      (s) => typeof s === 'string' && s.includes(IDEOGRAPHIC_SPACE),
    ),
  ).length;
  console.log(`\n  tags with leading/trailing whitespace: ${tagUntrimmed} (trimmed in the dump)`);
  console.log(
    `  rows with U+3000 in tag or a handle:   ${u3000} (kept; normalizeText folds it downstream)`,
  );
  console.log(
    `  placeholder handles (sides):           ${placeholderSides} of ${records.length * 2} in the dump — passed through, parse ` +
      `drops them; a one-symbol handle is not one (12k)`,
  );
  console.log(
    `  ... over the catalogue read:           ${catalogueSides(rightGame)} side(s) in both games, ` +
      `${catalogueSides(witnessEntries)} in the Rising era (5,057 / ~10 on 2026-09-29)`,
  );
  console.log(
    `  sides labelled EX:                     ${exLabelSides} — carried verbatim (\`Gran (EX)\`); parse reads the mark`,
  );

  // Character labels through the roster's own exact matcher: what parse will
  // resolve and what it will count as unresolved. Recon only, so a missing or
  // unreadable roster never fails a pull that has already written its dump.
  try {
    const matcher = buildAliasMatcher(await loadCharacters());
    const unresolved = new Map<string, number>();
    let exMarked = 0;
    for (const r of records) {
      for (const side of r.characters) {
        for (const label of side) {
          const hit = exactAliasWithMark(matcher, label);
          if (!hit) unresolved.set(label, (unresolved.get(label) ?? 0) + 1);
          else if (hit.ex) exMarked++;
        }
      }
    }
    const top = [...unresolved].sort((a, b) => b[1] - a[1]).slice(0, 8);
    console.log(
      `  character labels, exact alias:         ${exMarked} resolve WITH an EX mark; ${[...unresolved.values()].reduce((n, x) => n + x, 0)} ` +
        `unresolved${top.length ? `: ${top.map(([k, n]) => `${JSON.stringify(k)} ${n}`).join(' · ')}` : ''}`,
    );
  } catch (err) {
    console.log(`  character labels: not checked (${err instanceof Error ? err.message : err})`);
  }

  const dates = records.map((r) => r.publishedAt.slice(0, 10)).sort();
  console.log(
    `  VOD publish dates:                     ${dates[0] ?? '—'} → ${dates[dates.length - 1] ?? '—'}`,
  );

  // LIVENESS, WITH ITS SHAPE. Months with at least one dead row, then the
  // adjacency attribution.
  const deadMonths = Object.entries(sortKeys(deadByMonth)).filter(([, v]) => v.dead > 0);
  console.log(
    `\n  dead rows by upload month:             ${
      deadMonths.map(([k, v]) => `${k} ${v.dead}/${v.rows}`).join(' · ') || 'none'
    }`,
  );
  console.log(
    `    (2026-09-29: 681 Rising-era dead rows, 0-1 a month to 2024-10, 71-97 a month Nov 2024–Jul 2025, 0 since)`,
  );
  if (deadAttribution.size) {
    console.log(
      `  dead rows by RT-id adjacency:          ${Object.entries(deadAttributionTop)
        .map(([k, n]) => `${k} ${n}`)
        .join(' · ')}`,
    );
  }

  // SETS, NOT MATCHES. A side with ≥2 characters is a counter-pick inside the
  // row, which is the only place the catalogue splits a set; the gap between
  // consecutive different-pair rows on one VOD is the set length.
  const occ = new Map<number, number>();
  let sides = 0;
  let multi = 0;
  for (const r of records)
    for (const side of r.characters) {
      occ.set(side.length, (occ.get(side.length) ?? 0) + 1);
      sides++;
      if (side.length > 1) multi++;
    }
  const pairKey = (r: TheaterRawRecord): string =>
    r.players
      .map((p) => aliasKey(stripTheaterSponsor(p)))
      .sort()
      .join('|');
  const gaps: number[] = [];
  for (const rows of perVod.values()) {
    const segs = rows
      .filter((r) => r.startSeconds !== undefined)
      .sort((a, b) => a.startSeconds! - b.startSeconds!);
    for (let i = 1; i < segs.length; i++) {
      if (pairKey(segs[i]!) === pairKey(segs[i - 1]!)) continue;
      gaps.push(segs[i]!.startSeconds! - segs[i - 1]!.startSeconds!);
    }
  }
  console.log(
    `\n  characters per side: ${[...occ.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([k, n]) => `${k}→${n}`)
      .join(' · ')} — counter-pick rate ${pct(multi, sides)}%`,
  );
  console.log(
    `  consecutive different-pair rows on a VOD: median ${median(gaps) ?? '—'} s apart over ${gaps.length} gap(s) ` +
      `— SETS, not matches (573 s on 2026-09-29)`,
  );

  // ── trust, re-measured every pull ─────────────────────────────────────────
  let inChapter = 0;
  let exact = 0;
  let within30 = 0;
  let vsChapters = 0;
  let namesAgreeRaw = 0;
  let namesAgreeStripped = 0;
  let chaptered = 0;
  for (const [id, meta] of vods) {
    const cs = chaptersOf(meta.description);
    if (!cs.length) continue;
    chaptered++;
    for (const r of perVod.get(id) ?? []) {
      if (r.startSeconds === undefined) continue;
      let hit: Chapter | undefined;
      for (const c of cs) {
        if (c.start <= r.startSeconds) hit = c;
        else break;
      }
      if (!hit) continue;
      inChapter++;
      const d = r.startSeconds - hit.start;
      if (d === 0) exact++;
      if (Math.abs(d) <= 30) within30++;
      // Condition on the chapter naming a MATCHUP, not on a name having already
      // hit: the looser denominator silently excludes total disagreement.
      if (/\bvs\.?\b/i.test(hit.title)) {
        vsChapters++;
        const t = aliasKey(hit.title);
        const [r1, r2] = r.players.map(aliasKey);
        if (r1 && r2 && t.includes(r1) && t.includes(r2)) namesAgreeRaw++;
        const [s1, s2] = r.players.map((p) => aliasKey(stripTheaterSponsor(p)));
        if (s1 && s2 && t.includes(s1) && t.includes(s2)) namesAgreeStripped++;
      }
    }
  }
  console.log(`\n  VODs carrying a chapter list: ${chaptered}/${vods.size}`);
  console.log(
    `  offsets inside a chapter:     ${inChapter} — ${within30} within 30s (${pct(within30, inChapter)}%), ${exact} exact (${pct(exact, inChapter)}%)`,
  );
  console.log(
    `  chapters naming a matchup:    ${vsChapters} — both handles agree ${namesAgreeRaw} raw (${pct(namesAgreeRaw, vsChapters)}%), ` +
      `${namesAgreeStripped} sponsor-stripped (${pct(namesAgreeStripped, vsChapters)}%)`,
  );
  console.log(`  segments with no chapter to check against: ${segments - inChapter}`);

  const uploaders = new Map<string, number>();
  for (const r of records) uploaders.set(r.uploader, (uploaders.get(r.uploader) ?? 0) + 1);
  console.log(`\n  source VOD uploaders (${uploaders.size}):`);
  for (const [u, n] of [...uploaders.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`      ${String(n).padStart(5)}  ${u}`);
  }

  console.log('\n  Next: npm run data:parse');
}

// isMain, not a bare call: the rule helpers above are exported so a gate can
// exercise them without a pull, and importing this module must not start one.
const entry = process.argv[1];
const isMain = !!entry && import.meta.url.endsWith(entry.split('/').pop() ?? '');
if (isMain) {
  main().catch((err: unknown) => {
    if (err instanceof QuotaRefusal) {
      // A REFUSAL ENDS THE RUN, it does not start a retry ladder. The key is
      // shared with seven production crons and the intake is allowed to fail:
      // no dump, parse carries, the cron stays green.
      console.error(`\n✖ ${err.message}`);
      console.error('  No dump written. parse will carry the committed records unchanged.');
      process.exit(1);
    }
    throw err;
  });
}
