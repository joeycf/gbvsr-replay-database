/**
 * The roster — 40 fighters, enumerated from the vendor, checked, and written to
 * data/characters.json.
 *
 * ── SOURCE ──────────────────────────────────────────────────────────────────
 * rising.granbluefantasy.jp, read 2026-09-29: the English grid's 40
 * `detail?char=<slug>` links and portrait alts (the English names), and the
 * Japanese grid's 40 alts (the Japanese names), aligned by page order and
 * checked pair by pair. The DLC page lists Character Pass 1 (Lucilius, 2B,
 * Vane, Beatrix, Versusia, Vikala) and Character Pass 2 (Sandalphon, Galleon,
 * Wilnas, Meg, Ilsa, Id) — complete. There are no announced-but-unshipped
 * slots, so UNRELEASED (scripts/expiries.ts) ships empty.
 *
 * ── THE IDS ARE THE HANDOFF'S, AND THAT WAS MEASURED (checklist 11c) ───────
 * Short, as the design handoff keyed them. ComboForge's `gbvsr` roster (39
 * fighters, read 2026-09-29) derives 38 of 40 from these ids with no override:
 * `meg` → `meg-margaret-bluemarine` needs one, and `id` is not upstream yet
 * (Id shipped 2026-09-15). Full-name ids would derive fewer. The vendor's own
 * slug differs from ours exactly once — `avatarbelial` / `avatar-belial` —
 * and is carried in `extra.siteSlug` for the roster check.
 *
 * ── TWO IDS THIS ROSTER MAKES INTERESTING ───────────────────────────────────
 * `id` — a fighter literally named Id. The id is data everywhere it appears
 * (a route param VALUE, a `?c=` value, an --accent-id custom property); e2e
 * asserts each surface rather than assuming it. In TITLES, "ID"/"Id" is also an
 * English word; measured over the recon's titles from 2023-12-11 to the day
 * before she shipped, 9 such tokens occurred and all 9 were Cygames' own
 * announcements of her — no "Replay ID" noise at all. The two-letter alias
 * keeps the matcher's STRICT boundary guard for that reason (scripts/roster.ts).
 * `2b` — the one digit-leading id. Nothing on the platform validates ids with a
 * leading-letter rule; e2e's name-sync regex is widened for it.
 *
 * ── THE JAPANESE NAMES ARE WHERE A GUESSED TABLE FAILS ──────────────────────
 * Ladiva is ファスティバ (romanised "Fastiva" in real titles), Anre is ウーノ
 * ("Uno" — and a real PLAYER is named UNO; see roster.ts's allow-list), Seox is
 * シス ("Six"), Lucilius is ルシファー ("Lucifer"), Avatar Belial is
 * アバタール・ベリアル. None of these is derivable from the English names.
 *
 * ── ALIASES ARE MEASURED ────────────────────────────────────────────────────
 * Beyond the vendor's EN and JP names, every alias below was SEEN in the
 * recon's titles or catalogue labels (bracket contents that resolved to
 * nothing, 2023-12-11 onward, counts in parentheses): Lanslot (21), ジークフリード
 * (7), Grimnil (4), Caliostro (3), Seigfried, Beatlix, Lowian, Vikal,
 * ヴェルセシア, anira (2 each), Carlotta (fgHighLevel), and the catalogue's own
 * label typos Cgliostro, Lucillius, Meterra, Zoeey. Korean spellings (가레온,
 * 비카라, …) appear in ~9 titles from one uploader and the vendor publishes no
 * Korean roster to anchor them, so they are left to the residue report.
 * Community abbreviations (Kat, Lance, Char, Grim, Sandy, …) are NOT here: none
 * was measured, several are English words, and the reject printer is how one
 * earns its place.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { CharacterRecord, PlayerRecord } from '../types/index';
import { dueExpiries, UNRELEASED } from './expiries';
import { aliasKey, buildAliasMatcher, CONFIRMED_FIGHTER_NAMED_PLAYERS, playerId } from './roster';
import { PATCHES, PRE_RELEASE } from './seasons';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TOKENS = join(ROOT, 'design', 'handoff', 'tokens.css');
const OUT = join(ROOT, 'data', 'characters.json');
const PLAYERS = join(ROOT, 'data', 'players.json');

type Pass = 'base' | 'cp1' | 'cp2';

interface RosterRow {
  id: string;
  /** English display name, exactly as the vendor's grid alt writes it. */
  name: string;
  /** Japanese display name from the vendor's Japanese grid. */
  nameJa: string;
  /** The vendor's `detail?char=` slug. */
  siteSlug: string;
  pass: Pass;
  /** The patch that made them playable (seasons.ts); base = early access. */
  releasedIn: string;
  /** Present only on the three fighters with an EX mode (Ver 2.20). */
  exSince?: string;
  aliases: string[];
}

