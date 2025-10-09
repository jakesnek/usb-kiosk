const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  listUsbDrives: () => ipcRenderer.invoke("list-usb-drives"),
  readDirectory: (folderPath) => ipcRenderer.invoke("read-directory", folderPath),
  convertDocx: (filePath) => ipcRenderer.invoke("convert-docx", filePath),
  readText: (filePath) => ipcRenderer.invoke("read-text", filePath)
});
