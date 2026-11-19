import { useEffect, useRef, useState } from "react";
import ArtistAvatar from "./ArtistAvatar";
import Logo from "./Logo";
import { MAX_ARTISTS, SUGGESTED, buildProfile, findArtists } from "../lib/taste";

export default function Onboarding({ initial = [], previous, onDone, onSkip }) {
  const [picked, setPicked] = useState(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const abortRef = useRef(null);

  useEffect(() => {
    const q = query.trim();
    abortRef.current?.abort();
    if (q.length < 2) {
      setResults(null);
      setSearching(false);
      return;
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const found = await findArtists(q, ctrl.signal);
        setResults(found);
        setError("");
      } catch (err) {
        if (err.name !== "AbortError") setError(err.message);
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [query]);

  const isPicked = (a) => picked.some((p) => p.id === a.id);
  const toggle = (a) =>
    setPicked((cur) =>
      cur.some((p) => p.id === a.id)
        ? cur.filter((p) => p.id !== a.id)
        : cur.length >= MAX_ARTISTS
          ? cur
          : [...cur, a],
    );

  const finish = async () => {
    setBuilding(true);
    setError("");
    try {
      onDone(await buildProfile(picked, { onProgress: setProgress, previous }));
    } catch (err) {
      setError(err.message || "Couldn't load those artists. Try again.");
      setBuilding(false);
    }
  };

  const list = results ?? SUGGESTED;

  return (
    <div className="onboarding">
      <div className="onboarding-card panel">
        <div className="onboarding-brand">
          <Logo size={36} />
        </div>
        <h1>Who do you love listening to?</h1>
        <p className="lede">
          Pick up to {MAX_ARTISTS} artists. Moodifly blends them into every mood playlist. Saved only in this browser.
        </p>

        <div className="search">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search any artist"
            aria-label="Search artists"
            autoFocus
          />
          {searching && <span className="search-spin" aria-hidden="true" />}
        </div>

        <p className="eyebrow list-label">
          {results ? (results.length ? "Results" : "No artists found. Try the full name.") : "Popular picks"}
        </p>

        <ul className="artist-grid">
          {list.map((a) => {
            const on = isPicked(a);
            return (
              <li key={a.id}>
                <button
                  className={`artist ${on ? "is-on" : ""}`}
                  onClick={() => toggle(a)}
                  aria-pressed={on}
                  disabled={!on && picked.length >= MAX_ARTISTS}
                >
                  <span className="artist-photo">
                    <ArtistAvatar artist={a} size={72} />
                    {on && <span className="artist-check" aria-hidden="true">✓</span>}
                  </span>
                  <span className="artist-name">{a.name}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {error && <p className="error">{error}</p>}
        {building && !error && (
          <p className="progress" role="status">
            {progress}
          </p>
        )}

        <div className="onboarding-foot">
          <div className="picked" aria-label="Selected artists">
            {picked.length ? (
              picked.map((a) => (
                <button key={a.id} className="picked-chip" onClick={() => toggle(a)} title={`Remove ${a.name}`}>
                  <ArtistAvatar artist={a} size={22} />
                  {a.name}
                  <span aria-hidden="true">×</span>
                </button>
              ))
            ) : (
              <span className="muted">Nothing picked yet</span>
            )}
          </div>
          <div className="onboarding-actions">
            <button className="btn-ghost" onClick={onSkip} disabled={building}>
              Skip
            </button>
            <button className="btn-primary btn-inline" onClick={finish} disabled={!picked.length || building}>
              {building ? "Learning your taste…" : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
