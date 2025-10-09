const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const mammoth = require('mammoth');
  const { exec } = require('child_process');

  function listUsbDrivesWindows() {
    return new Promise((resolve) => {
      const cmd = `powershell -Command "Get-Volume | Where-Object {$_.DriveType -eq 'Removable'} | Select-Object -ExpandProperty DriveLetter"`;

      exec(cmd, (err, stdout, stderr) => {
        if (err) return resolve([]); // fallback to empty
        const letters = stdout
          .split(/\r?\n/)
          .map(l => l.trim())
          .filter(l => l);
        const drives = letters.map(l => `${l}:\\`);
        resolve(drives);
      });
    });
  }

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    fullscreen: true,          // start in fullscreen
    autoHideMenuBar: true,     // hide menu bar
    frame: false,              // removes OS title bar completely
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    console.log("Blocked attempt to open:", url);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    // Only allow local files
    if (!url.startsWith('file://')) {
      event.preventDefault();
    }
  });


  win.loadFile('index.html');
}

app.whenReady().then(() => {
  createWindow();
  listUsbDrivesWindows();
});


ipcMain.handle('list-usb-drives', async () => {
  const drives = await listUsbDrivesWindows();
  return drives;
});

ipcMain.handle('read-directory', async (event, folderPath) => {
  try {
    return fs.readdirSync(folderPath);
  } catch (err) {
    return [];
  }
});


// DOCX conversion
ipcMain.handle('convert-docx', async (event, filePath) => {
  try {
    const buffer = fs.readFileSync(filePath);
    const result = await mammoth.convertToHtml({ buffer });
    return { success: true, html: result.value };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// TXT reading
ipcMain.handle("read-text", async (event, filePath) => {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return { success: true, text: content };
  } catch (err) {
    return { success: false, error: err.message };
  }
});
