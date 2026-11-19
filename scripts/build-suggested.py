"""Resolve the onboarding's suggested artists to ReccoBeats + Spotify IDs.
Picks, for each name, the same-named artist whose tracks are most popular.
Usage: python3 scripts/build-suggested.py > /tmp/out.json"""
import json, urllib.request, urllib.parse, time

NAMES = ["Taylor Swift", "Drake", "The Weeknd", "Billie Eilish", "SZA", "Bad Bunny",
         "BTS", "Dua Lipa", "Kendrick Lamar", "Frank Ocean", "Arctic Monkeys", "Coldplay",
         "Olivia Rodrigo", "Tame Impala", "Ed Sheeran", "Ariana Grande", "Radiohead", "NewJeans"]
B = "https://api.reccobeats.com/v1"

def get(u):
    for _ in range(3):
        try:
            return json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "moodifly-seeds"}), timeout=25))
        except Exception as e:
            err = e; time.sleep(2)
    raise err

out = []
for name in NAMES:
    res = get(f"{B}/artist/search?searchText={urllib.parse.quote(name)}&size=10")["content"]
    best = None
    for a in [x for x in res if x["name"].lower() == name.lower()]:
        tr = get(f"{B}/artist/{a['id']}/track?size=20")["content"]
        pop = max([t.get("popularity") or 0 for t in tr] or [0])
        if not best or pop > best[0]:
            best = (pop, a)
    if best:
        out.append({"name": best[1]["name"], "id": best[1]["id"], "spotifyId": best[1]["href"].split("/")[-1]})
        print(name, best[0], file=__import__("sys").stderr)
print(json.dumps(out, ensure_ascii=False, indent=1))
