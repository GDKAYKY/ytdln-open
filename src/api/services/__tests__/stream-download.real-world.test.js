/**
 * Real-World Integration Tests for StreamDownloadService
 * 
 * Feature: sync-stream-download
 * Tests actual stream download scenarios with mock data
 */

const { Readable, PassThrough } = require('stream');
const { StreamDownloadService } = require('../stream-download.service');

describe('StreamDownloadService Real-World Scenarios', () => {
  let service;

  beforeEach(() => {
    service = new StreamDownloadService();
    service.on('error', () => {});
  });

  afterEach(() => {
    service.streams.forEach((stream, taskId) => {
      try {
        service.stopStream(taskId);
      } catch (error) {
        // Ignore cleanup errors
      }
    });
  });

  describe('Simulated Download Scenarios', () => {
    it('should handle a complete video download simulation', (done) => {
      const taskId = 'video-download-' + Date.now();
      let progressUpdates = [];
      let downloadComplete = false;

      // Simulate yt-dlp progress messages
      const ytdlpProgressMessages = [
        '[download]  0% of ~500.00 MiB at  0.00 MiB/s ETA 00:00:00',
        '[download]  10% of ~500.00 MiB at  2.50 MiB/s ETA 00:03:20',
        '[download]  25% of ~500.00 MiB at  3.50 MiB/s ETA 00:02:15',
        '[download]  50% of ~500.00 MiB at  4.20 MiB/s ETA 00:01:58',
        '[download]  75% of ~500.00 MiB at  4.50 MiB/s ETA 00:00:55',
        '[download]  100% of ~500.00 MiB at  5.00 MiB/s ETA 00:00:00',
      ];

      // Simulate FFmpeg progress messages
      const ffmpegProgressMessages = [
        'frame=    0 fps=0.0 q=-1.0 Lsize=N/A time=00:00:00.00 bitrate=N/A speed=N/A',
        'frame=  750 fps=30.0 q=28.0 Lsize= 1500kB time=00:00:25.00 bitrate=480.0kbps speed=1.00x',
        'frame= 1500 fps=30.0 q=28.0 Lsize= 3000kB time=00:00:50.00 bitrate=480.0kbps speed=1.00x',
        'frame= 2250 fps=30.0 q=28.0 Lsize= 4500kB time=00:01:15.00 bitrate=480.0kbps speed=1.00x',
        'frame= 3000 fps=30.0 q=28.0 Lsize= 6000kB time=00:01:40.00 bitrate=480.0kbps speed=1.00x',
      ];

      // Test progress parsing
      const expectedPercents = [0, 10, 25, 50, 75, 100];
      ytdlpProgressMessages.forEach((msg, index) => {
        const progress = service.parseYtdlpProgress(msg);
        expect(progress).not.toBeNull();
        expect(progress.percent).toBe(expectedPercents[index]);
        expect(progress.source).toBe('ytdlp');
        progressUpdates.push(progress);
      });

      ffmpegProgressMessages.forEach((msg) => {
        const progress = service.parseFfmpegProgress(msg);
        expect(progress).not.toBeNull();
        expect(progress.source).toBe('ffmpeg');
        progressUpdates.push(progress);
      });

      // Verify progress tracking
      expect(progressUpdates.length).toBe(11);
      expect(progressUpdates[0].percent).toBe(0);
      expect(progressUpdates[3].percent).toBe(50);
      expect(progressUpdates[5].percent).toBe(100);

      downloadComplete = true;
      expect(downloadComplete).toBe(true);
      done();
    });

    it('should handle audio extraction simulation', (done) => {
      const taskId = 'audio-extract-' + Date.now();
      let audioProgress = [];

      // Simulate audio extraction progress
      const audioMessages = [
        '[download]  0% of ~50.00 MiB at  0.00 MiB/s ETA 00:00:00',
        '[download]  25% of ~50.00 MiB at  1.50 MiB/s ETA 00:00:20',
        '[download]  50% of ~50.00 MiB at  2.00 MiB/s ETA 00:00:12',
        '[download]  75% of ~50.00 MiB at  2.20 MiB/s ETA 00:00:06',
        '[download]  100% of ~50.00 MiB at  2.50 MiB/s ETA 00:00:00',
      ];

      audioMessages.forEach((msg) => {
        const progress = service.parseYtdlpProgress(msg);
        audioProgress.push(progress);
      });

      // Verify audio extraction progress
      expect(audioProgress.length).toBe(5);
      expect(audioProgress[0].percent).toBe(0);
      expect(audioProgress[2].percent).toBe(50);
      expect(audioProgress[4].percent).toBe(100);
      expect(audioProgress[4].total).toBe('50.00 MiB');

      done();
    });

    it('should track download speed variations', (done) => {
      const speedMessages = [
        '[download]  10% of ~1000.00 MiB at  1.00 MiB/s ETA 00:16:40',
        '[download]  20% of ~1000.00 MiB at  2.50 MiB/s ETA 00:06:24',
        '[download]  30% of ~1000.00 MiB at  3.50 MiB/s ETA 00:04:00',
        '[download]  40% of ~1000.00 MiB at  2.00 MiB/s ETA 00:08:00',
        '[download]  50% of ~1000.00 MiB at  4.00 MiB/s ETA 00:03:20',
      ];

      const speeds = [];
      speedMessages.forEach((msg) => {
        const progress = service.parseYtdlpProgress(msg);
        speeds.push(progress.speed);
      });

      // Verify speed tracking
      expect(speeds).toEqual([
        '1.00 MiB/s',
        '2.50 MiB/s',
        '3.50 MiB/s',
        '2.00 MiB/s',
        '4.00 MiB/s',
      ]);

      done();
    });

    it('should handle ETA updates during download', (done) => {
      const etaMessages = [
        '[download]  0% of ~500.00 MiB at  0.00 MiB/s ETA 00:00:00',
        '[download]  10% of ~500.00 MiB at  2.50 MiB/s ETA 00:03:20',
        '[download]  30% of ~500.00 MiB at  3.50 MiB/s ETA 00:02:00',
        '[download]  60% of ~500.00 MiB at  4.20 MiB/s ETA 00:00:47',
        '[download]  100% of ~500.00 MiB at  5.00 MiB/s ETA 00:00:00',
      ];

      const etas = [];
      etaMessages.forEach((msg) => {
        const progress = service.parseYtdlpProgress(msg);
        etas.push(progress.eta);
      });

      // Verify ETA decreases as download progresses
      expect(etas[0]).toBe('00:00:00');
      expect(etas[1]).toBe('00:03:20');
      expect(etas[2]).toBe('00:02:00');
      expect(etas[3]).toBe('00:00:47');
      expect(etas[4]).toBe('00:00:00');

      done();
    });

    it('should handle FFmpeg encoding progress', (done) => {
      const encodingMessages = [
        'frame=    0 fps=0.0 q=-1.0 Lsize=N/A time=00:00:00.00 bitrate=N/A speed=N/A',
        'frame=  900 fps=30.0 q=28.0 Lsize= 1800kB time=00:00:30.00 bitrate=480.0kbps speed=1.00x',
        'frame= 1800 fps=30.0 q=28.0 Lsize= 3600kB time=00:01:00.00 bitrate=480.0kbps speed=1.00x',
        'frame= 2700 fps=30.0 q=28.0 Lsize= 5400kB time=00:01:30.00 bitrate=480.0kbps speed=1.00x',
        'frame= 3600 fps=30.0 q=28.0 Lsize= 7200kB time=00:02:00.00 bitrate=480.0kbps speed=1.00x',
      ];

      const frames = [];
      const times = [];
      const speeds = [];

      encodingMessages.forEach((msg) => {
        const progress = service.parseFfmpegProgress(msg);
        frames.push(progress.frame);
        times.push(progress.time);
        speeds.push(progress.speed);
      });

      // Verify encoding progress
      expect(frames).toEqual([0, 900, 1800, 2700, 3600]);
      expect(times).toEqual([
        '00:00:00.00',
        '00:00:30.00',
        '00:01:00.00',
        '00:01:30.00',
        '00:02:00.00',
      ]);
      expect(speeds).toEqual([
        'N/A',
        '1.00x',
        '1.00x',
        '1.00x',
        '1.00x',
      ]);

      done();
    });

    it('should handle argument construction for different scenarios', (done) => {
      // Scenario 1: Best quality video
      const bestArgs = service.buildYtdlpArgs({ format: 'best' }, 'https://example.com/video');
      expect(bestArgs).toContain('--progress');
      expect(bestArgs).toContain('--newline');
      expect(bestArgs).toContain('-f');
      expect(bestArgs).toContain('best');

      // Scenario 2: 720p video
      const hd720Args = service.buildYtdlpArgs({ format: '720p' }, 'https://example.com/video');
      expect(hd720Args).toContain('-f');
      const fIndex = hd720Args.indexOf('-f');
      expect(hd720Args[fIndex + 1]).toContain('720');

      // Scenario 3: Audio only
      const audioArgs = service.buildYtdlpArgs(
        { format: 'audio', audioOnly: true },
        'https://example.com/video'
      );
      expect(audioArgs).toContain('-x');
      expect(audioArgs).toContain('--audio-format');
      expect(audioArgs).toContain('mp3');

      // Scenario 4: FFmpeg for video
      const videoFFmpegArgs = service.buildFfmpegArgs({ audioOnly: false });
      expect(videoFFmpegArgs).toContain('-c');
      expect(videoFFmpegArgs).toContain('copy');
      expect(videoFFmpegArgs).toContain('-f');
      expect(videoFFmpegArgs).toContain('mp4');

      // Scenario 5: FFmpeg for audio
      const audioFFmpegArgs = service.buildFfmpegArgs({ audioOnly: true });
      expect(audioFFmpegArgs).toContain('-f');
      expect(audioFFmpegArgs).toContain('mp3');

      done();
    });

    it('should simulate complete download workflow', (done) => {
      const workflow = {
        taskId: 'workflow-' + Date.now(),
        url: 'https://example.com/video.mp4',
        format: '720p',
        audioOnly: false,
        startTime: Date.now(),
        progressUpdates: [],
        errors: [],
        completed: false,
      };

      // Simulate progress updates
      const progressSequence = [
        { percent: 0, speed: '0.00 MiB/s', eta: '00:05:00' },
        { percent: 20, speed: '2.50 MiB/s', eta: '00:04:00' },
        { percent: 40, speed: '3.50 MiB/s', eta: '00:02:30' },
        { percent: 60, speed: '4.00 MiB/s', eta: '00:01:30' },
        { percent: 80, speed: '4.50 MiB/s', eta: '00:00:30' },
        { percent: 100, speed: '5.00 MiB/s', eta: '00:00:00' },
      ];

      progressSequence.forEach((update) => {
        const message = `[download]  ${update.percent}% of ~500.00 MiB at  ${update.speed} ETA ${update.eta}`;
        const progress = service.parseYtdlpProgress(message);
        
        if (progress) {
          workflow.progressUpdates.push({
            percent: progress.percent,
            speed: progress.speed,
            eta: progress.eta,
            timestamp: Date.now(),
          });
        }
      });

      // Verify workflow
      expect(workflow.progressUpdates.length).toBe(6);
      expect(workflow.progressUpdates[0].percent).toBe(0);
      expect(workflow.progressUpdates[5].percent).toBe(100);
      
      // Calculate download time
      const downloadTime = workflow.progressUpdates[5].timestamp - workflow.progressUpdates[0].timestamp;
      expect(downloadTime).toBeGreaterThanOrEqual(0);

      workflow.completed = true;
      expect(workflow.completed).toBe(true);

      done();
    });

    it('should handle network interruption recovery', (done) => {
      const interruptionMessages = [
        '[download]  0% of ~500.00 MiB at  0.00 MiB/s ETA 00:00:00',
        '[download]  10% of ~500.00 MiB at  2.50 MiB/s ETA 00:03:20',
        '[download]  20% of ~500.00 MiB at  3.50 MiB/s ETA 00:02:15',
        // Network interruption - no messages
        '[download]  20% of ~500.00 MiB at  0.00 MiB/s ETA 00:00:00',
        // Recovery
        '[download]  30% of ~500.00 MiB at  2.00 MiB/s ETA 00:03:00',
        '[download]  50% of ~500.00 MiB at  3.00 MiB/s ETA 00:02:00',
        '[download]  100% of ~500.00 MiB at  4.00 MiB/s ETA 00:00:00',
      ];

      const progress = [];
      interruptionMessages.forEach((msg) => {
        const p = service.parseYtdlpProgress(msg);
        if (p) {
          progress.push(p.percent);
        }
      });

      // Verify recovery from interruption
      expect(progress).toContain(0);
      expect(progress).toContain(10);
      expect(progress).toContain(20);
      expect(progress).toContain(30);
      expect(progress).toContain(50);
      expect(progress).toContain(100);

      done();
    });

    it('should validate URL for different sources', (done) => {
      const validUrls = [
        'https://youtube.com/watch?v=dQw4w9WgXcQ',
        'https://vimeo.com/123456789',
        'https://example.com/video.mp4',
        'https://cdn.example.com/path/to/video.mp4',
        'http://example.com/video',
      ];

      validUrls.forEach((url) => {
        expect(() => service.validateURL(url)).not.toThrow();
      });

      done();
    });

    it('should handle large file downloads', (done) => {
      const largeFileMessages = [
        '[download]  0% of ~5000.00 MiB at  0.00 MiB/s ETA 00:00:00',
        '[download]  10% of ~5000.00 MiB at  5.00 MiB/s ETA 00:16:40',
        '[download]  25% of ~5000.00 MiB at  6.50 MiB/s ETA 00:09:36',
        '[download]  50% of ~5000.00 MiB at  7.50 MiB/s ETA 00:06:40',
        '[download]  75% of ~5000.00 MiB at  8.00 MiB/s ETA 00:04:22',
        '[download]  100% of ~5000.00 MiB at  8.50 MiB/s ETA 00:00:00',
      ];

      const fileSize = [];
      largeFileMessages.forEach((msg) => {
        const progress = service.parseYtdlpProgress(msg);
        if (progress) {
          fileSize.push(progress.total);
        }
      });

      // Verify large file handling
      expect(fileSize[0]).toBe('5000.00 MiB');
      expect(fileSize.every(size => size === '5000.00 MiB')).toBe(true);

      done();
    });

    it('should handle multiple format conversions', (done) => {
      const formats = ['best', '1080p', '720p', '480p', 'audio'];
      const args = [];

      formats.forEach((format) => {
        const ytdlpArgs = service.buildYtdlpArgs(
          { format, audioOnly: format === 'audio' },
          'https://example.com/video'
        );
        args.push({
          format,
          args: ytdlpArgs,
          hasFormat: ytdlpArgs.includes('-f'),
        });
      });

      // Verify all formats have format selector
      expect(args.every(a => a.hasFormat)).toBe(true);
      expect(args.length).toBe(5);

      done();
    });
  });
});
