// Each emoji nudges the mood toward a point in feature space.
// v = valence (sad → happy), e = energy (calm → intense), optional extras.
export const EMOJIS = [
  { char: "😄", label: "Happy", v: 0.9, e: 0.75 },
  { char: "🥳", label: "Celebrating", v: 0.95, e: 0.9, d: 0.85 },
  { char: "😍", label: "In love", v: 0.85, e: 0.5 },
  { char: "😎", label: "Confident", v: 0.75, e: 0.7, d: 0.75 },
  { char: "🤩", label: "Excited", v: 0.9, e: 0.95 },
  { char: "💃", label: "Dancing", v: 0.85, e: 0.85, d: 0.9 },
  { char: "🔥", label: "Hyped", v: 0.6, e: 0.95 },
  { char: "💪", label: "Pumped", v: 0.6, e: 0.9 },
  { char: "😌", label: "Content", v: 0.7, e: 0.25, a: 0.6 },
  { char: "🌿", label: "Peaceful", v: 0.6, e: 0.2, a: 0.7 },
  { char: "☕", label: "Cozy", v: 0.6, e: 0.3, a: 0.65 },
  { char: "🌙", label: "Late night", v: 0.4, e: 0.25 },
  { char: "😴", label: "Sleepy", v: 0.45, e: 0.1, a: 0.7, i: 0.5 },
  { char: "🎧", label: "Focused", v: 0.5, e: 0.35, i: 0.8 },
  { char: "🤔", label: "Thoughtful", v: 0.45, e: 0.3, i: 0.4 },
  { char: "🥲", label: "Bittersweet", v: 0.4, e: 0.35, a: 0.5 },
  { char: "😔", label: "Down", v: 0.2, e: 0.25, a: 0.55 },
  { char: "😢", label: "Sad", v: 0.12, e: 0.2, a: 0.6 },
  { char: "💔", label: "Heartbroken", v: 0.1, e: 0.3 },
  { char: "🌧️", label: "Gloomy", v: 0.2, e: 0.2, a: 0.5 },
  { char: "😰", label: "Anxious", v: 0.25, e: 0.65 },
  { char: "😤", label: "Frustrated", v: 0.25, e: 0.8 },
  { char: "😡", label: "Angry", v: 0.15, e: 0.95 },
  { char: "🤘", label: "Rocking out", v: 0.45, e: 0.95 },
];

export const MAX_EMOJIS = 5;

export function moodFromEmojis(selected) {
  if (!selected.length) return null;
  const avg = (key, fallback) =>
    selected.reduce((s, x) => s + (x[key] ?? fallback(x)), 0) / selected.length;
  return {
    valence: avg("v", () => 0.5),
    energy: avg("e", () => 0.5),
    danceability: avg("d", (x) => 0.35 + x.v * 0.25 + x.e * 0.2),
    acousticness: avg("a", (x) => Math.max(0.05, 0.6 - x.e * 0.6)),
    instrumentalness: avg("i", () => 0.05),
  };
}
