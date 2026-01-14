# Arquitetura de Streaming: Design de Produção

## Visão Geral

Este documento define a arquitetura de streaming progressivo para o sistema YTDLN-Open. O objetivo é permitir playback de vídeo antes que o download/merge esteja completo, usando **pipes Unix**, **HTTP chunked transfer** e **MediaSource API**.

---

## Por Que Esta Arquitetura Funciona

### Fluxo de Dados Otimizado

```
yt-dlp (stdout) → FFmpeg (stdin → stdout) → HTTP (chunked) → MediaSource API → <video>
```

**Por que funciona:**

1. **Zero-copy em memória**: Dados fluem diretamente entre processos via pipes do sistema operacional
2. **Baixa latência**: Playback começa assim que o primeiro fragmento MP4 está pronto (~2-5 segundos)
3. **Uso eficiente de recursos**: Sem arquivos temporários, sem buffering completo em RAM
4. **Backpressure nativo**: HTTP chunked transfer respeita limites do cliente automaticamente

### Por Que Outras Abordagens Falham

#### ❌ Download Completo → Merge → Stream

**Problemas:**
- Latência inicial: usuário espera 100% do download + merge
- Uso de disco: arquivo completo + arquivo mergeado = 2x espaço
- Não é streaming: playback só começa após tudo concluído

#### ❌ Buffering Completo em Memória

**Problemas:**
- RAM explode: vídeo de 1GB = 1GB+ de RAM
- OOM (Out of Memory) em vídeos grandes
- Latência igual ao download completo

#### ❌ WebSocket para Vídeo

**Problemas:**
- Sem backpressure HTTP: cliente não pode pausar o servidor
- Overhead: frames de controle WebSocket desnecessários
- Browser otimizações ruins: cache HTTP não funciona
- Reinventa TCP: HTTP já tem controle de fluxo

#### ❌ Blob URL para Playback

**Problemas:**
- `response.blob()` espera todo o download
- Memória alta: blob inteiro em RAM
- Não é streaming real

---

## Componentes da Arquitetura

### 1. Backend: Serviço de Streaming

**Responsabilidade:** Orquestrar yt-dlp → FFmpeg pipe e servir via HTTP chunked.

**Localização:** `src/api/services/streaming.service.js`

**Características:**
- Inicia processo yt-dlp com `-o -` (stdout)
- Inicia processo FFmpeg com `-i pipe:0` (stdin) e `-movflags frag_keyframe+empty_moov`
- Conecta yt-dlp.stdout → FFmpeg.stdin
- Expõe FFmpeg.stdout como stream gerenciado por taskId
- Parsing de progresso separado (yt-dlp stderr + FFmpeg stderr)

### 2. Backend: Endpoint de Stream

**Responsabilidade:** Servir stream de mídia via HTTP chunked.

**Rota:** `GET /api/stream/:taskId`

**Headers:**
```
Content-Type: video/mp4
Transfer-Encoding: chunked
Cache-Control: no-cache
```

**Comportamento:**
- Aceita conexão HTTP
- Obtém stream do serviço de streaming
- Pipe direto: `stream.pipe(response)`
- Fecha conexão quando stream termina ou cliente desconecta

### 3. Backend: Endpoint de Status

**Responsabilidade:** Fornecer progresso separado do stream de mídia.

**Rota:** `GET /api/stream/:taskId/status`

**Resposta JSON:**
```json
{
  "taskId": "...",
  "status": "streaming",
  "progress": {
    "ytdlp": { "percent": 45.2, "speed": "2.5MiB/s", "eta": "00:15" },
    "ffmpeg": { "fps": 30.0, "frame": 1234 }
  }
}
```

### 4. Browser Extension: MediaSource Bridge

**Responsabilidade:** Receber HTTP chunked e alimentar MediaSource API.

**Localização:** `browser-extension/src/stream-client.js`

**Comportamento:**
- Cria `MediaSource`
- Cria `SourceBuffer` com codecs apropriados
- Fetch do endpoint `/api/stream/:taskId`
- Lê `response.body` via `ReadableStream`
- Anexa chunks ao `SourceBuffer` respeitando `updateend`
- Chama `endOfStream()` quando done

---

## Implementação Técnica

### yt-dlp → FFmpeg Pipe

