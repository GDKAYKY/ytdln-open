/**
 * Tests for StreamDownloadService
 * 
 * Feature: sync-stream-download
 * Tests the buildYtdlpArgs, buildFfmpegArgs, and progress parsing methods
 */

const { StreamDownloadService, InvalidURLError, ProcessSpawnError } = require('../stream-download.service');
const fc = require('fast-check');

describe('StreamDownloadService', () => {
  let service;

  beforeEach(() => {
    service = new StreamDownloadService();
  });

  describe('buildYtdlpArgs', () => {
    describe('Unit Tests', () => {
      it('should include --progress and --newline flags', () => {
        const args = service.buildYtdlpArgs({ format: 'best' }, 'https://example.com/video');
        expect(args).toContain('--progress');
        expect(args).toContain('--newline');
      });

      it('should include -o - for stdout output', () => {
        const args = service.buildYtdlpArgs({ format: 'best' }, 'https://example.com/video');
        expect(args).toContain('-o');
        const oIndex = args.indexOf('-o');
        expect(args[oIndex + 1]).toBe('-');
      });

      it('should append URL as final argument', () => {
        const url = 'https://example.com/video';
        const args = service.buildYtdlpArgs({ format: 'best' }, url);
        expect(args[args.length - 1]).toBe(url);
      });

      it('should handle format "best"', () => {
        const args = service.buildYtdlpArgs({ format: 'best' }, 'https://example.com/video');
        expect(args).toContain('-f');
        const fIndex = args.indexOf('-f');
        expect(args[fIndex + 1]).toBe('best');
      });

      it('should handle format "audio"', () => {
        const args = service.buildYtdlpArgs({ format: 'audio' }, 'https://example.com/video');
        expect(args).toContain('-f');
        const fIndex = args.indexOf('-f');
        expect(args[fIndex + 1]).toBe('bestaudio');
      });

      it('should handle resolution format like "720p"', () => {
        const args = service.buildYtdlpArgs({ format: '720p' }, 'https://example.com/video');
        expect(args).toContain('-f');
        const fIndex = args.indexOf('-f');
        expect(args[fIndex + 1]).toContain('720');
      });

      it('should handle resolution format like "1080p"', () => {
        const args = service.buildYtdlpArgs({ format: '1080p' }, 'https://example.com/video');
        expect(args).toContain('-f');
        const fIndex = args.indexOf('-f');
        expect(args[fIndex + 1]).toContain('1080');
      });

      it('should add -x and --audio-format flags when audioOnly is true', () => {
        const args = service.buildYtdlpArgs({ format: 'best', audioOnly: true }, 'https://example.com/video');
        expect(args).toContain('-x');
        expect(args).toContain('--audio-format');
        const audioFormatIndex = args.indexOf('--audio-format');
        expect(args[audioFormatIndex + 1]).toBe('mp3');
      });

      it('should not add -x flag when audioOnly is false', () => {
        const args = service.buildYtdlpArgs({ format: 'best', audioOnly: false }, 'https://example.com/video');
        expect(args).not.toContain('-x');
      });

      it('should use default format "best" when format is not specified', () => {
        const args = service.buildYtdlpArgs({}, 'https://example.com/video');
        expect(args).toContain('-f');
        const fIndex = args.indexOf('-f');
        expect(args[fIndex + 1]).toBe('best');
      });

      it('should maintain correct argument order', () => {
        const args = service.buildYtdlpArgs({ format: 'best' }, 'https://example.com/video');
        // --progress and --newline should come first
        expect(args.indexOf('--progress')).toBeLessThan(args.indexOf('-o'));
        expect(args.indexOf('--newline')).toBeLessThan(args.indexOf('-o'));
        // URL should be last
        expect(args[args.length - 1]).toBe('https://example.com/video');
      });
    });

    describe('Property-Based Tests', () => {
      it('Property 3: Format selection translates correctly', () => {
        fc.assert(
          fc.property(
            fc.oneof(
              fc.constant('best'),
              fc.constant('720p'),
              fc.constant('1080p'),
              fc.constant('480p'),
              fc.constant('audio')
            ),
            (format) => {
              const args = service.buildYtdlpArgs({ format }, 'https://example.com/video');
              
              // All arguments should be strings
              expect(args.every(arg => typeof arg === 'string')).toBe(true);
              
              // Must contain -f flag for format selection
              expect(args).toContain('-f');
              
              // Format selector should be present after -f
              const fIndex = args.indexOf('-f');
              expect(fIndex).toBeGreaterThan(-1);
              expect(args[fIndex + 1]).toBeDefined();
              
              // URL should be last argument
              expect(args[args.length - 1]).toBe('https://example.com/video');
              
              // Must contain required flags
              expect(args).toContain('--progress');
              expect(args).toContain('--newline');
              expect(args).toContain('-o');
              expect(args).toContain('-');
            }
          ),
          { numRuns: 100 }
        );
      });

      it('Property 3.1: Audio format includes audio extraction flags', () => {
        fc.assert(
          fc.property(
            fc.boolean(),
            (audioOnly) => {
              const args = service.buildYtdlpArgs({ format: 'best', audioOnly }, 'https://example.com/video');
              
              if (audioOnly) {
                // When audioOnly is true, must have -x and --audio-format
                expect(args).toContain('-x');
                expect(args).toContain('--audio-format');
                const audioFormatIndex = args.indexOf('--audio-format');
                expect(args[audioFormatIndex + 1]).toBe('mp3');
              } else {
                // When audioOnly is false, should not have -x
                expect(args).not.toContain('-x');
              }
            }
          ),
          { numRuns: 100 }
        );
      });

      it('Property 3.2: Arguments always end with URL', () => {
        fc.assert(
          fc.property(
            fc.webUrl(),
            fc.oneof(
              fc.constant('best'),
              fc.constant('720p'),
              fc.constant('audio')
            ),
            (url, format) => {
              const args = service.buildYtdlpArgs({ format }, url);
              
              // Last argument must be the URL
              expect(args[args.length - 1]).toBe(url);
              
              // URL should not appear elsewhere in arguments
              const urlCount = args.filter(arg => arg === url).length;
              expect(urlCount).toBe(1);
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });

  describe('buildFfmpegArgs', () => {
    describe('Unit Tests', () => {
      it('should include -i - for stdin input', () => {
        const args = service.buildFfmpegArgs({ audioOnly: false });
        expect(args).toContain('-i');
        const iIndex = args.indexOf('-i');
        expect(args[iIndex + 1]).toBe('-');
      });

      it('should include -c copy for codec copy mode', () => {
        const args = service.buildFfmpegArgs({ audioOnly: false });
        expect(args).toContain('-c');
        const cIndex = args.indexOf('-c');
        expect(args[cIndex + 1]).toBe('copy');
      });

      it('should include -f flag for output format', () => {
        const args = service.buildFfmpegArgs({ audioOnly: false });
        expect(args).toContain('-f');
      });

      it('should use mp4 format when audioOnly is false', () => {
        const args = service.buildFfmpegArgs({ audioOnly: false });
        expect(args).toContain('-f');
        const fIndex = args.indexOf('-f');
        expect(args[fIndex + 1]).toBe('mp4');
      });

      it('should use mp3 format when audioOnly is true', () => {
        const args = service.buildFfmpegArgs({ audioOnly: true });
        expect(args).toContain('-f');
        const fIndex = args.indexOf('-f');
        expect(args[fIndex + 1]).toBe('mp3');
      });

      it('should use - as output for stdout', () => {
        const args = service.buildFfmpegArgs({ audioOnly: false });
        expect(args[args.length - 1]).toBe('-');
      });

      it('should maintain correct argument order', () => {
        const args = service.buildFfmpegArgs({ audioOnly: false });
        // -i - should come first
        expect(args.indexOf('-i')).toBe(0);
        expect(args.indexOf('-')).toBe(1);
        // -c copy should come next
        expect(args.indexOf('-c')).toBeLessThan(args.indexOf('-f'));
        // - (stdout) should be last
        expect(args[args.length - 1]).toBe('-');
      });

      it('should return array of strings', () => {
        const args = service.buildFfmpegArgs({ audioOnly: false });
        expect(Array.isArray(args)).toBe(true);
        expect(args.every(arg => typeof arg === 'string')).toBe(true);
      });
    });

    describe('Property-Based Tests', () => {
      it('Property 2.5: Codec copy mode is used', () => {
        fc.assert(
          fc.property(
            fc.boolean(),
            (audioOnly) => {
              const args = service.buildFfmpegArgs({ audioOnly });
              
              // Must contain -c copy for codec copy mode
              expect(args).toContain('-c');
              const cIndex = args.indexOf('-c');
              expect(args[cIndex + 1]).toBe('copy');
              
              // Must contain -i - for stdin input
              expect(args).toContain('-i');
              const iIndex = args.indexOf('-i');
              expect(args[iIndex + 1]).toBe('-');
              
              // Must contain -f flag
              expect(args).toContain('-f');
              
              // Last argument must be - for stdout
              expect(args[args.length - 1]).toBe('-');
              
              // Format should match audioOnly flag
              const fIndex = args.indexOf('-f');
              const format = args[fIndex + 1];
              if (audioOnly) {
                expect(format).toBe('mp3');
              } else {
                expect(format).toBe('mp4');
              }
            }
          ),
          { numRuns: 100 }
        );
      });

      it('Property 2.6: Output format matches content type', () => {
        fc.assert(
          fc.property(
            fc.boolean(),
            (audioOnly) => {
              const args = service.buildFfmpegArgs({ audioOnly });
              
              // Find the format
              const fIndex = args.indexOf('-f');
              const format = args[fIndex + 1];
              
              // Format should be either mp3 or mp4
              expect(['mp3', 'mp4']).toContain(format);
              
              // mp3 should only be used when audioOnly is true
              if (format === 'mp3') {
                expect(audioOnly).toBe(true);
              }
              
              // mp4 should only be used when audioOnly is false
              if (format === 'mp4') {
                expect(audioOnly).toBe(false);
              }
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });

  describe('parseYtdlpProgress', () => {
    describe('Unit Tests', () => {
      it('should parse valid yt-dlp progress message', () => {
        const message = '[download]  75.5% of ~150.25 MiB at  2.50 MiB/s ETA 00:01:30';
        const progress = service.parseYtdlpProgress(message);
        
        expect(progress).not.toBeNull();
        expect(progress.percent).toBe(75.5);
        expect(progress.speed).toBe('2.50 MiB/s');
        expect(progress.eta).toBe('00:01:30');
        expect(progress.total).toBe('150.25 MiB');
        expect(progress.source).toBe('ytdlp');
      });

      it('should return null for messages without [download]', () => {
        const message = 'Some other message';
        const progress = service.parseYtdlpProgress(message);
        expect(progress).toBeNull();
      });

      it('should return null for empty message', () => {
        const progress = service.parseYtdlpProgress('');
        expect(progress).toBeNull();
      });

      it('should return null for null message', () => {
        const progress = service.parseYtdlpProgress(null);
        expect(progress).toBeNull();
      });

      it('should handle messages without ETA', () => {
        const message = '[download]  50.0% of ~100.00 MiB at  1.50 MiB/s';
        const progress = service.parseYtdlpProgress(message);
        
        expect(progress).not.toBeNull();
        expect(progress.percent).toBe(50.0);
        expect(progress.eta).toBe('unknown');
      });

      it('should handle messages without speed', () => {
        const message = '[download]  25.0% of ~100.00 MiB ETA 00:05:00';
        const progress = service.parseYtdlpProgress(message);
        
        expect(progress).not.toBeNull();
        expect(progress.percent).toBe(25.0);
        expect(progress.speed).toBe('unknown');
      });

      it('should handle integer percentages', () => {
        const message = '[download]  100% of ~200.00 MiB at  5.00 MiB/s ETA 00:00:00';
        const progress = service.parseYtdlpProgress(message);
        
        expect(progress).not.toBeNull();
        expect(progress.percent).toBe(100);
      });

      it('should return null if no percentage found', () => {
        const message = '[download] downloading at  2.50 MiB/s';
        const progress = service.parseYtdlpProgress(message);
        expect(progress).toBeNull();
      });
    });

    describe('Property-Based Tests', () => {
      it('Property 4: Progress parsing extracts correct values', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 0, max: 100 }),
            fc.integer({ min: 0, max: 999 }),
            fc.integer({ min: 1, max: 10 }),
            (percent, minutes, speed) => {
              const eta = `00:${String(minutes).padStart(2, '0')}:00`;
              const message = `[download]  ${percent}% of ~150.25 MiB at  ${speed}.50 MiB/s ETA ${eta}`;
              
              const progress = service.parseYtdlpProgress(message);
              
              expect(progress).not.toBeNull();
              expect(progress.percent).toBe(percent);
              expect(progress.source).toBe('ytdlp');
              expect(typeof progress.speed).toBe('string');
              expect(typeof progress.eta).toBe('string');
              expect(typeof progress.total).toBe('string');
            }
          ),
          { numRuns: 100 }
        );
      });

      it('Property 4.1: Invalid messages return null without crashing', () => {
        fc.assert(
          fc.property(
            fc.string(),
            (randomString) => {
              // Should not throw, should return null or valid progress
              const result = service.parseYtdlpProgress(randomString);
              expect(result === null || typeof result === 'object').toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });

  describe('parseFfmpegProgress', () => {
    describe('Unit Tests', () => {
      it('should parse valid FFmpeg progress message', () => {
        const message = 'frame=  150 fps=0.0 q=-1.0 Lsize=N/A time=00:00:06.25 bitrate=N/A speed=N/A';
        const progress = service.parseFfmpegProgress(message);
        
        expect(progress).not.toBeNull();
        expect(progress.frame).toBe(150);
        expect(progress.fps).toBe(0.0);
        expect(progress.q).toBe(-1.0);
        expect(progress.size).toBe('N/A');
        expect(progress.time).toBe('00:00:06.25');
        expect(progress.bitrate).toBe('N/A');
        expect(progress.speed).toBe('N/A');
        expect(progress.source).toBe('ffmpeg');
      });

      it('should return null for messages without frame=', () => {
        const message = 'Some other FFmpeg message';
        const progress = service.parseFfmpegProgress(message);
        expect(progress).toBeNull();
      });

      it('should return null for empty message', () => {
        const progress = service.parseFfmpegProgress('');
        expect(progress).toBeNull();
      });

      it('should return null for null message', () => {
        const progress = service.parseFfmpegProgress(null);
        expect(progress).toBeNull();
      });

      it('should handle messages with all fields', () => {
        const message = 'frame= 1000 fps=30.5 q=28.0 Lsize=  5000kB time=00:00:33.33 bitrate=1234.5kbps speed=1.02x';
        const progress = service.parseFfmpegProgress(message);
        
        expect(progress).not.toBeNull();
        expect(progress.frame).toBe(1000);
        expect(progress.fps).toBe(30.5);
        expect(progress.q).toBe(28.0);
        expect(progress.size).toBe('5000kB');
        expect(progress.time).toBe('00:00:33.33');
        expect(progress.bitrate).toBe('1234.5kbps');
        expect(progress.speed).toBe('1.02x');
      });

      it('should handle missing optional fields', () => {
        const message = 'frame=  500 fps=25.0';
        const progress = service.parseFfmpegProgress(message);
        
        expect(progress).not.toBeNull();
        expect(progress.frame).toBe(500);
        expect(progress.fps).toBe(25.0);
        expect(progress.q).toBe(-1);
        expect(progress.size).toBe('N/A');
      });

      it('should return null if no frame found', () => {
        const message = 'fps=30.0 q=28.0 time=00:00:10.00';
        const progress = service.parseFfmpegProgress(message);
        expect(progress).toBeNull();
      });
    });

    describe('Property-Based Tests', () => {
      it('Property 4.2: FFmpeg progress parsing extracts correct values', () => {
        fc.assert(
          fc.property(
            fc.integer({ min: 0, max: 10000 }),
            fc.integer({ min: 0, max: 60 }),
            (frame, fps) => {
              const message = `frame=${frame} fps=${fps}.0 q=28.0 Lsize=N/A time=00:00:10.00 bitrate=N/A speed=1.0x`;
              
              const progress = service.parseFfmpegProgress(message);
              
              expect(progress).not.toBeNull();
              expect(progress.frame).toBe(frame);
              expect(progress.fps).toBe(parseFloat(`${fps}.0`));
              expect(progress.source).toBe('ffmpeg');
            }
          ),
          { numRuns: 100 }
        );
      });

      it('Property 4.3: Invalid FFmpeg messages return null without crashing', () => {
        fc.assert(
          fc.property(
            fc.string(),
            (randomString) => {
              // Should not throw, should return null or valid progress
              const result = service.parseFfmpegProgress(randomString);
              expect(result === null || typeof result === 'object').toBe(true);
            }
          ),
          { numRuns: 100 }
        );
      });
    });
  });

  describe('URL Validation', () => {
    describe('Unit Tests', () => {
      it('should throw InvalidURLError for empty URL', () => {
        expect(() => service.validateURL('')).toThrow(InvalidURLError);
      });

      it('should throw InvalidURLError for null URL', () => {
        expect(() => service.validateURL(null)).toThrow(InvalidURLError);
      });

      it('should throw InvalidURLError for invalid URL format', () => {
        expect(() => service.validateURL('not-a-url')).toThrow(InvalidURLError);
      });

      it('should accept valid URLs', () => {
        expect(() => service.validateURL('https://example.com/video')).not.toThrow();
        expect(() => service.validateURL('http://example.com/video')).not.toThrow();
      });
    });

    describe('Property-Based Tests', () => {
      it('Property 2: Invalid URL returns error', () => {
        fc.assert(
          fc.property(
            fc.string()
              .filter(s => s.length > 0)
              .filter(s => !s.includes('http'))
              .filter(s => !s.includes('://'))
              .filter(s => !s.match(/^[a-z]+:/i)),
            (invalidUrl) => {
              // Should throw InvalidURLError for invalid URLs
              try {
                service.validateURL(invalidUrl);
                // If it doesn't throw, it should be an invalid URL
                expect(false).toBe(true);
              } catch (error) {
                expect(error instanceof InvalidURLError).toBe(true);
              }
            }
          ),
          { numRuns: 50 }
        );
      });
    });
  });
});
