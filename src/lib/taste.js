import { searchArtists, artistTracks, audioFeatures, spotifyIdFromHref, JUNK } from "./reccobeats";
import { hasLastfm, similarArtists } from "./lastfm";

export const MAX_ARTISTS = 5;
const STORAGE_KEY = "moodifly.taste.v3";

// Resolved with scripts/build-suggested.py (picks the real artist among same-named ones).
export const SUGGESTED = [
  { name: "Taylor Swift", id: "c7b330b5-a62e-420c-bf02-943ca6bb8746", spotifyId: "06HL4z0CvFAxyc27GXpf02" },
  { name: "Drake", id: "44a4e4a3-0088-4987-8684-680814fcfa85", spotifyId: "3TVXtAsR1Inumwj472S9r4" },
  { name: "The Weeknd", id: "9451b6b2-8746-4d43-abd7-c355ed1e3048", spotifyId: "1Xyo4u8uXC1ZmMpatF05PJ" },
  { name: "Billie Eilish", id: "bf2c5ca2-f233-4846-b804-3a0b4a6a9909", spotifyId: "6qqNVTkY8uBg9cP3Jd7DAH" },
  { name: "SZA", id: "620413b0-3705-4b31-b6f3-37aa0c449953", spotifyId: "7tYKF4w9nC0nq9CsPZTHyP" },
  { name: "Bad Bunny", id: "eb33e89c-4cfc-4d89-93eb-da50024b024c", spotifyId: "4q3ewBCX7sLwd24euuV69X" },
  { name: "BTS", id: "202fa1f1-0646-4a7d-bb4d-d05bb97649ae", spotifyId: "3Nrfpe0tUJi4K4DXYWgMUX" },
  { name: "Dua Lipa", id: "51322de5-1aef-48d9-b6da-22df6aca493d", spotifyId: "6M2wZ9GZgrQXHCFfjv46we" },
  { name: "Kendrick Lamar", id: "caa924b3-075d-462a-bc84-b8da4ebb9f38", spotifyId: "2YZyLoL8N0Wb9xBt1NhZWg" },
  { name: "Frank Ocean", id: "26b85419-be43-4509-bf41-4e7f7a4a89dc", spotifyId: "2h93pZq0e7k5yf4dywlkpM" },
  { name: "Arctic Monkeys", id: "ccf0ab7c-8aac-43aa-915f-59aa382d823f", spotifyId: "7Ln80lUS6He07XvHI8qqHH" },
  { name: "Coldplay", id: "3a0134b8-a22d-42c3-88e7-005de23f35c7", spotifyId: "4gzpq5DPGxSnKTe4SA8HAU" },
  { name: "Olivia Rodrigo", id: "69a21d95-c98a-4756-8f0a-b8b2711156f4", spotifyId: "1McMsnEElThX1knmY4oliG" },
  { name: "Tame Impala", id: "656771f4-df28-47a1-9bf6-336e6dfd338c", spotifyId: "5INjqkS1o8h1imAzPqGZBb" },
  { name: "Ed Sheeran", id: "126957af-c257-4484-afa5-f9a000d20073", spotifyId: "6eUKZXaKkcviH0Ku9w2n3V" },
  { name: "Ariana Grande", id: "320a87e6-a2b9-421f-9b4e-aa44f8c784bb", spotifyId: "66CXWjxzNUsdJxJ2JdwvnR" },
  { name: "Radiohead", id: "c9cef17c-5d9c-4556-832a-8e2374f42a18", spotifyId: "4Z8W4fKeB5YxbusRsdQVPb" },
  { name: "NewJeans", id: "63c7ebdd-e507-43db-bc47-f5003b0fd5b1", spotifyId: "6HvZYsbFfjnjFrWF950C9d" },
];

// --- Persistence (this browser only) ---------------------------------------

export function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveProfile(profile) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    /* private mode etc. — taste just won't persist */
  }
}

// --- Artist photos via Spotify's public oEmbed endpoint (no API key) --------

