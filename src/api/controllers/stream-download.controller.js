/**
 * Stream Download Controller - HTTP endpoints for synchronous stream downloads
 * 
 * Handles:
 * - Stream creation and initialization
 * - Stream serving via HTTP
 * - Status monitoring
 * - Stream termination
 */

const { InvalidURLError, ProcessSpawnError } = require('../services/stream-download.service');

/**
 * StreamDownloadController - Manages HTTP endpoints for stream downloads
 */
class StreamDownloadController {
  /**
   * Initialize controller with service
   * @param {StreamDownloadService} streamDownloadService - Service instance
   */
  constructor(streamDownloadService) {
    this.service = streamDownloadService;
  }

  /**
   * POST /api/stream
   * Create a new stream download
   * 
   * Request body:
   * {
   *   url: string,           // Required: source URL
   *   format: string,        // Optional: "best", "720p", "audio", etc.
   *   audioOnly: boolean     // Optional: extract audio only
   * }
   * 
   * Response:
   * {
   *   taskId: string,
   *   status: string,
   *   streamUrl: string,
   *   statusUrl: string
   * }
   */
  async createStream(req, res) {
    try {
      const { url, format, audioOnly } = req.body;

      // Validate URL
      if (!url) {
        return res.status(400).json({
          error: 'URL is required',
          code: 'MISSING_URL',
        });
      }

      // Generate unique taskId
      const taskId = `stream_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

      // Start stream with callbacks
      try {
        this.service.startStream(
          taskId,
          url,
          { format: format || 'best', audioOnly: audioOnly || false },
          {
            onProgress: (progress) => {
              // Progress callback - can be used for logging or metrics
            },
            onError: (error) => {
              // Error callback - can be used for logging
            },
            onComplete: () => {
              // Completion callback
            },
          }
        ).catch((error) => {
          // Handle async errors from stream
        });
      } catch (error) {
        if (error instanceof InvalidURLError) {
          return res.status(400).json({
            error: error.message,
            code: error.code,
          });
        }
        if (error instanceof ProcessSpawnError) {
          return res.status(500).json({
            error: error.message,
            code: error.code,
          });
        }
        throw error;
      }

      // Return stream information
      res.status(200).json({
        taskId,
        status: 'streaming',
        streamUrl: `/api/stream/${taskId}`,
        statusUrl: `/api/stream/${taskId}/status`,
        message: 'Stream started',
      });

    } catch (error) {
      res.status(500).json({
        error: 'Failed to create stream',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * GET /api/stream/:taskId
   * Serve the stream to the client
   * 
   * Sets appropriate headers and pipes FFmpeg stdout to HTTP response
   * Handles client disconnection by stopping the stream
   */
  async getStream(req, res) {
    try {
      const { taskId } = req.params;

      // Get stream from service
      const streamState = this.service.streams.get(taskId);
      if (!streamState) {
        return res.status(404).json({
          error: 'Stream not found',
          code: 'STREAM_NOT_FOUND',
        });
      }

      // Set HTTP headers for streaming
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Transfer-Encoding', 'chunked');
      res.setHeader('Cache-Control', 'no-cache');

      // Pipe FFmpeg stdout to HTTP response
      streamState.ffmpegProcess.stdout.pipe(res);

      // Handle client disconnect
      res.on('close', () => {
        this.service.stopStream(taskId);
      });

      res.on('error', (error) => {
        this.service.stopStream(taskId);
      });

    } catch (error) {
      res.status(500).json({
        error: 'Failed to serve stream',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * GET /api/stream/:taskId/status
   * Get the current status of a stream
   * 
   * Response:
   * {
   *   taskId: string,
   *   status: string,
   *   uptime: number,
   *   ytdlpAlive: boolean,
   *   ffmpegAlive: boolean,
   *   progress: Object,
   *   error: string|null
   * }
   */
  getStreamStatus(req, res) {
    try {
      const { taskId } = req.params;

      const status = this.service.getStreamStatus(taskId);

      if (!status) {
        return res.status(404).json({
          error: 'Stream not found',
          code: 'STREAM_NOT_FOUND',
        });
      }

      res.status(200).json(status);

    } catch (error) {
      res.status(500).json({
        error: 'Failed to get stream status',
        code: 'INTERNAL_ERROR',
      });
    }
  }

  /**
   * POST /api/stream/:taskId/stop
   * Stop a stream
   * 
   * Response:
   * {
   *   taskId: string,
   *   status: string,
   *   message: string
   * }
   */
  stopStream(req, res) {
    try {
      const { taskId } = req.params;

      try {
        this.service.stopStream(taskId);
      } catch (error) {
        if (error.code === 'STREAM_NOT_FOUND') {
          return res.status(404).json({
            error: error.message,
            code: error.code,
          });
        }
        throw error;
      }

      res.status(200).json({
        taskId,
        status: 'stopped',
        message: 'Stream stopped',
      });

    } catch (error) {
      res.status(500).json({
        error: 'Failed to stop stream',
        code: 'INTERNAL_ERROR',
      });
    }
  }
}

module.exports = StreamDownloadController;
