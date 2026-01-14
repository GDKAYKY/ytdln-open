# Implementation Plan: Synchronous Stream Download with yt-dlp and FFmpeg

## Overview

This implementation plan breaks down the synchronous stream download feature into discrete, manageable coding tasks. Each task builds on previous steps to create a complete, tested streaming pipeline. The implementation follows a bottom-up approach: start with core utilities, then build service layer, then integrate with HTTP controller.

## Tasks

- [x] 1. Set up project structure and core utilities
  - Create StreamDownloadService class with constructor and basic structure
  - Create StreamDownloadController class with constructor and basic structure
  - Define StreamState and ProgressInfo data models
  - Set up error codes and custom error classes
  - _Requirements: 1.1, 5.1_

- [ ] 2. Implement argument construction for yt-dlp
  - [x] 2.1 Implement buildYtdlpArgs method
    - Handle format selection (best, 720p, audio, etc.)
    - Include --progress and --newline flags
    - Use -o - for stdout output
    - Add -x and --audio-format for audio only
    - Append URL as final argument
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 2.2 Write property test for yt-dlp argument construction
    - **Property 3: Format selection translates correctly**
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4**

- [ ] 3. Implement argument construction for FFmpeg
  - [x] 3.1 Implement buildFfmpegArgs method
    - Use -i - for stdin input
    - Use -c copy for codec copy mode
    - Specify output format based on content type
    - Use -f format flag for container format
    - Use - as output for stdout
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 3.2 Write property test for FFmpeg argument construction
    - **Property 2.5: Codec copy mode is used**
    - **Validates: Requirements 7.2**

- [ ] 4. Implement progress parsing
  - [x] 4.1 Implement parseYtdlpProgress method
    - Parse [download] messages from yt-dlp stderr
    - Extract percent, ETA, speed, and total
    - Return null for unparseable messages without crashing
    - _Requirements: 3.1, 3.4_

  - [x] 4.2 Implement parseFfmpegProgress method
    - Parse frame, fps, q, size, time, bitrate, speed from FFmpeg stderr
    - Return null for unparseable messages without crashing
    - _Requirements: 3.1, 3.4_

  - [ ]* 4.3 Write property test for progress parsing
    - **Property 4: Progress parsing extracts correct values**
    - **Validates: Requirements 3.1, 3.4**

- [ ] 5. Implement process spawning and pipe establishment
  - [x] 5.1 Implement startStream method (core logic)
    - Validate URL input (throw INVALID_URL if invalid)
    - Build yt-dlp arguments
    - Build FFmpeg arguments
    - Spawn yt-dlp process with stdio: ['ignore', 'pipe', 'pipe']
    - Spawn FFmpeg process with stdio: ['pipe', 'pipe', 'pipe']
    - Establish pipe: ytdlpProcess.stdout → ffmpegProcess.stdin
    - Store stream state in map with unique taskId
    - Return ffmpegProcess.stdout as readable stream
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.1_

  - [ ]* 5.2 Write property test for stream initialization
    - **Property 1: Stream initialization establishes pipe**
    - **Validates: Requirements 1.1, 1.2, 1.3**

  - [ ]* 5.3 Write property test for invalid URL handling
    - **Property 2: Invalid URL returns error**
    - **Validates: Requirements 1.4**

- [ ] 6. Implement error handling and process monitoring
  - [x] 6.1 Add stderr monitoring for yt-dlp process
    - Listen to ytdlpProcess.stderr for data events
    - Parse progress messages and emit progress events
    - Capture error messages and emit error events
    - _Requirements: 3.1, 4.1_

  - [x] 6.2 Add stderr monitoring for FFmpeg process
    - Listen to ffmpegProcess.stderr for data events
    - Parse progress messages and emit progress events
    - Capture error messages and emit error events
    - _Requirements: 3.1, 4.2_

  - [x] 6.3 Add error handlers for both processes
    - Handle 'error' event from yt-dlp process
    - Handle 'error' event from FFmpeg process
    - Emit error event with code PROCESS_SPAWN_ERROR
    - Clean up stream on error
    - _Requirements: 1.5, 4.1, 4.2_

  - [x] 6.4 Add exit handlers for both processes
    - Handle 'close' event from yt-dlp process
    - Handle 'close' event from FFmpeg process
    - Check exit codes and emit error if non-zero
    - Clean up stream on exit
    - _Requirements: 10.2, 10.5_

  - [ ]* 6.5 Write property test for error handling
    - **Property 6: Process spawn error handling**
    - **Validates: Requirements 1.5, 4.1, 4.2**

