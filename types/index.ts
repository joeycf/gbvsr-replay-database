// Pipeline-track types (plain node/tsx code — never enters the Nuxt graph, so
// the engine contract is restated where emitted shapes must mirror it, exactly
// like every sibling pipeline does).
//
// Ported from Strive's (ggst types/index.ts) because the parser is Strive's;
// three additions come from later siblings — Avatar's per-channel fetch floor
// (`fetchFrom`, checklist 1b), SF6's `unplayable` freeze evidence (checklist
// 7c) and Avatar's report-only match signature (checklist 2b) — and three are
// GBVSR's own: the EX mark, the per-fighter release floor, and the dominant
// channel's silence alarm.

/** The Replay.source contract: doubles as GameConfig.sourceChannels[].id
 *  (badge/filter). Grouping into Online/Tournament chips lives ONLY in
 *  app/app.config.ts sourceGroups; group ids never appear in data or URLs.
 *
 *  1:1 with ChannelKey today. `replayTheater` is ONE token covering both arms
 *  of the catalogue (tagged tournament sets, untagged whole videos), as on
 *  every sibling. */
export type SourceId =
  | 'highLevelReplays'
  | 'kakuken'
  | 'gbvsReplayChannel'
  | 'yumegiwa'
  | 'risingReplays'
  | 'gbFightingReplays'
  | 'gbvsrReplay'
  | 'fgHighLevel'
  | 'replayTheater';

/**
 * Per-intake key: names raw/<key>.json and the coverage report's rows. THE
 * DEDUPE KEY (checklist step 2) — never the SourceId, which two channels may
 * one day deliberately share. Kept a separate union for that reason even while
 * it is 1:1.
 */
export type ChannelKey =
  | 'highLevelReplays'
  | 'kakuken'
  | 'gbvsReplayChannel'
  | 'yumegiwa'
  | 'risingReplays'
  | 'gbFightingReplays'
  | 'gbvsrReplay'
  | 'fgHighLevel'
  | 'replayTheater';

/**
 * Which side segment of a title holds the characters.
 *
 * The parser RESOLVES rather than counts slots: it asks which side of a bracket
 * resolves to a roster alias and takes the remainder as the handle. The
 * declared order is the tie-breaker ONLY where BOTH sides resolve (checklist
 * 5m) — a real player named after a fighter, `UNO (Anre)`. Measured 2026-09-29
 * on 50-title samples per channel, both sides: every live channel is
 * handle-outside except gbvsReplayChannel, and no sample side resolved on both
 * spans. The branch ships from the first parse anyway; the tally is printed.
 *
 *  'handle-outside'    HANDLE (Character)       — highLevelReplays, kakuken,
 *                                                 yumegiwa（EN JP）, and every
 *                                                 frozen channel ([ ] on two)
 *  'chars-outside'     CHARACTER (handle)       — no GBVSR channel today; kept
 *                                                 so a flipped channel lands in
 *                                                 a named branch, not a guess
 *  'handle-first-bare' Handle Character VS …    — gbvsReplayChannel, no
 *                                                 brackets, the fighter LAST
 *
 * There is no 'chars-only': a side with no handle must never become a record
 * (checklist 5r — the official channel's staff matches are that shape).
 */
export type SlotOrder = 'handle-outside' | 'chars-outside' | 'handle-first-bare';

/**
 * An INDEX source: a third-party catalogue that points AT video rather than
 * hosting it (checklist step 12).
 *
 * ONE LABEL, TWO GAMES. Measured 2026-09-29 over the full sweep (23,894
 * entries): every row reads `game: "Granblue Fantasy: Versus"`, including the
 * 10,459 rows (43.8%) from 2019-12 to 2023-11 that are the ORIGINAL game. The
 * per-entry label gate (12a) passes all of them, so it cannot be the game gate
 * here — `admitFrom` is.
 */
