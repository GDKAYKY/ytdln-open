const { describe, it, expect, beforeAll } = require('@jest/globals');
const VideoDownloader = require('../src/video-downloader.js');
const path = require('node:path');

const { getDefaultYtdlpConfig } = require('./fixtures/ytdlp-config.js');



describe('Test Me at Zoo Simple', () => {
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
    expect(downloader.binaries).toBeDefined();
  });

  it('should have valid binaries paths', () => {
    expect(downloader.binaries.ytdlp).toBeDefined();
    expect(downloader.binaries.ffmpeg).toBeDefined();
  });

  it('should build valid download arguments', () => {
    const args = downloader.buildYtdlpArgs(ytdlpArgs, videoUrl, {
      useStdout: false,
    });

    expect(Array.isArray(args)).toBe(true);
    expect(args.length).toBeGreaterThan(0);
  });

  it('should have quality settings in arguments', () => {
    const args = downloader.buildYtdlpArgs(ytdlpArgs, videoUrl, {
      useStdout: false,
    });

    const hasQuality = args.some(arg => arg.includes('best') || arg.includes('format'));
    expect(hasQuality).toBe(true);
  });

  it('should have thumbnail setting enabled', () => {
    expect(ytdlpArgs.writeThumbnail).toBe(true);
  });

  it('should have mp4 output format', () => {
    expect(ytdlpArgs.outputFormat).toBe('mp4');
  });
});



