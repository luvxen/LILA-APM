const MINIMAP_CONFIG = {
    AmbroseValley: { file: 'minimaps/AmbroseValley_Minimap.png', scale: 900, ox: -370, oz: -473 },
    GrandRift:     { file: 'minimaps/GrandRift_Minimap.png',       scale: 581, ox: -290, oz: -290 },
    Lockdown:      { file: 'minimaps/Lockdown_Minimap.jpg',        scale: 1000, ox: -500, oz: -500 }
};

const THEME = {
    human: 'rgba(0, 255, 255, 0.45)',
    bot: 'rgba(255, 170, 0, 0.35)',
    humanHeat: 'rgba(0, 255, 255,',
    botHeat: 'rgba(255, 170, 0,',
    killHeat: 'rgba(255, 0, 0,',
    deathHeat: 'rgba(200, 0, 255,'
};

// --- DOM Elements ---
const UI = {
    // Pipeline
    uploadBtn: document.getElementById('upload-btn'),
    uploadInput: document.getElementById('parquet-upload'),
    uploadStatus: document.getElementById('upload-status'),

    // Selectors
    mapSel: document.getElementById('map-select'),
    dateSel: document.getElementById('date-select'),
    userSel: document.getElementById('user-select'),
    matchSel: document.getElementById('match-select'),
    applyContextBtn: document.getElementById('apply-selectors'),

    // Time
    timeRelStart: document.getElementById('time-rel-start'),
    timeRelEnd: document.getElementById('time-rel-end'),
    applyTimeRelBtn: document.getElementById('apply-time-relative'),

    // Toggles (Paths)
    chkHumanPaths: document.getElementById('chk-human-paths'),
    chkBotPaths: document.getElementById('chk-bot-paths'),

    // Toggles (Heatmaps)
    chkHeatHumanPath: document.getElementById('chk-heat-human-path'),
    chkHeatBotPath: document.getElementById('chk-heat-bot-path'),
    chkHeatHumanKill: document.getElementById('chk-heat-human-kill'),
    chkHeatBotKill: document.getElementById('chk-heat-bot-kill'),
    chkHeatHumanDeath: document.getElementById('chk-heat-human-death'),
    chkHeatBotDeath: document.getElementById('chk-heat-bot-death'),

    // Toggles (Events)
    chkEvHumanKill: document.getElementById('chk-ev-human-kill'),
    chkEvBotKill: document.getElementById('chk-ev-bot-kill'),
    chkEvHumanDeath: document.getElementById('chk-ev-human-death'),
    chkEvHumanStorm: document.getElementById('chk-ev-human-storm'),
    chkEvBotDeath: document.getElementById('chk-ev-bot-death'),
    chkEvBotStorm: document.getElementById('chk-ev-bot-storm'),
    chkEvLoot: document.getElementById('chk-ev-loot'),

    // Scrubber
    btnPlay: document.getElementById('btn-play'),
    scrubber: document.getElementById('scrubber'),
    scrubTrackWrapper: document.getElementById('scrub-track-wrapper'),
    timeCurrent: document.getElementById('time-current'),
    timeTotal: document.getElementById('time-total'),
    evCounter: document.getElementById('event-counter'),

    // Canvas
    canvas: document.getElementById('minimap'),
    wrapper: document.getElementById('canvas-wrapper')
};

const ctx = UI.canvas.getContext('2d', { alpha: false }); // Optimize

// --- Globals ---
const STATE = {
    rawDB: null,           // The full unified JSON database for the selected map
    availableMaps: [],
    
    currentMapId: null,
    currentMapImg: null,

    // Base active pool of events (Unfiltered by time)
    baseEvents: [],

    // Scrubber / Time Engine
    relMinMs: null,        // Start of slice relative to match start
    relMaxMs: null,        // End of slice
    slicedTimeline: [],    // Events specifically existing inside the relative slice [relMin, relMax]
    scrubIndex: 0,
    isPlaying: false,
    animId: null,

    // Viewport
    panX: 0, panY: 0, scale: 1,
    isDrag: false, sx: 0, sy: 0
};

// --- Heatmap Brush Generator ---
function createBrush(colorBaseStr, radius, intensity) {
    const b = document.createElement('canvas');
    b.width = radius * 2; b.height = radius * 2;
    const bCtx = b.getContext('2d');
    const grad = bCtx.createRadialGradient(radius, radius, 0, radius, radius, radius);
    grad.addColorStop(0, `${colorBaseStr} ${intensity})`);
    grad.addColorStop(1, `${colorBaseStr} 0)`);
    bCtx.fillStyle = grad;
    bCtx.beginPath(); bCtx.arc(radius, radius, radius, 0, Math.PI * 2);
    bCtx.fill();
    return b;
}

