const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 720,
        backgroundColor: '#000000',
        // 'frame: true' is default, so we use the native OS title bar
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false
        }
    });

    // Hide the standard "File, Edit, View" menu bar
    mainWindow.setMenuBarVisibility(false);
    mainWindow.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();

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