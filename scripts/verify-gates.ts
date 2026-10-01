/**
 * THE POSITIVE-CONTROL SUITE — checklist step 10, for Granblue Fantasy Versus: Rising.
 *
 * "Inject the failure each gate exists to catch and confirm it exits non-zero,
 * then confirm the clean run exits 0. A gate that cannot fail is
 * indistinguishable from a gate that passes, and you will trust it."
 *
 * Every control below injects a REAL defect into a REAL file (or a real input
 * the gate reads: a raw dump, a vendor-feed fixture, a ledger row), runs the
 * REAL command, and requires the outcome to NAME the rule it tripped.
 *
 * ── PORTED FROM AVATAR'S HARNESS, AND WHAT IS KEPT VERBATIM IN SPIRIT ──────
 * avatar-replay-database/scripts/verify-gates.ts (itself Strive's, itself
 * CotW's with four fixes). The load-bearing design, restated rather than
 * assumed:
 *
 * 1. verdict() PASSES A CONTROL ONLY ON AN ACTUAL NON-ZERO NUMBER whose output
 *    matches the control's `names` regex — the rule it trips. spawnSync reports
 *    `status: null` when the child was signalled, timed out or never spawned;
 *    `null !== 0` is true, so the reference harnesses once printed PASS for a
 *    control that never ran. Here `null` is a FAILURE, never a pass, and the
 *    signal is named.
 * 2. A CONTROL THAT TRIPS A NEIGHBOURING GATE PROVES NOTHING. On this repo today
 *    every control that needs a COMPLETE `scripts/parse.ts` run dies in the
 *    FREEZE-PIN gate first — the four frozen channels ship `records: -1`
 *    (scripts/channels.ts), a sentinel no carried count can equal — so under an
 *    exit-code-only rule all of them would print PASS. They SKIP instead, and
 *    the skip quotes the blocker.
 * 3. A SKIPPED CONTROL STILL AUDITS ITS ANCHOR. A control whose precondition is
 *    absent is still INJECTED and immediately restored, and a missing or
 *    non-unique anchor is a FAILURE (sub() asserts exactly one occurrence), so
 *    every control proves today that it can still place its defect, and the day
 *    the precondition lands it becomes live without being touched. The skip
 *    names what it is waiting on.
 * 4. BYTE-EXACT SNAPSHOT/RESTORE of every file a control touches, in `finally`
 *    (a file that did not exist is restored by DELETING it, and a directory the
 *    suite had to create is removed again), then a clean run of every gate
 *    afterwards — and, new here, a fingerprint of every file under data/,
 *    scripts/, app/, public/, design/, types/, raw/ and vercel.json taken
 *    before the first control and compared after the last. A suite that leaves
 *    a trace FAILS.
 * 5. THE PROBE MODULE AND EVERY FIXTURE LIVE IN AN OS TEMP DIRECTORY, never
 *    under the repo, removed on exit (and on SIGINT/SIGTERM).
 * 6. `--only=<substring>` and `--list`, plus `--offline` (below).
 *
 * ── 10c: THIS SUITE NEVER REPAIRS THE CONDITION IT TESTS ───────────────────
 * Restoring a file refreshes its mtime, so a guard keyed on mtime could never
 * fire twice. None is: the stale-raw guard reads ONLY DATA (the newest
 * publishedAt in the dump against the newest committed record for that intake,
 * scripts/parse.ts assertRawIsFresh), and no pipeline file consults filesystem
 * metadata. The suite also never seeds, fixes or regenerates anything it is
 * about to test: the freeze pins stay -1, the corpus stays absent, and the
 * controls that need them wait visibly.
 *
 * ── NO CONTROL IN THIS FILE TOUCHES THE YOUTUBE API (checklist 10j) ───────
 * The key is shared with seven production crons. Every child process gets
 * YT_API_KEY DELETED from its environment, and every offline child is started
 * with a preload that replaces `fetch` with a function that throws, so a
 * defect that made an offline gate reach for the network fails loudly instead
 * of spending anything. scripts/fetch.ts, scripts/fetch-theater.ts and
 * scripts/catchup.ts are never run against anything real. The one control that
 * exercises fetch.ts (the dead channel, checklist 7c) runs a COPY of it in the
 * temp directory with a dummy key and a preloaded stub that serves canned API
 * JSON and THROWS for any URL it does not recognise or any key that is not
 * "dummy" — and the probe fails if the stub logged a single violation.
 *
 * ── NETWORK: THE VENDOR ONLY, AND --offline SKIPS IT VISIBLY ─────────────
 * Controls marked `network: true` read Cygames' own site (no quota): the Fan
 * Kit terms page (the licence-changed control) and the two drift checkers'
 * clean runs. `--offline` skips each of them BY NAME. A vendor outage turns a
 * network control into a named skip, never a pass.
 *
 * ── THE PROBE: THIS GAME'S OWN RULES, LIVE WITH NO CORPUS ────────────────
 * scripts/parse.ts exports parseSide/parseTitle; parse-finish.ts
 * buildTheaterRecords; roster.ts the matcher, playerId and the EX tokenizer;
 * fetch-theater.ts the Rising gate, the format-tag test and the offset/segment
 * rules; expiries.ts dueExpiries with injectable inputs; theater-delta.ts
 * newerThanCursor; og.ts renderOgCard. A small probe drives those with
 * hand-built inputs, so the rules that make this game different — the fighter
 * literally named Id, 2B, Avatar Belial nesting its own Belial, the sequel
 * marker, the one catalogue label covering two games, the EX mode mark, `vid@0`
 * — are controlled today, with an empty corpus and unseeded pins.
 *
 * ── REPORT-ONLY RULES ARE CONTROLLED TOO, IN BOTH DIRECTIONS ─────────────
 * Some rules must NEVER block (the departures line, checklist 7d; match
 * identity, 2b) or refuse by counting rather than exiting (the marker and date
 * floors, the release floor, EX validity). Their control feeds the defective
 * INPUT and requires exit 0 AND the refusal on the record (a judge over what
 * the run wrote); then a DISARMED TWIN removes the rule from the code and
 * requires the judge to notice. A judge that cannot tell the difference is as
 * worthless as a gate that cannot fail.
 *
 * Run: npm run verify:gates
 *      npm run verify:gates -- --only=<substring>
 *      npm run verify:gates -- --list        (what is live and what is waiting)
 *      npm run verify:gates -- --offline     (skip the vendor-site controls, by name)
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const STARTED = Date.now();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TSX = join(ROOT, 'node_modules', '.bin', 'tsx');
const ARGS = process.argv.slice(2);
const only = ARGS.find((a) => a.startsWith('--only='))?.slice('--only='.length);
const LIST_ONLY = ARGS.includes('--list');
const OFFLINE = ARGS.includes('--offline');
const UNKNOWN_ARGS = ARGS.filter(
  (a) => !a.startsWith('--only=') && a !== '--list' && a !== '--offline',
);
if (UNKNOWN_ARGS.length) {
  console.error(
    `✖ unknown argument(s) ${UNKNOWN_ARGS.join(' ')} — accepted: --only=<substring>, --list, --offline`,
  );
  process.exit(2);
}

// ── file helpers ────────────────────────────────────────────────────────────

const abs = (p: string): string => join(ROOT, p);
const read = (p: string): string => readFileSync(abs(p), 'utf8');
const readJson = <T>(p: string): T => JSON.parse(read(p)) as T;
const sha256 = (b: Buffer): string => createHash('sha256').update(b).digest('hex');
const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Directories the suite had to create to place a defect (raw/ on a fresh
 *  checkout). Removed again on restore, and only if still empty. */
const createdDirs = new Set<string>();
const ensureDir = (p: string): void => {
  const d = dirname(abs(p));
  if (existsSync(d)) return;
  let top = d;
  while (!existsSync(dirname(top))) top = dirname(top);
  mkdirSync(d, { recursive: true });
  createdDirs.add(top);
};
const write = (p: string, s: string | Buffer): void => {
  ensureDir(p);
  writeFileSync(abs(p), s);
};

/**
 * Replace exactly once, asserting the anchor still exists AND IS UNIQUE. A
 * `String.replace` that silently took the first of two occurrences would put the
 * defect somewhere other than where the control claims. Returning false is a
 * FAILURE below, never a skip.
 */
const sub = (p: string, from: string, to: string): boolean => {
  if (!existsSync(abs(p))) return false;
  const s = read(p);
  if (s.split(from).length - 1 !== 1) return false;
  write(
    p,
    s.replace(from, () => to),
  );
  return true;
};
const occurrences = (p: string, from: string): number =>
  existsSync(abs(p)) ? read(p).split(from).length - 1 : 0;

/** The regex form of sub(): exactly one match, rewritten by `to`. */
const subRe = (p: string, re: RegExp, to: (m: RegExpMatchArray) => string): boolean => {
  if (!existsSync(abs(p))) return false;
  const s = read(p);
  const hits = [...s.matchAll(new RegExp(re.source, `${re.flags.replace('g', '')}g`))];
  if (hits.length !== 1) return false;
  const m = hits[0]!;
  write(p, s.slice(0, m.index) + to(m) + s.slice(m.index! + m[0].length));
  return true;
};

// ── the temp directory: the probe, the preloads, every fixture ─────────────

let workDir: string | null = null;
function work(): string {
  if (workDir === null) {
    workDir = mkdtempSync(join(tmpdir(), 'gbvsr-verify-gates-'));
    writeFileSync(join(workDir, 'probe.mts'), probeSource(workDir), 'utf8');
    writeFileSync(join(workDir, 'no-network.mjs'), NO_NETWORK_SOURCE, 'utf8');
    writeFileSync(join(workDir, 'youtube-stub.mjs'), YOUTUBE_STUB_SOURCE, 'utf8');
  }
  return workDir;
}
const scratch = (label: string): string => mkdtempSync(join(work(), `${label}-`));

/** Every regular file under a directory, recursively (symlinks not followed). */
function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = lstatSync(p);
    if (st.isSymbolicLink()) continue;
    if (st.isDirectory()) out.push(...walk(p));
    else if (st.isFile()) out.push(p);
  }
  return out;
}

// ── the runner ──────────────────────────────────────────────────────────────

interface Run {
  /** null when the child was signalled, timed out or never spawned — verdict(). */
  status: number | null;
  signal: NodeJS.Signals | null;
  /** stdout and stderr concatenated: a gate may name its rule on either. */
  out: string;
  error?: Error;
}

interface RunOpts {
  env?: NodeJS.ProcessEnv;
  cwd?: string;
  /** A vendor-site control: no fetch-blocking preload. Never YouTube. */
  network?: boolean;
  /** Drop GIT_* from the child env (the temp-repo fixture). */
  isolateGit?: boolean;
}

/** The environment minus GIT_* — for the throwaway fixture repository, which
 *  must never be steered at the real one by a variable set in a hook. */
const withoutGit = (e: NodeJS.ProcessEnv): NodeJS.ProcessEnv =>
  Object.fromEntries(Object.entries(e).filter(([k]) => !k.startsWith('GIT_')));

/** tsx is run from the repo's own node_modules by absolute path — never npx,
 *  which could resolve (or fetch) something else from a temp cwd. */
const run = (args: string[], o: RunOpts = {}): Run => {
  const env: NodeJS.ProcessEnv = {
    ...(o.isolateGit ? withoutGit(process.env) : process.env),
    ...o.env,
  };
  delete env.YT_API_KEY;
  if (!o.network) {
    const preload = `--import=${pathToFileURL(join(work(), 'no-network.mjs')).href}`;
    env.NODE_OPTIONS = [env.NODE_OPTIONS ?? '', preload].join(' ').trim();
  }
  const r = spawnSync(TSX, args, {
    cwd: o.cwd ?? ROOT,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    timeout: 10 * 60_000,
    env,
  });
  return {
    status: r.status,
    signal: r.signal,
    out: `${r.stdout ?? ''}\n${r.stderr ?? ''}`,
    ...(r.error ? { error: r.error } : {}),
  };
};

const git = (cwd: string, ...args: string[]): void => {
  const env = withoutGit(process.env);
  const r = spawnSync(
    'git',
    [
      '-c',
      'user.name=verify-gates',
      '-c',
      'user.email=verify-gates@localhost',
      '-c',
      'commit.gpgsign=false',
      '-c',
      'core.hooksPath=/dev/null',
      ...args,
    ],
    { cwd, encoding: 'utf8', env },
  );
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} in ${cwd}: ${r.stderr || r.error}`);
};

// ── verdicts ────────────────────────────────────────────────────────────────

type Verdict =
  | { kind: 'pass'; detail?: string }
  | { kind: 'fail'; detail: string }
  | { kind: 'skip'; detail: string };

const pass = (detail?: string): Verdict => ({ kind: 'pass', ...(detail ? { detail } : {}) });
const fail = (detail: string): Verdict => ({ kind: 'fail', detail });
const skip = (detail: string): Verdict => ({ kind: 'skip', detail });

const lines = (r: Run): string[] =>
  r.out
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
const head = (r: Run, n = 4): string => lines(r).slice(0, n).join(' / ').slice(0, 320);
/** The output line that proved a control — the first line of the match. */
const proofLine = (r: Run, names: RegExp): string => {
  const m = names.exec(r.out);
  return m ? (m[0].split('\n')[0] ?? '').trim().slice(0, 170) : '';
};

/**
 * The default assertion: a REAL non-zero number AND the rule named. `status ===
 * null` is the fix for the first ported weakness: a signalled or unspawnable
 * child reports null, `null !== 0` is true, and the control that never ran
 * printed PASS.
 */
const verdict = (r: Run, names: RegExp): Verdict => {
  if (r.error) return fail(`the command never ran: ${r.error.message}`);
  if (r.status === null) {
    return fail(
      `no exit status — the child was killed by ${r.signal ?? 'an unknown signal'}. ` +
        '`status !== 0` would have called this a PASS.',
    );
  }
  if (r.status === 0) return fail(`exited 0 with the defect present: ${head(r)}`);
  if (!names.test(r.out)) {
    return fail(
      `exited ${r.status}, but on a DIFFERENT rule — nothing in the output matches ${names}. ` +
        `A control that trips the wrong gate proves nothing. Got: ${head(r)}`,
    );
  }
  return pass(`exit ${r.status} · "${proofLine(r, names)}"`);
};

/** A report-only rule: exit 0 (a NUMBER), and the judge finds the refusal. */
const reportVerdict = (r: Run, judged: [boolean, string]): Verdict => {
  if (r.error) return fail(`the command never ran: ${r.error.message}`);
  if (r.status === null) return fail(`no exit status — killed by ${r.signal ?? 'a signal'}`);
  if (r.status !== 0) {
    return fail(`a report-only rule must never block, but the run exited ${r.status}: ${head(r)}`);
  }
  return judged[0] ? pass(`exit 0 · ${judged[1]}`) : fail(`exit 0, but ${judged[1]}`);
};

// ── the probe module ────────────────────────────────────────────────────────
//
// Written once into the temp directory. `.mts` because the directory has no
// package.json, so tsx would otherwise transpile it as CommonJS and refuse its
// top-level await. It imports the pipeline by ABSOLUTE FILE URL, which is what
// lets it live outside the project while still exercising the real code under
// injection. Each case loads only the modules it needs.

const PROBE_CASES = [
  'id-release-floor',
  'nesting',
  'marker',
  'rising-gate',
  'format-tag',
  'ex-title',
  'ex-theater',
  'segment',
  'identity',
  'placeholder',
  'slot-order',
  'skins',
  'dead-channel',
  'dormancy',
  'cursor-delta',
  'og-fonts',
] as const;
type ProbeCase = (typeof PROBE_CASES)[number];

const probePath = (): string => join(work(), 'probe.mts');

// The probe source is written with String.raw so its own regexes and escapes
// arrive exactly as typed; it therefore uses no template literals of its own.
function probeSource(here: string): string {
  return String.raw`/* Written by scripts/verify-gates.ts into an OS temp dir; removed on exit. Never commit it. */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = ${JSON.stringify(ROOT)};
