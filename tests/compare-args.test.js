const { describe, it, expect, beforeAll } = require('@jest/globals');
const VideoDownloader = require('../src/video-downloader.js');
const path = require('node:path');

const { getDefaultYtdlpConfig } = require('./fixtures/ytdlp-config.js');



describe('Compare Arguments', () => {
  let downloader;

  beforeAll(() => {
    downloader = new VideoDownloader();
    downloader.binaries = {
      ytdlp: path.resolve(__dirname, '..', 'bin', 'yt-dlp.exe'),
      ffmpeg: path.resolve(__dirname, '..', 'bin', 'ffmpeg.exe'),
    };
  });

  const ytdlpArgs = getDefaultYtdlpConfig();
  const url = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

  it('should build desktop download arguments', () => {
    const desktopArgs = downloader.buildYtdlpArgs(ytdlpArgs, url, { useStdout: false });
    expect(Array.isArray(desktopArgs)).toBe(true);
    expect(desktopArgs.length).toBeGreaterThan(0);
  });

  it('should build streaming arguments', () => {
    const streamArgs = downloader.buildYtdlpArgs(ytdlpArgs, url, { useStdout: true });
    expect(Array.isArray(streamArgs)).toBe(true);
    expect(streamArgs.length).toBeGreaterThan(0);
  });

  it('should have different arguments for desktop vs streaming', () => {
    const desktopArgs = downloader.buildYtdlpArgs(ytdlpArgs, url, { useStdout: false });
    const streamArgs = downloader.buildYtdlpArgs(ytdlpArgs, url, { useStdout: true });
    
    const desktopSet = new Set(desktopArgs);
    const streamSet = new Set(streamArgs);
    
    const differences = [...desktopSet].filter(x => !streamSet.has(x)).length +
                       [...streamSet].filter(x => !desktopSet.has(x)).length;
    
    expect(differences).toBeGreaterThan(0);
  });
});



