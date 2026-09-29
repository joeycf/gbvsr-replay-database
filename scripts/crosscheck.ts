// THE SECOND WITNESS, as a pure predicate.
//
// Strive's module (ggst-replay-database/scripts/crosscheck.ts), exported names
// and signatures unchanged because scripts/parse-finish.ts calls them the
// Strive way. What changes is what the numbers MEAN on this catalogue, and four
// rules measured on it. Every figure below is from the full sweep of
// 2026-09-29 (23,894 entries, 15,458 videos) unless it says otherwise.
//
// ── WHAT THIS MEASURES, AND WHY ON THIS GAME IT IS NOT A TRUST NUMBER ───────
// Replay Theater's `gbvs` catalogue re-indexes the dominant channel's uploads:
// 96.5% of that channel's uploads are in the catalogue THE SAME DAY they go up.
// Those rows are the overlap this module compares, the catalogue's handles and
// characters against our parse of the uploader's title, and on that overlap
// the witness is NEAR-DEPENDENT, close to tautological (checklist 12i). The
// submitter almost certainly read the same title our parser did, on the same
// day. Agreement there is a consistency check on two readers of one title,
// never verification against the footage, and the report says so instead of
// banking a percentage. Disagreement keeps its full value: two readers of one
// title who differ have found a title at least one of them misread.
//
// The catalogue's genuinely INDEPENDENT reach is where it is the only reader:
// ~1,643 tagged Rising rows (tournament VODs no intake channel uploads) plus
// ~300 untagged Rising rows on channels this repo does not intake. On those
// rows the catalogue is a SOURCE, not a witness. The intake builds the records
// from them, so there is nothing of ours to compare them against. The
// comparison population below is therefore the dependent part BY
// CONSTRUCTION. `independence` counts both sides of that split on every full
// sweep so the claim is re-measured rather than remembered.
//
// ── ONE LABEL, TWO GAMES ────────────────────────────────────────────────────
// Every row reads `game: "Granblue Fantasy: Versus"`, including the 10,459
// rows (43.8%) from 2019-12 to 2023-11 that are the ORIGINAL game. The witness
// file this module reads is written by scripts/fetch-theater.ts BEHIND the
// Rising gate (ChannelIndex.admitFrom), so none of them reach the comparison.
// Left in, they would land in `unmatched` (we never hold an old-game video)
// and inflate the reach denominator by a game this archive does not cover.
//
// ── IT PRODUCES NO FIELD AND OVERWRITES NOTHING ─────────────────────────────
// A disagreement is written to data/theater-disagreements.json with both
// claims side by side. It never edits a record, never outranks a confident
// parse, and never outranks a human override. NOT data/review-queue.json: that
// queue means WITHHELD, and a contested row is a record we have already
// published and are not proposing to unpublish on a third party's say-so.
//
// ── THE THIRD OUTCOME IS THE POINT ──────────────────────────────────────────
// agree / disagree is not enough, because a witness that CANNOT REPRESENT the
// answer is not disagreeing with it. Anything the catalogue could not have said
// is counted as `cannotWitness`, in three named parts. The vocabulary gap is
// DERIVED FROM THE DATA, never declared (Tekken's rule, ported whole via
// Strive). Today it derives nothing here: the catalogue's label typos
// (`Cgliostro`, `Lucillius`, `Meterra`, `Zoeey`) are roster aliases already
// (data/characters.json), so they resolve rather than read as a blind spot.
//
// ── THE PLACEHOLDER HANDLE, AND THE ONE-SYMBOL HANDLE THAT IS NOT ONE ───────
// 5,057 sides read `Unknown Player` over the whole catalogue, but only ~10 of
// them are in the Rising era: the placeholder is an original-game habit, and
// the Rising gate refuses almost all of it before this module sees a row.
// Those ~10 are a witness that declined to name the player, not one that named
// a different one, so they are held out as `players.placeholder`, never scored
// as a miss. The characters on that row are still witnessed.
//
// Checklist 12k: a REAL handle can be a single symbol. Avatar met `♱` (U+2671)
// as an entire handle, written by the uploader in its own title, and Strive's
// all-punctuation alternative deleted it. The predicate below keeps Strive's
// spellings and exempts exactly one Other_Symbol codepoint (see
// PLACEHOLDER_HANDLE).
//
// ── EXACT ALIAS, NEVER FUZZY, AND THE EX MARK ───────────────────────────────
// A catalogue string resolves only when the roster matcher finds EXACTLY ONE
// alias span and that span covers the entire normalised string. `matcher.one()`
// alone is a scan that would read "Gran Player" as Gran, and a witness that
// guesses is not a witness. Going through buildAliasMatcher rather than a
// second table means the witness and the parser share one vocabulary and one
// normalisation.
//
// THE ONE DECORATION ALLOWED IS THE EX MARK. Ver 2.20 (2025-08-04) added an EX
// mode for Gran, Djeeta and Narmaya, and the catalogue writes it as a label
// suffix: `Gran (EX)`, `Djeeta (EX)`, `Narmaya (EX)` (244 rows, roster.ts). The
// strict whole-string rule reads every one of those as unresolvable, which
// would cost parse every EX side and put 244 rows into this module's
// `unreadable` bucket for no reason. So exactAlias accepts an EX token
// ATTACHED to its one span (roster.ts findExTokens: immediately before, or a
// bracketed/bare EX immediately after) and nothing else. Whether the mark is
// VALID (one of the three fighters, on or after `exSince`) is parse's
// decision, not this module's. `exactAliasWithMark` returns the mark for it.
//
// ── CASE-ONLY HANDLE COLLISIONS ─────────────────────────────────────────────
// 274 handle groups differ only by case (`Koyao`/`KOYAO`). The display vote
// happens in parse. Here the identity key is roster.ts playerId, which
// lowercases through normalizeText, so each group is one identity in the
// comparison and the case never scores as a miss.