const HERE = ${JSON.stringify(here)};
const KNOWN = ${JSON.stringify(PROBE_CASES)};
const which = process.argv[2] ?? '';
if (!KNOWN.includes(which)) {
  console.error('probe: unknown case ' + JSON.stringify(which));
  process.exit(2);
}
const fails = [];
const notes = [];
const need = (rule, ok, got) => {
  if (!ok) fails.push('✖ ' + rule + ' — got ' + got);
};
const mod = (f) => import(pathToFileURL(join(ROOT, f)).href);
const show = (v) => JSON.stringify(v);
const addDays = (iso, n) =>
  new Date(Date.parse(iso.slice(0, 10) + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const Z = (cp) => String.fromCodePoint(cp);
const side = (o) =>
  o && o.ok
    ? o.ok.handle + '=' + o.ok.characters.join('+') +
      ('ex' in o.ok ? ' ex=' + show(o.ok.ex) : '') +
      (o.ok.skins ? ' skins=' + show(o.ok.skins) : '')
    : 'miss:' + (o ? (o.miss ?? (o.ambiguous ? 'ambiguous' : '?')) : 'none');

let roster = null;
const loadRoster = async () => {
  if (!roster) {
    const r = await mod('scripts/roster.ts');
    const characters = await r.loadCharacters();
    roster = { ...r, characters, matcher: r.buildAliasMatcher(characters) };
  }
  return roster;
};

// The index builder, on a hand-built dump (TheaterRawRecord shape).
let seq = 0;
const trow = (id, day, players, characters, extra) => ({
  id,
  videoId: id.split('@')[0],
  theaterId: ++seq,
  channel: 'replayTheater',
  title: 'probe row ' + id,
  description: '',
  publishedAt: day + 'T12:00:00Z',
  durationSec: 600,
  liveBroadcastContent: 'none',
  tag: '',
  uploader: 'Probe Uploader',
  players,
  characters,
  ...(extra ?? {}),
});
const theater = async (dump) => {
  const { characters, matcher } = await loadRoster();
  const { buildTheaterRecords } = await mod('scripts/parse-finish.ts');
  const { patchWindows, PRE_RELEASE } = await mod('scripts/seasons.ts');
  const out = buildTheaterRecords(dump, {
    records: [],
    committed: [],
    overrides: {},
    rawSeen: new Map(),
    matcher,
    characters,
    floor: PRE_RELEASE,
    floorSec: 120,
    windows: patchWindows(),
  });
  return { out, by: new Map(out.built.map((r) => [r.id, r])) };
};

// ── the fighter literally named Id ────────────────────────────────────────
if (which === 'id-release-floor') {
  const { characters, matcher } = await loadRoster();
  const { PATCHES } = await mod('scripts/seasons.ts');
  const released = characters.find((c) => c.id === 'id')?.extra?.released;
  const p260 = PATCHES.find((p) => p.version === '2.60')?.start;
  need(
    'Id IS RELEASED ON THE DAY OF THE PATCH THAT ADDED HER (2.60, checklist 5u)',
    !!released && released === p260,
    'extra.released ' + released + ', 2.60 starts ' + p260,
  );
  const day = released ?? '2026-09-15';
  const early = addDays(day, -14);
  const late = addDays(day, 5);
  const { out, by } = await theater([
    trow('EARLYIDROW1', early, ['Alpha', 'Beta'], [['Id'], ['Gran']]),
    trow('LATEIDROW01', late, ['Gamma', 'Delta'], [['Id'], ['Vane']]),
  ]);
  need(
    'THE RELEASE FLOOR (index) — a row naming Id on ' + early + ', before she shipped, is refused and counted',
    !by.has('EARLYIDROW1') && out.beforeRelease === 1,
    'built ' + show([...by.keys()]) + ', beforeRelease ' + out.beforeRelease,
  );
  need(
    'THE RELEASE FLOOR (index) — the same fighter on ' + late + ' mints',
    by.get('LATEIDROW01')?.sides[0].characters.join('+') === 'id',
    show(by.get('LATEIDROW01')?.sides ?? 'absent'),
  );
  const ids = (t) => matcher.ids(t).join('+') || '[]';
  need(
    'THE TWO-LETTER GUARD (checklist 5v) — "IDカード" and "IDOL" are not the fighter Id',
    ids('IDカード') === '[]' && ids('IDOL') === '[]',
    'IDカード→' + ids('IDカード') + ', IDOL→' + ids('IDOL'),
  );
  need(
    'THE TWO-LETTER GUARD still reads the fighter — "Tako ID VS OZ Japan Vane" → id, vane',
    ids('Tako ID VS OZ Japan Vane') === 'id+vane',
    ids('Tako ID VS OZ Japan Vane'),
  );
}

// ── Avatar Belial nests Belial; 2B leads with a digit ─────────────────────
if (which === 'nesting') {
  const { matcher } = await loadRoster();
  const { parseSide } = await mod('scripts/parse.ts');
  const ids = (t) => matcher.ids(t).join('+') || '[]';
  const spellings = ['Avatar Belial', 'AvatarBelial', 'Avatar-Belial', 'アバタール・ベリアル', 'アバタールベリアル'];
  need(
    'THE NESTED NAME (checklist 5c) — Avatar Belial absorbs its inner Belial, in both scripts',
    spellings.every((s) => ids(s) === 'avatar-belial'),
    spellings.map((s) => s + '→' + ids(s)).join(' · '),
  );
  const bare = side(parseSide('DARKZERO Avatar Belial', matcher, 'handle-first-bare'));
  const paren = side(parseSide('Tako (アバタール・ベリアル)', matcher, 'handle-outside'));
  need(
    'THE NESTED NAME ON A SIDE — avatar-belial, never belial',
    bare === 'DARKZERO=avatar-belial' && paren === 'Tako=avatar-belial',
    bare + ' · ' + paren,
  );
  need(
    'BELIAL ALONE IS STILL BELIAL',
    ids('Belial') === 'belial' && ids('Belial vs Avatar Belial') === 'belial+avatar-belial',
    ids('Belial') + ' · ' + ids('Belial vs Avatar Belial'),
  );
  const b1 = side(parseSide('Tako 2B', matcher, 'handle-first-bare'));
  const b2 = side(parseSide('Tako (2B)', matcher, 'handle-outside'));
  need(
    '2B IS A FIGHTER — the one digit-leading id, bare and in a paren',
    b1 === 'Tako=2b' && b2 === 'Tako=2b',
    b1 + ' · ' + b2,
  );
}

// ── the sequel marker ─────────────────────────────────────────────────────
if (which === 'marker') {
  const { hasGbvsrMarker } = await mod('scripts/channels.ts');
  const oldGame = [
    'GBVS: Foo (Gran) Vs Bar (Djeeta) | High Level Gameplay',
    '[GBVS] (4K) Granblue Fantasy Versus Rank match Foo (Gran) vs Bar (Zeta)',
    '[GBVS] Foo (Gran) vs Bar (Djeeta) Granblue Fantasy Versus',
    'GBVS Rookies Replay Djeeta VS Gran',
    'Foo (Gran) vs Bar (Djeeta) #gbvs #gbvsr #gbvsreplaychannel',
  ];
  const leaked = oldGame.filter((t) => hasGbvsrMarker(t));
  need(
    'THE MARKER IS GBVSR, NEVER BARE GBVS (checklist 3c) — the previous game stays out',
    leaked.length === 0,
    'admitted ' + show(leaked),
  );
  const rising = [
    'GBVSR:🔥Foo (Gran)🔥 Vs Bar (Djeeta)🔥| High Level Gameplay.',
    '[GBVSR] (4K) Granblue Fantasy Versus Rising Rank match Foo (Gran) vs Bar (Zeta)',
    'Granblue Fantasy Versus: Rising: REPLAY [KOYAO(NARMAYA)] vs [TAKO(GRAN)]',
    '【加奈人（siegfried ジークフリート）VS 他人（gran グラン）】#GBVSR No103 金曜だから夜更かし',
    'グラブルVSライジング ランクマッチ',
  ];
  const lost = rising.filter((t) => !hasGbvsrMarker(t));
  need('THE MARKER STILL READS EVERY RISING SPELLING', lost.length === 0, 'refused ' + show(lost));
}

// ── one catalogue label, two games: the Rising gate ───────────────────────
if (which === 'rising-gate') {
  const { CHANNEL_BY_ID } = await mod('scripts/channels.ts');
  const { preRisingByUploadDate, risingByPublishedAt } = await mod('scripts/fetch-theater.ts');
  const admit = CHANNEL_BY_ID.get('replayTheater').index.admitFrom;
  need(
    'THE RISING PRE-GATE (checklist 12l) — a 2021 upload_date is refused before hydration',
    preRisingByUploadDate('2021-05-01', admit) === true,
    'preRisingByUploadDate(2021-05-01, ' + admit + ') = ' + preRisingByUploadDate('2021-05-01', admit),
  );
  need(
    'THE PRE-GATE KEEPS ITS DAY OF SLACK, AND HYDRATES WHAT IT CANNOT READ',
    preRisingByUploadDate(addDays(admit, -1), admit) === false &&
      preRisingByUploadDate(null, admit) === false &&
      preRisingByUploadDate('someday', admit) === false,
    show([preRisingByUploadDate(addDays(admit, -1), admit), preRisingByUploadDate(null, admit)]),
  );
  need(
    'THE RISING CONFIRM (checklist 12l) — a 2021 publishedAt is refused, the first playable day is not',
    risingByPublishedAt('2021-05-01T12:00:00Z', admit) === false &&
      risingByPublishedAt(admit + 'T00:00:00Z', admit) === true &&
      risingByPublishedAt(addDays(admit, -1) + 'T23:59:59Z', admit) === false,
    show([
      risingByPublishedAt('2021-05-01T12:00:00Z', admit),
      risingByPublishedAt(admit + 'T00:00:00Z', admit),
      risingByPublishedAt(addDays(admit, -1) + 'T23:59:59Z', admit),
    ]),
  );
  const { out, by } = await theater([
    trow('OLDGAMEROW1', '2021-05-01', ['Alpha', 'Beta'], [['Gran'], ['Katalina']]),
    trow('RISINGROW01', '2025-05-01', ['Gamma', 'Delta'], [['Gran'], ['Katalina']]),
  ]);
  need(
    "THE BUILDER'S DATE FLOOR — a 2021 row that reached the dump is still refused and counted",
    !by.has('OLDGAMEROW1') && by.has('RISINGROW01') && out.beforeFloor === 1,
    'built ' + show([...by.keys()]) + ', beforeFloor ' + out.beforeFloor,
  );
}

// ── a set format is never an event ────────────────────────────────────────
if (which === 'format-tag') {
  const { isFormatTag } = await mod('scripts/fetch-theater.ts');
  const formats = ['FT5', 'FT' + Z(0xff15), Z(0xff26) + Z(0xff34) + '10', 'BO3', 'First to 10'];
  const events = ['EVO 2025', 'Top 8 FT3', 'Socal Colosseum Clash #21', 'FT5 Invitational 2025'];
  need(
    'A SET FORMAT IS NEVER AN EVENT (checklist 12k) — FT5, the fullwidth FT５, BO3',
    formats.every((t) => isFormatTag(t)),
    formats.map((t) => show(t) + '=' + isFormatTag(t)).join(' '),
  );
  need(
    'AN EVENT IS NEVER A SET FORMAT — "EVO 2025", "Top 8 FT3"',
    events.every((t) => !isFormatTag(t)),
    events.map((t) => show(t) + '=' + isFormatTag(t)).join(' '),
  );
}

// ── the EX mark, title side ───────────────────────────────────────────────
if (which === 'ex-title') {
  const { matcher } = await loadRoster();
  const { parseSide } = await mod('scripts/parse.ts');
  const ps = (s, o) => side(parseSide(s, matcher, o));
  const got = [
    ps('Kaiser (EX Narmaya)', 'handle-outside'),
    ps('Kaiser EX Narmaya', 'handle-first-bare'),
    ps('Kaiser (NarmayaEX)', 'handle-outside'),
  ];
  need(
    'THE EX MARK IS READ WHERE IT IS WRITTEN — "(EX Narmaya)", bare "EX Narmaya", glued "NarmayaEX"',
    got.every((g) => g === 'Kaiser=narmaya ex=["narmaya"]'),
    got.join(' · '),
  );
  const plain = parseSide('Kaiser (Narmaya)', matcher, 'handle-outside');
  need(
    'AN UNMARKED SIDE CARRIES NO ex KEY — positive evidence only, never false, never [] (checklist 13b)',
    !!plain.ok && !('ex' in plain.ok),
    show(plain),
  );
  const stray = ps('EX Kaiser (Narmaya)', 'handle-outside');
  need(
    'A STRAY EX IS NOT A MARK — only a token attached to the fighter marks it',
    stray === 'EX Kaiser=narmaya',
    stray,
  );
}

// ── the EX mark, index side, with its two validity rules ─────────────────
if (which === 'ex-theater') {
  const { characters } = await loadRoster();
  const since = characters.find((c) => c.id === 'gran')?.extra?.exSince ?? '2025-08-03';
  const before = addDays(since, -33);
  const after = addDays(since, 29);
  const { out, by } = await theater([
    trow('EXBEFORE001', before, ['Alpha', 'Beta'], [['Gran (EX)'], ['Katalina']]),
    trow('EXAFTER0001', after, ['Gamma', 'Delta'], [['Gran (EX)'], ['Katalina']]),
    trow('EXZETA00001', after, ['Epsilon', 'Eta'], [['Zeta (EX)'], ['Djeeta']]),
  ]);
  const r1 = by.get('EXBEFORE001');
  const r2 = by.get('EXAFTER0001');
  const r3 = by.get('EXZETA00001');
  need(
    'A VALID EX LABEL MARKS ITS SIDE — "Gran (EX)" on ' + after,
    show(r2?.sides[0].ex) === '["gran"]',
    show(r2?.sides ?? 'absent'),
  );
  need(
    'EX BEFORE Ver 2.20 IS RESIDUE, NEVER A MARK — "Gran (EX)" on ' + before + ' (checklist 13b)',
    !!r1 && !('ex' in r1.sides[0]),
    show(r1?.sides ?? 'absent'),
  );
  need(
    'EX ON A FIGHTER WITH NO EX MODE IS RESIDUE, NEVER A MARK — "Zeta (EX)" (checklist 13b)',
    !!r3 && !('ex' in r3.sides[0]) && r3.sides[0].characters.join() === 'zeta',
    show(r3?.sides ?? 'absent'),
  );
  need(
    'BOTH REFUSALS ARE COUNTED, THE VALID MARK ONCE',
    out.exInvalid === 2 && out.exMarked === 1,
    'exInvalid ' + out.exInvalid + ', exMarked ' + out.exMarked,
  );
  const unmarked = [r1?.sides[1], r2?.sides[1], r3?.sides[1]];
  need(
    'AN UNMARKED SIDE CARRIES NO ex KEY (index) — never false, never []',
    unmarked.every((s) => !!s && !('ex' in s)),
    show(unmarked),
  );
}

// ── segments: vid@0 and its siblings ──────────────────────────────────────
if (which === 'segment') {
  const { by } = await theater([
    trow('SEGVIDEO001@0', '2025-09-01', ['Alpha', 'Beta'], [['Gran'], ['Zeta']], {
      startSeconds: 0,
      durationSec: 0,
      tag: 'Probe Major 2025',
    }),
    trow('SEGVIDEO001@1200', '2025-09-01', ['Gamma', 'Delta'], [['Vane'], ['Beatrix']], {
      startSeconds: 1200,
      durationSec: 0,
      tag: 'Probe Major 2025',
    }),
    trow('WHOLEVIDEO1', '2025-09-01', ['Epsilon', 'Eta'], [['Narmaya'], ['Djeeta']]),
  ]);
  const z = by.get('SEGVIDEO001@0');
  const w = by.get('WHOLEVIDEO1');
  need(
    'A t=0 SEGMENT KEEPS videoId AND startSeconds: 0 THROUGH THE BUILDER (checklist 12n)',
    !!z && z.videoId === 'SEGVIDEO001' && z.startSeconds === 0,
    show(z ? { id: z.id, videoId: z.videoId, startSeconds: z.startSeconds } : 'absent'),
  );
  need(
    'A WHOLE VIDEO CARRIES NEITHER FIELD',
    !!w && !('videoId' in w) && !('startSeconds' in w),
    show(w ? { id: w.id, videoId: w.videoId, startSeconds: w.startSeconds } : 'absent'),
  );
  const { isSegmentEntry, offsetSeconds, parseLink } = await mod('scripts/fetch-theater.ts');
  need(
    'A t=0 ROW INSIDE A MULTI-ROW VOD IS A SEGMENT (checklist 12k)',
    isSegmentEntry(2, 0, 5000) === true,
    'isSegmentEntry(2, 0, 5000) = ' + isSegmentEntry(2, 0, 5000),
  );
  need(
    'AN INTRO-SKIP OFFSET ON A SINGLE-ROW VIDEO IS NOT A SEGMENT (checklist 12k)',
    isSegmentEntry(1, 5, 600) === false &&
      isSegmentEntry(1, 300, 600) === true &&
      isSegmentEntry(1, undefined, 600) === false,
    show([isSegmentEntry(1, 5, 600), isSegmentEntry(1, 300, 600), isSegmentEntry(1, undefined, 600)]),
  );
  const hms = [['1h11m20s', 4280], ['26m55s', 1615], ['35m', 2100], ['554s', 554], ['554', 554], ['', null], ['soon', null]];
  need(
    'AN h/m/s OFFSET IS READ, NEVER DROPPED AS A BAD LINK (checklist 12k)',
    hms.every(([v, n]) => offsetSeconds(v) === n),
    hms.map(([v]) => show(v) + '→' + offsetSeconds(v)).join(' '),
  );
  const link = parseLink('https://youtu.be/abcdefghijk&t=554s');
  need(
    'A CONCATENATED youtu.be LINK IS READ BY THE ID SHAPE (checklist 12k)',
    link.videoId === 'abcdefghijk' && link.startSeconds === 554,
    show(link),
  );
}

// ── identity, which is what normalisation is FOR (checklist 5l) ──────────
if (which === 'identity') {
  const { playerId } = await loadRoster();
  const joined = [
    ['DarkZero', 'the baseline'],
    ['Dark' + Z(0x200b) + 'Zero', 'U+200B ZERO WIDTH SPACE'],
    ['Dark' + Z(0x200d) + 'Zero', 'U+200D ZERO WIDTH JOINER'],
    ['Dark' + Z(0x2060) + 'Zero', 'U+2060 WORD JOINER'],
    ['Dark' + Z(0xfeff) + 'Zero', 'U+FEFF ZERO WIDTH NO-BREAK SPACE'],
  ];
  const a = joined.map(([s]) => playerId(s));
  need(
    'NORMALISATION IS IDENTITY — the zero-width class (checklist 5l)',
    new Set(a).size === 1 && a[0] === 'darkzero',
    joined.map(([, why], i) => why + ' → ' + a[i]).join(' · '),
  );
  const spaced = [
    ['Dark Zero', 'ASCII space'],
    ['Dark' + Z(0xa0) + 'Zero', 'U+00A0 NO-BREAK SPACE'],
    ['Dark' + Z(0x3000) + 'Zero', 'U+3000 IDEOGRAPHIC SPACE'],
    [Z(0xff24) + 'ark Zero', 'FULLWIDTH LATIN D'],
    [Z(0xff24) + Z(0xff41) + Z(0xff52) + Z(0xff4b) + Z(0x3000) + 'Zero', 'fullwidth letters + U+3000'],
  ];
  const b = spaced.map(([s]) => playerId(s));
  need(
    'NORMALISATION IS IDENTITY — the space and fullwidth class (checklist 5l)',
    new Set(b).size === 1 && b[0] === 'dark-zero',
    spaced.map(([, why], i) => why + ' → ' + b[i]).join(' · '),
  );
}

// ── the placeholder family, and the one-symbol handle that is not one ────
if (which === 'placeholder') {
  const { isPlaceholderHandle } = await mod('scripts/crosscheck.ts');
  need(
    "THE SYMBOL HANDLE (checklist 12k) — '♱' is a real player, never a placeholder",
    isPlaceholderHandle('♱') === false,
    "isPlaceholderHandle('♱') = " + isPlaceholderHandle('♱'),
  );
  const leaked = ['Unknown Player', 'GG Player', 'Player', 'Unknown', 'N/A', 'TBD', '...', '▼▲▼▲'].filter(
    (h) => !isPlaceholderHandle(h),
  );
  need('AND IT STILL REFUSES THE REAL PLACEHOLDERS', leaked.length === 0, 'admitted ' + show(leaked));
  const { out, by } = await theater([
    trow('PLACEHOLDR1', '2025-10-01', ['Unknown Player', 'Nu'], [['Gran'], ['Katalina']]),
    trow('REALPLAYER1', '2025-10-01', ['Xi', 'Omicron'], [['Gran'], ['Katalina']]),
  ]);
  need(
    'A PLACEHOLDER ROW NEVER MINTS A PLAYER — dropped and counted (index)',
    !by.has('PLACEHOLDR1') && by.has('REALPLAYER1') && out.placeholder === 1,
    'built ' + show([...by.keys()]) + ', placeholder ' + out.placeholder,
  );
}

// ── slot order on the bare grammar, and the fighter-named player ─────────
if (which === 'slot-order') {
  const { matcher } = await loadRoster();
  const { parseSide, parseTitle } = await mod('scripts/parse.ts');
  const { CHANNEL_BY_ID } = await mod('scripts/channels.ts');
  const declared = CHANNEL_BY_ID.get('gbvsReplayChannel').slotOrder;
  const t = parseTitle('GBVSR High Level Gameplay Zira ID VS DARKZERO Avatar Belial', matcher, declared);
  const got = t.ok ? t.ok.map((s) => s.handle + '=' + s.characters.join('+')).join(' vs ') : 'miss:' + t.miss;
  need(
    'THE BARE GRAMMAR (gbvsReplayChannel, ' + declared + ') — handle first, fighter last',
    got === 'Zira=id vs DARKZERO=avatar-belial',
    got,
  );
  const uno = side(parseSide('UNO Ferry', matcher, declared));
  const djeeta = side(parseSide('Djeeta Wilnas', matcher, declared));
  need(
    'A CONFIRMED FIGHTER-NAMED PLAYER ON A BARE SIDE (checklist 5w) — UNO on Ferry, Djeeta on Wilnas',
    uno === 'UNO=ferry' && djeeta === 'Djeeta=wilnas',
    uno + ' · ' + djeeta,
  );
  const lanslot = parseSide('Lanslot Six', matcher, declared);
  need(
    'ONLY THE EVIDENCED LIST UNLOCKS IT — a real counter-pick is never read as a handle (5w)',
    !lanslot.ok,
    side(lanslot),
  );
}

// ── skins ride inside the fighter paren ──────────────────────────────────
if (which === 'skins') {
  const { matcher } = await loadRoster();
  const { parseSide } = await mod('scripts/parse.ts');
  const a = side(parseSide('Kaiser (Narmaya B.Butterfly)', matcher, 'handle-outside'));
  const b = side(parseSide('Kaiser (Katalina Lady Serenity)', matcher, 'handle-outside'));
  need(
    'A SKIN INSIDE THE FIGHTER PAREN IS STRIPPED AND COUNTED, AND THE SIDE STILL RESOLVES',
    a === 'Kaiser=narmaya skins=["B.Butterfly"]' && b === 'Kaiser=katalina skins=["Lady Serenity"]',
    a + ' · ' + b,
  );
  const c = side(parseSide('Summer (Gran)', matcher, 'handle-outside'));
  need('A PLAYER CALLED "Summer" KEEPS HIS NAME — skins are cut from brackets only', c === 'Summer=gran', c);
}

// ── a dead channel fails alone (checklist 7c), against a STUBBED API ─────
if (which === 'dead-channel') {
  const { ACTIVE_CHANNELS } = await mod('scripts/channels.ts');
  const copy = join(HERE, 'fetch-copy');
  rmSync(copy, { recursive: true, force: true });
  for (const d of ['scripts', 'types', 'data']) mkdirSync(join(copy, d), { recursive: true });
  for (const f of ['fetch.ts', 'youtube.ts', 'channels.ts', 'roster.ts', 'seasons.ts'])
    copyFileSync(join(ROOT, 'scripts', f), join(copy, 'scripts', f));
  copyFileSync(join(ROOT, 'types', 'index.ts'), join(copy, 'types', 'index.ts'));
  copyFileSync(join(ROOT, 'data', 'characters.json'), join(copy, 'data', 'characters.json'));
  copyFileSync(join(ROOT, 'package.json'), join(copy, 'package.json'));
  symlinkSync(join(ROOT, 'node_modules'), join(copy, 'node_modules'));
  const dead = ACTIVE_CHANNELS[1];
  const others = ACTIVE_CHANNELS.filter((c) => c !== dead);
  const logFile = join(HERE, 'youtube-stub.jsonl');
  rmSync(logFile, { force: true });
  const env = {
    PATH: process.env.PATH ?? '',
    HOME: process.env.HOME ?? '',
    YT_API_KEY: 'dummy',
    GATES_STUB_DEAD: dead.uploadsPlaylist,
    GATES_STUB_LOG: logFile,
  };
  if (process.env.TMPDIR) env.TMPDIR = process.env.TMPDIR;
  const r = spawnSync(
    process.execPath,
    ['--import', 'tsx', '--import', pathToFileURL(join(HERE, 'youtube-stub.mjs')).href, join(copy, 'scripts', 'fetch.ts')],
    { cwd: copy, encoding: 'utf8', timeout: 180000, env },
  );
  const out = (r.stdout ?? '') + (r.stderr ?? '');
  const reqs = existsSync(logFile)
    ? readFileSync(logFile, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];
  const violations = reqs.filter((q) => q.violation);
  const crashed = /SyntaxError|ERR_MODULE_NOT_FOUND|Cannot find module/.test(out);
  need(
    'THE STUB HELD — no request left it, the key was the dummy, the copy ran',
    violations.length === 0 && reqs.length > 0 && !crashed,
    violations.length + ' violation(s), ' + reqs.length + ' request(s)' + (crashed ? ', the child crashed: ' + out.slice(0, 300) : ''),
  );
  const written = (id) => existsSync(join(copy, 'raw', id + '.json'));
  const tail = out.split('\n').filter((l) => l.trim()).slice(-3).join(' / ').slice(0, 300);
  need(
    'A DEAD CHANNEL FAILS ALONE (checklist 7c) — named with the freeze remedy, every other channel still written',
    r.status === 1 &&
      others.every((c) => written(c.id)) &&
      !written(dead.id) &&
      out.includes(dead.id + ' (' + dead.name + ')') &&
      out.includes('freeze it IN PLACE') &&
      out.includes('frozen.records'),
    'status ' + r.status + (r.signal ? ' (' + r.signal + ')' : '') + '; written: ' +
      ACTIVE_CHANNELS.map((c) => c.id + '=' + written(c.id)).join(' ') + '; ' + tail,
  );
  notes.push(
    reqs.length + ' stubbed API request(s), ' + violations.length + ' violation(s); ' + dead.id +
      ' answered 404 and was named; written: ' + others.filter((c) => written(c.id)).map((c) => c.id).join(', '),
  );
}

// ── the dormancy alarms (checklist 7e) and the quarterly watches ─────────
// The thresholds are ASSERTED HERE AS DECIDED (7 days from the measured 4.42;
// 90-day reviews), never read back from the module under test — a probe that
// derived its expectation from the constant would follow the defect.
if (which === 'dormancy') {
  const { dueExpiries } = await mod('scripts/expiries.ts');
  const { CHANNELS } = await mod('scripts/channels.ts');
  const asOf = '2026-10-10';
  const silent = (days) =>
    dueExpiries(asOf, [{ intake: 'highLevelReplays', publishedAt: addDays(asOf, -days) + 'T12:00:00Z' }], null).filter(
      (d) => d.kind === 'silent-channel' && d.id === 'highLevelReplays',
    );
  need(
    'THE DOMINANT CHANNEL SILENCE ALARM (checklist 7e, 7 days from its measured 4.42) — 8 days silent fires',
    silent(8).length === 1,
    show(silent(8).map((d) => d.kind + ' due ' + d.date)),
  );
  need('AND 4 DAYS SILENT STAYS QUIET', silent(4).length === 0, show(silent(4).map((d) => d.kind)));
  const frozen = CHANNELS.find((c) => c.frozen);
  const reviewed = frozen.frozen.reviewedAt ?? frozen.frozen.since;
  const watch = (n) =>
    dueExpiries(addDays(reviewed, n), [], null).filter((d) => d.kind === 'frozen-watch' && d.id === frozen.id);
  need(
    'THE FROZEN-CHANNEL WATCH IS QUARTERLY — quiet at reviewedAt+89, due ON reviewedAt+90, the day it names',
    watch(89).length === 0 && watch(90).length === 1 && watch(90)[0].date === addDays(reviewed, 90),
    frozen.id + ' reviewed ' + reviewed + ': +89 ' + watch(89).length + ', +90 ' + watch(90).length +
      ', +91 ' + show(watch(91).map((d) => d.date)),
  );
  const verified = '2026-09-29';
  const licence = (n) => dueExpiries(addDays(verified, n), [], verified).filter((d) => d.kind === 'art-licence');
  need(
    'THE FAN KIT LICENCE RE-READ IS QUARTERLY (Article 3) — quiet at +89, due ON +90, the day it names',
    licence(89).length === 0 && licence(90).length === 1 && licence(90)[0].date === addDays(verified, 90),
    '+89 ' + licence(89).length + ', +90 ' + licence(90).length + ', +91 ' + show(licence(91).map((d) => d.date)),
  );
}

// ── the cursor delta (Tekken's testTheaterDelta shape) ───────────────────
if (which === 'cursor-delta') {
  const { newerThanCursor } = await mod('scripts/theater-delta.ts');
  const win = [{ id: 12, tag: 'evo' }, { id: 11, tag: '' }, { id: 10, tag: 'evo' }, { id: 9, tag: 'evo' }, { tag: 'evo' }];
  const delta = newerThanCursor(win, true, 10);
  need(
    'THE CURSOR DELTA HOLDS ONLY WHAT IS NEWER THAN THE CURSOR — 12, 11 and the id-less entry',
    delta.map((e) => e.id ?? '-').join(',') === '12,11,-',
    delta.map((e) => e.id ?? '-').join(','),
  );
  need(
    'THE CURSOR ENTRY ITSELF AND EVERYTHING OLDER ARE DROPPED',
    !delta.some((e) => e.id === 10 || e.id === 9),
    show(delta),
  );
  need('A ZERO CURSOR KEEPS THE WHOLE WINDOW', newerThanCursor(win, true, 0).length === win.length, String(newerThanCursor(win, true, 0).length));
  need('A FULL SWEEP IGNORES THE CURSOR', newerThanCursor(win, false, 10).length === win.length, String(newerThanCursor(win, false, 10).length));
  need(
    'A CURSOR AT THE NEWEST ID YIELDS NO NUMBERED ENTRY — an empty dump, a carry',
    newerThanCursor(win, true, 12).filter((e) => typeof e.id === 'number').length === 0,
    show(newerThanCursor(win, true, 12)),
  );
}

// ── the OG card's font gate (checklist 5d), rendered into the temp dir ───
if (which === 'og-fonts') {
  const { renderOgCard } = await mod('scripts/og.ts');
  try {
    const r = await renderOgCard({ root: join(HERE, 'og-root'), credit: 'Probe credit' });
    need('THE CARD RENDERED INTO THE TEMP ROOT, NEVER public/', r.file.startsWith(HERE), r.file);
    notes.push(r.summary.split('\n')[0]);
  } catch (e) {
    need(
      'THE FONT GATE (checklist 5d) — the card is drawn on the committed faces or not at all',
      false,
      e instanceof Error ? e.message : String(e),
    );
  }
}

if (fails.length) {
  for (const f of fails) console.error(f);
  process.exit(1);
}
console.log('probe ' + which + ': clean' + (notes.length ? ' — ' + notes.join('; ') : ''));
`;
}

/** Preloaded into every OFFLINE child (NODE_OPTIONS --import). */
const NO_NETWORK_SOURCE = String.raw`// Written by scripts/verify-gates.ts. Nothing an offline control runs may reach
// the network; if a defect makes it try, it fails loudly here instead.
globalThis.fetch = async (input) => {
  const target = typeof input === 'string' ? input : (input && input.url) || String(input);
  throw new Error('verify-gates: NETWORK REFUSED in an offline control — ' + target.split('?')[0]);
};
`;

/** Preloaded ONLY into the stubbed copy of scripts/fetch.ts (the dead-channel
 *  probe). Canned YouTube Data API v3 JSON; every other URL, and any key that is
 *  not "dummy", THROWS — so the copy can never reach the real API. */
const YOUTUBE_STUB_SOURCE = String.raw`// Written by scripts/verify-gates.ts. A YouTube Data API v3 STUB: nothing reaches the network.
import { appendFileSync } from 'node:fs';
const LOG = process.env.GATES_STUB_LOG;
const DEAD = process.env.GATES_STUB_DEAD;
const log = (o) => {
  if (LOG) appendFileSync(LOG, JSON.stringify(o) + '\n');
};
const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const TITLE = 'GBVSR:🔥Alpha (Gran)🔥 Vs Beta (Djeeta)🔥| High Level Gameplay.';
globalThis.fetch = async (input) => {
  const u = new URL(typeof input === 'string' ? input : (input && input.url) || String(input));
  if (u.hostname !== 'www.googleapis.com' || !u.pathname.startsWith('/youtube/v3/')) {
    log({ violation: 'non-API URL', url: u.origin + u.pathname });
    throw new Error('GATES STUB REFUSED a non-API URL: ' + u.origin + u.pathname);
  }
  if (u.searchParams.get('key') !== 'dummy') {
    log({ violation: 'the key is not the dummy' });
    throw new Error('GATES STUB REFUSED: the key is not "dummy"');
  }
  const endpoint = u.pathname.slice('/youtube/v3/'.length);
  const p = Object.fromEntries(u.searchParams);
  delete p.key;
  log({ endpoint, ...p });
  if (endpoint === 'playlistItems') {
    if (p.playlistId === DEAD)
      return json(404, {
        error: {
          code: 404,
          message: "The playlist identified with the request's playlistId parameter cannot be found.",
          errors: [{ domain: 'youtube.playlistItem', reason: 'playlistNotFound' }],
        },
      });
    const items = [1, 2].map((n) => ({
      snippet: { title: TITLE },
      contentDetails: { videoId: p.playlistId + '-' + n, videoPublishedAt: '2026-09-2' + n + 'T12:00:00Z' },
    }));
    return json(200, { items });
  }
  if (endpoint === 'videos') {
    const items = String(p.id).split(',').map((id) => ({
      id,
      snippet: {
        title: TITLE,
        description: '',
        publishedAt: '2026-09-21T12:00:00Z',
        liveBroadcastContent: 'none',
        channelTitle: 'stub',
        channelId: 'UCstub',
      },
      contentDetails: { duration: 'PT7M28S' },
      statistics: { viewCount: '100' },
    }));
    return json(200, { items });
  }
  log({ violation: 'unexpected endpoint ' + endpoint });
  throw new Error('GATES STUB: unexpected endpoint ' + endpoint);
};
`;

// ── preconditions ───────────────────────────────────────────────────────────
//
// A skip is legal ONLY for a genuinely absent precondition, it must NAME which
// one, and it is counted and reprinted at the end. Everything else — an anchor
// that no longer matches, a run that tripped a DIFFERENT gate — is a FAILURE.

interface Side {
  player: string;
  handle: string;
  characters: string[];
  ex?: string[];
}
interface Rec {
  id: string;
  intake: string;
  publishedAt: string;
  videoId?: string;
  startSeconds?: number;
  sides: Side[];
}
interface RawRow {
  id: string;
  title: string;
  publishedAt: string;
  durationSec: number;
  [k: string]: unknown;
}

const committed = (): Rec[] | null =>
  existsSync(abs('data/videos.json')) ? readJson<Rec[]>('data/videos.json') : null;

/** A committed corpus. Absent until the first successful parse. */
const needCorpus = (): string | null => {
  const v = committed();
  if (v === null) return 'data/videos.json does not exist — no parse has completed yet';
  return v.length > 0 ? null : 'data/videos.json is empty — there is no record to break';
};

/** A raw dump. raw/ is gitignored, so a fresh checkout has none. */
const needRaw = (name: string): string | null =>
  existsSync(abs(`raw/${name}.json`))
    ? null
    : `raw/${name}.json is absent (raw/ is gitignored; \`npm run data:fetch\` writes it)`;

// Everything scripts/parse.ts and scripts/parse-finish.ts write. Listed so a
// run that COMPLETES is restored byte-exactly rather than leaving a defective
// corpus behind for the next control to read as its baseline.
const PARSE_OUTPUTS = [
  'data/videos.json',
  'data/players.json',
  'data/review-queue.json',
  'data/source-pins.json',
  'data/theater-cursor.json',
  'data/theater-disagreements.json',
  'data/report.md',
];
// Everything scripts/emit.ts writes (public/data/ is gitignored build output,
// restored all the same so a run leaves nothing behind).
const EMIT_OUTPUTS = [
  'data/replays.json',
  'data/stats.json',
  'data/summary.json',
  'data/patchGroups.json',
  'data/patchBoundaries.json',
  'data/seasonBoundaries.json',
  'public/data/replays.json',
  'public/data/summary.json',
];

/**
 * A clean `scripts/parse.ts` run, MEASURED ONCE (outputs snapshotted and
 * restored around it) and cached. While the parse refuses for ANY reason an
 * injected defect cannot reach a gate DOWNSTREAM of that refusal. Today the
 * refusal is the freeze pin, shipped unseeded on purpose; it is quoted into
 * every skip so the ritual that clears it is one line away. Controls whose gate
 * sits UPSTREAM of the pin (the unreadable videos.json, the empty dump, the
 * index carry) do not wait on this, and run today.
 */
let parseBlocker: string | null | undefined;
const needCleanParse = (): string | null => {
  if (parseBlocker === undefined) {
    snapshot(PARSE_OUTPUTS);
    let r: Run;
    try {
      r = run(['scripts/parse.ts']);
    } finally {
      restore(PARSE_OUTPUTS);
    }
    const first = lines(r).find((l) => l.startsWith('Error:') || l.startsWith('✖')) ?? head(r, 2);
    parseBlocker =
      r.status === 0
        ? null
        : `a CLEAN parse already exits ${r.status ?? `on ${r.signal}`}, so an injected defect ` +
          `cannot reach its own gate: ${first.slice(0, 220)}`;
  }
  return parseBlocker;
};
const all =
  (...checks: (() => string | null)[]) =>
  (): string | null => {
    for (const c of checks) {
      const why = c();
      if (why) return why;
    }
    return null;
  };

// ── injection helpers ───────────────────────────────────────────────────────

/** `true` injected · a string is a NAMED skip (a genuinely absent
 *  precondition) · `false` is anchor drift, which is a FAILURE. */
type Injected = true | false | string;

const steps = (...fns: (() => Injected)[]): Injected => {
  for (const f of fns) {
    const r = f();
    if (r !== true) return r;
  }
  return true;
};

/** Rewrite a raw dump. Absent → a named skip (the dump IS the anchor). */
const withRaw = (name: string, edit: (rows: RawRow[]) => RawRow[] | string): Injected => {
  const absent = needRaw(name);
  if (absent) return absent;
  const rows = readJson<RawRow[]>(`raw/${name}.json`);
  const next = edit(rows);
  if (typeof next === 'string') return next;
  write(`raw/${name}.json`, JSON.stringify(next));
  return true;
};

/** Append one hand-made upload to a raw dump, shaped like the dump's own rows. */
const addRawRow = (name: string, id: string, title: string, publishedAt: string): Injected =>
  withRaw(name, (rows) => {
    const t = rows[0];
    if (!t) return `raw/${name}.json holds no row to copy the shape from`;
    const row: RawRow = { ...t, id, title, publishedAt, durationSec: 448 };
    delete row.viewCount;
    delete row.tags;
    return [...rows, row];
  });

const characterRow = (id: string): { released?: string; exSince?: string } | undefined =>
  readJson<{ id: string; extra?: { released?: string; exSince?: string } }[]>(
    'data/characters.json',
  ).find((c) => c.id === id)?.extra;

const addDays = (iso: string, n: number): string =>
  new Date(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/** The risingReplays freeze pin, whatever it holds today (-1 on this repo). */
const FROZEN_PIN = /(id: 'risingReplays',[\s\S]*?frozen: \{[\s\S]*?records: )(-?\d+)(,)/;
const setPin = (to: (n: number) => number): Injected =>
  subRe('scripts/channels.ts', FROZEN_PIN, (m) => `${m[1]}${to(Number(m[2]))}${m[3]}`);

// ── the patch-check fixture (the vendor feed, as the table says it is) ─────

interface PatchRow {
  version: string;
  start: string;
  url?: string;
  announcedOn: string;
}
interface Post {
  id: string;
  title: string;
  date?: string;
  publishedAt: string;
  category?: string[];
}
let patchTable: PatchRow[] | null = null;
try {
  patchTable = (await import('./seasons')).PATCHES as PatchRow[];
} catch (e) {
  console.error(`  ⚠ scripts/seasons.ts would not import: ${String(e)}`);
}
const newsRows = (): PatchRow[] =>
  (patchTable ?? [])
    .filter((p) => p.announcedOn === 'rising-news')
    .sort((a, b) => a.start.localeCompare(b.start));

/** Both feeds exactly as the table claims them — plus the two NAMED skips and a
 *  version-bearing decoy outside the category, so the clean run exercises the
 *  same classification the real feed does. */
function patchFeed(): { en: Post[]; ja: Post[] } {
  const post = (p: PatchRow, lang: 'en' | 'ja'): Post => ({
    id: (p.url ?? '').split('id=')[1] ?? '',
    title: lang === 'en' ? `Version ${p.version} Patch Notes` : `Ver ${p.version} パッチノート`,
    date: `${p.start}T15:00:00.000Z`,
    publishedAt: `${p.start}T16:30:00.000Z`,
    category: ['patchnotes'],
  });
  const extras = (lang: 'en' | 'ja'): Post[] => [
    {
      id: `bugs-${lang}`,
      title: lang === 'en' ? 'Known Bugs (Updated 2026-09-20)' : '既知の不具合（2026/09/20更新）',
      publishedAt: '2026-09-20T03:00:00.000Z',
      category: ['patchnotes'],
    },
    {
      id: `beta-${lang}`,
      title: lang === 'en' ? 'Post-Second Beta Adjustments' : '製品版におけるβ2からの調整項目',
      publishedAt: '2023-12-08T03:00:00.000Z',
      category: ['patchnotes'],
    },
    {
      id: `decoy-${lang}`,
      title:
        lang === 'en'
          ? 'Beatrix Adjustments Coming to Version 1.42'
          : 'Ver 1.42 ベアトリクス調整のお知らせ',
      publishedAt: '2024-06-10T03:00:00.000Z',
      category: ['news'],
    },
  ];
  return {
    en: [...newsRows().map((p) => post(p, 'en')), ...extras('en')],
    ja: [...newsRows().map((p) => post(p, 'ja')), ...extras('ja')],
  };
}
const runPatchCheck = (edit: (f: { en: Post[]; ja: Post[] }) => void): Run => {
  const feed = patchFeed();
  edit(feed);
  const file = join(scratch('patch-check'), 'feed.json');
  writeFileSync(file, JSON.stringify(feed, null, 2));
  return run(['scripts/patch-check.ts'], { env: { PATCH_CHECK_FIXTURE: file } });
};
const newest = (): PatchRow => newsRows().at(-1)!;
const secondNewest = (): PatchRow => newsRows().at(-2)!;
const havePatchTable = (): Injected =>
  newsRows().length >= 2 ? true : 'scripts/seasons.ts yielded no news-announced patch rows';

// ── the redirect fixtures ───────────────────────────────────────────────────

const setRedirects = (ledger: Record<string, string>, players: string[] | null): Injected => {
  write('data/player-redirects.json', `${JSON.stringify(ledger, null, 2)}\n`);
  if (players) {
    write(
      'data/players.json',
      `${JSON.stringify(
        players.map((id) => ({ id, handle: id })),
        null,
        2,
      )}\n`,
    );
  }
  return true;
};

interface VercelRedirect {
  source: string;
  destination: string;
  permanent: boolean;
}
/** vercel.json in the exact generated form scripts/redirects.ts writes. */
const vercelFor = (ledger: Record<string, string>): string => {
  const cfg = existsSync(abs('vercel.json'))
    ? readJson<{ redirects?: VercelRedirect[]; [k: string]: unknown }>('vercel.json')
    : { $schema: 'https://openapi.vercel.sh/vercel.json', redirects: [] as VercelRedirect[] };
  const manual = (cfg.redirects ?? []).filter((r) => !r.source.startsWith('/gbvsr/players/'));
  const generated = Object.entries(ledger)
    .map(([from, to]) => ({
      source: `/gbvsr/players/${from}`,
      destination: `/gbvsr/players/${to}`,
      permanent: true,
    }))
    .sort((a, b) => a.source.localeCompare(b.source));
  return `${JSON.stringify({ ...cfg, redirects: [...manual, ...generated] }, null, 2)}\n`;
};

/**
 * THE LOST-ROW CASE needs a git baseline that holds a row, and HEAD's ledger is
 * `{}` — so it runs in a throwaway repository under the OS temp dir holding a
 * copy of scripts/redirects.ts (the file under test, injected or not) and a
 * minimal data set. Yesterday (HEAD): gates-old → gates-mid, a live player.
 * Today: gates-mid left the corpus and was redirected on to gates-new. First the
 * fixture proves itself clean (the row kept, retargeted: --drift exits 0); then
 * the row is DROPPED and --drift must name the retarget that would have kept it.
 */
function lostRowRun(): Run {
  const dir = scratch('redirects-git');
  for (const d of ['scripts', 'types', 'data']) mkdirSync(join(dir, d), { recursive: true });
  copyFileSync(abs('scripts/redirects.ts'), join(dir, 'scripts', 'redirects.ts'));
  copyFileSync(abs('types/index.ts'), join(dir, 'types', 'index.ts'));
  copyFileSync(abs('package.json'), join(dir, 'package.json'));
  const put = (ledger: Record<string, string>, players: string[]): void => {
    writeFileSync(
      join(dir, 'data', 'player-redirects.json'),
      `${JSON.stringify(ledger, null, 2)}\n`,
    );
    writeFileSync(
      join(dir, 'data', 'players.json'),
      `${JSON.stringify(
        players.map((id) => ({ id, handle: id })),
        null,
        2,
      )}\n`,
    );
    writeFileSync(join(dir, 'vercel.json'), vercelFor(ledger));
  };
  put({ 'gates-old': 'gates-mid' }, ['gates-mid']);
  git(dir, 'init', '-q');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'yesterday: gates-old redirects to gates-mid');
  const drift = (): Run =>
    run([join(dir, 'scripts', 'redirects.ts'), '--drift'], { cwd: dir, isolateGit: true });
  put({ 'gates-old': 'gates-new', 'gates-mid': 'gates-new' }, ['gates-new']);
  const kept = drift();
  if (kept.status !== 0) {
    throw new Error(
      `the lost-row fixture is not clean with the row KEPT (exit ${kept.status}): ${head(kept)}`,
    );
  }
  put({ 'gates-mid': 'gates-new' }, ['gates-new']);
  return drift();
}

// ── the art fixtures ────────────────────────────────────────────────────────

/** Every sha256 the Fan Kit art is known by: the provenance's recorded hashes
 *  and the committed derivatives' own bytes — while kit art is what ships. */
function kitShas(): Set<string> {
  const out = new Set<string>();
  if (!existsSync(abs('data/art-provenance.json'))) return out;
  const prov = readJson<{ method?: string }>('data/art-provenance.json');
  if (prov.method !== 'fan-kit') return out;
  const visit = (v: unknown): void => {
    if (typeof v === 'string' && /^[0-9a-f]{64}$/.test(v)) out.add(v);
    else if (Array.isArray(v)) v.forEach(visit);
    else if (v && typeof v === 'object') Object.values(v).forEach(visit);
  };
  visit(prov);
  for (const d of ['public/img/char', 'public/img/splash'])
    for (const f of walk(abs(d))) out.add(sha256(readFileSync(f)));
  return out;
}

function judgeGeneratedArt(out: string): [boolean, string] {
  const roster = readJson<unknown[]>('data/characters.json').length;
  const webp = (d: string): number =>
    existsSync(join(out, d))
      ? readdirSync(join(out, d)).filter((f) => f.endsWith('.webp')).length
      : 0;
  const portraits = webp('public/img/char');
  const splashes = webp('public/img/splash');
  const provFile = join(out, 'data', 'art-provenance.json');
  const method = existsSync(provFile)
    ? (JSON.parse(readFileSync(provFile, 'utf8')) as { method?: string }).method
    : 'absent';
  const kit = kitShas();
  const produced = walk(out);
  const clash = produced.filter((f) => kit.has(sha256(readFileSync(f))));
  const detail =
    `${portraits} portraits + ${splashes} splashes for ${roster} fighters, provenance method ` +
    `"${method}", ${produced.length} output file(s) checked against ${kit.size} Fan Kit sha256(s): ` +
    `${clash.length} match`;
  const ok =
    portraits === roster && splashes === roster && method === 'generated' && clash.length === 0;
  return [
    ok,
    ok
      ? detail
      : `${detail}${clash.length ? ` — a kit derivative SURVIVED: ${clash.map((f) => relative(out, f)).join(', ')}` : ''}`,
  ];
}

const emptyDir = (dir: string): string | null => {
  const files = walk(dir);
  return files.length === 0
    ? null
    : `${files.length} file(s) were written into ${dir} — the refusal came AFTER the downloads ` +
        `(${files
          .slice(0, 3)
          .map((f) => relative(dir, f))
          .join(', ')})`;
};

// ── controls ────────────────────────────────────────────────────────────────

interface Control {
  /** What the gate protects, phrased as the failure it refuses. */
  name: string;
  /** Files this control edits; each is snapshotted and restored byte-exactly
   *  (or unlinked, if it did not exist). */
  files: string[];
  /** Apply the defect. */
  inject: () => Injected;
  /** One of: a probe case, a tsx command (relative to the repo), or a custom
   *  runner. */
  probe?: ProbeCase;
  cmd?: string[] | (() => string[]);
  exec?: () => Run;
  cwd?: () => string;
  /** The rule the run must NAME (fail-kind controls). */
  names?: RegExp | (() => RegExp);
  /** Anything that must be true before the command can be judged. The
   *  control's ANCHOR is still audited when it is not. */
  precondition?: () => string | null;
  /** Reads the vendor's own site. Never YouTube. Skipped by --offline. */
  network?: boolean;
  /** A post-condition on what the failing run left behind. */
  after?: () => string | null;
  /** A REPORT-ONLY rule: exit 0 and the judge finds the refusal; then the
   *  disarmed twin removes the rule and the judge must notice. */
  report?: {
    judge: () => [boolean, string];
    disarm: {
      file: string;
      from: string;
      to: string;
      names?: RegExp;
      /** Further edits the twin needs when the rule has a backstop. */
      also?: { file: string; from: string; to: string }[];
    };
  };
}

const NETWORK_DOWN =
  /fetch failed|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|ECONNRESET|ETIMEDOUT|UND_ERR|HTTP 5\d\d|HTTP 429/;

// Per-control scratch, shared by a control's cmd() and its after().
const outDirs = new Map<string, string>();
const outDir = (key: string): string => {
  const d = outDirs.get(key) ?? scratch(key);
  outDirs.set(key, d);
  return d;
};

const probeRows = (): Map<string, Rec> => new Map((committed() ?? []).map((r) => [r.id, r]));

// Values a control's inject() computes for its judge.
let departed = '';
let twinOf = '';

const CONTROLS: Control[] = [
  // ── the patch table (scripts/seasons.ts --check) ─────────────────────────
  {
    name: 'patches: two rows share a start date (the CMS error that mis-filed 950 records on CotW)',
    files: ['scripts/seasons.ts'],
    cmd: ['scripts/seasons.ts', '--check'],
    names: /2\.51 and 2\.50 share start 2026-02-08/,
    inject: () =>
      sub(
        'scripts/seasons.ts',
        "{ version: '2.51', start: '2026-03-16',",
        "{ version: '2.51', start: '2026-02-08',",
      ),
  },
  {
    name: 'patches: a future-dated row (a typo year mints an empty window and asserts clean)',
    files: ['scripts/seasons.ts'],
    cmd: ['scripts/seasons.ts', '--check'],
    names: /2\.60: starts 2027-09-15, in the future/,
    inject: () =>
      sub(
        'scripts/seasons.ts',
        "    version: '2.60',\n    start: '2026-09-15',",
        "    version: '2.60',\n    start: '2027-09-15',",
      ),
  },
  {
    name: 'patches: the newest era is closed (Season 2 stops collecting records)',
    files: ['scripts/seasons.ts'],
    cmd: ['scripts/seasons.ts', '--check'],
    names: /exactly one era may be open, and it must be the newest/,
    inject: () =>
      sub(
        'scripts/seasons.ts',
        "    start: '2025-02-24',\n    end: null,",
        "    start: '2025-02-24',\n    end: '2026-09-20',",
      ),
  },
  {
    // The measured-cadence rule, executable: this table already holds a 183-day
    // gap (2.51 → 2.60), so an alarm at or below it is red for a vendor doing
    // nothing wrong.
    name: 'patches: STALE_PATCH_DAYS is set below the table’s own widest gap (183 d)',
    files: ['scripts/seasons.ts'],
    cmd: ['scripts/seasons.ts', '--check'],
    names: /STALE_PATCH_DAYS 180 is not above the widest real gap \(183 d\)/,
    inject: () =>
      sub(
        'scripts/seasons.ts',
        'export const STALE_PATCH_DAYS = 190;',
        'export const STALE_PATCH_DAYS = 180;',
      ),
  },
  {
    // The era authority is the vendor's sentence; the version major is the
    // CROSS-CHECK that catches the season boundary transcribed on the wrong row.
    name: 'patches: the Season 2 boundary is transcribed one row early (the era/major cross-check)',
    files: ['scripts/seasons.ts'],
    cmd: ['scripts/seasons.ts', '--check'],
    names: /1\.62 sits in S2, whose version major is 2/,
    inject: () =>
      steps(
        () => sub('scripts/seasons.ts', "    end: '2025-02-24',", "    end: '2024-11-20',"),
        () =>
          sub(
            'scripts/seasons.ts',
            "    start: '2025-02-24',\n    end: null,",
            "    start: '2024-11-20',\n    end: null,",
          ),
      ),
  },

  // ── the roster (scripts/characters.ts) ───────────────────────────────────
  {
    name: 'roster: a BANNED alias is re-added ("Avatar" — half of Avatar Belial, and another game)',
    files: ['data/characters.json', 'scripts/characters.ts'],
    cmd: ['scripts/characters.ts'],
    names: /"avatar" is BANNED but avatar-belial claims it/,
    inject: () =>
      sub(
        'scripts/characters.ts',
        "base('avatar-belial', 'Avatar Belial', 'アバタール・ベリアル'),",
        "base('avatar-belial', 'Avatar Belial', 'アバタール・ベリアル', ['Avatar']),",
      ),
  },
  {
    name: 'roster: two fighters claim one alias (the matcher then resolves a coin flip)',
    files: ['data/characters.json', 'scripts/characters.ts'],
    cmd: ['scripts/characters.ts'],
    names: /alias "Gran" claimed by gran and djeeta/,
    inject: () =>
      sub(
        'scripts/characters.ts',
        "{ ...base('djeeta', 'Djeeta', 'ジータ'), exSince: EX_PATCH },",
        "{ ...base('djeeta', 'Djeeta', 'ジータ', ['Gran']), exSince: EX_PATCH },",
      ),
  },
  {
    name: 'roster: EX mode declared on a fourth fighter (Ver 2.20 gave it to three)',
    files: ['data/characters.json', 'scripts/characters.ts'],
    cmd: ['scripts/characters.ts'],
    names:
      /EX mode is Gran, Djeeta and Narmaya only \(Ver 2\.20\); ROSTER marks djeeta, gran, narmaya, zeta/,
    inject: () =>
      sub(
        'scripts/characters.ts',
        "  base('zeta', 'Zeta', 'ゼタ'),",
        "  { ...base('zeta', 'Zeta', 'ゼタ'), exSince: EX_PATCH },",
      ),
  },
  {
    name: 'roster: an accent below the 4.5:1 AA floor on the #171933 card surface',
    files: ['data/characters.json', 'design/handoff/tokens.css'],
    cmd: ['scripts/characters.ts'],
    names: /percival: accent #5A2A2C is [0-9.]+:1 on #171933/,
    inject: () =>
      sub('design/handoff/tokens.css', '--char-percival: #EF656B;', '--char-percival: #5A2A2C;'),
  },
  {
    name: 'roster: a fighter with no --char-* design token',
    files: ['data/characters.json', 'design/handoff/tokens.css'],
    cmd: ['scripts/characters.ts'],
    names: /percival: no --char-percival in tokens\.css/,
    inject: () => sub('design/handoff/tokens.css', '--char-percival:', '--char-percivalx:'),
  },
  {
    // Checklist 5v: the two-letter alias keeps the STRICT guard, or `IDカード`
    // (ID card) reads as the fighter Id. The roster build's own matcher
    // controls are the gate; this breaks the matcher and requires them to say so.
    name: 'roster: a matcher control breaks (Id loses the two-letter guard — "IDカード" reads as Id)',
    files: ['data/characters.json', 'scripts/roster.ts'],
    cmd: ['scripts/characters.ts'],
    names: /matcher: "IDカード" → \[id\], expected \[\]/,
    inject: () =>
      sub(
        'scripts/roster.ts',
        'if (letters.length <= 2) return',
        'if (letters.length <= 0) return',
      ),
  },

  // ── this game's own rules, through the exported API (the probe) ──────────
  {
    name: 'probe: the release floor is disarmed in the index builder — Id appears before she shipped',
    files: ['scripts/parse-finish.ts'],
    probe: 'id-release-floor',
    names: /THE RELEASE FLOOR \(index\) — a row naming Id on \d{4}-\d{2}-\d{2}, before she shipped/,
    inject: () =>
      sub(
        'scripts/parse-finish.ts',
        '(id) => day < ((charById.get(id)?.extra?.released as string | undefined) ?? ctx.floor),',
        "(id) => id === '__gates_never__',",
      ),
  },
  {
    // Longest-first alternation and non-overlapping scanning are what make
    // avatar-belial absorb its inner belial. A scan that resumes one character
    // after each match — overlap suppression lost — reads both.
    name: 'probe: span selection loses overlap suppression — "Avatar Belial" also reads Belial',
    files: ['scripts/roster.ts'],
    probe: 'nesting',
    names: /THE NESTED NAME \(checklist 5c\)/,
    inject: () =>
      sub(
        'scripts/roster.ts',
        '      if (m[0].length === 0) RE.lastIndex += 1;',
        '      RE.lastIndex = m.index + 1;',
      ),
  },
  {
    name: 'probe: the marker is widened to bare GBVS — the previous game’s 3,000 uploads walk in',
    files: ['scripts/channels.ts'],
    probe: 'marker',
    names: /THE MARKER IS GBVSR, NEVER BARE GBVS \(checklist 3c\)/,
    inject: () =>
      sub(
        'scripts/channels.ts',
        '(?<![A-Za-z])GBVS\\s*R(?![A-Za-z])|',
        '(?<![A-Za-z])GBVS\\s*R?(?![A-Za-z])|',
      ),
  },
  {
    name: 'probe: the Rising PRE-GATE is disarmed — 2021 catalogue rows go to hydration',
    files: ['scripts/fetch-theater.ts'],
    probe: 'rising-gate',
    names: /THE RISING PRE-GATE \(checklist 12l\)/,
    inject: () =>
      sub(
        'scripts/fetch-theater.ts',
        '  return m[1]! < shiftDay(admitFrom, -PRE_GATE_SLACK_DAYS);',
        "  return m[1]! < '0000-00-00';",
      ),
  },
  {
    name: 'probe: the Rising CONFIRM is disarmed — a 2021 video is admitted on its label alone',
    files: ['scripts/fetch-theater.ts'],
    probe: 'rising-gate',
    names: /THE RISING CONFIRM \(checklist 12l\)/,
    inject: () =>
      sub(
        'scripts/fetch-theater.ts',
        '  publishedAt.slice(0, 10) >= admitFrom;',
        "  publishedAt.slice(0, 10) >= '0000-00-00';",
      ),
  },
  {
    name: 'probe: the index builder’s date floor is disarmed — a 2021 row in the dump mints',
    files: ['scripts/parse-finish.ts'],
    probe: 'rising-gate',
    names: /THE BUILDER'S DATE FLOOR/,
    inject: () =>
      sub('scripts/parse-finish.ts', '    if (day < ctx.floor) {', "    if (day < '0000-00-00') {"),
  },
  {
    // 12k: the catalogue writes the fullwidth `FT５`; without the fold it is an
    // event chip naming a tournament that does not exist.
    name: 'probe: the format-tag test loses its normalisation — the fullwidth FT５ becomes an event',
    files: ['scripts/fetch-theater.ts'],
    probe: 'format-tag',
    names: /A SET FORMAT IS NEVER AN EVENT \(checklist 12k\)/,
    inject: () =>
      sub(
        'scripts/fetch-theater.ts',
        'FORMAT_TAG.test(normalizeText(tag));',
        'FORMAT_TAG.test(tag);',
      ),
  },
  {
    name: 'probe: the format-tag test loses its anchors — "Top 8 FT3" stops being an event',
    files: ['scripts/fetch-theater.ts'],
    probe: 'format-tag',
    names: /AN EVENT IS NEVER A SET FORMAT/,
    inject: () =>
      sub(
        'scripts/fetch-theater.ts',
        'export const FORMAT_TAG = /^(?:FT|BO|first\\s*to|best\\s*of)\\s*\\d+$/i;',
        'export const FORMAT_TAG = /(?:FT|BO|first\\s*to|best\\s*of)\\s*\\d+/i;',
      ),
  },
  {
    name: 'probe: the title parser writes `ex: []` on an unmarked side (an "is base" claim)',
    files: ['scripts/parse.ts'],
    probe: 'ex-title',
    names: /AN UNMARKED SIDE CARRIES NO ex KEY — positive evidence only/,
    inject: () =>
      sub('scripts/parse.ts', '...(ex.length ? { ex } : {}), ...(skins', 'ex, ...(skins'),
  },
  {
    name: 'probe: a stray EX anywhere before the fighter marks it (the token loses its adjacency)',
    files: ['scripts/roster.ts'],
    probe: 'ex-title',
    names: /A STRAY EX IS NOT A MARK/,
    inject: () =>
      sub(
        'scripts/roster.ts',
        'const EX_BEFORE = /(?<![\\p{L}\\p{N}])EX\\s*$/iu;',
        'const EX_BEFORE = /(?<![\\p{L}\\p{N}])EX\\s*/iu;',
      ),
  },
  {
    name: 'probe: the index builder drops the exSince DATE check — "Gran (EX)" marks before Ver 2.20',
    files: ['scripts/parse-finish.ts'],
    probe: 'ex-theater',
    names: /EX BEFORE Ver 2\.20 IS RESIDUE, NEVER A MARK/,
    inject: () => sub('scripts/parse-finish.ts', 'if (since && day >= since) {', 'if (since) {'),
  },
  {
    name: 'probe: the index builder allows EX on ANY fighter — "Zeta (EX)" becomes a mark',
    files: ['scripts/parse-finish.ts'],
    probe: 'ex-theater',
    names: /EX ON A FIGHTER WITH NO EX MODE IS RESIDUE, NEVER A MARK/,
    inject: () =>
      sub(
        'scripts/parse-finish.ts',
        'if (since && day >= since) {',
        'if (!since || day >= since) {',
      ),
  },
  {
    name: 'probe: the index builder writes `ex: []` on an unmarked side',
    files: ['scripts/parse-finish.ts'],
    probe: 'ex-theater',
    names: /AN UNMARKED SIDE CARRIES NO ex KEY \(index\)/,
    inject: () =>
      sub(
        'scripts/parse-finish.ts',
        '        ...(ex.length ? { ex } : {}),\n        provenance: {',
        '        ex,\n        provenance: {',
      ),
  },
  {
    // 12n: Avatar's e2e caught a `vid@0` record that lost `startSeconds: 0` to a
    // truthiness test — the id said segment, the fields said whole video.
    name: 'probe: the builder reverts to a TRUTHINESS test on startSeconds — `vid@0` loses its start',
    files: ['scripts/parse-finish.ts'],
    probe: 'segment',
    names: /A t=0 SEGMENT KEEPS videoId AND startSeconds: 0 THROUGH THE BUILDER \(checklist 12n\)/,
    inject: () =>
      sub(
        'scripts/parse-finish.ts',
        '...(r.startSeconds !== undefined && r.id !== r.videoId',
        '...(r.startSeconds && r.id !== r.videoId',
      ),
  },
  {
    name: 'probe: Strive’s `secs > 0` rule returns — a t=0 row in a multi-row VOD stands for the whole VOD',
    files: ['scripts/fetch-theater.ts'],
    probe: 'segment',
    names: /A t=0 ROW INSIDE A MULTI-ROW VOD IS A SEGMENT \(checklist 12k\)/,
    inject: () =>
      sub(
        'scripts/fetch-theater.ts',
        '  if (rowsForVideo > 1) return true;',
        '  if (rowsForVideo > 1) return startSeconds > 0;',
      ),
  },
  {
    name: 'probe: the intro-skip floor is removed — a 5-second skip mints a segment id',
    files: ['scripts/fetch-theater.ts'],
    probe: 'segment',
    names: /AN INTRO-SKIP OFFSET ON A SINGLE-ROW VIDEO IS NOT A SEGMENT \(checklist 12k\)/,
    inject: () =>
      sub(
        'scripts/fetch-theater.ts',
        '  return startSeconds / durationSec >= minShare;',
        '  return true;',
      ),
  },
  {
    // Avatar declared this one a gap (its offset reader was not exported);
    // here it is, so it is live.
    name: 'probe: the offset reader falls back to seconds-only — `1h11m20s` is dropped as a bad link',
    files: ['scripts/fetch-theater.ts'],
    probe: 'segment',
    names: /AN h\/m\/s OFFSET IS READ, NEVER DROPPED AS A BAD LINK \(checklist 12k\)/,
    inject: () =>
      sub(
        'scripts/fetch-theater.ts',
        '  const m = START_HMS.exec(v);',
        '  const m = START_SECONDS.exec(v) ? START_HMS.exec(v) : null;',
      ),
  },
  {
    // Measured as on Avatar: the space class proves nothing (playerId's own NFKD
    // folds U+00A0, U+3000 and fullwidth anyway). The zero-width class is the
    // one only normalizeText removes, so it is the one that discriminates.
    name: 'probe: NORMALISATION IS IDENTITY — the zero-width fold is removed and a second player is minted',
    files: ['scripts/roster.ts'],
    probe: 'identity',
    names: /NORMALISATION IS IDENTITY — the zero-width class \(checklist 5l\)/,
    inject: () => sub('scripts/roster.ts', "    .replace(ZERO_WIDTH, '')\n", ''),
  },
  {
    name: 'probe: the one-symbol exemption is removed and the placeholder rule deletes the ♱ player',
    files: ['scripts/crosscheck.ts'],
    probe: 'placeholder',
    names: /THE SYMBOL HANDLE \(checklist 12k\)/,
    inject: () =>
      sub('scripts/crosscheck.ts', '/^(?!\\p{So}\\p{Variation_Selector}?$)(?:', '/^(?:'),
  },
  {
    name: 'probe: the gbvsReplayChannel house phrase is no longer stripped — "High Level Gameplay Zira" is a player',
    files: ['scripts/parse.ts'],
    probe: 'slot-order',
    names: /THE BARE GRAMMAR \(gbvsReplayChannel/,
    inject: () =>
      sub(
        'scripts/parse.ts',
        '(?:High\\s*(?:Level\\s*)?(?:Game\\s*play\\s*)?|Game\\s*play\\s*)?',
        '',
      ),
  },
  {
    name: 'probe: the 5w branch is reverted — "UNO Ferry" reads as two fighters and no player',
    files: ['scripts/parse.ts'],
    probe: 'slot-order',
    names: /A CONFIRMED FIGHTER-NAMED PLAYER ON A BARE SIDE \(checklist 5w\)/,
    inject: () =>
      sub(
        'scripts/parse.ts',
        "  if (declared === 'handle-first-bare' && spans.length === 2 && ids.length === 2) {",
        '  if (false as boolean) {',
      ),
  },
  {
    name: 'probe: the 5w branch becomes a heuristic — the real counter-pick "Lanslot Six" mints a player',
    files: ['scripts/parse.ts'],
    probe: 'slot-order',
    names: /ONLY THE EVIDENCED LIST UNLOCKS IT/,
    inject: () =>
      sub(
        'scripts/parse.ts',
        '    if (!gaps.handle && CONFIRMED_IDS.has(playerId(first.literal))) {',
        '    if (!gaps.handle) {',
      ),
  },
  {
    name: 'probe: a skin leaves SKIN_NAMES — "B.Butterfly" is neither stripped nor counted',
    files: ['scripts/roster.ts'],
    probe: 'skins',
    names: /A SKIN INSIDE THE FIGHTER PAREN IS STRIPPED AND COUNTED/,
    inject: () => sub('scripts/roster.ts', "  'B.Butterfly',\n", ''),
  },
  {
    // SF6, 2026-09-18: a deleted channel's 404 reached the top-level await and
    // the cron stayed red for six days with the healthy channels unrefreshed.
    // The defect is exactly that: the per-channel catch rethrows.
    name: 'probe: the per-channel catch is removed — one 404 playlist kills the whole fetch (7c, stubbed API)',
    files: ['scripts/fetch.ts'],
    probe: 'dead-channel',
    names: /A DEAD CHANNEL FAILS ALONE \(checklist 7c\)/,
    inject: () =>
      sub(
        'scripts/fetch.ts',
        '    } catch (err) {\n      if (err instanceof QuotaRefusal) {',
        '    } catch (err) {\n      throw err;\n      if (err instanceof QuotaRefusal) {',
      ),
  },
  {
    name: 'probe: the dominant channel’s silence alarm is raised to 30 days — an 8-day silence goes unseen',
    files: ['scripts/channels.ts'],
    probe: 'dormancy',
    names: /THE DOMINANT CHANNEL SILENCE ALARM/,
    inject: () =>
      sub('scripts/channels.ts', '    silenceAlarmDays: 7,', '    silenceAlarmDays: 30,'),
  },
  {
    name: 'probe: the frozen-channel review cadence is stretched to 900 days',
    files: ['scripts/expiries.ts'],
    probe: 'dormancy',
    names: /THE FROZEN-CHANNEL WATCH IS QUARTERLY/,
    inject: () =>
      sub(
        'scripts/expiries.ts',
        'export const FROZEN_REVIEW_DAYS = 90;',
        'export const FROZEN_REVIEW_DAYS = 900;',
      ),
  },
  {
    name: 'probe: the Fan Kit licence re-read cadence is stretched to 900 days (Article 3 is revocable)',
    files: ['scripts/expiries.ts'],
    probe: 'dormancy',
    names: /THE FAN KIT LICENCE RE-READ IS QUARTERLY/,
    inject: () =>
      sub(
        'scripts/expiries.ts',
        'export const LICENCE_REVIEW_DAYS = 90;',
        'export const LICENCE_REVIEW_DAYS = 900;',
      ),
  },
  {
    name: 'probe: the cursor delta keeps the cursor entry itself (`>` becomes `>=`)',
    files: ['scripts/theater-delta.ts'],
    probe: 'cursor-delta',
    names: /THE CURSOR DELTA HOLDS ONLY WHAT IS NEWER THAN THE CURSOR/,
    inject: () => sub('scripts/theater-delta.ts', 'e.id > cursorAt', 'e.id >= cursorAt'),
  },
  {
    // Checklist 5d: a swapped face ships a plausible substitute with no error.
    // The Bold cut copied over the Black is exactly that substitute. Driven
    // through renderOgCard into the temp dir, so public/og-default.png is never
    // rewritten.
    name: 'probe: a committed display TTF is swapped for its sibling cut (the card ships a substitute)',
    files: ['design/fonts/CinzelDecorative-Black.ttf'],
    probe: 'og-fonts',
    names: /does not hold the faces this card was designed on/,
    inject: () => {
      const black = 'design/fonts/CinzelDecorative-Black.ttf';
      const bold = 'design/fonts/CinzelDecorative-Bold.ttf';
      if (!existsSync(abs(black)) || !existsSync(abs(bold))) return false;
      write(black, readFileSync(abs(bold)));
      return true;
    },
  },

  // ── the vendor patch feed, offline (scripts/patch-check.ts) ──────────────
  {
    name: 'patch-check: a `patchnotes` post that is neither a version nor a named skip',
    files: [],
    exec: () =>
      runPatchCheck((f) =>
        f.en.push({
          id: 'gatesx1',
          title: 'Emergency Balance Notes',
          publishedAt: '2026-09-25T03:00:00.000Z',
          category: ['patchnotes'],
        }),
      ),
    names:
      /en: patchnotes post "Emergency Balance Notes" \(gatesx1\) is neither a version nor a named skip[\s\S]*patch-check: UNREADABLE/,
    inject: havePatchTable,
  },
  {
    name: 'patch-check: the EN and JA feeds disagree on the version set',
    files: [],
    exec: () =>
      runPatchCheck((f) => {
        f.ja = f.ja.filter((p) => p.title !== `Ver ${newest().version} パッチノート`);
      }),
    names: () =>
      new RegExp(
        `${esc(newest().version)} is in news_en and not news_ja[\\s\\S]*patch-check: UNREADABLE`,
      ),
    inject: havePatchTable,
  },
  {
    name: 'patch-check: one version posted twice',
    files: [],
    exec: () =>
      runPatchCheck((f) => {
        const twin = f.en.find((p) => p.title === `Version ${secondNewest().version} Patch Notes`);
        if (twin) f.en.push({ ...twin, id: 'gatesdup' });
      }),
    names: () =>
      new RegExp(
        `en: version ${esc(secondNewest().version)} posted twice[\\s\\S]*patch-check: UNREADABLE`,
      ),
    inject: havePatchTable,
  },
  {
    name: 'patch-check: the vendor’s earliest statement moves a day and the table does not (DRIFT)',
    files: [],
    exec: () =>
      runPatchCheck((f) => {
        const v = newest().version;
        const next = addDays(newest().start, 1);
        for (const p of [...f.en, ...f.ja]) {
          if (p.title === `Version ${v} Patch Notes` || p.title === `Ver ${v} パッチノート`) {
            p.date = `${next}T15:00:00.000Z`;
            p.publishedAt = `${next}T16:30:00.000Z`;
          }
        }
      }),
    names: () =>
      new RegExp(
        `START\\s+${esc(newest().version)}: table ${newest().start}, vendor's earliest statement ` +
          `${addDays(newest().start, 1)}[\\s\\S]*patch-check: DRIFT`,
      ),
    inject: havePatchTable,
  },

  // ── player redirects (scripts/redirects.ts --drift) ──────────────────────
  {
    name: 'redirects: a row whose destination is not a live player (a 404 wearing a 301)',
    files: ['data/player-redirects.json', 'data/players.json', 'vercel.json'],
    cmd: ['scripts/redirects.ts', '--drift'],
    names: /gates-nowhere is not a player, so this redirect would land on a 404/,
    inject: () => setRedirects({ 'gates-old': 'gates-nowhere' }, []),
  },
  {
    // Tōkon and Tekken shipped live 404s because vercel.json was regenerated by
    // hand and fell behind the ledger.
    name: 'redirects: vercel.json falls behind the ledger (the rule the ledger asks for is missing)',
    files: ['data/player-redirects.json', 'data/players.json', 'vercel.json'],
    cmd: ['scripts/redirects.ts', '--drift'],
    names: /vercel\.json is missing\s+\/gbvsr\/players\/gates-old → \/gbvsr\/players\/gates-new/,
    inject: () => setRedirects({ 'gates-old': 'gates-new' }, ['gates-new']),
  },
  {
    name: 'redirects: a row whose source is still a live player (a real profile sent away)',
    files: ['data/player-redirects.json', 'data/players.json', 'vercel.json'],
    cmd: ['scripts/redirects.ts', '--drift'],
    names: /gates-old is a live player, so this redirect would send its profile away/,
    inject: () =>
      steps(
        () => setRedirects({ 'gates-old': 'gates-new' }, ['gates-old', 'gates-new']),
        () => {
          write('vercel.json', vercelFor({ 'gates-old': 'gates-new' }));
          return true;
        },
      ),
  },
  {
    name: 'redirects: a row in the git baseline is dropped from the ledger (a temp repo; the retarget is named)',
    files: [],
    exec: lostRowRun,
    names:
      /left data\/player-redirects\.json and took a live redirect with them[\s\S]*put the row back retargeted: "gates-old": "gates-new"/,
    inject: () => (occurrences('scripts/redirects.ts', 'function lostRows()') === 1 ? true : false),
  },

  // ── art: the revocation path and the licence (scripts/art.ts) ────────────
  {
    // The default mode DOWNLOADS, so a mistyped mode must never fall through to
    // it. Run offline: if the refusal ever broke, the fetch preload would stop
    // the download, and the empty-dir check would still say so.
    name: 'art: a mistyped mode (`--generate`) is refused before anything runs',
    files: [],
    cmd: () => [abs('scripts/art.ts'), '--generate', `--out=${outDir('art-flag')}`],
    cwd: work,
    names: /unknown argument\(s\) --generate /,
    after: () => emptyDir(outDir('art-flag')),
    inject: () => (occurrences('scripts/art.ts', 'const UNKNOWN_ARGS =') === 1 ? true : false),
  },
  {
    // The run re-reads the terms FIRST: every Article 1–3 sentence must appear
    // verbatim on the live page. A sentence the page no longer states is what a
    // changed licence looks like from here, and the run must stop BEFORE any
    // download — which the empty scratch root proves.
    name: 'art: the Fan Kit terms change (a required sentence is no longer on the page) — nothing downloads',
    files: ['scripts/art.ts'],
    network: true,
    cmd: () => [abs('scripts/art.ts'), `--out=${outDir('art-licence')}`],
    cwd: work,
    names:
      /no longer state, verbatim[\s\S]*The following acts are prohibited, and so is this sentence[\s\S]*REFUSING to download anything/,
    after: () => emptyDir(outDir('art-licence')),
    inject: () =>
      sub(
        'scripts/art.ts',
        "        'The following acts are prohibited:',",
        "        'The following acts are prohibited, and so is this sentence:',",
      ),
  },

  // ── the parse pipeline, end to end (scripts/parse.ts + parse-finish.ts) ──
  {
    // Upstream of the freeze pin: readCommitted runs before any channel is
    // read, so this control is live on an empty corpus.
    name: 'parse: an unreadable videos.json is a hard stop, never "treat it as empty"',
    files: ['data/videos.json'],
    cmd: ['scripts/parse.ts'],
    names: /data\/videos\.json exists but will not parse — refusing to treat it as empty/,
    inject: () => {
      write('data/videos.json', '{ this is not json');
      return true;
    },
  },
  {
    // Upstream of the freeze pin too: the dominant channel is read first.
    name: 'parse: an empty raw dump is refused outright (never read as "a quiet day")',
    files: ['raw/highLevelReplays.json', ...PARSE_OUTPUTS],
    cmd: ['scripts/parse.ts'],
    names: /raw\/highLevelReplays\.json is empty — refusing to parse/,
    inject: () => {
      write('raw/highLevelReplays.json', '[]');
      return true;
    },
  },
  {
    // Upstream of the freeze pin as well: the index carry is step 1. With no
    // pull (no dump), the committed catalogue is carried against its pin, and a
    // count that moved on its own is a poisoned carry.
    name: 'parse: THE INDEX CARRY — the Replay Theater pin disagrees with the committed records',
    files: ['raw/replayTheater.json', 'raw/.replayTheater.stats.json', ...PARSE_OUTPUTS],
    cmd: ['scripts/parse.ts'],
    names: /Replay Theater carry expected \d+ committed records, found \d+/,
    inject: () => {
      for (const f of ['raw/replayTheater.json', 'raw/.replayTheater.stats.json'])
        if (existsSync(abs(f))) unlinkSync(abs(f));
      const carried = (committed() ?? []).filter((v) => v.intake === 'replayTheater').length;
      write(
        'data/source-pins.json',
        `${JSON.stringify({ replayTheater: carried + 5 }, null, 2)}\n`,
      );
      return true;
    },
  },
  {
    name: 'parse: THE ADD-ONLY RATCHET — a Replay Theater rebuild falls below its pin',
    files: ['data/source-pins.json', ...PARSE_OUTPUTS],
    cmd: ['scripts/parse.ts'],
    names: /Replay Theater built \d+ records but the pin says \d+/,
    precondition: all(() => needRaw('replayTheater'), needCleanParse),
    inject: () => {
      const pins = existsSync(abs('data/source-pins.json'))
        ? readJson<Record<string, number>>('data/source-pins.json')
        : {};
      pins.replayTheater = (pins.replayTheater ?? 0) + 100_000;
      write('data/source-pins.json', `${JSON.stringify(pins, null, 2)}\n`);
      return true;
    },
  },
  {
    // The sentinel: an unseeded freeze must never ship an empty channel that
    // looks like a working one. On this repo the pin already IS -1 — which is
    // exactly why every downstream control waits.
    name: 'parse: THE FROZEN PIN, UNSEEDED — `records: -1` refuses the parse',
    files: ['scripts/channels.ts', ...PARSE_OUTPUTS],
    cmd: ['scripts/parse.ts'],
    names: /risingReplays is frozen with the placeholder pin -1/,
    precondition: needCleanParse,
    inject: () => setPin(() => -1),
  },
  {
    // The production path: no frozen dump, the committed records carried.
    // Editing the pin IS the deliberate-prune mechanism; a mismatch nobody
    // edited means the archive moved on its own.
    name: 'parse: THE FROZEN PIN — risingReplays is carried against a count nobody edited',
    files: ['scripts/channels.ts', 'raw/risingReplays.json', ...PARSE_OUTPUTS],
    cmd: ['scripts/parse.ts'],
    names: /risingReplays is frozen at \d+ records but the committed file holds \d+/,
    precondition: all(needCorpus, needCleanParse),
    inject: () =>
      steps(
        () => setPin((n) => (n < 0 ? 7 : n + 7)),
        () => {
          if (existsSync(abs('raw/risingReplays.json'))) unlinkSync(abs('raw/risingReplays.json'));
          return true;
        },
      ),
  },
  {
    // The seeding path: a frozen dump is present and parses to a count the pin
    // does not hold.
    name: 'parse: THE FROZEN PIN — a frozen dump parses to a count the pin does not hold',
    files: ['scripts/channels.ts', ...PARSE_OUTPUTS],
    cmd: ['scripts/parse.ts'],
    names: /risingReplays is frozen at \d+ records but its dump parsed to \d+/,
    precondition: all(() => needRaw('risingReplays'), needCleanParse),
    inject: () => setPin((n) => (n < 0 ? 7 : n + 7)),
  },
  {
    // Awake on day one for the dominant channel (10% of ~8,800 is ~880). The
    // rows go from the OLD end, keeping the newest, or the run dies in the
    // stale-raw guard instead and proves nothing about collapses.
    name: 'parse: the COLLAPSE GUARD — the dominant channel loses >10% AND >20 records',
    files: ['raw/highLevelReplays.json', ...PARSE_OUTPUTS],
    cmd: ['scripts/parse.ts'],
    names: /COLLAPSE GUARD: 1 intake\(s\) lost[\s\S]*highLevelReplays: \d+ → \d+/,
    precondition: all(() => needRaw('highLevelReplays'), needCorpus, needCleanParse),
    inject: () =>
      withRaw('highLevelReplays', (rows) => {
        if (rows.length < 60) return `raw/highLevelReplays.json holds only ${rows.length} row(s)`;
        const oldestFirst = [...rows].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
        const drop = new Set(oldestFirst.slice(0, Math.floor(rows.length * 0.4)));
        return rows.filter((r) => !drop.has(r));
      }),
  },
  {
    // Checklist 10c: the guard reads ONLY DATA. A dump cannot contain an upload
    // published after it was taken, so a committed record newer than anything
    // in the dump proves the dump is stale — whatever the mtimes say.
    name: 'parse: the DATA-ONLY stale-raw guard (the dump predates a committed record)',
    files: ['raw/highLevelReplays.json', ...PARSE_OUTPUTS],
    cmd: ['scripts/parse.ts'],
    names: /raw\/highLevelReplays\.json is stale/,
    precondition: all(() => needRaw('highLevelReplays'), needCorpus, needCleanParse),
    inject: () =>
      withRaw('highLevelReplays', (rows) =>
        rows.map((r) => ({
          ...r,
          publishedAt: `${Number(r.publishedAt.slice(0, 4)) - 1}${r.publishedAt.slice(4)}`,
        })),
      ),
  },
  {
    // Checklist 5n. The first player the registry builds is given a fighter's
    // name as its display handle: a fighter filed as a person, which is what 67
    // titles did on Strive's recon. Data-independent: whoever sorts first.
    name: 'parse: THE REGISTRY INVARIANT — a player handle that is a fighter, with no allow-list row',
    files: ['scripts/parse-finish.ts', ...PARSE_OUTPUTS],
    cmd: ['scripts/parse.ts'],
    names:
      /REGISTRY INVARIANT: 1 player handle\(s\) resolve to a roster character[\s\S]*"Seox" → seox/,
    precondition: needCleanParse,
    inject: () =>
      steps(
        () =>
          sub(
            'scripts/parse-finish.ts',
            '  let multiSpelling = 0;',
            '  let multiSpelling = 0;\n  let gatesSeox = false;',
          ),
        () =>
          sub(
            'scripts/parse-finish.ts',
            '    const [handle] = ranked[0] as [string, number];',
            '    const handle =\n' +
              '      !gatesSeox && !CONFIRMED_FIGHTER_NAMED_PLAYERS.some((p) => p.id === id) && (gatesSeox = true)\n' +
              "        ? 'Seox'\n" +
              '        : (ranked[0] as [string, number])[0];',
          ),
      ),
  },
  {
    // Strive's orientation control, ported: when BOTH spans resolve, the
    // channel's declared order breaks the tie. Flipped, "Djeeta (Wilnas)" files
    // a fighter as the player — and the registry invariant is what catches it.
    name: 'parse: THE ORIENTATION TIE-BREAK is flipped — fighter-named handles become players',
    files: ['scripts/parse.ts', ...PARSE_OUTPUTS],
    cmd: ['scripts/parse.ts'],
    names: /REGISTRY INVARIANT: \d+ player handle/,
    precondition: all(needCorpus, needCleanParse),
    inject: () =>
      sub(
        'scripts/parse.ts',
        "        declared === 'handle-outside'\n          ? readings[0]",
        "        declared === 'handle-outside'\n          ? readings[1]",
      ),
  },
  {
    name: 'parse: THE MARKER in main — a retitled upload that says "GBVS:" is refused (report-only)',
    files: ['raw/highLevelReplays.json', 'scripts/parse.ts', ...PARSE_OUTPUTS],
    cmd: ['scripts/parse.ts'],
    precondition: all(() => needRaw('highLevelReplays'), needCleanParse),
    inject: () =>
      addRawRow(
        'highLevelReplays',
        'GATESmark01',
        'GBVS: GatesOld (Gran) Vs ProbeOld (Djeeta) | High Level Gameplay',
        '2026-01-15T12:00:00Z',
      ),
    report: {
      judge: () =>
        probeRows().has('GATESmark01')
          ? [false, 'the unmarked "GBVS:" upload GATESmark01 was published']
          : [true, 'the unmarked "GBVS:" upload GATESmark01 is not in videos.json'],
      disarm: {
        file: 'scripts/parse.ts',
        from: '      if (!hasGbvsrMarker(v.title)) {',
        to: '      if (false as boolean) {',
      },
    },
  },
  {
    name: 'parse: THE 2023-12-11 FLOOR in main — a GBVSR-marked title dated 2023-01 is refused (report-only)',
    files: ['raw/highLevelReplays.json', 'scripts/parse.ts', ...PARSE_OUTPUTS],
    cmd: ['scripts/parse.ts'],
    precondition: all(() => needRaw('highLevelReplays'), needCleanParse),
    inject: () =>
      addRawRow(
        'highLevelReplays',
        'GATESfloor1',
        'GBVSR:🔥GatesFloor (Gran)🔥 Vs ProbeFloor (Djeeta)🔥| High Level Gameplay.',
        '2023-01-15T12:00:00Z',
      ),
    report: {
      judge: () =>
        probeRows().has('GATESfloor1')
          ? [false, 'the 2023-01 upload GATESfloor1 was published']
          : [true, 'the 2023-01 "GBVSR" upload GATESfloor1 is not in videos.json'],
      disarm: {
        file: 'scripts/parse.ts',
        from: '      if (day < floor) {',
        to: "      if (day < '0000-00-00') {",
        names: /No season covers 2023-01-15/,
        // MEASURED: the date floor alone is not the last line. Every base
        // fighter's release day IS the floor (characters.ts: released =
        // PRE_RELEASE), so with the date floor gone the per-fighter release
        // floor still refuses the row. The twin removes both, and then the
        // pre-release day reaches seasonForDate, which throws.
        also: [
          {
            file: 'scripts/parse.ts',
            from: '        s.characters.filter((id) => day < (charById.get(id)?.extra?.released ?? PRE_RELEASE)),',
            to: "        s.characters.filter((id) => id === '__gates_never__'),",
          },
        ],
      },
    },
  },
  {
    name: 'parse: THE RELEASE FLOOR in main — Id on a title dated before 2026-09-15 is refused (report-only)',
    files: ['raw/highLevelReplays.json', 'scripts/parse.ts', ...PARSE_OUTPUTS],
    cmd: ['scripts/parse.ts'],
    precondition: all(() => needRaw('highLevelReplays'), needCleanParse),
    inject: () => {
      const released = characterRow('id')?.released;
      if (!released) return false;
      return addRawRow(
        'highLevelReplays',
        'GATESrel001',
        'GBVSR:🔥GatesRel (Id)🔥 Vs ProbeRel (Gran)🔥| High Level Gameplay.',
        `${addDays(released, -14)}T12:00:00Z`,
      );
    },
    report: {
      judge: () =>
        probeRows().has('GATESrel001')
          ? [false, 'GATESrel001 (Id, two weeks before she shipped) was published']
          : [true, 'GATESrel001 (Id, two weeks before she shipped) is not in videos.json'],
      disarm: {
        file: 'scripts/parse.ts',
        from: '        s.characters.filter((id) => day < (charById.get(id)?.extra?.released ?? PRE_RELEASE)),',
        to: "        s.characters.filter((id) => id === '__gates_never__'),",
      },
    },
  },
  {
    // The title path validates EX inline in main(); this is its only control.
    name: 'parse: EX on a fighter with no EX mode is residue on the TITLE path, a valid EX is a mark (report-only)',
    files: ['raw/highLevelReplays.json', 'scripts/parse.ts', ...PARSE_OUTPUTS],
    cmd: ['scripts/parse.ts'],
    precondition: all(() => needRaw('highLevelReplays'), needCleanParse),
    inject: () => {
      const since = characterRow('narmaya')?.exSince;
      if (!since) return false;
      const day = `${addDays(since, 29)}T12:00:00Z`;
      return steps(
        () =>
          addRawRow(
            'highLevelReplays',
            'GATESexzeta',
            'GBVSR:🔥GatesEx (EX Zeta)🔥 Vs ProbeEx (Gran)🔥| High Level Gameplay.',
            day,
          ),
        () =>
          addRawRow(
            'highLevelReplays',
            'GATESexnarm',
            'GBVSR:🔥GatesNar (EX Narmaya)🔥 Vs ProbeNar (Gran)🔥| High Level Gameplay.',
            day,
          ),
      );
    },
    report: {
      judge: () => {
        const rows = probeRows();
        const zeta = rows.get('GATESexzeta');
        const narm = rows.get('GATESexnarm');
        const z = zeta?.sides[0];
        const n = narm?.sides[0];
        const ok =
          !!z &&
          z.characters.join() === 'zeta' &&
          !('ex' in z) &&
          !!n &&
          JSON.stringify(n.ex) === '["narmaya"]';
        return [
          ok,
          `"(EX Zeta)" → ${z ? JSON.stringify({ characters: z.characters, ex: z.ex }) : 'absent'}, ` +
            `"(EX Narmaya)" → ${n ? JSON.stringify({ characters: n.characters, ex: n.ex }) : 'absent'}`,
        ];
      },
      disarm: {
        file: 'scripts/parse.ts',
        from: '        return !!since && day >= since;',
        to: '        return true;',
      },
    },
  },
  {
    // Checklist 7d: a slow self-deletion evades the collapse guard and the
    // silence alarm, so every run names the ids that left — and never blocks.
    name: 'parse: THE DEPARTURES LINE names a record that left the corpus, and exits 0 (report-only, 7d)',
    files: ['raw/highLevelReplays.json', 'scripts/parse-finish.ts', ...PARSE_OUTPUTS],
    cmd: ['scripts/parse.ts'],
    precondition: all(
      () => needRaw('highLevelReplays'),
      () => needRaw('replayTheater'),
      needCorpus,
      needCleanParse,
    ),
    inject: () => {
      const v = committed();
      if (!v) return needCorpus() ?? 'no corpus';
      const theaterIds = new Set<string>();
      if (existsSync(abs('raw/replayTheater.json')))
        for (const t of readJson<{ id: string; videoId: string }[]>('raw/replayTheater.json')) {
          theaterIds.add(t.id);
          theaterIds.add(t.videoId);
        }
      return withRaw('highLevelReplays', (rows) => {
        const inRaw = new Set(rows.map((r) => r.id));
        const candidates = v
          .filter(
            (r) => r.intake === 'highLevelReplays' && inRaw.has(r.id) && !theaterIds.has(r.id),
          )
          .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));
        const pick = candidates[Math.floor(candidates.length / 2)];
        if (!pick) return 'no committed highLevelReplays record outside the catalogue to remove';
        departed = pick.id;
        return rows.filter((r) => r.id !== pick.id);
      });
    },
    report: {
      judge: () => {
        const rep = existsSync(abs('data/report.md')) ? read('data/report.md') : '';
        const section =
          rep.split('## Left the corpus since the last commit')[1]?.split('\n## ')[0] ?? '';
        return section.includes(`\`${departed}\``)
          ? [true, `report.md "Left the corpus since the last commit" lists \`${departed}\``]
          : [
              false,
              `report.md's departures section does not list \`${departed}\`: ${section.replace(/\s+/g, ' ').trim().slice(0, 160)}`,
            ];
      },
      disarm: {
        file: 'scripts/parse-finish.ts',
        from: '    if (finalIds.has(v.id)) continue;',
        to: '    continue;',
      },
    },
  },
  {
    // Checklist 2b: the runback is a legitimate collision. A signature is a
    // hypothesis — both records stay published, and a human decides.
    name: 'parse: MATCH IDENTITY drops nothing — a same-signature twin is published AND queued (report-only, 2b)',
    files: ['raw/highLevelReplays.json', 'scripts/parse-finish.ts', ...PARSE_OUTPUTS],
    cmd: ['scripts/parse.ts'],
    precondition: all(() => needRaw('highLevelReplays'), needCorpus, needCleanParse),
    inject: () => {
      const v = committed();
      if (!v) return needCorpus() ?? 'no corpus';
      const ids = new Set(v.filter((r) => r.intake === 'highLevelReplays').map((r) => r.id));
      return withRaw('highLevelReplays', (rows) => {
        const src = rows.find((r) => ids.has(r.id));
        if (!src) return 'no raw highLevelReplays row that parses to a committed record';
        twinOf = src.id;
        return [...rows, { ...src, id: 'GATESdup001' }];
      });
    },
    report: {
      judge: () => {
        const rows = probeRows();
        const queue = existsSync(abs('data/review-queue.json'))
          ? readJson<{ kind: string; duplicates?: { ids: string[] } }[]>('data/review-queue.json')
          : [];
        const queued = queue.some(
          (q) =>
            q.kind === 'duplicate-candidate' &&
            !!q.duplicates?.ids.includes('GATESdup001') &&
            q.duplicates.ids.includes(twinOf),
        );
        const both = rows.has('GATESdup001') && rows.has(twinOf);
        return [
          both && queued,
          `${twinOf} and GATESdup001 ${both ? 'both published' : 'NOT both published'}, ` +
            `${queued ? 'queued together as duplicate-candidate' : 'NOT queued as duplicate-candidate'}`,
        ];
      },
      disarm: {
        file: 'scripts/parse-finish.ts',
        from: '  const dupGroups = [...signatures.values()].filter((g) => g.ids.length > 1);',
        to:
          '  const dupGroups = [...signatures.values()].filter((g) => g.ids.length > 1);\n' +
          '  records = records.filter((r) => !dupGroups.some((g) => g.ids.indexOf(r) > 0));',
      },
    },
  },
  {
    // The standalone reporter proves "report only" by hashing what it opens.
    // Given a write, its own proof must throw.
    name: 'dupes: the match-identity report WRITES to videos.json (2b — report-only, forever)',
    files: ['scripts/match-dupes.ts', 'data/videos.json'],
    cmd: ['scripts/match-dupes.ts'],
    names: /match-dupes wrote to videos\.json\. This script is REPORT ONLY \(checklist 2b\)/,
    precondition: needCorpus,
    inject: () =>
      sub(
        'scripts/match-dupes.ts',
        '  // ── the proof that nothing was written ────────────────────────────────────',
        '  const { writeFile: gatesWrite } = await import("node:fs/promises");\n' +
          '  const gatesV = JSON.parse(await readFile(join(DATA, "videos.json"), "utf8")) as MatchVideo[];\n' +
          '  await gatesWrite(join(DATA, "videos.json"), JSON.stringify(gatesV.slice(1), null, 2) + "\\n");\n' +
          '  // ── the proof that nothing was written ────────────────────────────────────',
      ),
  },

  // ── emit: the two-schema boundary (scripts/emit.ts) ──────────────────────
  {
    name: 'emit: pipeline provenance leaks into the public contract',
    files: ['scripts/emit.ts', ...EMIT_OUTPUTS],
    cmd: ['scripts/emit.ts'],
    names: /"provenance" leaked into replays\.json/,
    precondition: needCorpus,
    inject: () =>
      sub(
        'scripts/emit.ts',
        '    { player: v.sides[0].player, characters: v.sides[0].characters },',
        '    { player: v.sides[0].player, characters: v.sides[0].characters, provenance: v.sides[0].provenance } as never,',
      ),
  },
  {
    name: 'emit: a record references a character the roster does not have',
    files: ['data/videos.json', ...EMIT_OUTPUTS],
    cmd: ['scripts/emit.ts'],
    names: /emit: \S+ references unknown character not-a-fighter/,
    precondition: needCorpus,
    inject: () => {
      const v = committed();
      if (!v || !v[0]) return needCorpus() ?? 'no corpus';
      v[0].sides[0]!.characters = ['not-a-fighter'];
      delete v[0].sides[0]!.ex;
      write('data/videos.json', `${JSON.stringify(v, null, 2)}\n`);
      return true;
    },
  },
  {
    // 12n, the other end: the same `vid@0` guard in emit. A report-only check
    // because emit has no gate for it — its JUDGE reads what emit wrote.
    name: 'emit: a `vid@0` segment keeps startSeconds: 0 in the public contract (12n, report-only)',
    files: [...EMIT_OUTPUTS, 'scripts/emit.ts'],
    cmd: ['scripts/emit.ts'],
    precondition: all(needCorpus, () =>
      (committed() ?? []).some((r) => r.id.endsWith('@0'))
        ? null
        : 'the corpus holds no `vid@0` segment to carry',
    ),
    inject: () => true,
    report: {
      judge: () => {
        const out = existsSync(abs('data/replays.json'))
          ? readJson<{ id: string; videoId?: string; startSeconds?: number }[]>('data/replays.json')
          : [];
        const zero = out.filter((r) => r.id.endsWith('@0'));
        const bad = zero.filter((r) => r.startSeconds !== 0 || !r.videoId);
        return [
          zero.length > 0 && bad.length === 0,
          `${zero.length} \`@0\` replay(s), ${bad.length} without videoId + startSeconds: 0` +
            (bad.length ? ` (e.g. ${bad[0]!.id})` : ''),
        ];
      },
      disarm: {
        file: 'scripts/emit.ts',
        from: '  ...(v.videoId && v.startSeconds !== undefined ? { startSeconds: v.startSeconds } : {}),',
        to: '  ...(v.startSeconds ? { startSeconds: v.startSeconds } : {}),',
      },
    },
  },
];

// ── controls this suite deliberately does NOT ship, named rather than absent ─

const DECLARED_GAPS: string[] = [
  'probe: EX VALIDITY ON THE TITLE PATH. scripts/parse.ts decides whether a title’s EX mark is ' +
    'valid (fighter has the mode, date on/after it) INLINE in main(); nothing is exported for the ' +
    'probe to drive, so offline only the TOKEN (parseSide) and the index builder’s validity are ' +
    'controlled. The title-path rule is controlled by a parse-run report control that waits on a ' +
    'corpus. THE HOOK: export the validity test (e.g. validEx(ids, day, charById)) and it becomes ' +
    'a probe case.',
  'FINDING, not a control: "Replay ID" and "Player ID" resolve to the fighter `id` through the ' +
    'matcher (the strict two-letter guard admits a space-separated "ID"). Only the release floor ' +
    'refuses them, and only before 2026-09-15; nothing refuses them after. BY DESIGN, measured ' +
    '2026-10-01 on the rehearsal: 0 of 33,737 raw titles carry an ID-as-word phrase ("Player ID", ' +
    '"ID:", "room ID", …), while 32 of the 97 Id records spell the fighter as a bare `ID` ' +
    '(gbvsReplayChannel’s grammar) — a guard against the first would cost the second. Watch the ' +
    'residue and the Id page.',
  'fetch-theater main()’s wiring: the format-tag demotion to `tag: ""` + rawTag, the pre-gate ' +
    'applied BEFORE hydration, the cursor-ahead refusal, the full-sweep record floor, partial-resume ' +
    'identity and the offset-past-the-end refusal. Their exported helpers are probed; the wiring is ' +
    'not, because any run of the fetcher reaches videos.list. REPLAY_THEATER_ENDPOINT already ' +
    'points it at a fixture; the dead-channel control’s YouTube stub preload would complete the ' +
    'isolation — a stubbed copy, never the real key.',
  'emit’s toReplay is not exported, so the 12n guard in emit is controlled only through a full emit ' +
    'over a corpus holding a `vid@0` record (a report control that waits on one).',
  'The cron’s commit-step guard belongs to scripts/e2e.ts, which already runs it; not duplicated.',
];

// ── snapshot / restore ──────────────────────────────────────────────────────
//
// A file that did not exist is restored by DELETING it, not by writing zero
// bytes: several of the paths above (data/videos.json, data/report.md, the raw
// dumps) are absent on a fresh checkout, and an empty file left behind is the
// difference between "not built yet" and "unparseable".

const snapshots = new Map<string, Buffer | null>();

const snapshot = (files: string[]): void => {
  for (const f of files) snapshots.set(f, existsSync(abs(f)) ? readFileSync(abs(f)) : null);
};

const restore = (files: string[]): void => {
  for (const f of files) {
    const snap = snapshots.get(f);
    if (snap === undefined) continue;
    if (snap === null) {
      if (existsSync(abs(f))) unlinkSync(abs(f));
      continue;
    }
    writeFileSync(abs(f), snap);
  }
  for (const d of [...createdDirs].sort((a, b) => b.length - a.length)) {
    if (!existsSync(d)) {
      createdDirs.delete(d);
      continue;
    }
    if (walk(d).length === 0) {
      rmSync(d, { recursive: true, force: true });
      createdDirs.delete(d);
    }
  }
};

// A SUITE THAT IS INTERRUPTED MUST STILL PUT THE FILES BACK, and take its temp
// directory with it. SIGKILL still cannot be caught; nothing fixes that.
let cleaningUp = false;
const removeWork = (): void => {
  if (workDir && existsSync(workDir)) rmSync(workDir, { recursive: true, force: true });
};
const cleanUp = (why: string): void => {
  if (cleaningUp) return;
  cleaningUp = true;
  const files = [...snapshots.keys()];
  if (files.length) {
    console.error(`\n  ${why} — restoring ${files.length} snapshotted file(s) before exiting.`);
    restore(files);
  }
  removeWork();
};
for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    cleanUp(`interrupted by ${sig}`);
    process.exit(sig === 'SIGINT' ? 130 : 143);
  });
}
process.on('uncaughtException', (err: unknown) => {
  cleanUp('the suite threw');
  console.error(err);
  process.exit(1);
});
process.on('exit', removeWork);

