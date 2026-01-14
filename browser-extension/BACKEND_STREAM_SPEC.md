# 📡 Especificação: Endpoint de Stream no Backend

## 🎯 Objetivo

O backend YTDLN Desktop deve implementar um endpoint que **streame o arquivo já baixado** pelo yt-dlp, sem duplicar o download.

## 🔧 Implementação Necessária no Backend

### Endpoint Principal: `/api/download/{taskId}/stream`

```javascript
// No servidor Express (stream-download-api.js)
app.get('/api/download/:taskId/stream', (req, res) => {
  const taskId = req.params.taskId;
  
  try {
    // Buscar informações do download
    const downloadInfo = getDownloadInfo(taskId);
    
    if (!downloadInfo || !downloadInfo.outputPath) {
      return res.status(404).json({
        error: 'Download não encontrado',
        code: 'TASK_NOT_FOUND'
      });
    }
    
    const filePath = downloadInfo.outputPath;
    
    // Verificar se arquivo existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        error: 'Arquivo não encontrado no sistema',
        code: 'FILE_NOT_FOUND'
      });
    }
    
    // Obter informações do arquivo
    const stat = fs.statSync(filePath);
    const fileName = path.basename(filePath);
    const mimeType = getMimeType(filePath);
    
    // Configurar headers para download
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    
    // Streamear arquivo
    const readStream = fs.createReadStream(filePath);
    
    readStream.on('error', (error) => {
      console.error('Erro no stream:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Erro ao ler arquivo' });
      }
    });
    
    // Pipe do arquivo para response
    readStream.pipe(res);
    
    console.log(`[Stream] Servindo arquivo: ${fileName} (${stat.size} bytes)`);
    
  } catch (error) {
    console.error('Erro no endpoint de stream:', error);
    res.status(500).json({
      error: 'Erro interno do servidor',
      code: 'INTERNAL_ERROR'
    });
  }
});
```

### Endpoint Alternativo: `/stream/{taskId}`

```javascript
// Endpoint mais simples (fallback)
app.get('/stream/:taskId', (req, res) => {
  const taskId = req.params.taskId;
  const downloadInfo = getDownloadInfo(taskId);
  
  if (!downloadInfo?.outputPath) {
    return res.status(404).send('Download não encontrado');
  }
  
  // Stream direto do arquivo
  res.sendFile(path.resolve(downloadInfo.outputPath));
});
```

### Função Auxiliar: Detectar MIME Type

```javascript
function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  
  const mimeTypes = {
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.webm': 'video/webm',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.mp3': 'audio/mpeg',
    '.m4a': 'audio/mp4',
    '.wav': 'audio/wav',
    '.flac': 'audio/flac',
    '.ogg': 'audio/ogg'
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
}
```

## 🔄 Fluxo Completo

```
1. yt-dlp baixa arquivo → /path/to/video.mp4
   ↓
2. Download completa, status.outputPath = "/path/to/video.mp4"
   ↓
3. Extensão chama GET /api/download/123/stream
   ↓
4. Backend lê arquivo do disco
   ↓
5. Backend streama arquivo via HTTP
   ↓
6. chrome.downloads.download recebe stream
   ↓
7. Arquivo aparece em chrome://downloads
```

## 📊 Vantagens desta Abordagem

### ✅ **Sem Duplicação**
- Arquivo é baixado apenas uma vez pelo yt-dlp
- Backend apenas streama o arquivo existente
- Não ocupa espaço extra em disco

### ✅ **Performance**
- Stream direto do disco para navegador
- Sem carregamento em memória
- Suporte a arquivos grandes

### ✅ **Compatibilidade**
- Funciona com qualquer tipo de arquivo
- Headers HTTP corretos
- MIME types apropriados

## 🧪 Como Testar

### 1. **Teste Manual da API**
```bash
# Após um download completar:
curl -I http://localhost:9001/api/download/123/stream

# Deve retornar:
HTTP/1.1 200 OK
Content-Type: video/mp4
Content-Length: 12345678
Content-Disposition: attachment; filename="video.mp4"
```

### 2. **Teste no Navegador**
```
1. Abra: http://localhost:9001/api/download/123/stream
2. Deve iniciar download do arquivo
3. Arquivo deve ser idêntico ao original
```

### 3. **Teste na Extensão**
```
1. Faça download via extensão
2. Verifique logs: "[Background] ✅ Stream funcionou!"
3. Confirme arquivo em chrome://downloads
```

## ⚠️ Considerações Importantes

### **Segurança**
```javascript
// Validar taskId para evitar path traversal
if (!/^[a-zA-Z0-9_-]+$/.test(taskId)) {
  return res.status(400).json({ error: 'TaskId inválido' });
}
```

### **CORS**
```javascript
// Permitir acesso da extensão
res.setHeader('Access-Control-Allow-Origin', '*');
res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
```

### **Cache**
```javascript
// Headers de cache apropriados
res.setHeader('Cache-Control', 'public, max-age=3600');
res.setHeader('ETag', `"${stat.mtime.getTime()}"`);
```

## 🔧 Integração com Código Existente

### No `stream-download-api.js`:

```javascript
class StreamDownloadAPI {
  constructor(videoDownloader, port) {
    this.videoDownloader = videoDownloader;
    this.port = port;
    this.downloads = new Map(); // taskId -> downloadInfo
  }
  
  // Método existente para iniciar download
  async startDownload(url, options) {
    const taskId = generateTaskId();
    // ... lógica existente ...
    
    // Armazenar informações para stream posterior
    this.downloads.set(taskId, {
      taskId,
      url,
      outputPath: null, // será preenchido quando completar
      status: 'downloading'
    });
    
    return { taskId };
  }
  
  // Novo método para obter info do download
  getDownloadInfo(taskId) {
    return this.downloads.get(taskId);
  }
  
  // Atualizar quando download completar
  onDownloadComplete(taskId, outputPath) {
    const info = this.downloads.get(taskId);
    if (info) {
      info.outputPath = outputPath;
      info.status = 'completed';
    }
  }
}
```

## 🎯 Resultado Esperado

Com esta implementação:

- ✅ **Arquivo real** aparece em chrome://downloads
- ✅ **Nome correto** do vídeo
- ✅ **Tamanho real** do arquivo
- ✅ **Sem duplicação** de downloads
- ✅ **Performance otimizada** com streaming
- ✅ **Compatibilidade total** com navegador

**A extensão finalmente funcionará como esperado! 🚀**