const base = (id: string, name: string, nameJa: string, aliases: string[] = []): RosterRow => ({
  id,
  name,
  nameJa,
  siteSlug: id.replace(/-/g, ''),
  pass: 'base',
  releasedIn: '1.0',
  aliases,
});
const dlc = (
  id: string,
  name: string,
  nameJa: string,
  pass: Pass,
  releasedIn: string,
  aliases: string[] = [],
): RosterRow => ({ id, name, nameJa, siteSlug: id, pass, releasedIn, aliases });

/** Ver 2.20 — the patch that added EX mode (and Wilnas). */
const EX_PATCH = '2.20';

/** In the vendor grid's own order. */
export const ROSTER: RosterRow[] = [
  { ...base('gran', 'Gran', 'グラン'), exSince: EX_PATCH },
  { ...base('djeeta', 'Djeeta', 'ジータ'), exSince: EX_PATCH },
  base('katalina', 'Katalina', 'カタリナ'),
  base('charlotta', 'Charlotta', 'シャルロッテ', ['Carlotta']),
  base('lancelot', 'Lancelot', 'ランスロット', ['Lanslot']),
  base('percival', 'Percival', 'パーシヴァル'),
  base('ladiva', 'Ladiva', 'ファスティバ', ['Fastiva']),
  base('metera', 'Metera', 'メーテラ', ['Meterra']),
  base('lowain', 'Lowain', 'ローアイン', ['Lowian']),
  base('ferry', 'Ferry', 'フェリ'),
  base('zeta', 'Zeta', 'ゼタ'),
  base('vaseraga', 'Vaseraga', 'バザラガ'),
  { ...base('narmaya', 'Narmaya', 'ナルメア'), exSince: EX_PATCH },
  base('soriz', 'Soriz', 'ソリッズ'),
  base('zooey', 'Zooey', 'ゾーイ', ['Zoeey']),
  base('cagliostro', 'Cagliostro', 'カリオストロ', ['Caliostro', 'Cgliostro']),
  base('yuel', 'Yuel', 'ユエル'),
  base('anre', 'Anre', 'ウーノ', ['Uno']),
  base('eustace', 'Eustace', 'ユーステス'),
  base('seox', 'Seox', 'シス', ['Six']),
  base('vira', 'Vira', 'ヴィーラ'),
  base('beelzebub', 'Beelzebub', 'ベルゼバブ'),
  base('belial', 'Belial', 'ベリアル'),
  base('avatar-belial', 'Avatar Belial', 'アバタール・ベリアル'),
  base('anila', 'Anila', 'アニラ', ['Anira']),
  base('siegfried', 'Siegfried', 'ジークフリート', ['ジークフリード', 'Seigfried']),
  base('grimnir', 'Grimnir', 'グリームニル', ['Grimnil']),
  base('nier', 'Nier', 'ニーア'),
  dlc('lucilius', 'Lucilius', 'ルシファー', 'cp1', '1.1', ['Lucifer', 'Lucillius']),
  dlc('2b', '2B', '2B', 'cp1', '1.21'),
  dlc('vane', 'Vane', 'ヴェイン', 'cp1', '1.30'),
  dlc('beatrix', 'Beatrix', 'ベアトリクス', 'cp1', '1.40', ['Beatlix']),
  dlc('versusia', 'Versusia', 'ヴェルサシア', 'cp1', '1.50', ['ヴェルセシア']),
  dlc('vikala', 'Vikala', 'ビカラ', 'cp1', '1.60', ['Vikal']),
  dlc('sandalphon', 'Sandalphon', 'サンダルフォン', 'cp2', '2.00'),
  dlc('galleon', 'Galleon', 'ガレヲン', 'cp2', '2.10'),
  dlc('wilnas', 'Wilnas', 'ウィルナス', 'cp2', '2.20'),
  dlc('meg', 'Meg', 'メグ', 'cp2', '2.30'),
  dlc('ilsa', 'Ilsa', 'イルザ', 'cp2', '2.50'),
  dlc('id', 'Id', 'イド', 'cp2', '2.60'),
];

/**
 * Keys no fighter may claim. Each is a real hazard in THIS corpus's titles.
 * aliasKey-normalised, so the check is exactly what the matcher would see.
 */
const BANNED_ALIASES: { key: string; why: string }[] = [
  { key: 'avatar', why: 'half of "Avatar Belial", and the name of another game on this platform.' },
  { key: 'ab', why: 'initialism — indistinguishable from a team tag.' },
  { key: 'ex', why: 'the EX MODE mark (Ver 2.20), read by findExTokens — never a character.' },
  { key: 'gbvs', why: "the previous game's marker." },
  { key: 'rising', why: 'the game marker.' },
  { key: 'lunalu', why: 'in the Fan Kit and a vendor note, but not on the versus roster.' },
  { key: 'char', why: 'English word ("char select").' },
  { key: 'lance', why: 'English word; `Lancelot` is unambiguous.' },
  { key: 'grim', why: 'English word; `Grimnir` is unambiguous.' },
  {
    key: 'summer',
    why: 'a SKIN name (Summer Belial, …), stripped by stripSkins — never a fighter.',
  },
];

