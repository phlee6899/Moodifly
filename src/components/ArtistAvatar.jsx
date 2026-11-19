import { useEffect, useState } from "react";
import { artistImage } from "../lib/taste";

export default function ArtistAvatar({ artist, size = 40 }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let live = true;
    artistImage(artist.spotifyId).then((url) => live && setSrc(url));
    return () => {
      live = false;
    };
  }, [artist.spotifyId]);

  const initials = artist.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.36 }}>
      {src ? <img src={src} alt="" loading="lazy" /> : initials}
    </span>
  );
}
