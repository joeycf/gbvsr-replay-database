/**
 * Build the character art from Cygames' own Fan Kit — and keep the revocation
 * path buildable behind ONE command.
 *
 * ── THE LICENCE, READ FIRSTHAND 2026-09-29 ────────────────────────────────
 * rising.granbluefantasy.jp/en/extras/fankit/, "Granblue Fantasy: Versus Fan
 * Kit Terms of Use". Three articles decide everything this file does:
 *
 *   Article 1  "Only copyrighted materials distributed in the fan kit … may be
 *              used. Other copyrighted materials relating to the Content may
 *              not be posted to or reprinted on external websites." THE KIT IS
 *              THE ONLY PERMITTED SOURCE. Strive could weigh its character
 *              detail-page renders as a second source; here they are
 *              prohibited, so there is no fallback to anything Cygames
 *              published outside the kit — a fighter the kit lacks is a throw.
 *   Article 2  prohibits commercial use, "Excessively processing or modifying
 *              Copyrighted Materials for use", and "Deleting or modifying
 *              trademarks and copyright notices". The outputs below are a crop
 *              and a resize of the kit PNG — no recolouring, no background
 *              composited behind or over the figure, transparency kept — and
 *              every source is scanned for a baked notice before it is cropped
 *              (checkNotice), because cropping one off would be deleting it.
 *   Article 3  the licence is REVOCABLE, and on revocation "the user must
 *              immediately destroy or delete the Copyrighted Materials and all
 *              copies thereof". Article 1 leaves no other permitted source, so
 *              the answer to a revocation is generated tiles: `npm run
 *              data:art:revoked` (this file with --generated) deletes every kit
 *              derivative and draws the whole roster from its accents, with the
 *              network stubbed out. The user decided this on 2026-09-29.
 *
 * The run re-reads the terms FIRST, every time: the Article 1/2/3 sentences
 * above must appear verbatim (normalised whitespace) on the live page, or the
 * run stops before any download. A changed licence is a human's call.
 *
 * ── ENUMERATE, NEVER CONSTRUCT ────────────────────────────────────────────
 * The kit is a microCMS list the page renders client-side. Its public read key
 * and service domain live in the page's own bundle (/assets/js/
 * event_fankit.<hash>.js, referenced by the page HTML) and are scraped at run
 * time — never committed; provenance records the domain, never the key. Every
 * download URL comes from the CMS response. The filter is exact: type
 * ["GBVSR"] and category ["キャラクター"] (41 items, 2026-09-29). The ["GBVS"]
 * set is the PREVIOUS game's art and is never touched.
 *
 * Each item carries two independent names, title.en and title.ja, and BOTH
 * must resolve (scripts/roster.ts buildAliasMatcher, whole-title match) to the
 * same roster id — the second signal Strive got from a caption beside an
 * ordinal. Exactly the 40 roster ids plus the known non-fighter extras must
 * come back: a missing fighter, a duplicate, or an unknown extra is a throw.
 *
 * ── THE FRAMES ARE NOT SQUARE ─────────────────────────────────────────────
 * Every kit PNG is 1900 px wide with a VARIABLE height (1763 to 3587 on
 * 2026-09-29), so no frame constant here is keyed to a square: x is a fraction
 * of the width, y of the height, and each BUST_HEAD row pins the height it was
 * read on (checklist 15's first trap).
 *
 * Run: npm run data:art           (manual, never in the cron — the kit changes
 *                                  on DLC days and every new fighter needs a
 *                                  hand-read BUST_HEAD row)
 *      npm run data:art:revoked   (the Article 3 path; offline)
 *      tsx scripts/art.ts --generated --out=<dir>   (the same, into a scratch
 *                                  root — what verify-gates builds every run)
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

import type opentype from 'opentype.js';

import type { CharacterRecord } from '../types/index';
import {
  assertFonts,
  capHeight,
  fitSize,
  loadSharp,
  outlines,
  readArtCredit,
  renderOgCard,
  ROOT,
  widthOf,
} from './og';
import { buildAliasMatcher, loadCharacters, normalizeText } from './roster';

// ── arguments, and the no-network stub, before anything else runs ───────────

const ARGS = process.argv.slice(2);
const GENERATED = ARGS.includes('--generated');
const OUT_ARG = ARGS.find((a) => a.startsWith('--out='));
const UNKNOWN_ARGS = ARGS.filter((a) => a !== '--generated' && !a.startsWith('--out='));

/**
 * NO NETWORK ON THE REVOCATION PATH, ENFORCED.
 *
 * `--generated` exists for the day Cygames has told us to stop; a revocation
 * path that could fetch a kit file is one careless line from republishing what
 * we were told to delete. So `fetch` is replaced at module load, before main,
 * and main proves the stub fires before drawing anything — a guard that cannot
 * fire is indistinguishable from one that passes (Avatar's art.ts).
 */
const NO_NETWORK = 'art.ts --generated: REFUSED — the revocation path never fetches anything';
if (GENERATED) {
  globalThis.fetch = (async (input: unknown): Promise<never> => {
    throw new Error(
      `${NO_NETWORK}. Asked for ${String(input)}. --generated draws every tile from ` +
        `data/characters.json and design/fonts; there is nothing to download.`,
    );
  }) as unknown as typeof fetch;
}

/** Where the outputs go: the repo, or a scratch root mirroring its layout. */
const OUT = OUT_ARG ? resolve(OUT_ARG.slice('--out='.length)) : ROOT;
const CHAR_DIR = join(OUT, 'public', 'img', 'char');
const SPLASH_DIR = join(OUT, 'public', 'img', 'splash');
const PROVENANCE = join(OUT, 'data', 'art-provenance.json');

const today = (): string => new Date().toISOString().slice(0, 10);
const sha256 = (b: Buffer): string => createHash('sha256').update(b).digest('hex');

// ── the licence ─────────────────────────────────────────────────────────────

const FANKIT_PAGE = 'https://rising.granbluefantasy.jp/en/extras/fankit/';
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

/** The sentences the decision rests on, as the page states them (curly
 *  quotes folded, whitespace normalised — see licenceText). Each must appear
 *  verbatim on the live page or the run stops before any download. */
