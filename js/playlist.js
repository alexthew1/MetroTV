import { state } from './state.js';
import { renderGrid, renderChannelGrids, fetchEPG } from './epg.js';
import { view } from './ui.js';
import { showLoading } from './utils.js';
import { saveState } from './settings.js';

export async function load(m, x) {
    showLoading(true);
    try {
        const mText = await fetch(m).then(r => r.text());
        state.channels = [];
        mText.split('#EXTINF').forEach(chunk => {
            if (!chunk.includes('http')) return;
            state.channels.push({
                n: chunk.split(',')[1]?.split('\n')[0].trim(),
                u: chunk.split('\n').find(l => l.startsWith('http'))?.trim(),
                l: chunk.match(/tvg-logo="([^"]+)"/)?.[1],
                id: chunk.match(/tvg-id="([^"]+)"/)?.[1]
            });
        });
        if (x) await fetchEPG(x);
        renderGrid();
        renderChannelGrids();
        view('guide');
    } catch (e) { console.error("Load Failed", e); }
    showLoading(false);
}

export function checkPlaylists() {
    if (state.playlists.length > 0) {
        if (state.activeIdx >= state.playlists.length) state.activeIdx = 0;
        document.getElementById('empty-state').style.display = 'none';
        const p = state.playlists[state.activeIdx];
        state.epgShift = p.shift || 0;
        load(p.m, p.x);
    } else { view('guide'); }
}

export function addPlaylist() {
    const nameIn = document.getElementById('pl-name');
    const mIn = document.getElementById('m3u-in');
    const xIn = document.getElementById('xml-in');
    const sIn = document.getElementById('epg-shift');

    const m = mIn.value.trim();
    if (!m) { alert("M3U URL is required"); return; }

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

export function deletePlaylist(idx) {
    state.playlists.splice(idx, 1);
    if (state.activeIdx >= state.playlists.length) state.activeIdx = Math.max(0, state.playlists.length - 1);
    saveState(); renderSaved();
    if (state.playlists.length === 0) {
        document.getElementById('empty-state').style.display = 'flex';
        document.getElementById('guide-view').style.display = 'none';
    } else { checkPlaylists(); }
}

export function setActivePlaylist(idx) {
    state.activeIdx = idx; saveState();
    checkPlaylists(); renderSaved();
}

export function renderSaved() {
    const cont = document.getElementById('saved-lists');
    cont.innerHTML = '';
    state.playlists.forEach((p, i) => {
        const isActive = i === state.activeIdx;
        const d = document.createElement('div');
        d.className = `playlist-card ${isActive ? 'active-pl' : ''}`;
        d.onclick = () => setActivePlaylist(i);

        const span = document.createElement('span');
        span.innerText = p.name || 'Playlist ' + (i + 1);

        const btn = document.createElement('button');
        btn.style.cssText = "background:#b00; border:none; color:white; padding:8px 15px; cursor:pointer; font-weight:bold";
        btn.innerText = "DEL";
        btn.onclick = (e) => { e.stopPropagation(); deletePlaylist(i); };

        d.appendChild(span);
        d.appendChild(btn);
        cont.appendChild(d);
    });
}
