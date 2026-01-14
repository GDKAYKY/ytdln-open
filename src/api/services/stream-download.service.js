/**
 * Stream Download Service - Synchronous streaming with yt-dlp and FFmpeg
 * 
 * Architecture: yt-dlp stdout → FFmpeg stdin → HTTP Response
 * Provides synchronous stream initialization, progress tracking, and lifecycle management
 */

const { spawn } = require('child_process');
const EventEmitter = require('events');

/**
 * Custom error classes for stream operations
 */
class StreamDownloadError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'StreamDownloadError';
    this.code = code;
  }
}

class InvalidURLError extends StreamDownloadError {
  constructor(message = 'Invalid or missing URL') {
    super(message, 'INVALID_URL');
    this.name = 'InvalidURLError';
  }
}

class ProcessSpawnError extends StreamDownloadError {
  constructor(message = 'Failed to spawn process') {
    super(message, 'PROCESS_SPAWN_ERROR');
    this.name = 'ProcessSpawnError';
  }
}

class TimeoutError extends StreamDownloadError {
  constructor(message = 'Operation timed out') {
    super(message, 'TIMEOUT_ERROR');
    this.name = 'TimeoutError';
  }
}

/**
 * Error codes for stream operations
 */
const ERROR_CODES = {
  INVALID_URL: 'INVALID_URL',
  PROCESS_SPAWN_ERROR: 'PROCESS_SPAWN_ERROR',
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  STREAM_NOT_FOUND: 'STREAM_NOT_FOUND',
  INVALID_FORMAT: 'INVALID_FORMAT',
  PIPE_ERROR: 'PIPE_ERROR',
};

/**
 * Stream state object
 * @typedef {Object} StreamState
 * @property {string} taskId - Unique identifier for the stream
 * @property {string} url - Source URL
 * @property {string} format - Format selection (best, 720p, audio, etc.)
 * @property {boolean} audioOnly - Extract audio only
 * @property {string} status - Current status (starting, streaming, stopped, error)
 * @property {ChildProcess} ytdlpProcess - yt-dlp process object
 * @property {ChildProcess} ffmpegProcess - FFmpeg process object
 * @property {number} startTime - Timestamp when stream started
 * @property {number} endTime - Timestamp when stream ended
 * @property {Object} progress - Current progress information
 * @property {Error|null} error - Error object if failed
 * @property {Object} callbacks - Callback functions
 */

/**
 * Progress information object
 * @typedef {Object} ProgressInfo
 * @property {number} percent - Download/encoding progress 0-100
 * @property {string} eta - Estimated time remaining
 * @property {string} speed - Current speed (MB/s, fps, etc.)
 * @property {string} total - Total size or duration
 * @property {string} source - Which process reported this (ytdlp or ffmpeg)
 */

/**
 * StreamDownloadService - Manages synchronous stream downloads with yt-dlp and FFmpeg
 */
class StreamDownloadService extends EventEmitter {
  /**
   * Initialize the service with binary paths
   * @param {Object} binaries - { ytdlp, ffmpeg, ffprobe }
   */
  constructor(binaries = {}) {
    super();
    this.binaries = {
      ytdlp: binaries.ytdlp || 'yt-dlp',
      ffmpeg: binaries.ffmpeg || 'ffmpeg',
      ffprobe: binaries.ffprobe || 'ffprobe',
    };
    
    // Map of taskId → StreamState
    this.streams = new Map();
    
    // Configuration
    this.config = {
      processSpawnTimeout: 5000, // 5 seconds
      processKillTimeout: 5000,  // 5 seconds
    };
  }

  /**
   * Validate URL format
   * @param {string} url - URL to validate
   * @returns {boolean} True if valid
   * @throws {InvalidURLError} If URL is invalid
   */
  validateURL(url) {
    if (!url || typeof url !== 'string' || url.trim() === '') {
      throw new InvalidURLError('URL is required and must be a non-empty string');
    }

    // Basic URL validation
    try {
      new URL(url);
      return true;
    } catch (error) {
      throw new InvalidURLError(`Invalid URL format: ${url}`);
    }
  }