const BRUSHES = {
    humanTraffic: createBrush(THEME.humanHeat, 20, 0.1),
    botTraffic: createBrush(THEME.botHeat, 20, 0.05),
    humanKill: createBrush(THEME.killHeat, 30, 0.35),
    botKill: createBrush(THEME.killHeat, 30, 0.20),
    humanDeath: createBrush(THEME.deathHeat, 30, 0.35),
    botDeath: createBrush(THEME.deathHeat, 30, 0.20),
};

// ==========================================
// BOOT & PIPELINE
// ==========================================
async function boot() {
    try {
        const res = await fetch(`data/meta.json?t=${Date.now()}`);
        if (!res.ok) throw new Error("No DB");
        const meta = await res.json();
        
        STATE.availableMaps = meta.maps || [];
        if (STATE.availableMaps.length === 0) throw new Error("Empty DB");

        UI.mapSel.innerHTML = '';
        STATE.availableMaps.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m; opt.textContent = m;
            UI.mapSel.appendChild(opt);
        });

        UI.uploadStatus.textContent = "Database connected.";
        UI.uploadStatus.style.color = "var(--primary)";
        
        // Auto-load first map
        loadMapDB(STATE.availableMaps[0]);

    } catch (e) {
        UI.uploadStatus.textContent = "No database found. Upload Parquet files.";
        UI.uploadStatus.style.color = "var(--danger)";
        UI.mapSel.innerHTML = '<option value="none">No Data</option>';
    }
}

UI.uploadBtn.addEventListener('click', async () => {
    if (UI.uploadInput.files.length === 0) return alert("Select files first.");
    UI.uploadBtn.textContent = "Processing... (Generating Unified DB)";
    UI.uploadBtn.disabled = true;

    const fd = new FormData();
    for (let f of UI.uploadInput.files) fd.append('files', f);

    try {
        const res = await fetch('/upload', { method: 'POST', body: fd });
        if (!res.ok) throw new Error("Server failed to parse");
        
        // Success! Reload app state securely against newly created json
        await boot();
        alert("Pipeline Complete! Unified Database successfully updated.");
    } catch(e) {
        alert("Error in upload/parsing pipeline.");
    }

    UI.uploadBtn.textContent = "Upload & Parse to DB";
    UI.uploadBtn.disabled = false;
});

// ==========================================
// DB LOAD & FILTERING
// ==========================================
async function loadMapDB(mapId) {
    STATE.currentMapId = mapId;
    STATE.rawDB = null;
    
    // Load Image
    const conf = MINIMAP_CONFIG[mapId];
    if (conf) {
        STATE.currentMapImg = new Image();
        STATE.currentMapImg.src = conf.file;
        STATE.currentMapImg.onload = draw;
    }

    // Load DB
    try {
        const res = await fetch(`data/${mapId}.json?t=${Date.now()}`);
        STATE.rawDB = await res.json();
    } catch(e) { console.error("Could not fetch map DB", e); return; }

    refreshDropdowns();
    processBaseEvents();
}

function refreshDropdowns() {
    if (!STATE.rawDB) return;
    const dates = new Set(), users = new Set(), matches = new Set();

    Object.keys(STATE.rawDB).forEach(mId => {
        const m = STATE.rawDB[mId];
        dates.add(m.date);
        matches.add(mId);
        m.events.forEach(ev => users.add(ev[0])); // ev[0] is UserID
    });

    const populate = (sel, set, dft) => {
        sel.innerHTML = `<option value="all">${dft}</option>`;
        Array.from(set).sort().forEach(v => {
            const opt = document.createElement('option');
            opt.value = v; opt.textContent = v;
            sel.appendChild(opt);
        });
    };

    populate(UI.dateSel, dates, "All Dates");
    populate(UI.userSel, users, "All Users");
    
    updateMatchDropdown();
}

function updateMatchDropdown() {
    if (!STATE.rawDB) return;
    const selDate = UI.dateSel.value;
    const selUser = UI.userSel.value;

    UI.matchSel.innerHTML = '<option value="all">All Matches</option>';
    Object.keys(STATE.rawDB).forEach(mId => {
        const m = STATE.rawDB[mId];
        if (selDate !== 'all' && m.date !== selDate) return;
        if (selUser !== 'all' && !m.events.some(ev => ev[0] === selUser)) return;
        
        const opt = document.createElement('option');
        opt.value = mId; opt.textContent = mId.substring(0, 12) + "...";
        UI.matchSel.appendChild(opt);
    });
}

