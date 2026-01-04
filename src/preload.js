const { contextBridge, ipcRenderer } = require("electron");

const ALLOWED_IPC_CHANNELS = new Set([
  "download-video",
  "download-video-with-settings",
  "check-binaries-status",
  "download-progress",
  "download-success",
  "download-error",
  "binaries-status",
  "open-downloads-folder",
  "get-downloaded-files",
  "delete-downloaded-file",
  "open-file-location",
  "open-video-file",
  "downloaded-files-list",
  "file-deleted",
  "select-folder",
  "folder-selected",
  "open-specific-folder",
  "move-temp-files-to-downloads",
  "clean-temp-files",
]);

const validateChannel = (ch) => {
  if (!ALLOWED_IPC_CHANNELS.has(ch))
    throw new Error(`Canal IPC não permitido: ${ch}`);
};

const send = (channel, ...args) => {
  validateChannel(channel);
  ipcRenderer.send(channel, ...args);
};

const on = (channel, callback) => {
  validateChannel(channel);
  const handler = (_, data) => callback(data);
  ipcRenderer.on(channel, handler);
  return () => ipcRenderer.removeListener(channel, handler);
};

// Métodos específicos
const methods = {
  downloadVideo: (...args) => send("download-video", ...args),
  downloadVideoWithSettings: (...args) =>
    send("download-video-with-settings", ...args),
  checkBinariesStatus: () => send("check-binaries-status"),
  openDownloadsFolder: () => send("open-downloads-folder"),
  getDownloadedFiles: (...args) => send("get-downloaded-files", ...args),
  deleteDownloadedFile: (...args) => send("delete-downloaded-file", ...args),
  openFileLocation: (...args) => send("open-file-location", ...args),
  openVideoFile: (...args) => send("open-video-file", ...args),
  selectFolder: (...args) => send("select-folder", ...args),
  openSpecificFolder: (...args) => send("open-specific-folder", ...args),
  moveTempFilesToDownloads: () => send("move-temp-files-to-downloads"),
  cleanTempFiles: () => send("clean-temp-files"),
};

// Listeners
const listeners = {
  onDownloadProgress: (cb) => on("download-progress", cb),
  onDownloadSuccess: (cb) => on("download-success", cb),
  onDownloadError: (cb) => on("download-error", cb),
  onBinariesStatus: (cb) => on("binaries-status", cb),
  onDownloadedFilesList: (cb) => on("downloaded-files-list", cb),
  onFileDeleted: (cb) => on("file-deleted", cb),
  onFolderSelected: (cb) => on("folder-selected", cb),
};

contextBridge.exposeInMainWorld("electronAPI", {
  send,
  on,
  ...methods,
  ...listeners,
});