const LICENCE = {
  url: FANKIT_PAGE,
  title: 'Granblue Fantasy: Versus Fan Kit Terms of Use',
  /** The day a person read the terms in full. `licenceVerified` (below, per
   *  run) is the day the sentences were last re-asserted against the page. */
  read: '2026-09-29',
  revocable: true,
  articles: [
    {
      article: 'Article 1 (Copyrighted Materials)',
      sentences: [
        'Only copyrighted materials distributed in the fan kit (hereinafter, "Copyrighted Materials") may be used.',
        'Other copyrighted materials relating to the Content may not be posted to or reprinted on external websites.',
      ],
    },
    {
      article: 'Article 2 (Prohibited Acts)',
      sentences: [
        'The following acts are prohibited:',
        'Using Copyrighted Materials for commercial purposes or profit-making;',
        'Excessively processing or modifying Copyrighted Materials for use;',
        'Deleting or modifying trademarks and copyright notices on Copyrighted Materials;',
      ],
    },
    {
      article: 'Article 3 (Revocation of License)',
      sentences: [
        "We may revoke the user's license to use Copyrighted Materials if we discover use of Copyrighted Materials that we deem violates the prohibitions listed in the preceding Article for any reason.",
        'In this case, the user must immediately destroy or delete the Copyrighted Materials and all copies thereof.',
      ],
    },
  ],
  decision:
    'User decision 2026-09-29: use the Fan Kit, crop + resize only (no recolouring, no ' +
    'compositing onto the figure), and keep a dormant generated-tile fallback buildable behind ' +
    'one command (npm run data:art:revoked), because Article 3 lets Cygames revoke and ' +
    'Article 1 leaves no other permitted source.',
};

/** The notices app.config.ts artCredit reproduces. Each must still be one the
 *  vendor's own page carries, and the credit must carry each. */
const PAGE_NOTICES = ['© Cygames, Inc.', '© SQUARE ENIX'];

/** Items in the kit's GBVSR character set that are not fighters. Each is
 *  never downloaded. A stale row fails like a stale BUST_HEAD key: the table
 *  is only worth reading if it says exactly what the kit holds. */
const KNOWN_EXTRAS: Record<string, string> = {
  Lunalu:
    'In the kit\'s GBVSR character set ("29_GBVSR_Lunalu.png") but not a fighter: the vendor ' +
    'roster (rising.granbluefantasy.jp/en/characters/) lists 40, and she is not among them; ' +
    'neither title.en "Lunalu" nor title.ja resolves to a roster alias. Never downloaded.',
};

/** HTML → the text a reader sees, folded the way the sentences above are. */
function licenceText(html: string): string {
  const text = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
  return fold(text);
}
const fold = (s: string): string => normalizeText(s).replace(/[“”]/g, '"');

// ── the head table ──────────────────────────────────────────────────────────

/** Every kit PNG is this wide. The height varies per file and is pinned per
 *  BUST_HEAD row instead. */
const KIT_WIDTH = 1900;

/**
 * THE FACE, HAND-READ ON EVERY RENDER: x as a fraction of the render's WIDTH,
 * y of its HEIGHT, at the midpoint between the eyes (the one point on a head
 * that can be read the same way twice — a helmet's eye-slit where there is no
 * face). `h` is the height of the file the row was read on: a re-cut kit file
 * fails the run instead of being cropped by stale fractions.
 *
 * READ 2026-09-29 on the 40 kit PNGs this file crops: each render on a 5%
 * grid, then a 1–2% grid around the face, then the crosshair drawn back onto a
 * zoomed crop and looked at (40/40 on the face — two rows moved after that
 * pass, ilsa and wilnas, which had landed on the chin), then the portraits on
 * one contact sheet.
 *
 * ALL 40 ARE TABLE ROWS, because "the top of the figure is the head" fails on
 * most of this kit: these are action key-art poses whose topmost opaque pixels
 * are a sword tip (Gran, Djeeta, Siegfried, Zooey), a halberd (Vane), a spear
 * (Beatrix, Anre, Zeta), an ouroboros chain (Cagliostro), a crown and blade
 * (Charlotta), streaming hair (Katalina, Narmaya, Ladiva, Versusia), a raised
 * fist (Soriz, Wilnas), a wing-cape (Vaseraga, Seox) or a flower crown over a
 * masked companion (Nier). Every run prints each row next to that estimate and
 * the opaque density under both, so a deleted row shows in the log as well as
 * in the tile — see the summary line at the end of the run.
 *
 * GUARDED, not merely declared: a key that is not a roster id hard-fails (a
 * stale key is not inert — the fighter it was meant for would have no row), a
 * roster id with no row hard-fails (a new fighter needs a hand-read, never the
 * estimate), and every crosshair must sit on the figure (checkCrosshair).
 */
const BUST_HEAD: Record<string, { x: number; y: number; h: number }> = {
  gran: { x: 0.54, y: 0.155, h: 2660 }, // sword tip and spiked hair are topmost
  djeeta: { x: 0.55, y: 0.175, h: 3587 }, // the tallest file; the sword hilt reaches the top-left
  katalina: { x: 0.53, y: 0.32, h: 2813 }, // hair streams a third of the frame above her face
  charlotta: { x: 0.55, y: 0.33, h: 2345 }, // Harvin on a crate: the raised blade and crown are the top
  lancelot: { x: 0.4, y: 0.25, h: 2262 }, // twin blades cross above his head
  percival: { x: 0.49, y: 0.15, h: 2324 },
  ladiva: { x: 0.52, y: 0.22, h: 1914 }, // mane above
  metera: { x: 0.565, y: 0.345, h: 2081 }, // leaning; the bow and hair own the top third
  lowain: { x: 0.51, y: 0.22, h: 2764 }, // the centre of three: Tomoi and Elmott flank him lower
  ferry: { x: 0.535, y: 0.24, h: 1835 }, // her ears and whip are topmost
  zeta: { x: 0.46, y: 0.3, h: 2291 }, // spear tip at the top edge
  vaseraga: { x: 0.55, y: 0.39, h: 1910 }, // helmet eye-slit; the cape-wings fill the top
  narmaya: { x: 0.48, y: 0.32, h: 2077 }, // hair
  soriz: { x: 0.49, y: 0.18, h: 2475 }, // raised fist top-left
  zooey: { x: 0.46, y: 0.365, h: 2353 }, // sword arcs across the top
  cagliostro: { x: 0.4, y: 0.32, h: 2239 }, // the ouroboros chain is top-right; her face is left
  yuel: { x: 0.505, y: 0.35, h: 2495 }, // fox ears and the bells above
  anre: { x: 0.49, y: 0.445, h: 2522 }, // Harvin; the spear and cape reach the top
  eustace: { x: 0.56, y: 0.31, h: 1763 }, // horizontal gun pose
  seox: { x: 0.56, y: 0.39, h: 2615 }, // masked; the cloak billows above
  vira: { x: 0.42, y: 0.22, h: 2255 },
  beelzebub: { x: 0.54, y: 0.22, h: 2149 }, // the braid loops above his head
  belial: { x: 0.57, y: 0.2, h: 2707 },
  'avatar-belial': { x: 0.53, y: 0.23, h: 1920 }, // horns and a raised hand
  anila: { x: 0.515, y: 0.33, h: 2324 }, // ram horns and hair
  siegfried: { x: 0.51, y: 0.29, h: 2571 }, // the greatsword is the top-left diagonal
  grimnir: { x: 0.485, y: 0.29, h: 1992 }, // wind ribbons above
  nier: { x: 0.46, y: 0.26, h: 1774 }, // the dark-haired girl, not the masked figure above her
  lucilius: { x: 0.47, y: 0.24, h: 2441 },
  '2b': { x: 0.485, y: 0.275, h: 2599 }, // blindfold; the sword and Pod float above
  vane: { x: 0.56, y: 0.385, h: 2350 }, // the halberd is the top-left third
  beatrix: { x: 0.48, y: 0.29, h: 2145 }, // spear diagonal above
  versusia: { x: 0.5, y: 0.28, h: 2440 }, // face almost hidden in the hair; eye at the parting
  vikala: { x: 0.555, y: 0.36, h: 2400 }, // mouse ears and the ribbon fans above
  sandalphon: { x: 0.39, y: 0.24, h: 2400 },
  galleon: { x: 0.52, y: 0.38, h: 2200 }, // staff and floating shards above
  wilnas: { x: 0.52, y: 0.262, h: 1900 }, // raised flaming fist; 0.27 was the chin
  meg: { x: 0.59, y: 0.145, h: 2221 },
  ilsa: { x: 0.42, y: 0.378, h: 1900 }, // raised arm and cap; 0.385 was the chin
  id: { x: 0.43, y: 0.36, h: 1900 }, // the energy arc sweeps the top
};

