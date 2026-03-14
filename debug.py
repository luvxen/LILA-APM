import urllib.request, json
d = json.loads(urllib.request.urlopen("http://localhost:8000/data/GrandRift.json").read())
print("Matches in GrandRift:", len(d))
for mid, m in list(d.items())[:3]:
    print(mid, len(m['events']), m['date'])
    print("  Ev0:", m['events'][0])
