import { state } from './state.js';
import { applyTheme, renderSwatches, view, doAct } from './ui.js';
import { checkPlaylists, addPlaylist, renderSaved, load } from './playlist.js';
import { updateProgressBar, switchChannel, goFull, handlePlayerMouse, togglePlay, toggleMute, minimizePlayer, playChannel } from './player.js';
import { toggleFavorite, checkGridReflow } from './epg.js';
import { exportData, importData } from './settings.js';

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
    document.getElementById('modal-watch').onclick = () => doAct('watch', playChannel);
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

    const gridCont = document.getElementById('gridCont');
    if (gridCont) {
        gridCont.onscroll = (e) => {
            document.getElementById('timer').scrollLeft = e.target.scrollLeft;
        };
    }

    document.addEventListener('keydown', (e) => {
        const pip = document.getElementById('pip-box');
        if (pip.classList.contains('expanded') && state.sel) {
            if (e.key === 'ArrowDown') switchChannel('next');
            if (e.key === 'ArrowUp') switchChannel('prev');
        }
    });

    setInterval(() => {
        updateProgressBar();
        checkGridReflow();
    }, 1000);
}

function ribbonAction(act) {
    if (act === 'info' && state.sel) alert(`${state.sel.t}\n${state.sel.chN}\n\n${state.sel.d}`);
    if (act === 'refresh' && state.playlists[0]) load(state.playlists[0].m, state.playlists[0].x);
    if (act === 'fav' && state.activeCh) toggleFavorite(state.activeCh);
}
