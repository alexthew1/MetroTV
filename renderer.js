const COLORS = ['#00aba9', '#a4c400', '#1ba1e2', '#6a00ff', '#d80073', '#e51400', '#fa6800', '#f0a30a'];

// --- ICON PATHS ---
const ICON_VOL_UP = "M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z";
const ICON_VOL_OFF = "M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z";
const ICON_PLAY = "M8 5v14l11-7z";
const ICON_PAUSE = "M6 19h4V5H6v14zm8-14v14h4V5h-4z";

let state = {
    channels: [], epg: {}, 
    favorites: JSON.parse(localStorage.getItem('met_favs') || '[]'),
    playlists: JSON.parse(localStorage.getItem('met_v34') || '[]'),
    activeIdx: parseInt(localStorage.getItem('met_act_idx_v34') || '0'),
    accent: localStorage.getItem('met_ac_v34') || '#00aba9',
    epgShift: 0,
    sel: null, activeCh: null, lastBaseTime: 0
};
let hlsApi = null;

document.addEventListener('DOMContentLoaded', () => {
    init();

    // Nav
    document.getElementById('tab-g').onclick = () => view('guide');
    document.getElementById('tab-c').onclick = () => view('channels');
    document.getElementById('tab-s').onclick = () => view('settings');
    
    // Player
    document.getElementById('pip-box').onclick = goFull;
    document.getElementById('pip-box').onmousemove = handlePlayerMouse;
    document.getElementById('btn-play').onclick = togglePlay;
    document.getElementById('btn-mute').onclick = toggleMute;
    document.getElementById('btn-mini').onclick = minimizePlayer;
    
    // Settings / Actions
    document.getElementById('btn-save-pl').onclick = addPlaylist;
    document.getElementById('btn-add-pl-nav').onclick = () => view('settings');
    document.getElementById('btn-backup').onclick = exportData;
    document.getElementById('btn-restore').onclick = importData;
    
    // Modal
    document.getElementById('modal-watch').onclick = () => doAct('watch');
    document.getElementById('modal-close').onclick = () => doAct('close');
    
    // Ribbon delegation
    document.querySelectorAll('.ribbon-btn').forEach(btn => {
        btn.onclick = () => ribbonAction(btn.dataset.act);
    });
});

function init() {
    applyTheme(state.accent);
    renderSwatches();
    renderSaved();
    checkPlaylists();
    
    document.getElementById('gridCont').onscroll = (e) => { 
        document.getElementById('timer').scrollLeft = e.target.scrollLeft; 
    };

    document.addEventListener('keydown', (e) => {
        const pip = document.getElementById('pip-box');
        if (pip.classList.contains('expanded') && state.sel) {
            if (e.key === 'ArrowDown') switchChannel('next');
            if (e.key === 'ArrowUp') switchChannel('prev');
        }
    });

    setInterval(updateProgressBar, 1000);
}

function updateProgressBar() {
    const nowTs = new Date().getTime();
    let pct = 0;

    if(state.sel && state.sel.start && state.sel.stop) {
        const totalDur = state.sel.stop - state.sel.start;
        const elapsed = nowTs - state.sel.start;
        pct = (elapsed / totalDur) * 100;
        if(pct < 0) pct = 0; if(pct > 100) pct = 100;
    } else if (state.sel) { 
        pct = 100; 
    }
    
    document.getElementById('progress-bar').style.width = pct + "%";

    const currentBase = getBaseTime();
    if(currentBase !== state.lastBaseTime && state.channels.length > 0) {
        renderGrid(); 
    }
}

function getBaseTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() >= 30 ? 30 : 0);
    now.setSeconds(0); now.setMilliseconds(0);
    return now.getTime();
}

function switchChannel(dir) {
    const currentIdx = state.channels.findIndex(ch => ch.u === state.activeCh.u);
    if (currentIdx === -1) return;
    
    let newIdx = dir === 'next' ? (currentIdx + 1) : (currentIdx - 1 + state.channels.length);
    newIdx %= state.channels.length;
    playChannel(state.channels[newIdx]);
}

