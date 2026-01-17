// Mock do Electron para testes
jest.mock('electron', () => ({
  app: {
    getPath: (name) => {
      if (name === 'downloads') {
        return './downloads';
      }
      if (name === 'userData') {
        return './userData';
      }
      return './';
    },
  },
}), { virtual: true });

// Mock BinaryDownloader to prevent actual downloads during tests
jest.mock('../src/bin-downloader.js', () => {
  return class BinaryDownloader {
    async ensureAll() {
      // Return mock paths without actually downloading
      const path = require('node:path');
      const BIN_DIR = path.join(__dirname, '..', 'bin');
      return {
        ytdlp: path.join(BIN_DIR, 'yt-dlp.exe'),
        ffmpeg: path.join(BIN_DIR, 'ffmpeg.exe'),
        ffprobe: path.join(BIN_DIR, 'ffprobe.exe'),
        ffplay: path.join(BIN_DIR, 'ffplay.exe'),
      };
    }
  };
}, { virtual: true });


