/**
 * Patch-table drift check — is scripts/seasons.ts still what Cygames ships?
 *
 * THE FEED. rising.granbluefantasy.jp renders its news page client-side from a
 * microCMS service; the read key it uses is PUBLIC, embedded in the site's own
 * news bundle. This checker does exactly what the page does: it reads the key
 * out of the bundle at run time (never committed — a rotated key heals itself)
 * and queries `news_en` and `news_ja`. Measured 2026-09-29: 22 versioned
 * patch-note posts, the same 22 in both languages.
 *
 * WHAT FAILS HARD (checklist 4c), and why each rule exists:
 *   · A post in the `patchnotes` category that is neither a version post nor on
 *     the NAMED skip list → UNREADABLE. Two such posts exist today — "Known
 *     Bugs (Updated …)" and "Post-Second Beta Adjustments …" — and each is named
 *     below with its reason. A third would be exactly the post this checker
 *     exists to notice.
 *   · A version present in one language feed and not the other → UNREADABLE.
 *   · A duplicate version → UNREADABLE.
 *   · Fewer version posts than FLOOR_POSTS → UNREADABLE (a markup or API
 *     change, not a quiet vendor).
 *   · A version in the feed and not the table, or the reverse, or a start day
 *     or post id that disagrees → DRIFT.
 * WHAT DOES NOT: a transport failure (UNVERIFIED, exit 0 — a vendor outage is
 * not ours to go red on), and a date disagreement BETWEEN the two language
 * feeds (2.22 is 08-12 in EN and 08-13 in JA — the table takes the earlier, see
 * seasons.ts) — printed, never fatal.
 * DECOYS THAT NEVER MINT: version-bearing titles outside the category —
 * "Beatrix Adjustments Coming to Version 1.42", "Changes Coming to Ranked
 * Matches in Version 2.10", and two update-showcase events. Category AND title
 * grammar are both required.
 *
 * NETWORK, MANUAL, NEVER IN THE CRON. The workspace's ../check-patches.sh reads
 * the `patch-check: <STATE>` trailer this prints last.
 *
 * `PATCH_CHECK_FIXTURE=<file.json>` ({ en: Post[], ja: Post[] }) replaces the
 * network for verify-gates' controls.
 */

import { readFile } from 'node:fs/promises';

import { PATCHES } from './seasons';

const SITE = 'https://rising.granbluefantasy.jp';
const FLOOR_POSTS = 20;

interface Post {
  id: string;
  title: string;
  date?: string;
  publishedAt: string;
  category?: string[];
}

type State = 'CURRENT' | 'DRIFT' | 'UNVERIFIED' | 'UNREADABLE';
const verdict = (state: State, detail = ''): never => {
  if (detail) console.log(detail);
  console.log(`patch-check: ${state}`);
  process.exit(state === 'CURRENT' || state === 'UNVERIFIED' ? 0 : 1);
};

/** The version grammar, both languages, measured on all 22 posts. */
const VER = /^(?:Version|Ver)\s*\.?\s*(\d+\.\d{1,2})\s*(?:Patch\s*Notes|パッチノート)\s*$/i;
/** `patchnotes`-category posts that are known NOT to be versions. */
const NAMED_SKIP: { pattern: RegExp; why: string }[] = [
  { pattern: /^Known Bugs\b|^既知の不具合/, why: 'a rolling known-issues list, re-dated in place' },
  {
    pattern: /^Post-Second Beta Adjustments|^製品版におけるβ2からの調整項目/,
    why: 'the pre-launch beta-to-release changelog (2023-12-08) — the launch build, 1.0',
  },
];

async function fetchPosts(): Promise<{ en: Post[]; ja: Post[] }> {
  if (process.env.PATCH_CHECK_FIXTURE)
    return JSON.parse(await readFile(process.env.PATCH_CHECK_FIXTURE, 'utf8')) as {
      en: Post[];
      ja: Post[];
    };
  const page = await (await fetch(`${SITE}/en/news/`)).text();
  const bundle = /src="(\/assets\/js\/news\.[0-9a-f]+\.js)"/.exec(page)?.[1];
  if (!bundle) throw new Error('news page no longer references a news.*.js bundle');
  const js = await (await fetch(`${SITE}${bundle}`)).text();
  const key = /apiKey:"([^"]+)"/.exec(js)?.[1];
  const domain = /serviceDomain:"([^"]+)"/.exec(js)?.[1];
  if (!key || !domain) throw new Error('news bundle no longer carries the CMS domain/key');
  const read = async (ep: string): Promise<Post[]> => {
    const res = await fetch(
      `https://${domain}.microcms.io/api/v1/${ep}?limit=100&fields=id,title,date,publishedAt,category`,
      { headers: { 'X-MICROCMS-API-KEY': key } },
    );
    if (!res.ok) throw new Error(`${ep}: HTTP ${res.status}`);
    const body = (await res.json()) as { contents: Post[]; totalCount: number };
    if (body.totalCount > 100) throw new Error(`${ep}: ${body.totalCount} posts — page past 100`);
    return body.contents;
  };
  return { en: await read('news_en'), ja: await read('news_ja') };
}

