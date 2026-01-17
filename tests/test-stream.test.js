const { describe, it, expect, beforeAll } = require('@jest/globals');
const VideoDownloader = require('../src/video-downloader.js');
const path = require('node:path');

const { getDefaultYtdlpConfig } = require('./fixtures/ytdlp-config.js');



describe('Test Stream Download', () => {
  let downloader;
  const ytdlpArgs = getDefaultYtdlpConfig();
  const videoUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw'; // Me at the Zoo

  beforeAll(() => {
    downloader = new VideoDownloader();
    const ytdlpPath = path.resolve(__dirname, '..', 'bin', 'yt-dlp.exe');
    const ffmpegPath = path.resolve(__dirname, '..', 'bin', 'ffmpeg.exe');

    downloader.binaries = {
      ytdlp: ytdlpPath,
      ffmpeg: ffmpegPath,
    };
  });

  it('should have binaries configured', () => {
    expect(downloader.binaries.ytdlp).toBeDefined();
    expect(downloader.binaries.ffmpeg).toBeDefined();
  });

  it('should build streaming arguments', () => {
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

  it('should have valid settings', () => {
    expect(ytdlpArgs.outputFormat).toBe('mp4');
    expect(ytdlpArgs.quality).toBe('best');
    expect(ytdlpArgs.concurrentFragments).toBe(8);
  });
});



