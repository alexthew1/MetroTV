import { state } from './state.js';
import { ICON_PLAY, ICON_PAUSE, ICON_VOL_OFF, ICON_VOL_UP } from './constants.js';
import { getBaseTime } from './utils.js';
// Removed renderGrid import to fix circular dependency

const Hls = window.Hls; // Replicate global Hls access
let hlsApi = null;

export function playChannel(obj) {
    // 1. RE-HYDRATION FIX
    let freshCh = state.channels.find(c => c.u === obj.u) || state.channels.find(c => c.n === obj.n);
    if (freshCh) obj = freshCh;

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

    if (Hls && Hls.isSupported()) {
        if (hlsApi) hlsApi.destroy();
        hlsApi = new Hls(); hlsApi.loadSource(obj.u); hlsApi.attachMedia(v); v.play();
    } else { v.src = obj.u; v.play(); }

    // UPDATE UI ICONS
    updateMuteIcon();
    updatePlayIcon(false); // We are playing, so show Pause icon
    handlePlayerMouse();
    updateProgressBar();
}

export function updateProgressBar() {
    const nowTs = new Date().getTime();
    let pct = 0;

    if (state.sel && state.sel.start && state.sel.stop) {
        const totalDur = state.sel.stop - state.sel.start;
        const elapsed = nowTs - state.sel.start;
        pct = (elapsed / totalDur) * 100;
        if (pct < 0) pct = 0; if (pct > 100) pct = 100;
    } else if (state.sel) {
        pct = 100;
    }

    const pBar = document.getElementById('progress-bar');
    if (pBar) pBar.style.width = pct + "%";

    // Grid update logic moved to epg.js/main.js to avoid circular dependency
}

export function handlePlayerMouse() {
    const pip = document.getElementById('pip-box');
    if (!pip.classList.contains('expanded')) return;
    pip.classList.add('ui-active');
    clearTimeout(state.uiTimer);
    state.uiTimer = setTimeout(() => pip.classList.remove('ui-active'), 3000);
}

export function minimizePlayer(e) {
    if (e && e.stopPropagation) e.stopPropagation();
    const pip = document.getElementById('pip-box');
    const inChannels = document.getElementById('channels-view').style.display === 'flex';
    if (inChannels) {
        pip.style.display = 'none'; pip.classList.remove('expanded');
        const v = document.getElementById('vid'); v.pause(); v.src = "";
    } else { pip.classList.remove('expanded', 'ui-active'); }
}

export function goFull() {
    const pip = document.getElementById('pip-box');
    if (!pip.classList.contains('expanded')) {
        pip.classList.add('expanded');
        if (state.sel) {
            document.getElementById('fs-logo').src = state.sel.l || '';
            document.getElementById('fs-ch-name').innerText = state.sel.t || state.sel.chN || '';
        }
        handlePlayerMouse();
    }
}

export function togglePlay(e) {
    if (e) e.stopPropagation();
    const v = document.getElementById('vid');

    if (v.paused) {
        v.play();
        updatePlayIcon(false); // Playing = Show Pause
    } else {
        v.pause();
        updatePlayIcon(true); // Paused = Show Play
    }
}

export function updatePlayIcon(isPaused) {
    const icon = document.getElementById('play-icon');
    const path = icon.querySelector('path');
    path.setAttribute('d', isPaused ? ICON_PLAY : ICON_PAUSE);
}

export function toggleMute(e) {
    if (e) e.stopPropagation();
    const v = document.getElementById('vid');
    v.muted = !v.muted;
    updateMuteIcon();
}

export function updateMuteIcon() {
    const v = document.getElementById('vid');
    const icon = document.getElementById('mute-icon');
    const path = icon.querySelector('path');
    path.setAttribute('d', v.muted ? ICON_VOL_OFF : ICON_VOL_UP);
}

export function switchChannel(dir) {
    const currentIdx = state.channels.findIndex(ch => ch.u === state.activeCh.u);
    if (currentIdx === -1) return;

    let newIdx = dir === 'next' ? (currentIdx + 1) : (currentIdx - 1 + state.channels.length);
    newIdx %= state.channels.length;
    playChannel(state.channels[newIdx]);
}
