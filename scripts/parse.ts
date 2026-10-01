/**
 * Stage 2: turn raw/*.json into the committed substrate data/videos.json, plus
 * data/players.json, data/review-queue.json and data/report.md.
 *
 * STRIVE'S PARSER, PORTED. Its core is game-agnostic and was measured hard: the
 * parser never CHOOSES a slot order — it asks which span of a side resolves to
 * a roster alias and takes the remainder as the handle — and where BOTH spans
 * resolve (a player named after a fighter: `UNO (Anre)`, `Yuel (Yuel)`), the
 * channel's declared slotOrder breaks the tie, recorded and counted; a channel
 * with no usable order sends the record to review as 'slot-ambiguous'.
 * Nothing is guessed (checklist 5m).
 *
 * WHAT CHANGES FOR GBVSR, all measured in the 2026-09-29 recon:
 *   · The marker is GBVSR, never bare GBVS (channels.ts): the previous game's
 *     uploads live on the same channels. Marker AND date floor (PRE_RELEASE,
 *     the vendor's early access) — every intake, no per-channel exception.
 *   · The decoration vocabulary below is this corpus's: the dominant channel's
 *     `GBVSR:🔥 … 🔥| High Level Gameplay.`, kakuken's `[GBVSR] (4K)
 *     Granblue Fantasy Versus Rising Rank match`, gbvsReplayChannel's
 *     `GBVSR High Level Gameplay …`, yumegiwa's `【 … 】#GBVSR No…`.
 *   · `versus` is NOT a separator here: three channels carry "Granblue Fantasy
 *     VERSUS Rising" in every title, and no GBVSR title in the recon used it
 *     between players.
 *   · SKINS: costume names ride INSIDE the fighter paren on the dominant
 *     channel (1,417 sides — `(Katalina Lady Serenity)`, `(Summer Belial)`);
 *     stripped from the fighter slot only, never from a handle, and counted.
 *   · THE EX MARK (Ver 2.20): `(EX Narmaya)`, `Narmaya (EX)`. Read by
 *     roster.ts findExTokens, removed before any handle is taken, and kept
 *     only when the fighter has an EX mode and the upload is on or after it —
 *     positive evidence only, never an "is base" claim (decided 2026-09-29).
 *   · THE RELEASE FLOOR: a side resolving to a fighter on a day before that
 *     fighter was playable is not a record (`before-release`, sampled into
 *     report.md). The dates are the vendor's earliest statement about each
 *     build (seasons.ts), which is what keeps Versusia's 12 early uploads.
 *   · Nested brackets: " GBVSR Replay" writes `[HANDLE(CHAR)]` — a whole side
 *     in one square group — and the dominant channel has `[Evil] (Galleon)`
 *     (the handle itself bracketed) and `Handle (CN) (Char)`.
 *
 * The pipeline order is load → gate → parse → index-merge → dedupe → guard →
 * write, and the guards are the point:
 *
 *   · game marker, hashtag-stripped, TITLE ONLY   (checklist 3 — channels.ts)
 *   · date floor, every intake                    (seasons.ts PRE_RELEASE)
 *   · stale-raw, DATA-ONLY                        (checklist 10c; no mtime)
 *   · duration floor                              (MIN_MATCH_SEC)
 *   · residue                                     (checklist 5c)
 *   · release floor per fighter, EX validity      (this game)
 *   · registry invariant, at parse time           (checklist 5n — parse-finish.ts)
 *   · collapse, parsed-vs-committed               (checklist 7)
 *   · freeze carry with a pinned count            (checklist 7)
 *   · dedupe on the INTAKE key                    (checklist 2)
 *   · review queue, never guessed                 (checklist 6)
 *   · departures, per intake, REPORT-ONLY         (parse-finish.ts)
 *
 * Run: npm run data:parse
 *
 * Flags:
 *   --seed-freeze-pins   Parse a frozen channel's dump (present only after
 *                        `data:fetch -- --only=<key> --include-frozen`), print
 *                        the count to set as `frozen.records` in
 *                        scripts/channels.ts, and REFUSE to write anything.
 *   --allow-collapse     Accept a collapse the guard would refuse (parse-finish).
 */

import { mkdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CHANNELS, hasGbvsrMarker, stripHashtagRun, stripTheaterSponsor } from './channels';
import { isPlaceholderHandle } from './crosscheck';
import { patchForDate, patchWindows, PRE_RELEASE, seasonForDate, seasonToken } from './seasons';
import {
  buildAliasMatcher,
  CONFIRMED_FIGHTER_NAMED_PLAYERS,
  findExTokens,
  loadCharacters,
  normalizeText,
  playerId,
  stripSkins,
} from './roster';
// The back half of the same pipeline — index merge, dedupe, collapse guard,
// freeze carry, registry invariant, players, report. Split from this file for
// legibility only; there is one parse and it is these two files.
import { writeReportAndData } from './parse-finish';
import type { ChannelTally, DurationHistogram } from './parse-finish';
import type { AliasMatcher } from './roster';
import type {
  ChannelKey,
  CharProvenance,
  MatchSide,
  MatchVideo,
  RawVideoRecord,
  ReviewQueueItem,
  SlotOrder,
  SourcePins,
  VideoOverride,
} from '../types/index';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW = join(ROOT, 'raw');
const DATA = join(ROOT, 'data');

const SEED_FREEZE_PINS = process.argv.includes('--seed-freeze-pins');

/**
 * A whole-video record has to be long enough to BE a set. 120 seconds — the
 * platform default, and here MEASURED rather than inherited: the dominant
 * channel's 9,684 hydrated uploads have p10 344 s and ZERO under 120 s, and
 * the per-channel duration histogram in report.md keeps the number
 * re-derivable. There is deliberately NO ceiling: that channel's 509 uploads
 * over 30 minutes (max 1 h 53) are single-pairing SESSIONS with the same title
 * shape, not tournament VODs; the multi-pairing VODs (yumegiwa's "JPN on-line
 * Tournament No1xx", gbvsReplayChannel's restreams) carry no `vs` and fail the
 * grammar on their own (checklist 5t, answered by measurement).
 */
export const MIN_MATCH_SEC = 120;

const CONFIRMED_IDS = new Set(CONFIRMED_FIGHTER_NAMED_PLAYERS.map((p) => p.id));

/**
 * A handle is at most MAX_HANDLE_WORDS words — Strive's measured 5, kept
 * until this corpus's own distribution says otherwise. report.md prints the
 * word-count table every run, so a bump at 5 is visible drift, not a guess.
 */
const MAX_HANDLE_WORDS = 5;

// ── decoration, stripped before parsing ─────────────────────────────────────
//
// Every pattern below is a measured prefix or suffix from the 2026-09-29 recon
// (per-channel samples plus full playlist walks). ORDER IS LOAD-BEARING, the
// lesson CotW paid 820 records for: the PREFIX strip runs first, and `strip()`
// refuses any edit that empties the string or removes the last `vs`.
//
// Glyphs seen in front of, between or after slots: 🔥 (highLevelReplays,
// gbFightingReplays, yumegiwa's tail), ⭐ (risingReplays), 👍 ("v2 50👍").
// U+FE0F is the emoji variation selector; without it the selector survives the
// strip and lands in a handle as an invisible first character.
const DECOR = '\\uFE0F🔥⭐🌟✨⚡👑👍▶|｜:\\-–—';
const DECOR_GLYPHS = /[\uFE0F🔥⭐🌟✨⚡👑👍▶]/gu;