function processBaseEvents() {
    // 1. Gather all events matching top-level Selectors
    STATE.baseEvents = [];
    if (!STATE.rawDB) return;

    const sDate = UI.dateSel.value, sUser = UI.userSel.value, sMatch = UI.matchSel.value;

    Object.keys(STATE.rawDB).forEach(mId => {
        const m = STATE.rawDB[mId];
        if (sDate !== 'all' && m.date !== sDate) return;
        if (sMatch !== 'all' && mId !== sMatch) return;

        let evs = m.events;
        if (sUser !== 'all') evs = evs.filter(e => e[0] === sUser);
        
        STATE.baseEvents.push(...evs);
    });

    // Extremely critical: Ensure pure chronological order
    STATE.baseEvents.sort((a,b) => a[5] - b[5]); 

    // Reset Relative Time Bounds
    STATE.relMinMs = null; 
    STATE.relMaxMs = null;
    UI.timeRelStart.value = '';
    UI.timeRelEnd.value = '';

    rebuildTimeline();
}

UI.mapSel.addEventListener('change', () => loadMapDB(UI.mapSel.value));
UI.dateSel.addEventListener('change', updateMatchDropdown);
UI.userSel.addEventListener('change', updateMatchDropdown);
UI.applyContextBtn.addEventListener('click', processBaseEvents);

// ==========================================
// TIMELINE SCRUBBER & RELATIVE TIME
// ==========================================
UI.applyTimeRelBtn.addEventListener('click', () => {
    const vStart = parseFloat(UI.timeRelStart.value);
    const vEnd = parseFloat(UI.timeRelEnd.value);

    // Convert minutes to ms offset. If empty, nullify.
    STATE.relMinMs = isNaN(vStart) ? null : vStart * 60000;
    STATE.relMaxMs = isNaN(vEnd) ? null : vEnd * 60000;

    rebuildTimeline();
});

// PM Note explicitly requested: clicking scrubber when disabled prompts user
UI.scrubTrackWrapper.addEventListener('click', (e) => {
    if (UI.scrubber.disabled) {
        alert("Please set the relative time filter");
        e.stopPropagation();
        e.preventDefault();
    }
}, true); // Use capture phase

function rebuildTimeline() {
    if (STATE.baseEvents.length === 0) {
        STATE.slicedTimeline = [];
        resetScrubber();
        draw();
        return;
    }

    const tZero = STATE.baseEvents[0][5]; // Absolute epoch start of the dataset

    let fMin = tZero;
    let fMax = STATE.baseEvents[STATE.baseEvents.length - 1][5];

    let hasRelativeFilter = false;

    if (STATE.relMinMs !== null || STATE.relMaxMs !== null) {
        hasRelativeFilter = true;
        if (STATE.relMinMs !== null) fMin = Math.max(fMin, tZero + STATE.relMinMs);
        if (STATE.relMaxMs !== null) fMax = Math.min(fMax, tZero + STATE.relMaxMs);

        // Strict relative slice
        STATE.slicedTimeline = STATE.baseEvents.filter(e => e[5] >= fMin && e[5] <= fMax);
    } else {
        STATE.slicedTimeline = STATE.baseEvents.map(e => e); // Copy
    }

    if (STATE.slicedTimeline.length === 0) {
        resetScrubber();
        draw();
        return;
    }

    // Configure Scrubber
    if (!hasRelativeFilter) {
        UI.scrubber.disabled = true;
        UI.btnPlay.disabled = true;
        UI.scrubber.min = 0;
        UI.scrubber.max = 0;
        UI.scrubber.value = 0;
        STATE.scrubIndex = STATE.slicedTimeline.length - 1; // Draw everything
        
        UI.timeCurrent.textContent = "0:00";
        UI.timeTotal.textContent = "0:00";
    } else {
        UI.scrubber.disabled = false;
        UI.btnPlay.disabled = false;
        UI.scrubber.min = 0;
        UI.scrubber.max = STATE.slicedTimeline.length - 1;
        
        // Start at end of slice so user sees everything right away, can scrub backwards
        STATE.scrubIndex = STATE.slicedTimeline.length - 1;
        UI.scrubber.value = STATE.scrubIndex;

        UI.timeTotal.textContent = msToTime(STATE.slicedTimeline[STATE.slicedTimeline.length - 1][5] - tZero);
        updateScrubberLabel();
    }

    draw();
}

