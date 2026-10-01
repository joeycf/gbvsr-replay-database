/**
 * Post-deploy smoke check — the collapse guard's downstream twin, and the
 * platform's deploy fingerprint.
 *
 * scripts/parse.ts protects the REPOSITORY: it refuses to write when an intake
 * loses records. This protects what visitors actually get, which is a different
 * thing — the repo can be perfect while production serves a build from before
 * the push, or a build that failed. On 2026-08-08 a collapsed archive was live
 * to visitors for 21 hours on a sibling game, and the only reason anyone found
 * out was a human noticing a wrong number on a page.
 *
 * NOTHING IS EMBEDDED IN THE BUILD FOR THIS TO COMPARE AGAINST ITSELF
 * (checklist 10e). The record digest is computed at check time on BOTH sides —
 * locally from the data/replays.json this checkout just committed, remotely from
 * the bytes production hands back. A build-time stamp would prove only that a
 * build ran, not that the served payload is the committed one, and it is the
 * served payload visitors read.
 *
 * IT POLLS, deliberately. Vercel builds asynchronously off the git push and
 * there is no post-deploy hook to run after, so a single fetch races the build
 * and reports yesterday's payload as a collapse.
 *
 * ── THE TWO THINGS THIS GAME ADDS, AND BOTH READ summary.json ────────────
 *
 * 1. THE BASE-PATH ASSERTION (checklist 10h). `<host>/<slug>/data/summary.json`
 *    must carry `game === 'gbvsr'`. The incident this exists for: a game
 *    shipped its FIRST build mounted at the PREVIOUS game's base path, because
 *    `NUXT_APP_BASE_URL` came along with a copied Vercel env. Everything about
 *    that deployment looks healthy — the build is green, the routes render, the
 *    JSON parses — and `replays.json` cannot see it at all, because the file it
 *    reads is whichever game's archive is sitting at that path. So this is the
 *    ONE condition here that is a hard failure the moment it is readable: it is
 *    never a slow build, and polling longer will never make it true.
 *
 * 2. THE CODE VERSION (checklist 10i). `engine` in the served summary.json must
 *    equal the tag nuxt.config.ts pins. A pin-only change moves no record and no
 *    content hash, so a digest-only check matched a deployment that was still
 *    building and claimed success. This does NOT contradict 10e: nothing is
 *    embedded that the check compares against ITSELF — the tag is read from the
 *    DEPLOYMENT and compared with the tag the REPO pins, which is exactly the
 *    comparison a build-time stamp cannot make.
 *
 * IT COMPARES CONTENT, NOT ONLY THE RECORD COUNT. Counting records catches an
 * archive collapsing and is blind to a record's CHARACTERS changing while the
 * count does not — which is what a review-queue resolution or an override does.
 * THE EX MARKS ARE IN THE DIGEST TOO: they are published as `ex`, they drive
 * the EX facet, and a verdict that adds or removes one moves nothing else — a
 * digest that ignored them would call an EX-only correction "already live".
 *
 * THE FETCH IS CACHE-COLD. `no-store` plus a cache-busting query is not
 * paranoia: a cached probe once produced a confident, wrong, nine-hour-old
 * conclusion about production on this platform.
 *
 * Run: npm run verify:deployed
 *   SMOKE_HOST     default https://replaydatabase.com — the apex the shell owns.
 *                  BEFORE THE SHELL FLIP (the edge rewrite of /gbvsr/* to this
 *                  project does not exist yet) it must point at the game's own
 *                  https://gbvsr-replay-database.vercel.app, or every poll reads
 *                  the shell's 404 and the check times out as "never readable".
 *                  The workflow sets it explicitly for that reason.
 *   SMOKE_TIMEOUT_SEC (900) · SMOKE_INTERVAL_SEC (20)
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

/** This app's URL segment — app/app.config.ts game.slug, nuxt.config.ts baseURL. */
const SLUG = 'gbvsr';
/** The apex the shell owns; it edge-rewrites /<slug>/* to this project. */
const HOST = (process.env.SMOKE_HOST ?? 'https://replaydatabase.com').replace(/\/$/, '');

const TIMEOUT_SEC = Number(process.env.SMOKE_TIMEOUT_SEC ?? 900);
const INTERVAL_SEC = Number(process.env.SMOKE_INTERVAL_SEC ?? 20);

/** The engine tag this checkout pins, READ FROM nuxt.config.ts rather than
 *  retyped — a bumped pin must not leave this asserting yesterday's version. */
const ENGINE_PIN =
  /replay-engine#(v[\d.]+)/.exec(readFileSync(join(ROOT, 'nuxt.config.ts'), 'utf8'))?.[1] ?? '';

