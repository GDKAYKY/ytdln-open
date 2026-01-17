const { describe, it, expect, beforeAll } = require('@jest/globals');
const VideoDownloader = require('../src/video-downloader.js');
const path = require('node:path');

const { getDefaultYtdlpConfig } = require('./fixtures/ytdlp-config.js');



describe('Test Me at Zoo', () => {
  let downloader;

  beforeAll(() => {
    downloader = new VideoDownloader();
    downloader.binaries = {
      ytdlp: path.resolve(__dirname, '..', 'bin', 'yt-dlp.exe'),
      ffmpeg: path.resolve(__dirname, '..', 'bin', 'ffmpeg.exe'),
    };
  });

  const videoUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';
  const ytdlpArgs = getDefaultYtdlpConfig();

  it('should have downloader initialized', () => {
    expect(downloader).toBeDefined();
  });

  it('should have binaries configured', () => {
    expect(downloader.binaries.ytdlp).toBeDefined();
    expect(downloader.binaries.ffmpeg).toBeDefined();
  });

  it('should have valid settings', () => {
    expect(ytdlpArgs.outputFormat).toBe('mp4');
    expect(ytdlpArgs.quality).toBe('best');
    expect(ytdlpArgs.writeThumbnail).toBe(true);
  });

  it('should build download arguments', () => {
    const args = downloader.buildYtdlpArgs(ytdlpArgs, videoUrl, {
      useStdout: false,
    });

    expect(Array.isArray(args)).toBe(true);
    expect(args.length).toBeGreaterThan(0);
  });
});



