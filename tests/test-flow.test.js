const { describe, it, expect, beforeAll } = require('@jest/globals');
const VideoDownloader = require('../src/video-downloader.js');
const path = require('node:path');

const { getDefaultYtdlpConfig } = require('./fixtures/ytdlp-config.js');



describe('Test Extension Flow', () => {
  let downloader;

  beforeAll(() => {
    downloader = new VideoDownloader();
    downloader.binaries = {
      ytdlp: path.resolve(__dirname, '..', 'bin', 'yt-dlp.exe'),
      ffmpeg: path.resolve(__dirname, '..', 'bin', 'ffmpeg.exe'),
    };
  });

  const videoUrl = 'https://youtu.be/taP0wP-mHZ4';
  const ytdlpArgs = getDefaultYtdlpConfig();

  it('should have binaries configured', () => {
    expect(downloader.binaries).toBeDefined();
    expect(downloader.binaries.ytdlp).toBeDefined();
    expect(downloader.binaries.ffmpeg).toBeDefined();
  });

  it('should build stream arguments', () => {
    const streamArgs = downloader.buildYtdlpArgs(ytdlpArgs, videoUrl, {
      useStdout: true,
    });

    expect(Array.isArray(streamArgs)).toBe(true);
    expect(streamArgs.length).toBeGreaterThan(0);
  });

  it('should have stdout output in stream args', () => {
    const streamArgs = downloader.buildYtdlpArgs(ytdlpArgs, videoUrl, {
      useStdout: true,
    });

    const outputIndex = streamArgs.indexOf('-o');
    expect(outputIndex).toBeGreaterThanOrEqual(0);
    expect(streamArgs[outputIndex + 1]).toBe('-');
  });

  it('should have mp4 format settings', () => {
    const streamArgs = downloader.buildYtdlpArgs(ytdlpArgs, videoUrl, {
      useStdout: true,
    });

    const hasFormat = streamArgs.some(arg => 
      arg.includes('mp4') || arg.includes('format')
    );
    expect(hasFormat).toBe(true);
  });
});



