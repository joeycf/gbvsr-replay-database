/**
 * The balance-era and patch table for Granblue Fantasy Versus: Rising — ONE
 * module (SF6's and Strive's shape: the era table, the patch table, the window
 * derivation, the facet builder and the validator all live together, because
 * three of the validator's rules are cross-table).
 *
 * ── THE SOURCE ──────────────────────────────────────────────────────────────
 * Cygames' own news CMS, the feed rising.granbluefantasy.jp renders its news
 * page from (microCMS, endpoints `news_en` / `news_ja`; read by
 * scripts/patch-check.ts with the public read key the site's own bundle
 * carries). Measured 2026-09-29: 22 versioned "Patch Notes" posts, the SAME 22
 * in both languages, 1.1 → 2.60. The launch build 1.0 has no post.
 *
 * ── THE VERSION GRAMMAR, AND WHAT IS NOT INVENTED ───────────────────────────
 * `Version X.Y Patch Notes` / `Ver X.YY パッチノート`. ONE post uses a single
 * minor digit — "Version 1.1" — and it stays `1.1`: a token is the vendor's
 * spelling, not a normalisation of it. Numbers the vendor never published a
 * note for (1.20, 1.31, 1.51, 1.61, 2.01, 2.11, 2.21, 2.31, 2.41, 2.52 …) do not
 * appear. Never fill a gap.
 *
 * ── THE ERA AUTHORITY IS THE VENDOR'S OWN SENTENCE ──────────────────────────
 * Checklist 4: eras open on balance overhauls, from an explicit table, never
 * inferred from the major. Here the vendor NAMES the eras: "Celebrating
 * Character Pass Season 2 with a Version 2.00 Update Showcase!" (news, 2025-02-17)
 * — so there are two, Season 1 (1.0 → 1.62) and Season 2 (2.00 → today). The
 * major DOES increment on that boundary, and validate() asserts it, but as a
 * CROSS-CHECK: the authority is the sentence. Two mid-season patches are loud
 * enough to look like openers and are not — 1.50 ("major balance adjustments
 * for the entire roster") and 2.60 ("a new battle system") — because the vendor
 * names no season there. They are children with notes.
 * Do not confuse any of this with RANKED "Battle Seasons" (added 2024-08-14):
 * those are ladder resets, not balance eras.
 *
 * ── THE DATE AUTHORITY, MEASURED, AND WHY IT IS NOT ONE FIELD ───────────────
 * No patch-note body carries a release sentence (checked for all 22). Each post
 * carries two dates and they disagree: the CMS `date` (always 15:00Z — midnight
 * JST) and `publishedAt`. Neither is always the release. On 1.50 the post went
 * live 2024-08-18 with `date` 2024-08-25 — and Versusia, whom 1.50 added, is on
 * 12 uploads from 2024-08-20 onward. On 1.1 Lucilius is on three uploads
 * 2024-01-16 11:44–13:54Z, before `date`'s 15:00Z. So a patch's `start` is the
 * vendor's EARLIEST STATEMENT about the build — the earlier of `date` and
 * `publishedAt`, across both language feeds — as a UTC calendar day. That
 * places every Versusia and Lucilius record in the patch that added them.
 * (One EN/JA date disagreement exists: 2.22 is 08-12 in EN and 08-13 in JA; the
 * earlier wins.) Never the corpus: first-footage dates were the CHECK that
 * found the problem, not the source of any row.
 */

import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { PatchBoundary, PatchWindow, SeasonBoundary } from '../types/index';

/** Vendor-stated early access ("Early Access starting December 11", news
 *  2023-10-31) — the first day Rising was publicly playable, and the date
 *  floor for every intake (parse) and the Replay Theater Rising gate. The two
 *  open betas (July and November 2023) left no footage in any intake or in the
 *  catalogue, so there is no pre-release era. */
export const PRE_RELEASE = '2023-12-11';
/** Launch day (vendor-stated, after the move from November 30). */
export const LAUNCH = '2023-12-14';
/**
 * The stale-patch alarm, in days since the newest row. MUST SIT CLEAR OF THE
 * TABLE'S OWN WIDEST REAL GAP, or it fires on an ordinary quiet stretch and
 * teaches people to clear it without looking: measured 2026-09-29, the gaps
 * between patch starts have median 37 d, p90 70 d, and a maximum of 183 d
 * (2.51 2026-03-16 → 2.60 2026-09-15). 190 is that maximum plus a week.
 */
export const STALE_PATCH_DAYS = 190;

const NEWS = 'https://rising.granbluefantasy.jp/en/news/detail/?id=';

