import Sentiment from "sentiment";

// Runs entirely in the browser. Replaces the old Stanford CoreNLP backend on Heroku.
const sentiment = new Sentiment();

// Words that say more about energy than about positivity.
const ENERGY_CUES = {
  high: ["excited", "hyped", "pumped", "energetic", "party", "dance", "workout", "gym", "run", "running", "wired", "rush", "angry", "furious", "rage", "stressed", "anxious", "restless", "fired", "adrenaline", "celebrate", "wild"],
  low: ["tired", "exhausted", "sleepy", "sleep", "calm", "relax", "relaxed", "chill", "lazy", "slow", "quiet", "rain", "rainy", "cozy", "drained", "bored", "mellow", "peaceful", "sunday", "night"],
};
const FOCUS_CUES = ["study", "studying", "focus", "focused", "work", "working", "reading", "read", "code", "coding", "concentrate", "homework", "exam", "writing"];
const ACOUSTIC_CUES = ["coffee", "rain", "rainy", "cozy", "morning", "home", "sunday", "candle", "quiet", "nostalgic", "wistful"];

const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));

export function moodFromText(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const result = sentiment.analyze(trimmed);
  const words = result.tokens;
  const has = (list) => words.filter((w) => list.includes(w));

  const high = has(ENERGY_CUES.high);
  const low = has(ENERGY_CUES.low);
  const focus = has(FOCUS_CUES);
  const acoustic = has(ACOUSTIC_CUES);
  const exclaims = (trimmed.match(/!/g) || []).length;

  // comparative is roughly -5..5 per word; squash to 0..1.
  const valence = clamp(0.5 + Math.tanh(result.comparative / 1.5) * 0.45);
  const intensity = Math.min(1, Math.abs(result.comparative) / 3);
  const energy = clamp(
    0.45 + high.length * 0.15 - low.length * 0.15 + Math.min(exclaims, 3) * 0.06 + intensity * 0.1,
    0.05,
    0.97,
  );

  return {
    mood: {
      valence,
      energy,
      danceability: clamp(0.3 + valence * 0.3 + energy * 0.25),
      acousticness: clamp(0.55 - energy * 0.5 + acoustic.length * 0.15, 0.05, 0.9),
      instrumentalness: focus.length ? 0.7 : 0.05,
    },
    signals: {
      positive: result.positive,
      negative: result.negative,
      energy: [...high, ...low],
      focus,
    },
  };
}
