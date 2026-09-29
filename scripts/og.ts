/**
 * Generate public/og-default.png — the site-wide OG/Twitter card, and the
 * shell's selector card for this game (the shell byte-copies each game repo's
 * og-default.png, so this file speaks the PLATFORM's card language: a
 * cut-corner badge in the game's primary carrying the platform slash, the
 * title, a tagline, and a footer stripe that is the roster).
 *
 * Ported from Strive's scripts/og.ts, with Avatar's sha256 font pins. It also
 * exports the font gate and the outline helpers, because scripts/art.ts draws
 * its dormant generated tiles (the Article 3 revocation path) with the same
 * faces and must pass the same gate.
 *
 * ── WHY EVERY STRING IS AN OUTLINE, NOT <text> ────────────────────────────
 * CotW measured that the prebuilt sharp's librsvg resolves no named family at
 * all (Strive og.ts:9-18): `font-family="Anton"`, `"DejaVu Sans"` and
 * `"__nope__"` rendered byte-identical. Avatar later measured the opposite on
 * its sharp once FONTCONFIG_FILE pointed at the committed TTFs. Two siblings,
 * two answers — so this file does not depend on font resolution at raster time
 * at all. Every string is converted from the committed OFL TTFs to SVG path
 * data with opentype.js and drawn as filled outlines, one path per glyph
 * (librsvg truncates a long `d`), serialised by pathData below rather than by
 * opentype.js, whose toPathData emits NaN at particular sizes — the cause of
 * the "NaN from multi-glyph layout" CotW recorded, found here. FONTCONFIG_FILE
 * is still set before sharp loads, so a future <text> could not silently
 * resolve the host's DejaVu.
 *
 * ── CHECKLIST 5d: PROVE THE TYPEFACE DREW, PER SUBSET ─────────────────────
 * With outlines the failure is no longer "the renderer fell back"; it is "the
 * outlines came from the wrong file" or "a codepoint had no glyph and drew
 * .notdef or nothing". The gate (assertFonts) has four arms, each of which a
 * plausible failure would pass without the others:
 *
 *   1. FILE IDENTITY — sha256 of each TTF against a pin measured on these exact
 *      files (2026-09-29). Swapped, truncated or zero-filled fails here, named.
 *   2. KNOWN METRIC — unitsPerEm and the advance of 'G', measured on the same
 *      files. A re-pinned hash on a different face still has to agree.
 *   3. CMAP COVERAGE, PER SUBSET, PER FACE — every codepoint of both probe
 *      strings maps to a real glyph (index ≠ 0, so not .notdef) with contours
 *      and finite geometry. `ō` (U+014D) is the latin-ext witness: every
 *      roster name is ASCII, so a latin-only probe would report green while the
 *      latin-ext subset had never been proven. The Cinzel Decorative faces must
 *      ALSO draw lowercase differently from the capital. Measured on these
 *      files, that face's "lowercase" is not small caps at all: the lowercase
 *      codepoints draw the plain Roman capitals at FULL cap height, and the
 *      uppercase codepoints the swash capitals — so "Granblue" renders as a
 *      swash G and plain capitals, and a lowercase that fell onto the capital
 *      outline would look deliberate.
 *   4. THE RENDERER DREW IT — each probe is rasterised as outlines through
 *      sharp, in all four faces: every raster must carry ink, and the four must
 *      be pairwise DISTINCT per subset (Avatar's identity arm). Two identical
 *      rasters mean two slots hold one face.
 *
 * The probe strings are the vendor's own codepoints, as design/fonts/fonts.conf
 * names them: "2B" is the roster's one digit-leading name, "ID" the shortest,
 * "AVATAR BELIAL" the nested one; the lowercase words prove the face draws them apart from its capitals; the
 * en dash and middot are the card's own furniture.
 *
 * ── THE NOTICE IS BAKED IN, AND THE CARD SHOWS NO KIT ART ─────────────────
 * The card carries app/app.config.ts `artCredit` verbatim, above the stripe: a
 * link preview travels without the site footer. It shows NO Fan Kit art, by
 * choice (2026-09-29): the shell byte-copies this file onto a different page,
 * every sibling card is type-and-stripe, and a card with no Cygames art is one
 * that Article 3's revocation never has to touch — the only thing a revocation
 * changes here is the credit line (see resolveCredit), and scripts/art.ts
 * `--generated` re-renders it offline.
 *
 * Run: npm run data:og   (manual — the card changes when the brand, the roster
 *                         or the art licence does; never in the cron)
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import opentype from 'opentype.js';

import type { CharacterRecord } from '../types/index';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const FONT_DIR = join(ROOT, 'design', 'fonts');

// BEFORE sharp's native binding initialises fontconfig. A static `import sharp`
// is hoisted above every statement in the module (CotW og.ts, lesson 2), so
// every consumer gets sharp through loadSharp(), never a top-level import. This
// assignment runs on IMPORT, which is what makes it correct for scripts/art.ts
// too: that file imports this one and so inherits the environment first.
process.env.FONTCONFIG_FILE = join(FONT_DIR, 'fonts.conf');

export const loadSharp = async (): Promise<typeof import('sharp').default> =>
  (await import('sharp')).default;

// ── the font gate (checklist 5d) ────────────────────────────────────────────

export type FaceKey = 'display' | 'displayBold' | 'ui' | 'uiBold';

export interface Face {
  file: string;
  /** sha256 of the committed file, measured in-session 2026-09-29. */
  sha256: string;
  unitsPerEm: number;
  /** advanceWidth of 'G' in font units, measured on the same file. */
  advanceG: number;
}

