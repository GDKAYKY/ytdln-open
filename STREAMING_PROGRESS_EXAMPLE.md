# Streaming com Progresso em Tempo Real

## Como Funciona

O sistema agora envia o stream **controladamente** para o browser durante o download, permitindo que o Chrome Download Manager mostre o progresso em tempo real (%).

### Fluxo:
1. **Cliente** faz POST para `/api/stream-pipe` com a URL
2. **Servidor** obtém o tamanho total do arquivo com `yt-dlp --dump-json`
3. **Servidor** inicia o stream (yt-dlp → FFmpeg → HTTP Response)
4. **Servidor** envia headers HTTP corretos:
   - `Content-Length`: tamanho total em bytes
   - `Content-Disposition`: força download no navegador
   - `Accept-Ranges`: permite retomar downloads
5. **Cliente** recebe dados em chunks e o Chrome Download Manager calcula o progresso
6. **Cliente** pode monitorar progresso via `/api/stream-pipe/:taskId/status`

## Headers HTTP Enviados

```
Content-Type: video/mp4
Content-Length: 1234567890          ← Tamanho total (Chrome usa isso para calcular %)
Content-Disposition: attachment; filename="video.mp4"
Accept-Ranges: bytes                ← Permite retomar downloads
Transfer-Encoding: chunked          ← Se não souber o tamanho
Cache-Control: no-cache, no-store, must-revalidate
```

## Exemplo de Uso

### 1. Iniciar Stream
```bash
curl -X POST http://localhost:3000/api/stream-pipe \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "format": "best",
    "audioOnly": false
  }'
```

**Resposta:**
```json
{
  "taskId": "stream_1768386545857_abc123def",
  "status": "streaming",
  "fileSize": 1234567890,
  "streamUrl": "/api/stream-pipe/stream_1768386545857_abc123def/stream",
  "statusUrl": "/api/stream-pipe/stream_1768386545857_abc123def/status",
  "message": "Stream iniciado"
}
```

### 2. Baixar o Stream
```bash
# O navegador automaticamente mostrará o progresso no Download Manager
curl -o video.mp4 http://localhost:3000/api/stream-pipe/stream_1768386545857_abc123def/stream
```

### 3. Monitorar Progresso em Tempo Real
```bash
# Fazer polling a cada 500ms
curl http://localhost:3000/api/stream-pipe/stream_1768386545857_abc123def/status
```

**Resposta:**
```json
{
  "taskId": "stream_1768386545857_abc123def",
  "status": "streaming",
  "uptime": 5234,
  "ytdlpAlive": true,
  "ffmpegAlive": true,
  "fileSize": 1234567890,
  "bytesTransferred": 567890123,
  "percent": 46,
  "speed": "12.34 MB/s"
}
```

## Exemplo JavaScript (Browser)

```javascript
async function downloadWithProgress(url) {
  // 1. Iniciar stream
  const initResponse = await fetch('/api/stream-pipe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, format: 'best' })
  });

  const { taskId, fileSize, streamUrl } = await initResponse.json();
  console.log(`Tamanho: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

  // 2. Monitorar progresso
  const progressInterval = setInterval(async () => {
    const statusResponse = await fetch(`/api/stream-pipe/${taskId}/status`);
    const status = await statusResponse.json();
    
    console.log(`Progresso: ${status.percent}% (${status.speed})`);
    
    if (status.percent === 100) {
      clearInterval(progressInterval);
    }
  }, 500);

  // 3. Iniciar download (Chrome mostrará progresso automaticamente)
  const link = document.createElement('a');
  link.href = streamUrl;
  link.download = `video_${Date.now()}.mp4`;
  link.click();
}

// Usar
downloadWithProgress('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
```

## Exemplo HTML (Download com Progresso Visual)

```html
<!DOCTYPE html>
<html>
<head>
  <title>Download com Progresso</title>
  <style>
    .progress-container {
      width: 100%;
      height: 30px;
      background: #f0f0f0;
      border-radius: 15px;
      overflow: hidden;
      margin: 20px 0;
    }
    .progress-bar {
      height: 100%;
      background: linear-gradient(90deg, #4CAF50, #45a049);
      width: 0%;
      transition: width 0.3s;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <h1>Download com Progresso em Tempo Real</h1>
  
  <input type="text" id="urlInput" placeholder="Cole a URL do vídeo" style="width: 100%; padding: 10px;">
  <button onclick="startDownload()">Baixar</button>

  <div class="progress-container">
    <div class="progress-bar" id="progressBar">0%</div>
  </div>

  <div id="status"></div>

  <script>
    async function startDownload() {
      const url = document.getElementById('urlInput').value;
      if (!url) {
        alert('Cole uma URL');
        return;
      }

      try {
        // Iniciar stream
        const initResponse = await fetch('/api/stream-pipe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url, format: 'best' })
        });

        const { taskId, fileSize, streamUrl } = await initResponse.json();
        console.log(`Iniciado: ${taskId}`);
        console.log(`Tamanho: ${(fileSize / 1024 / 1024).toFixed(2)} MB`);

        // Monitorar progresso
        const progressInterval = setInterval(async () => {
          try {
            const statusResponse = await fetch(`/api/stream-pipe/${taskId}/status`);
            const status = await statusResponse.json();
            
            const progressBar = document.getElementById('progressBar');
            progressBar.style.width = status.percent + '%';
            progressBar.textContent = `${status.percent}% - ${status.speed}`;

            document.getElementById('status').innerHTML = `
              <p>Bytes: ${(status.bytesTransferred / 1024 / 1024).toFixed(2)} MB / ${(status.fileSize / 1024 / 1024).toFixed(2)} MB</p>
              <p>Velocidade: ${status.speed}</p>
              <p>Tempo decorrido: ${(status.uptime / 1000).toFixed(1)}s</p>
            `;

            if (status.percent >= 100) {
              clearInterval(progressInterval);
              document.getElementById('status').innerHTML += '<p style="color: green;">✓ Download concluído!</p>';
            }
          } catch (error) {
            console.error('Erro ao obter status:', error);
          }
        }, 500);

        // Iniciar download (Chrome mostrará progresso automaticamente)
        const link = document.createElement('a');
        link.href = streamUrl;
        link.download = `video_${Date.now()}.mp4`;
        link.click();

      } catch (error) {
        alert('Erro: ' + error.message);
      }
    }
  </script>
</body>
</html>
```

## Benefícios

✅ **Progresso em Tempo Real**: Chrome Download Manager mostra % durante o download  
✅ **Streaming Controlado**: Dados enviados progressivamente, não espera terminar  
✅ **Retomar Downloads**: Headers `Accept-Ranges` permitem retomar  
✅ **Sem Arquivo Temporário**: Tudo em memória, sem salvar em disco  
✅ **Monitoramento**: Endpoint `/status` permite acompanhar progresso  
✅ **Compatível**: Funciona com qualquer navegador moderno  

## Notas Técnicas

- O tamanho do arquivo é obtido com `yt-dlp --dump-json` (rápido, ~1-2s)
- O progresso é calculado monitorando bytes transferidos do FFmpeg
- Se o tamanho não puder ser obtido, usa `Transfer-Encoding: chunked`
- O Chrome Download Manager calcula % automaticamente com `Content-Length`
- Suporta retomar downloads com headers `Accept-Ranges: bytes`
