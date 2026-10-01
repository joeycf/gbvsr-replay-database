/**
 * Shared roster vocabulary — text normalization, SPAN EXTRACTION, the EX mark,
 * the skin vocabulary, player ids — plus the vendor-facing half: the scrape
 * that re-checks Cygames' own site against what we committed.
 *
 * Ported from Strive's scripts/roster.ts, whose machinery is game-agnostic and
 * was measured hard; what changes here is every word list, and each one is
 * measured on THIS corpus (2026-09-29, the Stage 0 recon: 9,684 hydrated titles
 * on the dominant channel, full playlist walks of three more, 23,894 Replay
 * Theater rows).
 *
 * ── NORMALIZATION ───────────────────────────────────────────────────────────
 * Strive's fold, unchanged: NFC, the FULLWIDTH FORMS block by arithmetic, the
 * curly apostrophe, space-likes, in-word hyphens, zero-width removal. It
 * matters more here than on Strive: yumegiwa writes every fighter inside
 * FULLWIDTH parentheses — `【加奈人（siegfried ジークフリート）VS …】` — and
 * 格闘ゲーム研究所 and the dominant channel carry fullwidth and U+3000
 * spacing in handles. As on Strive, the control for this exercises IDENTITY
 * (one player, not two), never the parse rate — `\s` in JS already covers
 * U+3000, so "does it still parse" passes with no normalization at all.
 *
 * ── CHARACTER MATCHING IS SPAN EXTRACTION, NEVER A SEPARATOR SPLIT ─────────
 * Checklist 5c. GBVSR's hazards are not punctuation inside names (the roster
 * has none) but NESTING and PREFIXES: `Avatar Belial` contains `Belial`, the
 * Japanese `アバタール・ベリアル` contains `ベリアル`, and the dominant channel
 * writes `(EX Narmaya)` and `(Narmaya B.Butterfly)`. Longest-first
 * alternation makes `avatar-belial` absorb its inner `belial`; the EX mark and
 * the skin names are read by their own functions below, never as characters.
 */

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { CharacterRecord } from '../types/index';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Space-like characters that are not U+0020, folded to a plain space.
 *  WRITTEN AS ESCAPES, NEVER AS LITERALS — the point of this list is that the
 *  characters are invisible, so a literal diff would show nothing at review. */
const SPACE_LIKE = /[\u00A0\u1680\u2000-\u200A\u202F\u205F\u3000]/g;
/** In-word hyphens, folded to ASCII '-'. Em/en dashes are SEPARATORS in these
 *  titles and are deliberately not here. */
const IN_WORD_HYPHEN = /[\u2010\u2011\u2012\u2212\uFE63\u00AD]/g;
/** Zero-width and directional marks, deleted outright. */
const ZERO_WIDTH = /[\u200B-\u200F\u2060\uFEFF\u061C\u180E]/g;
/** FULLWIDTH FORMS of printable ASCII, U+FF01–U+FF5E → codepoint − 0xFEE0.
 *  Folds yumegiwa's `（ ）` to `( )`. Halfwidth katakana is NOT folded. */
const FULLWIDTH = /[\uFF01-\uFF5E]/g;
const CURLY_APOSTROPHE = /\u2019/g;

