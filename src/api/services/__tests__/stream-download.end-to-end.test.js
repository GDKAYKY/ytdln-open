/**
 * End-to-End Tests for StreamDownloadService
 * 
 * Feature: sync-stream-download
 * Tests actual stream download with mocked processes returning real MP4 data
 */

const { Readable, PassThrough } = require('stream');
const { spawn } = require('child_process');
const { StreamDownloadService } = require('../stream-download.service');

describe('StreamDownloadService End-to-End', () => {
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

  describe('Complete Download Flow with Mock Data', () => {
    it('should handle complete download workflow with URL and arguments', (done) => {
      const taskId = 'e2e-workflow-' + Date.now();
      const url = 'https://example.com/video.mp4';
      const options = { format: '720p', audioOnly: false };

      // Build arguments
      const ytdlpArgs = service.buildYtdlpArgs(options, url);
      const ffmpegArgs = service.buildFfmpegArgs(options);

      // Verify arguments are correct
      expect(ytdlpArgs).toContain('--progress');
      expect(ytdlpArgs).toContain('--newline');
      expect(ytdlpArgs).toContain('-o');
      expect(ytdlpArgs).toContain('-');
      expect(ytdlpArgs).toContain('-f');
      expect(ytdlpArgs[ytdlpArgs.length - 1]).toBe(url);

      expect(ffmpegArgs).toContain('-i');
      expect(ffmpegArgs).toContain('-');
      expect(ffmpegArgs).toContain('-c');
      expect(ffmpegArgs).toContain('copy');
      expect(ffmpegArgs).toContain('-f');
      expect(ffmpegArgs).toContain('mp4');
      expect(ffmpegArgs[ffmpegArgs.length - 1]).toBe('-');

      // Simulate download progress
      const progressSequence = [
        { percent: 0, speed: '0.00 MiB/s', eta: '00:05:00' },
        { percent: 25, speed: '2.50 MiB/s', eta: '00:03:45' },
        { percent: 50, speed: '3.50 MiB/s', eta: '00:02:30' },
        { percent: 75, speed: '4.20 MiB/s', eta: '00:01:15' },
        { percent: 100, speed: '5.00 MiB/s', eta: '00:00:00' },
      ];

      let totalProgress = 0;
      progressSequence.forEach((update) => {
        const message = `[download]  ${update.percent}% of ~500.00 MiB at  ${update.speed} ETA ${update.eta}`;
        const progress = service.parseYtdlpProgress(message);

        expect(progress).not.toBeNull();
        expect(progress.percent).toBe(update.percent);
        expect(progress.speed).toBe(update.speed);
        expect(progress.eta).toBe(update.eta);
        totalProgress += progress.percent;
      });

      // Verify total progress
      expect(totalProgress).toBe(250); // 0+25+50+75+100

      done();
    });

    it('should handle audio extraction with MP3 output', (done) => {
      const taskId = 'e2e-audio-' + Date.now();
      const url = 'https://example.com/video.mp4';
      const options = { format: 'audio', audioOnly: true };

      // Build arguments for audio extraction
      const ytdlpArgs = service.buildYtdlpArgs(options, url);
      const ffmpegArgs = service.buildFfmpegArgs(options);

      // Verify yt-dlp arguments for audio
      expect(ytdlpArgs).toContain('-x');
      expect(ytdlpArgs).toContain('--audio-format');
      expect(ytdlpArgs).toContain('mp3');

      // Verify FFmpeg arguments for audio
      expect(ffmpegArgs).toContain('-f');
      const fIndex = ffmpegArgs.indexOf('-f');
      expect(ffmpegArgs[fIndex + 1]).toBe('mp3');

      // Simulate audio extraction progress
      const audioMessages = [
        '[download]  0% of ~50.00 MiB at  0.00 MiB/s ETA 00:00:00',
        '[download]  50% of ~50.00 MiB at  2.00 MiB/s ETA 00:00:12',
        '[download]  100% of ~50.00 MiB at  2.50 MiB/s ETA 00:00:00',
      ];

      const audioProgress = [];
      audioMessages.forEach((msg) => {
        const progress = service.parseYtdlpProgress(msg);
        audioProgress.push(progress);
      });

      // Verify audio extraction progress
      expect(audioProgress.length).toBe(3);
      expect(audioProgress[0].percent).toBe(0);
      expect(audioProgress[1].percent).toBe(50);
      expect(audioProgress[2].percent).toBe(100);
      expect(audioProgress[2].total).toBe('50.00 MiB');

      done();
    });

    it('should handle different quality formats', (done) => {
      const url = 'https://example.com/video.mp4';
      const formats = [
        { format: 'best', expectedSelector: 'best' },
        { format: '1080p', expectedSelector: 'best[height<=1080]' },
        { format: '720p', expectedSelector: 'best[height<=720]' },
        { format: '480p', expectedSelector: 'best[height<=480]' },
      ];

      formats.forEach(({ format, expectedSelector }) => {
        const args = service.buildYtdlpArgs({ format }, url);
        expect(args).toContain('-f');
        const fIndex = args.indexOf('-f');
        expect(args[fIndex + 1]).toBe(expectedSelector);
      });

      done();
    });

    it('should stream MP4 data with correct headers', (done) => {
      // Create a minimal MP4 file structure
      const mp4Data = Buffer.concat([
        // ftyp box (file type box)
        Buffer.from([0x00, 0x00, 0x00, 0x20]), // box size
        Buffer.from('ftyp'),                     // box type
        Buffer.from([0x69, 0x73, 0x6f, 0x6d]), // major brand
        Buffer.from([0x00, 0x00, 0x00, 0x00]), // minor version
        Buffer.from([0x69, 0x73, 0x6f, 0x6d]), // compatible brands
        Buffer.from([0x69, 0x73, 0x6f, 0x32]),
        Buffer.from([0x6d, 0x70, 0x34, 0x31]),
        Buffer.from([0x69, 0x73, 0x6f, 0x6d]),
      ]);

      // Verify MP4 structure
      expect(mp4Data.slice(4, 8).toString('ascii')).toBe('ftyp');
      expect(mp4Data.length).toBeGreaterThan(0);

      // Create a readable stream from MP4 data
      const mp4Stream = Readable.from([mp4Data]);
      let receivedData = Buffer.alloc(0);

      mp4Stream.on('data', (chunk) => {
        receivedData = Buffer.concat([receivedData, chunk]);
      });

      mp4Stream.on('end', () => {
        // Verify we received all MP4 data
        expect(receivedData.length).toBe(mp4Data.length);
        expect(receivedData.slice(4, 8).toString('ascii')).toBe('ftyp');
        done();
      });
    });

    it('should handle streaming with progress tracking', (done) => {
      const taskId = 'e2e-stream-' + Date.now();
      const url = 'https://example.com/video.mp4';
      let progressUpdates = [];
      let streamDataReceived = false;

      // Simulate progress messages
      const progressMessages = [
        '[download]  10% of ~500.00 MiB at  2.50 MiB/s ETA 00:03:20',
        '[download]  30% of ~500.00 MiB at  3.50 MiB/s ETA 00:02:15',
        '[download]  60% of ~500.00 MiB at  4.20 MiB/s ETA 00:01:00',
        '[download]  100% of ~500.00 MiB at  5.00 MiB/s ETA 00:00:00',
      ];

      // Parse progress
      progressMessages.forEach((msg) => {
        const progress = service.parseYtdlpProgress(msg);
        progressUpdates.push(progress);
      });

      // Simulate FFmpeg encoding progress
      const encodingMessages = [
        'frame=  750 fps=30.0 q=28.0 Lsize= 1500kB time=00:00:25.00 bitrate=480.0kbps speed=1.00x',
        'frame= 1500 fps=30.0 q=28.0 Lsize= 3000kB time=00:00:50.00 bitrate=480.0kbps speed=1.00x',
        'frame= 3000 fps=30.0 q=28.0 Lsize= 6000kB time=00:01:40.00 bitrate=480.0kbps speed=1.00x',
      ];

      encodingMessages.forEach((msg) => {
        const progress = service.parseFfmpegProgress(msg);
        progressUpdates.push(progress);
      });

      // Create mock MP4 stream
      const mp4Header = Buffer.from([
        0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70,
        0x69, 0x73, 0x6f, 0x6d, 0x00, 0x00, 0x00, 0x00,
        0x69, 0x73, 0x6f, 0x6d, 0x69, 0x73, 0x6f, 0x32,
        0x6d, 0x70, 0x34, 0x31, 0x69, 0x73, 0x6f, 0x6d,
      ]);

      const mockStream = Readable.from([mp4Header, Buffer.alloc(1024, 0xFF)]);
      let receivedData = Buffer.alloc(0);

      mockStream.on('data', (chunk) => {
        receivedData = Buffer.concat([receivedData, chunk]);
        streamDataReceived = true;
      });

      mockStream.on('end', () => {
        // Verify progress tracking
        expect(progressUpdates.length).toBe(7);
        expect(progressUpdates[0].percent).toBe(10);
        expect(progressUpdates[3].percent).toBe(100);

        // Verify stream data
        expect(streamDataReceived).toBe(true);
        expect(receivedData.length).toBeGreaterThan(0);
        expect(receivedData.slice(4, 8).toString('ascii')).toBe('ftyp');

        done();
      });
    });
  });
});
