
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function createWindow() {
  const win = new BrowserWindow({
    width: 450,
    height: 850,
    title: "FinTrack AI",
    backgroundColor: '#f8fafc',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.setMenuBarVisibility(false);
  win.loadFile('index.html');
}

// Determina o caminho base: pasta do EXE ou pasta atual em dev
const getBasePath = () => {
  return app.isPackaged ? path.dirname(app.getPath('exe')) : process.cwd();
};

ipcMain.handle('read-json', async (event, fileName) => {
  const filePath = path.join(getBasePath(), fileName);
  if (!fs.existsSync(filePath)) return [];
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error("Erro ao ler:", error);
    return [];
  }
});

ipcMain.handle('write-json', async (event, fileName, data) => {
  const filePath = path.join(getBasePath(), fileName);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }]
  });
  if (result.canceled) return null;
  try {
    const content = fs.readFileSync(result.filePaths[0], 'utf8');
    return JSON.parse(content);
  } catch (e) {
    return null;
  }
});

app.whenReady().then(createWindow);
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());
