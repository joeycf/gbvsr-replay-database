/**
 * The intake table — every source this archive reads, in DEDUPE PRECEDENCE
 * order (array order IS precedence: when two intakes carry the same video, the
 * earlier one's record wins).
 *
 * ── WHAT THE STAGE 0 RECON MEASURED (2026-09-29, after all seven crons) ────
 * Channels found by the Replay Theater catalogue's own uploader list (15,458
 * videos hydrated) plus three capped web searches; per-channel volume anchored
 * to TODAY over 28 days (checklist 10k), orientation from 50-title samples per
 * channel, BOTH sides.
 *
 *   live, per day (09-01..09-28, every intake): highLevelReplays 9.79 ·
 *   yumegiwa 2.39 per-match · gbvsReplayChannel 1.61 · kakuken 0.54 · Replay
 *   Theater tagged ~0.04. Top-1 68.2%, top-3 96.0%, 14.4 uploads/day.
 *
 * THE CONCENTRATION IS THE RISK, STATED. The dominant channel is ~68% of live
 * volume and will be ~57% of the day-one archive. Without it the live flow is
 * ~3–4.5 uploads/day (21–31/week) — under the 40/week viability bar Avatar is
 * held to. It is NOT frozen (a freeze stops ingest of the platform's most
 * active channel); it is protected by the collapse guard (awake: 10% of ~8,800
 * is ~880 records), by per-channel fetch error handling (scripts/fetch.ts, the
 * SF6 7c lesson), by its silence alarm (`silenceAlarmDays`, measured), and by
 * the per-intake departures line in report.md, which exists because this
 * channel deleted a stretch of its own back catalogue at 2–3 videos a day for
 * nine months (Nov 2024–Jul 2025) — too slow for the guard, too steady for the
 * alarm.
 *
 * The brief's "92% of live volume on one channel" is REPLAY THEATER'S view:
 * the catalogue indexes only this channel and kakuken, so through its eyes the
 * top channel is 88.5–94.0% of recent volume. It does not see yumegiwa or
 * gbvsReplayChannel at all.
 *
 * ── THE MARKER: `GBVSR`, NEVER BARE `GBVS` ─────────────────────────────────
 * The previous game is Granblue Fantasy: Versus (2020), and its uploads are
 * live on the same channels: highLevelReplays posted 1,068 `GBVS:` uploads
 * before Rising; kakuken holds 1,961 `[GBVS] … Granblue Fantasy Versus`
 * uploads and titled old-game footage that way ON LAUNCH DAY (2023-12-14);
 * gbvsReplayChannel 484. A `GBVS` marker ingests the previous game — the
 * Strive "GUILTY GEAR is not STRIVE" lesson, one letter shorter.
 * THE MARKER IS NOT ENOUGH ALONE, EITHER: a 2023-01 old-game title reads
 * "…GBVSR楽しみマン達の久々GBVS!" (looking forward to Rising). The date floor
 * (seasons.ts PRE_RELEASE, the vendor's early access) catches it. So a channel
 * record needs the marker AND the floor.
 *
 * ── REJECTED, AND WHY (so the next recon does not re-litigate them) ────────
 *   · @gbvs_official (Cygames): staff matches, "イド VS ジータ(EX)" — no
 *     handles, and pre-release by design (Id's was 09-13, two days before she
 *     shipped). Checklist 5r refuses it; it is not intaken at all.
 *   · グラブルvsリプレイ (2018–2020), 岡崎ヨシ (to 2023-10): old game only.
 *   · タヒチ, mono_awooFGC: streams and character guides, no pairings.
 */

import type { ChannelConfig, ChannelKey } from '../types/index';
import { PRE_RELEASE } from './seasons';

const uploads = (channelId: string) => `UU${channelId.slice(2)}`;

