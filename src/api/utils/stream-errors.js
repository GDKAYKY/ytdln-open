/**
 * Stream Download Error Utilities
 * 
 * Defines custom error classes and error codes for stream operations
 */

/**
 * Error codes used throughout the stream download system
 */
const ERROR_CODES = {
  // Input validation errors
  INVALID_URL: 'INVALID_URL',
  MISSING_URL: 'MISSING_URL',
  INVALID_FORMAT: 'INVALID_FORMAT',
  
  // Process errors
  PROCESS_SPAWN_ERROR: 'PROCESS_SPAWN_ERROR',
  PROCESS_EXIT_ERROR: 'PROCESS_EXIT_ERROR',
  PROCESS_KILL_ERROR: 'PROCESS_KILL_ERROR',
  
  // Stream errors
  STREAM_NOT_FOUND: 'STREAM_NOT_FOUND',
  PIPE_ERROR: 'PIPE_ERROR',
  STREAM_ERROR: 'STREAM_ERROR',
  
  // Timeout errors
  TIMEOUT_ERROR: 'TIMEOUT_ERROR',
  SPAWN_TIMEOUT: 'SPAWN_TIMEOUT',
  KILL_TIMEOUT: 'KILL_TIMEOUT',
  
  // Generic errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  STOP_ERROR: 'STOP_ERROR',
};

/**
 * Base error class for stream operations
 */
class StreamDownloadError extends Error {
  /**
   * Create a new StreamDownloadError
   * @param {string} message - Error message
   * @param {string} code - Error code from ERROR_CODES
   * @param {Object} [details] - Additional error details
   */
  constructor(message, code, details = {}) {
    super(message);
    this.name = 'StreamDownloadError';
    this.code = code;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON for HTTP responses
   * @returns {Object} JSON representation
   */
  toJSON() {
    return {
      error: this.message,
      code: this.code,
      details: this.details,
    };
  }
}

/**
 * Error thrown when URL is invalid or missing
 */
class InvalidURLError extends StreamDownloadError {
  constructor(message = 'Invalid or missing URL', details = {}) {
    super(message, ERROR_CODES.INVALID_URL, details);
    this.name = 'InvalidURLError';
  }
}

/**
 * Error thrown when process spawn fails
 */
class ProcessSpawnError extends StreamDownloadError {
  constructor(message = 'Failed to spawn process', details = {}) {
    super(message, ERROR_CODES.PROCESS_SPAWN_ERROR, details);
    this.name = 'ProcessSpawnError';
  }
}

/**
 * Error thrown when process exits with error code
 */
class ProcessExitError extends StreamDownloadError {
  constructor(processName, exitCode, details = {}) {
    const message = `${processName} exited with code ${exitCode}`;
    super(message, ERROR_CODES.PROCESS_EXIT_ERROR, { processName, exitCode, ...details });
    this.name = 'ProcessExitError';
  }
}

/**
 * Error thrown when pipe establishment fails
 */
class PipeError extends StreamDownloadError {
  constructor(message = 'Failed to establish pipe', details = {}) {
    super(message, ERROR_CODES.PIPE_ERROR, details);
    this.name = 'PipeError';
  }
}

/**
 * Error thrown when stream is not found
 */
class StreamNotFoundError extends StreamDownloadError {
  constructor(taskId, details = {}) {
    const message = `Stream ${taskId} not found`;
    super(message, ERROR_CODES.STREAM_NOT_FOUND, { taskId, ...details });
    this.name = 'StreamNotFoundError';
  }
}

/**
 * Error thrown when operation times out
 */
class TimeoutError extends StreamDownloadError {
  constructor(message = 'Operation timed out', details = {}) {
    super(message, ERROR_CODES.TIMEOUT_ERROR, details);
    this.name = 'TimeoutError';
  }
}

/**
 * Error thrown when spawn times out
 */
class SpawnTimeoutError extends TimeoutError {
  constructor(processName, timeout, details = {}) {
    const message = `${processName} spawn timed out after ${timeout}ms`;
    super(message, { processName, timeout, ...details });
    this.code = ERROR_CODES.SPAWN_TIMEOUT;
    this.name = 'SpawnTimeoutError';
  }
}

/**
 * Error thrown when kill times out
 */
class KillTimeoutError extends TimeoutError {
  constructor(processName, timeout, details = {}) {
    const message = `${processName} kill timed out after ${timeout}ms`;
    super(message, { processName, timeout, ...details });
    this.code = ERROR_CODES.KILL_TIMEOUT;
    this.name = 'KillTimeoutError';
  }
}

/**
 * Create HTTP error response
 * @param {Error} error - Error object
 * @param {number} [statusCode=500] - HTTP status code
 * @returns {Object} Response object with status and body
 */
function createErrorResponse(error, statusCode = 500) {
  if (error instanceof StreamDownloadError) {
    return {
      status: statusCode,
      body: error.toJSON(),
    };
  }

  return {
    status: statusCode,
    body: {
      error: error.message || 'Unknown error',
      code: ERROR_CODES.INTERNAL_ERROR,
    },
  };
}

/**
 * Get HTTP status code for error
 * @param {Error} error - Error object
 * @returns {number} HTTP status code
 */
function getErrorStatusCode(error) {
  if (error instanceof InvalidURLError) {
    return 400;
  }
  if (error instanceof StreamNotFoundError) {
    return 404;
  }
  if (error instanceof TimeoutError) {
    return 504;
  }
  return 500;
}

module.exports = {
  ERROR_CODES,
  StreamDownloadError,
  InvalidURLError,
  ProcessSpawnError,
  ProcessExitError,
  PipeError,
  StreamNotFoundError,
  TimeoutError,
  SpawnTimeoutError,
  KillTimeoutError,
  createErrorResponse,
  getErrorStatusCode,
};
