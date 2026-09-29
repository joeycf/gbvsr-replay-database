import characters from '../../data/characters.json';
import players from '../../data/players.json';
import stats from '../../data/stats.json';
import type { Character, KnownStats, Player } from '@engine/types';

/**
 * Hand the small registries to the engine at build time.
 *
 * PROVIDED, not fetched: bundled once and synchronously available during
 * prerender, which is what makes /characters/:id and /players/:id emit real
 * HTML with data-derived titles instead of an empty shell the crawler sees. A
 * prerender-time $fetch cannot read the app's own public/ (STACK §5.6).
 *
 * The two client-fetched files are deliberately NOT here: replays.json is the
 * whale, and summary.json is the apex selector's card payload. Both are copied
 * into public/data by nuxt.config's build:before hook.
 *
 * GBVSR's player registry is the same array that seeds the prerender routes in
 * nuxt.config (a few thousand handles), so a player page that 404s or hydrates
 * empty would be indistinguishable from a player who never played.
 */
export default defineNuxtPlugin(() => {
  provideRegistries({
    characters: characters as Character[],
    players: players as Player[],
    stats: stats as KnownStats,
  });
});