export interface ChannelIndex {
  /** Catalogue endpoint, paged with &page=N. */
  endpoint: string;
  /** The index's own token for this game — `gbvs`, NOT our slug `gbvsr` and
   *  not ComboForge's `gbvsr` either. */
  slug: string;
  /** The game string each ENTRY states about itself. Checked per entry (12a),
   *  and NECESSARY but not SUFFICIENT on this catalogue — see `admitFrom`. */
  gameLabel: string;
  /** THE RISING GATE. The video's own publishedAt must be on or after this
   *  date (the vendor-stated early access, 2023-12-11). A date gate, not a
   *  title marker: 23 post-launch VODs title Rising "GBVS", which a marker-only
   *  gate would drop. */
  admitFrom: string;
  /** Entries per page. Theirs, not ours. 478 pages at 50. */
  pageSize: number;
  /** ms between requests — politeness, not rate-limit avoidance. */
  pacingMs: number;
  /** Untagged entries are ADMITTED as a source, not only kept as a witness. */
  admitUntagged: boolean;
}

/** SF6's 7c evidence block: a channel whose VIDEOS are gone, not just its
 *  uploads. Measured, never inferred from a sample. */
export interface UnplayableEvidence {
  /** ISO date the deadness was measured. */
  checked: string;
  /** How many of the carried ids videos.list returned (0 = all gone). */
  alive: number;
  /** How many ids were checked. */
  checkedIds: number;
  note: string;
}

export interface FreezePin {
  since: string;
  reason: string;
  /** The hard-asserted carried count. `-1` until seeded from the first parse —
   *  a sentinel that THROWS, so an unseeded freeze cannot ship as an empty one
   *  (the Strive idiom). */
  records: number;
  /** Present only when the channel's videos no longer play (checklist 7c). */
  unplayable?: UnplayableEvidence;
  /** The last day a human looked at this frozen channel (resumed? deleted?).
   *  scripts/expiries.ts goes red FROZEN_REVIEW_DAYS after it. */
  reviewedAt?: string;
}

export interface ChannelConfig {
  /** Raw-dump key / report row (unique per intake). */
  id: ChannelKey;
  /** The source this channel's replays publish under. */
  source: SourceId;
  /** Display name (mirrors app/app.config.ts sourceChannels[].name). */
  name: string;
  /** YouTube channel id. Absent on an `index` source. */
  channelId?: string;
  /** The uploads playlist (UU + channelId.slice(2), pinned). */
  uploadsPlaylist?: string;
  /** This intake is a third-party INDEX. Built by scripts/fetch-theater.ts. */
  index?: ChannelIndex;
  /** The tie-breaker for a side where BOTH spans resolve. See SlotOrder. */
  slotOrder: SlotOrder;
  /** CRON-FETCHED, WITH A CARRY FALLBACK (the index intake). */
  cronFetchedWithCarry?: boolean;
  /**
   * The FETCH floor (checklist 1b): the uploads walk STOPS after the first page
   * whose newest item is older than this, and nothing older is hydrated. Set on
   * every channel with pre-Rising history — the parse floor alone would still
   * pay to walk and hydrate a multi-game channel's whole back catalogue every
   * morning. The marker gate still runs on everything the walk keeps.
   */
  fetchFrom?: string;
  /** Per-channel duration floor in seconds, in place of MIN_MATCH_SEC (120). */
  minDurationSec?: number;
  /**
   * The SILENCE ALARM, in days: scripts/expiries.ts goes red when this
   * channel's newest committed upload is older than this. Set only where a
   * silence means something — the dominant channel, measured 2026-09-29:
   * longest gap between uploads over the preceding 12 months 4.42 days
   * (2026-02-16 01:00 → 02-20 11:00; 363 of 366 days carry an upload). The
   * rule the user set: derive it from that measurement with margin, and if the
   * gap is 5 days or less, 7 stands. It is 7.
   */
  silenceAlarmDays?: number;
  /** A channel that stopped publishing this game: committed records CARRIED,
   *  fetch skips it, `records` hard-asserted every run (checklist 7). */
  frozen?: FreezePin;
}

/** One upload as fetched from the YouTube Data API (raw/<key>.json). */
export interface RawVideoRecord {
  id: string;
  /** Intake channel, NOT the source — parse maps it via CHANNELS. */
  channel: ChannelKey;
  title: string;
  description: string;
  publishedAt: string; // ISO
  /** ISO8601 duration decoded to seconds; 0 = live/upcoming/unknown. */
  durationSec: number;
  viewCount?: number;
  /** 'none' for normal VODs; 'live'/'upcoming' are excluded by parse. */
  liveBroadcastContent: string;
  tags?: string[];
}

