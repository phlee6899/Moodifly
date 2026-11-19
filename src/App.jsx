import { useEffect, useMemo, useRef, useState } from "react";
import Logo from "./components/Logo";
import MoodMap from "./components/MoodMap";
import Results from "./components/Results";
import Onboarding from "./components/Onboarding";
import ArtistAvatar from "./components/ArtistAvatar";
import { loadProfile, saveProfile, loadSimilar, pendingArtists } from "./lib/taste";
import { EMOJIS, MAX_EMOJIS, moodFromEmojis } from "./lib/emoji";
import { moodFromText } from "./lib/text";
import { FEATURES, describeMood, findSongs } from "./lib/engine";

const NEUTRAL = { valence: 0.5, energy: 0.5, danceability: 0.5, acousticness: 0.3, instrumentalness: 0.05 };
const PROMPTS = [
  "Finally finished my exams and I'm heading out with friends!",
  "Rainy Sunday, coffee in hand, not doing much.",
  "Long day. Kind of drained and a little lonely.",
  "Need to focus and get through this reading.",
];

// Hue slides from cool blue (moody) to warm amber (upbeat); energy adds saturation.
const accentFor = ({ valence, energy }) =>
  `hsl(${Math.round(225 - valence * 195)} ${Math.round(45 + energy * 40)}% ${Math.round(52 - energy * 6)}%)`;