function playChannel(obj) {
    // 1. RE-HYDRATION FIX
    let freshCh = state.channels.find(c => c.u === obj.u) || state.channels.find(c => c.n === obj.n);
    if(freshCh) obj = freshCh; 

    const chName = obj.chN || obj.n || obj.t || "Unknown Channel";
    
    // 2. EPG LOOKUP
    const now = new Date().getTime();
    const progs = state.epg[obj.id] || state.epg[obj.n] || state.epg[chName] || [];
    const currentProg = progs.find(p => now >= p.start && now < p.stop);

    state.activeCh = { n: chName, u: obj.u, l: obj.l };

    state.sel = { 
        t: currentProg ? currentProg.t : chName, 
        u: obj.u, 
        l: obj.l, 
        chN: chName, 
        d: currentProg ? currentProg.d : "Live Broadcast", 
        start: currentProg ? currentProg.start : null, 
        stop: currentProg ? currentProg.stop : null    
    };

    document.getElementById('fs-logo').src = obj.l || '';
    document.getElementById('fs-ch-name').innerText = state.sel.t; 
    
    const v = document.getElementById('vid');
    
    // FORCE UNMUTE
    v.muted = false; 

    if(Hls.isSupported()){ 
        if(hlsApi) hlsApi.destroy();
        hlsApi = new Hls(); hlsApi.loadSource(obj.u); hlsApi.attachMedia(v); v.play();
    } else { v.src = obj.u; v.play(); }
    
    // UPDATE UI ICONS
    updateMuteIcon();
    updatePlayIcon(false); // We are playing, so show Pause icon
    handlePlayerMouse();
    updateProgressBar();
}

function checkPlaylists() {
    if(state.playlists.length > 0) {
        if(state.activeIdx >= state.playlists.length) state.activeIdx = 0;
        document.getElementById('empty-state').style.display = 'none';
        const p = state.playlists[state.activeIdx];
        state.epgShift = p.shift || 0;
        load(p.m, p.x);
    } else { view('guide'); }
}

function showLoading(show) {
    const el = document.getElementById('loading-overlay');
    const bar = document.getElementById('load-progress');
    if(show) { el.style.display = 'flex'; setTimeout(() => bar.style.width = '70%', 50); }
    else { bar.style.width = '100%'; setTimeout(() => { el.style.display = 'none'; bar.style.width = '0%'; }, 500); }
}

async function load(m, x) {
    showLoading(true);
    try {
        const mText = await fetch(m).then(r => r.text());
        state.channels = [];
        mText.split('#EXTINF').forEach(chunk => {
            if(!chunk.includes('http')) return;
            state.channels.push({
                n: chunk.split(',')[1]?.split('\n')[0].trim(),
                u: chunk.split('\n').find(l => l.startsWith('http'))?.trim(),
                l: chunk.match(/tvg-logo="([^"]+)"/)?.[1],
                id: chunk.match(/tvg-id="([^"]+)"/)?.[1]
            });
        });
        if(x) await fetchEPG(x);
        renderGrid();
        renderChannelGrids();
        view('guide');
    } catch(e) { console.error("Load Failed", e); }
    showLoading(false);
}

function parseEPGDate(tStr) {
    if(!tStr || tStr.length < 12) return null;
    const y = parseInt(tStr.substring(0,4));
    const m = parseInt(tStr.substring(4,6)) - 1;
    const d = parseInt(tStr.substring(6,8));
    const h = parseInt(tStr.substring(8,10));
    const min = parseInt(tStr.substring(10,12));
    return new Date(y, m, d, h, min).getTime();
}

async function fetchEPG(url) {
    try {
        const txt = await fetch(url).then(r => r.text());
        const xml = new DOMParser().parseFromString(txt, "text/xml");
        const progs = xml.getElementsByTagName('programme');
        state.epg = {};
        const shiftMs = state.epgShift * 3600000;
        for(let p of progs) {
            const cid = p.getAttribute('channel');
            if(!state.epg[cid]) state.epg[cid] = [];
            const startTs = parseEPGDate(p.getAttribute('start'));
            const stopTs = parseEPGDate(p.getAttribute('stop'));
            if(startTs) {
                state.epg[cid].push({
                    t: p.getElementsByTagName('title')[0]?.textContent,
                    d: p.getElementsByTagName('desc')[0]?.textContent || "No description.",
                    start: startTs + shiftMs, 
                    stop: (stopTs || (startTs + 3600000)) + shiftMs
                });
            }
        }
    } catch(e) {}
}