/** All four are load-bearing across the two generators: this card sets its
 *  title in both Cinzel Decorative cuts and its prose in Figtree Regular, and
 *  scripts/art.ts `--generated` sets every fighter name in Cinzel Decorative
 *  Black — so the gate proves all four rather than the ones one script uses. */
export const FACES: Record<FaceKey, Face> = {
  display: {
    file: 'CinzelDecorative-Black.ttf',
    sha256: 'a6c1eb3e228f639a98aafd8a8e8a035582dd50ad5f8a84e9dcbc8664e7457114',
    unitsPerEm: 1000,
    advanceG: 872,
  },
  displayBold: {
    file: 'CinzelDecorative-Bold.ttf',
    sha256: 'e854e68a388aa50d742a4415c1ae5c17a617ef7956c95a70021d0a4a44f20518',
    unitsPerEm: 1000,
    advanceG: 861,
  },
  ui: {
    file: 'Figtree-Regular.ttf',
    sha256: '448d74e778cc9774db27bd86cf451bba982b2e4dc348f610390eb6e3439cf6ca',
    unitsPerEm: 1000,
    advanceG: 760,
  },
  uiBold: {
    file: 'Figtree-Bold.ttf',
    sha256: '71a35e2bd92a05427e2dc9897bab41f8a865800e148238007735b5934508198a',
    unitsPerEm: 1000,
    advanceG: 743,
  },
};

/** design/fonts/fonts.conf's two probe strings, verbatim. */
export const PROBE_LATIN = "2B ID AVATAR BELIAL Granblue Rising Replay 0123456789 3–2 · '";
export const PROBE_LATIN_EXT = 'ō';

export type Fonts = Record<FaceKey, opentype.Font>;

interface Glyph {
  /** SVG path data for ONE glyph, drawn at the origin (baseline at y = size). */
  path: string;
  /** x offset of this glyph within the string, in px. */
  dx: number;
}

/**
 * A glyph path as SVG `d`, serialised HERE rather than by opentype.js.
 *
 * opentype.js 2.0.0's Path.toPathData emits literal `NaN` for thousands of
 * (glyph, size) pairs — 12,435 over every glyph of these four faces at 6–200
 * px, measured 2026-09-29; Cinzel Decorative Black's 'K' at 72 px is one. The
 * geometry is fine: `path.commands` holds finite numbers. The defect is in its
 * roundDecimal, which rounds by string concatenation — `decimalPart + "e+" +
 * places` — so a fractional part small enough to stringify in exponent form
 * ("1.4e-14") becomes "1.4e-14e+2", which is NaN. That is size-dependent, not
 * layout-dependent, and is very likely what CotW recorded as "NaN from
 * multi-glyph layout" (Strive og.ts:116). Formatting the commands ourselves
 * removes it; the finiteness check stays, per number.
 */