export const SEASONS: SeasonBoundary[] = [
  {
    season: 1,
    start: PRE_RELEASE,
    end: '2025-02-24',
    confirmed: true,
    versionMajor: 1,
    label: 'Season 1',
    note: 'Launch roster + Character Pass 1',
  },
  {
    season: 2,
    start: '2025-02-24',
    end: null,
    confirmed: true,
    versionMajor: 2,
    label: 'Season 2',
    note: 'Character Pass 2 — opened by Ver. 2.00 in the vendor’s own words',
  },
];

/** The 23 released builds. `start` is the vendor's earliest statement (see the
 *  header); the comment on each row is the post id both feeds agree on. */
export const PATCHES: PatchBoundary[] = [
  {
    version: '1.0',
    start: PRE_RELEASE,
    announcedOn: 'launch',
    note: 'Launch (early access Dec 11)',
  },
  {
    version: '1.1',
    start: '2024-01-15',
    url: `${NEWS}py5oq6bru`,
    announcedOn: 'rising-news',
    note: 'Lucilius',
  },
  {
    version: '1.21',
    start: '2024-02-19',
    url: `${NEWS}82mc1nv3fm`,
    announcedOn: 'rising-news',
    note: '2B',
  },
  {
    version: '1.30',
    start: '2024-03-31',
    url: `${NEWS}u0pszn-y2e`,
    announcedOn: 'rising-news',
    note: 'Vane',
  },
  {
    version: '1.40',
    start: '2024-05-21',
    url: `${NEWS}xvsqq1zfz0`,
    announcedOn: 'rising-news',
    note: 'Beatrix',
  },
  { version: '1.41', start: '2024-06-02', url: `${NEWS}5wfxfx0lkak1`, announcedOn: 'rising-news' },
  {
    version: '1.42',
    start: '2024-06-20',
    url: `${NEWS}9mo4ieqpn6fj`,
    announcedOn: 'rising-news',
    note: 'Beatrix adjustments',
  },
  {
    version: '1.50',
    start: '2024-08-18',
    url: `${NEWS}xg9_rosyyop`,
    announcedOn: 'rising-news',
    note: 'Versusia · roster-wide balance',
  },
  { version: '1.52', start: '2024-09-15', url: `${NEWS}noj-flng8s`, announcedOn: 'rising-news' },
  {
    version: '1.60',
    start: '2024-10-23',
    url: `${NEWS}kvlhfzqpswzx`,
    announcedOn: 'rising-news',
    note: 'Vikala',
  },
  { version: '1.62', start: '2024-11-20', url: `${NEWS}5l57ksapsuu1`, announcedOn: 'rising-news' },
  {
    version: '2.00',
    start: '2025-02-24',
    url: `${NEWS}91-vxmqh-t1x`,
    announcedOn: 'rising-news',
    note: 'Sandalphon · Season 2',
  },
  { version: '2.02', start: '2025-03-12', url: `${NEWS}v_tqimnr21f`, announcedOn: 'rising-news' },
  { version: '2.03', start: '2025-03-25', url: `${NEWS}ar7w35yy3b`, announcedOn: 'rising-news' },
  {
    version: '2.10',
    start: '2025-05-26',
    url: `${NEWS}xr2dnxjz8`,
    announcedOn: 'rising-news',
    note: 'Galleon',
  },
  { version: '2.12', start: '2025-06-08', url: `${NEWS}rdso4drvo`, announcedOn: 'rising-news' },
  {
    version: '2.20',
    start: '2025-08-03',
    url: `${NEWS}7k5v0136p_iq`,
    announcedOn: 'rising-news',
    note: 'Wilnas · EX mode',
  },
  { version: '2.22', start: '2025-08-12', url: `${NEWS}i4nhzwszcp3`, announcedOn: 'rising-news' },
  {
    version: '2.30',
    start: '2025-10-13',
    url: `${NEWS}n9yk6vwrucj9`,
    announcedOn: 'rising-news',
    note: 'Meg',
  },
  { version: '2.40', start: '2025-11-30', url: `${NEWS}2-sw3wqtt`, announcedOn: 'rising-news' },
  {
    version: '2.50',
    start: '2026-02-08',
    url: `${NEWS}ulceuzl6t`,
    announcedOn: 'rising-news',
    note: 'Ilsa',
  },
  { version: '2.51', start: '2026-03-16', url: `${NEWS}dvpi0rxwejpt`, announcedOn: 'rising-news' },
  {
    version: '2.60',
    start: '2026-09-15',
    url: `${NEWS}uykga6t5-h`,
    announcedOn: 'rising-news',
    note: 'Id · new battle system',
  },
];

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
/** The vendor's grammar: one or two minor digits, nothing else. */
const VERSION_SHAPE = /^\d+\.\d{1,2}$/;
/** A patch token must never look like an era token. */
const ERA_SHAPE = /^(S\d+|Beta|Pre-release)$/i;