import { CHANNELS } from './channels';
import { findExTokens, normalizeText, type AliasMatcher } from './roster';
import type { MatchVideo } from '../types/index';

/** One catalogue entry, exactly as the catalogue publishes it. Everything is
 *  nullable: this is someone else's schema and we do not get to assume. */
export interface WitnessEntry {
  id?: number;
  game?: string | null;
  video_link?: string | null;
  tag?: string | null;
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

/** What the pull learned about one VOD it hydrated, carried in the witness so
 *  the independence split can ask whose channel a row sits on. */
export interface WitnessVideo {
  uploader: string;
  channelId: string;
  publishedAt: string;
}

/** raw/replayTheater.witness.json, SF6's envelope, written by
 *  scripts/fetch-theater.ts beside the intake dump. EVERY entry of the read
 *  window that passed the per-entry game gate AND the Rising gate, tagged and
 *  untagged, NOT cursor-gated. Nothing that reads it may build a record. */
export interface WitnessFile {
  mode?: 'cursor' | 'full';
  maxEntryId?: number;
  pagesRead?: number;
  hitBound?: boolean;
  entries?: WitnessEntry[];
  /** The VODs this pull hydrated (the in-scope rows only; on a cursor morning
   *  that is the delta). Absent on a witness from before the field existed. */
  videos?: Record<string, WitnessVideo>;
}

/** One row the cross-check could not settle, carrying BOTH claims. This is what
 *  reaches data/theater-disagreements.json, never a rewritten record. */
export interface Disagreement {
  videoId: string;
  field: 'players' | 'characters';
  /** 0 or 1, in our record's side order. Absent for a whole-record player miss. */
  side?: number;
  ours: string[];
  theirs: string[];
  title: string;
}

/** A roster id the catalogue has no word for, and the id it writes instead.
 *  Derived per run. See the header. */
export interface BlindSpot {
  id: string;
  /** The id the catalogue writes in its place, on `merged` of `sides` sides. */
  mergedInto: string;
  merged: number;
  sides: number;
}

/**
 * HOW MUCH OF THIS WITNESS IS INDEPENDENT (checklist 12i: "measure the
 * independence before banking the number"). Both halves of the split, re-read
 * on every sweep: the dependent overlap that `compared` scores, and the rows
 * where the catalogue is the only reader and therefore a source.
 */
export interface Independence {
  /** Compared rows whose catalogue upload_date is the VOD's own publish day
   *  (UTC), and within one day either way (the catalogue's date carries no
   *  timezone). High means the submitter read the title the day it went up. */
  sameDay: number;
  withinOneDay: number;
  /** Catalogue ROWS on videos we do not hold from a tracked channel, by arm
   *  (a non-empty tag, set formats included, is the tagged arm). */
  unmatchedTagged: number;
  unmatchedUntagged: number;
  /** Of those rows, how many sit on a VOD this pull hydrated... */
  unmatchedHydrated: number;
  /** ...and, of the hydrated ones, how many are uploaded by a channel that is
   *  NOT one of our intakes. The genuinely independent reach. */
  offIntakeTagged: number;
  offIntakeUntagged: number;
}

export interface CrossCheckResult {
  /** Videos where exactly one catalogue entry lines up with one of our
   *  whole-video records from a TRACKED channel. A video the catalogue has cut
   *  into several segments is excluded: those are the intake's own territory
   *  and there is no 1:1 claim to compare against. */
  compared: number;
  /** Catalogue VIDEOS we do not hold as a comparable record. Counted once per
   *  video, not per entry. Not a failure (the intake's own unique contribution
   *  lives here), but the denominator of "reach". */
  unmatched: number;
  /** Videos we hold that the catalogue indexes as several segments. */
  segmented: number;
  players: {
    both: number;
    one: number;
    neither: number;
    flipped: number;
    /** Records where a catalogue side is a placeholder handle, held out of
     *  both/one/neither. both + one + neither + placeholder === compared. */
    placeholder: number;
    /**
     * WHY THE MISSED SIDES MISSED, as three numbers instead of a page of rows.
     * Diagnostic only; nothing here scores anything, because substring matching
     * on handles is precisely the guessing this module refuses.
     *
     * `ours` = our handle CONTAINS theirs: extra text on our side, the shape a
     * rank prefix or a game token leaking into the handle slot takes.
     * `theirs` = their handle contains ours: a team tag THEATER_SPONSOR does not
     * strip yet (`GS | gamera`, `ZSF | Azerate` are stripped today).
     * `unrelated` = neither contains the other. The only bucket worth reading one
     * row at a time.
     */
    handleAffix: { ours: number; theirs: number; unrelated: number };
  };
  characters: {
    sides: number;
    agree: number;
    subset: number;
    disagree: number;
    /** The sum of the three below: sides the catalogue could not have got
     *  right, so scoring them either way would be a lie. */
    cannotWitness: number;
    /** Our side names an id the catalogue has no word for. */
    blindSpot: number;
    /** The catalogue's own string resolves to no roster id, or it said nothing. */
    unreadable: number;
    /** Our side is longer than the catalogue's column count. */
    overCap: number;
  };
  /** The dependence split. See Independence. */
  independence: Independence;
  /** The blind spots this run derived, for the report. */
  blindSpots: BlindSpot[];
  disagreements: Disagreement[];
}

/**
 * data/theater-disagreements.json: the committed home of everything the
 * cross-check knows, written ONLY by a full sweep.
 *
 * WHY THE MEASUREMENT IS COMMITTED RATHER THAN RECOMPUTED INTO report.md EVERY
 * RUN. The witness is rebuilt from scratch on each pull and holds only the pages
 * that pull read, so a cursor morning's window is a few hundred catalogue rows
 * and its numbers differ from yesterday's: a different WINDOW, not a different
 * corpus. Rendering those into report.md would change the file every morning
 * whether or not any RECORD had, which defeats the cron's no-change-no-commit
 * rule and puts a deploy on the calendar every day forever.
 *
 * So: a FULL sweep measures and writes; every run renders report.md from what is
 * committed; a cursor morning prints its own reading to the console and leaves
 * the artifact alone. The block says which sweep it came from by the
 * catalogue's own high-water entry id, which is content, not a clock.
 *
 * THE BLIND SPOTS LIVE HERE TOO: a fact about the catalogue's VOCABULARY
 * outlives the pull that found it, and a two-page morning cannot re-derive one.
 */
export interface WitnessArtifact {
  /** The reading, frozen at the last full sweep. */
  measured?: {
    /** The catalogue's high-water entry id at that sweep. Names the sweep
     *  without a timestamp, so re-rendering it cannot churn the file. */
    atEntryId: number;
    compared: number;
    unmatched: number;
    segmented: number;
    players: CrossCheckResult['players'];
    characters: CrossCheckResult['characters'];
    /** Optional so an artifact written before the field existed still reads.
     *  parse-finish copies it from CrossCheckResult.independence. */
    independence?: Independence;
  };
  /** The last full sweep's derivation, and what a cursor run reads back as its
   *  carried set. See `carriedBlindSpots`. */
  blindSpots: BlindSpot[];
  disagreements: Disagreement[];
}

/** The YouTube id inside a catalogue link. The submission form concatenates
 *  rather than builds (`https://youtu.be/<id>&t=554s` is a PATH with no query
 *  string, 443 of this catalogue's links), so this matches the id SHAPE
 *  explicitly and refuses anything else rather than guessing. Same regex the
 *  intake uses (scripts/fetch-theater.ts). */
const VIDEO_ID =
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/(?:live|shorts|embed)\/)([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])/;