  /**
   * Build yt-dlp command-line arguments
   * @param {Object} options - { format, audioOnly }
   * @param {string} url - Target URL
   * @returns {string[]} Array of arguments
   */
  buildYtdlpArgs(options = {}, url) {
    const args = [
      '--progress',
      '--newline',
      '-o', '-', // Output to stdout
    ];

    // Handle format selection
    const format = options.format || 'best';
    
    if (format === 'audio') {
      args.push('-f', 'bestaudio');
    } else if (format === 'best') {
      args.push('-f', 'best');
    } else if (format.endsWith('p')) {
      // Handle resolution like "720p", "1080p"
      const height = format.replace('p', '');
      args.push('-f', `best[height<=${height}]`);
    } else {
      args.push('-f', format);
    }

    // Audio-only extraction
    if (options.audioOnly) {
      args.push('-x', '--audio-format', 'mp3');
    }

    // Append URL as final argument
    args.push(url);

    return args;
  }

  /**
   * Build FFmpeg command-line arguments
   * @param {Object} options - { audioOnly, format }
   * @returns {string[]} Array of arguments
   */
  buildFfmpegArgs(options = {}) {
    const args = [
      '-i', '-',           // Input from stdin
      '-c', 'copy',        // Copy codecs without re-encoding
      '-f', options.audioOnly ? 'mp3' : 'mp4', // Output format
      '-',                 // Output to stdout
    ];

    return args;
  }

  /**
   * Parse yt-dlp progress message
   * @param {string} message - Raw stderr message from yt-dlp
   * @returns {ProgressInfo|null} Parsed progress or null if unparseable
   */
  parseYtdlpProgress(message) {
    try {
      if (!message || !message.includes('[download]')) {
        return null;
      }

      // Example: [download]  75.5% of ~150.25 MiB at  2.50 MiB/s ETA 00:01:30
      const percentMatch = message.match(/(\d+\.?\d*?)%/);
      const speedMatch = message.match(/at\s+([\d.]+\s+\w+\/s)/);
      const etaMatch = message.match(/ETA\s+(\d{2}:\d{2}:\d{2})/);
      const totalMatch = message.match(/of\s+~?([\d.]+\s+\w+)/);

      if (!percentMatch) {
        return null;
      }

      return {
        percent: parseFloat(percentMatch[1]),
        speed: speedMatch ? speedMatch[1] : 'unknown',
        eta: etaMatch ? etaMatch[1] : 'unknown',
        total: totalMatch ? totalMatch[1] : 'unknown',
        source: 'ytdlp',
      };
    } catch (error) {
      // Return null for unparseable messages without crashing
      return null;
    }
  }

  /**
   * Parse FFmpeg progress message
   * @param {string} message - Raw stderr message from FFmpeg
   * @returns {ProgressInfo|null} Parsed progress or null if unparseable
   */
  parseFfmpegProgress(message) {
    try {
      if (!message || !message.includes('frame=')) {
        return null;
      }

      // Example: frame=  150 fps=0.0 q=-1.0 Lsize=N/A time=00:00:06.25 bitrate=N/A speed=N/A
      const frameMatch = message.match(/frame=\s*(\d+)/);
      const fpsMatch = message.match(/fps=\s*([\d.]+)/);
      const qMatch = message.match(/q=\s*([\d.-]+)/);
      const sizeMatch = message.match(/Lsize=\s*(\S+)/);
      const timeMatch = message.match(/time=\s*(\d{2}:\d{2}:\d{2}\.\d{2})/);
      const bitrateMatch = message.match(/bitrate=\s*(\S+)/);
      const speedMatch = message.match(/speed=\s*(\S+)/);

      if (!frameMatch) {
        return null;
      }

      return {
        frame: parseInt(frameMatch[1]),
        fps: fpsMatch ? parseFloat(fpsMatch[1]) : 0,
        q: qMatch ? parseFloat(qMatch[1]) : -1,
        size: sizeMatch ? sizeMatch[1] : 'N/A',
        time: timeMatch ? timeMatch[1] : '00:00:00.00',
        bitrate: bitrateMatch ? bitrateMatch[1] : 'N/A',
        speed: speedMatch ? speedMatch[1] : 'N/A',
        source: 'ffmpeg',
      };
    } catch (error) {
      // Return null for unparseable messages without crashing
      return null;
    }
  }

