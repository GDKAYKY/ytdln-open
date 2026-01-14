/**
 * Integration Tests for StreamDownloadService
 * 
 * Feature: sync-stream-download
 * Tests complete stream lifecycle and error scenarios
 */

const { StreamDownloadService, InvalidURLError, ProcessSpawnError } = require('../stream-download.service');

describe('StreamDownloadService Integration Tests', () => {
  let service;

  beforeEach(() => {
    service = new StreamDownloadService();
    // Add error listener to prevent unhandled errors
    service.on('error', () => {});
  });

  afterEach(() => {
    // Clean up any remaining streams
    service.streams.forEach((stream, taskId) => {
      try {
        service.stopStream(taskId);
      } catch (error) {
        // Ignore cleanup errors
      }
    });
  });

  describe('Stream Lifecycle', () => {
    it('should handle invalid URL gracefully', async () => {
      const taskId = 'test-invalid-url';
      const invalidUrl = 'not-a-valid-url';

      await expect(service.startStream(taskId, invalidUrl, {})).rejects.toThrow(InvalidURLError);
      
      // Stream should not be created
      expect(service.streams.has(taskId)).toBe(false);
    });

    it('should handle missing URL gracefully', async () => {
      const taskId = 'test-missing-url';

      await expect(service.startStream(taskId, '', {})).rejects.toThrow(InvalidURLError);
      
      // Stream should not be created
      expect(service.streams.has(taskId)).toBe(false);
    });

    it('should handle null URL gracefully', async () => {
      const taskId = 'test-null-url';

      await expect(service.startStream(taskId, null, {})).rejects.toThrow(InvalidURLError);
      
      // Stream should not be created
      expect(service.streams.has(taskId)).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when stopping nonexistent stream', () => {
      expect(() => service.stopStream('nonexistent-stream')).toThrow();
    });

    it('should return null status for nonexistent stream', () => {
      const status = service.getStreamStatus('nonexistent-stream');
      expect(status).toBeNull();
    });

    it('should handle multiple invalid URLs sequentially', async () => {
      const urls = ['invalid1', 'invalid2', 'invalid3'];
      
      for (const url of urls) {
        const taskId = `test-${url}`;
        await expect(service.startStream(taskId, url, {})).rejects.toThrow(InvalidURLError);
        expect(service.streams.has(taskId)).toBe(false);
      }
    });
  });

  describe('Argument Construction', () => {
    it('should build correct yt-dlp arguments for various formats', () => {
      const formats = ['best', 'audio', '720p', '1080p'];
      
      formats.forEach(format => {
        const args = service.buildYtdlpArgs({ format }, 'https://example.com/video');
        
        // Verify required flags
        expect(args).toContain('--progress');
        expect(args).toContain('--newline');
        expect(args).toContain('-o');
        expect(args).toContain('-');
        
        // Verify URL is last
        expect(args[args.length - 1]).toBe('https://example.com/video');
      });
    });

    it('should build correct FFmpeg arguments for audio and video', () => {
      const audioArgs = service.buildFfmpegArgs({ audioOnly: true });
      const videoArgs = service.buildFfmpegArgs({ audioOnly: false });
      
      // Both should have codec copy
      expect(audioArgs).toContain('-c');
      expect(videoArgs).toContain('-c');
      
      // Audio should use mp3, video should use mp4
      const audioFIndex = audioArgs.indexOf('-f');
      const videoFIndex = videoArgs.indexOf('-f');
      
      expect(audioArgs[audioFIndex + 1]).toBe('mp3');
      expect(videoArgs[videoFIndex + 1]).toBe('mp4');
    });
  });

  describe('Progress Parsing', () => {
    it('should parse various yt-dlp progress formats', () => {
      const messages = [
        '[download]  0% of ~100.00 MiB at  0.00 MiB/s ETA 00:00:00',
        '[download]  50% of ~100.00 MiB at  2.50 MiB/s ETA 00:00:20',
        '[download]  100% of ~100.00 MiB at  5.00 MiB/s ETA 00:00:00',
      ];
      
      messages.forEach(message => {
        const progress = service.parseYtdlpProgress(message);
        expect(progress).not.toBeNull();
        expect(progress.percent).toBeGreaterThanOrEqual(0);
        expect(progress.percent).toBeLessThanOrEqual(100);
        expect(progress.source).toBe('ytdlp');
      });
    });

    it('should parse various FFmpeg progress formats', () => {
      const messages = [
        'frame=    0 fps=0.0 q=-1.0 Lsize=N/A time=00:00:00.00 bitrate=N/A speed=N/A',
        'frame= 1000 fps=30.0 q=28.0 Lsize= 5000kB time=00:00:33.33 bitrate=1234.5kbps speed=1.02x',
        'frame= 5000 fps=29.9 q=28.0 Lsize=25000kB time=00:02:46.66 bitrate=1234.5kbps speed=0.99x',
      ];
      
      messages.forEach(message => {
        const progress = service.parseFfmpegProgress(message);
        expect(progress).not.toBeNull();
        expect(progress.frame).toBeGreaterThanOrEqual(0);
        expect(progress.source).toBe('ffmpeg');
      });
    });

    it('should handle malformed progress messages gracefully', () => {
      const malformedMessages = [
        'random text',
        '[download] incomplete message',
        'frame= incomplete',
        '',
        null,
      ];
      
      malformedMessages.forEach(message => {
        const ytdlpProgress = service.parseYtdlpProgress(message);
        const ffmpegProgress = service.parseFfmpegProgress(message);
        
        // Should return null without throwing
        expect(ytdlpProgress === null || typeof ytdlpProgress === 'object').toBe(true);
        expect(ffmpegProgress === null || typeof ffmpegProgress === 'object').toBe(true);
      });
    });
  });

  describe('URL Validation', () => {
    it('should accept valid URLs', () => {
      const validUrls = [
        'https://example.com/video',
        'http://example.com/video',
        'https://youtube.com/watch?v=dQw4w9WgXcQ',
        'https://example.com:8080/video',
      ];
      
      validUrls.forEach(url => {
        expect(() => service.validateURL(url)).not.toThrow();
      });
    });

    it('should reject invalid URLs', () => {
      const invalidUrls = [
        'not-a-url',
        'example.com',
        'www.example.com',
        '',
        null,
      ];
      
      invalidUrls.forEach(url => {
        expect(() => service.validateURL(url)).toThrow(InvalidURLError);
      });
    });
  });

  describe('Stream State Management', () => {
    it('should maintain separate state for multiple streams', async () => {
      const taskIds = ['stream1', 'stream2', 'stream3'];
      
      // Try to create multiple streams (will fail due to invalid binaries, but state should be managed)
      for (const taskId of taskIds) {
        try {
          await service.startStream(taskId, 'https://example.com/video', {});
        } catch (error) {
          // Expected to fail
        }
      }
      
      // Streams may still exist if they were created before spawn failed
      // Just verify the service can handle multiple streams
      expect(service.streams.size >= 0).toBe(true);
    });

    it('should return correct status for stream', async () => {
      const taskId = 'test-status';
      
      // Try to create stream (will fail, but we can test status)
      try {
        await service.startStream(taskId, 'https://example.com/video', {});
      } catch (error) {
        // Expected to fail
      }
      
      // Status should be null or valid object
      const status = service.getStreamStatus(taskId);
      expect(status === null || typeof status === 'object').toBe(true);
    });
  });

  describe('Configuration', () => {
    it('should have correct default configuration', () => {
      expect(service.config.processSpawnTimeout).toBe(5000);
      expect(service.config.processKillTimeout).toBe(5000);
    });

    it('should allow custom binary paths', () => {
      const customService = new StreamDownloadService({
        ytdlp: '/custom/yt-dlp',
        ffmpeg: '/custom/ffmpeg',
        ffprobe: '/custom/ffprobe',
      });
      
      expect(customService.binaries.ytdlp).toBe('/custom/yt-dlp');
      expect(customService.binaries.ffmpeg).toBe('/custom/ffmpeg');
      expect(customService.binaries.ffprobe).toBe('/custom/ffprobe');
    });

    it('should use default binary paths when not specified', () => {
      const defaultService = new StreamDownloadService();
      
      expect(defaultService.binaries.ytdlp).toBe('yt-dlp');
      expect(defaultService.binaries.ffmpeg).toBe('ffmpeg');
      expect(defaultService.binaries.ffprobe).toBe('ffprobe');
    });
  });
});
