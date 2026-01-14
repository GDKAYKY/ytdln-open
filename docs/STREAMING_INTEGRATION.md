# Integração de Streaming na API

## Visão Geral

Este documento explica como integrar o sistema de streaming com a API REST existente.

## Arquitetura

O sistema de streaming é **complementar** ao sistema de download tradicional:

- **Download tradicional**: `POST /api/download` → salva no disco → `GET /api/download/:taskId/file`
- **Streaming**: `POST /api/stream` → stream progressivo → `GET /api/stream/:taskId`

Ambos compartilham:
- Mesma estrutura de taskId
- Mesma fila de processamento (opcional)
- Mesmos endpoints de status/progresso

## Componentes Criados

### 1. StreamingService (`src/api/services/streaming.service.js`)

Gerencia pipes yt-dlp → FFmpeg e expõe streams por taskId.

**Métodos principais:**
- `startStream(taskId, url, options)` - Inicia stream
- `getStream(taskId)` - Obtém stream (Readable)
- `getProgress(taskId)` - Obtém progresso
- `stopStream(taskId)` - Para stream

### 2. StreamController (`src/api/controllers/stream.controller.js`)

Manipula requisições HTTP de streaming.

**Endpoints:**
- `GET /api/stream/:taskId` - Stream de mídia (HTTP chunked)
- `GET /api/stream/:taskId/status` - Progresso do stream
- `POST /api/stream/:taskId/stop` - Parar stream

### 3. Stream Routes (`src/api/routes/stream.routes.js`)

Define rotas de streaming.

### 4. Stream Client (`browser-extension/src/stream-client.js`)

Cliente MediaSource API para browser extension.

**Métodos:**
- `playStream(streamUrl, videoElement, options)` - Reproduz stream
- `getStreamStatus(statusUrl)` - Obtém progresso
- `stopStream(stopUrl)` - Para stream

## Integração no main.js

Adicionar no `main.js` após inicialização dos binários:

```javascript
const StreamingService = require("./api/services/streaming.service");
const StreamController = require("./api/controllers/stream.controller");
const { createStreamRouter } = require("./api/routes/stream.routes");

// Após inicializar binaryPaths
const streamingService = new StreamingService(binaryPaths);
const streamController = new StreamController(streamingService);

// Adicionar rotas de streaming
const streamRouter = createStreamRouter(streamController);
apiApp.use("/api", streamRouter);
```

## Endpoint de Criação de Stream

Criar endpoint `POST /api/stream` para iniciar streams:

```javascript
// No StreamController
async createStream(req, res) {
  const { url, format, audioOnly } = req.body;
  const taskId = generateTaskId(); // Usar mesmo formato do DownloadService
  
  try {
    await this.streamingService.startStream(taskId, url, {
      format,
      audioOnly
    });
    
    res.status(200).json({
      taskId,
      status: "streaming",
      streamUrl: `/api/stream/${taskId}`,
      statusUrl: `/api/stream/${taskId}/status`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
```

## Fluxo Completo

1. **Cliente cria stream:**
   ```
   POST /api/stream
   Body: { url: "...", format: "best", audioOnly: false }
   Response: { taskId: "...", streamUrl: "/api/stream/...", statusUrl: "/api/stream/.../status" }
   ```

2. **Backend inicia pipe:**
   - StreamingService.startStream() cria yt-dlp → FFmpeg pipe
   - Stream registrado por taskId

3. **Cliente acessa stream:**
   ```
   GET /api/stream/:taskId
   Response: HTTP chunked (video/mp4)
   ```

4. **Cliente obtém progresso (separado):**
   ```
   GET /api/stream/:taskId/status
   Response: { taskId, status, progress: { ytdlp: {...}, ffmpeg: {...} } }
   ```

5. **Browser extension reproduz:**
   ```javascript
   const video = document.querySelector("video");
   await StreamClient.playStream(streamUrl, video, {
     onProgress: (data) => console.log("Progress:", data),
     onError: (err) => console.error("Error:", err),
     onEnd: () => console.log("Stream ended")
   });
   ```

## Separação Download vs Streaming

**Download tradicional:**
- Usa `VideoDownloader` (salva no disco)
- Endpoint: `POST /api/download`
- Servir arquivo: `GET /api/download/:taskId/file`
- Progresso: `GET /api/download/:taskId/sse` (SSE)

**Streaming:**
- Usa `StreamingService` (pipe direto)
- Endpoint: `POST /api/stream`
- Servir stream: `GET /api/stream/:taskId` (HTTP chunked)
- Progresso: `GET /api/stream/:taskId/status` (JSON polling)

## Notas Importantes

1. **taskId único:** Cada stream/download tem taskId único
2. **Recursos compartilhados:** Binários (yt-dlp, FFmpeg) são compartilhados
3. **Progresso separado:** Stream de mídia NUNCA mistura com progresso
4. **Limpeza:** Streams devem ser limpos quando terminam ou cliente desconecta

## Próximos Passos

1. Adicionar endpoint `POST /api/stream` no StreamController
2. Integrar StreamingService no main.js
3. Adicionar rotas de streaming na API
4. Criar página de teste no browser extension
5. Testar fluxo completo