/** The engine card surface every accent must clear AA against. */
const SURFACE = '#171933';

const lum = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255) as [
    number,
    number,
    number,
  ];
  const f = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a: string, b: string): number => {
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

async function readAccents(): Promise<Map<string, string>> {
  const css = await readFile(TOKENS, 'utf8');
  const out = new Map<string, string>();
  for (const m of css.matchAll(/--char-([a-z0-9-]+):\s*(#[0-9A-Fa-f]{6})\s*;/g)) {
    out.set(m[1]!, m[2]!.toUpperCase());
  }
  return out;
}

async function readPlayers(): Promise<PlayerRecord[]> {
  try {
    return JSON.parse(await readFile(PLAYERS, 'utf8')) as PlayerRecord[];
  } catch {
    return [];
  }
}

/** The day a patch opened (seasons.ts), or PRE_RELEASE for the launch build. */
const patchStart = (version: string): string | undefined =>
  PATCHES.find((p) => p.version === version)?.start;

export function buildRecords(accents: Map<string, string>): CharacterRecord[] {
  return ROSTER.map((c) => ({
    id: c.id,
    name: c.name,
    imgPortrait: `/img/char/${c.id}.webp`,
    imgSplash: `/img/splash/${c.id}.webp`,
    accent: accents.get(c.id) ?? '#000000',
    extra: {
      aliases: [c.nameJa, ...c.aliases].filter((a) => a !== c.name),
      siteSlug: c.siteSlug,
      nameJa: c.nameJa,
      pass: c.pass,
      released: patchStart(c.releasedIn) ?? PRE_RELEASE,
      ...(c.exSince ? { exSince: patchStart(c.exSince) } : {}),
    },
  }));
}

async function main(): Promise<void> {
  const blocking = dueExpiries().filter((d) => d.kind === 'unreleased-character');
  if (blocking.length) {
    console.error(`✖ ${blocking.length} roster expiry(s) due — resolve them first:`);
    for (const d of blocking)
      console.error(`  ${d.id} (${d.kind}, due ${d.date})\n    ${d.action}`);
    process.exit(1);
  }

  const accents = await readAccents();
  const errs: string[] = [];
  const warns: string[] = [];

  // 1. Ids, slugs and names are unique; ids are CSS/URL-safe slugs.
  const seen = {
    id: new Set<string>(),
    slug: new Map<string, string>(),
    name: new Map<string, string>(),
  };
  for (const c of ROSTER) {
    if (seen.id.has(c.id)) errs.push(`duplicate id ${c.id}`);
    seen.id.add(c.id);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.id)) errs.push(`${c.id}: not a kebab slug`);
    const so = seen.slug.get(c.siteSlug);
    if (so) errs.push(`site slug "${c.siteSlug}" claimed by ${so} and ${c.id}`);
    seen.slug.set(c.siteSlug, c.id);
    const no = seen.name.get(c.name.toLowerCase());
    if (no) errs.push(`name "${c.name}" claimed by ${no} and ${c.id}`);
    seen.name.set(c.name.toLowerCase(), c.id);
    if (!patchStart(c.releasedIn))
      errs.push(`${c.id}: releasedIn ${c.releasedIn} is not a patch in seasons.ts`);
    if (c.exSince && !patchStart(c.exSince))
      errs.push(`${c.id}: exSince ${c.exSince} is not a patch`);
  }
  if (ROSTER.length !== 40) errs.push(`ROSTER has ${ROSTER.length} rows; the vendor lists 40`);
  const exIds = ROSTER.filter((c) => c.exSince)
    .map((c) => c.id)
    .sort();
  if (exIds.join(',') !== 'djeeta,gran,narmaya')
    errs.push(
      `EX mode is Gran, Djeeta and Narmaya only (Ver 2.20); ROSTER marks ${exIds.join(', ')}`,
    );

  // 2. Every roster id has exactly one --char-<id> token and every token has a
  //    roster row. The ids ARE the handoff's tokens (no TOKEN_FOR map here).
  for (const c of ROSTER)
    if (!accents.has(c.id)) errs.push(`${c.id}: no --char-${c.id} in tokens.css`);
  for (const t of accents.keys())
    if (!seen.id.has(t)) errs.push(`tokens.css --char-${t} has no roster row`);

  // 3. Accents clear AA on the card surface.
  for (const c of ROSTER) {
    const hex = accents.get(c.id);
    if (!hex) continue;
    const r = contrast(hex, SURFACE);
    if (r < 4.5) errs.push(`${c.id}: accent ${hex} is ${r.toFixed(2)}:1 on ${SURFACE} (<4.5)`);
  }

  // 4. UNRELEASED is disjoint from ROSTER.
  for (const u of UNRELEASED)
    if (seen.id.has(u.id)) errs.push(`${u.id} is in ROSTER and UNRELEASED`);

  // 5. Aliases: non-empty, unique through the matcher's own key, never banned.
  const aliasOwner = new Map<string, string>();
  for (const c of ROSTER) {
    for (const a of [c.name, c.nameJa, ...c.aliases]) {
      const k = aliasKey(a);
      if (!k) {
        errs.push(`${c.id}: alias "${a}" has no letters or digits`);
        continue;
      }
      const owner = aliasOwner.get(k);
      if (owner && owner !== c.id) errs.push(`alias "${a}" claimed by ${owner} and ${c.id}`);
      aliasOwner.set(k, c.id);
    }
  }
  for (const b of BANNED_ALIASES) {
    const owner = aliasOwner.get(b.key);
    if (owner) errs.push(`"${b.key}" is BANNED but ${owner} claims it — ${b.why}`);
  }

  // 6. The matcher resolves every alias to its own fighter — and the nesting
  //    this roster is built around is asserted, not assumed.
  const records = buildRecords(accents);
  const matcher = buildAliasMatcher(records);
  for (const c of ROSTER) {
    for (const a of [c.name, c.nameJa, ...c.aliases]) {
      const got = matcher.one(a);
      if (got !== c.id)
        errs.push(`matcher: "${a}" should resolve to ${c.id}, got ${got ?? 'nothing'}`);
    }
  }
  const expect = (text: string, want: string[]) => {
    const got = matcher.ids(text);
    if (got.join(',') !== want.join(','))
      errs.push(`matcher: "${text}" → [${got.join(', ')}], expected [${want.join(', ')}]`);
  };
  expect('Avatar Belial', ['avatar-belial']);
  expect('AvatarBelial', ['avatar-belial']);
  expect('アバタール・ベリアル', ['avatar-belial']);
  expect('Belial vs Avatar Belial', ['belial', 'avatar-belial']);
  expect('cagliostroカリオストロ', ['cagliostro']);
  expect('Tako ID VS OZ Japan Vane', ['id', 'vane']);
  expect('IDカード', []);
  expect('Megaman', []);
  expect('2B', ['2b']);

  // 7. The fighter-named-player allow-list (checklist 5n): every row slugs to
  //    its own id, still collides with a roster name, and carries evidence.
  const confirmed = new Map(CONFIRMED_FIGHTER_NAMED_PLAYERS.map((p) => [p.id, p]));
  for (const p of CONFIRMED_FIGHTER_NAMED_PLAYERS) {
    if (playerId(p.handle) !== p.id)
      errs.push(`allow-list: "${p.handle}" slugs to "${playerId(p.handle)}", not "${p.id}"`);
    if (matcher.find(p.handle).length === 0)
      errs.push(
        `allow-list: "${p.handle}" no longer collides with any roster name — delete the row`,
      );
    if (!p.video) warns.push(`allow-list: "${p.handle}" has no evidence video yet`);
  }
  // 8. The registry invariant, at roster-build time too: no committed player's
  //    handle may resolve to a fighter unless the allow-list names it.
  for (const p of await readPlayers()) {
    const spellings = [p.handle, ...((p.extra?.aliases as string[] | undefined) ?? [])];
    const hits = [...new Set(spellings.flatMap((s) => matcher.ids(s)))];
    if (hits.length && !confirmed.has(p.id))
      errs.push(
        `player "${p.handle}" (${p.id}) contains roster name(s) ${hits.join(', ')} and is not on ` +
          `CONFIRMED_FIGHTER_NAMED_PLAYERS. A real person goes on the list WITH a video id; a ` +
          `fighter parsed into the handle slot is a parse bug — never an exemption.`,
      );
  }

  for (const w of warns) console.warn(`  ⚠ ${w}`);
  if (errs.length) {
    console.error(`✖ ${errs.length} roster error(s):`);
    for (const e of errs) console.error(`  • ${e}`);
    process.exit(1);
  }
  await writeFile(OUT, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
  const low = Math.min(...ROSTER.map((c) => contrast(accents.get(c.id)!, SURFACE)));
  console.log(
    `✓ ${records.length} fighters, ${matcher.aliasCount} alias keys, lowest accent ` +
      `${low.toFixed(2)}:1 on ${SURFACE} → data/characters.json`,
  );
}

const isMain = !!process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!);
if (isMain) await main();