  /**
   * Get file size from yt-dlp metadata
   * @param {string} url - Source URL
   * @param {Object} options - { format, audioOnly }
   * @returns {Promise<number>} File size in bytes
   */
  async getFileSize(url, options = {}) {
    return new Promise((resolve, reject) => {
      const args = [
        '--dump-json',
        '-f', options.format === 'audio' ? 'bestaudio' : (options.format || 'best'),
        url,
      ];

      const process = spawn(this.binaries.ytdlp, args, {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let output = '';
      process.stdout.on('data', (data) => {
        output += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          try {
            const json = JSON.parse(output);
            const filesize = json.filesize || json.filesize_approx || 0;
            resolve(filesize);
          } catch (error) {
            resolve(0); // Return 0 if can't parse
          }
        } else {
          resolve(0); // Return 0 on error
        }
      });

      process.on('error', () => {
        resolve(0); // Return 0 on error
      });
    });
  }

  /**
   * Start a synchronous stream download
   * @param {string} taskId - Unique identifier for this stream
   * @param {string} url - Source URL
   * @param {Object} options - { format, audioOnly }
   * @param {Object} callbacks - { onProgress, onError, onComplete }
   * @returns {ReadableStream} FFmpeg stdout stream
   * @throws {InvalidURLError|ProcessSpawnError|TimeoutError}
   */
  async startStream(taskId, url, options = {}, callbacks = {}) {
    try {
      // Validate URL
      this.validateURL(url);

      // Build arguments
      const ytdlpArgs = this.buildYtdlpArgs(options, url);
      const ffmpegArgs = this.buildFfmpegArgs(options);

      // Create a timeout promise for process spawn
      let spawnTimeout;
      const spawnTimeoutPromise = new Promise((_, reject) => {
        spawnTimeout = setTimeout(() => {
          reject(new TimeoutError('Process spawn timeout exceeded'));
        }, this.config.processSpawnTimeout);
      });

      // Spawn yt-dlp process
      let ytdlpProcess;
      try {
        ytdlpProcess = spawn(this.binaries.ytdlp, ytdlpArgs, {
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      } catch (error) {
        clearTimeout(spawnTimeout);
        throw new ProcessSpawnError(`Failed to spawn yt-dlp: ${error.message}`);
      }

      // Spawn FFmpeg process
      let ffmpegProcess;
      try {
        ffmpegProcess = spawn(this.binaries.ffmpeg, ffmpegArgs, {
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        clearTimeout(spawnTimeout);
      } catch (error) {
        clearTimeout(spawnTimeout);
        ytdlpProcess.kill();
        throw new ProcessSpawnError(`Failed to spawn FFmpeg: ${error.message}`);
      }

      // Establish pipe: yt-dlp stdout → FFmpeg stdin
      try {
        ytdlpProcess.stdout.pipe(ffmpegProcess.stdin);
      } catch (error) {
        ytdlpProcess.kill();
        ffmpegProcess.kill();
        throw new StreamDownloadError(`Failed to establish pipe: ${error.message}`, 'PIPE_ERROR');
      }

      // Create stream state
      const streamState = {
        taskId,
        url,
        format: options.format || 'best',
        audioOnly: options.audioOnly || false,
        status: 'streaming',
        ytdlpProcess,
        ffmpegProcess,
        startTime: Date.now(),
        endTime: null,
        progress: {
          percent: 0,
          eta: 'unknown',
          speed: 'unknown',
          total: 'unknown',
        },
        error: null,
        callbacks,
      };

      // Store stream state
      this.streams.set(taskId, streamState);

      // Setup stderr monitoring for yt-dlp
      ytdlpProcess.stderr.on('data', (data) => {
        const message = data.toString();
        const progress = this.parseYtdlpProgress(message);
        
        if (progress) {
          streamState.progress = { ...streamState.progress, ...progress };
          if (callbacks.onProgress) {
            callbacks.onProgress(streamState.progress);
          }
          this.emit('progress', { taskId, progress: streamState.progress });
        }
      });

      // Setup stderr monitoring for FFmpeg
      ffmpegProcess.stderr.on('data', (data) => {
        const message = data.toString();
        const progress = this.parseFfmpegProgress(message);
        
        if (progress) {
          streamState.progress = { ...streamState.progress, ...progress };
          if (callbacks.onProgress) {
            callbacks.onProgress(streamState.progress);
          }
          this.emit('progress', { taskId, progress: streamState.progress });
        }
      });

      // Setup error handlers
      ytdlpProcess.on('error', (error) => {
        streamState.error = error;
        streamState.status = 'error';
        if (callbacks.onError) {
          callbacks.onError(error);
        }
        this.emit('error', { taskId, error });
        this.streams.delete(taskId);
      });

      ffmpegProcess.on('error', (error) => {
        streamState.error = error;
        streamState.status = 'error';
        if (callbacks.onError) {
          callbacks.onError(error);
        }
        this.emit('error', { taskId, error });
        this.streams.delete(taskId);
      });

      // Setup exit handlers
      ytdlpProcess.on('close', (code) => {
        if (code !== 0 && code !== null) {
          const error = new StreamDownloadError(`yt-dlp exited with code ${code}`, 'PROCESS_EXIT_ERROR');
          streamState.error = error;
          streamState.status = 'error';
          if (callbacks.onError) {
            callbacks.onError(error);
          }
          this.emit('error', { taskId, error });
        }
      });

      ffmpegProcess.on('close', (code) => {
        streamState.endTime = Date.now();
        if (code !== 0 && code !== null) {
          const error = new StreamDownloadError(`FFmpeg exited with code ${code}`, 'PROCESS_EXIT_ERROR');
          streamState.error = error;
          streamState.status = 'error';
          if (callbacks.onError) {
            callbacks.onError(error);
          }
          this.emit('error', { taskId, error });
        } else {
          streamState.status = 'completed';
          if (callbacks.onComplete) {
            callbacks.onComplete();
          }
          this.emit('complete', { taskId });
        }
        this.streams.delete(taskId);
      });

      // Return FFmpeg stdout for piping to HTTP response
      return ffmpegProcess.stdout;

    } catch (error) {
      // Clean up on error
      this.streams.delete(taskId);
      throw error;
    }
  }

  /**
   * Stop a stream synchronously
   * @param {string} taskId - Stream identifier
   * @throws {Error} If stream not found or cleanup fails
   */
  stopStream(taskId) {
    const streamState = this.streams.get(taskId);
    
    if (!streamState) {
      throw new StreamDownloadError(`Stream ${taskId} not found`, 'STREAM_NOT_FOUND');
    }

    try {
      // Kill yt-dlp process
      if (streamState.ytdlpProcess && !streamState.ytdlpProcess.killed) {
        streamState.ytdlpProcess.kill('SIGTERM');
        
        // Force kill after timeout
        setTimeout(() => {
          if (streamState.ytdlpProcess && !streamState.ytdlpProcess.killed) {
            streamState.ytdlpProcess.kill('SIGKILL');
          }
        }, this.config.processKillTimeout);
      }

      // Kill FFmpeg process
      if (streamState.ffmpegProcess && !streamState.ffmpegProcess.killed) {
        streamState.ffmpegProcess.kill('SIGTERM');
        
        // Force kill after timeout
        setTimeout(() => {
          if (streamState.ffmpegProcess && !streamState.ffmpegProcess.killed) {
            streamState.ffmpegProcess.kill('SIGKILL');
          }
        }, this.config.processKillTimeout);
      }

      streamState.status = 'stopped';
      streamState.endTime = Date.now();
      
      // Remove from map
      this.streams.delete(taskId);
      
      this.emit('cleanup', { taskId });
    } catch (error) {
      throw new StreamDownloadError(`Failed to stop stream: ${error.message}`, 'STOP_ERROR');
    }
  }

  /**
   * Get stream status
   * @param {string} taskId - Stream identifier
   * @returns {Object|null} Stream status or null if not found
   */
  getStreamStatus(taskId) {
    const streamState = this.streams.get(taskId);
    
    if (!streamState) {
      return null;
    }

    return {
      taskId,
      status: streamState.status,
      uptime: Date.now() - streamState.startTime,
      ytdlpAlive: streamState.ytdlpProcess && !streamState.ytdlpProcess.killed,
      ffmpegAlive: streamState.ffmpegProcess && !streamState.ffmpegProcess.killed,
      progress: streamState.progress,
      error: streamState.error ? streamState.error.message : null,
    };
  }
}

module.exports = {
  StreamDownloadService,
  StreamDownloadError,
  InvalidURLError,
  ProcessSpawnError,
  TimeoutError,
  ERROR_CODES,
};
