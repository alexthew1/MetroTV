export function getBaseTime() {
    const now = new Date();
    now.setMinutes(now.getMinutes() >= 30 ? 30 : 0);
    now.setSeconds(0); now.setMilliseconds(0);
    return now.getTime();
}

export function parseEPGDate(tStr) {
    if (!tStr || tStr.length < 12) return null;
    const y = parseInt(tStr.substring(0, 4));
    const m = parseInt(tStr.substring(4, 6)) - 1;
    const d = parseInt(tStr.substring(6, 8));
    const h = parseInt(tStr.substring(8, 10));
    const min = parseInt(tStr.substring(10, 12));
    return new Date(y, m, d, h, min).getTime();
}

export function showLoading(show) {
    const el = document.getElementById('loading-overlay');
    const bar = document.getElementById('load-progress');
    if (show) { el.style.display = 'flex'; setTimeout(() => bar.style.width = '70%', 50); }
    else { bar.style.width = '100%'; setTimeout(() => { el.style.display = 'none'; bar.style.width = '0%'; }, 500); }
}
