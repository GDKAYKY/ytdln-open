const { contextBridge, ipcRenderer } = require('electron');

// Whitelist de canais IPC permitidos (mesma lista do main.js)
const ALLOWED_IPC_CHANNELS = [
  'download-video',
  'check-binaries-status',
  'download-progress',
  'download-success',
  'download-error',
  'binaries-status'
];

// Função para validar canal IPC
function validateIpcChannel(channel) {
  if (!ALLOWED_IPC_CHANNELS.includes(channel)) {
    throw new Error(`Canal IPC não permitido: ${channel}`);
  }
}

contextBridge.exposeInMainWorld('electronAPI', {
  // One-way from renderer to main
  send: (channel, data) => {
    validateIpcChannel(channel);
    ipcRenderer.send(channel, data);
  },
  // One-way from main to renderer
  on: (channel, callback) => {
    validateIpcChannel(channel);
    const newCallback = (_, data) => callback(data);
    ipcRenderer.on(channel, newCallback);
    // Return a function to remove the listener
    return () => ipcRenderer.removeListener(channel, newCallback);
  },
  // Métodos específicos para facilitar o uso
  downloadVideo: (url) => ipcRenderer.send('download-video', url),
  checkBinariesStatus: () => ipcRenderer.send('check-binaries-status'),
  onDownloadProgress: (callback) => {
    const newCallback = (_, data) => callback(data);
    ipcRenderer.on('download-progress', newCallback);
    return () => ipcRenderer.removeListener('download-progress', newCallback);
  },
  onDownloadSuccess: (callback) => {
    const newCallback = (_, data) => callback(data);
    ipcRenderer.on('download-success', newCallback);
    return () => ipcRenderer.removeListener('download-success', newCallback);
  },
  onDownloadError: (callback) => {
    const newCallback = (_, data) => callback(data);
    ipcRenderer.on('download-error', newCallback);
    return () => ipcRenderer.removeListener('download-error', newCallback);
  },
  onBinariesStatus: (callback) => {
    const newCallback = (_, data) => callback(data);
    ipcRenderer.on('binaries-status', newCallback);
    return () => ipcRenderer.removeListener('binaries-status', newCallback);
  }
});
