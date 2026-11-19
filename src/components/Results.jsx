import { useState, useEffect } from "react";

const fmt = (ms) => `${Math.floor(ms / 60000)}:${String(Math.round((ms % 60000) / 1000)).padStart(2, "0")}`;

function Track({ track, index, open, onToggle }) {
  return (
    <li className={`track ${open ? "is-open" : ""}`} style={{ "--i": index }}>
      <button className="track-row" onClick={onToggle} aria-expanded={open}>
        <span className="track-num">{open ? "♪" : String(index + 1).padStart(2, "0")}</span>
        <span className="track-meta">
          <span className="track-title">{track.title}</span>
          <span className="track-artist">
            {track.favorite && <span className="tag">Your artist</span>}
            {track.artists.join(", ")}
            {track.via && <span className="via"> · like {track.via}</span>}
          </span>
        </span>
        <span className="track-bars" aria-hidden="true">
          <i style={{ "--h": track.features.valence }} title="positivity" />
          <i style={{ "--h": track.features.energy }} title="energy" />
          <i style={{ "--h": track.features.danceability }} title="danceability" />
        </span>
        {track.durationMs ? <span className="track-time">{fmt(track.durationMs)}</span> : null}
      </button>
      {open && (
        <iframe
          className="track-embed"
          title={`Play ${track.title} on Spotify`}
          src={`https://open.spotify.com/embed/track/${track.id}?utm_source=moodifly`}
          height="80"
          loading="lazy"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        />
      )}
    </li>
  );
}

export default function Results({ tracks, status, error, onRetry }) {
  const [openId, setOpenId] = useState(null);
  useEffect(() => setOpenId(tracks[0]?.id ?? null), [tracks]);

  if (status === "loading") {
    return (
      <ul className="tracks" aria-busy="true" aria-label="Loading songs">
        {Array.from({ length: 6 }, (_, i) => (
          <li key={i} className="track skeleton" />
        ))}
      </ul>
    );
  }
  if (status === "error") {
    return (
      <div className="empty">
        <p>{error}</p>
        <button className="btn-ghost" onClick={onRetry}>Try again</button>
      </div>
    );
  }
  if (!tracks.length) {
    return (
      <div className="empty">
        <p className="empty-title">Your soundtrack shows up here.</p>
        <p>Pick a few emojis or write a sentence about your day, then hit <b>Find songs</b>.</p>
      </div>
    );
  }
  return (
    <ul className="tracks">
      {tracks.map((t, i) => (
        <Track key={t.id} track={t} index={i} open={openId === t.id} onToggle={() => setOpenId(openId === t.id ? null : t.id)} />
      ))}
    </ul>
  );
}
