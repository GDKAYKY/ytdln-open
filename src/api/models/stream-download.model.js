/**
 * Stream Download Data Models
 * 
 * Defines the data structures used throughout the stream download system
 */

/**
 * StreamState - Represents the state of an active stream
 * 
 * @typedef {Object} StreamState
 * @property {string} taskId - Unique identifier for this stream session
 * @property {string} url - Source URL being downloaded
 * @property {string} format - Format selection (best, 720p, audio, etc.)
 * @property {boolean} audioOnly - Whether to extract audio only
 * @property {string} status - Current status: "starting", "streaming", "stopped", "error", "completed"
 * @property {ChildProcess} ytdlpProcess - yt-dlp child process object
 * @property {ChildProcess} ffmpegProcess - FFmpeg child process object
 * @property {number} startTime - Timestamp when stream started (milliseconds)
 * @property {number|null} endTime - Timestamp when stream ended (milliseconds)
 * @property {ProgressInfo} progress - Current progress information
 * @property {Error|null} error - Error object if stream failed
 * @property {Object} callbacks - Callback functions for events
 * @property {Function} callbacks.onProgress - Called when progress updates
 * @property {Function} callbacks.onError - Called when error occurs
 * @property {Function} callbacks.onComplete - Called when stream completes
 */

/**
 * ProgressInfo - Real-time progress information from yt-dlp or FFmpeg
 * 
 * @typedef {Object} ProgressInfo
 * @property {number} percent - Download/encoding progress as percentage (0-100)
 * @property {string} eta - Estimated time remaining (format: HH:MM:SS)
 * @property {string} speed - Current download/encoding speed (e.g., "2.5MB/s", "30fps")
 * @property {string} total - Total size or duration (e.g., "150MB", "00:05:30")
 * @property {string} source - Which process reported this: "ytdlp" or "ffmpeg"
 * @property {number} [frame] - FFmpeg: frame number
 * @property {number} [fps] - FFmpeg: frames per second
 * @property {number} [q] - FFmpeg: quantizer value
 * @property {string} [size] - FFmpeg: output size
 * @property {string} [time] - FFmpeg: current time
 * @property {string} [bitrate] - FFmpeg: current bitrate
 */

/**
 * StreamOptions - Options for stream creation
 * 
 * @typedef {Object} StreamOptions
 * @property {string} [format="best"] - Format selection:
 *   - "best": highest quality available
 *   - "720p", "1080p", etc.: specific resolution
 *   - "audio": audio only
 *   - custom yt-dlp format selector
 * @property {boolean} [audioOnly=false] - Extract audio only (overrides format)
 */

/**
 * StreamStatus - Status information for a stream
 * 
 * @typedef {Object} StreamStatus
 * @property {string} taskId - Stream identifier
 * @property {string} status - Current status
 * @property {number} uptime - How long stream has been running (milliseconds)
 * @property {boolean} ytdlpAlive - Whether yt-dlp process is still running
 * @property {boolean} ffmpegAlive - Whether FFmpeg process is still running
 * @property {ProgressInfo} progress - Current progress information
 * @property {string|null} error - Error message if stream failed
 */

/**
 * StreamResponse - HTTP response for stream creation
 * 
 * @typedef {Object} StreamResponse
 * @property {string} taskId - Unique stream identifier
 * @property {string} status - Stream status
 * @property {string} streamUrl - URL to fetch the stream from
 * @property {string} statusUrl - URL to check stream status
 * @property {string} [message] - Optional message
 */

/**
 * Create a new StreamState object
 * 
 * @param {string} taskId - Unique identifier
 * @param {string} url - Source URL
 * @param {StreamOptions} options - Stream options
 * @param {Object} processes - { ytdlpProcess, ffmpegProcess }
 * @param {Object} callbacks - Event callbacks
 * @returns {StreamState} New stream state object
 */
function createStreamState(taskId, url, options, processes, callbacks) {
  return {
    taskId,
    url,
    format: options.format || 'best',
    audioOnly: options.audioOnly || false,
    status: 'starting',
    ytdlpProcess: processes.ytdlpProcess,
    ffmpegProcess: processes.ffmpegProcess,
    startTime: Date.now(),
    endTime: null,
    progress: {
      percent: 0,
      eta: 'unknown',
      speed: 'unknown',
      total: 'unknown',
      source: 'unknown',
    },
    error: null,
    callbacks: callbacks || {},
  };
}

/**
 * Create a new ProgressInfo object
 * 
 * @param {Object} data - Progress data from parser
 * @param {string} source - "ytdlp" or "ffmpeg"
 * @returns {ProgressInfo} New progress info object
 */
function createProgressInfo(data, source) {
  return {
    percent: data.percent || 0,
    eta: data.eta || 'unknown',
    speed: data.speed || 'unknown',
    total: data.total || 'unknown',
    source,
    ...data, // Include any additional fields
  };
}

/**
 * Create a new StreamStatus object
 * 
 * @param {StreamState} streamState - Current stream state
 * @returns {StreamStatus} Status object
 */
function createStreamStatus(streamState) {
  return {
    taskId: streamState.taskId,
    status: streamState.status,
    uptime: Date.now() - streamState.startTime,
    ytdlpAlive: streamState.ytdlpProcess && !streamState.ytdlpProcess.killed,
    ffmpegAlive: streamState.ffmpegProcess && !streamState.ffmpegProcess.killed,
    progress: streamState.progress,
    error: streamState.error ? streamState.error.message : null,
  };
}

module.exports = {
  createStreamState,
  createProgressInfo,
  createStreamStatus,
};
