const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
const drivelist = require('drivelist');
const XLSX = require('xlsx');
const heicConvert = require('heic-convert');

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
    '.mp4', '.webm', '.ogg', '.mkv', '.avi', 
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.heic',
    '.pdf', '.docx', '.txt', '.xlsx'
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
    const result = await mammoth.convertToHtml(
      { buffer },
      {
        includeDefaultStyleMap: true,
        styleMap: [
          "u => u",
          "strike => s",
          "comment-reference => sup",
          "b => strong",
          "i => em"
        ],
        includeEmbeddedStyleMap: true,
        convertImage: mammoth.images.imgElement(image =>
          image.read("base64").then(data => ({
            src: `data:${image.contentType};base64,${data}`
          }))
        )
      }
    );
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

ipcMain.handle('convert-xlsx', async (_, filePath) => {
  try {
    const workbook = XLSX.readFile(filePath);
    const html = workbook.SheetNames.map(name => {
      const sheet = workbook.Sheets[name];
      const table = XLSX.utils.sheet_to_html(sheet);
      return `<h3>${name}</h3>${table}`;
    }).join('');
    return { success: true, html };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('convert-heic', async (_, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    const output = await heicConvert({ buffer, format: 'JPEG', quality: 0.9 });
    const base64 = Buffer.from(output).toString('base64');
    return { success: true, data: `data:image/jpeg;base64,${base64}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
