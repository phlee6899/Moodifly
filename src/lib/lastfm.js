// Last.fm supplies "listeners of X also like Y", the part ReccoBeats can't do well.
// Read-only API key; Last.fm intends these to be usable from client-side apps.
const KEY = import.meta.env.VITE_LASTFM_API_KEY;
const BASE = "https://ws.audioscrobbler.com/2.0/";

export const hasLastfm = Boolean(KEY);

export async function similarArtists(name, limit = 12, signal) {
  if (!KEY) return [];
  const url = new URL(BASE);
  Object.entries({ method: "artist.getsimilar", artist: name, limit, autocorrect: 1, api_key: KEY, format: "json" }).forEach(
    ([k, v]) => url.searchParams.set(k, v),
  );
  const res = await fetch(url, { signal });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.similarartists?.artist ?? []).map((a) => ({ name: a.name, match: Number(a.match) || 0 }));
}