const imageCache = new Map();
export function artistImage(spotifyId) {
  if (!imageCache.has(spotifyId)) {
    const url = `https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/artist/${spotifyId}`)}`;
    imageCache.set(
      spotifyId,
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d?.thumbnail_url ?? null)
        .catch(() => null),
    );
  }
  return imageCache.get(spotifyId);
}

// --- Caches -------------------------------------------------------------------
// Session memory for raw track lists, plus a small persistent cache so artists and
// song moods looked up once are never fetched again in this browser.

const tracksMemo = new Map(); // ReccoBeats artist id -> Promise<raw tracks>
function cachedArtistTracks(id, opts) {
  if (!tracksMemo.has(id)) {
    const p = artistTracks(id, 50, opts).catch((e) => {
      tracksMemo.delete(id);
      throw e;
    });
    tracksMemo.set(id, p);
  }
  return tracksMemo.get(id);
}

const CACHE_KEY = "moodifly.cache.v1";
const cache = (() => {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY)) ?? { artists: {}, features: {} };
  } catch {
    return { artists: {}, features: {} };
  }
})();
let saveTimer = null;
function persistCache() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      // Keep it bounded: drop the oldest song moods past ~3000 entries.
      const keys = Object.keys(cache.features);
      if (keys.length > 3000) keys.slice(0, keys.length - 3000).forEach((k) => delete cache.features[k]);
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch {
      /* storage full or unavailable: cache stays in memory only */
    }
  }, 500);
}

const popularityOf = (tracks) => Math.max(0, ...tracks.map((t) => t.popularity ?? 0));

// --- Search ------------------------------------------------------------------

// ReccoBeats returns many same-named artists, so rank them by how popular their
// songs are. Only the closest name matches get checked, to keep requests low.
export async function findArtists(query, signal) {
  const q = query.trim().toLowerCase();
  const raw = await searchArtists(query, { signal });
  const close = raw
    .filter((a) => a.name.toLowerCase().includes(q) || q.includes(a.name.toLowerCase()))
    .slice(0, 5);
  const scored = await Promise.all(
    close.map(async (a) => ({
      name: a.name,
      id: a.id,
      spotifyId: spotifyIdFromHref(a.href),
      popularity: popularityOf(await cachedArtistTracks(a.id, { signal }).catch(() => [])),
      exact: a.name.toLowerCase() === q,
    })),
  );
  return scored
    .filter((a) => a.popularity >= 20)
    .sort((a, b) => b.exact - a.exact || b.popularity - a.popularity);
}

// --- Song helpers ------------------------------------------------------------

const round = (x, d = 3) => Math.round((x ?? 0) * 10 ** d) / 10 ** d;
const cleanFeatures = (f) => ({
  valence: round(f.valence ?? 0.5),
  energy: round(f.energy ?? 0.5),
  danceability: round(f.danceability ?? 0.5),
  acousticness: round(f.acousticness ?? 0.3),
  instrumentalness: round(f.instrumentalness ?? 0),
});

// An artist's most popular distinct songs, minus live versions, remixes and the like.
function topTracks(tracks, n, artistName) {
  const seen = new Set();
  return tracks
    .filter((t) => (t.popularity ?? 0) >= 20 && !JUNK.test(t.trackTitle))
    .sort((x, y) => (y.popularity ?? 0) - (x.popularity ?? 0))
    .filter((t) => {
      const k = t.trackTitle.toLowerCase();
      return !seen.has(k) && seen.add(k);
    })
    .slice(0, n)
    .map((t) => ({
      id: spotifyIdFromHref(t.href),
      recId: t.id,
      title: t.trackTitle,
      artist: artistName,
      durationMs: t.durationMs,
      popularity: t.popularity ?? 0,
    }));
}

// Attach mood features, using the cache first and batching the rest.
async function withFeatures(tracks, opts) {
  const missing = tracks.filter((t) => !cache.features[t.id]);
  for (let i = 0; i < missing.length; i += 40) {
    const chunk = await audioFeatures(missing.slice(i, i + 40).map((t) => t.recId), opts).catch(() => []);
    chunk.forEach((f) => (cache.features[spotifyIdFromHref(f.href)] = cleanFeatures(f)));
  }
  if (missing.length) persistCache();
  return tracks
    .filter((t) => cache.features[t.id])
    .map(({ recId, ...t }) => ({ ...t, features: cache.features[t.id] }));
}

// The ReccoBeats artist behind a Last.fm name (most popular of up to 2 exact matches).
async function resolveArtist(name, opts) {
  const key = name.toLowerCase();
  if (key in cache.artists) return cache.artists[key];
  const exact = (await searchArtists(name, opts).catch(() => null))?.filter((a) => a.name.toLowerCase() === key).slice(0, 2);
  if (!exact) return null; // network trouble: don't cache, try again next time
  let best = null;
  for (const a of exact) {
    const tracks = await cachedArtistTracks(a.id, opts).catch(() => []);
    const pop = popularityOf(tracks);
    if (!best || pop > best.pop) best = { a, tracks, pop };
    if (pop >= 60) break; // clearly the real one
  }
  const resolved =
    best && best.pop >= 30
      ? { name: best.a.name, id: best.a.id, songs: topTracks(best.tracks, 6, best.a.name) }
      : null;
  cache.artists[key] = resolved;
  persistCache();
  return resolved;
}

// --- Build the taste profile -------------------------------------------------
//
// Step 1 (blocking, ~1–2 s): the picked artists' own songs, so the app opens fast.
// Step 2 (background): artists Last.fm says are similar, and their popular songs.
// Each picked artist's results are stored separately, then combined by assemble().

export async function buildProfile(artists, { signal, onProgress = () => {}, previous } = {}) {
  onProgress("Getting your artists' songs…");
  // Artists kept from a previous profile reuse their finished results as-is.
  const kept = Object.fromEntries(
    artists.filter((a) => previous?.perArtist?.[a.id]?.similar).map((a) => [a.id, previous.perArtist[a.id]]),
  );
  const fresh = artists.filter((a) => !kept[a.id]);
  const perArtist = {};
  await Promise.all(
    fresh.map(async (a) => {
      const raw = await cachedArtistTracks(a.id, { signal }).catch(() => []);
      perArtist[a.id] = { own: topTracks(raw, 8, a.name), similar: null };
    }),
  );
  onProgress("Reading the mood of each song…");
  const own = await withFeatures(
    fresh.flatMap((a) => perArtist[a.id].own),
    { signal },
  );
  for (const a of fresh) {
    perArtist[a.id].own = own.filter((t) => t.artist === a.name);
    perArtist[a.id].similar = hasLastfm ? null : [];
  }
  Object.assign(perArtist, kept);
  return assemble({
    version: 3,
    artists: artists.map(({ name, id, spotifyId }) => ({ name, id, spotifyId })),
    perArtist,
    createdAt: Date.now(),
  });
}

export const pendingArtists = (profile) => (profile?.artists ?? []).filter((a) => profile.perArtist?.[a.id]?.similar == null);

// Fill in similar artists one picked artist at a time, calling onUpdate after each.
export async function loadSimilar(profile, { signal, onUpdate }) {
  let current = profile;
  for (const a of pendingArtists(profile)) {
    const similar = await similarFor(a, current, signal);
    signal?.throwIfAborted();
    current = assemble({
      ...current,
      perArtist: { ...current.perArtist, [a.id]: { ...current.perArtist[a.id], similar } },
    });
    onUpdate(current);
  }
  return current;
}

async function similarFor(artist, profile, signal) {
  const opts = { signal, priority: "low" };
  const picked = new Set(profile.artists.map((a) => a.name.toLowerCase()));
  const list = (await similarArtists(artist.name, 15, signal).catch(() => [])).filter(
    (s) => !picked.has(s.name.toLowerCase()),
  );
  const resolved = [];
  // Two at a time; the shared request queue does the pacing.
  for (let i = 0; i < list.length; i += 2) {
    const pair = await Promise.all(list.slice(i, i + 2).map((s) => resolveArtist(s.name, opts)));
    pair.forEach((r, j) => r && resolved.push({ ...r, match: list[i + j].match }));
  }
  const songs = resolved.flatMap((r) => r.songs.map((t) => ({ ...t, match: r.match })));
  return withFeatures(songs, opts);
}

// Combine per-artist results: own songs, plus one discovery pool where artists
// related to several picks score higher.
function assemble(profile) {
  const picked = new Set(profile.artists.map((a) => a.name.toLowerCase()));
  const tracks = profile.artists.flatMap((a) => profile.perArtist[a.id]?.own ?? []);
  const byId = new Map();
  for (const a of profile.artists) {
    for (const t of profile.perArtist[a.id]?.similar ?? []) {
      if (picked.has(t.artist.toLowerCase())) continue;
      const cur = byId.get(t.id);
      if (cur) {
        cur.match += t.match;
        if (t.match > cur.bestMatch) Object.assign(cur, { via: a.name, bestMatch: t.match });
      } else {
        byId.set(t.id, { ...t, via: a.name, bestMatch: t.match });
      }
    }
  }
  const top = Math.max(1, ...[...byId.values()].map((t) => t.match));
  const pool = [...byId.values()].map(({ bestMatch, ...t }) => ({ ...t, match: t.match / top }));
  return { ...profile, tracks, pool };
}
