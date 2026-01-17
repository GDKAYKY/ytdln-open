const { describe, it, expect, beforeAll } = require('@jest/globals');
const VideoDownloader = require('../src/video-downloader.js');
const path = require('node:path');

const { getDefaultYtdlpConfig } = require('./fixtures/ytdlp-config.js');



describe('Test Arguments Only', () => {
  let downloader;

  beforeAll(() => {
    downloader = new VideoDownloader();
    downloader.binaries = {
      ytdlp: 'yt-dlp.exe',
      ffmpeg: 'ffmpeg.exe',
    };
  });

  const videoUrl = 'https://youtu.be/taP0wP-mHZ4';
  const ytdlpArgs = getDefaultYtdlpConfig();

  it('should build download arguments', () => {
    const downloadArgs = downloader.buildYtdlpArgs(ytdlpArgs, videoUrl, {
      useStdout: false,
    });
    expect(Array.isArray(downloadArgs)).toBe(true);
    expect(downloadArgs.length).toBeGreaterThan(0);
  });

  it('should build streaming arguments', () => {
    const streamArgs = downloader.buildYtdlpArgs(ytdlpArgs, videoUrl, {
      useStdout: true,
    });
    expect(Array.isArray(streamArgs)).toBe(true);
    expect(streamArgs.length).toBeGreaterThan(0);
  });

  it('should have differences between download and stream args', () => {
    const downloadArgs = downloader.buildYtdlpArgs(ytdlpArgs, videoUrl, {
      useStdout: false,
    });
    const streamArgs = downloader.buildYtdlpArgs(ytdlpArgs, videoUrl, {
      useStdout: true,
    });

    const downloadSet = new Set(downloadArgs);
    const streamSet = new Set(streamArgs);

    const onlyInDownload = [...downloadSet].filter(x => !streamSet.has(x));
    const onlyInStream = [...streamSet].filter(x => !downloadSet.has(x));

    const totalDifferences = onlyInDownload.length + onlyInStream.length;
    expect(totalDifferences).toBeGreaterThan(0);
  });
});