// ── the trace check: nothing the suite touched may differ afterwards ───────

const TRACE = ['data', 'scripts', 'app', 'public', 'design', 'types', 'raw', 'vercel.json'];
function fingerprintTree(): Map<string, string> {
  const out = new Map<string, string>();
  for (const t of TRACE) {
    const p = abs(t);
    if (!existsSync(p)) continue;
    const st = lstatSync(p);
    const files = st.isDirectory() ? walk(p) : st.isFile() ? [p] : [];
    for (const f of files) out.set(relative(ROOT, f), sha256(readFileSync(f)));
  }
  return out;
}

// ── tallies ─────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
let skipped = 0;
const failures: string[] = [];
const skips: string[] = [];

const record = (name: string, v: Verdict): void => {
  if (v.kind === 'pass') {
    passed++;
    console.log(`  PASS  ${name}${v.detail ? `\n        ${v.detail}` : ''}`);
    return;
  }
  if (v.kind === 'skip') {
    skipped++;
    skips.push(`${name}\n        ${v.detail}`);
    console.log(`  SKIP  ${name}\n        ${v.detail}`);
    return;
  }
  failed++;
  failures.push(`${name} — ${v.detail}`);
  console.log(`  FAIL  ${name}\n        ${v.detail}`);
};

const wanted = (name: string): boolean => !only || name.includes(only);
const namesOf = (c: Control): RegExp | null =>
  c.names ? (typeof c.names === 'function' ? c.names() : c.names) : null;