/**
 * A catalogue handle that names nobody. Strive's measured family, unchanged:
 * `<one word> Player` (`Unknown Player`, `GG Player`, `GGplayer`), a bare
 * `Unknown`, `None`, `N/A`, `TBD`, and pure punctuation (`.`, `...`, `|`,
 * `▼▲▼▲…`), which playerId() slugs to '' and parse refuses anyway. One word
 * before "Player", not a phrase: a real handle is free text and a two-word
 * handle ending in "Player" is a person until shown otherwise.
 *
 * THE LEADING LOOKAHEAD IS CHECKLIST 12k. Strive's last alternative,
 * `[^\p{L}\p{N}]*`, matches any all-non-letter string, and a real handle can be
 * ONE SYMBOL: Avatar's `♱` (U+2671, category So) is a player whose uploader
 * wrote it into its own title. A handle that is exactly one Other_Symbol
 * codepoint (optionally with its emoji/text variation selector) is therefore
 * never a placeholder. Only So: ASCII symbols (`|`, `+`, `$`, `^`) are
 * separator and form debris, and a RUN of symbols (`▼▲▼▲`) stays refused, as
 * Strive measured it. The exemption lives INSIDE the pattern, so a caller that
 * tests PLACEHOLDER_HANDLE directly cannot drop the fix by accident.
 *
 * That the one-symbol handle survives here does not make it a record: roster.ts
 * playerId() slugs `♱` to '' (U+2671 is not a letter), so parse refuses the
 * side as unsluggable, a different and correctly-named count. What this rule
 * guarantees is that it is never counted, or witnessed, as "declined to name".
 *
 * Exported so the parser's own drop rule and this witness share ONE definition.
 * Two lists of placeholder spellings would drift the first time either was
 * touched.
 */
