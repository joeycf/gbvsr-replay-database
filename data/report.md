# GBVSR pipeline report

- **15698** published records · **2873** players · **40** fighters
- **234** mirror match(es) (1.5%) — the stat unit is side appearances, so each adds 2 to one character (scripts/emit.ts)
- **192** pending review item(s) — absent from the site, never guessed
- **0** duplicate id(s) resolved by intake precedence
- **9** of 9 confirmed fighter-named players present in the registry; every other handle resolves to no fighter

## Per intake

A whole-video record is a SET, never a match: the dominant channel's median upload is
448 s against a ~3-minute game, and the catalogue's tournament rows split only at a
counter-pick (recon 2026-09-29). `too-short` is judged against the floor in brackets.
`raw` is what the fetch hydrated — marker-passing uploads only (scripts/fetch.ts).

| intake | source | raw | GBVSR-marked | parsed | published | too-short (floor) | live | rejects naming a fighter |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| highLevelReplays | highLevelReplays | 8929 | 8929 | 8835 | 8835 | 3 (120s) | 0 | 91 |
| kakuken | kakuken | 942 | 942 | 942 | 942 | 0 (120s) | 0 | 0 |
| gbvsReplayChannel | gbvsReplayChannel | 1845 | 1845 | 1649 | 1649 | 125 (120s) | 0 | 49 |
| yumegiwa | yumegiwa | 1001 | 1001 | 881 | 881 | 8 (120s) | 0 | 4 |
| risingReplays _(frozen)_ | risingReplays | — | — | — | 654 | — | — | — |
| gbFightingReplays _(frozen)_ | gbFightingReplays | — | — | — | 598 | — | — | — |
| gbvsrReplay _(frozen)_ | gbvsrReplay | — | — | — | 123 | — | — | — |
| fgHighLevel _(frozen)_ | fgHighLevel | — | — | — | 186 | — | — | — |
| replayTheater _(index, cursor)_ | replayTheater | — | — | — | 1830 | — | — | — |

### Index intake — Replay Theater

Fetched by the daily cron and ADD-ONLY: a committed record is carried whether or not the
catalogue still lists it, so this count can only rise. The cron does not depend on the
pull succeeding — on any failure there is no dump, the committed records are carried
against the pin, and the run stays green.

Rebuilt from a **cursor delta**: 0 built this run, 1830 carried (add-only), **1830** total; pin 1830. "Not in this pull" is withheld: on a cursor morning it is every record older than the pages read and means nothing.

