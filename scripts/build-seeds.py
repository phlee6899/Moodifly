import json, urllib.request, urllib.parse, time
def get(u):
    for i in range(3):
        try: return json.load(urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent":"seedbuilder"}), timeout=25))
        except Exception as e: time.sleep(2); err=e
    raise err
import re
BAD=re.compile(r"live|remix|sped up|slowed|feat|with |version|arr[.]|acoustic| edit|mix[)]|karaoke|cover|christmas|session|demo",re.I)
B="https://api.reccobeats.com/v1"
buckets={
 "joyful":(["Pharrell Williams","Dua Lipa","Bruno Mars","Lizzo","ABBA","Earth, Wind & Fire"], lambda f: f["valence"]+f["energy"]),
 "calm":(["Jack Johnson","Norah Jones","Tom Misch","Khruangbin","Rex Orange County","Bill Withers"], lambda f: f["valence"]-f["energy"]+f["acousticness"]),
 "blue":(["Phoebe Bridgers","Adele","Bon Iver","Billie Eilish","Radiohead","Lana Del Rey"], lambda f: -f["valence"]-f["energy"]),
 "fired":(["Linkin Park","Rage Against the Machine","Metallica","Run The Jewels","Paramore","Skrillex"], lambda f: f["energy"]-f["valence"]),
 "focus":(["Ludovico Einaudi","Nils Frahm","Hans Zimmer","Bonobo","Ólafur Arnalds","Explosions in the Sky"], lambda f: f["instrumentalness"]-f["speechiness"]),
}
out={}
for b,(artists,score) in buckets.items():
    out[b]=[]
    for a in artists:
        res=get(f"{B}/artist/search?searchText={urllib.parse.quote(a)}&size=5")["content"]
        exact=[x for x in res if x["name"].lower()==a.lower()] or res[:1]
        best=None
        for art in exact:
            tr=get(f"{B}/artist/{art['id']}/track?size=50")["content"]
            tr=[t for t in tr if t.get("popularity") is not None and t["artists"][0]["id"]==art["id"] and not BAD.search(t["trackTitle"])]
            mp=max([t["popularity"] for t in tr] or [-1])
            if best is None or mp>best[0]: best=(mp,art,tr)
        if not best or best[0]<0: print("miss",a); continue
        _,art,tr=best
        tr.sort(key=lambda t:-t["popularity"]); tr=[t for t in tr if t["popularity"]>=25][:15] or tr[:5]
        if not tr: print("notracks",a); continue
        feats={f["href"].split("/")[-1]:f for f in get(f"{B}/audio-features?ids="+",".join(t["id"] for t in tr))["content"]}
        cand=[]
        for t in tr:
            sid=t["href"].split("/")[-1]
            if sid in feats and all(feats[sid].get(k) is not None for k in ("valence","energy","acousticness","instrumentalness","speechiness")) and t["trackTitle"].lower() not in {c[2].lower() for c in cand}: cand.append((score(feats[sid]),sid,t["trackTitle"],t["popularity"]))
        cand.sort(reverse=True)
        for c in cand[:2]:
            out[b].append({"id":c[1],"title":c[2],"artist":art["name"]})
        print(b,a,[(c[2],c[3]) for c in cand[:2]])
json.dump(out,open(f"{__import__('os').path.dirname(__file__)}/seeds.json","w"),indent=1,ensure_ascii=False)