/** The neighbourhood the crosshair guard measures: Strive's 55 px on a 1600
 *  frame, as the same fraction of this kit's 1900 px width. */
const DENSITY_R = Math.round(KIT_WIDTH * (55 / 1600));
/** Strive's measured gap (2026-09-09): off-figure rows 0–21% opaque, rows in
 *  a gap inside the figure 51%+. Here every row is a face; the run prints the
 *  lowest, and the estimates' densities alongside for contrast. */
const DENSITY_MIN = 0.35;

// ── framing ─────────────────────────────────────────────────────────────────

/**
 * ── THE TWO SURFACES (replay-engine app/pages/characters/) ────────────────
 *   GRID  index.vue: `aspect-[3/4] w-full object-cover`, no object-position,
 *         inside a `bg-surface` link. The accent gradient (utils/format.ts
 *         accentGradient) is drawn ONLY as the missing-art fallback, not under
 *         a loaded image — so a transparent portrait shows its figure on
 *         --color-surface. That is the licence-safe choice and it is legible;
 *         the art arrives already 3:4 with the face where the box shows it.
 *   HERO  [id].vue: a fixed 1440×340 `object-cover` box (280 px tall below md)
 *         over a striped backplate, under an accent radial and a left scrim,
 *         framed by GameConfig.heroFocus. The splash is 2× that box, so
 *         nothing is cropped at desktop, and the figure stands flush right —
 *         which REQUIRES heroFocus '100% 50%' (Strive's value) below desktop:
 *         the engine default '70% 25%' would push a flush-right figure out of
 *         a phone-width window.
 */
const PORTRAIT_W = 512;
const PORTRAIT_H = Math.round(PORTRAIT_W / 0.75); // 683

/** The bust window's height as a fraction of the opaque body height, and how
 *  far down the window the face sits. Chosen on the contact sheet
 *  (2026-09-29): Strive's 0.52 showed most of this kit to the knee — the kit's
 *  bodies are sprawling action poses, not standing figures — and 0.28 put
 *  Gran's hair spikes on the top edge. */
const BUST_HEIGHT = 0.38;
const FACE_TOP = 0.3;

const HERO_W = 2880;
const HERO_H = 680;
/** Strive's composition, kept so the platform's heroes read as one set: body
 *  scaled to 92% of the height, right edge at 97% of the width, feet 20 px up. */
const FIGURE_H = 0.92;
const FIGURE_RIGHT = 0.97;
const FIGURE_BASELINE = 20;
/** At 360×280 with heroFocus '100% 50%' the window shows the canvas's right
 *  874 columns; 874 − 3% margin = 788. Height gives way, not width. */
const FIGURE_MAX_W = 788;

// ── measurement ─────────────────────────────────────────────────────────────

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Measured {
  /** alpha > 200: the body. Sets the bust window and the splash scale. */
  opaque: Box;
  /** alpha > 8: what a viewer sees. What the splash extracts. */
  visible: Box;
  /** The "top of the figure is the head" estimate, in source px. */
  est: { x: number; y: number };
  /** The largest cluster of small isolated components in one text-line band
   *  at the top or bottom edge (checkNotice). */
  noticeCluster: number;
}

async function measure(buf: Buffer): Promise<Measured> {
  const sharp = await loadSharp();
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .extractChannel(3)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const scan = (t: number): Box => {
    let x0 = W;
    let y0 = H;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (data[y * W + x]! > t) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) throw new Error('the render has no pixel above the threshold — is it blank?');
    return { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
  };
  const opaque = scan(200);
  const visible = scan(8);
  // Strive's estimate: centre of mass of the body's top quarter, 5% down.
  let sum = 0;
  let n = 0;
  const quarter = opaque.top + Math.round(opaque.height * 0.25);
  for (let y = opaque.top; y <= quarter; y++) {
    for (let x = opaque.left; x < opaque.left + opaque.width; x++) {
      if (data[y * W + x]! > 200) {
        sum += x;
        n++;
      }
    }
  }
  return {
    opaque,
    visible,
    est: { x: n ? sum / n : opaque.left + opaque.width / 2, y: opaque.top + 0.05 * opaque.height },
    noticeCluster: noticeCluster(data, W, H),
  };
}

/**
 * A BAKED NOTICE LOOKS LIKE A LINE OF SMALL ISOLATED SHAPES AT AN EDGE.
 *
 * Article 2 forbids deleting a copyright notice, and a crop deletes whatever
 * falls outside it. None of the 41 kit PNGs carries one (every corner and edge
 * band looked at, 2026-09-29), and this makes that finding re-assert on every
 * run instead of living in a comment: connected components of alpha > 64,
 * minus the figure itself, small (8–4000 px) and short (≤ 3% of the height),
 * lying in the top or bottom 12% — and the most of them inside any one 2.5%-
 * tall line. Measured on the real kit: 0 on 36 files, at most 4 (Galleon's
 * floating shards; Cagliostro's chain links 3). A 36 px "© Cygames, Inc."
 * drawn onto Gran's bottom band as a positive control scored 14. The threshold
 * sits in that gap.
 */
const NOTICE_CLUSTER_MAX = 8;