export const PLACEHOLDER_HANDLE =
  /^(?!\p{So}\p{Variation_Selector}?$)(?:(?:[\p{L}\p{N}]+\s*)?player|unknown|none|n\/a|tbd|[^\p{L}\p{N}]*)$/iu;
export const isPlaceholderHandle = (handle: string): boolean =>
  PLACEHOLDER_HANDLE.test(normalizeText(handle));

/**
 * Exact resolution of one catalogue character string through the roster's own
 * matcher, plus the EX mark if the label carries one: exactly ONE alias span,
 * and that span plus an EX token attached to it (roster.ts findExTokens) cover
 * the WHOLE normalised string, give or take whitespace and the brackets the
 * token sits in. `Gran (EX)` resolves to gran with `ex: true`; `Cgliostro`
 * resolves through its roster alias; `Gran Player` and `EX` alone do not.
 */
export function exactAliasWithMark(
  matcher: AliasMatcher,
  text: string,
): { id: string; ex: boolean } | undefined {
  const t = normalizeText(text);
  if (t === '') return undefined;
  const spans = matcher.find(t);
  if (spans.length !== 1) return undefined;
  const s = spans[0]!;
  if (s.start === 0 && s.end === t.length) return { id: s.id, ex: false };
  const token = findExTokens(t, spans)[0];
  if (!token) return undefined;
  const lo = Math.min(s.start, token.start);
  const hi = Math.max(s.end, token.end);
  const outside = (t.slice(0, lo) + t.slice(hi)).trim();
  return outside === '' ? { id: s.id, ex: true } : undefined;
}

/**
 * Strive's signature: the roster id, or undefined. EX-tolerant (see the
 * header): the mark is decoration to IDENTITY, so `Narmaya (EX)` is narmaya
 * here, and `exactAliasWithMark` is the call that also reports the mark.
 */
export function exactAlias(matcher: AliasMatcher, text: string): string | undefined {
  return exactAliasWithMark(matcher, text)?.id;
}

/** How many sides an id must be OUR reading of before its absence from the
 *  catalogue counts as a vocabulary gap rather than a coincidence, and how
 *  concentrated the catalogue's alternative has to be. Both are deliberately
 *  blunt: this test only has to separate "said X 330 times out of 331" from
 *  "three scattered sides on a two-page cursor morning". */
const BLIND_SPOT_MIN_SIDES = 10;
const BLIND_SPOT_CONCENTRATION = 0.9;

/** Every channel id this repo intakes, frozen ones included: a row on one of
 *  those uploads is not independent reach even when we hold no record of it. */
const INTAKE_CHANNEL_IDS = new Set(
  CHANNELS.map((c) => c.channelId).filter((id): id is string => !!id),
);

const charsOf = (e: WitnessEntry, side: 1 | 2): string[] =>
  ([`p${side}_char`, `p${side}_char2`, `p${side}_char3`, `p${side}_char4`] as const)
    .map((k) => (e as unknown as Record<string, unknown>)[k])
    .filter((c): c is string => typeof c === 'string' && c.trim() !== '')
    .map((c) => c.trim());

const setEq = (a: string[], b: string[]): boolean => {
  const A = new Set(a);
  const B = new Set(b);
  return A.size === B.size && [...A].every((x) => B.has(x));
};
const subsetOf = (a: string[], b: string[]): boolean => a.every((x) => b.includes(x));

/** Whole days between two ISO dates (their first ten characters), or NaN. */
const dayGap = (a: string, b: string): number =>
  Math.abs(Date.parse(`${a.slice(0, 10)}T00:00:00Z`) - Date.parse(`${b.slice(0, 10)}T00:00:00Z`)) /
  86_400_000;

interface Side {
  /** The player identity key, or [] when the catalogue named nobody. */
  players: string[];
  /** The catalogue's raw handle after sponsor stripping, for the placeholder
   *  test. resolveKey would turn `Unknown Player` into `unknown-player`, a
   *  perfectly good-looking id. */
  handle: string;
  chars: string[];
}
/** One video both sides hold, with the orientation already settled. */
interface Pair {
  videoId: string;
  title: string;
  ours: Side[];
  theirs: Side[];
}