function resetScrubber() {
    UI.scrubber.disabled = true;
    UI.btnPlay.disabled = true;
    UI.scrubber.min = 0; UI.scrubber.max = 0; UI.scrubber.value = 0;
    STATE.scrubIndex = 0;
    UI.timeCurrent.textContent = "0:00";
    UI.timeTotal.textContent = "0:00";
    UI.evCounter.textContent = "0 events mapped";
}

function msToTime(msOffset) {
    if (msOffset < 0) msOffset = 0;
    const tSec = Math.floor(msOffset / 1000);
    const m = Math.floor(tSec / 60);
    const s = tSec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
}

function updateScrubberLabel() {
    if (!STATE.slicedTimeline[STATE.scrubIndex]) return;
    const tZero = STATE.baseEvents[0][5];
    const msOffset = STATE.slicedTimeline[STATE.scrubIndex][5] - tZero;
    UI.timeCurrent.textContent = msToTime(msOffset);
}

UI.scrubber.addEventListener('input', () => {
    STATE.scrubIndex = parseInt(UI.scrubber.value);
    updateScrubberLabel();
    draw();
});

UI.btnPlay.addEventListener('click', () => {
    if (STATE.isPlaying) {
        STATE.isPlaying = false;
        UI.btnPlay.textContent = "Play";
        cancelAnimationFrame(STATE.animId);
    } else {
        if (STATE.scrubIndex >= STATE.slicedTimeline.length - 1) {
            STATE.scrubIndex = 0;
        }
        STATE.isPlaying = true;
        UI.btnPlay.textContent = "Pause";
        tickPlay();
    }
});

function tickPlay() {
    if (!STATE.isPlaying) return;
    STATE.scrubIndex += Math.max(1, Math.ceil(STATE.slicedTimeline.length / 400));
    
    if (STATE.scrubIndex >= STATE.slicedTimeline.length - 1) {
        STATE.scrubIndex = STATE.slicedTimeline.length - 1;
        STATE.isPlaying = false;
        UI.btnPlay.textContent = "Play";
    }
    
    UI.scrubber.value = STATE.scrubIndex;
    updateScrubberLabel();
    draw();
    
    if (STATE.isPlaying) STATE.animId = requestAnimationFrame(tickPlay);
}

// ==========================================
// RENDER ENGINE (PM Spec: Strictly Separated Humans/Bots)
// ==========================================
// Auto-redraw on any toggle
document.querySelectorAll('input[type="checkbox"]').forEach(c => c.addEventListener('change', draw));

function worldToMinimap(x, z, mapId) {
    const c = MINIMAP_CONFIG[mapId];
    if (!c) return {px: 0, py: 0};
    return {
        px: ((x - c.ox) / c.scale) * 1024,
        py: (1 - ((z - c.oz) / c.scale)) * 1024
    };
}

// Map Controls
UI.wrapper.addEventListener('mousedown', e => { STATE.isDrag = true; STATE.sx = e.clientX - STATE.panX; STATE.sy = e.clientY - STATE.panY; });
window.addEventListener('mouseup', () => STATE.isDrag = false);
window.addEventListener('mousemove', e => { if(STATE.isDrag) { STATE.panX = e.clientX - STATE.sx; STATE.panY = e.clientY - STATE.sy; UI.canvas.style.transform = `translate(${STATE.panX}px, ${STATE.panY}px) scale(${STATE.scale})`; } });
UI.wrapper.addEventListener('wheel', e => { e.preventDefault(); STATE.scale = Math.max(0.1, Math.min(STATE.scale * Math.exp(-e.deltaY * 0.002), 10)); UI.canvas.style.transform = `translate(${STATE.panX}px, ${STATE.panY}px) scale(${STATE.scale})`; });


