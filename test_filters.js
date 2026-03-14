const fs = require('fs');

const d = JSON.parse(fs.readFileSync('public/data/GrandRift.json', 'utf8'));
let baseEvents = [];

let sDate = '14 Feb 2026';
let sMatch = 'all';
let sUser = 'all';

Object.keys(d).forEach(mId => {
    const m = d[mId];
    if (sDate !== 'all' && m.date !== sDate) return;
    if (sMatch !== 'all' && mId !== sMatch) return;

    let evs = m.events;
    if (sUser !== 'all') evs = evs.filter(e => e[0] === sUser);
    
    baseEvents.push(...evs);
});

console.log(`Filtered: ${baseEvents.length}`);
