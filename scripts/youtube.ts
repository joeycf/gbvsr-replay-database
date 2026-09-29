// The YouTube Data API v3 client, shared by the two fetchers (scripts/fetch.ts
// and scripts/fetch-theater.ts). Nothing here knows about channels or the
// catalogue.
//
// Strive's module (itself Tōkon's) with two things from later siblings:
//   · Avatar's QUOTA counter and QuotaRefusal. The key is SHARED with seven
//     other games' daily crons (platform total estimated at ~5,000 units/day,
//     2026-09-29), so a refusal — quotaExceeded, rateLimitExceeded, HTTP 429,
//     the bot-check page — ABORTS the run instead of backing off and retrying
//     into a quota other crons still need. Every run prints what it spent.
//   · PlaylistNotFound, for SF6's 7c lesson: a deleted channel's uploads
//     playlist answers 404, and that must be named per channel (with the
//     freeze remedy) rather than surface as a generic error that kills the
//     fetch for every other channel.
//
// The key is LOCAL/CI-ONLY — never on Vercel, which builds from committed JSON.

const API_BASE = 'https://www.googleapis.com/youtube/v3';

/** Units spent by this process, counted per request attempt. Both endpoints
 *  used here cost 1; nothing in this repo calls search.list (100). */
export const QUOTA = { units: 0, calls: 0 };

let cachedKey: string | undefined;

/** Read YT_API_KEY, or fail loudly naming the command that needed it. Called
 *  by each entry point, never at import. */
export function requireApiKey(command: string): string {
  if (cachedKey) return cachedKey;
  const raw = process.env.YT_API_KEY;
  if (!raw) {
    console.error(
      [
        `✖ Missing YT_API_KEY (needed by ${command}).`,
        '  Create a .env file in the project root containing:',
        '    YT_API_KEY=your_key_here',
        `  (see .env.example). ${command} loads it via \`tsx --env-file-if-exists=.env\`.`,
      ].join('\n'),
    );
    process.exit(1);
  }
  cachedKey = raw;
  return raw;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** A refusal, as opposed to a hiccup. Thrown, never retried. */
export class QuotaRefusal extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(
      `YouTube refused the request (HTTP ${status}). This key is shared with seven production ` +
        `crons, so the run STOPS here rather than backing off and retrying.\n${body.slice(0, 400)}`,
    );
    this.name = 'QuotaRefusal';
  }
}

/** An uploads playlist that no longer exists — the deleted-channel signature
 *  (SF6's King Arena, 2026-09-18). The caller names the channel and the
 *  freeze remedy; see scripts/fetch.ts. */
export class PlaylistNotFound extends Error {
  constructor(readonly playlistId: string) {
    super(`uploads playlist ${playlistId} not found (HTTP 404 / playlistNotFound)`);
    this.name = 'PlaylistNotFound';
  }
}

const REFUSAL = /quotaExceeded|rateLimitExceeded|userRateLimitExceeded|confirm you're not a bot/i;

/** GET with retry on 5xx and network errors; ABORT on a refusal; name a
 *  missing playlist; fail loudly on any other 4xx. The key is only ever set on
 *  the URL and never logged. */
export async function apiGet<T>(
  endpoint: string,
  params: Record<string, string>,
  retries = 5,
): Promise<T> {
  const url = new URL(`${API_BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('key', requireApiKey(endpoint));

  for (let attempt = 1; attempt <= retries; attempt++) {
    QUOTA.units += 1;
    QUOTA.calls += 1;
    let res: Response;
    try {
      res = await fetch(url);
    } catch (err) {
      if (attempt >= retries) throw err;
      const wait = Math.min(1000 * 2 ** (attempt - 1), 8000);
      console.warn(
        `  ⚠ network error on ${endpoint} (attempt ${attempt}/${retries}); retrying in ${wait}ms`,
      );
      await sleep(wait);
      continue;
    }

    if (res.ok) return (await res.json()) as T;

    const body = await res.text().catch(() => '');
    if (res.status === 429 || REFUSAL.test(body)) throw new QuotaRefusal(res.status, body);
    if (endpoint === 'playlistItems' && (res.status === 404 || /playlistNotFound/.test(body)))
      throw new PlaylistNotFound(params.playlistId ?? '?');

    if (res.status >= 500 && attempt < retries) {
      const wait = Math.min(1000 * 2 ** (attempt - 1), 8000);
      console.warn(
        `  ⚠ HTTP ${res.status} on ${endpoint} ${JSON.stringify(params)} ` +
          `(attempt ${attempt}/${retries}); retrying in ${wait}ms`,
      );
      await sleep(wait);
      continue;
    }
    throw new Error(
      `YouTube API error: HTTP ${res.status} on ${endpoint} ${JSON.stringify(params)}\n${body}`,
    );
  }
  throw new Error('unreachable');
}

/** ISO8601 duration (P#DT#H#M#S) → seconds. 0 = live/upcoming/unknown. */
export function parseDuration(iso: string | undefined): number {
  if (!iso) return 0;
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  return (
    Number(m[1] ?? 0) * 86_400 +
    Number(m[2] ?? 0) * 3600 +
    Number(m[3] ?? 0) * 60 +
    Number(m[4] ?? 0)
  );
}

export interface VideoMeta {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  durationSec: number;
  viewCount?: number;
  liveBroadcastContent: string;
  /** The uploading channel's display name — per video, because an index
   *  source's VODs belong to many organisers. */
  uploader: string;
  /** The uploading channel's id (the recon attributed liveness by it). */
  channelId: string;
  tags?: string[];
}

interface VideosResponse {
  items: {
    id: string;
    snippet: {
      title: string;
      description: string;
      publishedAt: string;
      liveBroadcastContent: string;
      channelTitle?: string;
      channelId?: string;
      tags?: string[];
    };
    contentDetails: { duration?: string };
    statistics?: { viewCount?: string };
  }[];
}

/** Hydrate arbitrary video ids, 50 per call. Returns a Map so the caller can
 *  diff for ids that did not come back — a video gone private or deleted is a
 *  fact about the corpus, not noise to swallow. */
export async function fetchVideoMeta(ids: string[]): Promise<Map<string, VideoMeta>> {
  const out = new Map<string, VideoMeta>();
  for (let i = 0; i < ids.length; i += 50) {
    const res: VideosResponse = await apiGet('videos', {
      part: 'snippet,contentDetails,statistics',
      id: ids.slice(i, i + 50).join(','),
      maxResults: '50',
    });
    for (const v of res.items) {
      out.set(v.id, {
        id: v.id,
        title: v.snippet.title,
        description: v.snippet.description,
        publishedAt: v.snippet.publishedAt,
        durationSec: parseDuration(v.contentDetails.duration),
        ...(v.statistics?.viewCount ? { viewCount: Number(v.statistics.viewCount) } : {}),
        liveBroadcastContent: v.snippet.liveBroadcastContent,
        uploader: v.snippet.channelTitle ?? '',
        channelId: v.snippet.channelId ?? '',
        ...(v.snippet.tags ? { tags: v.snippet.tags } : {}),
      });
    }
  }
  return out;
}