function draw() {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, 1024, 1024);
    if (STATE.currentMapImg) ctx.drawImage(STATE.currentMapImg, 0, 0, 1024, 1024);

    if (STATE.slicedTimeline.length === 0) {
        UI.evCounter.textContent = "0 events mapped";
        return;
    }

    // State Lookups
    const st = {
        hPath: UI.chkHumanPaths.checked,
        bPath: UI.chkBotPaths.checked,
        heatHPath: UI.chkHeatHumanPath.checked,
        heatBPath: UI.chkHeatBotPath.checked,
        heatHKill: UI.chkHeatHumanKill.checked,
        heatBKill: UI.chkHeatBotKill.checked,
        heatHDeath: UI.chkHeatHumanDeath.checked,
        heatBDeath: UI.chkHeatBotDeath.checked,
        evHKill: UI.chkEvHumanKill.checked,
        evBKill: UI.chkEvBotKill.checked,
        evHDeath: UI.chkEvHumanDeath.checked,
        evHStorm: UI.chkEvHumanStorm.checked,
        evBDeath: UI.chkEvBotDeath.checked,
        evBStorm: UI.chkEvBotStorm.checked,
        evLoot: UI.chkEvLoot.checked
    };

    const paths = {}; // { uid: { bot: bool, p: [] } }
    const heatArr = [];
    const ptsArr = [];

    const lim = Math.min(STATE.scrubIndex, STATE.slicedTimeline.length - 1);
    
    // Aggregation Pass
    for (let i = 0; i <= lim; i++) {
        const [uid, isBot, evType, pxWorld, pzWorld] = STATE.slicedTimeline[i];
        const pt = worldToMinimap(pxWorld, pzWorld, STATE.currentMapId);

        if (evType === 'Position' || evType === 'BotPosition') {
            if ((!isBot && st.heatHPath) || (isBot && st.heatBPath)) {
                heatArr.push({ brush: isBot ? BRUSHES.botTraffic : BRUSHES.humanTraffic, pt, r: 20 });
            }
            if ((!isBot && st.hPath) || (isBot && st.bPath)) {
                if (!paths[uid]) paths[uid] = { bot: isBot, pts: [] };
                paths[uid].pts.push(pt);
            }
        } 
        else {
            let processedAsHeat = false;
            // Kills
            if (evType === 'Kill' || evType === 'BotKill') {
                if (!isBot && st.heatHKill) { heatArr.push({ brush: BRUSHES.humanKill, pt, r: 30 }); processedAsHeat = true; }
                if (isBot && st.heatBKill) { heatArr.push({ brush: BRUSHES.botKill, pt, r: 30 }); processedAsHeat = true; }
            }
            // Deaths
            if (evType.includes('Death')) {
                if (!isBot && st.heatHDeath) { heatArr.push({ brush: BRUSHES.humanDeath, pt, r: 30 }); processedAsHeat = true; }
                if (isBot && st.heatBDeath) { heatArr.push({ brush: BRUSHES.botDeath, pt, r: 30 }); processedAsHeat = true; }
            }

            if (!processedAsHeat) ptsArr.push({ evType, isBot, pt });
        }
    }

    let drawCount = 0;

    // Render 1: Heatmaps (Additive blending)
    if (heatArr.length > 0) {
        ctx.globalCompositeOperation = 'lighter';
        for (let h of heatArr) {
            ctx.drawImage(h.brush, h.pt.px - h.r, h.pt.py - h.r);
        }
        ctx.globalCompositeOperation = 'source-over'; // Reset
        drawCount += heatArr.length;
    }

    // Render 2: Paths
    ctx.lineWidth = 1.5;
    for (let u in paths) {
        const path = paths[u];
        if (path.pts.length < 2) continue;
        ctx.strokeStyle = path.bot ? THEME.bot : THEME.human;
        ctx.beginPath();
        ctx.moveTo(path.pts[0].px, path.pts[0].py);
        for (let i = 1; i < path.pts.length; i++) ctx.lineTo(path.pts[i].px, path.pts[i].py);
        ctx.stroke();
        drawCount += path.pts.length;
    }

    // Render 3: Points
    for (let p of ptsArr) {
        const t = p.evType;
        const pt = p.pt;

        if (t === 'Kill' && st.evHKill) drawX(pt, '#ff3333');
        else if (t === 'BotKill' && st.evBKill) drawX(pt, '#ff3333');
        else if (t === 'Death' && st.evHDeath) drawC(pt, '#cc0000');
        else if (t === 'BotDeath' && st.evBDeath) drawC(pt, '#cc0000');
        else if (t === 'StormDeath' && st.evHStorm) drawC(pt, '#9933ff');
        else if (t === 'BotStormDeath' && st.evBStorm) drawC(pt, '#9933ff');
        else if (t === 'Loot' && st.evLoot) { ctx.fillStyle = '#ffff00'; ctx.fillRect(pt.px-3, pt.py-3, 6, 6); }
        drawCount++;
    }

    UI.evCounter.textContent = `${drawCount} elements mapped for frame`;
}

function drawX(pt, col) { ctx.strokeStyle = col; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(pt.px-4, pt.py-4); ctx.lineTo(pt.px+4, pt.py+4); ctx.moveTo(pt.px+4, pt.py-4); ctx.lineTo(pt.px-4, pt.py+4); ctx.stroke(); }
function drawC(pt, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(pt.px, pt.py, 4, 0, Math.PI * 2); ctx.fill(); }

// --- Init sequence ---
boot();