export default function App() {
  const [mode, setMode] = useState("emoji");
  const [selected, setSelected] = useState([]);
  const [text, setText] = useState("");
  const [mood, setMood] = useState(NEUTRAL);
  const [touched, setTouched] = useState(false);
  const [tracks, setTracks] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const abortRef = useRef(null);
  // null = never onboarded; { artists: [] } = skipped.
  const [profile, setProfile] = useState(loadProfile);
  const [editingTaste, setEditingTaste] = useState(false);
  const pending = pendingArtists(profile);
  const pendingKey = pending.map((a) => a.id).join(",");

  // Similar artists load in the background after onboarding; playlists improve as they arrive.
  useEffect(() => {
    if (!pendingKey || editingTaste) return;
    const ctrl = new AbortController();
    loadSimilar(profile, {
      signal: ctrl.signal,
      onUpdate: (p) => {
        saveProfile(p);
        setProfile(p);
      },
    }).catch(() => {});
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingKey, editingTaste]);

  const textResult = useMemo(() => moodFromText(text), [text]);

  // Inputs set the mood; the map and sliders let people fine-tune it afterwards.
  useEffect(() => {
    const next = mode === "emoji" ? moodFromEmojis(selected) : textResult?.mood;
    setMood(next ?? NEUTRAL);
    setTouched(Boolean(next));
  }, [mode, selected, textResult]);

  useEffect(() => {
    document.documentElement.style.setProperty("--accent", accentFor(mood));
  }, [mood]);

  const toggleEmoji = (e) =>
    setSelected((cur) =>
      cur.includes(e) ? cur.filter((x) => x !== e) : cur.length >= MAX_EMOJIS ? cur : [...cur, e],
    );

  const adjust = (patch) => {
    setMood((m) => ({ ...m, ...patch }));
    setTouched(true);
  };

  const search = async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setStatus("loading");
    try {
      const songs = await findSongs(mood, profile, ctrl.signal);
      setTracks(songs);
      setStatus(songs.length ? "done" : "error");
      if (!songs.length) setError("No matches for that exact mood. Nudge the dot a little and try again.");
    } catch (err) {
      if (err.name === "AbortError") return;
      setError(err.message || "Something went wrong.");
      setStatus("error");
    }
  };

  const label = describeMood(mood);

  const updateProfile = (p) => {
    saveProfile(p);
    setProfile(p);
    setEditingTaste(false);
  };

  if (!profile || editingTaste) {
    return (
      <div className="app">
        <Onboarding
          initial={profile?.artists ?? []}
          previous={profile}
          onDone={updateProfile}
          onSkip={() => (profile ? setEditingTaste(false) : updateProfile({ version: 3, artists: [], perArtist: {}, tracks: [], pool: [] }))}
        />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="/">
          <Logo />
          <span>Moodifly</span>
        </a>
        <div className="topbar-right">
          <button className="taste" onClick={() => setEditingTaste(true)}>
            {profile.artists.length ? (
              <>
                <span className="taste-stack">
                  {profile.artists.slice(0, 3).map((a) => (
                    <ArtistAvatar key={a.id} artist={a} size={24} />
                  ))}
                </span>
                Your taste
              </>
            ) : (
              "Add favorite artists"
            )}
          </button>
          <a className="topbar-link" href="https://github.com/phlee6899/Moodifly" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
      </header>

      <main className="layout">
        <section className="panel input-panel" aria-labelledby="ask">
          <h1 id="ask">How are you feeling?</h1>
          <p className="lede">Tell us in emojis or in words. We'll turn it into a playlist.</p>

          <div className="tabs" role="tablist">
            {[
              ["emoji", "Emojis"],
              ["text", "In words"],
            ].map(([key, name]) => (
              <button key={key} role="tab" aria-selected={mode === key} className="tab" onClick={() => setMode(key)}>
                {name}
              </button>
            ))}
          </div>

          {mode === "emoji" ? (
            <div className="emoji-block">
              <div className="emoji-grid">
                {EMOJIS.map((e) => {
                  const on = selected.includes(e);
                  return (
                    <button
                      key={e.char}
                      className={`emoji ${on ? "is-on" : ""}`}
                      onClick={() => toggleEmoji(e)}
                      aria-pressed={on}
                      title={e.label}
                      disabled={!on && selected.length >= MAX_EMOJIS}
                    >
                      <span aria-hidden="true">{e.char}</span>
                      <span className="sr-only">{e.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="hint">
                {selected.length
                  ? `${selected.map((e) => e.label).join(" · ")}`
                  : `Pick up to ${MAX_EMOJIS}. Mix them, like 😔 + ☕.`}
              </p>
            </div>
          ) : (
            <div className="text-block">
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="What's on your mind today?"
                rows={4}
                maxLength={500}
              />
              {!text && (
                <div className="prompts">
                  {PROMPTS.map((p) => (
                    <button key={p} className="chip" onClick={() => setText(p)}>
                      {p}
                    </button>
                  ))}
                </div>
              )}
              {textResult && (
                <p className="hint">
                  {textResult.signals.positive.length > 0 && <>Positive: {textResult.signals.positive.join(", ")}. </>}
                  {textResult.signals.negative.length > 0 && <>Negative: {textResult.signals.negative.join(", ")}. </>}
                  {textResult.signals.energy.length > 0 && <>Energy cues: {textResult.signals.energy.join(", ")}. </>}
                  {textResult.signals.focus.length > 0 && <>Focus mode on. </>}
                  {Object.values(textResult.signals).every((s) => !s.length) && <>No strong signals yet. Say a bit more.</>}
                </p>
              )}
            </div>
          )}

          <div className="mood-card">
            <div className="mood-head">
              <div>
                <p className="eyebrow">Your mood</p>
                <p className="mood-name">{touched ? label.name : "Waiting for a vibe"}</p>
                <p className="mood-blurb">{touched ? label.blurb : "Or drag the dot to set it yourself."}</p>
              </div>
            </div>
            <MoodMap mood={mood} onChange={adjust} />
            <details className="finetune">
              <summary>Fine-tune</summary>
              {FEATURES.filter((f) => !["valence", "energy"].includes(f.key)).map((f) => (
                <label key={f.key} className="slider">
                  <span className="slider-label">{f.label}</span>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={mood[f.key]}
                    onChange={(e) => adjust({ [f.key]: Number(e.target.value) })}
                  />
                  <span className="slider-ends">
                    <span>{f.low}</span>
                    <span>{f.high}</span>
                  </span>
                </label>
              ))}
            </details>
          </div>

          <button className="btn-primary" onClick={search} disabled={!touched || status === "loading"}>
            {status === "loading" ? "Listening…" : tracks.length ? "Find new songs" : "Find songs"}
          </button>
        </section>

        <section className="panel results-panel" aria-live="polite" aria-label="Recommended songs">
          <div className="results-head">
            <h2>{tracks.length ? label.name : "Playlist"}</h2>
            {tracks.length > 0 && <span className="count">{tracks.length} songs</span>}
          </div>
          {pending.length > 0 && (
            <p className="loading-note" role="status">
              <span className="dot-pulse" aria-hidden="true" />
              Finding artists similar to {pending[0].name}… playlists get more personal when this finishes.
            </p>
          )}
          <Results tracks={tracks} status={status} error={error} onRetry={search} />
        </section>
      </main>

      <footer className="footer">
        Recommendations by <a href="https://reccobeats.com" target="_blank" rel="noreferrer">ReccoBeats</a> ·
        Playback by Spotify · Your words never leave your browser.
      </footer>
    </div>
  );
}