/**
 * @param witness      every entry the pull saw behind both gates, tagged and
 *                     untagged
 * @param committed    our published records
 * @param matcher      the roster's alias matcher (roster.ts buildAliasMatcher,
 *                     the parser's own vocabulary), used EXACTLY: see exactAlias
 * @param resolveKey   the repo's player identity key (roster.ts playerId).
 *                     Lowercases through normalizeText, which is what folds the
 *                     274 case-only handle groups into one identity each
 * @param stripSponsor the catalogue's own handle cleanup (channels.ts
 *                     stripTheaterSponsor), applied to BOTH sides. Ours already
 *                     went through it at parse time and the strip is
 *                     idempotent; applying it here too makes the measurement
 *                     independent of that discipline
 * @param sideCap      how many characters the CATALOGUE can express per side
 *                     (four columns; a side of ours longer than that is one it
 *                     structurally cannot witness)
 * @param carriedBlindSpots
 *                     blind spots this repo has ALREADY derived and committed,
 *                     applied on top of whatever this run can derive for itself.
 *                     The derivation needs BLIND_SPOT_MIN_SIDES sides of
 *                     evidence, and the daily run is a two-page cursor morning
 *                     that cannot supply them. A full sweep is authoritative and
 *                     may retire one; a cursor run can only ADD.
 */