Rows the build refused, counted never guessed: 0 placeholder handle(s) (`Unknown Player`, …), 0 before the 2023-12-11 Rising gate, 0 live, 0 whole-video row(s) under 120s, 0 excluded by hand, 0 duplicate record id(s) inside the dump, 0 naming a fighter before their release. EX labels: 0 side(s) marked, 0 refused.
The fetch refused 0 ORIGINAL-GAME row(s) (the catalogue's one label covers both games; 43.8% of the full sweep at recon) and demoted 0 set-format tag(s) ("FT5") from events.

## Misses, per intake

Most misses are the gate working: old-game uploads refused by the GBVSR marker, trailers,
guides, whole-tournament VODs with no `vs`, and handle-less showcase footage. The columns
that name a parser problem are `no-char`, `no-handle` and `slot-ambiguous`;
`before-release` is a fighter on a day before they shipped (samples below).

| intake | no-marker | before-floor | live | too-short | no-vs | vs-count | no-char | no-handle | slot-ambiguous | before-release | excluded |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| highLevelReplays | 0 | 0 | 0 | 3 | 85 | 0 | 5 | 1 | 0 | 0 | 0 |
| kakuken | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| gbvsReplayChannel | 0 | 0 | 0 | 125 | 50 | 1 | 19 | 0 | 1 | 0 | 0 |
| yumegiwa | 0 | 0 | 0 | 8 | 110 | 0 | 2 | 0 | 0 | 0 | 0 |

## Slot order, per intake — both sides tallied

The parser resolves by roster membership and only RECORDS which slot held the fighter
(types/index.ts SlotOrder). `tie-broken` is the one branch where the declared order decided:
both spans resolved to a fighter. A channel whose resolved majority disagrees with its
declared order, or whose tie-broken rate climbs, is drifting. CotW collected this and never
printed it.

| intake | declared | handle-outside | chars-outside | handle-first-bare | tie-broken | sides |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| highLevelReplays | handle-outside | 17668 | 0 | 2 | 6 (0.0%) | 17670 |
| kakuken | handle-outside | 1884 | 0 | 0 | 6 (0.3%) | 1884 |
| gbvsReplayChannel | handle-first-bare | 415 | 1 | 2882 | 7 (0.2%) | 3298 |
| yumegiwa | handle-outside | 1762 | 0 | 0 | 1 (0.1%) | 1762 |

_On a `handle-first-bare` channel a `chars-outside` share means a side written
_character-first — the channel's own inconsistency, read rather than guessed._

## Duration histogram, per intake

The floor (120s) is re-derived from this table, not from a comment:
`match-shaped misses` are too-short uploads whose TITLE parsed as a matchup — the population
a lower floor would admit. There is no ceiling: the dominant channel's long uploads are
single-pairing sessions (recon 2026-09-29).

| intake · population | 0 (live/unknown) | 1–29s | 30–59s | 60–119s | 120–179s | 180–299s | 300–599s | 600–1799s | 1800s+ |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| highLevelReplays · records | 0 | 0 | 0 | 0 | 0 | 212 | 6490 | 1604 | 529 |
| highLevelReplays · match-shaped misses | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| highLevelReplays · other misses | 0 | 0 | 0 | 0 | 0 | 1 | 9 | 16 | 65 |
| kakuken · records | 0 | 0 | 0 | 0 | 0 | 18 | 901 | 23 | 0 |
| kakuken · match-shaped misses | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| kakuken · other misses | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| gbvsReplayChannel · records | 0 | 0 | 0 | 0 | 6 | 32 | 1389 | 222 | 0 |
| gbvsReplayChannel · match-shaped misses | 0 | 0 | 0 | 65 | 0 | 0 | 0 | 0 | 0 |
| gbvsReplayChannel · other misses | 0 | 3 | 9 | 48 | 4 | 3 | 23 | 23 | 18 |
| yumegiwa · records | 0 | 0 | 0 | 0 | 2 | 115 | 545 | 219 | 0 |
| yumegiwa · match-shaped misses | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| yumegiwa · other misses | 0 | 6 | 2 | 0 | 0 | 0 | 3 | 2 | 107 |

## Handles

- word count per side: 1 → 23476 · 2 → 1049 · 3 → 89 — the cap is 5 words (parse.ts MAX_HANDLE_WORDS, Strive's measured value; a bump at 5 is where decoration leaks show first)
- 295 player(s) seen under more than one spelling; the display casing is the majority spelling, tie-broken toward mixed case, and the rest are kept as aliases
- placeholder handles refused: 0 on the channels, 0 in the catalogue

## Version tokens — counted, never a patch

A version written in a title is not a vendor statement (scripts/seasons.ts), so it never
becomes Replay.patch. The columns test it against the date-derived patch, per record.

| intake | tokens | = date-derived patch | disagrees | no window |
| --- | --- | ---: | ---: | ---: |
| yumegiwa | 1.62×64, 1.60×21, 1.50×7 | 71 | 18 | 0 |

## Left the corpus since the last commit — REPORT-ONLY

Ids in the committed videos.json that this run no longer publishes, per intake. Never
blocking: a departure is usually real (a video deleted or made private). It exists because
the dominant channel deleted part of its own back catalogue at 2–3 videos a day for nine
months — too slow for the collapse guard, too steady for the silence alarm.

**48** record(s) left:
- **gbvsReplayChannel** — 48: `jkNjEzfIzaE`, `JqQn6iOWAUc`, `6BAfHKm5A74`, `O3VTP0UyYkI`, `L95kU9rnL7E`, `IPLimIIITCY`, `5cdshQJKcTs`, `fKYiyY2jRgQ`, `xFdqYXnUSQY`, `ILDL1a9KJXM`, `30qyLb7I2k8`, `acIk_Hgs8b8`, `oSkisF7UCto`, `cHqLRT15Lg0`, `dNvRSMw1ms0`, `1cPj3hfNGRc`, `Q-htSgrfG_U`, `9mORl_hSii0`, `Uf5QVbJzegk`, `tOSRixbRh6Y`, `ApQs4Ap08H4`, `k4TQaBTw5TU`, `CVKgAr3BvKA`, `RRu8iluU5bo`, `3lmG_BgnhR8` … +23 more

## Match identity — a REPORT-ONLY tier (checklist 2b)

A signature is player pair × fighter pair × upload day. It is a HYPOTHESIS about footage
identity, not a verdict: a rematch is a legitimate collision, so nothing is dropped on it.

- **165** signature(s) cover more than one record, **339** record(s) in all (2.2% of the archive)
- **43** of those span more than one intake — the case the intake key cannot see
- every one is queued as `duplicate-candidate` and every one is still published

- 2026-09-20 artorias / xerom (charlotta / id): `a1JoXbjJgow` gbvsReplayChannel, `MMF0ctxEXjA` highLevelReplays
- 2026-09-19 tes / zira (2b / id): `MRwIcePn6Dc` gbvsReplayChannel, `RWiKMTAOhxw` highLevelReplays
- 2026-07-22 osakanasan / seokang (anre / yuel): `SZ40IrQTvgo` kakuken, `nXL61lcnwQ8` highLevelReplays
- 2026-02-10 gamera / rookies (ilsa / seox): `OzBH5_zUSg4` highLevelReplays, `z6cTbLNs-k8` gbvsReplayChannel
- 2026-01-08 goenitz / sakusaku (gran / soriz): `DfAyCDejzF0` highLevelReplays, `h4sufAGObSM` gbvsReplayChannel
- 2025-10-15 pipipi / tororo (meg / vikala): `mSCoT_u_xls` gbvsReplayChannel, `Xn5hKUOpm3Q` highLevelReplays
- 2025-10-15 tororo / zeus (anila / meg): `Fd0-5q1scUw` highLevelReplays, `RRUC6DQ4PJs` gbvsReplayChannel
- 2025-08-05 hinokino / koyao (narmaya / wilnas): `9bKXzSyCAA4` gbvsReplayChannel, `HcLyQMru2MM` highLevelReplays
- 2025-06-07 alkina / tororo (galleon / sandalphon): `n4_xJRwiOEE` highLevelReplays, `-zY-d7lKSNA` gbvsReplayChannel
- 2024-10-28 framework / garo (siegfried / vikala): `fpIkYR_90Hg` highLevelReplays, `ySD6x6qrDq0` gbvsReplayChannel

## EX marks, skins, and the release floor

- EX mode (Ver 2.20; Gran, Djeeta, Narmaya): **287** channel side(s) and 0 catalogue side(s) carry a valid mark; 0 mark(s) refused (wrong fighter or before 2.20 — listed in the residue). The mark is POSITIVE
  evidence only: an unmarked record is unknown, never base.
- skins stripped from fighter slots: B.Butterfly×546, Crimson Bomber×222, Lady Serenity×175, Sinborne Redeemer×92, Summer×79, Indigo Witch×68, M.M. L∞k Up×50, No Fear, No Gain×49, Diamond Heart×42, Knight of Passion×32, Knight's Finery×29, Arbitrator of the Shore×14, Conqueror's Carapace×8, Sumer×3, L.Serenity×3, INdigo Witch×2, Reverent Attire×2, Spooky Vicky×1
- refused by the release floor (a fighter before they shipped): 0 sampled, 0 catalogue row(s)

## Registry invariant — no player is a fighter

Every handle in players.json was resolved through the roster matcher at parse time. 9 resolve to a fighter and are on the confirmed list (scripts/roster.ts): `uno`, `metara`, `djeeta`, `カタリナ`, `nier-gojira`, `no1-ilsa-simp`, `cat-ferry`, `ferry-slil-tier3`, `belial-whatsapp`.

## Rejects — titles that name a fighter but did not parse, per intake

Grammar variants are found by reading REJECTS, not successes (checklist 5e). Ten samples per
intake; the count is the whole population. Tōkon and 2XKO print this at fetch time from an
approximate shape; this is the precise version, straight from the parser.

**highLevelReplays** — 91

- `dQVefEXs4-k` no-vs: GBVSR:🔥Nameroc (Vira) BLaggen (Id)🔥| High Level Gameplay.
- `wpuUCOSps-M` no-vs: GBVSR:🔥Yuzumikan (Lucilius) Albireo (Id)🔥| High Level Gameplay.
- `h5B03LzjL2I` no-vs: GBVSR:🔥Whisp (Versusia) VsFullMoon (Eustace)🔥| High Level Gameplay.
- `-5cx1PNSVcY` no-char: GBVSR:🔥Revo | Jing Vs Hiranuru (Percival)🔥| High Level Gameplay.
- `vnza3jcd2DA` no-vs: GBVSR:🔥Zeta 2.5 RoundUp | High Level Gameplay🔥
- `qc0I9ou5gyg` no-vs: GBVSR:🔥Anre 2.5 RoundUp | High Level Gameplay🔥
- `gh1nOqNNXUY` no-vs: GBVSR:🔥Cagliostro 2.5 RoundUp | High Level Gameplay🔥
- `wSWqoiolpVo` no-vs: GBVSR:🔥Lowain 2.5 RoundUp | High Level Gameplay🔥
- `3Tza306uUm8` no-vs: GBVSR:🔥Katalina 2.5 RoundUp | High Level Gameplay🔥
- `j3Gk6lSoYd4` no-vs: GBVSR:🔥Seox 2.5 RoundUp | High Level Gameplay🔥

**gbvsReplayChannel** — 49

- `9tuwoJ1qdR0` no-vs: GBVSR Tako Showcases ID And Looks Great
- `Kq5wZg3ZGbE` no-vs: Grandblue Fantasy Versus Rising Id Character Reveal And Gameplay Trailer!!
- `t3VaVgYmQNs` vs-count: GBVSR High Level Gameplay Debagame VS Gamera VS Tororo An Ilsa Three Way!!
- `SX_42Nuvdpc` no-vs: GBVSR High Level Gameplay Hinababo Tries Ilsa
- `g6aJS_Jqt5U` no-char: GBVSR High Level Gameplay Sho San Mega VS Asher Zooey
- `yb_AZmo09Vg` no-vs: GBVSR High Level Gameplay Gamera Tries Meg
- `gL_0MzHC0CM` no-vs: GBVSR High Level Gameplay Ktang Show Off Meg!!
- `Zf3wzdibtPI` no-char: GBVSR High Level Gameplay Koyao Narmaya VS Jin Catalina
- `yRcN0slsOWA` no-char: GBVSR High Level Gameplay Tahichi Metera VS Osakana Beeblzebub
- `sib-lBzLXDM` no-char: GBVSR High Level Gameplay Osakana Beezebub VS Koyao Narmaya

**yumegiwa** — 4

- `C7tatOw8Ge8` no-char: 【 偽〆（める）VS MASA（avatarbelial アバタールベリアル）】#GBVSR No64金曜だから夜更かしWinners Top4🔥Season2
- `iqiGK3iTCCw` no-vs: 【日本サメ映画学会（fastiva ファスティバ）VSコリウス（beatrix ベアトリクス）】#GBVSR No.41 金曜だから夜更かし Winners Top8🔥Ver1.62
- `tf-dfGMHCNI` no-vs: 【みけおじ（charlotta シャルロッテVS 謎の男（lucilius ルシファー）】#GBVSR No.40 金曜だから夜更かし Winners Top4🔥Ver1.62
- `x_A19q7bDrQ` no-char: 【アルカジ VS 偽〆（める）（avatarbelial アバタールベリアル）】#GBVSR No.33 金曜だから夜更かし Losers Semi Final

## Residue — text no roster span covered

A new nickname, a DLC fighter or an uploader typo surfaces here as a counted
line with its literal text, instead of vanishing into a silently shorter side.

RANK_PREFIX leak (parse.ts): **0** residue line(s) over 0 miss(es) still carry a rank-shaped token ("#1 Ranked", "Rank 1st", "Rank TOP", "HIGH RANK", a bare "#2"). Zero means every measured spelling was stripped on the rows the parser rejected; a non-zero line names the spelling to add.

- 98× `No`
- 32× `Roundup`
- 11× `RoundUp`
- 4× `Channel Sub Like A Thon Pt Watch Like Enjoy`
- 4× `Gamera s Day`
- 4× `Zira s Day`
- 3× `Diaphone s Day`
- 3× `Framework s Day`
- 3× `Kazunoko Tries`
- 2× `Arc World Tour LET S WATCH`
- 2× `Character`
- 2× `Debagame s Day`
- 2× `Evo Japan Day Reastream Come Watch`
- 2× `Osakanasan s Day`
- 2× `Rookies s Day`
- 1× `All Dialogues Plus All Outfit Colors`
- 1× `Arc World Tour Day LET S WATCH`
- 1× `Arc World Tour LCQ Day Reastream Come Watch`
- 1× `Battle Pass Mode Info`
- 1× `Belli Bellial Hursix`
- 1× `Breakdown EX characters Costumes Revealed`
- 1× `Castiel VsWavie`
- 1× `CEO Day LET S WATCH`
- 1× `Channel Sub Like A Thon EVO JAPAN WAITING ROOM`
- 1× `Character Guide Walkthrough`
- 1× `Cygames Cup Special Day Only`
- 1× `Cygames Cup Special Tako Gobou Rookies Only`
- 1× `Debagame Gamera Tororo An Three Way`
- 1× `Debagame Vain Gamera`
- 1× `Diaphone Looking Good`
- 1× `Diaphone Yowzah Lunalu`
- 1× `Dim Toki Owachan`
- 1× `DoubleE Kiwi Hinababo`
- 1× `Dragoi s Day`
- 1× `EVO Japan LET S WATCH`
- 1× `Evo LET S WATCH`
- 1× `Framework Tries`
- 1× `Framework VsHinokino`
- 1× `Gamera Finally Tries`
- 1× `Gamera Lady Serenity`
- … 65 more

## Replay Theater cross-check

A second reading of **10886** of our own records, from the catalogue's
UNTAGGED entries: online replays it indexes that we also parse from a tracked
channel. It changes nothing: a disagreement is recorded in
data/theater-disagreements.json with both claims, never written into a record.
The catalogue does not outrank a confident parse and never outranks a human
override.

**This is not a trust number.** On this game the witness is NEAR-DEPENDENT, close to
tautological: measured 2026-09-29, Replay Theater indexes 96.5% of the dominant channel's
uploads the SAME DAY they go up, so its submitter read the same title our parser did.
Agreement below is a consistency check on two readers of one title, not verification
against the footage. A disagreement is a title at least one of the two misread.

The catalogue's genuinely independent reach is where it is the ONLY reader: ~1,643 tagged
Rising rows and ~300 untagged Rising rows on channels this archive does not intake
(2026-09-29). There it is a SOURCE (the intake builds those records), so there is nothing
of ours to compare them against, and no row of it appears in the table.

_On that sweep 10872 of the 10886 compared row(s) (99.87%) carry the VOD's own publish day,_
_10886 (100.00%) within a day. The catalogue has 1659 tagged and 874 untagged_
_row(s) on videos we do not hold; of the 1852 on a VOD the pull resolved, 1655 tagged and_
_190 untagged sit on channels we do not intake._

_Measured on the last full sweep, at catalogue entry 499735. 1033 catalogue video(s) are ones_
_we do not hold from a tracked channel; 1 are VODs the catalogue segments, which the intake owns._

| field | population | agree | partial | disagree | cannot witness |
| --- | ---: | ---: | ---: | ---: | ---: |
| players (both handles) | 10886 | 10711 (98.39%) | 169 | 6 | 0 |
| characters (per side) | 21772 | 21749 (99.89%) | 0 | 23 (0.11%) | 0 |

Side order differed on **5** record(s); the comparison realigns on the
handles before reading characters, so a swapped pair is not counted twice as a
character disagreement. Handles are compared sponsor-stripped on both sides, and
case-only spellings fold into one identity (the display casing is parse's vote).

Of the 181 side(s) whose handles did not match, **4** are ours carrying extra text
the catalogue does not, **94** are theirs carrying a team tag THEATER_SPONSOR does not
strip yet, and **83** are genuinely different names, the only bucket worth reading one
row at a time. Reported, never scored: substring matching on handles is the kind of
guessing this module refuses.

**29 disagreement(s)**, both claims, ours first:

- `Xkq7P5LB-mc` players: **sorix, nathan** vs catalogue **tier-sorix, nathan-br** — GBVSR: [TIER] Sorix (Soriz) Vs UA|Nathan (BR) (Djeeta) | High Level Ga
- `657QoAvIUEY` side 1 characters: **avatar-belial** vs catalogue **lancelot** — GBVSR:🔥MASA (Avatar Belial) Vs Alkazi (Avatar Belial)🔥| High Level G
- `bRFiYAcA4pE` side 0 characters: **katalina** vs catalogue **djeeta** — GBVSR:🔥Framework (Katalina) Vs Barutorec (Siegfried)🔥| High Level Ga
- `uvNoSA0WJuU` players: **raelu, teahothy** vs catalogue **sea-raelu, sea-teahothy** — GBVSR:🔥[SEA] raelu (Zooey) Vs [SEA] Teahothy (Summer Belial)🔥| High 
- `gPbT3YyWK7Q` players: **alma-negra, jf** vs catalogue **tier-alma-negra, jf-ms** — GBVSR:🔥[TIER] Alma Negra (Lucilius) Vs JF(MS) (Vaseraga)🔥| High Leve
- `z8lLTk4tx-8` players: **koyao, kikushl** vs catalogue **miraias, yamana** — [GBVSR] (4K) Granblue Fantasy Versus Rising Rank match Koyao (Narmaya)
- `z8lLTk4tx-8` side 0 characters: **narmaya** vs catalogue **seox** — [GBVSR] (4K) Granblue Fantasy Versus Rising Rank match Koyao (Narmaya)
- `z8lLTk4tx-8` side 1 characters: **zooey** vs catalogue **gran** — [GBVSR] (4K) Granblue Fantasy Versus Rising Rank match Koyao (Narmaya)
- `Qjy3v3oEUXc` side 1 characters: **siegfried** vs catalogue **lucilius** — GBVSR:🔥MBK (Beatrix) Vs Tav102 (Siegfried)🔥| High Level Gameplay.
- `UiD55zi7ohg` side 1 characters: **katalina** vs catalogue **siegfried** — GBVSR:🔥SenpaiSpyder (Anre) Vs Artorias (Katalina)🔥| High Level Gamep
- `6e5mby_kHdI` side 1 characters: **beatrix** vs catalogue **vira** — GBVSR:🔥destin (Nier) Vs CanOfSprite (Beatrix)🔥| High Level Gameplay.
- `bNNahqckjg4` players: **tororo, buchinuki** vs catalogue **jfk, waffle** — [GBVSR] (4K) Granblue Fantasy Versus Rising Rank match Tororo (Perciva
- `bNNahqckjg4` side 0 characters: **percival** vs catalogue **lancelot** — [GBVSR] (4K) Granblue Fantasy Versus Rising Rank match Tororo (Perciva
- `bNNahqckjg4` side 1 characters: **soriz** vs catalogue **charlotta** — [GBVSR] (4K) Granblue Fantasy Versus Rising Rank match Tororo (Perciva
- `Qt19_7hjiBY` side 0 characters: **belial** vs catalogue **avatar-belial** — GBVSR:🔥furufuru (Belial) Vs Goenitz (Gran)🔥| High Level Gameplay.
- `TRSd5nFqnDM` players: **gamera, shiraishi** vs catalogue **waffle, laphroaig** — [GBVSR] (4K) Granblue Fantasy Versus Rising Rank match Gamera (Beatrix
- `TRSd5nFqnDM` side 0 characters: **beatrix** vs catalogue **charlotta** — [GBVSR] (4K) Granblue Fantasy Versus Rising Rank match Gamera (Beatrix
- `TRSd5nFqnDM` side 1 characters: **metera** vs catalogue **eustace** — [GBVSR] (4K) Granblue Fantasy Versus Rising Rank match Gamera (Beatrix
- `DXs9aQC9Q8E` side 0 characters: **belial** vs catalogue **avatar-belial** — GBVSR High Level Gameplay TAKU Belial VS Gamera Versusia
- `8bbtBCMMtPk` side 0 characters: **galleon** vs catalogue **nier** — GBVSR:🔥LazyRuin (Galleon) Vs RetroRedux (Vane)🔥| High Level Gameplay
- `371cIjGCBME` side 1 characters: **djeeta** vs catalogue **yuel** — GBVSR:🔥Glue (Vane) Vs DokiDoki (EX Djeeta)🔥| High Level Gameplay.
- `r5zNQV0Rv8c` side 1 characters: **lucilius** vs catalogue **galleon** — GBVSR:🔥kCe (Wilnas) Vs Diegsternator (Lucilius)🔥| High Level Gamepla
- `tbNN8NWwE6c` side 1 characters: **percival** vs catalogue **wilnas** — GBVSR:🔥Koyao (Narmaya) Vs Ret (Percival)🔥| High Level Gameplay.
- `Ten_6QeKdJQ` side 1 characters: **siegfried** vs catalogue **belial** — GBVSR:🔥JFK (Lancelot) Vs Tako (Siegfried)🔥| High Level Gameplay.
- `gZa1GRJGsTA` side 1 characters: **sandalphon** vs catalogue **belial** — GBVSR:🔥Shosan (Zeta) Vs Tako (Sandalphon)🔥| High Level Gameplay.
- … 4 more

> risingReplays: frozen since 2024-07-14, 654 record(s) carried.
> gbFightingReplays: frozen since 2024-10-07, 598 record(s) carried.
> gbvsrReplay: frozen since 2024-04-05, 123 record(s) carried.
> fgHighLevel: frozen since 2025-04-14, 186 record(s) carried.

_Generated 2026-10-01T16:48:58.463Z_
