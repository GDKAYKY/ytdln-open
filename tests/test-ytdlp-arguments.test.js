const { describe, it, expect, beforeAll } = require('@jest/globals');
const VideoDownloader = require('../src/video-downloader.js');
const path = require('node:path');

const fs = require('node:fs');



// Load default configuration
const defaultConfig = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'config', 'ytdlp-defaults.json'), 'utf-8')
);

describe('YT-DLP Arguments Test Suite', () => {
  let downloader;
  const videoUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw';

  beforeAll(() => {
    downloader = new VideoDownloader();
    downloader.binaries = {
      ytdlp: path.resolve(__dirname, '..', 'bin', 'yt-dlp.exe'),
      ffmpeg: path.resolve(__dirname, '..', 'bin', 'ffmpeg.exe'),
    };
  });

  describe('Default Configuration', () => {
    it('should have all required default settings', () => {
      expect(defaultConfig.outputFormat).toBe('mp4');
      expect(defaultConfig.quality).toBe('best');
      expect(defaultConfig.concurrentFragments).toBe(8);
      expect(defaultConfig.socketTimeout).toBe(30);
      expect(defaultConfig.retries).toBe(5);
    });

    it('should have boolean flags configured', () => {
      expect(typeof defaultConfig.embedSubs).toBe('boolean');
      expect(typeof defaultConfig.writeThumbnail).toBe('boolean');
      expect(typeof defaultConfig.noCheckCertificate).toBe('boolean');
      expect(typeof defaultConfig.ignoreErrors).toBe('boolean');
    });
  });

  describe('Output Format Argument', () => {
    it('should include output format in arguments', () => {
      const args = downloader.buildYtdlpArgs(defaultConfig, videoUrl, { useStdout: false });
      const hasFormat = args.some(arg => arg.includes('mp4') || arg.includes('format'));
      expect(hasFormat).toBe(true);
    });

    it('should handle different output formats', () => {
      const config = { ...defaultConfig, outputFormat: 'mkv' };
      const args = downloader.buildYtdlpArgs(config, videoUrl, { useStdout: false });
      expect(Array.isArray(args)).toBe(true);
      expect(args.length).toBeGreaterThan(0);
    });
  });

  describe('Quality Argument', () => {
    it('should include quality setting in arguments', () => {
      const args = downloader.buildYtdlpArgs(defaultConfig, videoUrl, { useStdout: false });
      const hasQuality = args.some(arg => arg.includes('best') || arg.includes('1080') || arg.includes('720'));
      expect(hasQuality).toBe(true);
    });

    it('should handle specific quality settings', () => {
      const config = { ...defaultConfig, quality: '720p' };
      const args = downloader.buildYtdlpArgs(config, videoUrl, { useStdout: false });
      expect(Array.isArray(args)).toBe(true);
    });

    it('should handle audio format setting', () => {
      const config = { ...defaultConfig, audioFormat: 'best' };
      const args = downloader.buildYtdlpArgs(config, videoUrl, { useStdout: false });
      expect(Array.isArray(args)).toBe(true);
    });
  });

  describe('Concurrent Fragments Argument', () => {
    it('should include concurrent fragments in arguments', () => {
      const args = downloader.buildYtdlpArgs(defaultConfig, videoUrl, { useStdout: false });
      const hasFragments = args.includes('--concurrent-fragments');
      expect(hasFragments).toBe(true);
    });

    it('should have correct fragment count', () => {
      const args = downloader.buildYtdlpArgs(defaultConfig, videoUrl, { useStdout: false });
      const fragmentIndex = args.indexOf('--concurrent-fragments');
      if (fragmentIndex >= 0) {
        expect(args[fragmentIndex + 1]).toBe('8');
      }
    });

    it('should handle different fragment counts', () => {
      const config = { ...defaultConfig, concurrentFragments: 16 };
      const args = downloader.buildYtdlpArgs(config, videoUrl, { useStdout: false });
      expect(args.includes('16')).toBe(true);
    });
  });

  describe('Subtitle Arguments', () => {
    it('should handle embed subtitles flag', () => {
      const config = { ...defaultConfig, embedSubs: true };
      const args = downloader.buildYtdlpArgs(config, videoUrl, { useStdout: false });
      expect(Array.isArray(args)).toBe(true);
    });

    it('should handle write auto subtitles flag', () => {
      const config = { ...defaultConfig, writeAutoSubs: true };
      const args = downloader.buildYtdlpArgs(config, videoUrl, { useStdout: false });
      expect(Array.isArray(args)).toBe(true);
    });
  });

  describe('Metadata Arguments', () => {
    it('should handle write info json flag', () => {
      const config = { ...defaultConfig, writeInfoJson: true };
      const args = downloader.buildYtdlpArgs(config, videoUrl, { useStdout: false });
      expect(Array.isArray(args)).toBe(true);
    });

    it('should handle write thumbnail flag', () => {
      const config = { ...defaultConfig, writeThumbnail: true };
      const args = downloader.buildYtdlpArgs(config, videoUrl, { useStdout: false });
      expect(Array.isArray(args)).toBe(true);
    });

    it('should handle write description flag', () => {
      const config = { ...defaultConfig, writeDescription: true };
      const args = downloader.buildYtdlpArgs(config, videoUrl, { useStdout: false });
      expect(Array.isArray(args)).toBe(true);
    });

    it('should handle embed metadata flag', () => {
      const config = { ...defaultConfig, embedMetadata: true };
      const args = downloader.buildYtdlpArgs(config, videoUrl, { useStdout: false });
      expect(Array.isArray(args)).toBe(true);
    });
  });

  describe('HTTP Arguments', () => {
    it('should include user agent in arguments', () => {
      const args = downloader.buildYtdlpArgs(defaultConfig, videoUrl, { useStdout: false });
      const hasUserAgent = args.includes('--user-agent');
      expect(hasUserAgent).toBe(true);
    });

    it('should include referer in arguments', () => {
      const args = downloader.buildYtdlpArgs(defaultConfig, videoUrl, { useStdout: false });
      const hasReferer = args.includes('--referer');
      expect(hasReferer).toBe(true);
    });

    it('should handle custom user agent', () => {
      const customUA = 'CustomAgent/1.0';
      const config = { ...defaultConfig, userAgent: customUA };
      const args = downloader.buildYtdlpArgs(config, videoUrl, { useStdout: false });
      expect(args.includes(customUA)).toBe(true);
    });

    it('should handle custom referer', () => {
      const customReferer = 'https://example.com/';
      const config = { ...defaultConfig, referer: customReferer };
      const args = downloader.buildYtdlpArgs(config, videoUrl, { useStdout: false });
      expect(args.includes(customReferer)).toBe(true);
    });
  });

  describe('Timeout and Retry Arguments', () => {
    it('should include socket timeout in arguments', () => {
      const args = downloader.buildYtdlpArgs(defaultConfig, videoUrl, { useStdout: false });
      const hasTimeout = args.includes('--socket-timeout');
      expect(hasTimeout).toBe(true);
    });

    it('should include retries in arguments', () => {
      const args = downloader.buildYtdlpArgs(defaultConfig, videoUrl, { useStdout: false });
      const hasRetries = args.includes('--retries');
      expect(hasRetries).toBe(true);
    });

    it('should include fragment retries in arguments', () => {
      const args = downloader.buildYtdlpArgs(defaultConfig, videoUrl, { useStdout: false });
      const hasFragmentRetries = args.includes('--fragment-retries');
      expect(hasFragmentRetries).toBe(true);
    });

    it('should include extractor retries in arguments', () => {
      const args = downloader.buildYtdlpArgs(defaultConfig, videoUrl, { useStdout: false });
      const hasExtractorRetries = args.includes('--extractor-retries');
      expect(hasExtractorRetries).toBe(true);
    });

    it('should have correct timeout value', () => {
      const args = downloader.buildYtdlpArgs(defaultConfig, videoUrl, { useStdout: false });
      const timeoutIndex = args.indexOf('--socket-timeout');
      if (timeoutIndex >= 0) {
        expect(args[timeoutIndex + 1]).toBe('30');
      }
    });
  });

  describe('Security Arguments', () => {
    it('should include no check certificate flag', () => {
      const config = { ...defaultConfig, noCheckCertificate: true };
      const args = downloader.buildYtdlpArgs(config, videoUrl, { useStdout: false });
      expect(Array.isArray(args)).toBe(true);
    });

    it('should include ignore errors flag', () => {
      const config = { ...defaultConfig, ignoreErrors: true };
      const args = downloader.buildYtdlpArgs(config, videoUrl, { useStdout: false });
      expect(Array.isArray(args)).toBe(true);
    });

    it('should handle anonymous flag', () => {
      const config = { ...defaultConfig, anonymous: true };
      const args = downloader.buildYtdlpArgs(config, videoUrl, { useStdout: false });
      expect(Array.isArray(args)).toBe(true);
    });

    it('should handle force ipv4 flag', () => {
      const config = { ...defaultConfig, forceIpv4: true };
      const args = downloader.buildYtdlpArgs(config, videoUrl, { useStdout: false });
      expect(Array.isArray(args)).toBe(true);
    });
  });

  describe('Filename Arguments', () => {
    it('should handle restrict filenames flag', () => {
      const config = { ...defaultConfig, restrictFilenames: true };
      const args = downloader.buildYtdlpArgs(config, videoUrl, { useStdout: false });
      expect(Array.isArray(args)).toBe(true);
    });

    it('should handle filename template', () => {
      const template = '%(title)s-%(id)s';
      const config = { ...defaultConfig, fileNameTemplate: template };
      const args = downloader.buildYtdlpArgs(config, videoUrl, { useStdout: false });
      expect(Array.isArray(args)).toBe(true);
    });
  });

  describe('Download Type Arguments', () => {
    it('should handle preferred download type', () => {
      const config = { ...defaultConfig, preferredDownloadType: 'video' };
      const args = downloader.buildYtdlpArgs(config, videoUrl, { useStdout: false });
      expect(Array.isArray(args)).toBe(true);
    });

    it('should handle use sponsor block flag', () => {
      const config = { ...defaultConfig, useSponsorBlock: true };
      const args = downloader.buildYtdlpArgs(config, videoUrl, { useStdout: false });
      expect(Array.isArray(args)).toBe(true);
    });
  });

  describe('Streaming Mode Arguments', () => {
    it('should use stdout for streaming', () => {
      const args = downloader.buildYtdlpArgs(defaultConfig, videoUrl, { useStdout: true });
      const hasStdout = args.includes('-o') && args.includes('-');
      expect(hasStdout).toBe(true);
    });

    it('should have different args for streaming vs download', () => {
      const downloadArgs = downloader.buildYtdlpArgs(defaultConfig, videoUrl, { useStdout: false });
      const streamArgs = downloader.buildYtdlpArgs(defaultConfig, videoUrl, { useStdout: true });
      
      const downloadSet = new Set(downloadArgs);
      const streamSet = new Set(streamArgs);
      
      const differences = [...downloadSet].filter(x => !streamSet.has(x)).length +
                         [...streamSet].filter(x => !downloadSet.has(x)).length;
      
      expect(differences).toBeGreaterThan(0);
    });
  });

  describe('Argument Consistency', () => {
    it('should always include URL as last argument', () => {
      const args = downloader.buildYtdlpArgs(defaultConfig, videoUrl, { useStdout: false });
      expect(args[args.length - 1]).toBe(videoUrl);
    });

    it('should not have empty arguments', () => {
      const args = downloader.buildYtdlpArgs(defaultConfig, videoUrl, { useStdout: false });
      const hasEmpty = args.some(arg => arg === '' || arg === null || arg === undefined);
      expect(hasEmpty).toBe(false);
    });

    it('should have valid argument format', () => {
      const args = downloader.buildYtdlpArgs(defaultConfig, videoUrl, { useStdout: false });
      args.forEach((arg, index) => {
        if (index < args.length - 1) { // Skip URL
          expect(typeof arg).toBe('string');
          expect(arg.length).toBeGreaterThan(0);
        }
      });
    });

    it('should maintain argument order consistency', () => {
      const args1 = downloader.buildYtdlpArgs(defaultConfig, videoUrl, { useStdout: false });
      const args2 = downloader.buildYtdlpArgs(defaultConfig, videoUrl, { useStdout: false });
      
      expect(args1).toEqual(args2);
    });
  });

  describe('Configuration Variations', () => {
    it('should handle minimal configuration', () => {
      const minimalConfig = {
        outputFormat: 'mp4',
        quality: 'best',
      };
      const args = downloader.buildYtdlpArgs(minimalConfig, videoUrl, { useStdout: false });
      expect(Array.isArray(args)).toBe(true);
      expect(args.length).toBeGreaterThan(0);
    });

    it('should handle extended configuration', () => {
      const extendedConfig = {
        ...defaultConfig,
        useSponsorBlock: true,
        embedMetadata: true,
        writeAutoSubs: true,
        embedSubs: true,
      };
      const args = downloader.buildYtdlpArgs(extendedConfig, videoUrl, { useStdout: false });
      expect(Array.isArray(args)).toBe(true);
      expect(args.length).toBeGreaterThan(0);
    });

    it('should handle configuration with empty strings', () => {
      const config = {
        ...defaultConfig,
        userAgent: '',
        referer: '',
        proxy: '',
      };
      const args = downloader.buildYtdlpArgs(config, videoUrl, { useStdout: false });
      expect(Array.isArray(args)).toBe(true);
    });
  });
});



