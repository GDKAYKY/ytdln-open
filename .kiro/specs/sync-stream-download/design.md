# Design Document: Synchronous Stream Download with yt-dlp and FFmpeg

## Overview

The Synchronous Stream Download system provides a robust, efficient mechanism for streaming video content directly from source platforms to clients without intermediate disk storage. The architecture uses Unix pipes to connect yt-dlp (video extraction) → FFmpeg (transcoding) → HTTP response, creating a zero-copy streaming pipeline.

**Key Design Principles:**
- Synchronous execution model for predictable behavior
- Direct process-to-process piping to minimize latency
- Comprehensive error handling with graceful degradation
- Real-time progress reporting from both yt-dlp and FFmpeg
- Resource cleanup on stream termination or client disconnect

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    HTTP Client (Browser)                     │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP GET /api/stream/:taskId
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              StreamDownloadController                         │
│  - Route handling                                             │
│  - HTTP header management                                     │
│  - Client disconnect detection                               │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              StreamDownloadService                            │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Process Management                                    │   │
│  │ - yt-dlp spawn & monitoring                          │   │
│  │ - FFmpeg spawn & monitoring                          │   │
│  │ - Pipe establishment                                 │   │
│  │ - Error handling                                     │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Argument Construction                                 │   │
│  │ - yt-dlp format selectors                            │   │
│  │ - FFmpeg codec/format options                        │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Progress Parsing                                      │   │
│  │ - yt-dlp stderr parsing                              │   │
│  │ - FFmpeg stderr parsing                              │   │
│  │ - Event emission                                     │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
        ┌────────────────┼────────────────┐
        ▼                ▼                ▼
    ┌────────┐      ┌────────┐      ┌──────────┐
    │ yt-dlp │      │ FFmpeg │      │ Streams  │
    │Process │─────▶│Process │─────▶│  Map     │
    └────────┘      └────────┘      └──────────┘
        │                │
        ▼                ▼
    [stderr]         [stderr]
    Progress         Encoding
    Messages         Status
```

## Components and Interfaces

### StreamDownloadService

**Responsibilities:**
- Spawn and manage yt-dlp and FFmpeg processes
- Establish and maintain pipes between processes
- Parse progress information from both processes
- Handle errors and resource cleanup
- Maintain stream lifecycle state

**Key Methods:**

```javascript
class StreamDownloadService {
  // Initialize with binary paths
  constructor(binaries) {
    this.binaries = { ytdlp, ffmpeg, ffprobe };
    this.streams = new Map(); // taskId → StreamState
  }

  // Start synchronous stream
  async startStream(taskId, url, options, callbacks) {
    // 1. Validate inputs
    // 2. Build yt-dlp arguments
    // 3. Build FFmpeg arguments
    // 4. Spawn yt-dlp process
    // 5. Spawn FFmpeg process
    // 6. Establish pipe: yt-dlp.stdout → FFmpeg.stdin
    // 7. Setup stderr monitoring for both
    // 8. Setup error handlers
    // 9. Return FFmpeg.stdout for HTTP response
    // Returns: ReadableStream
  }

  // Stop stream synchronously
  stopStream(taskId) {
    // 1. Get stream from map
    // 2. Kill yt-dlp process
    // 3. Kill FFmpeg process
    // 4. Remove from map
    // 5. Emit cleanup event
  }

  // Get stream status
  getStreamStatus(taskId) {
    // Returns: { taskId, status, uptime, ytdlpAlive, ffmpegAlive }
  }

  // Build yt-dlp arguments
  buildYtdlpArgs(options, url) {
    // Returns: string[]
  }

  // Build FFmpeg arguments
  buildFfmpegArgs(options) {
    // Returns: string[]
  }

  // Parse yt-dlp progress
  parseYtdlpProgress(message) {
    // Returns: { percent, eta, speed, total } or null
  }

  // Parse FFmpeg progress
  parseFfmpegProgress(message) {
    // Returns: { frame, fps, q, size, time, bitrate, speed } or null
  }
}
```

### StreamDownloadController

**Responsibilities:**
- Handle HTTP requests for stream creation and management
- Manage HTTP response headers and streaming
- Detect client disconnection
- Coordinate with StreamDownloadService

**Key Methods:**

```javascript
class StreamDownloadController {
  constructor(streamDownloadService) {
    this.service = streamDownloadService;
  }

  // POST /api/stream - Create new stream
  async createStream(req, res) {
    // 1. Extract URL and options from request
    // 2. Generate taskId
    // 3. Call service.startStream()
    // 4. Return taskId and stream URL
  }

