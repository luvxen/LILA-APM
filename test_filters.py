import json

with open('public/data/GrandRift.json', 'r') as f:
    d = json.load(f)

baseEvents = []
sDate = '10 Feb 2026'
sMatch = 'all'
sUser = 'all'

for mId, m in d.items():
    if sDate != 'all' and m['date'] != sDate:
        continue
    if sMatch != 'all' and mId != sMatch:
        continue

    evs = m['events']
    if sUser != 'all':
        evs = [e for e in evs if e[0] == sUser]
    
    baseEvents.extend(evs)

print(f"Filtered: {len(baseEvents)} events matching Date: {sDate}")