const DECOR_PREFIX = new RegExp(
  [
    // kakuken: "[GBVSR] (4K) Granblue Fantasy Versus Rising Rank match  Oru
    // (Belial) vs …" — 789 of its 941 Rising titles; 109 more without "(4K)".
    String.raw`^\s*\[?\s*GBVS\s*R\s*\]\s*(?:\(\s*4K\s*\)\s*)?(?:Granblue\s*Fantasy\s*Versus\s*:?\s*Rising\s*)?(?:Rank(?:ed)?\s*match(?:es)?\s*)?`,
    // " GBVSR Replay": "Granblue Fantasy Versus: Rising: REPLAY [KOYAO(NARMAYA)]
    // vs […]" (98 of its 126 Rising titles).
    String.raw`^\s*Granblue\s*Fantasy\s*Versus\s*:?\s*Rising\s*:?\s*(?:REPLAY\s*)?`,
    // highLevelReplays "GBVSR:🔥", gbFightingReplays "GBVSR 🔥 ", risingReplays
    // "GBVSR - ", gbvsReplayChannel "GBVSR High Level Gameplay " / "GBVSR High
    // Level " / "GBVSR High " / "GBVS Rising High Level " / "GBVS Rising
    // Gameplay " / "GBVSr high Level Gameplay " (its own casing drifts). NOT
    // "Rookies": that is a PLAYER (IBSG | Rookies), found by the rehearsal
    // parse's rejects — "GBVSR Rookies Versusia VS …" is Rookies on Versusia.
    // "GBVS Rising" before "GBVSR" so the longer spelling wins.
    String.raw`^\s*(?:GBVS\s*Rising|GBVS\s*R)(?![A-Za-z])\s*:?\s*(?:High\s*(?:Level\s*)?(?:Game\s*play\s*)?|Game\s*play\s*)?[${DECOR}]*\s*`,
    // yumegiwa: "【加奈人（siegfried ジークフリート）VS …】#GBVSR No103 …" wraps the
    // matchup in 【 】.
    String.raw`^\s*【\s*`,
  ].join('|'),
  'iu',
);

const DECOR_SUFFIX = new RegExp(
  [
    // yumegiwa: everything after the closing 】 is the tournament stamp
    // ("#GBVSR No103 金曜だから夜更かし🔥Season2").
    String.raw`\s*】.*$`,
    // highLevelReplays "🔥| High Level Gameplay.", gbFightingReplays "🔥 High
    // Level Gameplay", fgHighLevel "| Granblue Fantasy Versus: Rising High
    // Level". THE TAIL MAY NOT CROSS A `vs` (Strive's lesson: the leftmost match
    // otherwise eats the second side and strip() refuses the edit).
    String.raw`\s*[${DECOR}.!]*\s*(?:Granblue\s*Fantasy\s*Versus\s*:?\s*Rising\s*)?High\s*Level\b(?:(?!(?<![\p{L}\p{N}])(?:vs\.?|×)(?![\p{L}\p{N}]))[\s\S])*$`,
    // fgHighLevel's OTHER tails, with no "High Level": "| Granblue Fantasy
    // Versus: Rising", "… Rising Replay", "… Rising Grand Master", "… Rising
    // Versusia showcase" (55 titles on the backfill walk, none in the recon's
    // 25-title sample). Same no-`vs`-crossing rule as the tail above.
    String.raw`\s*[${DECOR}.!]*\s*Granblue\s*Fantasy\s*Versus\s*:?\s*Rising\b(?:(?!(?<![\p{L}\p{N}])(?:vs\.?|×)(?![\p{L}\p{N}]))[\s\S])*$`,
    // risingReplays "⭐Masters Ranked Matches⭐(1440p)".
    String.raw`\s*⭐?\s*Masters?\s*Ranked\s*Match(?:es)?\s*⭐?\s*(?:\(\s*\d+p\s*\))?\s*$`,
    // gbvsReplayChannel "… VS Owachan Vira Grand Master Battle".
    String.raw`\s*Grand\s*Master\s*Battle\s*$`,
    String.raw`\s*[${DECOR}!]+\s*$`,
    String.raw`\s*\(?\[?(?:4K|HD|1080p|1440p|60fps)\]?\)?\s*$`,
  ].join('|'),
  'iu',
);

/**
 * A hashtag ANYWHERE in the title, once the marker gate has run — gbvsReplay-
 * Channel ends titles in runs like "#gbvs #gbvsr #gbvsreplaychannel", and
 * yumegiwa puts "#GBVSR" mid-title. A tag never names a player; `#1` (a rank)
 * starts with a digit and is untouched.
 */
const HASHTAG_TOKEN = /(?<![\p{L}\p{N}])#[\p{L}][\p{L}\p{N}_.]*/gu;

/**
 * A version token in the title ("Ver 2.60", "v2.50") — rare on this corpus.
 * COUNTED, NEVER PARSED INTO Replay.patch: a token appearing in a title is not
 * a vendor statement (scripts/seasons.ts, "never invent a version"). report.md
 * prints how often it agrees with the date-derived patch.
 */
const VERSION_TOKEN = /(?<![A-Za-z])(?:Ver\.?\s*|v)(\d+\.\d{1,2})(?![\d.])/iu;

/**
 * A per-character LEADERBOARD POSITION or ladder note in front of a character
 * or handle — Strive's six measured spellings ("#1 Ranked", "TOP Ranked",
 * "Rank 1st", "Rank TOP", "HIGH RANK", a bare "TOP"), kept as a guard: no
 * GBVSR intake in the recon writes one, and the residue gate would report the
 * first that did. STRIPPED, NEVER TURNED INTO Side.rank (filters.rank is false —
 * app/app.config.ts). Anchored and boundary-guarded, so "Topanga (Gran)" keeps
 * its handle.
 */
