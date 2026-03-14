import urllib.request
import json
data = json.loads(urllib.request.urlopen('http://localhost:8000/data/GrandRift.json').read())

matches = list(data.keys())
print("Matches:", len(matches))
m0 = data[matches[0]]
print("Date for m0:", m0['date'])

sDate = "14 Feb 2026"
sMatch = "all"
sUser = "all"

baseEvents = []
for mId, m in data.items():
    if sDate != "all" and m['date'] != sDate: continue
    if sMatch != "all" and mId != sMatch: continue
    
    evs = m['events']
    if sUser != "all":
        evs = [e for e in evs if e[0] == sUser]
        
    baseEvents.extend(evs)
    
print("Filtered events:", len(baseEvents))