export const CHANNELS: ChannelConfig[] = [
  {
    // @gbfvsreplays — 10,034 uploads, ~8,960 of them Rising (1,068 are the
    // previous game, titled `GBVS:`). `GBVSR:🔥Handle (Character [skin])🔥 Vs
    // Handle (Character)🔥| High Level Gameplay.` — handle-outside 100/100.
    // Median 448 s, none under 120 s, 509 over 30 min: those are single-pairing
    // SESSIONS (same title shape), so there is deliberately no duration ceiling.
    id: 'highLevelReplays',
    source: 'highLevelReplays',
    name: 'GBVS: High Level Replays',
    channelId: 'UCDYE2Sozq0c7052TSMTE9OA',
    uploadsPlaylist: uploads('UCDYE2Sozq0c7052TSMTE9OA'),
    slotOrder: 'handle-outside',
    fetchFrom: PRE_RELEASE,
    silenceAlarmDays: 7,
  },
  {
    // @格闘ゲーム研究所 — 2,972 uploads, 941 Rising, 1,961 the previous game.
    // `[GBVSR] (4K) Granblue Fantasy Versus Rising Rank match  Handle (Char) vs
    // Handle (Char)` — handle-outside 100/100; writes "Six" for Seox.
    id: 'kakuken',
    source: 'kakuken',
    name: '格闘ゲーム研究所',
    channelId: 'UCm7jD4Tmoybchzc_iyWILoQ',
    uploadsPlaylist: uploads('UCm7jD4Tmoybchzc_iyWILoQ'),
    slotOrder: 'handle-outside',
    fetchFrom: PRE_RELEASE,
  },
  {
    // @gbvsreplaychannel — 2,407 uploads, 1,889 Rising since early access.
    // `GBVSR High Level Gameplay Handle Char VS Handle Char` — BARE, the fighter
    // LAST, 96/96 on the sample; its history also carries paren and slash
    // variants, restreams and "Rookies" titles, so it is the grammar most
    // likely to produce rejects. Writes Id as uppercase `ID`.
    id: 'gbvsReplayChannel',
    source: 'gbvsReplayChannel',
    name: 'GBVS Replay Channel',
    channelId: 'UCLhpkZHFH58u-L3ndA-Fg6A',
    uploadsPlaylist: uploads('UCLhpkZHFH58u-L3ndA-Fg6A'),
    slotOrder: 'handle-first-bare',
    fetchFrom: PRE_RELEASE,
  },
  {
    // @yumegiwahatake0079 — GGST & GBVSR & Rev2, 3,689 uploads, ~1,000 GBVSR.
    // A weekly JP double-elimination tournament: `【Handle（EN JP）VS
    // Handle（EN JP）】#GBVSR No103 金曜だから夜更かし🔥Season2` — handle-outside in
    // FULLWIDTH parens, fighter named twice (English + Japanese), sometimes two
    // per side when a player switches mid-set (`Lanslot Six`). Its whole-
    // tournament VODs ("GBVSR JPN on-line Tournament … No107") carry no `vs`
    // and fail the grammar on their own. Strive intakes the same channel for its
    // GGST half; each game pays for its own walk.
    id: 'yumegiwa',
    source: 'yumegiwa',
    name: 'yumegiwa online tournaments',
    channelId: 'UCH6fMEc6mptwnjp71tZa-lA',
    uploadsPlaylist: uploads('UCH6fMEc6mptwnjp71tZa-lA'),
    slotOrder: 'handle-outside',
    fetchFrom: PRE_RELEASE,
  },
  // ── FROZEN — stopped publishing Rising; records carried and pinned ─────────
  // All four decided by the user 2026-09-29: dormant channels are the likeliest
  // to vanish, and capturing them now is the point. Each pin starts at -1 and
  // THROWS until the first parse seeds it (`npm run data:fetch -- --only=<key>
  // --include-frozen`, then `npx tsx scripts/parse.ts --seed-freeze-pins`).
  {
    // @risingreplays — 682 uploads; last match 2024-07-14, trailers after.
    // `GBVSR - Handle [Char] vs. Handle [Char]⭐Masters Ranked Matches⭐`.
    id: 'risingReplays',
    source: 'risingReplays',
    name: 'Rising Replays',
    channelId: 'UCJsDPmFg2WJUB6e4D3SNaaA',
    uploadsPlaylist: uploads('UCJsDPmFg2WJUB6e4D3SNaaA'),
    slotOrder: 'handle-outside',
    fetchFrom: PRE_RELEASE,
    frozen: {
      since: '2024-07-14',
      reason: 'No match uploads since 2024-07-14 (only trailers after); 599 matches at recon.',
      records: -1,
      reviewedAt: '2026-09-29',
    },
  },
  {
    // @granblue_club-me9fs — 603 uploads, last 2024-10-07.
    // `GBVSR 🔥 Handle (Char) vs Handle (Char) 🔥 High Level Gameplay`.
    // ~34 of its pairings may be the same footage as highLevelReplays (±3 days,
    // sketch) — the report-only match-identity tier counts them, never drops.
    id: 'gbFightingReplays',
    source: 'gbFightingReplays',
    name: 'GBFightingReplays',
    channelId: 'UCHEKHLOTR9V1knYq7JKj8xA',
    uploadsPlaylist: uploads('UCHEKHLOTR9V1knYq7JKj8xA'),
    slotOrder: 'handle-outside',
    fetchFrom: PRE_RELEASE,
    frozen: {
      since: '2024-10-07',
      reason: 'No uploads since 2024-10-07; 596 matches at recon.',
      records: -1,
      reviewedAt: '2026-09-29',
    },
  },
  {
    // @gbvsr-replay — 1,043 uploads, 126 of them Rising (2023-12-15 → 2024-04-05),
    // then Tekken 8 only. `… [Handle(Char)] vs [Handle(Char)]`. The marker gate
    // is what keeps its Tekken back half out. Logged separately (NOT this repo's
    // business): the Tekken half is a candidate for a measured Tekken recon.
    id: 'gbvsrReplay',
    source: 'gbvsrReplay',
    name: 'GBVSR Replay',
    channelId: 'UC0S06ioCLkOUpCizRUschPw',
    uploadsPlaylist: uploads('UC0S06ioCLkOUpCizRUschPw'),
    slotOrder: 'handle-outside',
    fetchFrom: PRE_RELEASE,
    frozen: {
      since: '2024-04-05',
      reason: 'Last Rising upload 2024-04-05; the channel now uploads Tekken 8.',
      records: -1,
      reviewedAt: '2026-09-29',
    },
  },
  {
    // @fightinggamesreplay — Strive + GBVSR, 371 uploads, last 2025-04-14.
    // `Handle (Char) Vs Handle (Char) | Granblue Fantasy Versus: Rising High
    // Level`. Its Strive half belongs to a separate ggst look, not here.
    id: 'fgHighLevel',
    source: 'fgHighLevel',
    name: 'Fighting Games: High Level Gameplay',
    channelId: 'UCVzu9mRSyAxMhMCujUrhmgQ',
    uploadsPlaylist: uploads('UCVzu9mRSyAxMhMCujUrhmgQ'),
    slotOrder: 'handle-outside',
    fetchFrom: PRE_RELEASE,
    frozen: {
      since: '2025-04-14',
      reason: 'No uploads since 2025-04-14 (multi-game; ~22 GBVSR sets visible in the catalogue).',
      records: -1,
      reviewedAt: '2026-09-29',
    },
  },
  // ── THE INDEX — lowest precedence (checklist 12) ───────────────────────────
  {
    id: 'replayTheater',
    source: 'replayTheater',
    name: 'Tournament',
    slotOrder: 'handle-outside',
    cronFetchedWithCarry: true,
    index: {
      endpoint: 'https://replaytheater.app/api/matches',
      slug: 'gbvs',
      gameLabel: 'Granblue Fantasy: Versus',
      admitFrom: PRE_RELEASE,
      pageSize: 50,
      pacingMs: 1200,
      admitUntagged: true,
    },
  },
];