export function pathData(path: opentype.Path, what: string): string {
  const f = (v: number | undefined): string => {
    if (v === undefined || !Number.isFinite(v)) {
      throw new Error(
        `non-finite path geometry for ${what} — librsvg stops parsing a path at the first bad ` +
          `number, so this glyph would have rendered as a gap.`,
      );
    }
    return String(Math.round(v * 100) / 100 || 0);
  };
  return path.commands
    .map((c) => {
      switch (c.type) {
        case 'M':
        case 'L':
          return `${c.type}${f(c.x)} ${f(c.y)}`;
        case 'Q':
          return `Q${f(c.x1)} ${f(c.y1)} ${f(c.x)} ${f(c.y)}`;
        case 'C':
          return `C${f(c.x1)} ${f(c.y1)} ${f(c.x2)} ${f(c.y2)} ${f(c.x)} ${f(c.y)}`;
        case 'Z':
          return 'Z';
        default:
          throw new Error(`unknown path command ${JSON.stringify(c)} in ${what}`);
      }
    })
    .join('');
}

/**
 * Text → ONE PATH PER GLYPH, each at the origin, positioned by the font's own
 * advances and kern pairs. Per glyph for librsvg's sake (it truncates a long
 * `d`), and so a glyph that fails stops the build rather than rendering as a
 * gap that reads as letter-spacing.
 */
export function glyphsOf(font: opentype.Font, text: string, size: number): Glyph[] {
  const scale = size / font.unitsPerEm;
  const out: Glyph[] = [];
  let dx = 0;
  const chars = [...text];
  for (const [i, ch] of chars.entries()) {
    const glyph = font.charToGlyph(ch);
    if (ch !== ' ') {
      const d = pathData(glyph.getPath(0, size, size), `${JSON.stringify(ch)} at size ${size}`);
      if (d) out.push({ path: d, dx });
    }
    dx += glyph.advanceWidth! * scale;
    const next = chars[i + 1];
    if (next) dx += font.getKerningValue(glyph, font.charToGlyph(next)) * scale;
  }
  return out;
}

/** Total advance of `text`, with the same metrics glyphsOf lays out with. */
export function widthOf(font: opentype.Font, text: string, size: number): number {
  const scale = size / font.unitsPerEm;
  const chars = [...text];
  let w = 0;
  for (const [i, ch] of chars.entries()) {
    const g = font.charToGlyph(ch);
    w += g.advanceWidth! * scale;
    const next = chars[i + 1];
    if (next) w += font.getKerningValue(g, font.charToGlyph(next)) * scale;
  }
  return w;
}

/** Cap height of `font` at `size`, from its own 'H' bounds. */
export const capHeight = (font: opentype.Font, size: number): number =>
  (font.charToGlyph('H').getBoundingBox().y2 / font.unitsPerEm) * size;

/** `text` as outline <g> elements with its BASELINE at (left, baseline). */
export function outlines(
  font: opentype.Font,
  text: string,
  size: number,
  fill: string,
  left: number,
  baseline: number,
  opacity = 1,
): string {
  const top = baseline - size; // glyphsOf draws the baseline at y = size
  const op = opacity === 1 ? '' : ` fill-opacity="${opacity}"`;
  return glyphsOf(font, text, size)
    .map(
      (g) =>
        `<g transform="translate(${(left + g.dx).toFixed(2)} ${top.toFixed(2)})">` +
        `<path d="${g.path}" fill="${fill}"${op}/></g>`,
    )
    .join('');
}

/** Largest size at which `text` spans at most `maxWidth`, never above `cap`. */
export const fitSize = (font: opentype.Font, text: string, maxWidth: number, cap: number): number =>
  Math.min(cap, Math.floor(maxWidth / widthOf(font, text, 1)));