  // GET /api/stream/:taskId - Serve stream
  async getStream(req, res) {
    // 1. Get stream from service
    // 2. Set HTTP headers (Content-Type, Transfer-Encoding)
    // 3. Pipe FFmpeg.stdout to res
    // 4. Handle client disconnect
    // 5. Stop stream on disconnect
  }

  // GET /api/stream/:taskId/status - Get stream status
  getStreamStatus(req, res) {
    // 1. Get status from service
    // 2. Return JSON response
  }

  // POST /api/stream/:taskId/stop - Stop stream
  stopStream(req, res) {
    // 1. Call service.stopStream()
    // 2. Return success response
  }
}
```

## Data Models

### StreamState

```javascript
{
  taskId: string,              // Unique identifier
  url: string,                 // Source URL
  format: string,              // "best", "720p", "audio", etc.
  audioOnly: boolean,          // Extract audio only
  status: string,              // "starting", "streaming", "stopped", "error"
  ytdlpProcess: ChildProcess,  // yt-dlp process object
  ffmpegProcess: ChildProcess, // FFmpeg process object
  startTime: number,           // Timestamp when stream started
  endTime: number,             // Timestamp when stream ended
  progress: {
    percent: number,           // 0-100
    eta: string,               // "00:05:30"
    speed: string,             // "2.5MB/s"
    total: string,             // "150MB"
  },
  error: Error | null,         // Error object if failed
  callbacks: {
    onProgress: Function,      // Progress callback
    onError: Function,         // Error callback
  }
}
```

### ProgressInfo

```javascript
{
  percent: number,             // Download/encoding progress 0-100
  eta: string,                 // Estimated time remaining
  speed: string,               // Current speed (MB/s, fps, etc.)
  total: string,               // Total size or duration
  source: "ytdlp" | "ffmpeg"   // Which process reported this
}
```

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Stream Initialization Establishes Pipe

**For any** valid URL and format options, when `startStream()` is called, the returned stream should be readable and connected to FFmpeg's stdout.

**Validates: Requirements 1.1, 1.2, 1.3**

**Implementation Notes:**
- Test by calling `startStream()` with valid inputs
- Verify returned stream is a ReadableStream
- Verify stream emits 'data' events
- Verify stream is connected to FFmpeg process

### Property 2: Invalid URL Returns Error

**For any** invalid or missing URL, when `startStream()` is called, it should throw an error with code INVALID_URL.

**Validates: Requirements 1.4**

**Implementation Notes:**
- Test with empty string, null, undefined, malformed URLs
- Verify error code is INVALID_URL
- Verify no processes are spawned

### Property 3: Format Selection Translates Correctly

**For any** format string (best, 720p, audio, etc.), when `buildYtdlpArgs()` is called, the returned arguments should include appropriate yt-dlp format selectors.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

**Implementation Notes:**
- Test with various format strings
- Verify arguments include -f flag with correct selector
- Verify audio format includes -x and --audio-format flags
- Verify arguments are in correct order

### Property 4: Progress Parsing Extracts Correct Values

**For any** yt-dlp or FFmpeg progress message, when `parseYtdlpProgress()` or `parseFfmpegProgress()` is called, it should extract percent, eta, speed, and total values correctly or return null if unparseable.

**Validates: Requirements 3.1, 3.2, 3.4**

**Implementation Notes:**
- Test with real yt-dlp progress messages
- Test with real FFmpeg progress messages
- Test with malformed messages (should return null, not crash)
- Verify extracted values are in correct format

### Property 5: Stream Cleanup on Stop

**For any** active stream, when `stopStream()` is called, both yt-dlp and FFmpeg processes should be terminated and the stream should be removed from the active streams map.

**Validates: Requirements 4.3, 4.4, 5.3**

**Implementation Notes:**
- Test by creating stream and calling stopStream()
- Verify both processes are killed
- Verify stream is removed from map
- Verify getStreamStatus() returns null for stopped stream

### Property 6: Process Spawn Error Handling

**For any** scenario where process spawn fails, when `startStream()` is called, it should throw an error with code PROCESS_SPAWN_ERROR and clean up any partially spawned processes.

**Validates: Requirements 1.5, 4.1, 4.2**

**Implementation Notes:**
- Test by providing invalid binary paths
- Test by providing invalid arguments
- Verify error code is PROCESS_SPAWN_ERROR
- Verify no orphaned processes remain

### Property 7: Multiple Streams Maintain Independent State

**For any** set of concurrent streams, each stream should maintain independent state, progress, and error handling without interference.

**Validates: Requirements 5.5**

**Implementation Notes:**
- Test by creating multiple streams simultaneously
- Verify each stream has unique taskId
- Verify progress updates don't cross streams
- Verify stopping one stream doesn't affect others

### Property 8: HTTP Response Integration Round-Trip

**For any** stream served via HTTP, when FFmpeg stdout is piped to HTTP response, the response should be readable by the client and contain valid video/audio data.

**Validates: Requirements 8.1, 8.2, 8.3**

**Implementation Notes:**
- Test by making HTTP request to stream endpoint
- Verify Content-Type header is set correctly
- Verify Transfer-Encoding header is set
- Verify response body contains valid media data

## Error Handling

### Error Categories

1. **Input Validation Errors**
   - Invalid URL format
   - Missing required parameters
   - Invalid format selection
   - Response: 400 Bad Request with error code

2. **Process Spawn Errors**
   - Binary not found
   - Permission denied
   - System resource exhaustion
   - Response: 500 Internal Server Error with PROCESS_SPAWN_ERROR

3. **Stream Errors**
   - yt-dlp download failure
   - FFmpeg encoding failure
   - Pipe connection failure
   - Response: Emit error event, close stream

4. **Client Errors**
   - Client disconnect during streaming
   - Network timeout
   - Response: Clean up stream, log disconnect

### Error Recovery Strategy

- **Graceful Degradation**: If FFmpeg fails, attempt to serve raw yt-dlp output
- **Process Cleanup**: Always kill processes on error, even if cleanup fails
- **Timeout Protection**: Force kill processes after 5 second timeout
- **Logging**: Log all errors with context for debugging

## Testing Strategy

### Unit Tests

**Test Categories:**
1. Argument construction (yt-dlp and FFmpeg)
2. Progress parsing (yt-dlp and FFmpeg messages)
3. Error handling (invalid inputs, process failures)
4. Stream state management (create, update, delete)
5. HTTP header generation

**Example Test:**
```javascript
describe('StreamDownloadService', () => {
  describe('buildYtdlpArgs', () => {
    it('should include -o - for stdout output', () => {
      const args = service.buildYtdlpArgs({ format: 'best' }, 'https://example.com/video');
      expect(args).toContain('-o');
      expect(args).toContain('-');
    });

    it('should add -x flag for audio only', () => {
      const args = service.buildYtdlpArgs({ format: 'audio' }, 'https://example.com/video');
      expect(args).toContain('-x');
    });
  });
});
```

### Property-Based Tests

**Test Configuration:**
- Minimum 100 iterations per property test
- Use fast-check or similar library for input generation
- Tag each test with property number and requirements reference

**Example Property Test:**
```javascript
describe('StreamDownloadService Properties', () => {
  it('Property 3: Format selection translates correctly', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant('best'),
          fc.constant('720p'),
          fc.constant('audio'),
          fc.constant('1080p')
        ),
        (format) => {
          const args = service.buildYtdlpArgs({ format }, 'https://example.com/video');
          expect(args).toContain('-f');
          // Verify format selector is present
          const fIndex = args.indexOf('-f');
          expect(fIndex).toBeGreaterThan(-1);
          expect(args[fIndex + 1]).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

### Integration Tests

**Test Scenarios:**
1. End-to-end stream creation and serving
2. Progress reporting during streaming
3. Client disconnect handling
4. Multiple concurrent streams
5. Error scenarios (invalid URL, process failure)

## Implementation Notes

### Synchronous Execution Model

The service uses synchronous operations where possible:
- Process spawning blocks until both processes are ready
- Pipe establishment is synchronous
- Error propagation is immediate
- Callbacks are used for asynchronous events (progress, completion)

### Performance Considerations

- **Zero-Copy Piping**: Direct process-to-process piping minimizes memory usage
- **Codec Copy Mode**: FFmpeg uses `-c copy` to avoid re-encoding overhead
- **Streaming Headers**: HTTP response uses chunked encoding for immediate streaming
- **Resource Limits**: Monitor active streams to prevent resource exhaustion

### Compatibility

- **yt-dlp**: Uses standard command-line arguments from yt-dlp documentation
- **FFmpeg**: Uses standard command-line arguments from FFmpeg documentation
- **Node.js**: Uses child_process.spawn() for process management
- **HTTP**: Uses standard HTTP/1.1 streaming with chunked encoding

