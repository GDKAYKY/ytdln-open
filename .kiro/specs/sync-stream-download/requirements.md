# Requirements Document: Synchronous Stream Download with yt-dlp and FFmpeg

## Introduction

This feature implements a synchronous stream download system that pipes yt-dlp output directly to FFmpeg for real-time transcoding and streaming to clients. The system eliminates the need to save intermediate files to disk, reducing I/O overhead and enabling direct streaming to browsers and desktop applications. The implementation must be compatible with yt-dlp command-line arguments and FFmpeg filters.

## Glossary

- **yt-dlp**: Command-line tool for downloading videos from various platforms
- **FFmpeg**: Multimedia framework for encoding, decoding, and streaming
- **Stream**: Continuous flow of data from source to destination without intermediate storage
- **Pipe**: Unix mechanism for connecting process stdout to another process stdin
- **Transcode**: Converting video/audio from one format to another
- **Synchronous**: Blocking operation that completes before returning control
- **TaskId**: Unique identifier for a streaming session
- **Format**: Output video quality/resolution (e.g., "best", "720p", "audio")
- **Codec**: Algorithm for encoding/decoding media data

## Requirements

### Requirement 1: Synchronous Stream Initialization

**User Story:** As a developer, I want to initialize a synchronous stream download, so that I can start streaming video content directly without saving to disk.

#### Acceptance Criteria

1. WHEN a stream initialization request is received with a valid URL and format, THE StreamDownloadService SHALL spawn yt-dlp and FFmpeg processes with appropriate arguments
2. WHEN yt-dlp stdout is connected to FFmpeg stdin, THE StreamDownloadService SHALL establish the pipe connection without data loss
3. WHEN a stream is initialized, THE StreamDownloadService SHALL return a readable stream object that can be piped to HTTP responses
4. IF the URL is invalid or missing, THEN THE StreamDownloadService SHALL return an error with code INVALID_URL
5. IF yt-dlp or FFmpeg processes fail to spawn, THEN THE StreamDownloadService SHALL return an error with code PROCESS_SPAWN_ERROR

### Requirement 2: Format and Quality Selection

**User Story:** As a user, I want to select video quality and format, so that I can download content optimized for my needs.

#### Acceptance Criteria

1. WHEN a format parameter is provided (e.g., "best", "720p", "audio"), THE StreamDownloadService SHALL translate it to appropriate yt-dlp format selectors
2. WHEN format is "audio", THE StreamDownloadService SHALL configure yt-dlp to extract audio only and FFmpeg to output MP3
3. WHEN format is "best", THE StreamDownloadService SHALL use yt-dlp's best quality selector
4. WHEN format is a resolution (e.g., "720p"), THE StreamDownloadService SHALL filter to videos with height <= specified resolution
5. WHEN FFmpeg receives the stream, THE StreamDownloadService SHALL use codec copy mode to avoid re-encoding overhead

### Requirement 3: Real-time Progress Reporting

**User Story:** As a user, I want to receive real-time progress updates, so that I can monitor download status.

#### Acceptance Criteria

1. WHEN yt-dlp outputs progress information to stderr, THE StreamDownloadService SHALL parse progress messages and extract percentage, ETA, and speed
2. WHEN progress is parsed, THE StreamDownloadService SHALL emit progress events with structured data (percent, eta, speed, total)
3. WHEN FFmpeg processes the stream, THE StreamDownloadService SHALL monitor FFmpeg stderr for encoding progress
4. IF progress parsing fails, THE StreamDownloadService SHALL log the raw message without crashing
5. WHEN a client subscribes to progress events, THE StreamDownloadService SHALL deliver updates via callback or event emitter

### Requirement 4: Error Handling and Recovery

**User Story:** As a developer, I want robust error handling, so that stream failures are properly reported and resources are cleaned up.

#### Acceptance Criteria

1. WHEN yt-dlp process encounters an error, THE StreamDownloadService SHALL capture stderr output and emit error event
2. WHEN FFmpeg process encounters an error, THE StreamDownloadService SHALL capture stderr output and emit error event
3. WHEN a stream is stopped or client disconnects, THE StreamDownloadService SHALL kill both yt-dlp and FFmpeg processes
4. WHEN a process is killed, THE StreamDownloadService SHALL remove the stream from active streams map
5. IF a process fails to kill gracefully, THEN THE StreamDownloadService SHALL force kill with SIGKILL after timeout