function renderGrid() {
    const list = document.getElementById('chList');
    const matrix = document.getElementById('matrix');
    const timer = document.getElementById('timer');
    list.innerHTML = ''; matrix.innerHTML = ''; timer.innerHTML = '';
    
    const baseTime = getBaseTime();
    state.lastBaseTime = baseTime;
    matrix.style.gridTemplateColumns = `repeat(1440, var(--min-w))`;
    
    for(let i=0; i<48; i++) {
        const sTime = new Date(baseTime + (i * 30 * 60000));
        const s = document.createElement('div'); s.className = 'time-slot';
        s.innerText = `${sTime.getHours()}:${sTime.getMinutes() === 0 ? '00' : '30'}`; 
        timer.appendChild(s);
    }

    state.channels.forEach((ch, idx) => {
        const cDiv = document.createElement('div');
        cDiv.className = 'ch-item';
        cDiv.innerHTML = (ch.l ? `<img src="${ch.l}">` : '') + `<span>${ch.n}</span>`;
        cDiv.onclick = () => {
            playChannel(ch); 
            const pip = document.getElementById('pip-box');
            if(pip.classList.contains('expanded')) minimizePlayer({stopPropagation:()=>{}});
        };
        cDiv.ondblclick = () => openModal(ch.n, "Live Stream", ch.u, ch.n, ch.l);
        list.appendChild(cDiv);

        const progs = state.epg[ch.id] || state.epg[ch.n] || [];
        if(progs.length === 0) {
            drawTile("Live Stream", "Direct Broadcast", 1, 1440, idx+1, ch.u, ch.n, ch.l, null, null);
        } else {
            progs.forEach(p => {
                if (p.stop <= baseTime) return;
                const startDiff = (p.start - baseTime) / 60000;
                const duration = (p.stop - p.start) / 60000;
                let colStart = Math.floor(startDiff) + 1;
                let span = Math.ceil(duration);
                
                if (colStart < 1) { span = span + (colStart - 1); colStart = 1; }
                if (span > 0 && colStart <= 1440) {
                    drawTile(p.t, p.d, colStart, span, idx+1, ch.u, ch.n, ch.l, p.start, p.stop);
                }
            });
        }
    });
}

function drawTile(t, d, col, span, row, u, chN, logo, start, stop) {
    const el = document.createElement('div');
    el.className = 'prog-node'; el.tabIndex = 0;
    el.style.gridColumn = `${col} / span ${span}`; 
    el.style.gridRow = row;
    if(span > 4) { el.innerHTML = `<strong>${t}</strong>`; } else { el.title = t; }
    
    el.onclick = () => {
        state.sel = { t, u, l: logo, d, chN, start, stop };
        state.activeCh = { n: chN, u: u, l: logo };
        document.getElementById('meta-title').innerText = t;
        document.getElementById('meta-sub').innerText = chN;
        document.getElementById('meta-desc').innerText = d;
        document.querySelectorAll('.ch-item, .prog-node').forEach(x => x.classList.remove('selected'));
        el.classList.add('selected'); el.focus();
    };

    el.ondblclick = () => openModal(t, d, u, chN, logo, start, stop);
    document.getElementById('matrix').appendChild(el);
}

function ribbonAction(act) {
    if(act === 'info' && state.sel) alert(`${state.sel.t}\n${state.sel.chN}\n\n${state.sel.d}`);
    if(act === 'refresh' && state.playlists[0]) load(state.playlists[0].m, state.playlists[0].x);
    if(act === 'fav' && state.activeCh) toggleFavorite(state.activeCh);
}

function toggleFavorite(ch) {
    const idx = state.favorites.findIndex(f => f.n === ch.n);
    if(idx > -1) { state.favorites.splice(idx, 1); }
    else { state.favorites.push(ch); }
    localStorage.setItem('met_favs', JSON.stringify(state.favorites));
    renderChannelGrids();
}

function renderChannelGrids() {
    const favGrid = document.getElementById('fav-grid');
    const allGrid = document.getElementById('all-grid');
    favGrid.innerHTML = ''; allGrid.innerHTML = '';
    
    document.getElementById('fav-section').style.display = state.favorites.length > 0 ? 'block' : 'none';
    
    state.favorites.forEach((ch, i) => { 
        favGrid.appendChild(createChannelTile(ch, i)); 
    });
    
    state.channels.forEach((ch, i) => {
        if(!state.favorites.find(f => f.n === ch.n)) {
            const delayIndex = i < 50 ? i : 50; 
            allGrid.appendChild(createChannelTile(ch, delayIndex));
        }
    });
}