// The collapse guard's thresholds, DUPLICATED ON PURPOSE from the parse pipeline
// (scripts/parse-finish.ts step 5) rather than imported: this script must stay
// runnable from a checkout whose parse module is mid-edit, and the two gates must
// agree on the word "collapse" by construction, not by import graph. Change both
// or neither. Strict `>` on both terms, as there: lost > 20 AND lost/committed > 0.1.
//
// AT THIS ARCHIVE'S SIZE THE PERCENTAGE TERM BINDS, which is the opposite of the
// per-intake picture and worth stating because the two are easy to confuse.
// Stage 0 measured 367 records across 32 intake channels (2026-09-18), so 10% of
// the whole archive is ~37 records — above the absolute floor of 20. Per INTAKE
// the arithmetic inverts: the largest channel commits 57 records and most commit
// fewer than 20, so the parse guard's second arm cannot fire on them at all
// (checklist 7b, argued in scripts/parse-finish.ts). That division is deliberate
// — a single intake collapsing inside this archive can sit under the band HERE
// and still be refused upstream, and the intakes the upstream guard sleeps on are
// exactly the ones too small to move this number.
const COLLAPSE_PCT = 0.1;
const COLLAPSE_ABS = 20;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Digest {
  count: number;
  appearances: number;
  ex: number;
  hash: string;
}

/** The fingerprint. Computed identically on both sides at check time; see the
 *  header for why nothing is embedded in the build. */
function digest(payload: unknown): Digest | null {
  if (!Array.isArray(payload)) return null;
  const h = createHash('sha256');
  let appearances = 0;
  let ex = 0;
  for (const r of payload as {
    id?: string;
    sides?: { characters?: string[] }[];
    ex?: string[][];
  }[]) {
    h.update(String(r.id ?? ''));
    for (const s of r.sides ?? []) {
      const cs = s.characters ?? [];
      appearances += cs.length;
      h.update(`|${cs.join(',')}`);
    }
    // The EX marks ride in the hash and in their own counter. `ex` is absent on
    // a record no source marked — the common case — so absent and [[], []]
    // must hash the same; the pair is normalised before it is folded in.
    const marks = [(r.ex?.[0] ?? []).join(','), (r.ex?.[1] ?? []).join(',')];
    ex += (r.ex?.[0]?.length ?? 0) + (r.ex?.[1]?.length ?? 0);
    h.update(`^${marks.join('/')}`);
    h.update(';');
  }
  return { count: payload.length, appearances, ex, hash: h.digest('hex').slice(0, 12) };
}