export function crossCheck(
  witness: WitnessFile,
  committed: MatchVideo[],
  matcher: AliasMatcher,
  resolveKey: (h: string) => string,
  stripSponsor: (h: string) => string,
  sideCap = 4,
  carriedBlindSpots: BlindSpot[] = [],
): CrossCheckResult {
  // ONLY WHOLE-VIDEO RECORDS FROM A TRACKED CHANNEL ARE COMPARABLE, and the
  // second half of that sentence is tested on the INTAKE, not on the id. The
  // untagged arm is admitted as a source (channels.ts `admitUntagged`), so many
  // catalogue rows become records under a BARE video id. Excluding by `@` alone
  // would compare every one of those against the row it was built from and
  // report a spotless 100%: the catalogue witnessing itself. The `@` test stays
  // as well, because a segment has no whole-video claim to compare with.
  const ours = new Map<string, MatchVideo>();
  for (const v of committed) {
    if (v.intake === 'replayTheater') continue;
    if (v.id.includes('@')) continue;
    ours.set(v.id, v);
  }

  const entries = witness.entries ?? [];
  const byVideo = new Map<string, WitnessEntry[]>();
  for (const e of entries) {
    const m = VIDEO_ID.exec(e.video_link ?? '');
    if (!m) continue;
    byVideo.set(m[1]!, [...(byVideo.get(m[1]!) ?? []), e]);
  }

  const resolveChar = (c: string): string | undefined => exactAlias(matcher, c);

  // THE CATALOGUE'S WHOLE VOCABULARY, read off the whole pull rather than off
  // the compared subset. A character it names once on a video we do not hold is
  // still a character it can name.
  const spoken = new Set<string>();
  for (const e of entries) {
    for (const side of [1, 2] as const) {
      for (const c of charsOf(e, side)) {
        const id = resolveChar(c);
        if (id !== undefined) spoken.add(id);
      }
    }
  }

  const r: CrossCheckResult = {
    compared: 0,
    unmatched: 0,
    segmented: 0,
    players: {
      both: 0,
      one: 0,
      neither: 0,
      flipped: 0,
      placeholder: 0,
      handleAffix: { ours: 0, theirs: 0, unrelated: 0 },
    },
    characters: {
      sides: 0,
      agree: 0,
      subset: 0,
      disagree: 0,
      cannotWitness: 0,
      blindSpot: 0,
      unreadable: 0,
      overCap: 0,
    },
    independence: {
      sameDay: 0,
      withinOneDay: 0,
      unmatchedTagged: 0,
      unmatchedUntagged: 0,
      unmatchedHydrated: 0,
      offIntakeTagged: 0,
      offIntakeUntagged: 0,
    },
    blindSpots: [],
    disagreements: [],
  };
  const ind = r.independence;
  const isTagged = (e: WitnessEntry): boolean => (e.tag ?? '').trim() !== '';

  // ── pass 1: align, and nothing else ─────────────────────────────────────
  // ORIENTATION FIRST. The catalogue's p1/p2 is the submitter's reading of the
  // screen and ours is the title's; they agree on essentially every row but not
  // by contract, and comparing characters across a swapped pair would
  // manufacture two disagreements out of none. Aligned on the HANDLES.
  //
  // NO NAME SPLITTING. GBVSR is 1v1 and the cell is one player; `|` is a
  // sponsor separator here (channels.ts THEATER_SPONSOR), never a duo one.
  const pairs: Pair[] = [];
  for (const [videoId, list] of byVideo) {
    const mine = ours.get(videoId);
    if (!mine) {
      r.unmatched++;
      // WHERE THE CATALOGUE IS THE ONLY READER. Counted per row, by arm, and
      // split by the uploader wherever this pull hydrated the VOD.
      const vod = witness.videos?.[videoId];
      for (const e of list) {
        const tagged = isTagged(e);
        if (tagged) ind.unmatchedTagged++;
        else ind.unmatchedUntagged++;
        if (!vod) continue;
        ind.unmatchedHydrated++;
        if (INTAKE_CHANNEL_IDS.has(vod.channelId)) continue;
        if (tagged) ind.offIntakeTagged++;
        else ind.offIntakeUntagged++;
      }
      continue;
    }
    // The catalogue cut this VOD into segments. Our record is the whole video,
    // so there is no single claim to compare, and these are the intake's own
    // rows anyway.
    if (list.length > 1) {
      r.segmented++;
      continue;
    }
    const e = list[0]!;
    r.compared++;
    // THE DEPENDENCE, MEASURED ON THE ROWS BEING SCORED.
    const gap = dayGap(e.upload_date ?? '', mine.publishedAt);
    if (gap === 0) ind.sameDay++;
    if (gap <= 1) ind.withinOneDay++;

    const theirSides: Side[] = ([1, 2] as const).map((n) => {
      const handle = stripSponsor(String(e[`p${n}_name`] ?? ''));
      const key = isPlaceholderHandle(handle) ? '' : resolveKey(handle);
      return { players: key ? [key] : [], handle, chars: charsOf(e, n) };
    });
    const ourSides: Side[] = mine.sides.map((s) => {
      const handle = stripSponsor(s.handle);
      const key = resolveKey(handle);
      return { players: key ? [key] : [], handle, chars: s.characters };
    });

    const score = (a: Side[], b: Side[]) =>
      a.reduce((n, s, i) => n + (s.players.some((p) => b[i]!.players.includes(p)) ? 1 : 0), 0);
    const flipped = score(ourSides, [theirSides[1]!, theirSides[0]!]) > score(ourSides, theirSides);
    if (flipped) r.players.flipped++;
    pairs.push({
      videoId,
      title: mine.title,
      ours: ourSides,
      theirs: flipped ? [theirSides[1]!, theirSides[0]!] : theirSides,
    });
  }

  // ── the blind spots, derived ────────────────────────────────────────────
  // Only ids the catalogue never once spoke are candidates; of those, only the
  // ones it consistently REPLACES with a single other id. Condition 1 alone
  // would be unsafe on a thin pull, and it is condition 2 that survives it,
  // because a handful of sides cannot concentrate.
  const chances = new Map<string, number>();
  const instead = new Map<string, Map<string, number>>();
  for (const p of pairs) {
    for (let i = 0; i < 2; i++) {
      const said = p.theirs[i]!.chars.map(resolveChar).filter((x): x is string => x !== undefined);
      for (const c of p.ours[i]!.chars) {
        if (spoken.has(c)) continue;
        chances.set(c, (chances.get(c) ?? 0) + 1);
        const tally = instead.get(c) ?? new Map<string, number>();
        for (const id of said) tally.set(id, (tally.get(id) ?? 0) + 1);
        instead.set(c, tally);
      }
    }
  }
  const blind = new Map<string, BlindSpot>();
  for (const [id, sides] of chances) {
    const top = [...(instead.get(id) ?? new Map<string, number>())].sort((a, b) => b[1] - a[1])[0];
    if (!top) continue;
    if (sides < BLIND_SPOT_MIN_SIDES || top[1] / sides < BLIND_SPOT_CONCENTRATION) continue;
    blind.set(id, { id, mergedInto: top[0], merged: top[1], sides });
  }
  // A cursor pull is ADDITIVE: it keeps every carried blind spot it did not
  // re-derive, because absence of evidence in a hundred entries is not evidence
  // of absence. A FULL sweep has seen the whole catalogue, so what it does not
  // re-derive is genuinely gone and is allowed to lapse.
  if (witness.mode !== 'full') {
    for (const b of carriedBlindSpots) if (!blind.has(b.id)) blind.set(b.id, b);
  }
  r.blindSpots = [...blind.values()].sort((a, b) => b.sides - a.sides || a.id.localeCompare(b.id));

  // ── pass 2: score ───────────────────────────────────────────────────────
  for (const p of pairs) {
    // A PLACEHOLDER SIDE IS A WITNESS THAT DECLINED TO ANSWER. Held out of the
    // player score entirely; the characters below are still compared, because
    // `Unknown Player (Gran)` is a perfectly good character claim.
    const placeholder = p.theirs.some((s) => isPlaceholderHandle(s.handle));
    if (placeholder) {
      r.players.placeholder++;
    } else {
      const hits = p.ours.reduce(
        (n, s, i) => n + (s.players.some((x) => p.theirs[i]!.players.includes(x)) ? 1 : 0),
        0,
      );
      for (let i = 0; i < 2; i++) {
        const mineKey = p.ours[i]!.players[0] ?? '';
        const theirKeys = p.theirs[i]!.players;
        if (theirKeys.includes(mineKey)) continue;
        if (mineKey && theirKeys.some((x) => x !== mineKey && mineKey.includes(x))) {
          r.players.handleAffix.ours++;
        } else if (mineKey && theirKeys.some((x) => x !== mineKey && x.includes(mineKey))) {
          r.players.handleAffix.theirs++;
        } else {
          r.players.handleAffix.unrelated++;
        }
      }
      if (hits === 2) r.players.both++;
      else if (hits === 1) r.players.one++;
      else {
        r.players.neither++;
        r.disagreements.push({
          videoId: p.videoId,
          field: 'players',
          ours: p.ours.flatMap((s) => s.players),
          theirs: p.theirs.flatMap((s) => s.players),
          title: p.title,
        });
      }
    }

    for (let i = 0; i < 2; i++) {
      r.characters.sides++;
      const mineChars = p.ours[i]!.chars;
      // A SIDE OF OURS THE CATALOGUE HAS NO WORD FOR. Checked before anything
      // it said, because it does not matter what it said: it could not have
      // agreed.
      if (mineChars.some((c) => blind.has(c))) {
        r.characters.blindSpot++;
        continue;
      }
      // EXACT ALIAS ONLY. A catalogue string the roster does not know is not a
      // disagreement: it is a witness we cannot read, and guessing at it is how
      // a second witness becomes a second parser.
      const raw = p.theirs[i]!.chars;
      const resolved = raw.map(resolveChar);
      if (raw.length === 0 || resolved.some((x) => x === undefined)) {
        r.characters.unreadable++;
        continue;
      }
      // THE SCHEMA CEILING. The catalogue carries `sideCap` character columns;
      // MatchSide.characters is an ordered union with no such limit.
      if (mineChars.length > sideCap) {
        r.characters.overCap++;
        continue;
      }
      // Character IDENTITY only: `Gran (EX)` and our `gran` with `ex: ['gran']`
      // agree here. Whether the mark is right is parse's question.
      const theirChars = resolved as string[];
      if (setEq(mineChars, theirChars)) r.characters.agree++;
      else if (subsetOf(mineChars, theirChars) || subsetOf(theirChars, mineChars))
        r.characters.subset++;
      else {
        r.characters.disagree++;
        r.disagreements.push({
          videoId: p.videoId,
          field: 'characters',
          side: i,
          ours: mineChars,
          theirs: theirChars,
          title: p.title,
        });
      }
    }
  }
  r.characters.cannotWitness =
    r.characters.blindSpot + r.characters.unreadable + r.characters.overCap;
  return r;
}

