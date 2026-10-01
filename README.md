# Granblue Fantasy Versus: Rising — Replay Database

The GBVSR app for the [Replay Database](https://replaydatabase.com) platform: a
thin consumer of the shared `replay-engine` layer (pinned `v0.16.0`) plus the
bespoke GBVSR data pipeline. Lives behind the umbrella shell at
**replaydatabase.com/gbvsr**.

Game #8, and the fifth consumer of the engine's
[NEW-GAME-CHECKLIST](../replay-engine/NEW-GAME-CHECKLIST.md). This build wrote
the checklist's fifth-consumer amendments (12l, 3c, 3d, 16b, 7d, 7e, 12m, 13b,
5u–5x, 10l, 14b, 15b, 12n, 9d, the 5d addendum, 15c, 2c): the first game that is
a SEQUEL living on the same channels and the same catalogue label as its
predecessor, and the first whose dominant channel deleted its own back catalogue
while still uploading daily.

Where this repo diverges from a sibling, the divergence is argued in the file
that makes it. This README links to those arguments rather than restating them,
and restates no live number — those are in `data/report.md` (every run) and
`data/summary.json`.

## The archive, and where it comes from

Eight YouTube channels plus the Replay Theater catalogue (`scripts/channels.ts`
carries the measurement behind every row). Four of the channels stopped
publishing Rising and are **frozen**: their records are carried, their counts
pinned and hard-asserted every run.

**The concentration is the risk, and it is stated.** One channel —
`@gbfvsreplays` — is ~68% of live volume (every intake, 28 days to 2026-09-29;
top-3 96%) and roughly 57% of the archive. Without it the live flow would be
21–31 uploads a week, under the bar the platform holds a new game to. It is NOT
frozen; it is protected by the collapse guard (awake: 10% of its records is
~880), per-channel fetch error handling (a dead playlist names the freeze remedy
and never stops the other channels), a silence alarm set from its own measured
longest silence (4.42 days → 7), and the departures line below.

## Sets, not matches

A whole-video record is a SET: the dominant channel's median upload is 448 s
against a ~3-minute game. The catalogue's tournament rows are sets too —
consecutive rows on one VOD sit a median 573 s apart and split only where a
player changes fighter (the opposite of Strive's catalogue). A record carrying
`startSeconds` is a segment of a longer video. There is no duration ceiling: the
dominant channel's 509 uploads over 30 minutes are single-pairing sessions, not
tournament VODs (`scripts/parse.ts` MIN_MATCH_SEC).

## The stat unit — side appearances

GBVSR is 1v1 (`charactersPerSide: 1`). A mirror adds two to one fighter; a
mid-set switch (yumegiwa writes both fighters) adds one to each. One denominator
drives `characterUsage`, `byPatchUsage` and `playerCharacters`, and
`scripts/emit.ts` asserts all three totals. No `pairingUsage`.

## The marker is GBVSR — never GBVS

The previous game's uploads are live on the same channels: 1,068 `GBVS:` uploads
on the dominant channel, 1,961 `[GBVS]` on another — one titled that way on the
sequel's launch day. So the marker is `GBVSR`/Rising, AND every record must be
on or after the vendor's early access (2023-12-11). The Replay Theater catalogue
labels BOTH games "Granblue Fantasy: Versus" (43.8% of its rows are the original
game), so its gate is the video's own date, not the label.

## EX mode is a mark, not a character

Ver 2.20 gave Gran, Djeeta and Narmaya an EX mode. The vendor roster lists 40
fighters, so a record carries an `ex` field — per side, the fighters the source
MARKED as EX — present only when marked. It is positive evidence: an unmarked
record is unknown, never "base". A mark on any other fighter, or before 2.20, is
residue. The EX facet (`app/plugins/facets.ts`) filters on it; usage counts stay
on the base fighter.

## The roster: 40, and the Japanese names

From the vendor's English and Japanese roster pages; the ids are the design
handoff's short ids (38 of 40 derive ComboForge's without an override). One
fighter is literally named `id` and one id starts with a digit (`2b`); both are
asserted at every surface in `scripts/e2e.ts`. The Japanese names are where a
guessed alias table fails — Ladiva is ファスティバ ("Fastiva"), Anre is ウーノ
("Uno", also a real player), Seox is シス ("Six"), Lucilius is ルシファー.
Every other alias was seen in a real title (`scripts/characters.ts`).

