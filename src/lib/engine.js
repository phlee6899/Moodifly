import { SEEDS } from "./seeds";
import { recommend, audioFeatures, spotifyIdFromHref, JUNK } from "./reccobeats";

// Centers of each seed pool in (valence, energy, instrumentalness) space.
const REGIONS = {
  joyful: { valence: 0.85, energy: 0.8, instrumentalness: 0.05 },
  calm: { valence: 0.7, energy: 0.3, instrumentalness: 0.1 },
  blue: { valence: 0.2, energy: 0.25, instrumentalness: 0.1 },
  fired: { valence: 0.3, energy: 0.9, instrumentalness: 0.05 },
  focus: { valence: 0.45, energy: 0.35, instrumentalness: 0.85 },
};

export const FEATURES = [
  { key: "valence", label: "Positivity", low: "Moody", high: "Upbeat" },
  { key: "energy", label: "Energy", low: "Mellow", high: "Intense" },
  { key: "danceability", label: "Danceability", low: "Still", high: "Groovy" },
  { key: "acousticness", label: "Acoustic", low: "Electric", high: "Unplugged" },
  { key: "instrumentalness", label: "Instrumental", low: "Vocals", high: "No vocals" },
];

const WEIGHTS = { valence: 1.4, energy: 1.4, danceability: 0.6, acousticness: 0.6, instrumentalness: 0.9 };

const dist = (a, b, keys) => Math.sqrt(keys.reduce((s, k) => s + (WEIGHTS[k] ?? 1) * (a[k] - b[k]) ** 2, 0));

const sample = (arr, n) => [...arr].sort(() => Math.random() - 0.5).slice(0, n);

export function describeMood({ valence: v, energy: e, instrumentalness: i }) {
  if (i > 0.6) return { name: "In the zone", blurb: "Steady, wordless music to think to." };
  if (v >= 0.6 && e >= 0.6) return { name: "Bright & buzzing", blurb: "Big hooks and feel-good energy." };
  if (v >= 0.55 && e < 0.45) return { name: "Easy going", blurb: "Warm, unhurried songs to settle into." };
  if (v < 0.4 && e >= 0.6) return { name: "Fired up", blurb: "Loud, driving tracks to burn it off." };
  if (v < 0.4 && e < 0.45) return { name: "In your feelings", blurb: "Gentle, honest songs that sit with you." };
  if (e >= 0.6) return { name: "Restless", blurb: "Momentum without too much sugar." };
  if (e < 0.4) return { name: "Low key", blurb: "Quiet company for a slow moment." };
  return { name: "Somewhere in between", blurb: "A balanced mix to meet you where you are." };
}

const TASTE_KEYS = ["valence", "energy", "acousticness", "instrumentalness"];

// The user's favorite-artist songs, best mood fit first.
const personalFits = (mood, profile) =>
  (profile?.tracks ?? [])
    .map((t) => ({ ...t, d: dist(mood, t.features, TASTE_KEYS) }))
    .sort((a, b) => a.d - b.d);

function pickSeeds(mood, profile) {
  const ranked = Object.entries(REGIONS)
    .map(([name, c]) => [name, dist(mood, c, ["valence", "energy", "instrumentalness"])])
    .sort((a, b) => a[1] - b[1]);
  const [first, second] = ranked;

  // With a taste profile: the user's own favorites that best fit this mood lead,
  // and the mood region keeps the playlist on-feel.
  const personal = personalFits(mood, profile);
  if (personal.length >= 3) {
    return [...sample(personal.slice(0, 6), 3), ...sample(SEEDS[first[0]], 2)];
  }
  // Lean on the closest region, borrow a little from the runner-up for variety.
  return [...sample(SEEDS[first[0]], 3), ...sample(SEEDS[second[0]], 2)];
}

/**
 * Mood-weighted sampling, after Zeng (arXiv:2603.11796): each song gets weight
 * exp(-distance / tau), nudged by how related its artist is and how well known the
 * song is, then songs are drawn at random by weight. Close fits dominate, but each
 * search gives a fresh mix. At most `perArtist` songs per artist.
 */