const execute = (c: Control): Run => {
  if (c.exec) return c.exec();
  if (c.probe) return run([probePath(), c.probe], { cwd: work() });
  const cmd = typeof c.cmd === 'function' ? c.cmd() : (c.cmd ?? []);
  return run(cmd, { ...(c.cwd ? { cwd: c.cwd() } : {}), ...(c.network ? { network: true } : {}) });
};

// ── list mode ───────────────────────────────────────────────────────────────

const selected = CONTROLS.filter((c) => wanted(c.name));

if (LIST_ONLY) {
  console.log(`▶ ${selected.length} control(s)${OFFLINE ? ' (--offline)' : ''}\n`);
  for (const c of selected) {
    const net = c.network ? ' [network: vendor site]' : '';
    if (c.network && OFFLINE) {
      console.log(`  OFF   ${c.name}${net}\n        skipped by --offline`);
      continue;
    }
    const why = c.precondition?.() ?? null;
    console.log(
      `  ${why === null ? 'LIVE' : 'WAIT'}  ${c.name}${net}${why ? `\n        ${why}` : ''}`,
    );
  }
  removeWork();
  process.exit(0);
}

// ── run the controls ────────────────────────────────────────────────────────

const before = fingerprintTree();
console.log(
  `▶ ${selected.length} positive control(s) on ${ROOT}${OFFLINE ? ' (--offline)' : ''}\n`,
);
let liveControls = 0;
let networkControls = 0;