/**
 * One record in raw/replayTheater.json — an index entry already joined to its
 * VOD's YouTube metadata. Nothing here is recovered by parsing a title.
 */
export interface TheaterRawRecord extends RawVideoRecord {
  /** `${videoId}@${startSeconds}` for a SEGMENT; the plain YouTube id for a
   *  whole-video entry (checklist 12b). */
  id: string;
  /** The catalogue's own entry id. Provenance, and the fetch resume key. */
  theaterId: number;
  /** The YouTube id this record lives in or is. */
  videoId: string;
  /** Offset into videoId, in seconds. Absent = the whole video. */
  startSeconds?: number;
  /** The catalogue's event tag, '' on the untagged arm — and '' too when the
   *  tag is a SET FORMAT (`FT5` is the catalogue's single most common tag, 732
   *  rows) rather than an event (checklist 12k). The raw tag is kept in
   *  `rawTag` for the report. */
  tag: string;
  rawTag?: string;
  /** The VOD's own uploader, for the report and `channelName`. */
  uploader: string;
  /** [side0, side1] handles exactly as the catalogue spells them. */
  players: [string, string];
  /** [side0, side1] character labels exactly as the catalogue spells them —
   *  `Gran (EX)` included; the parser resolves the EX mark. */
  characters: [string[], string[]];
}

/** Which stage produced a side's characters. Ordered weakest → strongest.
 *  No footage-extraction tier: every intake's titles state both fighters. */
export const CHAR_TIERS = ['title', 'index', 'human'] as const;

export type CharTier = (typeof CHAR_TIERS)[number];

/** Per-side character provenance (checklist 8b). SUBSTRATE ONLY — never
 *  emitted; scripts/emit.ts projects field-by-field and asserts it. */
export interface CharProvenance {
  tier: CharTier;
  tiers: CharTier[];
  fromTitle: string[];
  fromIndex?: string[];
  fromHuman?: string[];
  slotOrder?: SlotOrder;
  tieBroken?: boolean;
  conflict?: boolean;
  complete: boolean;
}

/** One parsed side: one player, and every character they fielded (1..N,
 *  first-appearance order — more than one is a counter-pick inside a set). */
export interface MatchSide {
  /** Player id (slug of handle). */
  player: string;
  /** Display handle, nicest casing seen. */
  handle: string;
  /** Roster character ids (data/characters.json), 1..N. */
  characters: string[];
  /**
   * The characters on this side that the SOURCE MARKED as EX mode (Ver 2.20,
   * 2025-08-04: Gran, Djeeta and Narmaya only). POSITIVE EVIDENCE ONLY, decided
   * by the user 2026-09-29: present when the title or the catalogue label says
   * EX; ABSENT otherwise — never an empty "base" claim, because a channel that
   * never writes EX would otherwise read as base with no evidence. An "EX"
   * before 2.20 or on any other fighter is residue, never a mark.
   */
  ex?: string[];
  /** How this side's characters were sourced. Substrate only. */
  provenance: CharProvenance;
}

/** The committed parse substrate (data/videos.json). */
export interface MatchVideo {
  id: string;
  /** Resolved source (Replay.source), not the intake channel. */
  channel: SourceId;
  /** The INTAKE channel — the dedupe key (checklist step 2). */
  intake: ChannelKey;
  title: string;
  publishedAt: string;
  durationSec: number;
  viewCount?: number;
  /** Balance era token — a SEASON, resolved from the date boundaries in
   *  scripts/seasons.ts. The vendor names two: Season 1 (1.x) and Season 2
   *  (opened with Ver 2.00 by the vendor's own words). */
  season: number;
  /** The vendor patch token in force on `publishedAt`, e.g. '2.60'. */
  patch: string;
  /** The YouTube id, when `id` is not it. */
  videoId?: string;
  /** Where this record's footage starts inside `videoId`, in seconds. */
  startSeconds?: number;
  /** Badge label (engine v0.13.0): the catalogue's event tag. */
  event?: string;
  /** The VOD's uploader, only where it differs from the configured name. */
  channelName?: string;
  /** SF6's 7c per-record stamp: derived each run from the channel config,
   *  never stored as the source of truth. Substrate only — never emitted. */
  unplayable?: true;
  sides: [MatchSide, MatchSide];
}