function sampleByMood(mood, pool, n, { tau = 0.12, perArtist = 2 } = {}) {
  const keys = FEATURES.map((f) => f.key);
  const items = pool.map((t) => ({
    t,
    w:
      Math.exp(-dist(mood, t.features, keys) / tau) *
      (0.6 + 0.4 * (t.match ?? 0.5)) *
      (0.5 + (t.popularity ?? 50) / 200),
  }));
  const picked = [];
  const perCount = new Map();
  while (picked.length < n) {
    const open = items.filter((x) => x.w > 0 && (perCount.get(x.t.artist) ?? 0) < perArtist);
    const total = open.reduce((s, x) => s + x.w, 0);
    if (!open.length || total === 0) break;
    let r = Math.random() * total;
    const hit = open.find((x) => (r -= x.w) <= 0) ?? open[open.length - 1];
    hit.w = 0;
    perCount.set(hit.t.artist, (perCount.get(hit.t.artist) ?? 0) + 1);
    picked.push(hit.t);
  }
  return picked.map((t) => ({
    id: t.id,
    title: t.title,
    artists: [t.artist],
    durationMs: t.durationMs,
    features: t.features,
    via: t.via,
  }));
}

export async function findSongs(mood, profile, signal) {

  // Up to 4 songs from the user's own artists that fit this mood (one per artist
  // first, so a single artist doesn't take over), woven into the discoveries.
  const fits = personalFits(mood, profile).filter((t) => t.d < 0.5);
  const favorites = [];
  for (const t of [...fits.filter((t, i) => fits.findIndex((x) => x.artist === t.artist) === i), ...fits]) {
    if (favorites.length >= 4) break;
    if (!favorites.includes(t)) favorites.push(t);
  }
  const favoriteNames = new Set((profile?.artists ?? []).map((a) => a.name.toLowerCase()));

  const discoveries =
    (profile?.pool?.length ?? 0) >= 20
      ? sampleByMood(mood, profile.pool, 12 - favorites.length)
      : await reccoBeatsDiscoveries(mood, profile, favorites, favoriteNames, signal);
  return weave(discoveries, favorites);
}

// Fallback when there's no similar-artist pool (onboarding skipped, or no Last.fm key).
async function reccoBeatsDiscoveries(mood, profile, favorites, favoriteNames, signal) {
  const seeds = pickSeeds(mood, profile);
  const recs = await recommend({ seeds: seeds.map((s) => s.id), targets: mood, signal });

  const seen = new Set([...seeds.map((s) => s.id), ...favorites.map((t) => t.id)]);
  const tracks = [];
  for (const t of recs) {
    const id = spotifyIdFromHref(t.href);
    const key = `${t.trackTitle.toLowerCase()}|${t.artists[0]?.name.toLowerCase()}`;
    if (!id || seen.has(id) || seen.has(key) || (t.popularity ?? 0) < 25 || JUNK.test(t.trackTitle)) continue;
    // Songs by favorite artists come from the profile instead, keeping discoveries new.
    if (t.artists.some((a) => favoriteNames.has(a.name.toLowerCase()))) continue;
    seen.add(id).add(key);
    tracks.push({
      id,
      recId: t.id,
      title: t.trackTitle,
      artists: t.artists.map((a) => a.name),
      durationMs: t.durationMs,
      popularity: t.popularity ?? 0,
    });
  }

  // Re-rank by how closely each song's audio features match the mood,
  // with a small boost for songs people actually know.
  const features = new Map();
  for (let i = 0; i < tracks.length; i += 40) {
    const chunk = await audioFeatures(tracks.slice(i, i + 40).map((t) => t.recId), { signal });
    chunk.forEach((f) => features.set(spotifyIdFromHref(f.href), f));
  }
  const keys = FEATURES.map((f) => f.key);
  return tracks
    .filter((t) => features.has(t.id))
    .map((t) => {
      const f = features.get(t.id);
      const clean = Object.fromEntries(keys.map((k) => [k, f[k] ?? 0.5]));
      return { ...t, features: clean, score: dist(mood, clean, keys) - (t.popularity / 100) * 0.25 };
    })
    .sort((a, b) => a.score - b.score)
    .slice(0, 12 - favorites.length);
}

// Weave favorite-artist songs in at every third slot.
function weave(discoveries, favorites) {
  const out = [...discoveries];
  favorites.forEach((t, i) => {
    out.splice(Math.min(i * 3, out.length), 0, {
      id: t.id,
      title: t.title,
      artists: [t.artist],
      durationMs: t.durationMs,
      features: { danceability: 0.5, ...t.features },
      favorite: true,
    });
  });
  return out;
}