const RANK_PREFIX =
  /^\s*(?:#\s*\d+\s*(?:st|nd|rd|th)?\s*(?:Ranked?(?![\p{L}\p{N}]))?|TOP\s*Ranked?(?![\p{L}\p{N}])|TOP(?![\p{L}\p{N}])|Rank(?:ed)?\s*(?:#?\s*\d+\s*(?:st|nd|rd|th)?|TOP)(?![\p{L}\p{N}])|HIGH\s*RANK(?:ED)?(?![\p{L}\p{N}])|Day\s*\d+(?![\p{L}\p{N}]))\s*/iu;

/** The `vs` separator: `vs`, `vs.`, `Vs`, `VS`, `×`. A closing bracket is a
 *  valid left boundary (yumegiwa writes "）VS " with no whitespace). `versus`
 *  is DELIBERATELY ABSENT — three channels write "Granblue Fantasy Versus
 *  Rising" in every title, and no recon title used it between players. */
const VS = /(?<![\p{L}\p{N}])(?:vs\.?|×)(?![\p{L}\p{N}])/giu;

/**
 * Bracket groups, matched BY TYPE — never a generic "any bracket" (Strive's
 * lesson: a handle can carry a ROUND paren inside a SQUARE group).
 *
 *   round      ( … )  with ONE level of nesting
 *   fullwidth  （ … ） yumegiwa — belt-and-braces, normalizeText folds it first
 *   square     [ … ]  risingReplays' `Handle [Char]`, the dominant channel's
 *                     bracketed handles (`[Evil] (Galleon)`), and " GBVSR
 *                     Replay"'s whole-side `[HANDLE(CHAR)]` (unwrapped in
 *                     parseSide before this runs)
 * Left to right, each alternative consumes its whole group.
 */
const BRACKET = /\((?:[^()]|\([^()]*\))*\)|（[^（）]*）|\[[^[\]]*\]/gu;

const countVs = (s: string): number => {
  VS.lastIndex = 0;
  return (s.match(VS) ?? []).length;
};

/** Apply a decoration pattern, but REFUSE the edit if it empties the string or
 *  drops the last `vs`. A strip that removes the matchup is never right, and
 *  the failure it causes is silent. Repeated until stable: a title can end in
 *  a glyph AND a house-style phrase. */
const strip = (s: string, re: RegExp): string => {
  let out = s;
  for (let i = 0; i < 3; i++) {
    const next = out.replace(re, '').trim();
    if (!next || next === out) break;
    if (countVs(out) > 0 && countVs(next) === 0) break;
    out = next;
  }
  return out;
};

/** Rank/leaderboard prefixes, stripped repeatedly ("#1 Ranked" then "TOP"). */
const stripRank = (s: string): string => {
  let out = s.trim();
  for (let i = 0; i < 3; i++) {
    const next = out.replace(RANK_PREFIX, '').trim();
    if (next === out) break;
    out = next;
  }
  return out;
};

/** Words that are decoration wherever they appear, used to stop the handle
 *  picker from choosing a house-style phrase over the player. GBVSR's own:
 *  the game names, the channels' house phrases, the region/language tags the
 *  dominant channel puts in parens ("(SEA)", "(DE EN)", "(BR)"), and
 *  "TIER"/"Top tier" notes. A paren that is all decoration is not a handle. */
const DECOR_WORDS =
  /^(?:high|highest|level|gameplay|match|matches|replay|replays|ranked|ranking|rank|online|offline|gbvs|gbvsr|granblue|fantasy|versus|rising|grand|master|masters|battle|season|ver|version|tier|new|full|best|top|pro|vs|and|ft|feat|jpn|on|line|tournament|shorts|short|round|lab|combo|combos|ps\d|pc|steam|switch|xbox|4k|1080p|1440p|hd|sea|eu|na|jp|kr|br|de|en|ec|ny|cn|ft\d+|\d{1,4}|no\d*|\d+(?:st|nd|rd|th))$/i;

/**
 * True when nothing in `s` could be somebody's name. Tokens are stripped to
 * their letters and digits first, so "(", "F/2" and "FT10)" are judged on "",
 * "f2" and "ft10" rather than on their punctuation.
 *
 * TWO STRICTNESSES, BECAUSE THE CANDIDATE'S ORIGIN DECIDES WHAT A SHORT TOKEN
 * MEANS. A `structural` candidate came from the slot the channel's grammar
 * reserves for the handle — inside the bracket on a chars-outside channel, the
 * whole outside on a handle-outside one — and there a one-character or
 * all-digit token IS the player: "9" (WIP|9, 12 titles across three
 * channels), "808", "210", "C", "a", "N M R", all refused as decoration on the
 * 2026-09-09 run. A GAP candidate is whatever a roster span did not cover on a
 * bare side, where a stray letter or number is far more often debris
 * ("Floor 1", the "2" of a floor tier, a dropped bracket), so it keeps CotW's
 * rule: at least one token of two or more characters that is not decoration.
 * Both refuse a phrase that is nothing but decoration words — "(OLD)",
 * "(PS5)", "(Floor 1)", "(F5)" — which is what keeps a ladder tier or an
 * archive note from minting a player.
 */
const isDecorPhrase = (s: string, structural: boolean): boolean => {
  const words = s
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean);
  if (words.length === 0) return true;
  if (structural) {
    if (words.length === 1 && /^\d+$/u.test(words[0] ?? '')) return false;
    return !words.some((w) => !DECOR_WORDS.test(w));
  }
  return !words.some((w) => w.length >= 2 && !DECOR_WORDS.test(w));
};

/** A trailing parenthetical NOTE inside a handle — "Tsuku (PS5)" — dropped
 *  when something is left. "(ノ-_-)ノ" ends in ノ, not ")", and survives. */
const NOTE_TAIL = /\s*\([^()]*\)\s*$/u;

/** Bracket pairs an uploader can leave half-typed. */
const BRACKET_PAIRS: [string, string][] = [
  ['(', ')'],
  ['[', ']'],
  ['「', '」'],
  ['『', '』'],
  ['【', '】'],
];
const countChar = (s: string, c: string): number => s.split(c).length - 1;

/**
 * Drop a bracket at either EDGE of a handle that has no partner inside it.
 * Measured on the 2026-09-09 run: "Hotashi )" from "Hotashi (Nagoriyuki))",
 * "薄いヴェノム(" from a doubled "((Venom ヴェノム)", "(FuryGR」)" with a
 * Japanese close-quote for a paren, "[ TAKASHI/タカシ" from a bracket never
 * closed. Only unmatched edge brackets go: "(ノ-_-)ノ" is balanced and keeps
 * both, and a bracket in the middle of a handle is left where the uploader put
 * it. CotW trimmed every bracket and broke every title ending in one; this
 * counts first.
 */
const stripUnmatchedEdges = (s: string): string => {
  let out = s.trim();
  for (let i = 0; i < 4; i++) {
    const before = out;
    for (const [open, close] of BRACKET_PAIRS) {
      const opens = countChar(out, open);
      const closes = countChar(out, close);
      if (opens > closes && out.endsWith(open)) out = out.slice(0, -1).trim();
      else if (opens > closes && out.startsWith(open)) out = out.slice(1).trim();
      if (closes > opens && out.startsWith(close)) out = out.slice(1).trim();
      else if (closes > opens && out.endsWith(close)) out = out.slice(0, -1).trim();
      // A handle WRAPPED in Japanese quotes — "「Kagero」" — is the name inside.
      if (out.startsWith(open) && out.endsWith(close) && open !== '(' && open !== '[') {
        const inner = out.slice(1, -1).trim();
        if (inner && countChar(inner, open) === 0 && countChar(inner, close) === 0) out = inner;
      }
    }
    // The same for ASCII double quotes — `[ "Nanachi" ]`.
    if (out.length > 2 && out.startsWith('"') && out.endsWith('"') && countChar(out, '"') === 2) {
      out = out.slice(1, -1).trim();
    }
    if (out === before) break;
  }
  return out;
};