export const CHANNEL_BY_ID = new Map<ChannelKey, ChannelConfig>(CHANNELS.map((c) => [c.id, c]));

/**
 * The trailing hashtag block (`#gbvs #gbvsr #gbvsreplaychannel`) is stripped
 * before the marker test: a tag run is the uploader's SEO, and the dominant
 * old-game spelling in it (`#gbvs`) must never count as a game statement either
 * way. Repeated, because a title can end in several runs.
 */
const HASHTAG_RUN = /(?:^|\s)#[\p{L}\p{N}_]+(?:\s*#[\p{L}\p{N}_]+)*\s*$/u;

export function stripHashtagRun(title: string): string {
  let out = title.trim();
  for (let i = 0; i < 4; i++) {
    const next = out.replace(HASHTAG_RUN, '').trim();
    if (next === out) break;
    out = next;
  }
  return out;
}

/**
 * The Rising marker. `GBVSR` with a letter-lookaround rather than `\b` (the
 * Avatar 3b lesson: `\b` is `\w`-based and fails beside digits and CJK), plus
 * the English and Japanese subtitle. BARE `GBVS` IS NOT A BRANCH — see the
 * header. `Rising` alone is accepted because every channel that writes it
 * writes it about this game ("Granblue Fantasy Versus Rising Rank match"), and
 * the date floor bounds it either way.
 */
export const GBVSR_MARKER =
  /(?<![A-Za-z])GBVS\s*R(?![A-Za-z])|(?<![A-Za-z])Rising(?![A-Za-z])|ライジング/iu;

/** Does this text carry a load-bearing Rising marker? The hashtag run is
 *  stripped first; a mid-title `#GBVSR` still counts. */
export function hasGbvsrMarker(text: string): boolean {
  return GBVSR_MARKER.test(stripHashtagRun(text ?? ''));
}

/** Channels the daily fetch contacts and whose records a TITLE PARSE builds:
 *  not frozen, not the index. */
export const ACTIVE_CHANNELS = CHANNELS.filter((c) => !c.frozen && !c.index);

/**
 * Sponsor/team prefix on a handle: "GS | gamera", "ZSF | Azerate", "TKTH |
 * Eunectes", "IBSG | Tororo" on the dominant channel; "BUZZ|korius" on
 * yumegiwa. STRIPPED, never split — `|` is not a duo delimiter on a 1v1 game.
 * Applied repeatedly; fullwidth `｜` included (the normalizer folds it anyway).
 */
export const THEATER_SPONSOR = /^[^|｜]{1,12}\s*[|｜]\s*/;

export const stripTheaterSponsor = (handle: string): string => {
  let out = handle.trim();
  for (let i = 0; i < 4; i++) {
    const next = out.replace(THEATER_SPONSOR, '').trim();
    if (next === out || next === '') break;
    out = next;
  }
  return out;
};
