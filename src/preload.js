const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED_IPC_CHANNELS = [
  'download-video',
  'download-video-with-settings',
  'check-binaries-status',
  'download-progress',
  'download-success',
  'download-error',
  'binaries-status',
  'open-downloads-folder',
  'get-downloaded-files',
  'delete-downloaded-file',
  'open-file-location',
  'downloaded-files-list',
  'file-deleted'
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
  downloadVideoWithSettings: (url, settings) => ipcRenderer.send('download-video-with-settings', url, settings),
  checkBinariesStatus: () => ipcRenderer.send('check-binaries-status'),
  openDownloadsFolder: () => ipcRenderer.send('open-downloads-folder'),
  getDownloadedFiles: () => ipcRenderer.send('get-downloaded-files'),
  deleteDownloadedFile: (fileId) => ipcRenderer.send('delete-downloaded-file', fileId),
  openFileLocation: (fileId) => ipcRenderer.send('open-file-location', fileId),
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
  },
  onDownloadedFilesList: (callback) => {
    const newCallback = (_, data) => callback(data);
    ipcRenderer.on('downloaded-files-list', newCallback);
    return () => ipcRenderer.removeListener('downloaded-files-list', newCallback);
  },
  onFileDeleted: (callback) => {
    const newCallback = (_, data) => callback(data);
    ipcRenderer.on('file-deleted', newCallback);
    return () => ipcRenderer.removeListener('file-deleted', newCallback);
  }
});