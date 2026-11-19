# Moodifly

Music for how you feel. Pick a few emojis or describe your day in words, and Moodifly turns your mood into a playlist you can play right on the page.

## How it works

1. **Read the mood.** Emojis map to points on a positivity × energy grid. Text runs through in-browser sentiment analysis ([`sentiment`](https://github.com/thisandagain/sentiment), AFINN-165) plus energy, focus and "cozy" keyword cues. Nothing you type leaves your browser.
2. **Fine-tune.** Drag the dot on the mood map, or open **Fine-tune** to set danceability, acoustic feel and how instrumental the music should be.
3. **Find songs.** Moodifly picks seed tracks from the closest mood region (`src/lib/seeds.js`), asks [ReccoBeats](https://reccobeats.com) for recommendations, then re-ranks them by how closely each song's audio features match your mood.
4. **Listen.** Each result opens a Spotify embed player. No login needed.

## Why v2 looks different

The original Moodifly (2021) used Spotify login, the Spotify `/recommendations` and `/audio-features` endpoints, and a Spring Boot + Stanford CoreNLP backend on Heroku. Since then:

- Spotify removed recommendations and audio features for new apps (Nov 2024), and in 2026 limited Development Mode apps to 5 users with a Premium-owner requirement.
- Heroku ended its free tier.
- moodifly.com expired.

v2 is a static Vite + React app with no backend and no login, so anyone can use it. The v1 demos and write-up are still in [`demo/`](demo) and [`Moodifly Guide/`](Moodifly%20Guide/Guide.pdf).

## Develop

```bash
npm install
npm run dev
```

## Deploy (Vercel)

Import the GitHub repo at [vercel.com/new](https://vercel.com/new). Vercel detects Vite automatically (build: `npm run build`, output: `dist`).

Add one environment variable in the Vercel project settings: `VITE_LASTFM_API_KEY` set to your [Last.fm API key](https://www.last.fm/api/account/create). Locally, put the same line in `.env.local`, which git ignores. Without it, the app still works, but discoveries fall back to ReccoBeats recommendations instead of similar artists.

## Refreshing seed tracks

If ReccoBeats stops recognising some seeds, regenerate them:

```bash
python3 scripts/build-seeds.py   # writes scripts/seeds.json
```

Then copy the IDs into `src/lib/seeds.js`.