function noticeCluster(alpha: Buffer, W: number, H: number): number {
  const label = new Int32Array(W * H).fill(-1);
  const comps: { area: number; y0: number; y1: number }[] = [];
  const stack: number[] = [];
  for (let i = 0; i < W * H; i++) {
    if (alpha[i]! <= 64 || label[i]! >= 0) continue;
    const id = comps.length;
    let area = 0;
    let y0 = H;
    let y1 = 0;
    label[i] = id;
    stack.push(i);
    while (stack.length) {
      const p = stack.pop()!;
      area++;
      const x = p % W;
      const y = (p - x) / W;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (const q of [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, p - W, p + W]) {
        if (q >= 0 && q < W * H && alpha[q]! > 64 && label[q]! < 0) {
          label[q] = id;
          stack.push(q);
        }
      }
    }
    comps.push({ area, y0, y1 });
  }
  let figure = 0;
  for (let i = 1; i < comps.length; i++) if (comps[i]!.area > comps[figure]!.area) figure = i;
  const band = H * 0.12;
  const centres = comps
    .filter(
      (c, i) =>
        i !== figure &&
        c.area >= 8 &&
        c.area <= 4000 &&
        c.y1 - c.y0 <= H * 0.03 &&
        (c.y1 < band || c.y0 > H - band),
    )
    .map((c) => (c.y0 + c.y1) / 2)
    .sort((a, b) => a - b);
  let best = 0;
  for (let i = 0, j = 0; j < centres.length; j++) {
    while (centres[j]! - centres[i]! > H * 0.025) i++;
    best = Math.max(best, j - i + 1);
  }
  return best;
}

/** Share of near-opaque pixels within DENSITY_R of a point. */
async function densityAt(buf: Buffer, W: number, H: number, x: number, y: number): Promise<number> {
  const sharp = await loadSharp();
  const px = Math.round(x);
  const py = Math.round(y);
  const left = Math.max(0, px - DENSITY_R);
  const top = Math.max(0, py - DENSITY_R);
  const width = Math.min(W, px + DENSITY_R) - left;
  const height = Math.min(H, py + DENSITY_R) - top;
  if (width <= 0 || height <= 0) return 0;
  const near = await sharp(buf)
    .ensureAlpha()
    .extractChannel(3)
    .extract({ left, top, width, height })
    .raw()
    .toBuffer();
  let opaque = 0;
  for (const a of near) if (a > 200) opaque++;
  return opaque / (width * height);
}

// ── the kit crops ───────────────────────────────────────────────────────────

interface Written {
  path: string;
  dimensions: string;
  crop: string;
  bytes: number;
  sha256: string;
}

async function finish(file: string, webp: Buffer, crop: string): Promise<Written> {
  const sharp = await loadSharp();
  const meta = await sharp(webp).metadata();
  await writeFile(file, webp);
  return {
    path: `/${relative(join(OUT, 'public'), file).split('\\').join('/')}`,
    dimensions: `${meta.width}×${meta.height}`,
    crop,
    bytes: webp.length,
    sha256: sha256(webp),
  };
}

/**
 * THE PORTRAIT: a 3:4 window, BUST_HEIGHT of the body tall, the face centred
 * across it and FACE_TOP down it, clamped inside the frame, resized to
 * 512×683. Crop and resize, nothing else — the alpha is kept.
 */
async function savePortrait(
  id: string,
  buf: Buffer,
  W: number,
  H: number,
  m: Measured,
  face: { x: number; y: number },
): Promise<Written> {
  const sharp = await loadSharp();
  let winH = Math.min(m.opaque.height * BUST_HEIGHT, H, W / 0.75);
  let winW = winH * 0.75;
  winW = Math.round(winW);
  winH = Math.round(winW / 0.75);
  const left = Math.round(Math.min(Math.max(0, face.x - winW / 2), W - winW));
  const top = Math.round(Math.min(Math.max(0, face.y - winH * FACE_TOP), H - winH));
  const webp = await sharp(buf)
    .extract({ left, top, width: winW, height: winH })
    .resize(PORTRAIT_W, PORTRAIT_H, { fit: 'fill' })
    .webp({ quality: 82, alphaQuality: 100 })
    .toBuffer();
  const fx = ((face.x - left) / winW) * 100;
  const fy = ((face.y - top) / winH) * 100;
  return finish(
    join(CHAR_DIR, `${id}.webp`),
    webp,
    `bust ${winW}×${winH} at ${left},${top} → ${PORTRAIT_W}×${PORTRAIT_H}; face at ` +
      `${fx.toFixed(0)}%,${fy.toFixed(0)}% of the window` +
      (Math.abs(fx - 50) > 1 || Math.abs(fy - FACE_TOP * 100) > 1 ? ' (clamped to the frame)' : ''),
  );
}

/**
 * THE SPLASH: the visible figure, resized, placed flush right on a transparent
 * 2880×680 canvas (Strive's composition). Height is set from the BODY; width
 * and the canvas height only ever reduce it.
 */
async function saveSplash(id: string, buf: Buffer, m: Measured): Promise<Written> {
  const sharp = await loadSharp();
  const body = m.opaque;
  const seen = m.visible;
  const scale = Math.min(
    (HERO_H * FIGURE_H) / body.height,
    FIGURE_MAX_W / seen.width,
    (HERO_H - FIGURE_BASELINE) / seen.height,
  );
  const figW = Math.max(1, Math.round(seen.width * scale));
  const figH = Math.max(1, Math.round(seen.height * scale));
  const left = Math.max(0, Math.round(HERO_W * FIGURE_RIGHT) - figW);
  const top = Math.max(0, HERO_H - FIGURE_BASELINE - figH);
  const figure = await sharp(buf)
    .extract(seen)
    .resize(figW, figH, { fit: 'fill' })
    .png()
    .toBuffer();
  const webp = await sharp({
    create: {
      width: HERO_W,
      height: HERO_H,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: figure, left, top }])
    .webp({ quality: 82, alphaQuality: 100 })
    .toBuffer();
  return finish(
    join(SPLASH_DIR, `${id}.webp`),
    webp,
    `visible ${seen.width}×${seen.height} at ${seen.left},${seen.top} → ${figW}×${figH} at ` +
      `x${left} y${top} on a transparent ${HERO_W}×${HERO_H} canvas` +
      (figW >= FIGURE_MAX_W ? ' (width-capped)' : ''),
  );
}

// ── the CMS ─────────────────────────────────────────────────────────────────

interface KitItem {
  id: string;
  title?: { en?: string; ja?: string };
  type?: string[];
  category?: string[];
  download?: { url?: string; fileSize?: number };
}

const same = (a: string[] | undefined, b: string[]): boolean =>
  !!a && a.length === b.length && a.every((v, i) => v === b[i]);

async function get(url: string, headers: Record<string, string> = {}): Promise<Response> {
  const res = await fetch(url, { headers: { 'user-agent': UA, referer: FANKIT_PAGE, ...headers } });
  if (!res.ok) throw new Error(`${url.split('?')[0]} → HTTP ${res.status}`);
  return res;
}

/** The kit's service domain and public read key, read from the page's own
 *  bundle. Exactly one of each, or the page shape changed. */