function createChannelTile(ch, index) {
    const d = document.createElement('div');
    d.className = 'channel-tile';
    
    const delay = Math.min(index * 0.03, 0.5); 
    d.style.animationDelay = `${delay}s`;

    d.innerHTML = (ch.l ? `<img src="${ch.l}">` : '') + `<span>${ch.n}</span>`;
    d.onclick = () => {
        playChannel(ch);
        const pip = document.getElementById('pip-box');
        pip.style.display = 'block'; pip.classList.add('expanded');
        handlePlayerMouse();
    };
    return d;
}

function openModal(t, d, u, chN, logo, start, stop) {
    state.sel = { t, u, l: logo, d, chN, start, stop };
    document.getElementById('modal-title').innerText = t;
    document.getElementById('modal-overlay').style.display = 'flex';
}

function doAct(type) {
    document.getElementById('modal-overlay').style.display = 'none';
    if(type === 'watch' && state.sel) {
        const pip = document.getElementById('pip-box');
        pip.style.display = 'block'; pip.classList.add('expanded'); 
        playChannel(state.sel); handlePlayerMouse();
    }
}

function goFull() {
    const pip = document.getElementById('pip-box');
    if(!pip.classList.contains('expanded')) {
        pip.classList.add('expanded');
        if(state.sel) {
            document.getElementById('fs-logo').src = state.sel.l || '';
            document.getElementById('fs-ch-name').innerText = state.sel.t || state.sel.chN || '';
        }
        handlePlayerMouse();
    }
}

function handlePlayerMouse() {
    const pip = document.getElementById('pip-box');
    if(!pip.classList.contains('expanded')) return;
    pip.classList.add('ui-active');
    clearTimeout(state.uiTimer);
    state.uiTimer = setTimeout(() => pip.classList.remove('ui-active'), 3000);
}

function minimizePlayer(e) { 
    e.stopPropagation(); 
    const pip = document.getElementById('pip-box');
    const inChannels = document.getElementById('channels-view').style.display === 'flex';
    if(inChannels) {
        pip.style.display = 'none'; pip.classList.remove('expanded');
        const v = document.getElementById('vid'); v.pause(); v.src = "";
    } else { pip.classList.remove('expanded', 'ui-active'); }
}

function togglePlay(e) { 
    e.stopPropagation(); 
    const v = document.getElementById('vid'); 
    
    if (v.paused) {
        v.play();
        updatePlayIcon(false); // Playing = Show Pause
    } else {
        v.pause();
        updatePlayIcon(true); // Paused = Show Play
    }
}

// NEW FUNCTION: Updates the Play/Pause SVG
function updatePlayIcon(isPaused) {
    const icon = document.getElementById('play-icon');
    const path = icon.querySelector('path');
    path.setAttribute('d', isPaused ? ICON_PLAY : ICON_PAUSE);
}

function toggleMute(e) { 
    e.stopPropagation(); 
    const v = document.getElementById('vid'); 
    v.muted = !v.muted;
    updateMuteIcon();
}

function updateMuteIcon() {
    const v = document.getElementById('vid');
    const icon = document.getElementById('mute-icon');
    const path = icon.querySelector('path'); 
    path.setAttribute('d', v.muted ? ICON_VOL_OFF : ICON_VOL_UP);
}

function view(v) {
    const isG = v === 'guide';
    const isC = v === 'channels';
    const isS = v === 'settings';
    const hasP = state.playlists.length > 0;

    const gEl = document.getElementById('guide-view');
    const cEl = document.getElementById('channels-view');
    const sEl = document.getElementById('settings-view');
    const empty = document.getElementById('empty-state');
    const ribbon = document.getElementById('ribbon');
    const info = document.getElementById('info-area');

    [gEl, cEl, sEl].forEach(el => {
        el.classList.remove('anim-enter');
        void el.offsetWidth;
    });

    gEl.style.display = (isG && hasP) ? 'flex' : 'none';
    cEl.style.display = (isC && hasP) ? 'flex' : 'none';
    sEl.style.display = isS ? 'block' : 'none';
    empty.style.display = (!hasP && !isS) ? 'flex' : 'none';
    ribbon.style.display = (isG && hasP) ? 'flex' : 'none';
    info.style.display = (isG && hasP) ? 'flex' : 'none';

    if (isG && hasP) gEl.classList.add('anim-enter');
    if (isC && hasP) cEl.classList.add('anim-enter');
    if (isS) sEl.classList.add('anim-enter');

    document.getElementById('tab-g').className = isG ? 'active' : '';
    document.getElementById('tab-c').className = isC ? 'active' : '';
    document.getElementById('tab-s').className = isS ? 'active' : '';

    const pip = document.getElementById('pip-box');
    if(isC || isS) {
        if(!pip.classList.contains('expanded')) pip.style.display = 'none';
    } else if (isG && state.sel && hasP) { pip.style.display = 'block'; }
}