const same = (a: Digest, b: Digest): boolean => a.count === b.count && a.hash === b.hash;
const n = (x: number): string => x.toLocaleString('en-US');
const show = (d: Digest): string =>
  `${n(d.count)} replays · ${n(d.appearances)} side appearances · ${n(d.ex)} EX marks · ${d.hash}`;

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(`${url}?_cb=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
      redirect: 'follow',
    });
    if (!res.ok) {
      console.log(`   … HTTP ${res.status} on ${url.split('/').pop()}`);
      return null;
    }
    return (await res.json()) as unknown;
  } catch (e) {
    console.log(`   … ${(e as Error).message}`);
    return null;
  }
}

const local = digest(JSON.parse(readFileSync(join(ROOT, 'data', 'replays.json'), 'utf8')));
if (!local) {
  console.error('✖ data/replays.json is not an array — nothing to compare against.');
  process.exit(1);
}
const committed = local.count;
const replaysUrl = `${HOST}/${SLUG}/data/replays.json`;
const summaryUrl = `${HOST}/${SLUG}/data/summary.json`;

console.log(`Smoke check: ${replaysUrl}`);
console.log(`  committed ${show(local)} · engine pin ${ENGINE_PIN} · polling ${TIMEOUT_SEC}s`);
if (!ENGINE_PIN) {
  console.error(
    '✖ nuxt.config.ts declares no pinned engine tag — the code-version half of this check ' +
      'cannot run (checklist 10i).',
  );
  process.exit(1);
}

const deadline = Date.now() + TIMEOUT_SEC * 1000;
let last: Digest | null = null;
let lastEngine: string | null = null;

for (let attempt = 1; ; attempt++) {
  // summary.json FIRST, because the base-path failure makes every other reading
  // meaningless: a wrong `game` means the archive at that path belongs to another
  // project, and comparing digests against it would be comparing two games.
  const summary = (await getJson(summaryUrl)) as { game?: string; engine?: string } | null;
  if (summary && typeof summary.game === 'string' && summary.game !== SLUG) {
    console.error(
      `\n✖ THE DEPLOYMENT AT ${HOST}/${SLUG}/ IS NOT THIS GAME.\n` +
        `  summary.json says game "${summary.game}"; this project is "${SLUG}".\n\n` +
        '  This is the copied-env failure (checklist 10h): NUXT_APP_BASE_URL carried over from\n' +
        "  another project, so the build mounted at that game's base path. Nothing about the\n" +
        '  deployment looks wrong — it builds, it renders, the JSON parses — and polling longer\n' +
        '  will never make it true.\n\n' +
        `  Fix NUXT_APP_BASE_URL (/${SLUG}/) and NUXT_PUBLIC_SITE_URL on Production AND Preview,\n` +
        '  then redeploy.',
    );
    process.exit(1);
  }
  if (summary && typeof summary.engine === 'string') lastEngine = summary.engine;

  const payload = await getJson(replaysUrl);
  const d = payload === null ? null : digest(payload);
  if (payload !== null && d === null) console.log('   … payload is not an array');
  if (d !== null) {
    last = d;
    const lost = committed - d.count;
    const pct = committed > 0 ? (lost / committed) * 100 : 0;
    const enginesAgree = lastEngine === ENGINE_PIN;
    const why =
      lost !== 0
        ? `  (${lost > 0 ? '-' : '+'}${Math.abs(lost)} records, ${pct.toFixed(1)}%)`
        : same(local, d)
          ? ''
          : `  (same count, content differs — ${d.appearances} appearances / ${d.ex} EX vs ${local.appearances} / ${local.ex})`;
    console.log(
      `  [${attempt}] served ${show(d)} · engine ${lastEngine ?? '(absent)'}${
        same(local, d) && enginesAgree ? '  ✓ matches' : why
      }`,
    );
    if (same(local, d) && enginesAgree) {
      console.log(`\n✓ Production serves the committed archive on ${ENGINE_PIN} — ${show(d)}.`);
      process.exit(0);
    }
    if (same(local, d) && !enginesAgree) {
      // The records match and the CODE does not. This is exactly the case 10i
      // was written from, and it is why a digest-only check claimed success on a
      // deployment that was still building.
      console.log(
        `   … the archive matches but the deployment is on engine ${lastEngine ?? '(absent)'}, ` +
          `not ${ENGINE_PIN} — a build still in flight, or a pin that never deployed.`,
      );
    }
  }
  if (Date.now() + INTERVAL_SEC * 1000 >= deadline) break;
  await sleep(INTERVAL_SEC * 1000);
}

if (last === null) {
  console.error(
    `\n✖ Never got a readable payload from ${replaysUrl} in ${TIMEOUT_SEC}s.\n` +
      '  That is not a slow deploy — the file is missing, unparseable, or the\n' +
      '  route is broken. Check the deployment and the shell rewrite (shell\n' +
      '  vercel.json /gbvsr/*); SMOKE_HOST=https://gbvsr-replay-database.vercel.app\n' +
      '  reads the game host directly and tells the two apart.',
  );
  process.exit(1);
}

const lost = committed - last.count;
// Signed on purpose: a LARGER served count (negative `lost`) means the local
// checkout is behind production, which is not a collapse.
const collapsed = lost > COLLAPSE_ABS && lost / committed > COLLAPSE_PCT;

if (!collapsed) {
  console.warn(
    `\n⚠ Deploy has not landed within ${TIMEOUT_SEC}s.\n` +
      `  committed ${show(local)}  (engine ${ENGINE_PIN})\n` +
      `  served    ${show(last)}  (engine ${lastEngine ?? 'absent from summary.json'})\n` +
      (lost === 0
        ? '  The record count matches and something else does not — the characters, the\n' +
          '  EX marks, or the engine tag. That is a build that has not shipped the latest\n' +
          '  content yet, and it is the failure mode a count-only check reports as success.\n'
        : '  That is inside the collapse band, so what is live is a stale build, not a\n' +
          '  lost archive.\n') +
      '  Re-run this check, or watch the Vercel deployment.',
  );
  process.exit(0);
}

console.error(
  '\n✖ PRODUCTION IS SERVING A COLLAPSED ARCHIVE.\n' +
    `  committed ${n(committed)} · served ${n(last.count)} · lost ${n(lost)} (${((lost / committed) * 100).toFixed(1)}%)\n` +
    `  Past the ${COLLAPSE_PCT * 100}% AND ${COLLAPSE_ABS}-record band after ${TIMEOUT_SEC}s, so this is\n` +
    '  not a build still in flight. Visitors are seeing this right now.\n\n' +
    '  Check the latest Vercel deployment for this project, and confirm\n' +
    '  data/replays.json in the repo is the archive you meant to publish.',
);
process.exit(1);