/** Ink width of a rendered SVG, via trim; 0 when nothing drew. */
async function inkWidth(svg: string): Promise<{ width: number; png: Buffer }> {
  const sharp = await loadSharp();
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  try {
    const { info } = await sharp(png).trim({ threshold: 10 }).toBuffer({ resolveWithObject: true });
    return { width: info.width, png };
  } catch {
    // sharp refuses to trim a uniform image — exactly the "nothing drew" case.
    return { width: 0, png };
  }
}

/**
 * THE GATE. Throws with the offending file named; returns the parsed fonts and
 * a one-line summary of what it proved.
 */
export async function assertFonts(): Promise<{ fonts: Fonts; proof: string }> {
  const fonts = {} as Fonts;
  const problems: string[] = [];
  const probes = [
    { label: 'latin', text: PROBE_LATIN },
    { label: 'latin-ext', text: PROBE_LATIN_EXT },
  ];

  for (const [key, face] of Object.entries(FACES) as [FaceKey, Face][]) {
    const bytes = readFileSync(join(FONT_DIR, face.file));
    // ── arm 1: file identity
    const sha = createHash('sha256').update(bytes).digest('hex');
    if (sha !== face.sha256) {
      problems.push(
        `${face.file}: sha256 ${sha.slice(0, 16)}… (pinned ${face.sha256.slice(0, 16)}…)`,
      );
      continue;
    }
    const font = opentype.parse(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length),
    );
    // ── arm 2: known metric
    const adv = font.charToGlyph('G').advanceWidth;
    if (font.unitsPerEm !== face.unitsPerEm || adv !== face.advanceG) {
      problems.push(
        `${face.file}: unitsPerEm ${font.unitsPerEm} / 'G' advance ${adv} ` +
          `(expected ${face.unitsPerEm} / ${face.advanceG})`,
      );
      continue;
    }
    // ── arm 3: cmap coverage, per subset
    for (const p of probes) {
      const bad = [...new Set(p.text)].filter((ch) => {
        if (ch === ' ') return false;
        if (font.charToGlyphIndex(ch) === 0) return true;
        return pathData(font.charToGlyph(ch).getPath(0, 100, 100), JSON.stringify(ch)) === '';
      });
      if (bad.length) {
        problems.push(
          `${face.file}: the ${p.label} probe has no drawable glyph for ` +
            bad.map((c) => `${JSON.stringify(c)} U+${c.codePointAt(0)!.toString(16)}`).join(', '),
        );
      }
    }
    if (key === 'display' || key === 'displayBold') {
      // Measured 2026-09-29: this face has no lowercase in the usual sense.
      // The lowercase codepoints draw the plain Roman CAPITALS at full cap
      // height (r: y 0…700), and the uppercase codepoints the SWASH capitals
      // (R: y −236…700). So the check is "a different drawing", not "shorter":
      // a lowercase that landed on the capital's outline would make the
      // probe's lowercase words prove nothing.
      const outline = (ch: string): string =>
        pathData(font.charToGlyph(ch).getPath(0, 100, 100), JSON.stringify(ch));
      const same = [...'granbluesiyp'].filter((ch) => outline(ch) === outline(ch.toUpperCase()));
      if (same.length) {
        problems.push(
          `${face.file}: lowercase draws the same outline as the capital for ` +
            `${same.join('')} — the face's plain-capital/swash-capital split is gone`,
        );
      }
    }
    fonts[key] = font;
  }
  if (problems.length) {
    throw new Error(
      `design/fonts/ does not hold the faces this card was designed on:\n    ` +
        problems.join('\n    ') +
        `\n  The TTFs are committed so the render cannot depend on the host; a swapped or ` +
        `truncated file would otherwise ship a plausible substitute with no error. If a font ` +
        `was deliberately updated, re-measure FACES in scripts/og.ts and say where it came from.`,
    );
  }

  // ── arm 4: the renderer drew it, and the four faces drew four things
  let rasters = 0;
  for (const p of probes) {
    const seen = new Map<string, string>();
    for (const [key, font] of Object.entries(fonts) as [FaceKey, opentype.Font][]) {
      const size = 96;
      const w = Math.ceil(widthOf(font, p.text, size)) + 40;
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="160">` +
        `<rect width="100%" height="100%" fill="#FFFFFF"/>` +
        outlines(font, p.text, size, '#000000', 20, 120) +
        `</svg>`;
      const { width, png } = await inkWidth(svg);
      if (width === 0) {
        throw new Error(`${FACES[key].file} drew NO ink for the ${p.label} probe.`);
      }
      const hash = createHash('sha256').update(png).digest('hex');
      const twin = seen.get(hash);
      if (twin) {
        throw new Error(
          `${FACES[key].file} and ${twin} rasterise the ${p.label} probe IDENTICALLY — two ` +
            `slots hold one face, and the card would ship in the wrong cut with no error.`,
        );
      }
      seen.set(hash, FACES[key].file);
      rasters++;
    }
  }
  return {
    fonts,
    proof:
      `${Object.keys(FACES).length} TTF(s) sha256-pinned; latin + latin-ext probes covered ` +
      `(no .notdef) in every face; ${rasters} distinct inked raster(s)`,
  };
}

// ── the credit line ─────────────────────────────────────────────────────────

/** app/app.config.ts `artCredit`, read as text — the Nuxt config cannot be
 *  imported by plain tsx. Exactly one single-quoted literal, or null. */
export function readArtCredit(root = ROOT): string | null {
  const src = readFileSync(join(root, 'app', 'app.config.ts'), 'utf8');
  const hits = [...src.matchAll(/^\s*artCredit:\s*'([^'\n]*)'\s*,?\s*$/gm)];
  if (hits.length > 1) throw new Error(`app/app.config.ts sets artCredit ${hits.length} times`);
  return hits[0]?.[1] ?? null;
}

interface ProvenanceHead {
  method?: string;
  credit?: string | null;
}

/**
 * What the card's credit line says, and the guard that the card, the footer
 * and the art's own provenance agree.
 *
 *  · fan-kit art ships (or no provenance yet) → app.config artCredit, and it
 *    must equal what scripts/art.ts recorded as the credit the art was
 *    published under. Absent entirely while kit art ships is a throw.
 *  · the art is generated (Article 3 revocation) → NO credit line: the site
 *    shows no Cygames artwork, and "Character art © Cygames" would then
 *    describe something that is not there (Avatar's card, the same finding).
 */
export function resolveCredit(root = ROOT): { credit: string | null; warning?: string } {
  const configCredit = readArtCredit(ROOT);
  const p = join(root, 'data', 'art-provenance.json');
  const prov = existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as ProvenanceHead) : null;
  if (prov?.method === 'generated') {
    return {
      credit: null,
      warning: configCredit?.startsWith('Character art')
        ? `app/app.config.ts artCredit still reads ${JSON.stringify(configCredit)}, but the art ` +
          `is generated (data/art-provenance.json method "generated"). Edit the footer credit ` +
          `by hand — the card has already dropped its line.`
        : undefined,
    };
  }
  if (!configCredit) {
    throw new Error(
      `app/app.config.ts carries no artCredit, but Fan Kit art ships (data/art-provenance.json ` +
        `method ${JSON.stringify(prov?.method ?? 'absent')}). The card and the footer must carry ` +
        `the notice.`,
    );
  }
  if (prov?.credit && prov.credit !== configCredit) {
    throw new Error(
      `the credit disagrees: app/app.config.ts artCredit ${JSON.stringify(configCredit)}, ` +
        `data/art-provenance.json credit ${JSON.stringify(prov.credit)}. Re-run npm run data:art ` +
        `after changing the footer, so the art is recorded under the notice the site shows.`,
    );
  }
  return { credit: configCredit };
}

// ── the card ────────────────────────────────────────────────────────────────

const W = 1200;
const H = 630;

/** app/assets/theme.css (transcribed from design/handoff/tokens.css). */
const BG = '#0E0F1F';
const SURFACE = '#171933';
const PRIMARY = '#4DA6FF';
const PRIMARY_CONTRAST = '#0B1024';
const GILT = '#E0B65A';
const TEXT = '#F2F3FF';
const TEXT_MUTED = '#AEB2DC';
const TEXT_FAINT = '#888CB4';

const TITLE_1 = 'Granblue Fantasy Versus: Rising';
const TITLE_2 = 'Replay Database';
/** The siblings' two prose lines: "The competitive <name> replay database",
 *  then the platform tagline. The title already spells the full name, so the
 *  first line uses app.config.ts `shortName` rather than repeating it. */
const LINE_1 = 'The competitive GBVSR replay database';
export const TAGLINE = 'Character usage · matchups · meta over time';

/**
 * Render the card to `<root>/public/og-default.png`. `root` defaults to the
 * repo; scripts/art.ts `--generated --out=<dir>` passes its scratch root so a
 * test build never touches the real card. `credit` defaults to resolveCredit.
 */
export async function renderOgCard(
  opts: { root?: string; credit?: string | null } = {},
): Promise<{ file: string; bytes: number; sha256: string; summary: string }> {
  const root = opts.root ?? ROOT;
  const sharp = await loadSharp();
  const { fonts, proof } = await assertFonts();
  let credit: string | null;
  let warning: string | undefined;
  if (opts.credit !== undefined) credit = opts.credit;
  else ({ credit, warning } = resolveCredit(root));

  // The stripe is the roster, in roster order, read on every run.
  const roster = JSON.parse(
    readFileSync(join(ROOT, 'data', 'characters.json'), 'utf8'),
  ) as CharacterRecord[];
  if (roster.length === 0) throw new Error('data/characters.json is empty — no stripe.');
  // An invalid fill is dropped by librsvg without a word, and a stripe with one
  // segment missing looks like a fighter was removed from the roster.
  const badAccent = roster.filter((c) => !/^#[0-9A-Fa-f]{6}$/.test(c.accent));
  if (badAccent.length) {
    throw new Error(
      `${badAccent.length} fighter(s) carry a non-hex accent: ` +
        badAccent.map((c) => `${c.id}=${JSON.stringify(c.accent)}`).join(', '),
    );
  }
  const STRIPE = 16;
  const seg = W / roster.length;
  // +0.5px overlap so fractional segments never leave a hairline (1200/40 is
  // exact today, and will not be the day a 41st fighter ships). Written as
  // (seg + 0.5).toFixed(2), never seg.toFixed(2) + 0.5 — string concatenation,
  // width="30.000.5", and librsvg drops the whole stripe (CotW, once).
  const stripe = roster
    .map(
      (c, i) =>
        `<rect x="${(i * seg).toFixed(2)}" y="${H - STRIPE}" width="${(seg + 0.5).toFixed(2)}" ` +
        `height="${STRIPE}" fill="${c.accent}"/>`,
    )
    .join('');

  const BX = 70;
  const BADGE = 116;
  const BY = 168;
  const textLeft = BX + BADGE + 34;
  const colW = W - textLeft - BX;

  // FITTED, NOT PINNED: 31 glyphs of a wide display serif. Both title lines
  // share the badge's height: line 1's cap line on the badge top, line 2's
  // baseline on the badge bottom.
  const t1Size = fitSize(fonts.display, TITLE_1, colW, 60);
  const t2Size = fitSize(fonts.displayBold, TITLE_2, colW, Math.round(t1Size * 1.15));
  const t1Base = BY + capHeight(fonts.display, t1Size);
  const t2Base = BY + BADGE;

  const parts: string[] = [];
  parts.push(outlines(fonts.display, TITLE_1, t1Size, TEXT, textLeft, t1Base));
  parts.push(outlines(fonts.displayBold, TITLE_2, t2Size, GILT, textLeft, t2Base));
  parts.push(
    outlines(fonts.ui, LINE_1, fitSize(fonts.ui, LINE_1, W - 2 * BX, 34), TEXT_MUTED, BX + 4, 370),
  );
  parts.push(
    outlines(
      fonts.ui,
      TAGLINE,
      fitSize(fonts.ui, TAGLINE, W - 2 * BX, 26),
      TEXT_FAINT,
      BX + 4,
      416,
    ),
  );
  // The notice: 20px in the muted text colour, the size the site footer sets
  // it at, above the stripe.
  if (credit) parts.push(outlines(fonts.ui, credit, 20, TEXT_MUTED, BX + 4, H - STRIPE - 34));

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<defs>` +
    `<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0%" stop-color="${SURFACE}"/><stop offset="100%" stop-color="${BG}"/>` +
    `</linearGradient>` +
    `<radialGradient id="wash" cx="80%" cy="16%" r="62%">` +
    `<stop offset="0%" stop-color="${PRIMARY}" stop-opacity="0.20"/>` +
    `<stop offset="100%" stop-color="${PRIMARY}" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<radialGradient id="gilt" cx="10%" cy="96%" r="50%">` +
    `<stop offset="0%" stop-color="${GILT}" stop-opacity="0.12"/>` +
    `<stop offset="100%" stop-color="${GILT}" stop-opacity="0"/>` +
    `</radialGradient>` +
    `<pattern id="diag" width="14" height="14" patternUnits="userSpaceOnUse" ` +
    `patternTransform="rotate(35)">` +
    `<rect width="14" height="14" fill="none"/>` +
    `<rect width="5" height="14" fill="#FFFFFF" fill-opacity="0.018"/>` +
    `</pattern>` +
    `</defs>` +
    `<rect width="100%" height="100%" fill="url(#bg)"/>` +
    `<rect width="100%" height="100%" fill="url(#diag)"/>` +
    `<rect width="100%" height="100%" fill="url(#wash)"/>` +
    `<rect width="100%" height="100%" fill="url(#gilt)"/>` +
    // the platform badge: a cut-corner square in the game's primary, carrying
    // the platform slash
    `<path d="M${BX} ${BY} H${BX + BADGE - 26} L${BX + BADGE} ${BY + 26} V${BY + BADGE} ` +
    `H${BX} Z" fill="${PRIMARY}"/>` +
    `<path d="M${BX + BADGE * 0.62} ${BY + BADGE * 0.2} L${BX + BADGE * 0.34} ${BY + BADGE * 0.8} ` +
    `l14 0 L${BX + BADGE * 0.62 + 14} ${BY + BADGE * 0.2} Z" fill="${PRIMARY_CONTRAST}"/>` +
    // a gilt rule between the title and the prose
    `<rect x="${BX + 4}" y="${BY + BADGE + 46}" width="120" height="3" fill="${GILT}"/>` +
    stripe +
    parts.join('') +
    `</svg>`;

  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  const meta = await sharp(png).metadata();
  if (meta.width !== W || meta.height !== H) {
    throw new Error(`rendered ${meta.width}×${meta.height}, expected ${W}×${H}`);
  }
  const file = join(root, 'public', 'og-default.png');
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, png);
  const glyphs = parts.join('').split('<path').length - 1;
  return {
    file,
    bytes: png.length,
    sha256: createHash('sha256').update(png).digest('hex'),
    summary:
      `${W}×${H}, ${glyphs} glyph outline(s) (title ${t1Size}/${t2Size}px), ` +
      `${roster.length}-segment roster stripe, ` +
      (credit ? `notice ${JSON.stringify(credit)} baked in` : 'NO art credit (generated art)') +
      `, no Fan Kit art on the card\n  fonts verified: ${proof}` +
      (warning ? `\n  ⚠ ${warning}` : ''),
  };
}

async function main(): Promise<void> {
  const r = await renderOgCard();
  console.log(`✓ public/og-default.png — ${r.summary}`);
}

// isMain, so scripts/art.ts can import the gate and the renderer without
// rendering a card as a side effect.
const isMain = !!process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isMain) {
  main().catch((e: unknown) => {
    console.error(`\n✖ og.ts: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  });
}
