// Thin client for ReccoBeats (https://reccobeats.com), a free public API that
// still offers track recommendations and audio features keyed by Spotify IDs.
// Spotify removed both from its own Web API for new apps in Nov 2024.
const BASE = "https://api.reccobeats.com/v1";

// --- Request queue ----------------------------------------------------------
// ReccoBeats rate-limits bursts (HTTP 429) without publishing the limits. All calls
// go through one queue: a few at a time, spaced out, and the whole queue pauses
// when a 429 arrives. Interactive calls ("high") jump ahead of background work.
const MAX_ACTIVE = 2;
const MIN_GAP_MS = 180;
const queue = { high: [], low: [] };
let active = 0;
let nextStart = 0;
let timer = null;

function pump() {
  if (timer) return;
  while (active < MAX_ACTIVE && (queue.high.length || queue.low.length)) {
    const wait = nextStart - Date.now();
    if (wait > 0) {
      timer = setTimeout(() => {
        timer = null;
        pump();
      }, wait);
      return;
    }
    const job = queue.high.shift() ?? queue.low.shift();
    if (job.signal?.aborted) {
      job.reject(job.signal.reason ?? new DOMException("Aborted", "AbortError"));
      continue;
    }
    active++;
    nextStart = Date.now() + MIN_GAP_MS;
    job.run().finally(() => {
      active--;
      pump();
    });
  }
}

function enqueue(fn, { priority = "high", signal } = {}) {
  return new Promise((resolve, reject) => {
    queue[priority].push({ signal, reject, run: () => fn().then(resolve, reject) });
    pump();
  });
}

async function get(path, params, { signal, priority } = {}) {
  const url = new URL(BASE + path);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  for (let attempt = 0; attempt < 5; attempt++) {
    const res = await enqueue(() => fetch(url, { signal }), { priority, signal });
    if (res.status === 429) {
      const retryAfter = Number(res.headers.get("retry-after"));
      // Push back every queued request, not just this one.
      nextStart = Math.max(nextStart, Date.now() + (retryAfter > 0 ? retryAfter * 1000 : 1000 * 2 ** attempt));
      continue;
    }
    if (!res.ok) throw new Error(`Couldn't reach the music service (${res.status}).`);
    return res.json();
  }
  throw new Error("The music service is busy right now. Try again in a minute.");
}

// Seasonal songs and alternate versions rarely fit a mood request.
export const JUNK = /christmas|xmas|navidad|holiday|jingle|santa|faithful|\blive\b|remaster|karaoke|sped up|slowed|remix|instrumental version/i;

// `opts` = { signal, priority: "high" | "low" }
export async function searchArtists(query, opts) {
  const data = await get("/artist/search", { searchText: query, size: 10 }, opts);
  return data.content ?? [];
}

export async function artistTracks(artistId, size, opts) {
  const data = await get(`/artist/${artistId}/track`, { size }, opts);
  return data.content ?? [];
}

export const spotifyIdFromHref =(href) => href?.split("/").pop()?.split("?")[0];

export async function recommend({ seeds, targets, size = 40, popularity = 70, signal }) {
  const params = { size, seeds: seeds.join(","), popularity };
  for (const [k, v] of Object.entries(targets)) params[k] = v.toFixed(3);
  const data = await get("/track/recommendation", params, { signal });
  return data.content ?? [];
}

export async function audioFeatures(ids, opts) {
  if (!ids.length) return [];
  const data = await get("/audio-features", { ids: ids.join(",") }, opts);
  return data.content ?? [];
}