**Correto:**
```javascript
const ytdlp = spawn("yt-dlp", [
  "-f", "bv*+ba/b",  // Melhor vídeo+áudio ou melhor disponível
  "-o", "-",          // stdout
  "--no-playlist",
  URL
]);

const ffmpeg = spawn("ffmpeg", [
  "-i", "pipe:0",                    // stdin
  "-movflags", "frag_keyframe+empty_moov",  // Fragmented MP4
  "-c:v", "copy",                    // Copy video (sem re-encode)
  "-c:a", "aac",                     // AAC audio (ou copy se compatível)
  "-f", "mp4",
  "pipe:1"                           // stdout
]);

ytdlp.stdout.pipe(ffmpeg.stdin);

// Progresso yt-dlp via stderr
ytdlp.stderr.on("data", (chunk) => {
  // Parse progresso
});

// Progresso FFmpeg via stderr (opcional: -progress pipe:2)
ffmpeg.stderr.on("data", (chunk) => {
  // Parse progresso
});
```

**Por que funciona:**
- `-o -` faz yt-dlp escrever para stdout
- `-i pipe:0` faz FFmpeg ler de stdin
- `frag_keyframe+empty_moov` permite playback incremental
- Pipe do sistema operacional é eficiente (zero-copy quando possível)

### HTTP Chunked Streaming

**Correto:**
```javascript
router.get("/stream/:taskId", async (req, res) => {
  const { taskId } = req.params;
  const stream = streamingService.getStream(taskId);
  
  if (!stream) {
    return res.status(404).json({ error: "Stream não encontrado" });
  }

  res.writeHead(200, {
    "Content-Type": "video/mp4",
    "Transfer-Encoding": "chunked",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });

  stream.pipe(res);

  stream.on("end", () => {
    res.end();
  });

  stream.on("error", (err) => {
    if (!res.headersSent) {
      res.status(500).json({ error: err.message });
    } else {
      res.destroy();
    }
  });

  req.on("close", () => {
    stream.destroy();
  });
});
```

**Por que funciona:**
- `Transfer-Encoding: chunked` permite streaming sem Content-Length
- `pipe()` respeita backpressure automaticamente
- Cliente pode desconectar sem quebrar o servidor

### MediaSource API no Browser

**Correto:**
```javascript
async function playStream(streamUrl) {
  const video = document.querySelector("video");
  const ms = new MediaSource();
  video.src = URL.createObjectURL(ms);

  await new Promise((resolve) => {
    ms.addEventListener("sourceopen", resolve, { once: true });
  });

  // Detectar codecs (idealmente do backend, fallback comum)
  const mimeType = 'video/mp4; codecs="avc1.64001f, mp4a.40.2"';
  const sb = ms.addSourceBuffer(mimeType);

  const res = await fetch(streamUrl);
  const reader = res.body.getReader();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    // Esperar SourceBuffer estar pronto
    await new Promise((resolve) => {
      if (sb.updating) {
        sb.addEventListener("updateend", resolve, { once: true });
      } else {
        resolve();
      }
    });

    sb.appendBuffer(value);
  }

  await new Promise((resolve) => {
    if (sb.updating) {
      sb.addEventListener("updateend", resolve, { once: true });
    } else {
      resolve();
    }
  });

  ms.endOfStream();
}
```

**Por que funciona:**
- `MediaSource` permite alimentar vídeo incrementalmente
- `ReadableStream` do fetch lê chunks progressivamente
- `updateend` garante ordem correta dos appends
- `endOfStream()` sinaliza fim do stream

---

## Limitações e Considerações

### Fragmented MP4

**Requisito:** `-movflags frag_keyframe+empty_moov`

**Por que necessário:**
- MP4 padrão tem `moov` atom no início (metadata completo)
- Playback só começa após receber `moov`
- Fragmented MP4 coloca `moov` no final ou usa `empty_moov`
- Permite playback após primeiro fragmento

**Limitação:**
- Fragmentos devem começar com keyframe
- FFmpeg garante isso com `frag_keyframe`

### Codecs Suportados

**Video:** H.264 (avc1) - mais compatível
**Audio:** AAC (mp4a.40.2) - padrão MP4

**Por que:**
- Browsers suportam amplamente
- FFmpeg pode copiar (sem re-encode) se origem for compatível
- Re-encode apenas se necessário (áudio principalmente)

