const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // One-way from renderer to main
  send: (channel, data) => {
    ipcRenderer.send(channel, data);
  },
  // One-way from main to renderer
  on: (channel, callback) => {
    const newCallback = (_, data) => callback(data);
    ipcRenderer.on(channel, newCallback);
    // Return a function to remove the listener
    return () => ipcRenderer.removeListener(channel, newCallback);
  }
});