function addPlaylist() {
    const nameIn = document.getElementById('pl-name');
    const mIn = document.getElementById('m3u-in');
    const xIn = document.getElementById('xml-in');
    const sIn = document.getElementById('epg-shift');

    const m = mIn.value.trim();
    if(!m) { alert("M3U URL is required"); return; }

    const name = nameIn.value.trim() || "Playlist " + (state.playlists.length + 1);
    const x = xIn.value.trim();
    const shift = parseFloat(sIn.value || '0');
    
    const newPl = { name, m, x, shift };
    state.playlists.push(newPl);
    state.activeIdx = state.playlists.length - 1;
    
    saveState();
    renderSaved();
    checkPlaylists();
    view('guide');
    nameIn.value = ''; mIn.value = ''; xIn.value = ''; sIn.value = '';
}

function setActivePlaylist(idx) {
    state.activeIdx = idx; saveState();
    checkPlaylists(); renderSaved();
}

function deletePlaylist(idx) {
    state.playlists.splice(idx, 1);
    if(state.activeIdx >= state.playlists.length) state.activeIdx = Math.max(0, state.playlists.length - 1);
    saveState(); renderSaved();
    if(state.playlists.length === 0) {
        document.getElementById('empty-state').style.display = 'flex';
        document.getElementById('guide-view').style.display = 'none';
    } else { checkPlaylists(); }
}

function saveState() {
    localStorage.setItem('met_v34', JSON.stringify(state.playlists));
    localStorage.setItem('met_act_idx_v34', state.activeIdx);
}

async function exportData() {
    const dataStr = JSON.stringify(state, null, 2);
    const success = await window.metroAPI.saveConfig(dataStr);
    if(success) alert("Config Backed Up Successfully!");
}

async function importData() {
    const content = await window.metroAPI.loadConfig();
    if (content) {
        try {
            const loaded = JSON.parse(content);
            state.playlists = loaded.playlists || [];
            state.favorites = loaded.favorites || [];
            state.activeIdx = loaded.activeIdx || 0;
            state.accent = loaded.accent || '#00aba9';
            
            saveState(); 
            localStorage.setItem('met_favs', JSON.stringify(state.favorites));
            localStorage.setItem('met_ac_v34', state.accent);
            
            alert("Config Restored!");
            location.reload();
        } catch(err) { alert("Invalid Config File"); }
    }
}

function applyTheme(c) { state.accent = c; document.documentElement.style.setProperty('--accent', c); localStorage.setItem('met_ac_v34', c); }
function renderSwatches() {
    const s = document.getElementById('swatches');
    COLORS.forEach(c => {
        const d = document.createElement('div'); d.className = 'swatch'; d.style.background = c;
        d.onclick = () => applyTheme(c); s.appendChild(d);
    });
}
function renderSaved() {
    const cont = document.getElementById('saved-lists');
    cont.innerHTML = '';
    state.playlists.forEach((p, i) => {
        const isActive = i === state.activeIdx;
        const d = document.createElement('div'); 
        d.className = `playlist-card ${isActive ? 'active-pl' : ''}`;
        d.onclick = () => setActivePlaylist(i);
        
        const span = document.createElement('span');
        span.innerText = p.name || 'Playlist ' + (i+1);
        
        const btn = document.createElement('button');
        btn.style.cssText = "background:#b00; border:none; color:white; padding:8px 15px; cursor:pointer; font-weight:bold";
        btn.innerText = "DEL";
        btn.onclick = (e) => { e.stopPropagation(); deletePlaylist(i); };

        d.appendChild(span);
        d.appendChild(btn);
        cont.appendChild(d);
    });
}