function classify(posts: Post[], lang: string, unreadable: string[], decoys: string[]) {
  const versions = new Map<string, Post>();
  for (const p of posts) {
    const title = p.title.trim();
    const m = VER.exec(title);
    const isNotes = (p.category ?? []).includes('patchnotes');
    if (m) {
      if (versions.has(m[1]!))
        unreadable.push(
          `${lang}: version ${m[1]} posted twice (${versions.get(m[1]!)!.id}, ${p.id})`,
        );
      versions.set(m[1]!, p);
      continue;
    }
    if (isNotes) {
      if (!NAMED_SKIP.some((s) => s.pattern.test(title)))
        unreadable.push(
          `${lang}: patchnotes post "${title}" (${p.id}) is neither a version nor a named skip`,
        );
      continue;
    }
    if (/\d+\.\d{1,2}/.test(title)) decoys.push(`${lang}: "${title}"`);
  }
  return versions;
}

const earliestDay = (...iso: (string | undefined)[]): string =>
  iso
    .filter((s): s is string => !!s)
    .sort()[0]!
    .slice(0, 10);

async function main(): Promise<void> {
  let feeds: { en: Post[]; ja: Post[] };
  try {
    feeds = await fetchPosts();
  } catch (e) {
    return void verdict('UNVERIFIED', `! could not read the vendor feed — ${(e as Error).message}`);
  }
  const unreadable: string[] = [];
  const decoys: string[] = [];
  const en = classify(feeds.en, 'en', unreadable, decoys);
  const ja = classify(feeds.ja, 'ja', unreadable, decoys);
  if (en.size < FLOOR_POSTS)
    unreadable.push(`only ${en.size} English version posts (floor ${FLOOR_POSTS})`);
  for (const v of en.keys()) if (!ja.has(v)) unreadable.push(`${v} is in news_en and not news_ja`);
  for (const v of ja.keys()) if (!en.has(v)) unreadable.push(`${v} is in news_ja and not news_en`);
  if (unreadable.length)
    return void verdict(
      'UNREADABLE',
      [
        '✖ the feed has posts this checker cannot account for:',
        ...unreadable.map((u) => `  ${u}`),
      ].join('\n'),
    );

  const drift: string[] = [];
  const notes: string[] = [];
  const table = new Map(
    PATCHES.filter((p) => p.announcedOn === 'rising-news').map((p) => [p.version, p]),
  );
  for (const [v, e] of en) {
    const j = ja.get(v)!;
    const start = earliestDay(e.date, e.publishedAt, j.date, j.publishedAt);
    const enDay = earliestDay(e.date, e.publishedAt);
    const jaDay = earliestDay(j.date, j.publishedAt);
    if (enDay !== jaDay)
      notes.push(`${v}: EN says ${enDay}, JA says ${jaDay} — the table takes ${start}`);
    const row = table.get(v);
    if (!row) {
      drift.push(
        `MISSING  ${v} (start ${start}, post ${e.id}) — shipped and not in scripts/seasons.ts`,
      );
      continue;
    }
    if (row.start !== start)
      drift.push(`START    ${v}: table ${row.start}, vendor's earliest statement ${start}`);
    if (!row.url?.endsWith(`id=${e.id}`))
      drift.push(`URL      ${v}: table ${row.url}, post id ${e.id}`);
  }
  for (const v of table.keys())
    if (!en.has(v)) drift.push(`EXTRA    ${v} — in the table, not in the feed`);

  console.log(
    `  ${en.size} version posts in each language feed · ${table.size} news-announced rows in the table`,
  );
  for (const n of notes) console.log(`  · ${n}`);
  if (decoys.length)
    console.log(
      `  ${decoys.length} version-bearing non-patch titles ignored (category + grammar required)`,
    );
  if (drift.length)
    return void verdict(
      'DRIFT',
      ['✖ the patch table has drifted from the vendor feed', ...drift.map((d) => `  ${d}`)].join(
        '\n',
      ),
    );
  verdict('CURRENT', '✓ the patch table matches the vendor feed');
}

await main();
