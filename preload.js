
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  readJson: (fileName) => ipcRenderer.invoke('read-json', fileName),
  writeJson: (fileName, data) => ipcRenderer.invoke('write-json', fileName, data),
  selectFile: () => ipcRenderer.invoke('select-file')
});
