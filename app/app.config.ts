import patchGroups from '../data/patchGroups.json';
import type { GameConfig } from '@engine/types';

/**
 * Granblue Fantasy Versus: Rising — the game config the engine layer reads.
 *
 * `accents` is keyed by ROSTER ID and must equal design/handoff/tokens.css's
 * --char-* block exactly; scripts/characters.ts reads the same block, and e2e
 * compares the BUILT stylesheet's --accent-* values against data/characters.json
 * (with hex normalization — lightningcss lowercases and shortens hex inside
 * custom properties). The ids ARE the handoff's tokens, so there is no
 * TOKEN_FOR translation layer here, unlike Strive.
 *
 * Two keys need quoting and neither is decoration: `2b` starts with a digit
 * (not a valid bare identifier), and `avatar-belial` has a hyphen. `id` does
 * NOT need quoting — and it is a fighter, not a field; nothing here or in the
 * engine merges this map with an object that has an `id` property.
 *
 * `artCredit` is the Fan Kit's notice (engine v0.12.1 field, rendered in the
 * footer at every width): Cygames distributes the kit, and 2B is Square Enix's
 * guest character, whose notice the vendor's own footer carries beside
 * Cygames'. The Fan Kit terms (read 2026-09-29, recorded in
 * data/art-provenance.json) permit reposting kit files on websites, forbid
 * "excessively processing or modifying" them and forbid removing notices; the
 * art is cropped and resized, nothing else.
 */
export default defineAppConfig({
  game: {
    id: 'gbvsr',
    slug: 'gbvsr',
    name: 'Granblue Fantasy Versus: Rising',
    shortName: 'GBVSR',
    rightsHolder: 'Cygames, Inc.',
    artCredit: 'Character art © Cygames, Inc. · 2B © SQUARE ENIX',
    baseURL: '/gbvsr', // behind the shell at replaydatabase.com/gbvsr
    siteUrl: 'https://replaydatabase.com',
    observability: { insights: '/gbvsr-insights' },
    charactersPerSide: 1,
    filters: {
      coOccurrence: false,
      // No live intake carries a per-side ladder tier (checklist 8c):
      // "⭐Masters Ranked Matches⭐" on the frozen risingReplays is decoration
      // about the channel, not a property of either player.
      rank: false,
    },
    stats: {
      metaTimelineTopN: 8,
      metaTimelineFullWidth: true,
    },
    accents: {
      gran: '#FFB5AB',
      djeeta: '#91D4FE',
      katalina: '#4BA5F0',
      charlotta: '#E5E483',
      lancelot: '#05AEDC',
      percival: '#EF656B',
      ladiva: '#8ADB90',
      metera: '#14BBC2',
      lowain: '#FEB79E',
      ferry: '#F4DBA9',
      zeta: '#EE6951',
      vaseraga: '#8B8AF1',
      narmaya: '#C9C2FE',
      soriz: '#B1CA70',
      zooey: '#F6DE7D',
      cagliostro: '#3DB87C',
      yuel: '#EE7942',
      anre: '#ABCDFE',
      eustace: '#C0C5FF',
      seox: '#A981E0',
      vira: '#8097F5',
      beelzebub: '#D96CB4',
      belial: '#A287FE',
      'avatar-belial': '#FFAAEC',
      anila: '#FEB98F',
      siegfried: '#73AB4C',
      grimnir: '#67E2DA',
      nier: '#BD81E1',
      lucilius: '#DFB9FC',
      '2b': '#D0C2ED',
      vane: '#61D7ED',
      beatrix: '#CE76DC',
      versusia: '#FFD6A5',
      vikala: '#D378C7',
      sandalphon: '#E5B8EF',
      galleon: '#79DBB2',
      wilnas: '#FFA9AF',
      meg: '#77D9FF',
      ilsa: '#DC6DA2',
      id: '#FFAED7',
    },
    sourceChannels: [
      { id: 'highLevelReplays', name: 'GBVS: High Level Replays' },
      { id: 'kakuken', name: '格闘ゲーム研究所' },
      { id: 'gbvsReplayChannel', name: 'GBVS Replay Channel' },
      { id: 'yumegiwa', name: 'yumegiwa online tournaments' },
      { id: 'risingReplays', name: 'Rising Replays' },
      { id: 'gbFightingReplays', name: 'GBFightingReplays' },
      { id: 'gbvsrReplay', name: 'GBVSR Replay' },
      { id: 'fgHighLevel', name: 'Fighting Games: High Level Gameplay' },
      { id: 'replayTheater', name: 'Tournament' },
    ],
    sourceGroups: [
      {
        id: 'online',
        name: 'Online',
        sources: [
          'highLevelReplays',
          'kakuken',
          'gbvsReplayChannel',
          'risingReplays',
          'gbFightingReplays',
          'gbvsrReplay',
          'fgHighLevel',
        ],
      },
      {
        id: 'tournament',
        name: 'Tournament',
        sources: ['yumegiwa', 'replayTheater'],
      },
    ],
    patchGroups,
    fonts: {
      display: 'Cinzel Decorative',
      ui: 'Figtree',
      mono: 'JetBrains Mono',
    },
    manifest: {
      themeColor: '#4DA6FF',
      backgroundColor: '#0E0F1F',
    },
    ogImage: '/og-default.png',
    // ComboForge's `gbvsr` roster, read 2026-09-29 (39 fighters): 38 of our 40
    // ids derive as `gbvsr-<id>`. Meg is keyed by her full name upstream, and
    // Id (shipped 2026-09-15) is not there yet — null until the engine's
    // `npm run verify:comboforge` says it is.
    comboforge: {
      gameId: 'gbvsr',
      characters: {
        meg: 'meg-margaret-bluemarine',
        id: null,
      },
    },
  } satisfies GameConfig,
});