/**
 * Clean one handle candidate. Sponsor prefixes ("SKB | Mafurako",
 * "GGA | Kaelus" — ggstHighRank writes them INSIDE the paren) are stripped by
 * channels.ts's repeated stripTheaterSponsor, never split: "|" is not a duo
 * delimiter on this game and there is NO playerSep (channels.ts).
 *
 * "/" is trimmed at the EDGES only: "sdytko /アクセル" and "/ アクセス [" are
 * leaks of a bilingual echo, while "TAKASHI/タカシ" and "ttv/pedrito_ky" are
 * handles the corpus really contains (channels.ts, the no-playerSep note).
 */
const cleanHandle = (s: string): string => {
  const base = stripUnmatchedEdges(
    stripTheaterSponsor(normalizeText(s))
      .replace(DECOR_GLYPHS, ' ')
      .replace(/\|/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^[\s.\-–—:!,/]+|[\s.\-–—:!,/]+$/g, '')
      .trim(),
  );
  const noted = base.replace(NOTE_TAIL, '').trim();
  return noted || base;
};

/**
 * Pick a handle from candidate fragments — the ONE place a handle is chosen.
 * A HANDLE THAT IS ENTIRELY DECORATION IS NOT A HANDLE (CotW's 118
 * "show Match (" players), and neither is a PLACEHOLDER: the catalogue's
 * `Unknown Player` / `GG Player` family is refused through the same predicate
 * the intake and the witness use (crosscheck.ts isPlaceholderHandle), so a
 * title that ever copies that spelling cannot mint the player the catalogue
 * declined to name. Longest surviving candidate wins. `structural` says the
 * candidates came from the grammar's handle slot — see isDecorPhrase.
 */
const pickHandle = (
  candidates: string[],
  structural: boolean,
): { handle: string; placeholder: boolean } => {
  const cleaned = candidates.map(cleanHandle).filter(Boolean);
  const handle =
    cleaned
      .filter(
        (c) =>
          !isDecorPhrase(c, structural) &&
          !isPlaceholderHandle(c) &&
          c.split(/\s+/).length <= MAX_HANDLE_WORDS,
      )
      .sort((a, b) => b.length - a.length)[0] ?? '';
  // `placeholder` is set only when the refusal DECIDED the side — a placeholder
  // beside a real candidate is not a drop, and counting it as one would
  // overstate the class report.md prints.
  return { handle, placeholder: !handle && cleaned.some(isPlaceholderHandle) };
};

/**
 * Close a bracket the uploader opened and never closed, so the bracket
 * extractor can see the slot. "SOL / ソル [ TAKASHI/タカシ" (video dVmHM8DqdwI),
 * "Axl / アクセス [ DeafHeaven" (Vb4NUrrXFx8), "Daru_I-No (I-No" (the closing
 * paren eaten by a suffix typo) — the 2026-09-09 fetch recon flagged five of
 * these on ggstBattleCollection alone, and each one otherwise falls through
 * to the bare path and mints a handle with a "[" in it. Only a SURPLUS of
 * openers is closed, at the end; a surplus of closers is left for
 * stripUnmatchedEdges.
 */
const closeOpenBrackets = (s: string): string => {
  let out = s;
  for (const [open, close] of BRACKET_PAIRS) {
    const surplus = countChar(out, open) - countChar(out, close);
    if (surplus > 0) out += close.repeat(surplus);
  }
  return out;
};

/** The text of `s` that no roster span covers, as fragments. */
const gapsAround = (s: string, matcher: AliasMatcher): string[] => {
  const t = normalizeText(s);
  const gaps: string[] = [];
  let prev = 0;
  for (const span of matcher.find(t)) {
    gaps.push(t.slice(prev, span.start));
    prev = span.end;
  }
  gaps.push(t.slice(prev));
  return gaps;
};

export interface Reading {
  handle: string;
  characters: string[];
  slotOrder: SlotOrder;
}

export interface ParsedSide extends Reading {
  /** Both spans resolved and the channel's declared order decided. */
  tieBroken: boolean;
  /** Character ids the title MARKED as EX on this side — the token only;
   *  main() decides validity (fighter has an EX mode, date on/after it). */
  ex?: string[];
  /** Skin names stripped from this side's fighter slot, for the report. */
  skins?: string[];
}

export type SideMiss = 'no-char' | 'no-handle' | 'slot-ambiguous';

export type SideOutcome =
  | { ok: ParsedSide }
  /** Both spans resolved and the channel declares no usable order: BOTH
   *  readings, for the review queue. Never guessed. */
  | { ambiguous: Reading[] }
  /** `placeholder`: the only handle candidate was a catalogue placeholder
   *  ("Unknown Player") and was refused — a `no-handle` with a named cause,
   *  counted per channel. */
  | { miss: SideMiss; placeholder?: boolean };

/**
 * One side segment → handle + characters, with no positional assumption —
 * except where BOTH spans resolve, which is where the declared order breaks
 * the tie. See the header.
 */
