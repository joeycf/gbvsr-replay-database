import characters from '../../data/characters.json';
import type { Replay } from '@engine/types';

/**
 * The EX facet — GBVSR's one game-defined filter (engine provideGameFacets,
 * v0.3.0; 2XKO's fuse facet is the precedent).
 *
 * Ver 2.20 (2025-08-04) gave Gran, Djeeta and Narmaya an EX character MODE.
 * The vendor keeps them as three fighters with a mode, not six fighters, so
 * each record carries a game-local `ex` field: per side, the character ids the
 * SOURCE MARKED as EX — present only when some side is marked (scripts/emit.ts).
 *
 * THE CHIP MEANS "MARKED EX", NEVER "NOT EX". Decided 2026-09-29: the mark is
 * positive evidence only. A channel that never writes "EX" says nothing about
 * mode, so an unmarked record is unknown, not base — which is why there is no
 * "base" chip, and why the note says so out loud.
 */
type WithEx = Replay & { ex?: [string[], string[]] };

const exCapable = (characters as { id: string; name: string; extra?: { exSince?: string } }[])
  .filter((c) => c.extra?.exSince)
  .map((c) => ({ id: c.id, label: `${c.name} (EX)` }));

export default defineNuxtPlugin(() => {
  provideGameFacets([
    {
      param: 'ex',
      label: 'EX mode',
      note: 'marked EX by the title or the catalogue — unmarked is unknown, not base',
      chips: exCapable,
      matches: (selected, { replay }) => {
        if (!selected.length) return true;
        const marks = (replay as WithEx).ex;
        if (!marks) return false;
        return marks.some((side) => side.some((id) => selected.includes(id)));
      },
    },
  ]);
});
