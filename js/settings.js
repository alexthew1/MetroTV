import { state, setState } from './state.js';
import { renderSaved, checkPlaylists } from './playlist.js'; // Circular ref potentially?
import { view } from './ui.js';

export function saveState() {
    localStorage.setItem('met_v34', JSON.stringify(state.playlists));
    localStorage.setItem('met_act_idx_v34', state.activeIdx);
}

export async function exportData() {
    const dataStr = JSON.stringify(state, null, 2);
    // Assuming window.metroAPI is injected by preload.js
    if (window.metroAPI) {
        const success = await window.metroAPI.saveConfig(dataStr);
        if (success) alert("Config Backed Up Successfully!");
    } else {
        console.error("MetroAPI not available");
        alert("API Error: Cannot save config");
    }
}

export async function importData() {
    if (!window.metroAPI) return;
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
        } catch (err) { alert("Invalid Config File"); }
    }
}
