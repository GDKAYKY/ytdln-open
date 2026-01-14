# StreamDownloadService Usage Examples

This document provides practical examples of how to use the StreamDownloadService for synchronous stream downloads with yt-dlp and FFmpeg.

## Basic Setup

```javascript
const { StreamDownloadService } = require('./stream-download.service');

// Create service instance with default binary paths
const service = new StreamDownloadService();

// Or with custom binary paths
const customService = new StreamDownloadService({
  ytdlp: '/usr/local/bin/yt-dlp',
  ffmpeg: '/usr/local/bin/ffmpeg',
  ffprobe: '/usr/local/bin/ffprobe',
});
```

## Example 1: Basic Stream Creation

```javascript
async function basicStreamExample() {
  const taskId = 'stream_' + Date.now();
  const url = 'https://example.com/video.mp4';

  try {
    // Start the stream
    const stream = await service.startStream(
      taskId,
      url,
      { format: 'best', audioOnly: false },
      {}
    );

    // Use the stream (e.g., pipe to HTTP response)
    stream.pipe(response);

  } catch (error) {
    console.error('Stream error:', error.message);
  }
}
```

## Example 2: Progress Monitoring

```javascript
async function progressMonitoringExample() {
  const taskId = 'stream_' + Date.now();
  const url = 'https://example.com/video.mp4';

  try {
    const stream = await service.startStream(
      taskId,
      url,
      { format: '720p', audioOnly: false },
      {
        // Called whenever progress is reported
        onProgress: (progress) => {
          console.log(`Download: ${progress.percent}%`);
          console.log(`Speed: ${progress.speed}`);
          console.log(`ETA: ${progress.eta}`);
        },
        
        // Called if an error occurs
        onError: (error) => {
          console.error('Stream error:', error.message);
        },
        
        // Called when stream completes
        onComplete: () => {
          console.log('Stream completed');
        },
      }
    );

    // Pipe to response
    stream.pipe(response);

  } catch (error) {
    console.error('Failed to start stream:', error.message);
  }
}
```

## Example 3: Audio-Only Extraction

```javascript
async function audioOnlyExample() {
  const taskId = 'audio_' + Date.now();
  const url = 'https://example.com/video.mp4';

  try {
    const stream = await service.startStream(
      taskId,
      url,
      { format: 'audio', audioOnly: true },
      {
        onProgress: (progress) => {
          console.log(`Audio extraction: ${progress.percent}%`);
        },
      }
    );

    // Set appropriate headers for audio
    response.setHeader('Content-Type', 'audio/mp3');
    response.setHeader('Transfer-Encoding', 'chunked');
    
    stream.pipe(response);

  } catch (error) {
    console.error('Audio extraction error:', error.message);
  }
}
```

## Example 4: Error Handling

```javascript
async function errorHandlingExample() {
  const taskId = 'stream_' + Date.now();
  const url = 'https://invalid-url.example.com/video.mp4';

  try {
    const stream = await service.startStream(
      taskId,
      url,
      { format: 'best' },
      {}
    );

    stream.pipe(response);

  } catch (error) {
    // Handle different error types
    if (error.code === 'INVALID_URL') {
      response.status(400).json({ error: 'Invalid URL provided' });
    } else if (error.code === 'PROCESS_SPAWN_ERROR') {
      response.status(500).json({ error: 'Failed to start streaming process' });
    } else if (error.code === 'TIMEOUT_ERROR') {
      response.status(504).json({ error: 'Stream initialization timeout' });
    } else {
      response.status(500).json({ error: 'Unknown error occurred' });
    }
  }
}
```

## Example 5: Stream Status Monitoring

```javascript
async function statusMonitoringExample() {
  const taskId = 'stream_' + Date.now();
  const url = 'https://example.com/video.mp4';

  try {
    const stream = await service.startStream(
      taskId,
      url,
      { format: 'best' },
      {}
    );

    // Pipe to response
    stream.pipe(response);

    // Monitor status periodically
    const statusInterval = setInterval(() => {
      const status = service.getStreamStatus(taskId);
      
      if (status) {
        console.log(`Stream ${taskId}:`);
        console.log(`  Status: ${status.status}`);
        console.log(`  Uptime: ${status.uptime}ms`);
        console.log(`  yt-dlp alive: ${status.ytdlpAlive}`);
        console.log(`  FFmpeg alive: ${status.ffmpegAlive}`);
        console.log(`  Progress: ${status.progress.percent}%`);
      } else {
        clearInterval(statusInterval);
      }
    }, 1000);

  } catch (error) {
    console.error('Stream error:', error.message);
  }
}
```

## Example 6: Stream Termination

