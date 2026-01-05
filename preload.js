const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('metroAPI', {
    saveConfig: (data) => ipcRenderer.invoke('dialog:saveConfig', data),
    loadConfig: () => ipcRenderer.invoke('dialog:openConfig')
});