## Patches: the vendor names the seasons

23 builds, two seasons, from Cygames' own news feed (`scripts/seasons.ts`). The
vendor states the era boundary itself — "Character Pass Season 2 with a Version
2.00 Update" — and the version major is a cross-check, not the authority. A
patch starts on the vendor's EARLIEST statement about it: the CMS date alone
would file twelve Versusia uploads before the patch that added her.
`npm run data:patch-check` compares the table with the live feed and fails on any
patch-notes post it cannot account for.

## The art is the Fan Kit — and the fallback is one command

Character art comes only from Cygames' official Fan Kit, whose terms permit
reposting kit files, forbid any other official material (so there is no
detail-page fallback) and forbid excessive processing (the art is cropped and
resized, nothing else). The licence is revocable, so `npm run data:art:revoked`
replaces every kit derivative with generated tiles in one command, and
`verify:gates` builds that path every run. Credit: "Character art © Cygames,
Inc. · 2B © SQUARE ENIX" in the footer at every width and baked into the OG card.

## Departures — reported, never blocking

`data/report.md` lists, per intake, every record id that left the corpus since
the committed `videos.json`. It exists because the dominant channel deleted part
of its back catalogue at 2–3 videos a day for nine months, too slowly for the
collapse guard and too steadily for the silence alarm.

## Match identity is a REPORT-ONLY tier

Player pair × fighter pair × upload day. The same footage uploaded by two
channels collides on it; so does a legitimate rematch. Every group is queued as
`duplicate-candidate`, and every record stays published (`scripts/match-dupes.ts`
is the deep dive).

## Scripts

| command                                                 | what                                                                              |
| ------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `npm run data:fetch`                                    | walk every live uploads playlist, hydrate GBVSR-marked uploads (prints its quota) |
| `npm run data:theater`                                  | the Replay Theater pull (cursor daily, `-- --full` sweeps)                        |
| `npm run data:parse`                                    | raw → `data/videos.json`, players, review queue, `report.md`                      |
| `npm run data:emit`                                     | the public contract, stats, `summary.json` (with the engine tag)                  |
| `npm run data:catchup`                                  | fetch → theater → parse → emit, in the only safe order                            |
| `npm run data:characters`                               | build `data/characters.json` from the roster table                                |
| `npm run data:art` / `data:art:revoked` / `data:og`     | Fan Kit art, the licence fallback, the OG card                                    |
| `npm run data:seasons`                                  | validate the patch table (also in `typecheck`)                                    |
| `npm run data:patch-check` / `data:roster-check`        | compare with the vendor (manual; trailers for `../check-*.sh`)                    |
| `npm run data:expiries`                                 | the self-expiring gates                                                           |
| `npm run data:redirects`                                | write `vercel.json` from `data/player-redirects.json`                             |
| `npm run data:dupes`                                    | the match-identity deep dive (read-only)                                          |
| `npm run verify:gates` / `test:e2e` / `verify:deployed` | the control suite, the build contract, the post-deploy digest + engine check      |
| `npm run typecheck`                                     | both tracks — never raw `tsc`                                                     |

## Daily data refresh

`.github/workflows/data-refresh.yml`, cron `47 9 * * *` (the eighth slot).
fetch → theater (allowed to fail) → parse → emit → regenerate redirects →
refuse redirect drift → commit by name → smoke check → expiries → patch table.

## Vercel

Project `gbvsr-replay-database`. Env set fresh, never copied from a sibling:
`NUXT_APP_BASE_URL=/gbvsr/` and `NUXT_PUBLIC_SITE_URL` on Production AND
Preview. Before the shell flip, `SMOKE_HOST` points at the game's own
`*.vercel.app` host.