const major = (v: string): number => Number(v.split('.')[0]);
/** X.Y[Y] as one ordered number, reading the minor as a DECIMAL FRACTION the
 *  way the vendor's own sequence does: 1.1 < 1.21 < 1.30. */
const rank = (v: string): number => {
  const [maj, min] = v.split('.');
  return Number(maj) * 100 + Number(`0.${min}`) * 100;
};

function eraOf(day: string): SeasonBoundary | null {
  for (const s of SEASONS) {
    if (day >= s.start && (s.end === null || day < s.end)) return s;
  }
  return null;
}

/** The era a capture date falls in. THROWS for a date no era covers — a record
 *  admitted before PRE_RELEASE is a caller bug, never "season 0". */
export function seasonForDate(iso: string): number {
  const day = iso.slice(0, 10);
  const era = eraOf(day);
  if (!era) {
    throw new Error(
      `No season covers ${day} — a record was admitted with no era to file under ` +
        `(the table starts ${PRE_RELEASE}).`,
    );
  }
  return era.season;
}

/** The era token for Replay.patch when no window claims a date, and the
 *  patchGroups parent id. */
export function seasonToken(season: number): string {
  return `S${season}`;
}

/** Every patch with its computed window and resolved era. DERIVED, never
 *  authored. */
export function patchWindows(patches: PatchBoundary[] = PATCHES): PatchWindow[] {
  const sorted = [...patches].sort((a, b) => a.start.localeCompare(b.start));
  return sorted.map((p, i) => {
    const season = seasonForDate(p.start);
    const era = SEASONS.find((s) => s.season === season)!;
    const next = sorted[i + 1];
    const end = next && seasonForDate(next.start) === season ? next.start : era.end;
    return { ...p, end, season };
  });
}

/** The patch live on a capture date, or null when no window claims it. */
export function patchForDate(iso: string, windows: PatchWindow[] = patchWindows()) {
  const day = iso.slice(0, 10);
  for (const w of windows) {
    if (day >= w.start && (w.end === null || day < w.end)) return w;
  }
  return null;
}

/** The engine's `GameConfig.patchGroups` — eras as parents, patches as
 *  children (engine rule 14: never era-only). */
export function buildPatchGroups(): {
  id: string;
  label?: string;
  note?: string;
  children?: { id: string; label?: string; note?: string }[];
}[] {
  const windows = patchWindows();
  return SEASONS.map((s) => {
    const children = windows
      .filter((w) => w.season === s.season)
      .map((w) => ({
        id: w.version,
        label: `Ver. ${w.version}`,
        ...(w.note ? { note: w.note } : {}),
      }));
    return {
      id: seasonToken(s.season),
      ...(s.label ? { label: s.label } : {}),
      ...(s.note ? { note: s.note } : {}),
      ...(children.length ? { children } : {}),
    };
  });
}

// ── validators ──────────────────────────────────────────────────────────────
// Run by `npm run data:seasons` AND `npm run typecheck`. COLLECT, THEN REPORT.

