import { state } from './state.js';
import { getBaseTime, parseEPGDate } from './utils.js';
import { playChannel, minimizePlayer } from './player.js';
import { openModal } from './ui.js';

export async function fetchEPG(url) {
    try {
        const txt = await fetch(url).then(r => r.text());
        const xml = new DOMParser().parseFromString(txt, "text/xml");
        const progs = xml.getElementsByTagName('programme');
        state.epg = {};
        const shiftMs = state.epgShift * 3600000;
        for (let p of progs) {
            const cid = p.getAttribute('channel');
            if (!state.epg[cid]) state.epg[cid] = [];
            const startTs = parseEPGDate(p.getAttribute('start'));
            const stopTs = parseEPGDate(p.getAttribute('stop'));
            if (startTs) {
                state.epg[cid].push({
                    t: p.getElementsByTagName('title')[0]?.textContent,
                    d: p.getElementsByTagName('desc')[0]?.textContent || "No description.",
                    start: startTs + shiftMs,
                    stop: (stopTs || (startTs + 3600000)) + shiftMs
                });
            }
        }
    } catch (e) { console.error("EPG Fetch Error", e); }
}

export function renderGrid() {
    const list = document.getElementById('chList');
    const matrix = document.getElementById('matrix');
    const timer = document.getElementById('timer');
    if (!list || !matrix || !timer) return; // Guard clause

    list.innerHTML = ''; matrix.innerHTML = ''; timer.innerHTML = '';

    const baseTime = getBaseTime();
    state.lastBaseTime = baseTime;

    // Only set style if element exists
    if (matrix) matrix.style.gridTemplateColumns = `repeat(1440, var(--min-w))`;

    for (let i = 0; i < 48; i++) {
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
            pip.style.display = 'block'; // Ensure visible
            if (pip.classList.contains('expanded')) minimizePlayer({ stopPropagation: () => { } });
        };
        cDiv.ondblclick = () => openModal(ch.n, "Live Stream", ch.u, ch.n, ch.l);
        list.appendChild(cDiv);

        const progs = state.epg[ch.id] || state.epg[ch.n] || [];
        if (progs.length === 0) {
            drawTile("Live Stream", "Direct Broadcast", 1, 1440, idx + 1, ch.u, ch.n, ch.l, null, null);
        } else {
            progs.forEach(p => {
                if (p.stop <= baseTime) return;
                const startDiff = (p.start - baseTime) / 60000;
                const duration = (p.stop - p.start) / 60000;
                let colStart = Math.floor(startDiff) + 1;
                let span = Math.ceil(duration);

                if (colStart < 1) { span = span + (colStart - 1); colStart = 1; }
                if (span > 0 && colStart <= 1440) {
                    drawTile(p.t, p.d, colStart, span, idx + 1, ch.u, ch.n, ch.l, p.start, p.stop);
                }
            });
        }
    });
}

function drawTile(t, d, col, span, row, u, chN, logo, start, stop) {
    const el = document.createElement('div');
    el.className = 'prog-node'; el.tabIndex = 0;
    el.style.gridColumn = `${col} / span ${span}`;
    el.style.gridRow = `${row}`;
    if (span > 4) { el.innerHTML = `<strong>${t}</strong>`; } else { el.title = t; }

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

export function renderChannelGrids() {
    const favGrid = document.getElementById('fav-grid');
    const allGrid = document.getElementById('all-grid');
    favGrid.innerHTML = ''; allGrid.innerHTML = '';

    document.getElementById('fav-section').style.display = state.favorites.length > 0 ? 'block' : 'none';

    state.favorites.forEach((ch, i) => {
        favGrid.appendChild(createChannelTile(ch, i));
    });

    state.channels.forEach((ch, i) => {
        if (!state.favorites.find(f => f.n === ch.n)) {
            const delayIndex = i < 50 ? i : 50;
            allGrid.appendChild(createChannelTile(ch, delayIndex));
        }
    });
}

export function createChannelTile(ch, index) {
    const d = document.createElement('div');
    d.className = 'channel-tile';

    const delay = Math.min(index * 0.03, 0.5);
    d.style.animationDelay = `${delay}s`;

    d.innerHTML = (ch.l ? `<img src="${ch.l}">` : '') + `<span>${ch.n}</span>`;
    d.onclick = () => {
        playChannel(ch);
        const pip = document.getElementById('pip-box');
        pip.style.display = 'block'; pip.classList.add('expanded');
        // We need handlePlayerMouse from player.js, but handlePlayerMouse is exported.
        // Wait, handlePlayerMouse is imported in player.js logic?
        // We can just add the class here or import it if needed.
        // Let's assume the player logic handles its own mouse if listeners are set up, 
        // but here we are explicitly showing it. 
        // Let's import handlePlayerMouse just to be safe if we want to trigger it.
        // Or better, just add the class manually as it's UI logic.
        pip.classList.add('ui-active');
        setTimeout(() => pip.classList.remove('ui-active'), 3000);
    };
    return d;
}

export function toggleFavorite(ch) {
    const idx = state.favorites.findIndex(f => f.n === ch.n);
    if (idx > -1) { state.favorites.splice(idx, 1); }
    else { state.favorites.push(ch); }
    localStorage.setItem('met_favs', JSON.stringify(state.favorites));
    renderChannelGrids();
}

export function checkGridReflow() {
    const currentBase = getBaseTime();
    // Only reflow if we have channels and time block changed
    if (currentBase !== state.lastBaseTime && state.channels.length > 0) {
        renderGrid();
    }
}