```javascript
async function streamTerminationExample() {
  const taskId = 'stream_' + Date.now();
  const url = 'https://example.com/video.mp4';

  try {
    const stream = await service.startStream(
      taskId,
      url,
      { format: 'best' },
      {}
    );

    stream.pipe(response);

    // Stop stream after 30 seconds
    setTimeout(() => {
      try {
        service.stopStream(taskId);
        console.log('Stream stopped');
      } catch (error) {
        console.error('Error stopping stream:', error.message);
      }
    }, 30000);

  } catch (error) {
    console.error('Stream error:', error.message);
  }
}
```

## Example 7: HTTP Controller Integration

```javascript
const StreamDownloadController = require('./controllers/stream-download.controller');

// Create controller with service
const controller = new StreamDownloadController(service);

// Express route handlers
app.post('/api/stream', (req, res) => {
  controller.createStream(req, res);
});

app.get('/api/stream/:taskId', (req, res) => {
  controller.getStream(req, res);
});

app.get('/api/stream/:taskId/status', (req, res) => {
  controller.getStreamStatus(req, res);
});

app.post('/api/stream/:taskId/stop', (req, res) => {
  controller.stopStream(req, res);
});
```

## Example 8: Format Selection

```javascript
// Best quality (default)
const bestStream = await service.startStream(
  'task1',
  url,
  { format: 'best' },
  {}
);

// Specific resolution
const hd720Stream = await service.startStream(
  'task2',
  url,
  { format: '720p' },
  {}
);

const hd1080Stream = await service.startStream(
  'task3',
  url,
  { format: '1080p' },
  {}
);

// Audio only
const audioStream = await service.startStream(
  'task4',
  url,
  { format: 'audio', audioOnly: true },
  {}
);
```

## Example 9: Event Emitter Usage

```javascript
// Listen to progress events
service.on('progress', ({ taskId, progress }) => {
  console.log(`Task ${taskId}: ${progress.percent}%`);
});

// Listen to error events
service.on('error', ({ taskId, error }) => {
  console.error(`Task ${taskId} error:`, error.message);
});

// Listen to completion events
service.on('complete', ({ taskId }) => {
  console.log(`Task ${taskId} completed`);
});

// Listen to cleanup events
service.on('cleanup', ({ taskId }) => {
  console.log(`Task ${taskId} cleaned up`);
});
```

## Example 10: Multiple Concurrent Streams

```javascript
async function multipleConcurrentStreamsExample() {
  const urls = [
    'https://example.com/video1.mp4',
    'https://example.com/video2.mp4',
    'https://example.com/video3.mp4',
  ];

  const streams = [];

  try {
    // Start all streams concurrently
    for (let i = 0; i < urls.length; i++) {
      const taskId = `stream_${i}_${Date.now()}`;
      const stream = await service.startStream(
        taskId,
        urls[i],
        { format: '720p' },
        {
          onProgress: (progress) => {
            console.log(`Stream ${i}: ${progress.percent}%`);
          },
        }
      );
      streams.push({ taskId, stream });
    }

    // Handle all streams
    streams.forEach(({ taskId, stream }) => {
      // Pipe to appropriate response or file
      stream.pipe(getResponseForStream(taskId));
    });

  } catch (error) {
    console.error('Error starting streams:', error.message);
  }
}
```

## Configuration

The service can be configured with custom timeouts:

```javascript
const service = new StreamDownloadService();

// Modify configuration
service.config.processSpawnTimeout = 10000; // 10 seconds
service.config.processKillTimeout = 5000;   // 5 seconds
```

## Error Codes

- `INVALID_URL`: URL validation failed
- `PROCESS_SPAWN_ERROR`: Failed to spawn yt-dlp or FFmpeg process
- `TIMEOUT_ERROR`: Process spawn timeout exceeded
- `STREAM_NOT_FOUND`: Stream with given taskId not found
- `INVALID_FORMAT`: Invalid format selection
- `PIPE_ERROR`: Failed to establish pipe between processes
- `PROCESS_EXIT_ERROR`: Process exited with non-zero code
- `STOP_ERROR`: Failed to stop stream

## Best Practices

1. **Always handle errors**: Use try-catch blocks and error callbacks
2. **Monitor progress**: Implement progress callbacks for user feedback
3. **Clean up resources**: Stop streams when no longer needed
4. **Use appropriate formats**: Select format based on use case
5. **Set HTTP headers**: Use correct Content-Type for audio/video
6. **Handle client disconnect**: Stop stream when client disconnects
7. **Implement timeouts**: Set reasonable timeouts for stream operations
8. **Log events**: Use event emitters for debugging and monitoring