/** Every rule violation in the two tables. Pure; `today` is injectable. */
export function validate(today = new Date().toISOString().slice(0, 10)): string[] {
  const errs: string[] = [];
  const byStart = [...PATCHES].sort((a, b) => a.start.localeCompare(b.start));

  // 1. Shapes.
  for (const s of SEASONS) {
    if (!ISO_DAY.test(s.start)) errs.push(`S${s.season}: start "${s.start}" is not an ISO day`);
    if (s.end !== null && !ISO_DAY.test(s.end))
      errs.push(`S${s.season}: end "${s.end}" is not an ISO day`);
    if (s.end !== null && s.end <= s.start)
      errs.push(`S${s.season}: end ${s.end} is not after start ${s.start}`);
  }
  for (const p of PATCHES) {
    if (!VERSION_SHAPE.test(p.version))
      errs.push(`${p.version}: not the vendor's X.Y / X.YY grammar`);
    if (ERA_SHAPE.test(p.version)) errs.push(`${p.version}: looks like an era token`);
    if (!ISO_DAY.test(p.start)) errs.push(`${p.version}: start "${p.start}" is not an ISO day`);
    if (p.announcedOn === 'rising-news' && !p.url)
      errs.push(`${p.version}: announced on the news feed with no url — cite the post`);
  }

  // 2. Unique versions and unique start days (two builds on one day is a
  //    transcription error; the second would own no window).
  const seenV = new Set<string>();
  const seenD = new Map<string, string>();
  for (const p of PATCHES) {
    if (seenV.has(p.version)) errs.push(`${p.version}: duplicate version`);
    seenV.add(p.version);
    const other = seenD.get(p.start);
    if (other) errs.push(`${p.version} and ${other} share start ${p.start}`);
    seenD.set(p.start, p.version);
  }

  // 3. Version order agrees with date order — a transposed row files a month of
  //    records under the wrong build and asserts clean while doing it.
  for (let i = 1; i < byStart.length; i++) {
    const a = byStart[i - 1]!;
    const b = byStart[i]!;
    if (rank(b.version) <= rank(a.version))
      errs.push(
        `version order disagrees with date order: ${a.version} (${a.start}) then ${b.version} (${b.start})`,
      );
  }

  // 4. Floors and the future.
  for (const p of PATCHES) {
    if (p.start < PRE_RELEASE) errs.push(`${p.version}: starts ${p.start}, before ${PRE_RELEASE}`);
    if (p.start > today)
      errs.push(`${p.version}: starts ${p.start}, in the future (today ${today})`);
  }

  // 5. Eras tile the timeline: contiguous, the first on PRE_RELEASE, exactly
  //    one open (the last).
  const eras = [...SEASONS].sort((a, b) => a.start.localeCompare(b.start));
  if (eras[0]?.start !== PRE_RELEASE) errs.push(`the first era must open on ${PRE_RELEASE}`);
  for (let i = 1; i < eras.length; i++) {
    if (eras[i - 1]!.end !== eras[i]!.start)
      errs.push(
        `S${eras[i - 1]!.season} ends ${eras[i - 1]!.end} but S${eras[i]!.season} starts ${eras[i]!.start}`,
      );
  }
  const open = eras.filter((s) => s.end === null);
  if (open.length !== 1 || open[0] !== eras[eras.length - 1])
    errs.push(`exactly one era may be open, and it must be the newest`);

  // 6. Every patch falls in an era, and every era opens on its first child —
  //    an era with no child at its own start would file its first days under
  //    the era token alone.
  for (const p of PATCHES) if (!eraOf(p.start)) errs.push(`${p.version}: no era covers ${p.start}`);
  for (const s of SEASONS) {
    if (!PATCHES.some((p) => p.start === s.start))
      errs.push(`S${s.season} opens ${s.start} and no patch starts that day`);
  }

  // 7. THE CROSS-CHECK: every patch's major equals its era's versionMajor.
  //    Not the era authority (the vendor's sentence is), but a transcription
  //    of the wrong season boundary fails here.
  for (const p of PATCHES) {
    const e = eraOf(p.start);
    if (e && major(p.version) !== e.versionMajor)
      errs.push(`${p.version} sits in S${e.season}, whose version major is ${e.versionMajor}`);
  }

  // 8. The stale threshold must sit clear of the table's own widest gap.
  let widest = 0;
  for (let i = 1; i < byStart.length; i++) {
    const d = (Date.parse(byStart[i]!.start) - Date.parse(byStart[i - 1]!.start)) / 86_400_000;
    widest = Math.max(widest, d);
  }
  if (STALE_PATCH_DAYS <= widest)
    errs.push(
      `STALE_PATCH_DAYS ${STALE_PATCH_DAYS} is not above the widest real gap (${widest} d)`,
    );

  return errs;
}

/** Write the derived tables emit.ts also writes (same functions, same bytes). */
async function emitDerived(): Promise<string[]> {
  const dataDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'data');
  const files: [string, unknown][] = [
    ['seasonBoundaries.json', SEASONS],
    ['patchBoundaries.json', patchWindows()],
    ['patchGroups.json', buildPatchGroups()],
  ];
  for (const [name, value] of files) {
    await writeFile(join(dataDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  }
  return files.map(([name]) => name);
}

// isMain, never a bare argv check: parse.ts, emit.ts and expiries.ts import
// this module, and a bare `--check` test would fire here inside them.
const isMain = !!process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!);

if (isMain && (process.argv.includes('--check') || process.argv.includes('--emit'))) {
  const errs = validate();
  if (errs.length > 0) {
    console.error(`✖ ${errs.length} error(s) in the season/patch table:`);
    for (const e of errs) console.error(`  • ${e}`);
    process.exit(1);
  }
  const windows = patchWindows();
  const openers = SEASONS.filter((s) => PATCHES.some((p) => p.start === s.start)).length;
  console.log(
    `✓ ${SEASONS.length} eras, ${PATCHES.length} patches — ` +
      `${windows.filter((w) => w.end === null).length} open window(s), ` +
      `eras open on ${openers}/${SEASONS.length} first children, ` +
      `version major matches its era on ${PATCHES.length}/${PATCHES.length}`,
  );
  if (process.argv.includes('--emit')) {
    const written = await emitDerived();
    console.log(`✓ wrote data/${written.join(', data/')}`);
  }
}
