const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const drivelist = require('drivelist');

let mainWindow = null;
let previousDrives = [];

async function listUsbDrives() {
  try {
    const drives = await drivelist.list();
    const removable = drives.filter(d => d.isRemovable && d.mountpoints.length > 0);
    return removable.map(d => d.mountpoints[0].path);
  } catch (err) {
    console.error('Error listing USB drives:', err);
    return [];
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    fullscreen: true,
    autoHideMenuBar: true,
    frame: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    console.log("Blocked attempt to open:", url);
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('file://')) event.preventDefault();
  });

  mainWindow.loadFile('index.html');
}

async function startUsbWatcher() {
  previousDrives = await listUsbDrives();

  setInterval(async () => {
    const current = await listUsbDrives();
    const added = current.filter(d => !previousDrives.includes(d));
    const removed = previousDrives.filter(d => !current.includes(d));

    if (added.length || removed.length) {
      mainWindow?.webContents.send('usb-update', {
        drives: current,
        added,
        removed
      });
      previousDrives = current;
    }
  }, 3000);
}

app.whenReady().then(() => {
  createWindow();
  startUsbWatcher();
});

ipcMain.handle('list-usb-drives', listUsbDrives);

ipcMain.handle('read-directory', async (_, folderPath) => {
  const allowedExtensions = [
    '.mp4', '.webm', '.ogg', '.mkv', '.avi', // videos
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', // images
    '.pdf', '.docx', '.txt' // documents
  ];

  function getAllFiles(dirPath, arrayOfFiles = []) {
    let entries;
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return arrayOfFiles;
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      // Skip system or hidden folders
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && !entry.name.startsWith('System')) {
          getAllFiles(fullPath, arrayOfFiles);
        }
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (allowedExtensions.includes(ext)) {
          arrayOfFiles.push(fullPath);
        }
      }
    }

    return arrayOfFiles;
  }

  try {
    return getAllFiles(folderPath);
  } catch {
    return [];
  }
});

ipcMain.handle('convert-docx', async (_, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.convertToHtml({ buffer });
    return { success: true, html: result.value };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('read-text', async (_, filePath) => {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return { success: true, text: content };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
