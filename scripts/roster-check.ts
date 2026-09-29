/**
 * Roster drift check — is data/characters.json still what Cygames ships?
 *
 * A roster goes stale silently: a fighter who is not on it fails no build, they
 * just leave every match they appear in filed with one side missing (the
 * residue gate is the other detector — see scripts/roster.ts).
 *
 * THREE VENDOR SURFACES, compared by SLUG first and by name second:
 *   · the English grid's `detail?char=<slug>` hrefs — the machine key;
 *   · the English grid's portrait alts — the display names, in page order;
 *   · the Japanese grid's alts — an independent template in another language.
 * If the three counts disagree, one extraction is broken and no verdict about
 * OUR roster would mean anything → UNREADABLE. The DLC page's "Additional
 * Character Set (X)" names are a fourth read: a named set we do not carry is
 * the announcement, and the only automatic one that arrives before footage.
 *
 * NETWORK, MANUAL, NEVER IN THE CRON. ../check-rosters.sh reads the
 * `roster-check: <STATE>` trailer this prints last.
 */

import { UNRELEASED } from './expiries';
import { loadCharacters, scrapeRoster } from './roster';

type State = 'CURRENT' | 'DRIFT' | 'UNVERIFIED' | 'UNREADABLE';
const verdict = (state: State, detail = ''): never => {
  if (detail) console.log(detail);
  console.log(`roster-check: ${state}`);
  process.exit(state === 'CURRENT' || state === 'UNVERIFIED' ? 0 : 1);
};

async function main(): Promise<void> {
  const local = await loadCharacters();
  const gated = new Set(UNRELEASED.map((u) => u.id));
  const bySlug = new Map<string, (typeof local)[number]>();
  const noSlug: string[] = [];
  for (const c of local) {
    const slug = c.extra?.siteSlug;
    if (slug) bySlug.set(slug, c);
    else noSlug.push(c.id);
  }
  if (noSlug.length)
    return void verdict(
      'UNREADABLE',
      `✖ roster row(s) with no extra.siteSlug: ${noSlug.join(', ')}`,
    );

  let scrape: Awaited<ReturnType<typeof scrapeRoster>>;
  try {
    scrape = await scrapeRoster();
  } catch (e) {
    return void verdict(
      'UNVERIFIED',
      `! could not reach rising.granbluefantasy.jp — ${(e as Error).message}`,
    );
  }
  const { slugs, namesEn, namesJa, dlc } = scrape;
  if (!slugs.length)
    return void verdict('UNREADABLE', '✖ the English grid yielded no slugs — markup drift.');
  if (slugs.length !== namesEn.length || slugs.length !== namesJa.length)
    return void verdict(
      'UNREADABLE',
      `✖ the vendor's own surfaces disagree: ${slugs.length} slugs, ${namesEn.length} English ` +
        `names, ${namesJa.length} Japanese names. Fix scrapeRoster() before trusting any count.`,
    );

  const lines: string[] = [];
  slugs.forEach((slug, i) => {
    const c = bySlug.get(slug);
    if (!c) {
      lines.push(
        `  MISSING  "${namesEn[i]}" / ${namesJa[i]} (slug ${slug}) — on the vendor grid, not ours.`,
        `           A fighter shipped: add a ROSTER row in scripts/characters.ts, get an accent`,
        `           from a design session into design/handoff/tokens.css, add the patch to`,
        `           scripts/seasons.ts, then data:characters, data:art, data:og.`,
      );
      return;
    }
    if (c.name !== namesEn[i])
      lines.push(`  NAME     ${c.id}: vendor "${namesEn[i]}", ours "${c.name}"`);
    if (c.extra?.nameJa !== namesJa[i])
      lines.push(`  NAME-JA  ${c.id}: vendor "${namesJa[i]}", ours "${c.extra?.nameJa}"`);
  });
  for (const [slug, c] of bySlug)
    if (!slugs.includes(slug))
      lines.push(
        `  EXTRA    ${c.id} (slug ${slug}) — ours, not on the vendor grid. Records reference it; confirm first.`,
      );
  const names = new Set(local.map((c) => c.name.toLowerCase()));
  for (const d of dlc)
    if (!names.has(d.toLowerCase()) && !gated.has(d.toLowerCase()))
      lines.push(`  DLC      "${d}" is on the DLC page and not on our roster or in UNRELEASED.`);

  console.log(
    `  ${slugs.length} fighters on the vendor grid (EN and JP agree) · ${local.length} in characters.json · ${dlc.length} DLC sets`,
  );
  if (!lines.length)
    return void verdict('CURRENT', '✓ roster matches the vendor grid in both languages');
  verdict('DRIFT', ['✖ roster has drifted from rising.granbluefantasy.jp', ...lines].join('\n'));
}

await main();