for (const c of selected) {
  const t0 = Date.now();
  if (c.network) networkControls++;
  if (c.network && OFFLINE) {
    record(
      c.name,
      skip('network control (reads the vendor’s own site, never YouTube) — skipped by --offline'),
    );
    continue;
  }
  const disarmSubs = c.report ? [c.report.disarm, ...(c.report.disarm.also ?? [])] : [];
  const files = [...new Set([...c.files, ...disarmSubs.map((d) => d.file)])];
  // The precondition is read BEFORE the injection so the skip can name it, and
  // the injection happens EITHER WAY: a control that cannot run must still prove
  // it can place its defect. A drifted anchor is a FAILURE, not a skip.
  const blocked = c.precondition?.() ?? null;
  snapshot(files);
  let injected: Injected = false;
  try {
    injected = c.inject();
  } catch (e) {
    injected = false;
    console.log(`        inject threw: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    if (injected !== true || blocked !== null) restore(files);
  }
  const drifted = disarmSubs.find((d) => occurrences(d.file, d.from) !== 1);
  if (injected === false || drifted) {
    if (injected === true) restore(files);
    record(
      c.name,
      fail(
        injected === false
          ? 'ANCHOR DRIFT — the injection point no longer matches exactly once, so this control is a NO-OP'
          : `ANCHOR DRIFT — a disarm anchor no longer occurs exactly once in ${drifted!.file}: ${drifted!.from.trim()}`,
      ),
    );
    continue;
  }
  if (typeof injected === 'string') {
    const code = files.some((f) => f.startsWith('scripts/') || f.startsWith('design/'));
    record(
      c.name,
      skip(
        `precondition absent: ${injected}\n        ` +
          (code
            ? '(every code anchor this control uses still matches)'
            : '(the defect IS a rewrite of that input, so there is nothing to place until it exists)'),
      ),
    );
    continue;
  }
  if (blocked !== null) {
    record(
      c.name,
      skip(`${blocked}\n        (the anchor still matches — the defect can be placed)`),
    );
    continue;
  }

  liveControls++;
  let v: Verdict;
  try {
    const r = execute(c);
    const names = namesOf(c);
    if (c.report) {
      const judged = c.report.judge();
      restore(files);
      v = reportVerdict(r, judged);
      if (v.kind === 'pass') {
        // THE DISARMED TWIN: the same input with the rule removed from the code.
        // The judge must notice, or it is vacuous.
        const d = c.report.disarm;
        let twin: Run;
        let twinJudged: [boolean, string];
        try {
          const again = c.inject();
          if (again !== true || !disarmSubs.every((x) => sub(x.file, x.from, x.to))) {
            throw new Error('the twin could not be placed');
          }
          twin = execute(c);
          twinJudged = c.report.judge();
        } finally {
          restore(files);
        }
        if (twin.status === null) {
          v = fail(`the disarmed twin never finished (${twin.signal ?? 'no status'})`);
        } else if (twin.status !== 0) {
          v =
            d.names && d.names.test(twin.out)
              ? pass(`${v.detail} · disarmed: exit ${twin.status} · "${proofLine(twin, d.names)}"`)
              : fail(`the disarmed twin exited ${twin.status} for another reason: ${head(twin)}`);
        } else if (twinJudged[0]) {
          v = fail(
            `the judge did not notice the rule removed from ${d.file} — it is vacuous (${twinJudged[1]})`,
          );
        } else {
          v = pass(`${v.detail} · disarmed: exit 0 and the judge caught it (${twinJudged[1]})`);
        }
      }
    } else {
      if (!names) throw new Error('a failing control must declare the rule it names');
      const post = c.after?.() ?? null;
      restore(files);
      v = verdict(r, names);
      if (v.kind === 'fail' && c.network && NETWORK_DOWN.test(r.out) && !names.test(r.out)) {
        v = skip(`the vendor site did not answer, so nothing was judged: ${head(r, 2)}`);
      } else if (v.kind === 'pass' && post) {
        v = fail(post);
      }
    }
  } catch (e) {
    restore(files);
    v = fail(`the control threw: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (v.kind !== 'skip')
    v = {
      ...v,
      detail: `${v.detail ?? ''} · ${((Date.now() - t0) / 1000).toFixed(1)}s`,
    } as Verdict;
  record(c.name, v);
}
const controlTally = { passed, failed, skipped };

// ── the clean run, which is the other half of step 10 ───────────────────────
//
// It also proves the restores above were byte-exact: every one of these reads
// files the controls edited, and several rebuild committed artifacts.

interface Clean {
  label: string;
  cmd?: string[];
  exec?: () => Run;
  files?: string[];
  precondition?: () => string | null;
  network?: boolean;
  /** Beyond exit 0: a verdict on what the run said or left (null = fine). */
  judge?: (r: Run) => Verdict | null;
}

let artOut = '';
const CLEAN: Clean[] = [
  { label: 'seasons --check', cmd: ['scripts/seasons.ts', '--check'] },
  { label: 'expiries --check', cmd: ['scripts/expiries.ts', '--check'] },
  { label: 'redirects --check', cmd: ['scripts/redirects.ts', '--check'] },
  {
    label: 'characters (rebuilds data/characters.json; restored byte-exact)',
    cmd: ['scripts/characters.ts'],
    files: ['data/characters.json'],
    judge: () => {
      const was = snapshots.get('data/characters.json');
      const now = existsSync(abs('data/characters.json'))
        ? readFileSync(abs('data/characters.json'))
        : null;
      return was && now && Buffer.compare(was, now) === 0
        ? null
        : fail(
            'data/characters.json rebuilt DIFFERENTLY from the committed file — ROSTER and the JSON have drifted',
          );
    },
  },
  ...PROBE_CASES.map((p): Clean => ({
    label: `probe ${p}`,
    exec: () => run([probePath(), p], { cwd: work() }),
  })),
  {
    label: 'patch-check against the offline fixture (the feed exactly as the table states it)',
    exec: () => runPatchCheck(() => undefined),
    judge: (r) =>
      /patch-check: CURRENT/.test(r.out) ? null : fail(`no CURRENT trailer: ${head(r)}`),
  },
  {
    label: 'art --generated --out=<tmp> (the Article 3 fallback, BUILT every run; offline)',
    exec: () => {
      artOut = scratch('art-generated');
      return run([abs('scripts/art.ts'), '--generated', `--out=${artOut}`], { cwd: work() });
    },
    judge: () => {
      const [ok, detail] = judgeGeneratedArt(artOut);
      return ok ? pass(detail) : fail(detail);
    },
  },
  { label: 'emit', cmd: ['scripts/emit.ts'], files: EMIT_OUTPUTS },
  { label: 'parse', cmd: ['scripts/parse.ts'], files: PARSE_OUTPUTS, precondition: needCleanParse },
  { label: 'match-dupes', cmd: ['scripts/match-dupes.ts'], precondition: needCorpus },
  {
    label: 'patch-check (LIVE vendor feed)',
    cmd: ['scripts/patch-check.ts'],
    network: true,
    judge: (r) =>
      /patch-check: UNVERIFIED/.test(r.out)
        ? skip(`the vendor feed did not answer: ${head(r, 2)}`)
        : /patch-check: CURRENT/.test(r.out)
          ? pass('"patch-check: CURRENT"')
          : fail(`no CURRENT trailer: ${head(r)}`),
  },
  {
    label: 'roster-check (LIVE vendor grid)',
    cmd: ['scripts/roster-check.ts'],
    network: true,
    judge: (r) =>
      /roster-check: UNVERIFIED/.test(r.out)
        ? skip(`the vendor site did not answer: ${head(r, 2)}`)
        : /roster-check: CURRENT/.test(r.out)
          ? pass('"roster-check: CURRENT"')
          : fail(`no CURRENT trailer: ${head(r)}`),
  },
];

console.log('\n▶ clean run');
for (const cl of CLEAN) {
  if (only && !wanted(cl.label)) continue;
  const name = `clean run: ${cl.label}`;
  if (cl.network && OFFLINE) {
    record(name, skip('network (the vendor’s own site) — skipped by --offline'));
    continue;
  }
  const blocked = cl.precondition?.() ?? null;
  if (blocked !== null) {
    record(name, skip(blocked));
    continue;
  }
  const files = cl.files ?? [];
  snapshot(files);
  let r: Run;
  let judged: Verdict | null = null;
  try {
    r = cl.exec ? cl.exec() : run(cl.cmd ?? [], cl.network ? { network: true } : {});
    if (r.status === 0 && cl.judge) judged = cl.judge(r);
  } catch (e) {
    restore(files);
    record(name, fail(`threw: ${e instanceof Error ? e.message : String(e)}`));
    continue;
  }
  restore(files);
  if (r.status !== 0) {
    record(
      name,
      fail(
        `exits ${r.status ?? `on signal ${r.signal}`}\n` +
          lines(r)
            .slice(0, 6)
            .map((l) => `        ${l}`)
            .join('\n'),
      ),
    );
    continue;
  }
  const lastLine =
    lines(r)
      .filter((l) => !l.startsWith('⚠') && !l.startsWith('ⓘ'))
      .at(-1) ?? '';
  record(name, judged ?? pass(`exit 0 · "${lastLine.slice(0, 160)}"`));
}

// ── the trace check ─────────────────────────────────────────────────────────

const after = fingerprintTree();
const moved = [
  ...[...before.keys()].filter((f) => after.get(f) !== before.get(f)),
  ...[...after.keys()].filter((f) => !before.has(f)),
];
if (moved.length) {
  record(
    'the suite leaves no trace (every file under data/, scripts/, app/, public/, design/, types/, raw/, vercel.json)',
    fail(
      `${moved.length} file(s) differ from before the first control: ${moved.slice(0, 8).join(', ')}`,
    ),
  );
} else {
  record(
    'the suite leaves no trace (every file under data/, scripts/, app/, public/, design/, types/, raw/, vercel.json)',
    pass(`${before.size} file(s) byte-identical before and after`),
  );
}

// ── the tally ───────────────────────────────────────────────────────────────

const wall = ((Date.now() - STARTED) / 1000).toFixed(1);
console.log(
  `\n${failed === 0 ? '✓' : '✖'} ${passed} passed · ${failed} failed · ${skipped} skipped  (${wall}s)` +
    `\n  controls: ${selected.length} — ${liveControls} ran live (${controlTally.passed} passed, ` +
    `${controlTally.failed} failed), ${controlTally.skipped} skipped; ${networkControls} read the vendor site`,
);
if (skips.length) {
  console.log('\nSkipped, with the precondition each one is waiting on:\n');
  for (const s of skips) console.log(`  ${s}`);
}
if (DECLARED_GAPS.length && !only) {
  console.log('\nNOT COVERED, on purpose — a gate nobody wrote is invisible:\n');
  for (const g of DECLARED_GAPS) console.log(`  · ${g}\n`);
}
if (failures.length) {
  console.error('\nA control that does not fire is worse than no control:\n');
  for (const f of failures) console.error(`  ${f}`);
}
process.exit(failed === 0 ? 0 : 1);
