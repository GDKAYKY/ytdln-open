const { contextBridge, ipcRenderer } = require('electron');

const ALLOWED_IPC_CHANNELS = new Set([
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
  'open-video-file',
  'downloaded-files-list',
  'file-deleted'
]);

// Função para validar canal IPC
function validateIpcChannel(channel) {
  if (!ALLOWED_IPC_CHANNELS.has(channel)) {
    throw new Error(`Canal IPC não permitido: ${channel}`);
  }
}

// Helper functions para IPC
const makeSender = (channel) => (...args) => ipcRenderer.send(channel, ...args);
const makeListener = (channel) => (callback) => {
  const newCB = (_, data) => callback(data);
  ipcRenderer.on(channel, newCB);
  return () => ipcRenderer.removeListener(channel, newCB);
};

contextBridge.exposeInMainWorld('electronAPI', {
  // Generic methods (continuam úteis para flexibilidade, mantendo validação)
  send: (channel, data) => {
    validateIpcChannel(channel);
    ipcRenderer.send(channel, data);
  },
  on: (channel, callback) => {
    validateIpcChannel(channel);
    const newCallback = (_, data) => callback(data);
    ipcRenderer.on(channel, newCallback);
    return () => ipcRenderer.removeListener(channel, newCallback);
  },

  // Métodos específicos usando os helpers
  downloadVideo: makeSender('download-video'),
  downloadVideoWithSettings: makeSender('download-video-with-settings'),
  checkBinariesStatus: makeSender('check-binaries-status'),
  openDownloadsFolder: makeSender('open-downloads-folder'),
  getDownloadedFiles: makeSender('get-downloaded-files'),
  deleteDownloadedFile: makeSender('delete-downloaded-file'),
  openFileLocation: makeSender('open-file-location'),
  openVideoFile: makeSender('open-video-file'),

  // Listeners específicos usando os helpers
  onDownloadProgress: makeListener('download-progress'),
  onDownloadSuccess: makeListener('download-success'),
  onDownloadError: makeListener('download-error'),
  onBinariesStatus: makeListener('binaries-status'),
  onDownloadedFilesList: makeListener('downloaded-files-list'),
  onFileDeleted: makeListener('file-deleted')
});