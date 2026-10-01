/**
 * End-to-end checks against the BUILT static output.
 *
 * Everything here reads `.vercel/output/static/gbvsr` — what Vercel actually
 * serves — rather than source files or a dev server. Source can be perfect
 * while the build ships the umbrella theme, an unprerendered route, a
 * provenance leak, or a footer that drops a licence notice on phones; those are
 * the failures this catches.
 *
 * ── EMPTY-CORPUS MODE, AND IT SKIPS VISIBLY ──────────────────────────────
 * A build with zero replays is a legitimate state — it is what Stage 1 of a new
 * game produces and what a fresh clone has before the first fetch. The
 * corpus-shaped checks then have nothing to assert on, so they are SKIPPED AND
 * COUNTED, never quietly passed. A suite that reports green on an empty corpus
 * is a suite that will report green on a broken one.
 *
 * ── THE PORT ─────────────────────────────────────────────────────────────
 * Strive's suite (build output, the theme battery by brace depth, the accents,
 * the sourceChannels name sync across the two TypeScript tracks, art framing,
 * the art credit by class attribute, segment shape, summary `game`), plus:
 *
 *  · Avatar's `engine` check: summary.json carries the pin nuxt.config.ts
 *    spells (checklist 10i), or verify:deployed cannot tell a landed pin bump
 *    from a build in flight.
 *  · Tekken's CRON GUARD, fixed for the multi-line `git add`. Its parser reads
 *    the staged list off ONE line; this workflow (like Strive's and Avatar's)
 *    continues that command over five, and against `git add \` the ported
 *    regex matches nothing at all (measured: it returns no list), so the port
 *    cannot check a single file. Here the `\`+newline continuations are joined
 *    BEFORE parsing — and it caught a live omission when it was written
 *    (data/theater-disagreements.json, missing from Strive's list too).
 *  · GBVSR's own surfaces, each an id some part of the stack could mistake for
 *    something else: the fighter literally named `id` (an HTML attribute, a
 *    JSON key, a route param, and "ID" in a thousand titles), the digit-led
 *    `2b`, and `avatar-belial`, which must never split into `belial`. And the
 *    EX mark: positive evidence only, on three fighters, from Ver 2.20.
 *  · The art is asserted by the SHIPPED BYTES against data/art-provenance.json:
 *    the Fan Kit and the licence-revocation fallback (`npm run
 *    data:art:revoked`) are both legal states; a MIX of the two is not, and
 *    only a hash comparison can see one.
 *
 * Run: npm run test:e2e   (after `npm run build`)
 */

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import sharp from 'sharp';

import { CONFIRMED_FIGHTER_NAMED_PLAYERS } from './roster';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SLUG = 'gbvsr';
const OUT = join(ROOT, '.vercel', 'output', 'static', SLUG);

let pass = 0;
let fail = 0;
let skipped = 0;
const failures: string[] = [];

const check = (name: string, ok: boolean, detail = ''): void => {
  if (ok) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
};
const skip = (name: string, why: string): void => {
  skipped++;
  console.log(`  ⊘ ${name} — SKIPPED: ${why}`);
};

if (!existsSync(OUT)) {
  console.error(`✖ ${OUT} does not exist. Run \`npm run build\` first.`);
  process.exit(1);
}

const read = (p: string): string => readFileSync(join(OUT, p), 'utf8');
const has = (p: string): boolean => existsSync(join(OUT, p));
const src = (p: string): string => readFileSync(join(ROOT, p), 'utf8');

// ── build output ────────────────────────────────────────────────────────────

console.log('▶ build output\n');
check('index.html prerendered', has('index.html'));
check('stats page prerendered', has('stats/index.html'));
check('characters index prerendered', has('characters/index.html'));
check('players index prerendered', has('players/index.html'));
check('404.html emitted', has('404.html'));
check('sitemap.xml emitted', has('sitemap.xml'));
check('robots.txt emitted', has('robots.txt'));
check('manifest emitted', has('manifest.webmanifest'));
check('OG card shipped', has('og-default.png'));
check('replays.json shipped under the base', has('data/replays.json'));
check('summary.json shipped (the apex selector reads this)', has('data/summary.json'));

// ── the apex card payload's CONTRACT ────────────────────────────────────────
// Both of these shipped wrong on a sibling and neither showed on the page,
// because the selector only reads `replays` for its card count.
//
//  · the identity key is `game`, not `id`. Every sibling emits {"game": …} and
//    the shell's cutover battery asserts payload.game === the game's id.
//  · `updated` is the NEWEST REPLAY's date, never the build time. The cron only
//    commits files that actually changed, so a build-time stamp makes this file
//    differ on every run and puts a deploy on the calendar daily whether or not
//    a single match arrived.
const summary = JSON.parse(read('data/summary.json')) as {
  game?: string;
  id?: string;
  name?: string;
  replays?: number;
  players?: number;
  characters?: number;
  updated?: string;
  engine?: string;
};
check(
  'summary.json identity key is `game` (the platform contract), not `id`',
  summary.game === SLUG && summary.id === undefined,
  JSON.stringify(summary),
);

const ENGINE_PIN = /replay-engine#(v[\d.]+)/.exec(src('nuxt.config.ts'))?.[1] ?? '';
check(
  'nuxt.config.ts pins a concrete engine tag (never a branch)',
  /^v\d+\.\d+\.\d+$/.test(ENGINE_PIN),
  `read "${ENGINE_PIN}" out of the extends[] entry`,
);
check(
  `summary.json carries \`engine\` and it is the pinned tag ${ENGINE_PIN}`,
  summary.engine === ENGINE_PIN,
  `summary says ${JSON.stringify(summary.engine)} — scripts/emit.ts must write ` +
    `"engine": "${ENGINE_PIN}", the tag verbatim as nuxt.config.ts spells it. Without it ` +
    'verify:deployed cannot tell a landed pin bump from a build in flight (checklist 10i).',
);

// ── the theme override contract (STACK §5.13) ───────────────────────────────
//
// The failure this catches is the one the engine README calls out: an app
// stylesheet written as @theme ships raw, the browser drops it as an unknown
// at-rule, and PRODUCTION SILENTLY WEARS THE UMBRELLA DEFAULTS while `nuxt dev`
// — which compiles each CSS file on its own — looks perfect.
//
// PRESENCE OF THE UMBRELLA DEFAULT IS NOT A FAILURE. The engine ships its
// neutral palette as a FALLBACK inside `@layer theme`, and the game's unlayered
// `:root` wins the cascade over it. That is the documented contract, not a
// leak. What has to hold is the thing the cascade depends on, and it is
// STRUCTURAL rather than positional: an unlayered rule beats a layered one
// wherever it appears, and a layered rule loses even if it appears last. So the
// check reads BRACE DEPTH — ours must sit at depth 1 (a top-level `:root`),
// the umbrella's deeper (inside `@layer theme`).
console.log('\n▶ theme override (the @theme trap, and the layer contract)\n');

