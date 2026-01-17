const { describe, it, expect, beforeAll } = require('@jest/globals');
const VideoDownloader = require('../src/video-downloader.js');
const { getDefaultYtdlpConfig } = require('./fixtures/ytdlp-config.js');

describe('Test Command', () => {
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

  it('should build valid streaming command', () => {
    const streamArgs = downloader.buildYtdlpArgs(ytdlpArgs, videoUrl, {
      useStdout: true,
    });

    expect(Array.isArray(streamArgs)).toBe(true);
    expect(streamArgs.length).toBeGreaterThan(0);
    expect(streamArgs).toContain('-o');
    expect(streamArgs).toContain('-');
  });

  it('should have output format argument', () => {
    const streamArgs = downloader.buildYtdlpArgs(ytdlpArgs, videoUrl, {
      useStdout: true,
    });

    const hasFormat = streamArgs.includes('--merge-output-format') ||
                     streamArgs.includes('-f');
    expect(hasFormat).toBe(true);
  });

  it('should have concurrent fragments argument', () => {
    const streamArgs = downloader.buildYtdlpArgs(ytdlpArgs, videoUrl, {
      useStdout: true,
    });

    const hasFragments = streamArgs.includes('--concurrent-fragments');
    expect(hasFragments).toBe(true);
  });
});



