const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url'); // NEW: Handles Mac/Linux/Windows paths automatically

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        backgroundColor: '#0b0b0b',
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            webSecurity: false // Required to load local video files
        }
    });

    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadFile('index.html');
}

// Recursive function to find video/audio files
function scanDir(dir, extensions) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    
    try {
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const fullPath = path.join(dir, file);
            try {
                const stat = fs.statSync(fullPath);
                if (stat && stat.isDirectory()) {
                    // Recursively scan subfolders
                    results = results.concat(scanDir(fullPath, extensions));
                } else {
                    const ext = path.extname(fullPath).toLowerCase();
                    if (extensions.includes(ext)) {
                        results.push({
                            n: path.basename(file, ext),
                            // FIX: pathToFileURL handles '/Users/name' (Mac) vs 'C:\Users' (Win) automatically
                            u: pathToFileURL(fullPath).href,
                            path: fullPath
                        });
                    }
                }
            } catch(err) { 
                // Skip files we don't have permission to read
            }
        });
    } catch (e) { console.error("Error reading directory:", e); }
    return results;
}

app.whenReady().then(() => {
    createWindow();

    // 1. SELECT FOLDER
    ipcMain.handle('dialog:selectFolder', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory']
        });
        if (canceled) return null;
        return filePaths[0];
    });

    // 2. SCAN FOLDER
    ipcMain.handle('scan:media', async (event, folderPath, type) => {
        if(!folderPath) return [];
        let exts = [];
        // Common video formats
        if(type === 'video') exts = ['.mp4', '.mkv', '.webm', '.avi', '.mov', '.m4v', '.mpg'];
        // Common audio formats
        if(type === 'audio') exts = ['.mp3', '.flac', '.wav', '.ogg', '.m4a', '.aac'];
        
        return scanDir(folderPath, exts);
    });

    // 3. BACKUP CONFIG
    ipcMain.handle('dialog:saveConfig', async (event, content) => {
        const { filePath } = await dialog.showSaveDialog(mainWindow, {
            title: 'Backup MetroTV Config',
            defaultPath: 'metrotv_backup.json',
            filters: [{ name: 'JSON', extensions: ['json'] }]
        });
        if (filePath) { fs.writeFileSync(filePath, content); return true; }
        return false;
    });

    // 4. RESTORE CONFIG
    ipcMain.handle('dialog:openConfig', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
            title: 'Restore MetroTV Config',
            filters: [{ name: 'JSON', extensions: ['json'] }],
            properties: ['openFile']
        });
        if (!canceled && filePaths.length > 0) return fs.readFileSync(filePaths[0], 'utf8');
        return null;
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});