/** The stylesheets index.html actually loads, in document order — readdir
 *  order is not the cascade and would make the comparison below meaningless. */
const cssHrefs = [...read('index.html').matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)]
  .map((m) => m[1])
  .map((href) => href.replace(new RegExp(`^/${SLUG}/`), ''))
  .filter((p) => has(p));
const css = cssHrefs.map((p) => read(p)).join('\n');
check(
  'the home page loads at least one stylesheet',
  cssHrefs.length > 0,
  'no <link rel="stylesheet"> in index.html',
);

/** Nesting depth at `index`, quoted strings skipped. Depth 1 means a top-level
 *  block; anything deeper is inside an at-rule. */
const depthAt = (text: string, index: number): number => {
  let depth = 0;
  let quote = '';
  for (let i = 0; i < index; i++) {
    const c = text[i];
    if (quote) {
      if (c === '\\') i++;
      else if (c === quote) quote = '';
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') depth--;
  }
  return depth;
};

// The 18 engine tokens this game shadows. app/assets/theme.css is the
// authority; the list is READ FROM IT rather than retyped, so adding a token
// there cannot leave this check asserting yesterday's set.
const shadowed = [
  ...new Set(
    [...src('app/assets/theme.css').matchAll(/^ {2}(--color-[a-z0-9-]+):/gm)].map((m) => m[1]),
  ),
];
check(
  'app/assets/theme.css shadows 18 engine --color-* tokens',
  shadowed.length === 18,
  `${shadowed.length}: ${shadowed.join(', ')}`,
);
const missing = shadowed.filter((t) => !css.includes(`${t}:`));
check(
  'every shadowed --color-* token reaches the built CSS',
  missing.length === 0,
  missing.join(', '),
);
check(
  'no raw @theme block shipped (the browser would drop it as an unknown at-rule)',
  !css.includes('@theme'),
  'an @theme at-rule reached the bundle',
);

const OURS = '#4da6ff'; // --color-primary, the logo's sky blue
const UMBRELLA = '#17cfc8'; // the engine's neutral default
const oursAt = css.toLowerCase().lastIndexOf(OURS);
const umbrellaAt = css.toLowerCase().lastIndexOf(UMBRELLA);
check(`the built CSS carries the GBVSR primary ${OURS}`, oursAt >= 0);
check('the built CSS carries the GBVSR page bg #0e0f1f', css.toLowerCase().includes('#0e0f1f'));
check(
  'the GBVSR :root is UNLAYERED (depth 1) — an @layer rule would lose the cascade',
  oursAt >= 0 && depthAt(css, oursAt) === 1,
  oursAt >= 0 ? `it sits at brace depth ${depthAt(css, oursAt)}` : 'the primary is absent',
);
check(
  'the umbrella default is layered (it is a fallback, not a competitor)',
  umbrellaAt < 0 || depthAt(css, umbrellaAt) > 1,
  `the umbrella primary sits at depth ${umbrellaAt < 0 ? 'n/a' : depthAt(css, umbrellaAt)}`,
);

// ── the 40 accents ──────────────────────────────────────────────────────────
// Accents are the ONE place a game's palette reaches components by character
// id. Since engine v0.16.0 they are compiled into the entry stylesheet
// (modules/accents-css.ts) instead of an inline <style> in every page, so they
// are read from the built CSS the home page links: render-blocking, so present
// at first paint, which is what the inline block was for. The minifier
// lowercases a hex and may shorten one (#ffcc00 → #fc0), so both sides are
// normalised; anything else it rewrites prints both values and fails here.
const characters = JSON.parse(src('data/characters.json')) as {
  id: string;
  accent: string;
  name: string;
}[];
check('roster is non-empty', characters.length > 0, `${characters.length} fighters`);
const home = read('index.html');
const hex = (v: string) => {
  const s = v.trim().toLowerCase();
  return /^#[0-9a-f]{3}$/.test(s) ? `#${[...s.slice(1)].map((c) => c + c).join('')}` : s;
};
const builtAccents = new Map(
  [...css.matchAll(/--accent-([a-z0-9_-]+):([^;}]+)/gi)].map((m) => [m[1], m[2]] as const),
);
const missingAccents = characters.filter(
  (c) => hex(builtAccents.get(c.id) ?? '') !== hex(c.accent),
);
check(
  `all ${characters.length} accents reach the built CSS as --accent-<id>`,
  missingAccents.length === 0,
  missingAccents
    .slice(0, 3)
    .map((c) => `${c.id} ${c.accent} (built: ${builtAccents.get(c.id) ?? 'absent'})`)
    .join(', '),
);

// ── the three ids some layer could mistake for something else ──────────────
// `id` is a fighter AND the most common attribute and JSON key in the stack;
// `2b` is the only id that starts with a digit (a CSS ident may not, unescaped,
// which is why the accent is a custom property and never a class); and
// `avatar-belial` contains `belial`. Each is asserted by NAME at every surface
// the build exposes, because a check that loops over the roster passes as long
// as the loop's own reading of the id is the same mistake.
console.log('\n▶ `id`, `2b`, `avatar-belial` — by name, at every surface\n');
for (const id of ['id', '2b', 'avatar-belial']) {
  const row = characters.find((c) => c.id === id);
  check(`data/characters.json carries \`${id}\``, !!row);
  if (!row) continue;
  check(
    `--accent-${id} is defined in the built CSS with its own colour`,
    hex(builtAccents.get(id) ?? '') === hex(row.accent),
    `built ${builtAccents.get(id) ?? 'absent'}, roster ${row.accent}`,
  );
  const page = `characters/${id}/index.html`;
  if (!has(page)) {
    check(`/gbvsr/characters/${id}/ prerendered`, false, 'missing from the build');
    continue;
  }
  const html = read(page);
  check(`/gbvsr/characters/${id}/ prerendered`, true);
  check(
    `/characters/${id} styles itself with var(--accent-${id})`,
    html.includes(`var(--accent-${id}`),
  );
  check(
    `/characters/${id} is titled with the fighter's name, "${row.name}"`,
    new RegExp(
      `<title>[^<]*\\b${row.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b[^<]*</title>`,
    ).test(html),
  );
}
// avatar-belial's page is not Belial's page, and vice versa: each route must
// carry its OWN accent reference and not the other's.
if (has('characters/belial/index.html') && has('characters/avatar-belial/index.html')) {
  check(
    '/characters/belial never styles itself as avatar-belial',
    !read('characters/belial/index.html').includes('var(--accent-avatar-belial'),
  );
}