### Browser Extension Constraints

**Manifest V3:**
- `fetch()` funciona normalmente
- `MediaSource` funciona em content scripts
- Não pode interceptar/modificar requests de mídia facilmente

**Abordagem:**
- Extension faz fetch do stream
- Alimenta MediaSource via JavaScript
- Ou cria blob URL temporário (mas isso é menos eficiente)

### Backpressure

**Como funciona:**
- HTTP chunked: servidor não envia mais chunks se cliente não lê
- Node.js `pipe()` respeita backpressure do destino
- Cliente lê conforme necessário (MediaSource buffer interno)

**O que não fazer:**
- Não fazer `res.write()` sem verificar se cliente está lendo
- Não fazer `sb.appendBuffer()` sem esperar `updateend`

---

## Comparação: HTTP vs WebSocket vs HLS

### HTTP Chunked (✅ ESCOLHIDO)

**Vantagens:**
- Simples: apenas GET request
- Backpressure nativo: TCP + HTTP
- Cache HTTP funciona (útil para replay)
- Zero overhead de protocolo

**Desvantagens:**
- Conexão única: difícil de retomar
- Sem controle fino de qualidade

**Quando usar:** Streaming progressivo de mídia única

### WebSocket

**Vantagens:**
- Bidirecional: pode enviar comandos (pause/seek)
- Múltiplos streams em uma conexão

**Desvantagens:**
- Sem backpressure HTTP: precisa implementar manualmente
- Overhead: frames de controle
- Browser não otimiza: cache não funciona
- Complexidade desnecessária

**Quando usar:** Não usar para streaming de vídeo

### HLS (HTTP Live Streaming)

**Vantagens:**
- Suporte nativo do browser (`<video src="playlist.m3u8">`)
- Adaptativo: múltiplas qualidades
- Retomável: pode mudar de segmento

**Desvantagens:**
- Complexidade: precisa gerar segmentos .ts/.m3u8
- Latência: pelo menos duração de um segmento (10s típico)
- Requer segmentação: FFmpeg precisa de configuração especial

**Quando usar:** Streaming adaptativo de alta qualidade (não nosso caso)

---

## Alternativas Rejeitadas

### Base64 Encoding

**Por que rejeitado:**
- Overhead 33%: 4 bytes viram ~5.33 bytes
- Não funciona para streaming: precisa do payload completo
- Sem benefício: apenas complica

### Blob URL Completo

**Por que rejeitado:**
- `response.blob()` espera download completo
- Memória alta: blob inteiro em RAM
- Não é streaming real

### Download → Merge → Stream

**Por que rejeitado:**
- Latência: usuário espera tudo
- Disco: 2x espaço (original + merged)
- Não é streaming progressivo

---

## Estrutura de Arquivos

```
src/
  api/
    services/
      streaming.service.js    # yt-dlp → FFmpeg pipe + stream manager
    controllers/
      stream.controller.js    # Endpoints HTTP
    routes/
      stream.routes.js        # Rotas de streaming

browser-extension/
  src/
    stream-client.js          # MediaSource API client
    stream-player.jsx         # Componente React (se necessário)
```

---

## Fluxo Completo

1. **Cliente:** `POST /api/download` → retorna `taskId`
2. **Backend:** Inicia yt-dlp → FFmpeg pipe, registra stream por `taskId`
3. **Cliente:** `GET /api/stream/:taskId` → recebe HTTP chunked
4. **Backend:** Pipe FFmpeg.stdout → HTTP response
5. **Cliente:** Fetch stream → ReadableStream → SourceBuffer → `<video>`
6. **Cliente (separado):** `GET /api/stream/:taskId/status` → progresso JSON

**Playback começa:** ~2-5 segundos após início do download (quando primeiro fragmento está pronto)

---

## Conclusão

Esta arquitetura prioriza:
- **Performance:** Zero-copy pipes, streaming progressivo
- **Correção:** Fragmented MP4, backpressure, error handling
- **Simplicidade:** HTTP padrão, APIs nativas do browser

**Não tente "melhorar" com:**
- WebSockets (não necessário, pior performance)
- Download completo primeiro (destrói streaming)
- Buffering completo (explode RAM)
- Base64/Blobs completos (não é streaming)