async function scrapeCms(html: string): Promise<{ bundle: string; domain: string; key: string }> {
  const bundles = [
    ...new Set(
      [...html.matchAll(/src="([^"]*\/assets\/js\/event_fankit\.[0-9a-f]+\.js)"/g)].map((m) =>
        new URL(m[1]!, FANKIT_PAGE).toString(),
      ),
    ),
  ];
  if (bundles.length !== 1) {
    throw new Error(
      `${FANKIT_PAGE} references ${bundles.length} event_fankit.<hash>.js bundle(s) — the page ` +
        `shape changed; the CMS key cannot be read.`,
    );
  }
  const js = await (await get(bundles[0]!)).text();
  const one = (re: RegExp, what: string): string => {
    const vals = [...new Set([...js.matchAll(re)].map((m) => m[1]!))];
    if (vals.length !== 1) throw new Error(`${bundles[0]} carries ${vals.length} ${what} value(s)`);
    return vals[0]!;
  };
  return {
    bundle: bundles[0]!,
    domain: one(/serviceDomain:"([a-z0-9-]+)"/g, 'serviceDomain'),
    key: one(/apiKey:"([A-Za-z0-9_-]+)"/g, 'apiKey'),
  };
}

const CMS_ENDPOINT = 'fankit';
const CMS_QUERY = 'limit=1000&fields=title,type,category,download,id';
const KIT_TYPE = ['GBVSR'];
const KIT_CATEGORY = ['キャラクター'];

// ── modes ───────────────────────────────────────────────────────────────────

interface FileRow {
  id: string;
  name: string;
  cmsId: string;
  title: { en: string; ja: string };
  sourceUrl: string;
  sourceSha256: string;
  sourceBytes: number;
  sourceDimensions: string;
  head: {
    x: number;
    y: number;
    density: number;
    estimate: { x: number; y: number; density: number };
  };
  noticeCluster: number;
  portrait: Written;
  splash: Written;
}

const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;

/** Files in the two art dirs that are not `<roster id>.webp`. */
async function orphansIn(ids: Set<string>): Promise<string[]> {
  const out: string[] = [];
  for (const dir of [CHAR_DIR, SPLASH_DIR]) {
    if (!existsSync(dir)) continue;
    for (const f of await readdir(dir)) {
      if (!ids.has(f.replace(/\.webp$/, '')) || !f.endsWith('.webp')) {
        out.push(relative(OUT, join(dir, f)));
      }
    }
  }
  return out;
}