/** NFC + fullwidth fold + space folding + zero-width removal + collapse. */
export function normalizeText(s: string): string {
  return s
    .normalize('NFC')
    .replace(FULLWIDTH, (c) => String.fromCodePoint(c.codePointAt(0)! - 0xfee0))
    .replace(CURLY_APOSTROPHE, "'")
    .replace(SPACE_LIKE, ' ')
    .replace(IN_WORD_HYPHEN, '-')
    .replace(ZERO_WIDTH, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function loadCharacters(): Promise<CharacterRecord[]> {
  const raw = await readFile(join(ROOT, 'data', 'characters.json'), 'utf8');
  const characters = JSON.parse(raw) as CharacterRecord[];
  if (characters.length === 0) {
    throw new Error('data/characters.json is empty — run `npm run data:characters` first.');
  }
  return characters;
}

/**
 * The lookup key an alias and a matched literal share. KEEPS EVERY UNICODE
 * LETTER: a third of this roster's aliases are Japanese, and an [a-z0-9]
 * filter would key every one of them to the empty string (Strive's header has
 * the full story). scripts/characters.ts asserts alias uniqueness through THIS
 * function, never a lookalike.
 */
export const aliasKey = (s: string): string =>
  normalizeText(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');

export interface AliasMatch {
  id: string;
  /** [start, end) span of the alias inside the NORMALIZED text. */
  start: number;
  end: number;
  literal: string;
}

export interface AliasMatcher {
  /** All character matches, longest-alias-first, overlaps suppressed. */
  find(text: string): AliasMatch[];
  /** Ordered, de-duplicated ids — first appearance first. */
  ids(text: string): string[];
  /** The single character a fragment names, or null when it names zero or 2+. */
  one(text: string): string | null;
  /** What no span covered, minus separator punctuation and known decoration. */
  residue(text: string): string;
  aliasCount: number;
}

/**
 * Decoration that is never part of a handle or a name — measured on this
 * corpus's title grammars. Kept narrow on purpose: the residue gate is only
 * useful if it still reports real words.
 *
 * `EX` IS DELIBERATELY ABSENT. The user's rule (2026-09-29): an EX mark on any
 * fighter other than Gran, Djeeta or Narmaya, or before Ver 2.20, is RESIDUE —
 * reported, never swallowed. parse.ts consumes the valid ones before the
 * residue is taken, so only the invalid ones reach this function.
 *
 * The CJK terms sit outside the `\b` group: JS spells `\b` off `\w`, so a CJK
 * stopword inside the anchored group is dead text that looks like it works.
 */
const RESIDUE_NOISE = new RegExp(
  [
    'gbvs\\s*r?',
    'グラブル\\s*(?:vs|ＶＳ)?|ライジング|グランブルーファンタジー|ヴァーサス|ランクマ(?:ッチ)?|対戦|大会|動画|配信',
    // yumegiwa's weekly tournament names — the label on its whole-tournament
    // VODs, which carry no `vs` and are correct rejections.
    '(?:金曜|日曜|土曜)(?:だから|から|だし)?夜更か?し',
    '\\b(?:granblue|fantasy|versus|rising|vs|ft|feat|and|the|of|match|matches|' +
      'replay|replays|gameplay|high|level|rank|ranked|masters?|online|on-line|trailer|teaser|' +
      'reveal|official|restream|' +
      'jpn|tournament|set|sets|round|rounds|season|dlc|patch|update|ver|version|new|full|' +
      'best|top|pro|player|players|final|finals|grand|semi|winners|losers|pools|' +
      'hd|4k|1080p|1440p|60fps|shorts|short|live|stream|clip|clips|highlight|highlights|no)\\b',
    '[^\\p{L}\\p{N}]+',
    '\\d+(?:st|nd|rd|th)?',
  ].join('|'),
  'giu',
);

/**
 * Build the matcher. LONGEST-FIRST IS THE CORRECTNESS ARGUMENT: `Avatar Belial`
 * must win over the `Belial` inside it, in both scripts. The boundary guards
 * `(?<![\p{L}\p{N}])…(?![\p{L}\p{N}])` make a mid-word match impossible
 * independently — which is also why `ID` inside `IDOL` or `Id` inside a word
 * never fires, and why the fighter `id` is safe to have as an alias at all.
 */
export function buildAliasMatcher(characters: CharacterRecord[]): AliasMatcher {
  const pairs: { alias: string; id: string }[] = [];
  for (const c of characters) {
    const aliases = (c.extra?.aliases as string[] | undefined) ?? [];
    for (const a of [c.name, ...aliases]) pairs.push({ alias: normalizeText(a), id: c.id });
  }
  pairs.sort((a, b) => b.alias.length - a.alias.length || a.alias.localeCompare(b.alias));

  // Every run of this punctuation matches any amount of it, including none:
  // one entry for `Avatar Belial` covers `AvatarBelial`, `Avatar-Belial` and
  // `Avatar.Belial`; one for `アバタール・ベリアル` covers it with and without
  // the katakana middle dot (U+30FB). Aliases enumerate SPELLINGS, never
  // spacing or punctuation variants.
  const FLEXIBLE = /[.?\-\s'・]/;
  const flex = (a: string) =>
    a
      .split('')
      .map((ch) =>
        FLEXIBLE.test(ch) ? "[.?\\-\\s'\\u30FB]*" : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      )
      .join('');
  // SCRIPT-AWARE BOUNDARIES, measured. yumegiwa writes each fighter in English
  // then Japanese, usually `（cagliostro カリオストロ）` but sometimes GLUED —
  // `cagliostroカリオストロ`, `katalinaカタリナ`, `fastivaファスティバ` — and a
  // blanket `(?![\p{L}\p{N}])` guard matches NEITHER half there, because each is
  // a letter to the other. So a LATIN alias is guarded only against Latin
  // letters and digits, and a CJK alias only against kana, kanji and the long
  // mark: the script change itself is the boundary. The mid-word protection the
  // guard exists for survives intact within each script (`メイ` still cannot
  // fire inside `メイド`, `Meg` not inside `Megaman`).
  // SHORT ALIASES KEEP THE STRICT GUARD. `Id` and `2B` are two characters, and
  // a two-letter Latin token beside kana is exactly `IDカード` (ID card) — a
  // false fighter where a miss is merely reported. Measured: no title in the
  // recon glues either one to kana.
  const LATIN_ONLY = /^[A-Za-z0-9.?\-\s'∞,]+$/;
  const guarded = (alias: string): string => {
    const body = flex(alias);
    const letters = alias.replace(/[^\p{L}\p{N}]/gu, '');
    if (letters.length <= 2) return `(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])`;
    if (LATIN_ONLY.test(alias)) return `(?<![A-Za-z0-9])${body}(?![A-Za-z0-9])`;
    const cjk = '\\p{Script=Hiragana}\\p{Script=Katakana}\\p{Script=Han}\\u30FC';
    return `(?<![${cjk}])${body}(?![${cjk}])`;
  };
  const RE = new RegExp(`(?:${pairs.map((p) => guarded(p.alias)).join('|')})`, 'giu');
  const byKey = new Map<string, string>();
  for (const p of pairs) byKey.set(aliasKey(p.alias), p.id);

  const resolve = (literal: string): string | undefined => byKey.get(aliasKey(literal));

  const find = (text: string): AliasMatch[] => {
    const t = normalizeText(text);
    const out: AliasMatch[] = [];
    RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = RE.exec(t)) !== null) {
      const id = resolve(m[0]);
      if (id) out.push({ id, start: m.index, end: m.index + m[0].length, literal: m[0] });
      if (m[0].length === 0) RE.lastIndex += 1;
    }
    return out;
  };

  const ids = (text: string): string[] => {
    const seen: string[] = [];
    for (const m of find(text)) if (!seen.includes(m.id)) seen.push(m.id);
    return seen;
  };

  return {
    find,
    ids,
    one: (text) => {
      const found = ids(text);
      return found.length === 1 ? found[0]! : null;
    },
    residue: (text) => {
      const t = normalizeText(text);
      const spans = find(t);
      let prev = 0;
      const gaps: string[] = [];
      for (const s of spans) {
        gaps.push(t.slice(prev, s.start));
        prev = s.end;
      }
      gaps.push(t.slice(prev));
      return gaps.join(' ').replace(RESIDUE_NOISE, ' ').replace(/\s+/g, ' ').trim();
    },
    aliasCount: byKey.size,
  };
}

// ── THE EX MARK ─────────────────────────────────────────────────────────────
/**
 * Ver 2.20 (2025-08-04) added an EX character MODE for Gran, Djeeta and
 * Narmaya — different moves, shared ranks, separate ranked records. The vendor
 * roster and ComboForge list 40 fighters with no EX rows, so EX is a MARK on a
 * base character, never a character (user decision 2026-09-29).
 *
 * The spellings, measured: the dominant channel writes `(EX Narmaya)` (250
 * sides); Replay Theater labels `Narmaya (EX)` / `Djeeta (EX)` / `Gran (EX)`
 * (244 rows); the official channel `ジータ(EX)`. So an EX token IMMEDIATELY
 * before a span, or a bracketed/bare EX token immediately after it, marks that
 * span. Nothing further away does — a stray "EX" elsewhere in a title is
 * residue, not a mark.
 *
 * THIS FUNCTION ONLY FINDS THE TOKEN. Whether the mark is VALID — the fighter
 * is one of the three and the date is on or after Ver 2.20 — is decided by
 * parse.ts against characters.json's `exSince`, and an invalid mark is
 * reported as residue.
 */
export interface ExToken {
  /** The span the token is attached to. */
  match: AliasMatch;
  /** [start, end) of the EX token itself in the normalized text. */
  start: number;
  end: number;
}

const EX_BEFORE = /(?<![\p{L}\p{N}])EX\s*$/iu;
const EX_AFTER = /^\s*(?:\(\s*EX\s*\)|\[\s*EX\s*\]|EX(?![\p{L}\p{N}]))/iu;

export function findExTokens(text: string, matches: AliasMatch[]): ExToken[] {
  const t = normalizeText(text);
  const out: ExToken[] = [];
  for (const m of matches) {
    const before = EX_BEFORE.exec(t.slice(0, m.start));
    if (before) {
      out.push({ match: m, start: before.index, end: before.index + before[0].length });
      continue;
    }
    const after = EX_AFTER.exec(t.slice(m.end));
    if (after) out.push({ match: m, start: m.end, end: m.end + after[0].length });
  }
  return out;
}

// ── THE SKIN VOCABULARY ─────────────────────────────────────────────────────
/**
 * Costume names the dominant channel writes INSIDE the fighter paren —
 * `(Katalina Lady Serenity)`, `(Narmaya B.Butterfly)`, `(Summer Belial)`.
 * Measured 2026-09-29 on its 9,684 hydrated titles: 1,417 sides carry one
 * (B.Butterfly 526, Crimson Bomber 212, Lady Serenity 173, Sinborne Redeemer
 * 89, Summer 79, Indigo Witch 66, No Fear No Gain 49, M.M. L∞k Up 46, Diamond
 * Heart 42, Knight of Passion 31, Knight's Finery 29, Arbitrator of the Shore
 * 14, Conqueror's Carapace 8, Reverent Attire 2, Spooky Vicky 1, plus the
 * uploader's own typos `Sumer`, `L.Serenity`, `INdigo Witch`).
 *
 * A skin is DECORATION, never a fighter and never a handle: parse.ts strips
 * these before the residue is taken and COUNTS each strip in report.md, so a
 * new costume shows up as residue (a counted line) rather than vanishing.
 * Written as spellings; the same punctuation flex as the alias matcher applies.
 */
export const SKIN_NAMES: readonly string[] = [
  'B.Butterfly',
  'Crimson Bomber',
  'Lady Serenity',
  'L.Serenity',
  'Sinborne Redeemer',
  'Summer',
  'Sumer',
  'Indigo Witch',
  'No Fear, No Gain',
  'M.M. L∞k Up',
  'Diamond Heart',
  'Knight of Passion',
  "Knight's Finery",
  'Arbitrator of the Shore',
  "Conqueror's Carapace",
  'Reverent Attire',
  'Spooky Vicky',
];

const SKIN_RE = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${[...SKIN_NAMES]
    .sort((a, b) => b.length - a.length)
    .map((s) =>
      normalizeText(s)
        .split('')
        .map((ch) =>
          /[.,\-\s']/.test(ch) ? "[.,\\-\\s']*" : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        )
        .join(''),
    )
    .join('|')})(?![\\p{L}\\p{N}])`,
  'giu',
);

/** Remove every known skin name; return the stripped text and what was cut. */
export function stripSkins(text: string): { text: string; skins: string[] } {
  const skins: string[] = [];
  const out = normalizeText(text).replace(SKIN_RE, (m) => {
    skins.push(m);
    return ' ';
  });
  return { text: out.replace(/\s+/g, ' ').trim(), skins };
}

/**
 * Slug a handle into a stable player id — the PUBLIC id, and the URL. Strive's
 * function unchanged: normalized first; ASCII slug; the Unicode-letter
 * fallback only when the ASCII slug is empty (Japanese-only handles are routine
 * on yumegiwa and 格闘ゲーム研究所).
 */
export function playerId(handle: string): string {
  const nfkd = normalizeText(handle).normalize('NFKD').toLowerCase();
  const ascii = nfkd.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (ascii) return ascii;
  return nfkd
    .replace(/\p{M}+/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Players whose handle IS a fighter's name or alias — the allow-list for
 * checklist 5n, asserted by scripts/characters.ts and by parse-finish.ts's
 * registry invariant. Evidence is a video id, one per entry: the claim is "this
 * handle sits in the PLAYER slot of that channel's grammar, and it is a
 * person". Nothing is deleted on the guard's say-so alone.
 *
 * Seeded from the Stage 0 recon (the dominant channel's 9,684 hydrated
 * titles, handle-outside grammar, so the handle is the text OUTSIDE the paren):
 *   · `UNO` — six titles. "Uno" is Anre's Japanese romanisation (ウーノ), so
 *     it is an alias, and this is a real player.
 *   (A second seed, `Yuel`, was a misread — see the note where it stood.)
 * The first parse adds the rest, each with its own evidence.
 */
export interface ConfirmedFighterNamedPlayer {
  /** playerId() of the handle. */
  id: string;
  handle: string;
  /** A record whose title confirms this is a person. */
  video: string | null;
  note: string;
}

export const CONFIRMED_FIGHTER_NAMED_PLAYERS: ConfirmedFighterNamedPlayer[] = [
  {
    id: 'uno',
    handle: 'UNO',
    video: 'M7edShNVFY8',
    note: 'highLevelReplays, 6 titles at recon, handle-outside. Resolves to anre via the JP romanisation "Uno" (ウーノ).',
  },
  // NOT `yuel`. The recon read J95ykXUEg1A ("Roki (Beelzebub) Vs Yuel
  // (Yuutyaso)") as a player named Yuel; the catalogue's own row for that video
  // is "Yuutyaso (Yuel)" — side 2 is written fighter-first, the player is
  // Yuutyaso. Removed 2026-10-01 when the first real parse reported the row
  // stale. That title stays a no-char reject.
  // Adjudicated 2026-09-29 from the first (rehearsal) parse's registry
  // invariant, each from its own title: the handle sits in the PLAYER slot of
  // that intake's grammar and plays a DIFFERENT fighter where that is what
  // settles it.
  {
    id: 'djeeta',
    handle: 'Djeeta',
    video: 'ihdCPrrDylg',
    note: 'kakuken "Djeeta (Wilnas) vs Laphroaig (Eustace)" — a player named Djeeta, on Wilnas.',
  },
  {
    id: 'カタリナ',
    handle: 'カタリナ',
    video: 'TL1gEukvfHs',
    note: 'yumegiwa "Revo|カタリナ（Katalina カタリナ）" — the Revo-sponsored player カタリナ, on Katalina.',
  },
  {
    id: 'nier-gojira',
    handle: 'Nier Gojira',
    video: 'UiUOrc4IF60@9315',
    note: 'Replay Theater, Socal Colosseum Clash #21 — "Nier Gojira (Versusia) vs IronGod (Nier)".',
  },
  {
    id: 'metara',
    handle: 'Metara',
    video: 'sINgpuTXwn4',
    note: 'kakuken "Metara (Wilnas) vs Miraias (Six)" — a player named Metara, on Wilnas. "Metara" is ALSO a measured typo for Metera (risingReplays "[Metara]"), so the alias stays and the tie-break files this title correctly.',
  },
  {
    id: 'belial-whatsapp',
    handle: 'Belial Whatsapp',
    video: '41yPUN46DJg@486',
    note: 'Replay Theater — "Belial Whatsapp (Belial)" beside Professor Nekotech; a tournament handle.',
  },
  // From the backfill walk (2026-10-01): fgHighLevel's full playlist, of which
  // the recon had sampled 25 titles. Handle-outside grammar, the fighter in
  // the paren — each handle is a person who NAMES a fighter.
  {
    id: 'no1-ilsa-simp',
    handle: '№1 ILSA SIMP',
    video: 'wjYjYxOmJus',
    note: 'fgHighLevel "ZenciAdam321 (Katalina) Vs №1 ILSA SIMP (Beatrix)" — a player, on Beatrix.',
  },
  {
    id: 'cat-ferry',
    handle: 'Cat&Ferry',
    video: '9jtnwMN2z84',
    note: 'fgHighLevel "Cat&Ferry (Katalina) Vs Nilma (Ladiva)" — a player, on Katalina.',
  },
  {
    id: 'ferry-slil-tier3',
    handle: "Ferry'sLil'Tier3",
    video: 'n8W1z9CDFVc',
    note: 'fgHighLevel "Aww Yeee (Versusia) Vs Ferry\'sLil\'Tier3 (Ferry)" — a player, on Ferry (2 sides).',
  },
];

// ── VENDOR SCRAPE ───────────────────────────────────────────────────────────
// Everything below talks to rising.granbluefantasy.jp and answers one
// question: does Cygames still ship the roster data/characters.json says?
//
// TWO INDEPENDENT ENUMERATIONS, the Strive discipline: the English grid's
// `detail?char=<slug>` hrefs, and the Japanese grid's portrait alts. The two
// pages are separate templates in separate languages; if they disagree on the
// COUNT, one extraction is broken and neither is trusted. Verified 2026-09-29:
// 40 slugs, 40 English names, 40 Japanese names.

const SITE = 'https://rising.granbluefantasy.jp';
const PACING_MS = 300;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: { 'user-agent': 'gbvsr-replay-database/roster-check' } });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  await sleep(PACING_MS);
  return res.text();
}

/** Alt texts that are chrome, not characters (platform badges, the publisher). */
const NOT_A_FIGHTER_ALT = new Set([
  'PlayStation4/PlayStation5',
  'Steam',
  'NINTENDO Switch2',
  'Cygames',
]);

export interface RosterScrape {
  /** Vendor slugs from the English grid's hrefs, in page order. */
  slugs: string[];
  /** English display names (portrait alts), in page order. */
  namesEn: string[];
  /** Japanese display names (portrait alts), in page order. */
  namesJa: string[];
  /** "Additional Character Set (X)" names from the DLC page. */
  dlc: string[];
}

export async function scrapeRoster(): Promise<RosterScrape> {
  const en = await get(`${SITE}/en/characters/`);
  const slugs: string[] = [];
  for (const m of en.matchAll(/href="[^"]*detail\?char=([a-z0-9]+)"/g))
    if (!slugs.includes(m[1]!)) slugs.push(m[1]!);
  const alts = (html: string) =>
    [...html.matchAll(/alt="([^"]+)"/g)].map((m) => m[1]!).filter((a) => !NOT_A_FIGHTER_ALT.has(a));
  const namesEn = alts(en);
  const namesJa = alts(await get(`${SITE}/character/`));
  const dlcPage = await get(`${SITE}/en/dlc/character/`);
  const dlc = [
    ...new Set(
      [...dlcPage.matchAll(/Additional Character Set \(([^)]+)\)/g)].map((m) => m[1]!.trim()),
    ),
  ];
  return { slugs, namesEn, namesJa, dlc };
}