const pct = (n: number, total: number) =>
  total === 0 ? '—' : `${((n / total) * 100).toFixed(2)}%`;

/**
 * The report.md block, rendered from the COMMITTED artifact rather than from
 * this run's result (see WitnessArtifact for why). Byte-identical between full
 * sweeps, which is what keeps a quiet morning quiet. Returns nothing until a
 * full sweep has measured once.
 */
export function formatCrossCheck(art: WitnessArtifact): string[] {
  const m = art.measured;
  if (!m || m.compared === 0) return [];
  const c = m.characters;
  const witnessable = c.agree + c.subset + c.disagree;
  const scored = m.players.both + m.players.one + m.players.neither;
  const a = m.players.handleAffix;
  const affixTotal = a.ours + a.theirs + a.unrelated;
  const ind = m.independence;
  return [
    '## Replay Theater cross-check',
    '',
    `A second reading of **${m.compared}** of our own records, from the catalogue's`,
    'UNTAGGED entries: online replays it indexes that we also parse from a tracked',
    'channel. It changes nothing: a disagreement is recorded in',
    'data/theater-disagreements.json with both claims, never written into a record.',
    'The catalogue does not outrank a confident parse and never outranks a human',
    'override.',
    '',
    // THE CAVEAT IS PART OF THE NUMBER (checklist 12i). No agreement rate below
    // is a trust figure, and the text says so before the table does.
    '**This is not a trust number.** On this game the witness is NEAR-DEPENDENT, close to',
    "tautological: measured 2026-09-29, Replay Theater indexes 96.5% of the dominant channel's",
    'uploads the SAME DAY they go up, so its submitter read the same title our parser did.',
    'Agreement below is a consistency check on two readers of one title, not verification',
    'against the footage. A disagreement is a title at least one of the two misread.',
    '',
    "The catalogue's genuinely independent reach is where it is the ONLY reader: ~1,643 tagged",
    'Rising rows and ~300 untagged Rising rows on channels this archive does not intake',
    '(2026-09-29). There it is a SOURCE (the intake builds those records), so there is nothing',
    'of ours to compare them against, and no row of it appears in the table.',
    '',
    ...(ind
      ? [
          `_On that sweep ${ind.sameDay} of the ${m.compared} compared row(s) (${pct(ind.sameDay, m.compared)}) carry the VOD's own publish day,_`,
          `_${ind.withinOneDay} (${pct(ind.withinOneDay, m.compared)}) within a day. The catalogue has ${ind.unmatchedTagged} tagged and ${ind.unmatchedUntagged} untagged_`,
          `_row(s) on videos we do not hold; of the ${ind.unmatchedHydrated} on a VOD the pull resolved, ${ind.offIntakeTagged} tagged and_`,
          `_${ind.offIntakeUntagged} untagged sit on channels we do not intake._`,
          '',
        ]
      : []),
    `_Measured on the last full sweep, at catalogue entry ${m.atEntryId}. ${m.unmatched} catalogue video(s) are ones_`,
    `_we do not hold from a tracked channel; ${m.segmented} are VODs the catalogue segments, which the intake owns._`,
    '',
    '| field | population | agree | partial | disagree | cannot witness |',
    '| --- | ---: | ---: | ---: | ---: | ---: |',
    `| players (both handles) | ${scored} | ${m.players.both} (${pct(m.players.both, scored)}) | ${m.players.one} | ${m.players.neither} | ${m.players.placeholder} |`,
    `| characters (per side) | ${c.sides} | ${c.agree} (${pct(c.agree, c.sides)}) | ${c.subset} | ${c.disagree} (${pct(c.disagree, c.sides)}) | ${c.cannotWitness} |`,
    '',
    `Side order differed on **${m.players.flipped}** record(s); the comparison realigns on the`,
    'handles before reading characters, so a swapped pair is not counted twice as a',
    'character disagreement. Handles are compared sponsor-stripped on both sides, and',
    "case-only spellings fold into one identity (the display casing is parse's vote).",
    '',
    ...(m.players.placeholder > 0
      ? [
          `**${m.players.placeholder}** record(s) carry a placeholder handle on the catalogue's side`,
          '(`Unknown Player`, `GG Player`, …): a witness that declined to name the player, held',
          'out of the players row rather than scored as a miss. Their characters are still compared.',
          '',
        ]
      : []),
    ...(c.cannotWitness > 0
      ? [
          `**${c.cannotWitness}** side(s) the catalogue COULD NOT HAVE GOT RIGHT are held out of both`,
          `columns above: agreement over the ${witnessable} it can express is **${pct(c.agree, witnessable)}**.`,
          '',
          ...(art.blindSpots.length
            ? [
                'Its vocabulary has no word for these, derived from that sweep rather than declared:',
                'no string anywhere in the pull resolves to the id, and where we say it the',
                'catalogue says one particular other thing almost every time:',
                '',
                ...art.blindSpots.map(
                  (b) =>
                    `- \`${b.id}\` → the catalogue writes \`${b.mergedInto}\` instead, on ${b.merged} of the ` +
                    `${b.sides} side(s) where we say it (${pct(b.merged, b.sides)}).`,
                ),
                '',
              ]
            : []),
          ...(c.unreadable > 0 || c.overCap > 0
            ? [
                `A further ${c.unreadable} carried a character string that resolves to no roster id, and ${c.overCap}`,
                'named more characters on our side than the catalogue can hold in its four',
                'columns (MatchSide.characters is an ordered union and has no such limit).',
                '',
              ]
            : []),
        ]
      : []),
    ...(affixTotal > 0
      ? [
          `Of the ${affixTotal} side(s) whose handles did not match, **${a.ours}** are ours carrying extra text`,
          `the catalogue does not, **${a.theirs}** are theirs carrying a team tag THEATER_SPONSOR does not`,
          `strip yet, and **${a.unrelated}** are genuinely different names, the only bucket worth reading one`,
          'row at a time. Reported, never scored: substring matching on handles is the kind of',
          'guessing this module refuses.',
          '',
        ]
      : []),
    ...(art.disagreements.length
      ? [
          `**${art.disagreements.length} disagreement(s)**, both claims, ours first:`,
          '',
          ...art.disagreements
            .slice(0, 25)
            .map(
              (d) =>
                `- \`${d.videoId}\`${d.side !== undefined ? ` side ${d.side}` : ''} ${d.field}: ` +
                `**${d.ours.join(', ') || '(none)'}** vs catalogue **${d.theirs.join(', ') || '(none)'}** — ${d.title.slice(0, 70)}`,
            ),
          ...(art.disagreements.length > 25 ? [`- … ${art.disagreements.length - 25} more`] : []),
          '',
        ]
      : ['No disagreements on that sweep.', '']),
  ];
}