async function fanKit(characters: CharacterRecord[]): Promise<void> {
  const ids = new Set(characters.map((c) => c.id));

  // ── 0. everything that can fail without the network, first ─────────────
  const stale = Object.keys(BUST_HEAD).filter((k) => !ids.has(k));
  const unread = characters.filter((c) => !BUST_HEAD[c.id]).map((c) => c.id);
  if (stale.length || unread.length) {
    throw new Error(
      (stale.length
        ? `BUST_HEAD has ${stale.length} row(s) matching no fighter: ${stale.join(', ')}. ` +
          `A stale key is not inert — the fighter it was meant for has no row.\n  `
        : '') +
        (unread.length
          ? `BUST_HEAD has no row for ${unread.join(', ')}. Every fighter's face is hand-read ` +
            `on the kit render (the estimate is printed, never used).`
          : ''),
    );
  }
  const credit = readArtCredit();
  if (!credit || PAGE_NOTICES.some((n) => !credit.includes(n))) {
    throw new Error(
      `app/app.config.ts artCredit ${JSON.stringify(credit)} must carry ` +
        `${PAGE_NOTICES.map((n) => JSON.stringify(n)).join(' and ')} while Fan Kit art ships.`,
    );
  }
  const orphans = await orphansIn(ids);
  if (orphans.length) {
    throw new Error(
      `${orphans.length} file(s) in the art dirs belong to no roster id: ${orphans.join(', ')}. ` +
        `That is an id that changed and a kit derivative that would ship forever. Delete them ` +
        `deliberately, then re-run.`,
    );
  }
  if (existsSync(PROVENANCE)) {
    const prev = JSON.parse(readFileSync(PROVENANCE, 'utf8')) as {
      method?: string;
      revokedOn?: string;
    };
    if (prev.method === 'generated') {
      throw new Error(
        `data/art-provenance.json records the Fan Kit licence as REVOKED (${prev.revokedOn}). ` +
          `The public terms page cannot say whether Cygames revoked OUR licence, so this run ` +
          `would re-download art we were told to delete. If Cygames has reinstated it in ` +
          `writing, record that, delete data/art-provenance.json by hand, and re-run.`,
      );
    }
  }

  // ── 1. the licence, before anything else is fetched ──────────────────────
  const html = await (await get(FANKIT_PAGE)).text();
  const text = licenceText(html);
  const missing = [
    fold(LICENCE.title),
    ...LICENCE.articles.flatMap((a) => [a.article, ...a.sentences].map(fold)),
    ...PAGE_NOTICES,
  ].filter((s) => !text.includes(s));
  if (missing.length) {
    console.error(
      `✖ the Fan Kit terms on ${FANKIT_PAGE} no longer state, verbatim:\n` +
        missing.map((s) => `    "${s}"`).join('\n') +
        `\n  REFUSING to download anything. Re-read the terms in full; if the grant still ` +
        `permits this use, update LICENCE in scripts/art.ts with the new wording and the date ` +
        `you read it.`,
    );
    process.exit(1);
  }
  const verified = today();
  console.log(
    `▶ licence: ${LICENCE.articles.reduce((n, a) => n + a.sentences.length, 0)} sentence(s) of ` +
      `Articles 1–3 and both notices present verbatim on ${FANKIT_PAGE}`,
  );

  // ── 2. enumerate the kit ────────────────────────────────────────────────
  const cms = await scrapeCms(html);
  const res = (await (
    await get(`https://${cms.domain}.microcms.io/api/v1/${CMS_ENDPOINT}?${CMS_QUERY}`, {
      'X-MICROCMS-API-KEY': cms.key,
    })
  ).json()) as { contents?: KitItem[]; totalCount?: number };
  const items = res.contents ?? [];
  if (!items.length || res.totalCount !== items.length) {
    throw new Error(
      `the kit CMS returned ${items.length} of ${res.totalCount} item(s) — past limit=1000 this ` +
        `needs paging, and an empty list means the endpoint changed.`,
    );
  }
  const chars = items.filter((i) => same(i.type, KIT_TYPE) && same(i.category, KIT_CATEGORY));
  const nearMiss = items.filter(
    (i) =>
      !chars.includes(i) &&
      (i.type ?? []).includes(KIT_TYPE[0]!) &&
      (i.category ?? []).includes(KIT_CATEGORY[0]!),
  );
  if (nearMiss.length) {
    throw new Error(
      `${nearMiss.length} kit item(s) are tagged GBVSR × キャラクター alongside other tags ` +
        `(${nearMiss.map((i) => i.title?.en ?? i.id).join(', ')}) — the CMS's tagging changed; ` +
        `decide deliberately whether they belong.`,
    );
  }
  console.log(
    `▶ ${cms.domain}.microcms.io/${CMS_ENDPOINT}: ${items.length} item(s), ${chars.length} ` +
      `GBVSR × キャラクター`,
  );

  // ── 3. both names resolve to one fighter, or it is a known extra ────────
  const matcher = buildAliasMatcher(characters);
  const whole = (t: string | undefined): string | null => {
    if (!t) return null;
    const n = normalizeText(t);
    const f = matcher.find(n);
    return f.length === 1 && f[0]!.start === 0 && f[0]!.end === n.length ? f[0]!.id : null;
  };
  const byId = new Map<string, KitItem>();
  const extrasSeen = new Set<string>();
  const problems: string[] = [];
  for (const item of chars) {
    const en = item.title?.en ?? '';
    const idEn = whole(en);
    const idJa = whole(item.title?.ja);
    if (!idEn && !idJa && KNOWN_EXTRAS[en]) {
      if (extrasSeen.has(en)) problems.push(`the extra "${en}" is listed twice`);
      extrasSeen.add(en);
      continue;
    }
    if (!idEn || idEn !== idJa) {
      problems.push(
        `"${en}" / "${item.title?.ja}" resolve to ${idEn ?? 'nothing'} / ${idJa ?? 'nothing'} — ` +
          (idEn || idJa
            ? 'the two names disagree'
            : 'an unknown item: a new fighter (run `npm run data:characters`) or a new extra ' +
              '(add it to KNOWN_EXTRAS with the reason)'),
      );
      continue;
    }
    if (byId.has(idEn)) problems.push(`${idEn} appears twice ("${en}")`);
    byId.set(idEn, item);
  }
  for (const c of characters) {
    if (!byId.has(c.id)) problems.push(`${c.id}: no kit item — Article 1 leaves no other source`);
  }
  for (const e of Object.keys(KNOWN_EXTRAS)) {
    if (!extrasSeen.has(e)) problems.push(`KNOWN_EXTRAS "${e}" is no longer in the kit — stale`);
  }
  for (const [id, item] of byId) {
    const url = item.download?.url ?? '';
    if (!/^https:\/\/files\.microcms-assets\.io\/assets\/[^?#]+\.png$/.test(url)) {
      problems.push(`${id}: download url ${JSON.stringify(url)} is not a microCMS-assets PNG`);
    }
  }
  if (problems.length) {
    throw new Error(
      `the kit does not hold exactly the ${characters.length} fighters + ` +
        `${Object.keys(KNOWN_EXTRAS).length} known extra(s):\n` +
        problems.map((p) => `    ${p}`).join('\n'),
    );
  }

  // ── 4. build, one fighter at a time ─────────────────────────────────────
  const sharp = await loadSharp();
  await mkdir(CHAR_DIR, { recursive: true });
  await mkdir(SPLASH_DIR, { recursive: true });
  const rows: FileRow[] = [];
  const failures: string[] = [];
  for (const c of characters) {
    const item = byId.get(c.id)!;
    const url = item.download!.url!;
    let bytes: Buffer;
    try {
      bytes = Buffer.from(await (await get(url)).arrayBuffer());
    } catch (e) {
      failures.push(`${c.id}: ${(e as Error).message}`);
      continue;
    }
    const meta = await sharp(bytes).metadata();
    const row = BUST_HEAD[c.id]!;
    if (
      meta.format !== 'png' ||
      !meta.hasAlpha ||
      meta.width !== KIT_WIDTH ||
      meta.height !== row.h
    ) {
      failures.push(
        `${c.id}: ${url.split('/').pop()} is ${meta.format} ${meta.width}×${meta.height}` +
          `${meta.hasAlpha ? '' : ' with NO alpha'}; BUST_HEAD was read on ${KIT_WIDTH}×${row.h}` +
          ` — the kit re-cut this file, so re-read the row on the new render`,
      );
      continue;
    }
    const W = meta.width;
    const H = meta.height;
    const m = await measure(bytes);
    if (m.noticeCluster >= NOTICE_CLUSTER_MAX) {
      failures.push(
        `${c.id}: ${m.noticeCluster} small isolated shapes on one line at the top/bottom edge — ` +
          `that is what a baked copyright notice looks like, and the crop would delete it ` +
          `(Article 2). Look at the render before anything ships.`,
      );
      continue;
    }
    const face = { x: row.x * W, y: row.y * H };
    const density = await densityAt(bytes, W, H, face.x, face.y);
    const estDensity = await densityAt(bytes, W, H, m.est.x, m.est.y);
    if (density < DENSITY_MIN) {
      failures.push(
        `${c.id}: the face crosshair (BUST_HEAD ${row.x}, ${row.y}) is at source pixel ` +
          `(${Math.round(face.x)}, ${Math.round(face.y)}), where only ` +
          `${(density * 100).toFixed(1)}% of the surrounding ${DENSITY_R}px is opaque. The ` +
          `window would centre on empty background. Re-read the position ON THE RENDER — the ` +
          `biggest shape near the top is often a weapon, a prop or a wing, not the head.`,
      );
      continue;
    }
    const portrait = await savePortrait(c.id, bytes, W, H, m, face);
    const splash = await saveSplash(c.id, bytes, m);
    rows.push({
      id: c.id,
      name: c.name,
      cmsId: item.id,
      title: { en: item.title!.en!, ja: item.title!.ja! },
      sourceUrl: url,
      sourceSha256: sha256(bytes),
      sourceBytes: bytes.length,
      sourceDimensions: `${W}×${H}`,
      head: {
        x: row.x,
        y: row.y,
        density: Number(density.toFixed(3)),
        estimate: {
          x: Number((m.est.x / W).toFixed(3)),
          y: Number((m.est.y / H).toFixed(3)),
          density: Number(estDensity.toFixed(3)),
        },
      },
      noticeCluster: m.noticeCluster,
      portrait,
      splash,
    });
    console.log(
      `  ${c.id.padEnd(14)} ${W}×${String(H).padEnd(5)} TABLE ${pct(row.x)},${pct(row.y)} ` +
        `(${(density * 100).toFixed(0)}% opaque) vs estimated ${pct(m.est.x / W)},` +
        `${pct(m.est.y / H)} (${(estDensity * 100).toFixed(0)}%)  ` +
        `${(portrait.bytes / 1024).toFixed(0)}+${(splash.bytes / 1024).toFixed(0)} KB`,
    );
  }

  // ── 5. FAIL LOUD ─────────────────────────────────────────────────────────
  if (failures.length) {
    console.error(
      `\n✖ ${failures.length} fighter(s) have no art:\n${failures.map((f) => `    ${f}`).join('\n')}` +
        `\n  Nothing generated in their place: Article 1 leaves no other source, and a fighter ` +
        `silently wearing a generated tile looks deliberate. Files already written for the ` +
        `others are byte-deterministic re-crops; data/art-provenance.json was NOT rewritten.`,
    );
    process.exit(1);
  }
  await verifyOutputs(ids, true);

  // How often the estimate would have framed the face: within a tenth of the
  // width of the hand-read point AND on the figure.
  const estimateMisses = rows.filter(
    (r) =>
      Math.hypot(r.head.estimate.x - r.head.x, (r.head.estimate.y - r.head.y) * 1.3) > 0.1 ||
      r.head.estimate.density < DENSITY_MIN,
  );
  const provenance = {
    method: 'fan-kit',
    source: {
      page: FANKIT_PAGE,
      bundle: cms.bundle,
      cms: {
        serviceDomain: cms.domain,
        endpoint: CMS_ENDPOINT,
        query: CMS_QUERY,
        filter: `type == ${JSON.stringify(KIT_TYPE)} && category == ${JSON.stringify(KIT_CATEGORY)}`,
        items: items.length,
        matched: chars.length,
      },
      note: 'Every URL below was read from the CMS response; none was constructed. The public read key is scraped from the bundle at run time and never recorded.',
    },
    licence: LICENCE,
    licenceVerified: verified,
    credit,
    fetched: verified,
    processing:
      'Crop + resize only. Portrait: a 3:4 bust window, resized to 512×683 WebP with the ' +
      'alpha kept. Splash: the visible figure resized onto a transparent 2880×680 canvas. No ' +
      'recolouring, no background composited behind or over the figure; each source scanned ' +
      'for a baked notice before cropping (none found).',
    framing: {
      portrait: {
        width: PORTRAIT_W,
        height: PORTRAIT_H,
        bustHeight: BUST_HEIGHT,
        faceTop: FACE_TOP,
      },
      splash: {
        width: HERO_W,
        height: HERO_H,
        figureHeight: FIGURE_H,
        figureRight: FIGURE_RIGHT,
        figureBaseline: FIGURE_BASELINE,
        figureMaxWidth: FIGURE_MAX_W,
        requires: "GameConfig.heroFocus '100% 50%'",
      },
      head: {
        table: rows.length,
        estimated: 0,
        estimateWouldMiss: estimateMisses.map((r) => r.id),
        densityRadius: DENSITY_R,
        densityMin: DENSITY_MIN,
      },
    },
    knownExtras: chars
      .filter((i) => KNOWN_EXTRAS[i.title?.en ?? ''])
      .map((i) => ({
        title: i.title?.en,
        cmsId: i.id,
        sourceUrl: i.download?.url ?? null,
        downloaded: false,
        reason: KNOWN_EXTRAS[i.title!.en!],
      })),
    files: rows,
  };
  await mkdir(join(OUT, 'data'), { recursive: true });
  await writeFile(PROVENANCE, `${JSON.stringify(provenance, null, 2)}\n`);

  const total = rows.reduce((n, r) => n + r.portrait.bytes + r.splash.bytes, 0);
  const lowest = rows.reduce((a, b) => (b.head.density < a.head.density ? b : a));
  console.log(
    `\n✓ ${rows.length} fighter(s) from the Fan Kit — ${rows.length * 2} files, ` +
      `${(total / 1024 / 1024).toFixed(1)} MB → ${relative(ROOT, CHAR_DIR) || CHAR_DIR}, ` +
      `${relative(ROOT, SPLASH_DIR) || SPLASH_DIR}\n` +
      `  heads: ${rows.length} TABLE, 0 estimated; lowest crosshair density ` +
      `${(lowest.head.density * 100).toFixed(0)}% (${lowest.id}); the top-of-figure estimate ` +
      `would have missed the face on ${estimateMisses.length}/${rows.length}\n` +
      `  licence verified ${verified}; credit ${JSON.stringify(credit)}; provenance in ` +
      `${relative(ROOT, PROVENANCE) || PROVENANCE}`,
  );
}

/** Both directions: every roster id has both files at the right size, and
 *  nothing else is in either dir. */
async function verifyOutputs(ids: Set<string>, alpha: boolean): Promise<void> {
  const sharp = await loadSharp();
  const errs: string[] = [...(await orphansIn(ids)).map((f) => `${f}: belongs to no roster id`)];
  for (const id of ids) {
    for (const [dir, w, h] of [
      [CHAR_DIR, PORTRAIT_W, PORTRAIT_H],
      [SPLASH_DIR, HERO_W, HERO_H],
    ] as const) {
      const f = join(dir, `${id}.webp`);
      if (!existsSync(f)) {
        errs.push(`${relative(OUT, f)}: missing`);
        continue;
      }
      const meta = await sharp(f).metadata();
      if (meta.format !== 'webp' || meta.width !== w || meta.height !== h) {
        errs.push(
          `${relative(OUT, f)}: ${meta.format} ${meta.width}×${meta.height}, want webp ${w}×${h}`,
        );
      } else if (alpha && !meta.hasAlpha) {
        errs.push(`${relative(OUT, f)}: the alpha was lost`);
      }
    }
  }
  if (errs.length)
    throw new Error(`the art dirs are not exactly the roster:\n    ${errs.join('\n    ')}`);
}

// ── --generated: the Article 3 path ─────────────────────────────────────────

/** The engine's own missing-art tile (utils/format.ts accentGradient over the
 *  grid's bg-surface), rebuilt in SVG, so a generated tile is the SAME tile the
 *  grid draws when an image fails to load, rather than a third design. */
const TILE_SURFACE = '#171933';
const TILE_INK = '#0E0F1F';

const accentGround = (accent: string, w: number, h: number): string =>
  `<defs><linearGradient id="g" x1="0" y1="0" x2="0.5" y2="0.866">` +
  `<stop offset="0" stop-color="${accent}" stop-opacity="1"/>` +
  `<stop offset="1" stop-color="${accent}" stop-opacity="0.2"/></linearGradient></defs>` +
  `<rect width="${w}" height="${h}" fill="${TILE_SURFACE}"/>` +
  `<rect width="${w}" height="${h}" fill="url(#g)"/>`;

/** The fighter's name in the display face as outlines, centred on (cx, cy),
 *  in the engine's fallback ink (text-bg/70). One line, or two when a
 *  multi-word name gains at least a quarter in size by breaking. */
function nameBlock(
  font: opentype.Font,
  name: string,
  boxW: number,
  cx: number,
  cy: number,
  cap: number,
): string {
  let lines = [name];
  let size = fitSize(font, name, boxW, cap);
  const words = name.split(' ');
  for (let i = 1; i < words.length; i++) {
    const two = [words.slice(0, i).join(' '), words.slice(i).join(' ')];
    const s = Math.min(...two.map((l) => fitSize(font, l, boxW, cap)));
    if (s > size * 1.25) {
      size = s;
      lines = two;
    }
  }
  const capH = capHeight(font, size);
  const gap = size * 0.3;
  let baseline = cy - (lines.length * capH + (lines.length - 1) * gap) / 2 + capH;
  return lines
    .map((l) => {
      const svg = outlines(font, l, size, TILE_INK, cx - widthOf(font, l, size) / 2, baseline, 0.7);
      baseline += capH + gap;
      return svg;
    })
    .join('');
}

async function generated(characters: CharacterRecord[]): Promise<void> {
  // The guard, proven live before anything else runs.
  let fired = false;
  try {
    await fetch(FANKIT_PAGE);
  } catch (e) {
    fired = e instanceof Error && e.message.startsWith(NO_NETWORK);
  }
  if (!fired) {
    throw new Error(
      'the no-network guard did not fire: something restored the real `fetch`, and the ' +
        'revocation path is one careless line from downloading kit art again.',
    );
  }

  const sharp = await loadSharp();
  const { fonts, proof } = await assertFonts();
  const font = fonts.display;
  const ids = new Set(characters.map((c) => c.id));
  const badAccent = characters.filter((c) => !/^#[0-9A-Fa-f]{6}$/.test(c.accent));
  if (badAccent.length) {
    throw new Error(`non-hex accent(s): ${badAccent.map((c) => `${c.id}=${c.accent}`).join(', ')}`);
  }

  // The last licence reading, kept for the record.
  let lastVerified: string | null = null;
  if (existsSync(PROVENANCE)) {
    const prev = JSON.parse(readFileSync(PROVENANCE, 'utf8')) as {
      licenceVerified?: string;
      licence?: { lastVerified?: string | null };
    };
    lastVerified = prev.licenceVerified ?? prev.licence?.lastVerified ?? null;
  }

  // ── delete EVERY file in both dirs: each is a kit derivative or an orphan ─
  const removed: string[] = [];
  for (const dir of [CHAR_DIR, SPLASH_DIR]) {
    await mkdir(dir, { recursive: true });
    for (const f of await readdir(dir)) {
      const p = join(dir, f);
      if ((await stat(p)).isDirectory()) {
        throw new Error(`${relative(OUT, p)} is a directory — refusing to guess what it holds`);
      }
      await rm(p);
      removed.push(relative(OUT, p));
    }
  }

  const files: {
    id: string;
    name: string;
    accent: string;
    portrait: Written;
    splash: Written;
  }[] = [];
  for (const c of characters) {
    const portraitSvg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${PORTRAIT_W}" height="${PORTRAIT_H}">` +
      accentGround(c.accent, PORTRAIT_W, PORTRAIT_H) +
      nameBlock(font, c.name, PORTRAIT_W * 0.78, PORTRAIT_W / 2, PORTRAIT_H * 0.42, 110) +
      `</svg>`;
    const portrait = await finish(
      join(CHAR_DIR, `${c.id}.webp`),
      await sharp(Buffer.from(portraitSvg)).webp({ quality: 88 }).toBuffer(),
      `generated: accent ground ${c.accent} with "${c.name}" as Cinzel Decorative outlines`,
    );

    // The splash: a transparent hero canvas with a cut-corner slab standing
    // where a figure would — the portrait's 3:4, FIGURE_H tall, flush right at
    // FIGURE_RIGHT — so the engine's backplate and accent radial still show.
    const SH = Math.round(HERO_H * FIGURE_H);
    const SW = Math.round(SH * 0.75);
    const sx = Math.round(HERO_W * FIGURE_RIGHT) - SW;
    const sy = HERO_H - FIGURE_BASELINE - SH;
    const CUT = 40;
    const splashSvg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${HERO_W}" height="${HERO_H}">` +
      `<clipPath id="slab"><path d="M${sx} ${sy} H${sx + SW - CUT} L${sx + SW} ${sy + CUT} ` +
      `V${sy + SH} H${sx} Z"/></clipPath>` +
      `<g clip-path="url(#slab)"><g transform="translate(${sx} ${sy})">` +
      accentGround(c.accent, SW, SH) +
      `</g></g>` +
      nameBlock(font, c.name, SW * 0.78, sx + SW / 2, sy + SH * 0.42, 100) +
      `</svg>`;
    const splash = await finish(
      join(SPLASH_DIR, `${c.id}.webp`),
      await sharp(Buffer.from(splashSvg)).webp({ quality: 88, alphaQuality: 100 }).toBuffer(),
      `generated: ${SW}×${SH} cut-corner slab on ${c.accent} at x${sx}, transparent canvas`,
    );
    files.push({ id: c.id, name: c.name, accent: c.accent, portrait, splash });
  }
  await verifyOutputs(ids, false);

  const revokedOn = today();
  const provenance = {
    method: 'generated',
    reason: 'Fan Kit licence revoked (Article 3)',
    revokedOn,
    note:
      'Every Fan Kit derivative in public/img/char and public/img/splash was deleted (Article 3: ' +
      '"the user must immediately destroy or delete the Copyrighted Materials and all copies ' +
      'thereof") and every fighter redrawn from its data/characters.json accent, with the name ' +
      'in Cinzel Decorative outlines from design/fonts. Nothing was fetched: global fetch was ' +
      'replaced by a throwing stub, proven live before drawing. Article 1 leaves no other ' +
      'permitted source, so there is no vendor art at all until the licence is reinstated.',
    licence: { ...LICENCE, lastVerified },
    credit: null,
    removed,
    files,
  };
  await mkdir(join(OUT, 'data'), { recursive: true });
  await writeFile(PROVENANCE, `${JSON.stringify(provenance, null, 2)}\n`);

  // The OG card carries the credit line, so it changes too: resolveCredit
  // reads method "generated" from the provenance just written and drops it.
  const og = await renderOgCard({ root: OUT });

  const total = files.reduce((n, f) => n + f.portrait.bytes + f.splash.bytes, 0);
  const scratch = OUT !== ROOT;
  console.log(
    `✓ --generated${scratch ? ` into ${OUT}` : ''}: ${removed.length} file(s) deleted, ` +
      `${files.length * 2} generated (${(total / 1024).toFixed(0)} KB), no network\n` +
      `  fonts verified: ${proof}\n` +
      `  ${relative(OUT, og.file)} re-rendered: ${og.summary.split('\n')[0]}\n` +
      `  provenance: method "generated", revoked ${revokedOn}, licence kept for the record` +
      (scratch
        ? ''
        : `\n\n  STILL TO DO BY HAND (a revocation is more than this directory):\n` +
          `    · app/app.config.ts artCredit — drop the "Character art" clause\n` +
          `    · replay-database-shell's selector card is a byte-copy of public/og-default.png — re-copy it\n` +
          `    · git history and earlier Vercel deployments still hold the kit derivatives; Article 3\n` +
          `      asks for "all copies" — decide on a history rewrite and deleting old deployments\n` +
          `    · data/art-provenance.json no longer carries licenceVerified, so expiries.ts's\n` +
          `      90-day licence re-read goes quiet (there is no licence left to re-read)`),
  );
}

async function main(): Promise<void> {
  if (UNKNOWN_ARGS.length) {
    throw new Error(
      `unknown argument(s) ${UNKNOWN_ARGS.join(' ')} — the modes are the default (Fan Kit), ` +
        `--generated, and --out=<dir>. Refusing to guess, because the default downloads.`,
    );
  }
  if (OUT_ARG && OUT_ARG.length <= '--out='.length) throw new Error('--out= needs a directory');
  const characters = await loadCharacters();
  if (GENERATED) await generated(characters);
  else await fanKit(characters);
}

main().catch((e: unknown) => {
  console.error(`\n✖ art.ts: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
