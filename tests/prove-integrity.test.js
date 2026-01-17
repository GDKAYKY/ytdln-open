const { describe, it, expect, beforeAll } = require('@jest/globals');
const VideoDownloader = require('../src/video-downloader.js');
const { getMinimalYtdlpConfig } = require('./fixtures/ytdlp-config.js');

describe('Prove Integrity', () => {
  let downloader;

  beforeAll(async () => {
    downloader = new VideoDownloader();
    await downloader.init();
  });

  it('should initialize downloader', () => {
    expect(downloader).toBeDefined();
  });

  it('should have binaries configured', () => {
    expect(downloader.binaries).toBeDefined();
  });

  it('should build valid arguments for streaming', () => {
    const ytdlpArgs = getMinimalYtdlpConfig();
    const url = 'https://www.youtube.com/watch?v=ZzI9JE0i6Lc';
    
    const args = downloader.buildYtdlpArgs(ytdlpArgs, url, { useStdout: true });
    expect(Array.isArray(args)).toBe(true);
    expect(args.length).toBeGreaterThan(0);
  });
});