- [ ] 7. Implement stream lifecycle management
  - [x] 7.1 Implement stopStream method
    - Get stream from map by taskId
    - Kill yt-dlp process (SIGTERM, then SIGKILL after timeout)
    - Kill FFmpeg process (SIGTERM, then SIGKILL after timeout)
    - Remove stream from map
    - Emit cleanup event
    - _Requirements: 4.3, 4.4, 4.5, 5.3_

  - [x] 7.2 Implement getStreamStatus method
    - Return stream status object with taskId, status, uptime
    - Report whether each process is alive
    - Return null if stream not found
    - _Requirements: 5.2, 10.3_

  - [ ]* 7.3 Write property test for stream cleanup
    - **Property 5: Stream cleanup on stop**
    - **Validates: Requirements 4.3, 4.4, 5.3**

  - [ ]* 7.4 Write property test for multiple concurrent streams
    - **Property 7: Multiple streams maintain independent state**
    - **Validates: Requirements 5.5**

- [x] 8. Checkpoint - Ensure all service tests pass
  - Run all unit tests for StreamDownloadService
  - Run all property tests for StreamDownloadService
  - Verify no orphaned processes remain
  - Ask the user if questions arise

- [ ] 9. Implement HTTP controller methods
  - [x] 9.1 Implement createStream controller method
    - Extract URL and options from request body
    - Generate unique taskId
    - Call service.startStream() with callbacks
    - Return taskId and stream URL in response
    - _Requirements: 1.1_

  - [x] 9.2 Implement getStream controller method
    - Get stream from service by taskId
    - Set Content-Type header (video/mp4 or audio/mp3)
    - Set Transfer-Encoding: chunked header
    - Set Cache-Control: no-cache header
    - Pipe ffmpegProcess.stdout to HTTP response
    - Handle client disconnect by stopping stream
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

  - [x] 9.3 Implement getStreamStatus controller method
    - Get status from service
    - Return JSON response with status data
    - _Requirements: 5.2_

  - [x] 9.4 Implement stopStream controller method
    - Call service.stopStream() by taskId
    - Return success response
    - _Requirements: 5.3_

  - [ ]* 9.5 Write property test for HTTP integration
    - **Property 8: HTTP response integration round-trip**
    - **Validates: Requirements 8.1, 8.2, 8.3**

- [ ] 10. Implement synchronous execution model
  - [x] 10.1 Add timeout handling to startStream
    - Set timeout for process spawn (5 seconds)
    - Throw TimeoutError if processes don't spawn in time
    - Clean up any partially spawned processes
    - _Requirements: 9.5_

  - [x] 10.2 Add timeout handling to stopStream
    - Set timeout for process termination (5 seconds)
    - Force kill with SIGKILL if graceful kill times out
    - _Requirements: 4.5, 9.2_

  - [ ]* 10.3 Write property test for synchronous execution
    - **Property 9: Synchronous execution model**
    - **Validates: Requirements 9.1, 9.2, 9.5**

- [ ] 11. Implement progress event emission
  - [x] 11.1 Add progress callback invocation in startStream
    - Call onProgress callback when yt-dlp emits progress
    - Call onProgress callback when FFmpeg emits progress
    - Pass structured ProgressInfo object to callback
    - _Requirements: 3.2, 3.5_

  - [ ]* 11.2 Write property test for progress event delivery
    - **Property 3.2: Progress events are emitted with correct structure**
    - **Validates: Requirements 3.2, 3.5**

- [ ] 12. Integration testing
  - [x] 12.1 Write integration test for complete stream lifecycle
    - Create stream with valid URL
    - Monitor progress events
    - Verify stream completes successfully
    - Verify cleanup occurs
    - _Requirements: 1.1, 3.2, 5.4_

  - [x] 12.2 Write integration test for error scenarios
    - Test with invalid URL
    - Test with unreachable URL
    - Test with process spawn failure
    - Verify errors are handled gracefully
    - _Requirements: 1.4, 1.5, 4.1, 4.2_

  - [x] 12.3 Write integration test for concurrent streams
    - Create multiple streams simultaneously
    - Verify each stream maintains independent state
    - Stop one stream and verify others continue
    - _Requirements: 5.5_

- [x] 13. Checkpoint - Ensure all tests pass
  - Run all unit tests
  - Run all property tests
  - Run all integration tests
  - Verify no orphaned processes remain
  - Ask the user if questions arise

- [ ] 14. Documentation and cleanup
  - [x] 14.1 Add JSDoc comments to all public methods
    - Document parameters and return types
    - Document error conditions
    - Document callback signatures
    - _Requirements: All_

  - [x] 14.2 Add inline comments for complex logic
    - Explain pipe establishment logic
    - Explain progress parsing logic
    - Explain error handling logic
    - _Requirements: All_

  - [x] 14.3 Create usage examples
    - Example: Basic stream creation
    - Example: Progress monitoring
    - Example: Error handling
    - Example: HTTP integration
    - _Requirements: All_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- All code must handle process cleanup to prevent orphaned processes
- Use synchronous operations where possible for predictable behavior
- Test with real yt-dlp and FFmpeg binaries when available