### Requirement 5: Stream Lifecycle Management

**User Story:** As a developer, I want to manage stream lifecycle, so that I can start, monitor, and stop streams reliably.

#### Acceptance Criteria

1. WHEN a stream is created, THE StreamDownloadService SHALL assign a unique taskId and store stream metadata
2. WHEN getStreamStatus is called, THE StreamDownloadService SHALL return current status including process health and uptime
3. WHEN stopStream is called, THE StreamDownloadService SHALL terminate both processes and clean up resources
4. WHEN a stream completes naturally, THE StreamDownloadService SHALL emit completion event and clean up
5. WHEN multiple streams are active, THE StreamDownloadService SHALL maintain independent state for each stream

### Requirement 6: yt-dlp Argument Construction

**User Story:** As a developer, I want proper yt-dlp argument construction, so that the tool receives correct parameters for various scenarios.

#### Acceptance Criteria

1. WHEN building yt-dlp arguments, THE StreamDownloadService SHALL include --progress and --newline flags for progress tracking
2. WHEN building yt-dlp arguments, THE StreamDownloadService SHALL use -o - to output to stdout
3. WHEN building yt-dlp arguments, THE StreamDownloadService SHALL include appropriate format selectors based on user choice
4. WHEN audioOnly option is true, THE StreamDownloadService SHALL add -x and --audio-format flags
5. WHEN building arguments, THE StreamDownloadService SHALL append the URL as the final argument

### Requirement 7: FFmpeg Argument Construction

**User Story:** As a developer, I want proper FFmpeg argument construction, so that transcoding is configured correctly.

#### Acceptance Criteria

1. WHEN building FFmpeg arguments, THE StreamDownloadService SHALL use -i - to read from stdin
2. WHEN building FFmpeg arguments, THE StreamDownloadService SHALL use -c copy to avoid re-encoding
3. WHEN building FFmpeg arguments, THE StreamDownloadService SHALL specify output format based on content type
4. WHEN building FFmpeg arguments, THE StreamDownloadService SHALL use -f format flag to specify container format
5. WHEN building FFmpeg arguments, THE StreamDownloadService SHALL use - as output to write to stdout

### Requirement 8: HTTP Response Integration

**User Story:** As a developer, I want seamless HTTP response integration, so that streams can be served directly to clients.

#### Acceptance Criteria

1. WHEN a stream is requested via HTTP, THE StreamDownloadController SHALL set appropriate Content-Type header
2. WHEN a stream is requested via HTTP, THE StreamDownloadController SHALL set Transfer-Encoding: chunked header
3. WHEN FFmpeg stdout is piped to HTTP response, THE StreamDownloadController SHALL handle client disconnection gracefully
4. WHEN client disconnects, THE StreamDownloadController SHALL stop the stream and clean up processes
5. WHEN streaming completes, THE StreamDownloadController SHALL close the HTTP response properly

### Requirement 9: Synchronous Execution Model

**User Story:** As a developer, I want synchronous execution, so that stream operations complete before returning control.

#### Acceptance Criteria

1. WHEN startStream is called, THE StreamDownloadService SHALL block until both processes are spawned and pipe is established
2. WHEN stopStream is called, THE StreamDownloadService SHALL block until both processes are terminated
3. WHEN a stream encounters an error, THE StreamDownloadService SHALL propagate the error synchronously
4. WHEN multiple operations are queued, THE StreamDownloadService SHALL execute them sequentially
5. WHEN a timeout occurs during process spawn, THE StreamDownloadService SHALL throw TimeoutError

### Requirement 10: Process Monitoring and Health Checks

**User Story:** As a developer, I want process health monitoring, so that I can detect and handle process failures.

#### Acceptance Criteria

1. WHEN a stream is active, THE StreamDownloadService SHALL monitor both process exit codes
2. WHEN a process exits unexpectedly, THE StreamDownloadService SHALL emit error event with exit code
3. WHEN getStreamStatus is called, THE StreamDownloadService SHALL report whether each process is still alive
4. WHEN a process becomes unresponsive, THE StreamDownloadService SHALL attempt recovery or fail gracefully
5. WHEN monitoring detects a dead process, THE StreamDownloadService SHALL clean up the stream entry

