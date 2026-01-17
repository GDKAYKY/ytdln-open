const { describe, it, expect, beforeAll } = require('@jest/globals');
const VideoDownloader = require('../src/video-downloader.js');
const { mergeYtdlpConfig } = require('./fixtures/ytdlp-config.js');

describe('Prove Arguments', () => {
  let downloader;

  beforeAll(() => {
    downloader = new VideoDownloader();
    downloader.binaries = { ytdlp: 'ytdlp.exe', ffmpeg: 'ffmpeg.exe' };
  });

  const ytdlpArgs = mergeYtdlpConfig({
    quality: '1080p',
    concurrentFragments: 16,
    embedSubs: true,
    userAgent: 'Agent/1.0 (Antigravity)',
  });

  const videoUrl = 'https://www.youtube.com/watch?v=example';

  describe('Desktop Download', () => {
    it('should preserve quality setting', () => {
      const diskArgs = downloader.buildYtdlpArgs(ytdlpArgs, videoUrl, {
        useStdout: false,
      });
      const hasQuality = diskArgs.includes(
        'bestvideo[height<=1080]+bestaudio/best[height<=1080]/best'
      );
      expect(hasQuality).toBe(true);
    });

    it('should preserve concurrent fragments', () => {
      const diskArgs = downloader.buildYtdlpArgs(ytdlpArgs, videoUrl, {
        useStdout: false,
      });
      const hasFragments =
        diskArgs.includes('--concurrent-fragments') && diskArgs.includes('16');
      expect(hasFragments).toBe(true);
    });

    it('should preserve user agent', () => {
      const diskArgs = downloader.buildYtdlpArgs(ytdlpArgs, videoUrl, {
        useStdout: false,
      });
      const hasUA =
        diskArgs.includes('--user-agent') &&
        diskArgs.includes('Agent/1.0 (Antigravity)');
      expect(hasUA).toBe(true);
    });
  });

  describe('Streaming Mode', () => {
    it('should have quality with MP4 filter', () => {
      const streamArgs = downloader.buildYtdlpArgs(ytdlpArgs, videoUrl, {
        useStdout: true,
      });
      const hasStreamQuality = streamArgs.includes(
        'best[height<=1080][ext=mp4]/bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080]'
      );
      expect(hasStreamQuality).toBe(true);
    });

    it('should use stdout output', () => {
      const streamArgs = downloader.buildYtdlpArgs(ytdlpArgs, videoUrl, {
        useStdout: true,
      });
      const hasStdout =
        streamArgs.includes('-o') &&
        streamArgs[streamArgs.indexOf('-o') + 1] === '-';
      expect(hasStdout).toBe(true);
    });

    it('should preserve concurrent fragments in stream', () => {
      const streamArgs = downloader.buildYtdlpArgs(ytdlpArgs, videoUrl, {
        useStdout: true,
      });
      expect(streamArgs.includes('16')).toBe(true);
    });
  });
});