export function parseSide(
  segment: string,
  matcher: AliasMatcher,
  declared: SlotOrder,
): SideOutcome {
  // A GLUED EX — yumegiwa's "（NarmayaEX）" — is split first, or neither the
  // name nor the mark can match (each is a letter to the other).
  let seg = stripRank(closeOpenBrackets(normalizeText(segment))).replace(
    /(Gran|Djeeta|Narmaya|グラン|ジータ|ナルメア)EX(?![A-Za-z])/giu,
    '$1 EX',
  );
  // A WHOLE SIDE IN ONE SQUARE GROUP — " GBVSR Replay" writes
  // `[KOYAO(NARMAYA)]`. Read as a bracket, the fighter resolves and the
  // "outside" is empty: no handle. The square group is a WRAPPER there, so a
  // side that is exactly one square group holding a round group is unwrapped.
  const wrapped = /^\[([^[\]]*\([^()]*\)[^[\]]*)\]$/u.exec(seg);
  if (wrapped) seg = wrapped[1]!.trim();
  // THE EX MARK, read and REMOVED before anything else sees the text, so
  // "Handle EX Narmaya" on a bare title cannot leave "EX" in the handle.
  const exIds: string[] = [];
  const exTokens = findExTokens(seg, matcher.find(seg));
  if (exTokens.length) {
    let cut = seg;
    for (const t of [...exTokens].sort((a, b) => b.start - a.start)) {
      if (!exIds.includes(t.match.id)) exIds.unshift(t.match.id);
      cut = cut.slice(0, t.start) + ' ' + cut.slice(t.end);
    }
    seg = cut
      .replace(/\(\s*\)|\[\s*\]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  const withMarks = (side: ParsedSide, skins: string[] = []): ParsedSide => {
    const ex = exIds.filter((id) => side.characters.includes(id));
    return { ...side, ...(ex.length ? { ex } : {}), ...(skins.length ? { skins } : {}) };
  };
  const groups = [...seg.matchAll(BRACKET)].map((m) => m[0]);

  // STRUCTURED: at least one bracket group.
  if (groups.length > 0) {
    // SKINS ride inside the fighter paren ("Katalina Lady Serenity",
    // "Summer Belial"); stripped from bracket contents only — a handle
    // outside a bracket is never touched, so a player called "Summer" stays.
    const skins: string[] = [];
    const inners = groups.map((g) => {
      const cut = stripSkins(stripRank(g.slice(1, -1)));
      skins.push(...cut.skins);
      return cut.text;
    });
    const outside = stripRank(seg.replace(BRACKET, ' ').replace(/\s+/g, ' ').trim());
    const resolving = inners.map((p) => matcher.ids(p)).filter((ids) => ids.length > 0);
    // MORE THAN ONE bracket resolving is ambiguous — which one names the
    // fighter? Never guessed; the caller routes it to the queue.
    if (resolving.length > 1) return { miss: 'slot-ambiguous' };

    const fromParen = resolving[0] ?? [];
    const fromOutside = matcher.ids(outside);

    if (fromParen.length > 0 && fromOutside.length > 0) {
      // BOTH RESOLVE — THE DEFECT THIS FILE EXISTS TO FIX. "Lasagna Slayer (#1
      // Ranked Venom)", "NAGORIYUKI (SOL mugi)", "UNIKA / ユニカ [ ユニカ ]",
      // "Johnny (Johnny)". The first resolving span is a coin flip, so the
      // channel's DECLARED order decides, and only here.
      const outsideHandle = pickHandle([outside], true);
      const innerHandle = pickHandle(inners, true);
      const readings: Reading[] = [
        { handle: outsideHandle.handle, characters: fromParen, slotOrder: 'handle-outside' },
        { handle: innerHandle.handle, characters: fromOutside, slotOrder: 'chars-outside' },
      ];
      const pick =
        declared === 'handle-outside'
          ? readings[0]
          : declared === 'chars-outside'
            ? readings[1]
            : undefined;
      // 'handle-first-bare' says nothing about which SLOT of a
      // bracketed segment holds the fighter, so they cannot break this tie.
      if (!pick) return { ambiguous: readings };
      if (!pick.handle) {
        return {
          miss: 'no-handle',
          placeholder: (pick === readings[0] ? outsideHandle : innerHandle).placeholder,
        };
      }
      return { ok: withMarks({ ...pick, tieBroken: true }, skins) };
    }

    if (fromParen.length > 0) {
      // Exactly the bracket resolves: the handle is everything outside it —
      // or, when nothing is outside, a bracket that did NOT resolve: the
      // dominant channel's `[Evil] (Galleon)` brackets the handle itself.
      const outsideHandle = pickHandle([outside], true);
      const bracketed = outsideHandle.handle
        ? outsideHandle
        : pickHandle(
            inners.filter((i) => matcher.ids(i).length === 0),
            true,
          );
      if (!bracketed.handle)
        return {
          miss: 'no-handle',
          placeholder: outsideHandle.placeholder || bracketed.placeholder,
        };
      return {
        ok: withMarks(
          {
            handle: bracketed.handle,
            characters: fromParen,
            slotOrder: 'handle-outside',
            tieBroken: false,
          },
          skins,
        ),
      };
    }

    if (fromOutside.length > 0) {
      // Exactly the outside resolves. On a chars-outside channel the bracket
      // holds the handle ("#1 VENOM (Papaya)"); on a bare-grammar channel a
      // bracket that does not resolve is usually a NOTE — "(OLD)", "(PS5)",
      // "(Floor 1)" — and the handle is the outside text the roster span did
      // not cover. Both are tried; the declared order only decides which is
      // tried FIRST, so a handle-outside title whose bracket happens to hold
      // the handle still resolves, and a chars-outside title whose bracket is
      // a note still resolves.
      //
      // EXCEPT on a handle-outside channel when the bracket holds a NAME. There
      // the grammar says the bracket IS the fighter, so a name-shaped bracket
      // the roster cannot read is a fighter the roster cannot read — a typo,
      // or a DLC arrival — and the resolving outside is a fighter-named
      // HANDLE. "Zato_VaN (Azuka)" (video …, guiltyGearReplays, 2026-09-09 run)
      // read as the player "_VaN" on Zato until this branch; it is an honest
      // `no-char` that reaches the review queue with the handle attached, and
      // "Azuka" surfaces in the residue table as the alias it is. A bracket
      // that is only decoration still takes the note path.
      if (declared === 'handle-outside' && inners.some((i) => !isDecorPhrase(i, true))) {
        return { miss: 'no-char' };
      }
      const fromInner = pickHandle(inners, true);
      const fromGaps = pickHandle(gapsAround(outside, matcher), false);
      const order: [string, SlotOrder][] =
        declared === 'chars-outside'
          ? [
              [fromInner.handle, 'chars-outside'],
              [fromGaps.handle, 'handle-first-bare'],
            ]
          : [
              [fromGaps.handle, 'handle-first-bare'],
              [fromInner.handle, 'chars-outside'],
            ];
      const hit = order.find(([h]) => h);
      if (!hit)
        return { miss: 'no-handle', placeholder: fromInner.placeholder || fromGaps.placeholder };
      return {
        ok: withMarks(
          { handle: hit[0], characters: fromOutside, slotOrder: hit[1], tieBroken: false },
          skins,
        ),
      };
    }
    return { miss: 'no-char' };
  }

  // BARE: no brackets at all — gbvsReplayChannel's "Sutorato Beelzebub VS B11
  // Wilnas" and its slash family "Grande/Lucilius VS Sho San/Zeta". The roster
  // spans are the boundary; the gaps are the handle.
  //
  const spans = matcher.find(seg);
  const first = spans[0];
  if (!first) return { miss: 'no-char' };
  const ids: string[] = [];
  for (const s of spans) if (!ids.includes(s.id)) ids.push(s.id);

  // TWO OR MORE SPANS ON ONE BARE SIDE: a counter-pick, or a handle that
  // contains a fighter's name. Strive measured the union right 27 times in 28 on
  // its bare channel and kept it; GBVSR's bare channel writes one fighter per
  // side on its samples, so the union stands and the rare handle-with-a-
  // fighter-name reads as a counter-pick — counted in the slot mix, and caught
  // by the registry invariant only when the whole handle is a fighter's name.
  // The chars-outside branch below is kept for a channel that writes the
  // fighter first (none does today).
  if (spans.length > 1 && declared === 'chars-outside' && first.start === 0) {
    const rest = seg.slice(first.end);
    const restGaps = pickHandle(gapsAround(rest, matcher), false);
    if (!restGaps.handle) return { miss: 'no-handle', placeholder: restGaps.placeholder };
    const { handle, placeholder } = pickHandle([rest], true);
    if (!handle) return { miss: 'no-handle', placeholder };
    return {
      ok: withMarks({
        handle,
        characters: [first.id],
        slotOrder: 'chars-outside',
        tieBroken: true,
      }),
    };
  }

  // A CONFIRMED FIGHTER-NAMED PLAYER ON A BARE SIDE. gbvsReplayChannel writes
  // "UNO Ferry VS Gobou Wilnas" and "Djeeta Wilnas" — the player UNO on Ferry,
  // the player Djeeta on Wilnas — and the union reads two fighters and no
  // handle. Two spans, no other handle-shaped text, and a FIRST span whose
  // literal is an allow-listed person (roster.ts, each row evidenced by a video
  // id): the first span is the player. Only the evidenced list can unlock this,
  // so a real counter-pick ("Lanslot Six") is never read as a handle.
  if (declared === 'handle-first-bare' && spans.length === 2 && ids.length === 2) {
    const gaps = pickHandle(gapsAround(seg, matcher), false);
    if (!gaps.handle && CONFIRMED_IDS.has(playerId(first.literal))) {
      return {
        ok: withMarks({
          handle: first.literal,
          characters: [spans[1]!.id],
          slotOrder: 'handle-first-bare',
          tieBroken: true,
        }),
      };
    }
  }

  const { handle, placeholder } = pickHandle(gapsAround(seg, matcher), false);
  if (!handle) return { miss: 'no-handle', placeholder };
  // Which side of the character the handle sat on — telemetry. The SlotOrder
  // union has no "character first, no bracket" member, so "Zato Brian" (ggstHq
  // #23, side 2 written character-first) is filed under 'chars-outside': the
  // character is outside and first, the handle follows. It shows up in
  // report.md's mix as a chars-outside share on a handle-first-bare channel,
  // which is exactly the drift signal the mix is printed for.
  const order: SlotOrder = first.start === 0 ? 'chars-outside' : 'handle-first-bare';
  return { ok: withMarks({ handle, characters: ids, slotOrder: order, tieBroken: false }) };
}

export type MissKind =
  | 'no-marker'
  | 'before-floor'
  | 'live'
  | 'too-short'
  | 'no-vs'
  | 'vs-count'
  | 'no-char'
  | 'no-handle'
  | 'slot-ambiguous'
  | 'before-release';

export interface ParseOutcome {
  ok?: [ParsedSide, ParsedSide];
  miss?: MissKind;
  /** For 'slot-ambiguous' from a both-resolve tie with no declared order: the
   *  side(s) and their readings, for the review queue. */
  ambiguous?: { side: 0 | 1; readings: Reading[] }[];
  /** A side was dropped because its only handle was a placeholder. */
  placeholder?: boolean;
  /** The version token the title opened with, if any. Counted, never a patch. */
  versionToken?: string;
}

/** Title → two sides, or a named miss. Pure; the caller owns policy. */
export function parseTitle(
  rawTitle: string,
  matcher: AliasMatcher,
  declared: SlotOrder,
): ParseOutcome {
  let t = normalizeText(stripHashtagRun(rawTitle));
  const versionToken = VERSION_TOKEN.exec(t)?.[1];
  const tag = (o: ParseOutcome): ParseOutcome => (versionToken ? { ...o, versionToken } : o);
  // Hashtags anywhere, AFTER the marker gate has had its look at the title
  // (the caller ran hasGbvsrMarker on the raw title) — see HASHTAG_TOKEN.
  t = t.replace(HASHTAG_TOKEN, ' ').replace(/\s+/g, ' ').trim();
  t = strip(t, DECOR_PREFIX); // PREFIX FIRST — see the note above DECOR_PREFIX
  t = strip(t, DECOR_SUFFIX);

  VS.lastIndex = 0;
  const parts = t
    .split(VS)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // No `vs` at all. This is also where the 23-title "third grammar" lands
  // ("GGST 5.2 Gobou Robo Ky ProtoChan Slayer", the separator simply dropped)
  // — 0.7% of misses on the recon, not a family worth a branch. It is visible
  // in the per-channel rejects rather than recovered.
  if (parts.length < 2) return tag({ miss: 'no-vs' });
  if (parts.length > 2) return tag({ miss: 'vs-count' });

  const [left, right] = parts as [string, string];
  const sides = [parseSide(left, matcher, declared), parseSide(right, matcher, declared)];
  const ambiguous = sides.flatMap((s, i) =>
    'ambiguous' in s ? [{ side: i as 0 | 1, readings: s.ambiguous }] : [],
  );
  if (ambiguous.length) return tag({ miss: 'slot-ambiguous', ambiguous });
  const misses = sides.flatMap((s) => ('miss' in s ? [s] : []));
  if (misses.length) {
    const kinds = misses.map((m) => m.miss);
    const kind: MissKind = kinds.includes('slot-ambiguous')
      ? 'slot-ambiguous'
      : kinds.includes('no-char')
        ? 'no-char'
        : 'no-handle';
    const placeholder = misses.some((m) => m.placeholder === true);
    return tag(placeholder ? { miss: kind, placeholder: true } : { miss: kind });
  }
  const [a, b] = sides as [{ ok: ParsedSide }, { ok: ParsedSide }];
  return tag({ ok: [a.ok, b.ok] });
}

// ── stale-raw guard (DATA ONLY — no filesystem metadata) ────────────────────
//
// Ported from Tōkon via CotW, which learned it twice. Wall-clock age was a
// proxy and leaked; mtime was a proxy and leaked the same way, because `cp`,
// `git checkout` and a fresh clone all stamp a months-old dump as new
// (checklist 10c).
//
// THE TEST READS ONLY DATA. A dump cannot contain an upload published after it
// was taken, so if the committed corpus holds a record for this intake NEWER
// than the newest upload anywhere in the dump, that record cannot have come
// from this dump and parsing would drop it. Both sides are publish timestamps
// written by YouTube and carried in the files themselves.
//
// THE THEATER DUMP IS EXEMPT, by construction rather than by exception: this
// runs only over title channels. A cursor-mode index dump is a legitimately
// thin slice of the catalogue (theater-delta.ts) and the add-only merge in
// parse-finish.ts is what protects that intake.
function assertRawIsFresh(id: ChannelKey, dump: RawVideoRecord[], committed: MatchVideo[]): void {
  let newestInDump = '';
  for (const r of dump) if (r.publishedAt > newestInDump) newestInDump = r.publishedAt;
  if (!newestInDump) return;

  let newestCommitted: MatchVideo | undefined;
  for (const v of committed) {
    if (v.intake !== id) continue;
    if (!newestCommitted || v.publishedAt > newestCommitted.publishedAt) newestCommitted = v;
  }
  if (!newestCommitted) return;
  if (newestCommitted.publishedAt <= newestInDump) return;

  throw new Error(
    [
      `raw/${id}.json is stale: the committed corpus holds an upload it cannot contain.`,
      ``,
      `  newest upload in the dump   ${newestInDump}`,
      `  newest committed record     ${newestCommitted.publishedAt}  ${newestCommitted.id}`,
      ``,
      `  A dump cannot contain an upload published after it was taken, so parsing`,
      `  now would drop that record and every one like it — and the next run would`,
      `  treat the smaller archive as the new baseline.`,
      ``,
      `  Refresh first:  npm run data:fetch`,
    ].join('\n'),
  );
}

const readJson = async <T>(name: string, fallback: T): Promise<T> => {
  const p = join(DATA, name);
  if (!existsSync(p)) return fallback;
  try {
    return JSON.parse(await readFile(p, 'utf8')) as T;
  } catch {
    return fallback;
  }
};

/** NOT readJson: its catch-all fallback is wrong for this one file. `committed`
 *  is the baseline for the freeze carry, the index intake's add-only merge AND
 *  the collapse guard, so a truncated videos.json silently becoming [] would
 *  carry nothing, leave the add-only merge with nothing to preserve, and disarm
 *  the guard for every channel at once (`before > 0` false everywhere) — a
 *  total loss with every gate green. Absent is fine and means a first run;
 *  unreadable is a hard stop. */
async function readCommitted(): Promise<MatchVideo[]> {
  const p = join(DATA, 'videos.json');
  if (!existsSync(p)) return [];
  const text = await readFile(p, 'utf8');
  try {
    const v = JSON.parse(text) as MatchVideo[];
    if (!Array.isArray(v)) throw new Error('not an array');
    return v;
  } catch (err) {
    throw new Error('data/videos.json exists but will not parse — refusing to treat it as empty.', {
      cause: err,
    });
  }
}

/** Duration buckets for the histogram the floor is re-derived from. The
 *  boundaries bracket 120 on both sides and put ggstHq's 30 on its own edge. */
export const DURATION_BUCKETS = [
  ['0 (live/unknown)', 0, 1],
  ['1–29s', 1, 30],
  ['30–59s', 30, 60],
  ['60–119s', 60, 120],
  ['120–179s', 120, 180],
  ['180–299s', 180, 300],
  ['300–599s', 300, 600],
  ['600–1799s', 600, 1800],
  ['1800s+', 1800, Infinity],
] as const;

export const durationBucket = (sec: number): string =>
  DURATION_BUCKETS.find(([, lo, hi]) => sec >= lo && sec < hi)?.[0] ?? '1800s+';

const emptyTally = (floorSec: number): ChannelTally => ({
  raw: 0,
  marked: 0,
  parsed: 0,
  excluded: 0,
  floorSec,
  misses: {},
  placeholderHandles: 0,
  slot: { 'handle-outside': 0, 'chars-outside': 0, 'handle-first-bare': 0 },
  tieBroken: 0,
  versionTokens: {},
  versionAgree: { game: 0, neither: 0, unknown: 0 },
  skins: {},
  exMarked: 0,
  exInvalid: 0,
  beforeRelease: [],
  rejects: [],
  rejectCount: 0,
});

const emptyHistogram = (): DurationHistogram => ({
  records: {},
  matchShapedMisses: {},
  otherMisses: {},
});

const bump = (m: Record<string, number>, k: string, n = 1): void => {
  m[k] = (m[k] ?? 0) + n;
};

/** "2.60" (a PatchBoundary.version) and "2.6" (a title token) name the same
 *  thing iff major and minor agree as decimal fractions (1.1 = 1.10). */
const sameVersion = (a: string, b: string): boolean => {
  const [am, an] = a.split('.');
  const [bm, bn] = b.split('.');
  return Number(am) === Number(bm) && Number(`0.${an}`) === Number(`0.${bn}`);
};

async function main(): Promise<void> {
  await mkdir(DATA, { recursive: true });
  const characters = await loadCharacters();
  const matcher = buildAliasMatcher(characters);
  const charById = new Map(characters.map((c) => [c.id, c]));
  const overrides = await readJson<Record<string, VideoOverride>>('overrides.json', {});
  const committed = await readCommitted();
  const pins = await readJson<SourcePins>('source-pins.json', {});
  const windows = patchWindows();

  const built: MatchVideo[] = [];
  const frozenBuilt = new Map<ChannelKey, MatchVideo[]>();
  const residue = new Map<string, number>();
  const queue: ReviewQueueItem[] = [];
  const perChannel = new Map<ChannelKey, ChannelTally>();
  const rawSeen = new Map<string, string>();
  const durations = new Map<ChannelKey, DurationHistogram>();
  const handleWords: Record<string, number> = {};

  // ── title-parsed channels ────────────────────────────────────────────────
  // Every YouTube channel, frozen included. A frozen channel normally has no
  // dump (fetch skips it) and is carried by parse-finish; when a dump IS
  // present it can only have come from `data:fetch --include-frozen`, which is
  // the freeze-pin seeding path, and parse-finish asserts the parse against
  // the pin instead of the committed count.
  for (const ch of CHANNELS.filter((c) => !c.index)) {
    const floorSec = ch.minDurationSec ?? MIN_MATCH_SEC;
    const file = join(RAW, `${ch.id}.json`);
    if (!existsSync(file)) {
      if (ch.frozen) continue;
      console.warn(`  ⚠ raw/${ch.id}.json missing — skipping (run \`npm run data:fetch\`)`);
      perChannel.set(ch.id, emptyTally(floorSec));
      continue;
    }
    const dump = JSON.parse(await readFile(file, 'utf8')) as RawVideoRecord[];
    if (dump.length === 0) throw new Error(`raw/${ch.id}.json is empty — refusing to parse.`);
    assertRawIsFresh(ch.id, dump, committed);

    const tally = emptyTally(floorSec);
    const hist = emptyHistogram();
    tally.raw = dump.length;
    const floor = PRE_RELEASE;
    const out: MatchVideo[] = [];
    for (const v of dump) {
      rawSeen.set(v.id, `raw/${ch.id}.json`);
      const ov = overrides[v.id];
      if (ov?.exclude) {
        tally.excluded++;
        continue;
      }

      // THE MARKER GATE, FIRST, TITLE ONLY: GBVSR, never bare GBVS — the
      // previous game's uploads live on the same channels (channels.ts).
      if (!hasGbvsrMarker(v.title)) {
        bump(tally.misses, 'no-marker');
        continue;
      }
      tally.marked++;
      const day = v.publishedAt.slice(0, 10);
      if (day < floor) {
        bump(tally.misses, 'before-floor');
        bump(hist.otherMisses, durationBucket(v.durationSec));
        continue;
      }
      // `live` is a class, not a gate worth building around: an uploads walk
      // returns a restream now and then, and it is counted, not parsed.
      if (v.liveBroadcastContent !== 'none') {
        bump(tally.misses, 'live');
        bump(hist.otherMisses, durationBucket(v.durationSec));
        continue;
      }

      // Parsed BEFORE the duration floor is applied, so a too-short upload is
      // still classified as match-shaped or not: that split is what the
      // duration histogram needs to keep the floor a measured number rather
      // than an inherited one.
      const out2 = parseTitle(v.title, matcher, ch.slotOrder);
      if (out2.versionToken) bump(tally.versionTokens, out2.versionToken);

      if (v.durationSec && v.durationSec < floorSec) {
        bump(tally.misses, 'too-short');
        bump(out2.ok ? hist.matchShapedMisses : hist.otherMisses, durationBucket(v.durationSec));
        continue;
      }

      if (!out2.ok) {
        const kind = out2.miss ?? 'no-char';
        bump(tally.misses, kind);
        bump(hist.otherMisses, durationBucket(v.durationSec));
        // PLACEHOLDER HANDLES NEVER MINT A PLAYER — the catalogue's `Unknown
        // Player` family (645 side appearances, recon/replay-theater-live.md
        // §8.5) refused here through the same predicate the index intake and
        // the witness use (crosscheck.ts isPlaceholderHandle). Counted per
        // channel so a title channel that starts copying the spelling shows
        // up as a number rather than as a quieter `no-handle` column.
        if (out2.placeholder) tally.placeholderHandles++;
        const r = matcher.residue(
          strip(strip(normalizeText(stripHashtagRun(v.title)), DECOR_PREFIX), DECOR_SUFFIX),
        );
        if (r) residue.set(r, (residue.get(r) ?? 0) + 1);
        // THE REJECT PRINTER'S PRECISE HALF (checklist 5e): a miss that names a
        // roster character is match-shaped content the parser could not read,
        // and a new grammar variant lives there. Counted per channel, sampled
        // into report.md.
        if (matcher.ids(v.title).length > 0) {
          tally.rejectCount++;
          if (tally.rejects.length < 10) tally.rejects.push({ id: v.id, title: v.title, kind });
        }
        // Match-shaped footage the parser could not complete goes to a human,
        // never to a guess.
        if (kind === 'no-char' || kind === 'slot-ambiguous') {
          queue.push({
            id: v.id,
            kind: kind === 'no-char' ? 'character-completion' : 'slot-ambiguous',
            channel: ch.id,
            title: v.title,
            publishedAt: v.publishedAt,
            durationSec: v.durationSec,
            ...(out2.ambiguous
              ? {
                  readings: out2.ambiguous.flatMap((a) =>
                    a.readings.map((r) => ({ handle: r.handle, characters: r.characters })),
                  ),
                }
              : {}),
          });
        }
        continue;
      }

      const sides = out2.ok.map<MatchSide>((s) => {
        const provenance: CharProvenance = {
          tier: 'title',
          tiers: ['title'],
          fromTitle: s.characters,
          slotOrder: s.slotOrder,
          ...(s.tieBroken ? { tieBroken: true } : {}),
          complete: s.characters.length >= 1,
        };
        return {
          player: playerId(s.handle),
          handle: s.handle,
          characters: s.characters,
          provenance,
        };
      });
      // `!playerId(h)` on the SLUG, not the handle: an all-CJK handle is a fine
      // string and slugs through roster.ts's non-Latin fallback; only pure
      // punctuation returns "" and is refused here (roster.ts playerId).
      if (sides.some((s) => !s.player || s.characters.length === 0)) {
        bump(tally.misses, 'no-handle');
        bump(hist.otherMisses, durationBucket(v.durationSec));
        continue;
      }
      // THE RELEASE FLOOR: a fighter on a day before they were playable is not
      // a record. `released` is the vendor's earliest statement about the build
      // that added them (scripts/seasons.ts, via characters.json), so it keeps
      // Lucilius's and Versusia's early-day uploads and still refuses, e.g., a
      // pre-release showcase or a stray "ID" before 2026-09-15.
      const early = out2.ok.flatMap((s) =>
        s.characters.filter((id) => day < (charById.get(id)?.extra?.released ?? PRE_RELEASE)),
      );
      if (early.length) {
        bump(tally.misses, 'before-release');
        bump(hist.otherMisses, durationBucket(v.durationSec));
        if (tally.beforeRelease.length < 10)
          tally.beforeRelease.push({ id: v.id, title: v.title, characters: early });
        continue;
      }
      // THE EX MARK, validated: only on a fighter with an EX mode, only on or
      // after that mode shipped. Anything else is RESIDUE — counted and shown,
      // never a mark (decided 2026-09-29).
      for (const [i, s] of out2.ok.entries()) {
        for (const id of s.ex ?? []) {
          const since = charById.get(id)?.extra?.exSince;
          if (since && day >= since) continue;
          tally.exInvalid++;
          const key = since ? `EX on ${id} before ${since}` : `EX on ${id} (no EX mode)`;
          residue.set(key, (residue.get(key) ?? 0) + 1);
        }
        const valid = (s.ex ?? []).filter((id) => {
          const since = charById.get(id)?.extra?.exSince;
          return !!since && day >= since;
        });
        if (valid.length) {
          sides[i]!.ex = valid;
          tally.exMarked++;
        }
        for (const k of s.skins ?? []) bump(tally.skins, k);
      }
      for (const s of out2.ok) {
        bump(tally.slot, s.slotOrder);
        if (s.tieBroken) tally.tieBroken++;
        bump(handleWords, String(s.handle.split(/\s+/).length));
      }

      const season = seasonForDate(day);
      const w = patchForDate(day, windows);
      const patch = w && w.season === season ? w.version : seasonToken(season);
      // A title's version token, when present, against the date-derived patch
      // — a cross-check on date attribution, never an input to it.
      if (out2.versionToken) {
        if (!w) tally.versionAgree.unknown++;
        else if (sameVersion(w.version, out2.versionToken)) tally.versionAgree.game++;
        else tally.versionAgree.neither++;
      }

      tally.parsed++;
      bump(hist.records, durationBucket(v.durationSec));
      const [s0, s1] = sides as [MatchSide, MatchSide];
      out.push({
        id: v.id,
        channel: ch.source,
        intake: ch.id,
        title: normalizeText(v.title),
        publishedAt: v.publishedAt,
        durationSec: v.durationSec,
        ...(v.viewCount ? { viewCount: v.viewCount } : {}),
        season,
        patch,
        sides: [s0, s1],
      });
    }
    perChannel.set(ch.id, tally);
    durations.set(ch.id, hist);
    if (ch.frozen) frozenBuilt.set(ch.id, out);
    else built.push(...out);
  }

  // ── --seed-freeze-pins: print, refuse to write ───────────────────────────
  if (SEED_FREEZE_PINS) {
    const frozen = CHANNELS.filter((c) => c.frozen);
    if (frozenBuilt.size === 0) {
      console.error(
        `✖ --seed-freeze-pins found no frozen dump. Fetch one first:\n` +
          frozen.map((c) => `    npm run data:fetch -- --only=${c.id} --include-frozen`).join('\n'),
      );
      process.exit(1);
    }
    console.log('▶ freeze-pin seeding — DRY RUN, nothing written\n');
    for (const [id, rs] of frozenBuilt) {
      const t = perChannel.get(id) ?? emptyTally(MIN_MATCH_SEC);
      const missLine = Object.entries(t.misses)
        .sort((a, b) => b[1] - a[1])
        .map(([k, n]) => `${k} ${n}`)
        .join(' · ');
      console.log(
        `  ${id}: ${t.raw} raw · ${t.marked} marked · ${rs.length} parsed\n` +
          `    misses: ${missLine || 'none'}\n` +
          `    → set \`frozen.records: ${rs.length}\` on ${id} in scripts/channels.ts, then run\n` +
          `      \`npm run data:parse\` with raw/${id}.json still in place. That run asserts the\n` +
          `      parse against the pin and writes the records; every later run carries them.`,
      );
    }
    return;
  }

  console.log(
    `▶ title parse: ${built.length} record(s) from ${perChannel.size} channel(s)` +
      (frozenBuilt.size ? ` + ${[...frozenBuilt.keys()].join(', ')} from a frozen dump` : ''),
  );
  await writeReportAndData({
    built,
    frozenBuilt,
    committed,
    overrides,
    pins,
    residue,
    queue,
    perChannel,
    rawSeen,
    durations,
    handleWords,
    matcher,
    characters,
  });
}

// isMain, not a bare call: parseTitle/parseSide are exported so a control can
// exercise the orientation logic without running the pipeline (roster.ts and
// seasons.ts guard their entry points the same way).
const entry = process.argv[1];
const isMain = !!entry && import.meta.url.endsWith(entry.split('/').pop() ?? '');
if (isMain) main();
