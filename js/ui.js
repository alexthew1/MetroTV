import { state, setState } from './state.js';
import { COLORS } from './constants.js';

export function view(v) {
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
    if (isC || isS) {
        if (!pip.classList.contains('expanded')) pip.style.display = 'none';
    } else if (isG && state.sel && hasP) { pip.style.display = 'block'; }
}

export function openModal(t, d, u, chN, logo, start, stop) {
    state.sel = { t, u, l: logo, d, chN, start, stop };
    document.getElementById('modal-title').innerText = t;
    document.getElementById('modal-overlay').style.display = 'flex';
}

export function doAct(type, playCallback) {
    document.getElementById('modal-overlay').style.display = 'none';
    if (type === 'watch' && state.sel) {
        const pip = document.getElementById('pip-box');
        pip.style.display = 'block'; pip.classList.add('expanded');
        if (playCallback) playCallback(state.sel);
    }
}

export function applyTheme(c) {
    state.accent = c;
    document.documentElement.style.setProperty('--accent', c);
    localStorage.setItem('met_ac_v34', c);
}

export function renderSwatches() {
    const s = document.getElementById('swatches');
    s.innerHTML = ''; // Ensure clear before render
    COLORS.forEach(c => {
        const d = document.createElement('div'); d.className = 'swatch'; d.style.background = c;
        d.onclick = () => applyTheme(c); s.appendChild(d);
    });
}
