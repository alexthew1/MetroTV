const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        backgroundColor: '#000000',
        show: false, // FIX 1: Don't show window immediately (prevents white flash/buffering look)
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadFile('index.html');

    // FIX 1 (Continued): Show window only when content is ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
}

app.whenReady().then(() => {
    createWindow();

    // FIX 2: Re-create window on macOS when dock icon is clicked
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });

    // IPC: Handle File Saving (Backup)
    ipcMain.handle('dialog:saveConfig', async (event, content) => {
        const { filePath } = await dialog.showSaveDialog({
            title: 'Backup MetroTV Config',
            defaultPath: 'metrotv_backup.json',
            filters: [{ name: 'JSON', extensions: ['json'] }]
        });

        if (filePath) {
            fs.writeFileSync(filePath, content);
            return true;
        }
        return false;
    });

    // IPC: Handle File Loading (Restore)
    ipcMain.handle('dialog:openConfig', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            title: 'Restore MetroTV Config',
            filters: [{ name: 'JSON', extensions: ['json'] }],
            properties: ['openFile']
        });

        if (!canceled && filePaths.length > 0) {
            return fs.readFileSync(filePaths[0], 'utf8');
        }
        return null;
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});