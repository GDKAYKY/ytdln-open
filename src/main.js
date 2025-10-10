const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');

// Helper function to get the path to the extra resources,
// works for both development and packaged apps.
function getExtraResourcesPath() {
  // For packaged app, the binaries are in resources/bin
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'bin');
  }
  // For development, we'll look in a 'bin' folder in the project root
  return path.join(__dirname, '..', 'bin');
}

function createWindow () {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // It's crucial to not enable nodeIntegration and to use a preload script.
      nodeIntegration: false,
      contextIsolation: true,
    }
  });

  mainWindow.loadFile('src/index.html');

  // Open the DevTools.
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});

// Listen for a 'download-video' message from the renderer process
ipcMain.on('download-video', (event, videoUrl) => {
  const resourcesPath = getExtraResourcesPath();
  // Construct paths assuming extraction from zips. These may need adjustment
  // based on the actual folder structure inside the zips.
  const ytdlpPath = path.join(resourcesPath, 'yt-dlp.exe');
  const aria2cPath = path.join(resourcesPath, 'aria2-1.37.0-win-64bit-build1', 'aria2c.exe');
  const ffmpegPath = path.join(resourcesPath, 'ffmpeg', 'bin', 'ffmpeg.exe');

  const args = [
    '--progress',
    '--newline',
    '-o',
    path.join(app.getPath('downloads'), '%(title)s.%(ext)s'), // Save to user's Downloads folder
    '--downloader',
    aria2cPath,
    '--ffmpeg-location',
    ffmpegPath,
    videoUrl
  ];

  const ytdlpProcess = spawn(ytdlpPath, args);

  ytdlpProcess.stdout.on('data', (data) => {
    const output = data.toString();
    // Send progress updates to the renderer
    event.sender.send('download-progress', output);
  });

  ytdlpProcess.stderr.on('data', (data) => {
    // Handle errors, could also send to renderer
    console.error(`yt-dlp stderr: ${data}`);
    event.sender.send('download-error', data.toString());
  });

  ytdlpProcess.on('close', (code) => {
    if (code === 0) {
      console.log('Download completed successfully.');
      event.sender.send('download-success');
    } else {
      console.error(`yt-dlp process exited with code ${code}`);
      event.sender.send('download-error', `Process exited with code ${code}`);
    }
  });
  
  ytdlpProcess.on('error', (err) => {
    console.error('Failed to start yt-dlp process.', err);
    event.sender.send('download-error', `Failed to start process. Check if yt-dlp.exe and aria2c.exe are in the 'bin' folder. Error: ${err.message}`);
  });
});