// ── the sourceChannels NAME SYNC ────────────────────────────────────────────
//
// scripts/channels.ts (pipeline track) and app/app.config.ts (Nuxt track) each
// hold the same nine {id, name} pairs by hand. tsconfig.pipeline.json includes
// only scripts/ and types/; the Nuxt graph includes only app/ — so no compiler
// on this platform can see both, no test in the pipeline can reach the config,
// and the two lists drifted during this build with everything green.
//
// The BUILT app is where they meet: app.config.ts is bundled into the client
// chunk, and the channel list is what SourceBadge names on every card. So the
// assertion is: what the bundle SHIPS must equal what the pipeline DECLARES.
console.log('\n▶ sourceChannels name sync (two hand-kept lists, separate TS tracks)\n');

const declared = [
  ...src('scripts/channels.ts').matchAll(
    /\bid:\s*'([A-Za-z0-9]+)',\s*\n\s*source:\s*'[A-Za-z0-9]+',\s*\n\s*name:\s*'([^']+)'/g,
  ),
].map((m) => ({ id: m[1], name: m[2] }));
const jsChunks = readdirSync(join(OUT, '_nuxt')).filter((f) => f.endsWith('.js'));
// Find the chunk carrying the DECLARED ARRAY, not merely the word. Several
// chunks mention `sourceChannels` — FilterBar and FilterDrawer read it, and so
// does SourceBadge — and the engine's own empty default (`sourceChannels:[]`)
// sits in the same chunk as the game's. Matching on the word alone picked
// whichever chunk readdir happened to return first and then reported "built 0"
// against a pipeline that declares nine: a gate failing for a reason that has
// nothing to do with what it gates.
const CONFIG_ARRAY = /sourceChannels:\s*\[\s*\{/;
const bundleWith = jsChunks.find((f) => CONFIG_ARRAY.test(read(join('_nuxt', f))));
if (!bundleWith) {
  check('the built bundle carries sourceChannels', false, 'no chunk mentions it');
} else if (declared.length === 0) {
  check('scripts/channels.ts yields its {id, name} pairs', false, 'the reader matched nothing');
} else {
  const chunk = read(join('_nuxt', bundleWith));
  // …and the same narrowing here: `[(.*?)]` would otherwise stop at the
  // engine default's empty pair if that one came first in the chunk.
  const list = /sourceChannels:\s*\[(\s*\{.*?)\]/s.exec(chunk)?.[1] ?? '';
  const shipped = [
    ...list.matchAll(/\{\s*id:\s*["'`]([^"'`]+)["'`]\s*,\s*name:\s*["'`]([^"'`]+)["'`]\s*\}/g),
  ].map((m) => ({ id: m[1], name: m[2] }));
  check(
    'the built app ships one sourceChannel per pipeline channel',
    shipped.length === declared.length,
    `built ${shipped.length}, pipeline declares ${declared.length}`,
  );
  const drifted = declared.filter((d) => !shipped.some((s) => s.id === d.id && s.name === d.name));
  check(
    `all ${declared.length} channel ids AND display names agree between the two lists`,
    drifted.length === 0,
    drifted
      .map(
        (d) =>
          `${d.id}: pipeline "${d.name}", built "${shipped.find((s) => s.id === d.id)?.name ?? '(absent)'}"`,
      )
      .join(' · '),
  );
}

// ── character art framing ───────────────────────────────────────────────────
//
// Both surfaces that show a fighter crop the image with `object-cover`, and
// neither failure is visible to any other gate: the files exist, the build
// succeeds, the pages render.
//
//  · THE GRID has no framing knob. The engine draws imgPortrait at
//    `aspect-[3/4] w-full object-cover` with no object-position, so the browser
//    centre-crops and the art has to arrive already shaped.
//  · THE HERO is a hard-coded 1440×340 object-cover letterbox. Three things
//    have to hold and each fails silently: the RATIO (a splash off 4.2353:1 is
//    cropped again and loses feet or head with no error anywhere); the ALPHA (a
//    flattened banner paints an opaque box over the engine's diagonal stripe
//    backplate); and the FIT AT THE NARROWEST BREAKPOINT — desktop shows the
//    whole canvas, so desktop can never catch it: at 360×280 the hero shows
//    only 874 of the 2880 columns, and a pose wider than that is clipped on
//    phones only.
//
// All of these assert the SHIPPED ARTEFACTS rather than the source that made
// them, and all are corpus-independent on purpose: art is Stage 1, so they must
// hold in empty-corpus mode, where every record-shaped check below skips.
console.log('\n▶ character art framing\n');
const HERO_RATIO = 1440 / 340;
const NARROW = { w: 360, h: 280 };
// The hero's object-position, READ from app.config.ts with the engine's own
// default (app/pages/characters/[id].vue: `game.heroFocus ?? '70% 25%'`) —
// Strive hard-coded its '100%' into the narrow-window arithmetic, which is
// right only for as long as nobody re-frames the art.
const HERO_FOCUS = /heroFocus:\s*'([^']+)'/.exec(src('app/app.config.ts'))?.[1] ?? '70% 25%';
const focusX = Number(/^(\d+(?:\.\d+)?)%/.exec(HERO_FOCUS)?.[1] ?? NaN) / 100;
check(
  `heroFocus reads as a percentage pair ("${HERO_FOCUS}")`,
  Number.isFinite(focusX),
  'the window arithmetic below needs an x percentage',
);

const webpsIn = (dir: string): string[] =>
  existsSync(join(OUT, dir)) ? readdirSync(join(OUT, dir)).filter((f) => f.endsWith('.webp')) : [];

const portraits = webpsIn('img/char');
check(
  'portraits shipped for the whole roster',
  portraits.length === characters.length,
  `${portraits.length} files for ${characters.length} fighters`,
);
const offRatio: string[] = [];
for (const f of portraits) {
  const m = await sharp(join(OUT, 'img', 'char', f)).metadata();
  // One pixel of tolerance: 512/0.75 is 682.67, so the integer height is 683
  // and the exact shipped ratio is 0.7496.
  if (Math.abs(m.width / m.height - 0.75) > 0.75 / m.height) {
    offRatio.push(`${f} ${m.width}×${m.height}`);
  }
}
check(
  'every portrait is a 3:4 crop (the grid centre-crops anything else)',
  offRatio.length === 0,
  offRatio.slice(0, 3).join(', '),
);

const splashes = webpsIn('img/splash');
check(
  'splashes shipped for the whole roster',
  splashes.length === characters.length,
  `${splashes.length} files for ${characters.length} fighters`,
);
const offHero: string[] = [];
const opaque: string[] = [];
const clipped: string[] = [];
for (const f of splashes) {
  const img = sharp(join(OUT, 'img', 'splash', f));
  const m = await img.metadata();
  if (Math.abs(m.width / m.height - HERO_RATIO) > HERO_RATIO / m.height) {
    offHero.push(`${f} ${m.width}×${m.height}`);
  }
  if (!m.hasAlpha) opaque.push(f);

  // The visible extent, at alpha > 8 so the soft drop shadow counts too — the
  // pipeline places the body by its NEAR-opaque box (alpha > 200) and this
  // deliberately checks the wider thing the viewer actually sees.
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let x0 = info.width;
  let x1 = -1;
  for (let y = 0; y < info.height; y++) {
    const row = y * info.width;
    for (let x = 0; x < info.width; x++) {
      if (data[(row + x) * info.channels + 3] > 8) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
      }
    }
  }
  // object-cover scales to cover, then heroFocus's x places the window: 100%
  // flush right, 0% flush left, anything between proportionally.
  const scale = Math.max(NARROW.w / m.width, NARROW.h / m.height);
  const visible = NARROW.w / scale;
  const windowLeft = Math.round((m.width - visible) * focusX);
  const windowRight = Math.round(windowLeft + visible);
  if (x0 < windowLeft || x1 > windowRight) {
    clipped.push(`${f} [${x0},${x1}] vs window [${windowLeft},${windowRight}]`);
  }
}
check(
  'every splash is the hero box ratio 4.2353:1 (or object-cover re-crops it)',
  offHero.length === 0,
  offHero.slice(0, 3).join(', '),
);
check(
  'every splash keeps its alpha (the engine backplate shows through)',
  opaque.length === 0,
  opaque.slice(0, 3).join(', '),
);
check(
  `every body fits the narrowest hero window (${NARROW.w}×${NARROW.h})`,
  clipped.length === 0,
  `${clipped.slice(0, 3).join(', ')} — clipped on phones, invisible on desktop`,
);

// heroFocus is asserted on the RENDERED page, not on app.config.ts: the config
// can be right while the value never reaches the style attribute.
const heroPage = characters.map((c) => `characters/${c.id}/index.html`).find((p) => has(p));
if (heroPage) {
  check(
    `the hero carries heroFocus "${HERO_FOCUS}" on the rendered page`,
    new RegExp(`object-position:\\s*${HERO_FOCUS.replace(/\s+/g, '\\s*')}`).test(read(heroPage)),
    'heroFocus did not reach the rendered hero',
  );
} else {
  check('a character page prerendered to carry heroFocus', false, 'no character page in the build');
}

// ── the footer art credit — a LICENCE OBLIGATION ────────────────────────────
//
// Cygames' Fan Kit terms forbid "deleting or modifying trademarks and
// copyright notices on Copyrighted Materials" (Article 2). The kit's renders
// carry no baked notice, and the art is cropped here, so the notice travels
// beside it instead: GameConfig.artCredit, which engine v0.12.1 renders in the
// footer AT EVERY WIDTH (the platform © beside it hides below `sm`; the credit
// does not), and baked into the OG card. 2B is Square Enix's.
//
// SO THE CHECK IS ON THE CLASS ATTRIBUTE, NOT ON THE STRING. A credit that is
// present but wearing `hidden sm:inline` satisfies a grep and fails the terms.
console.log('\n▶ Fan Kit Article 2 — the art credit at every width\n');
const CREDIT = /artCredit:\s*'([^']+)'/.exec(src('app/app.config.ts'))?.[1] ?? '';
check('app.config.ts declares an artCredit', CREDIT.length > 0);
const creditPages = ['index.html', 'characters/index.html', 'stats/index.html', heroPage]
  .filter((p): p is string => !!p && has(p))
  .concat(
    (() => {
      const dir = join(OUT, 'players');
      if (!existsSync(dir)) return [];
      const first = readdirSync(dir).find((d) => existsSync(join(dir, d, 'index.html')));
      return first ? [`players/${first}/index.html`] : [];
    })(),
  );
const creditMissing: string[] = [];
const creditHidden: string[] = [];
for (const p of creditPages) {
  const html = read(p);
  const m = new RegExp(
    `<p class="([^"]*)"><span>${CREDIT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}</span>`,
  ).exec(html);
  if (!m) creditMissing.push(p);
  else if (/\bhidden\b|\bsm:|\bmd:|\blg:/.test(m[1])) creditHidden.push(`${p} (${m[1]})`);
}
check(
  `the art credit renders on all ${creditPages.length} sampled page(s)`,
  creditMissing.length === 0,
  creditMissing.join(', '),
);
check(
  'the art credit is NOT width-gated (a notice that vanishes on phones is not "easily visible")',
  creditHidden.length === 0,
  creditHidden.join(', '),
);

// ── the art's provenance, by the SHIPPED BYTES ──────────────────────────────
//
// Two methods are legal: `fan-kit` (Cygames' kit, crop + resize only) and
// `generated` (accent tiles, the one-command fallback for a revoked licence —
// Article 3 lets Cygames withdraw permission, and Article 1 leaves no other
// source). A MIX is not legal: after a revocation a single kit derivative left
// on disk is still kit art on the page. Every shipped portrait and splash is
// therefore hashed and matched to its provenance row — the only check that can
// see a stray file whose NAME is right.
console.log('\n▶ art provenance — one method, every shipped byte accounted for\n');
interface ArtFile {
  id: string;
  sourceUrl?: string;
  portrait?: { path: string; sha256: string };
  splash?: { path: string; sha256: string };
}
const provenance = JSON.parse(src('data/art-provenance.json')) as {
  method?: string;
  credit?: string;
  licenceVerified?: string;
  files?: ArtFile[];
};
const METHODS = ['fan-kit', 'generated'];
check(
  `art-provenance.json names one method (${METHODS.join(' | ')})`,
  METHODS.includes(provenance.method ?? ''),
  `method is ${JSON.stringify(provenance.method)}`,
);
const artFiles = provenance.files ?? [];
const artIds = artFiles.map((f) => f.id).sort();
check(
  'provenance covers the roster exactly — one row per fighter, no extras',
  artIds.join(',') ===
    characters
      .map((c) => c.id)
      .sort()
      .join(','),
  `${artIds.length} rows for ${characters.length} fighters`,
);
check(
  "the provenance credit is the footer's artCredit, verbatim",
  provenance.credit === CREDIT,
  `provenance ${JSON.stringify(provenance.credit)} · app.config ${JSON.stringify(CREDIT)}`,
);
if (provenance.method === 'fan-kit') {
  const unsourced = artFiles.filter(
    (f) => !/^https:\/\/files\.microcms-assets\.io\//.test(f.sourceUrl ?? ''),
  );
  check(
    'every kit row names the kit file it was cut from (a URL the CMS served)',
    unsourced.length === 0,
    unsourced.map((f) => f.id).join(', '),
  );
  check(
    'the licence re-read is dated (the art-licence expiry counts from it)',
    /^\d{4}-\d{2}-\d{2}$/.test(provenance.licenceVerified ?? ''),
  );
} else if (provenance.method === 'generated') {
  const sourced = artFiles.filter((f) => f.sourceUrl);
  check(
    'no generated row names a kit source (a revocation removes the kit, all of it)',
    sourced.length === 0,
    sourced.map((f) => f.id).join(', '),
  );
}
const sha = (p: string): string =>
  createHash('sha256')
    .update(readFileSync(join(OUT, p)))
    .digest('hex');
const expected = new Map<string, string>();
for (const f of artFiles) {
  for (const part of [f.portrait, f.splash]) {
    if (part) expected.set(part.path.replace(/^\//, ''), part.sha256);
  }
}
const shipped = [
  ...portraits.map((f) => `img/char/${f}`),
  ...splashes.map((f) => `img/splash/${f}`),
];
const unaccounted = shipped.filter((p) => expected.get(p) !== sha(p));
check(
  `every shipped art file (${shipped.length}) hashes to its ${provenance.method ?? '?'} provenance row`,
  unaccounted.length === 0 && shipped.length === expected.size,
  unaccounted.length
    ? `${unaccounted.length} differ or are unlisted, e.g. ${unaccounted.slice(0, 3).join(', ')}`
    : `${shipped.length} shipped vs ${expected.size} listed`,
);

// ── the public data contract ────────────────────────────────────────────────

console.log('\n▶ data contract\n');
const replays = JSON.parse(read('data/replays.json')) as {
  id: string;
  sides: { player: string; characters: string[] }[];
  date: string;
  patch?: string;
  source: string;
  title: string;
  videoId?: string;
  startSeconds?: number;
  /** What the badge prints instead of the source name (engine v0.13.0). */
  event?: string;
  channelName?: string;
  /** Per side, the fighters the source MARKED as EX (positive evidence only). */
  ex?: [string[], string[]];
}[];
const EMPTY = replays.length === 0;

if (EMPTY) {
  skip('every record-shaped assertion', 'empty corpus — 0 replays in the build');
} else {
  const raw = read('data/replays.json');
  check(
    'no pipeline provenance in the public payload',
    !/"(provenance|fromTitle|fromIndex|slotOrder|intake|handle|tieBroken|unplayable|skins)"/.test(
      raw,
    ),
  );
  check(
    'every side has at least one character',
    replays.every((r) => r.sides.every((s) => s.characters.length >= 1)),
  );
  const charIds = new Set(characters.map((c) => c.id));
  const unknown = [...new Set(replays.flatMap((r) => r.sides.flatMap((s) => s.characters)))].filter(
    (c) => !charIds.has(c),
  );
  check(
    'every character id resolves against the roster',
    unknown.length === 0,
    unknown.slice(0, 3).join(', '),
  );
  check(
    'every record carries a patch token',
    replays.every((r) => !!r.patch),
  );
  check('record ids are unique', new Set(replays.map((r) => r.id)).size === replays.length);

  // THE INDEX INTAKE'S TWO RECORD SHAPES. A SEGMENT carries videoId AND
  // startSeconds; a whole-video record carries neither and its id IS the
  // YouTube id. The trap is `...(v.startSeconds ? {…} : {})` written for
  // startSeconds alone, which strips videoId from every offset-zero record and
  // leaves the embed building a URL against the composite id.
  const segments = replays.filter((r) => r.startSeconds !== undefined);
  check(
    'segment records carry BOTH videoId and startSeconds',
    segments.every((r) => typeof r.videoId === 'string' && r.videoId.length === 11),
    'a startSeconds with no videoId would build a URL against the record id',
  );
  const composite = replays.filter((r) => r.id.includes('@'));
  check(
    'every composite id is a segment and vice versa',
    composite.length === segments.length && composite.every((r) => r.startSeconds !== undefined),
    `${composite.length} composite ids vs ${segments.length} segments`,
  );
  check(
    'a whole-video record carries neither field (its id IS the YouTube id)',
    replays
      .filter((r) => !r.id.includes('@'))
      .every((r) => r.startSeconds === undefined && r.videoId === undefined),
  );

  // sourceGroups membership: every emitted source must belong to a group, or
  // its records are unreachable from the filter bar. Read out of app.config.ts
  // rather than restated, for the same reason as the channel list above.
  const groupsBlock =
    /sourceGroups:\s*\[([\s\S]*?)\n {4}\],/.exec(src('app/app.config.ts'))?.[1] ?? '';
  const grouped = new Set([...groupsBlock.matchAll(/'([A-Za-z]+)'/g)].map((m) => m[1]));
  const ungrouped = [...new Set(replays.map((r) => r.source))].filter((s) => !grouped.has(s));
  check(
    'every emitted source belongs to a sourceGroup',
    ungrouped.length === 0,
    `${ungrouped.join(', ')} — those records cannot be reached from the filter bar`,
  );

  // ── the badge names the EVENT, not the catalogue (engine v0.13.0) ─────────
  // Structural, not counted: Strive pins its arm sizes (6,915 / 1,330) because
  // its corpus is settled; this one's are measured by the first full sweep and
  // stated in data/report.md. What must hold regardless: one label per index
  // record, none on a channel record, none blank — and NO SET FORMAT AS AN
  // EVENT. The catalogue's commonest GBVSR tag is "FT5" (732 rows at recon):
  // a first-to-five set, not a tournament, and a badge reading "FT5" names
  // nothing (checklist 12k). fetch-theater.ts blanks it and keeps rawTag.
  const theater = replays.filter((r) => r.source === 'replayTheater');
  const byEvent = theater.filter((r) => r.event);
  const byChannel = theater.filter((r) => r.channelName);
  check(
    'every index-sourced record carries exactly one label',
    byEvent.length + byChannel.length === theater.length &&
      !theater.some((r) => r.event && r.channelName),
    `${byEvent.length} event + ${byChannel.length} uploader = ${theater.length}, none with both`,
  );
  check(
    'no channel-sourced record carries a label',
    replays.every((r) => r.source === 'replayTheater' || (!r.event && !r.channelName)),
    'labels are emitted only by the index intake',
  );
  check(
    'no emitted label is empty or blank',
    replays.every((r) => (r.event ?? 'x').trim() !== '' && (r.channelName ?? 'x').trim() !== ''),
    'an empty label would render a bordered chip with no text',
  );
  const SET_FORMAT = /^(?:FT|BO|first\s*to|best\s*of)\s*\d+$/i;
  const formats = byEvent.filter((r) => SET_FORMAT.test(r.event!.normalize('NFKC').trim()));
  check(
    'no set format (FT5, BO3, …) is published as an event',
    formats.length === 0,
    formats.length ? `${formats.length}, e.g. "${formats[0]!.event}" on ${formats[0]!.id}` : '',
  );
  const disagree = byEvent.filter((r) => !r.title.endsWith(`▰ ${r.event}`));
  check(
    "every event matches its title's trailing slot",
    disagree.length === 0,
    disagree.length ? `${disagree.length}, e.g. ${disagree[0]!.id}` : `${byEvent.length} checked`,
  );
  const configured = new Set(declared.map((c) => c.name));
  const collide = [...new Set(byChannel.map((r) => r.channelName!))].filter((n) =>
    configured.has(n),
  );
  check(
    'no uploader label collides with a configured source name',
    collide.length === 0,
    collide.join(', '),
  );
  const longest = [...byEvent, ...byChannel].reduce(
    (n, r) => Math.max(n, (r.event ?? r.channelName ?? '').length),
    0,
  );
  check('longest label is within the card budget', longest <= 60, `${longest} chars (cap 60)`);

  // ── the sequel's floor, and each fighter's ──────────────────────────────
  // The previous game lives on the same channels and under the same catalogue
  // label; the marker keeps its titles out and the date keeps its footage out.
  // Nothing may predate Rising's early access, and no side may carry a fighter
  // before that fighter was playable (Id: 2026-09-15). Both are enforced in
  // parse; asserted here on what shipped.
  const RISING = '2023-12-11';
  const early = replays.filter((r) => r.date.slice(0, 10) < RISING);
  check(
    `nothing predates Rising's early access (${RISING})`,
    early.length === 0,
    early.length ? `${early.length}, e.g. ${early[0]!.id} ${early[0]!.date}` : '',
  );
  const releasedOn = new Map(
    characters.map((c) => [c.id, (c as { extra?: { released?: string } }).extra?.released ?? '']),
  );
  const prerelease = replays.filter((r) =>
    r.sides.some((s) => s.characters.some((c) => r.date.slice(0, 10) < (releasedOn.get(c) ?? ''))),
  );
  check(
    'no side carries a fighter before its release (the generalised Id check)',
    prerelease.length === 0,
    prerelease.length ? `${prerelease.length}, e.g. ${prerelease[0]!.id}` : '',
  );

  // ── EX: a mark, positive evidence only ──────────────────────────────────
  // Present only when a source SAID EX; absent otherwise, never false and never
  // an empty pair (a channel that never marks EX must not read as "base"). Only
  // on the three fighters Ver 2.20 gave the mode, only from its release, and
  // only on a fighter the side actually played.
  const exSince = new Map(
    characters
      .map((c) => [c.id, (c as { extra?: { exSince?: string } }).extra?.exSince] as const)
      .filter((e): e is readonly [string, string] => typeof e[1] === 'string'),
  );
  check(
    'EX is declared on exactly gran, djeeta, narmaya',
    [...exSince.keys()].sort().join(',') === 'djeeta,gran,narmaya',
    [...exSince.keys()].join(', '),
  );
  const marked = replays.filter((r) => r.ex !== undefined);
  check('no record carries `"ex": false`', !/"ex":\s*false/.test(raw));
  const badEx = marked.filter(
    (r) =>
      !Array.isArray(r.ex) ||
      r.ex.length !== 2 ||
      r.ex[0].length + r.ex[1].length === 0 ||
      r.ex.some((ids, i) =>
        ids.some(
          (c) =>
            !exSince.has(c) ||
            r.date.slice(0, 10) < exSince.get(c)! ||
            !r.sides[i]!.characters.includes(c),
        ),
      ),
  );
  check(
    `every EX mark is non-empty, on an EX fighter the side played, from Ver 2.20 (${marked.length} marked)`,
    badEx.length === 0,
    badEx.length ? `${badEx.length}, e.g. ${badEx[0]!.id} ${JSON.stringify(badEx[0]!.ex)}` : '',
  );

  // ── avatar-belial never splits into belial ──────────────────────────────
  // Longest-first matching is what keeps "Avatar Belial" whole; this is its
  // shipped consequence. A title naming Avatar Belial and no OTHER Belial must
  // not carry `belial` on any side.
  const AVATAR = /avatar[\s._・-]*belial|アバタール[・･\s]*ベリアル/giu;
  const split = replays.filter(
    (r) =>
      AVATAR.test(r.title) &&
      !/belial|ベリアル/iu.test(r.title.replace(AVATAR, '')) &&
      r.sides.some((s) => s.characters.includes('belial')),
  );
  check(
    'no "Avatar Belial" title yields `belial`',
    split.length === 0,
    split.length ? `${split.length}, e.g. ${split[0]!.id} "${split[0]!.title}"` : '',
  );

  // ── ?c=id through the ENGINE'S OWN filter ───────────────────────────────
  // The character filter's URL key is `c` (engine useFilters.ts: `characters:
  // csv(route.query.c)`), and the filter itself is the pure core in
  // app/utils/filterReplays.ts. Running THAT core over the shipped archive,
  // rather than restating it, is the control: `?c=id` must return exactly the
  // records with Id on a side — not every record (an "id" read as a field
  // name), and not none.
  const engineRoots = [
    process.env.ENGINE_PATH ? resolve(ROOT, process.env.ENGINE_PATH) : '',
    ...(existsSync(join(ROOT, 'node_modules', '.c12'))
      ? readdirSync(join(ROOT, 'node_modules', '.c12'))
          .filter((d) => /replay.?engine/i.test(d))
          .map((d) => join(ROOT, 'node_modules', '.c12', d))
      : []),
  ].filter((r) => r && existsSync(join(r, 'app/utils/filterReplays.ts')));
  const engineRoot = engineRoots[0];
  if (!engineRoot) {
    check(
      "the engine's filter core is reachable",
      false,
      'neither ENGINE_PATH nor node_modules/.c12 holds app/utils/filterReplays.ts',
    );
  } else {
    check(
      "the engine's character filter is keyed `c`",
      /characters:\s*csv\(route\.query\.c\)/.test(
        readFileSync(join(engineRoot, 'app/composables/useFilters.ts'), 'utf8'),
      ),
    );
    const core = (await import(
      pathToFileURL(join(engineRoot, 'app/utils/filterReplays.ts')).href
    )) as {
      emptyFilterState: () => Record<string, unknown>;
      filterReplays: (replays: unknown[], state: Record<string, unknown>) => { id: string }[];
    };
    for (const id of ['id', '2b', 'avatar-belial', 'belial']) {
      const got = core
        .filterReplays(replays, { ...core.emptyFilterState(), characters: [id] })
        .map((r) => r.id)
        .sort();
      const want = replays
        .filter((r) => r.sides.some((s) => s.characters.includes(id)))
        .map((r) => r.id)
        .sort();
      check(
        `?c=${id} returns exactly the ${want.length} record(s) with ${id} on a side`,
        got.join(',') === want.join(','),
        `the engine returned ${got.length}`,
      );
    }
  }

  check(
    'summary.json replay count matches the emitted archive',
    summary.replays === replays.length,
    `summary says ${summary.replays}, archive holds ${replays.length}`,
  );
  const newestDay = replays.reduce((n, r) => (r.date > n ? r.date : n), '').slice(0, 10);
  check(
    'summary.json `updated` is the newest replay date, not the build date',
    summary.updated === newestDay,
    `summary says ${summary.updated}, newest replay is ${newestDay}`,
  );

  // A prerendered entity page must contain REAL content, not an empty shell —
  // that is the whole reason the registries are provided rather than fetched.
  const sample = characters[0];
  if (has(`characters/${sample.id}/index.html`)) {
    const html = read(`characters/${sample.id}/index.html`);
    check(
      `/characters/${sample.id} prerenders with a data-derived <title>`,
      /<title>[^<]*\w[^<]*<\/title>/.test(html),
    );
    // Its accent by reference: the page styles itself with var(--accent-<id>),
    // and the accents block above proves the built CSS defines that variable
    // with the right colour. (Until engine v0.16.0 this looked for the hex in
    // the page, which only ever matched the inline accents block every page
    // carried; the character's own markup has never spelled the hex out.)
    check(
      `/characters/${sample.id} carries its accent`,
      html.includes(`var(--accent-${sample.id}`),
    );
  } else {
    check(`/characters/${sample.id} prerendered`, false, 'missing from the build');
  }

  const players = JSON.parse(src('data/players.json')) as { id: string }[];
  const p = players[0]?.id;
  check(
    'player pages prerendered (they must not 404 on static hosting)',
    !!p && has(`players/${p}/index.html`),
  );

  // The registry invariant on what shipped (checklist 5n): a player id equal
  // to a fighter id is a handle the parser read as a player where it could
  // have been a character — allowed only with evidence, row by row, in
  // scripts/roster.ts. A player named `id` would share a slug with the
  // fighter; none is confirmed, so none may ship.
  const confirmed = new Set(CONFIRMED_FIGHTER_NAMED_PLAYERS.map((c) => c.id));
  const charIdSet = new Set(characters.map((c) => c.id));
  const shadow = players.filter((pl) => charIdSet.has(pl.id) && !confirmed.has(pl.id));
  check(
    'no player id shadows a fighter id without a CONFIRMED row',
    shadow.length === 0,
    shadow.map((pl) => pl.id).join(', '),
  );
}

// ── ComboForge cross-link (engine v0.11.0/v0.12.0) ──────────────────────────
console.log('\n▶ partner cross-link\n');
if (!EMPTY && characters.length) {
  const sample = characters.find((c) => c.id === 'gran') ?? characters[0];
  if (has(`characters/${sample.id}/index.html`)) {
    const html = read(`characters/${sample.id}/index.html`);
    check('character page links to ComboForge', html.includes('comboforge.gg'));
    check(
      'the deep link carries our gameId rather than a bare guess',
      /comboforge\.gg[^"']*gameId=gbvsr(?![A-Za-z0-9-])/.test(html),
    );
  }
  // `id` is mapped to null in app.config.ts (not on ComboForge yet): its page
  // must fall back to the game hub, never a guessed `gbvsr-id` character page.
  if (has('characters/id/index.html')) {
    check(
      '/characters/id falls back to the ComboForge hub, not a guessed character',
      !/characterId=gbvsr-id\b/.test(read('characters/id/index.html')),
    );
  }
  if (has('characters/meg/index.html')) {
    check(
      '/characters/meg deep-links the measured override meg-margaret-bluemarine',
      read('characters/meg/index.html').includes('characterId=gbvsr-meg-margaret-bluemarine'),
    );
  }
  check(
    'the Combos nav item is a real <a href> (crawlable, copyable)',
    /href="[^"]*comboforge\.gg[^"]*"/.test(home),
  );
} else {
  skip('ComboForge band assertions', 'empty corpus');
}

// ── the CRON GUARD — the workflow's commit step, parsed and run ─────────────
//
// Tekken's guard, and two things it could not see here:
//
//  · THE `git add` IS FIVE LINES. Tekken's parser matched `git add <files>` on
//    one line; against `git add \` it matches nothing, so ported as-is it
//    cannot check a single file. The continuations are joined first.
//  · THE BODY ENDS WHERE ITS INDENTATION DOES. Taking every 10-space line after
//    `git config` (Tekken's cut) would sweep up the next step's `env:` values —
//    `SMOKE_HOST: https://…` sits at the same depth — and run them as commands.
//
// Three things are then checked, and they fail differently:
//
//  (1) THE STAGED LIST, BY NAME, AGAINST WHAT THE PIPELINE WRITES. The write
//      set is READ from the scripts (parse-finish's `write('…')`, emit's
//      `writeFile(join(DATA, '…'))`, redirects.ts's vercel.json), so adding an
//      output and forgetting the workflow fails HERE — the cron would otherwise
//      regenerate it and throw it away every morning with no red anywhere.
//  (2) THE ORDER: Emit → Regenerate player redirects → Refuse redirect drift →
//      Commit if changed. Regenerated after the commit, vercel.json lags the
//      ledger by a day; drift-checked after it, a bad row has already shipped.
//  (3) THE SUPPRESSIONS, run for real in a scratch repo: a timestamp-only
//      report.md and a cursor-only advance must make no commit (and restore the
//      worktree), a real change must commit and carry report.md.
console.log('\n▶ cron guard — the commit step, parsed and run\n');
const wfText = src('.github/workflows/data-refresh.yml');
const wf = wfText.split('\n');
check("the cron is the eighth slot, '47 9 * * *'", /cron:\s*'47 9 \* \* \*'/.test(wfText));
const stepAt = (name: string): number => wf.findIndex((l) => l.trim() === `- name: ${name}`);
const order = ['Emit', 'Regenerate player redirects', 'Refuse redirect drift', 'Commit if changed'];
const at = order.map(stepAt);
check(
  `steps run in order: ${order.join(' → ')}`,
  at.every((i) => i >= 0) && at.every((i, k) => k === 0 || i > at[k - 1]!),
  order.map((n, k) => `${n}@${at[k]}`).join(', '),
);
check(
  'the drift step runs `redirects.ts --drift`',
  /run:\s*npx tsx scripts\/redirects\.ts --drift/.test(wf.slice(at[2]!, at[3]!).join('\n')),
);
const runAt = wf.findIndex((l, i) => i > at[3]! && /^ {8}run: \|$/.test(l));
const body: string[] = [];
for (let i = runAt + 1; i < wf.length; i++) {
  const l = wf[i]!;
  if (l.trim() !== '' && !l.startsWith('          ')) break;
  body.push(l.slice(10));
}
const guard = body.filter((l) => l.trim() !== 'git push').join('\n'); // no remote in scratch
const joined = guard.replace(/\\\n\s*/g, ' ');
check(
  'no blanket add (checklist 9b): never `git add data/`, `-A` or `.`',
  !/git add\s+(?:-A|--all|\.|data\/?)(?:\s|$)/m.test(joined),
);
const staged = (/^git add ([^\n]+)$/m.exec(joined)?.[1] ?? '').trim().split(/\s+/).filter(Boolean);
check(
  `the multi-line git add parses whole (${staged.length} paths)`,
  staged.length > 5 && staged.includes('vercel.json'),
  staged.join(' '),
);
const writes = new Set<string>([
  ...[...src('scripts/parse-finish.ts').matchAll(/await write\(\s*'([^']+)'/g)].map((m) => m[1]!),
  ...[...src('scripts/emit.ts').matchAll(/writeFile\(\s*join\(DATA, '([^']+)'\)/g)].map(
    (m) => m[1]!,
  ),
  'report.md', // parse-finish writes it by path, not through write()
  'player-redirects.json', // redirects.ts seeds it when absent
]);
const writesVercel = /writeFileSync\(cfgPath/.test(src('scripts/redirects.ts'));
check(
  `the write set reads from the scripts (${writes.size} data files${writesVercel ? ' + vercel.json' : ''})`,
  writes.size >= 12 && writesVercel,
  [...writes].join(', '),
);
const unstaged = [...writes].filter((f) => !staged.includes(`data/${f}`));
if (writesVercel && !staged.includes('vercel.json')) unstaged.push('vercel.json');
check(
  'every file the cron writes is staged by name',
  unstaged.length === 0,
  `${unstaged.join(', ')} — regenerated and thrown away every morning`,
);
check(
  'data/overrides.json is NOT staged (the one file a human owns)',
  !staged.includes('data/overrides.json'),
);
check(
  'a timestamp-only report.md is dropped',
  guard.includes('git restore --staged --worktree data/report.md'),
);

if (staged.length > 5) {
  const dir = mkdtempSync(join(tmpdir(), 'gbvsr-cron-guard-'));
  const sh = (cmd: string): string => execSync(cmd, { cwd: dir, stdio: 'pipe' }).toString();
  try {
    sh('git init -q . && git config user.email t@t && git config user.name t');
    mkdirSync(join(dir, 'data'));
    // Driven by the parsed list, so the fixture cannot fall behind the
    // workflow. replays.json carries the count the commit message reads.
    const seed = (n: number, ts: string): void => {
      for (const f of staged) {
        if (f.endsWith('replays.json') || f.endsWith('videos.json')) {
          writeFileSync(join(dir, f), JSON.stringify(Array.from({ length: n }, (_, i) => ({ i }))));
        } else if (f.endsWith('report.md')) {
          writeFileSync(join(dir, f), `# R\n\n_Generated ${ts}._\n\ntotal: ${n}\n`);
        } else {
          writeFileSync(join(dir, f), '{}\n');
        }
      }
    };
    seed(1, '2026-10-01T09:47:00.000Z');
    sh('git add -A && git commit -qm seed');
    // Via a FILE: `bash -c` would put it through /bin/sh first and mangle the
    // $(…) substitutions and the continuations.
    writeFileSync(join(dir, 'guard.sh'), `set -e\n${guard}\n`);
    const commits = (): string => sh('git rev-list --count HEAD').trim();

    seed(1, '2026-10-01T10:47:00.000Z'); // the timestamp moved, nothing else
    const a = sh('bash guard.sh');
    check(
      'a timestamp-only run skips the commit',
      a.includes('No data changes') && commits() === '1',
    );

    seed(2, '2026-10-01T11:47:00.000Z'); // a real change
    sh('bash guard.sh');
    check('a real data change commits', commits() === '2');
    const shippedFiles = sh('git show --stat --format= HEAD');
    check('a real change ships report.md alongside it', shippedFiles.includes('report.md'));

    // The cursor rises on mornings nothing of ours changed (the catalogue takes
    // entries daily; our tagged flow was 1 row in 2026-09). Staged
    // unconditionally that is a deploy every day forever.
    writeFileSync(join(dir, 'data/theater-cursor.json'), '{"replayTheater":999}\n');
    const c = sh('bash guard.sh');
    check(
      'a cursor-only advance skips the commit',
      c.includes('No data changes') && commits() === '2',
    );
    check(
      'a cursor-only advance is restored in the worktree',
      readFileSync(join(dir, 'data/theater-cursor.json'), 'utf8') === '{}\n',
    );

    // The routing is a data change like any other: a regenerated vercel.json
    // with no other diff must still commit, or a new redirect never ships.
    writeFileSync(join(dir, 'vercel.json'), '{"redirects":[1]}\n');
    sh('bash guard.sh');
    check('a vercel.json-only change commits (the redirect ships)', commits() === '3');
  } catch (err) {
    check('the commit step runs in a scratch repo', false, String(err).slice(0, 300));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log(
  `\n${fail === 0 ? '✓' : '✖'} ${pass} passed · ${fail} failed · ${skipped} skipped` +
    (EMPTY ? '  (EMPTY-CORPUS MODE)' : ''),
);
if (failures.length) {
  console.error('\nFailures:\n');
  for (const f of failures) console.error(`  ${f}`);
}
process.exit(fail === 0 ? 0 : 1);