/** data/source-pins.json — the carry pin for every `cronFetchedWithCarry`
 *  intake. */
export type SourcePins = Partial<Record<ChannelKey, number>>;

/** data/players.json entry (mirrors the engine's Player). */
export interface PlayerRecord {
  id: string;
  handle: string;
  featured?: boolean;
  extra?: { aliases?: string[] };
}

/** data/characters.json entry (mirrors the engine's Character). */
export interface CharacterRecord {
  id: string;
  name: string;
  imgPortrait: string;
  imgSplash?: string;
  accent: string;
  extra?: {
    aliases: string[];
    /** The vendor's own page key (`detail?char=<slug>`). Differs from our id
     *  exactly once: `avatarbelial` vs `avatar-belial`. */
    siteSlug?: string;
    /** The vendor's Japanese display name. */
    nameJa?: string;
    /** First day this fighter was playable (checklist: release floor). */
    released?: string;
    /** Present only on the three fighters with an EX mode. */
    exSince?: string;
    [k: string]: unknown;
  };
}

/** Per-video manual corrections (data/overrides.json). */
export type VideoOverride = Partial<Pick<MatchVideo, 'season' | 'patch' | 'sides' | 'channel'>> & {
  '//'?: string;
  exclude?: boolean;
  resolvedBy?: 'human';
};

/**
 * The REPORT-ONLY match identity (checklist 2b, Avatar's shape): normalized
 * handle pair × fighter pair × day. A HYPOTHESIS about footage identity, never
 * a dedupe key — the rematch on the dominant channel is a legitimate collision.
 */
export interface MatchSignature {
  players: [string, string];
  characters: [string, string];
  playedOn: string;
}

/** One pending item in data/review-queue.json. REGENERATED by every parse. */
export interface ReviewQueueItem {
  id: string;
  kind:
    | 'character-completion'
    | 'source-classification'
    | 'index-conflict'
    | 'slot-ambiguous'
    | 'duplicate-candidate';
  channel: ChannelKey;
  title: string;
  publishedAt: string;
  durationSec: number;
  handles?: [string, string];
  conflict?: { side: 0 | 1; fromTitle: string[]; fromIndex: string[] };
  readings?: { handle: string; characters: string[] }[];
  /** For 'duplicate-candidate' ONLY: the one kind whose records STAY
   *  published — it is a report, not a hold. */
  duplicates?: { signature: MatchSignature; ids: string[] };
}

/** One balance era (a vendor-named Character Pass season). */
export interface SeasonBoundary {
  season: number;
  start: string; // ISO date, inclusive
  end: string | null; // exclusive; null = open (current season)
  confirmed: boolean;
  /** The version major this era opens on. A CROSS-CHECK here, not the
   *  authority: the authority is the vendor's own sentence naming the season
   *  (see scripts/seasons.ts). */
  versionMajor: number;
  label?: string;
  note?: string;
}

/**
 * One released GBVSR patch. The vendor's grammar is `X.Y` or `X.YY` — "Version
 * 1.1" is spelled with one digit and is NOT invented into "1.10". Absent
 * numbers stay absent.
 */
export interface PatchBoundary {
  /** Vendor version string exactly as published, e.g. '1.1', '2.60'. */
  version: string;
  /** ISO release day, inclusive (see seasons.ts for the date authority). */
  start: string;
  /** Canonical vendor patch-notes URL. */
  url?: string;
  /** Where the vendor announced it. `launch` for 1.0, which has no post. */
  announcedOn: 'rising-news' | 'launch';
  note?: string;
}

/** A patch plus its computed window and resolved era. */
export interface PatchWindow extends PatchBoundary {
  end: string | null;
  season: number;
}

/** A time-bomb that has gone off. See scripts/expiries.ts. */
export interface Expiry {
  kind:
    | 'unreleased-character'
    | 'unconfirmed-season'
    | 'stale-patch-table'
    | 'silent-channel'
    | 'frozen-watch'
    | 'art-licence';
  /** roster id, `S${n}`, a ChannelKey, 'patch-table' or 'fan-kit' */
  id: string;
  /** the ISO date that has now passed */
  date: string;
  /** what a human must do to clear it */
  action: string;
}
