export const state = {
    channels: [], epg: {},
    favorites: JSON.parse(localStorage.getItem('met_favs') || '[]'),
    playlists: JSON.parse(localStorage.getItem('met_v34') || '[]'),
    activeIdx: parseInt(localStorage.getItem('met_act_idx_v34') || '0'),
    accent: localStorage.getItem('met_ac_v34') || '#00aba9',
    epgShift: 0,
    sel: null, activeCh: null, lastBaseTime: 0,
    uiTimer: null // Added explicit init for clarity, it was implicit in handlePlayerMouse
};

export function setState(key, value) {
    state[key] = value;
}

// Global hlsApi reference if needed common, but might be better in player.js
// We'll keep it here if it's shared or move it to player module scope.
// For now let's keep it in player module scope as a module variable.
