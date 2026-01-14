# 📡 src/api - REST API v2.0

## Visão Geral

Esta pasta contém a **nova arquitetura REST API** em Node.js com:

✅ Separação clara de responsabilidades (MVC)  
✅ Sistema de fila de downloads (não bloqueia)  
✅ Server-Sent Events para progresso em tempo real  
✅ Validações e tratamento de erros  
✅ Cliente JavaScript pronto para usar  

---

## 📁 Estrutura

```
api/
├── models/
│   └── download.model.js           ← DownloadTask (estrutura de dados)
│
├── services/
│   ├── download-queue.js           ← Fila + Workers
│   ├── sse-manager.js              ← Server-Sent Events
│   ├── download.service.js         ← Orquestra downloads
│   └── streaming.service.js        ← Streaming yt-dlp → FFmpeg → HTTP
│
├── controllers/
│   ├── download.controller.js       ← HTTP handlers (downloads)
│   └── stream.controller.js         ← HTTP handlers (streaming)
│
├── routes/
│   ├── download.routes.js           ← Endpoints REST (downloads)
│   └── stream.routes.js             ← Endpoints REST (streaming)
│
├── utils/
│   └── validators.js                ← Validações
│
├── API_INTEGRATION_EXAMPLE.js       ← Como usar
└── README.md                        ← Este arquivo
```

---

## 🚀 Início Rápido

### 1. Integrar no main.js

```javascript
const { initializeRestAPI } = require('./api/API_INTEGRATION_EXAMPLE');

async function setupAPI() {
  const videoDownloader = new VideoDownloader();
  await videoDownloader.init();
  
  const server = await initializeRestAPI(videoDownloader);
  console.log('API rodando em http://localhost:9000');
}
```

### 2. Usar no Cliente (Browser)

```javascript
const DownloadClient = require('./api/js/download-client.js');
const client = new DownloadClient();

// Criar download
const result = await client.createDownload(url, { format: '720p' });

// Monitorar com SSE
client.startMonitoringSSE(result.taskId, {
  onProgress: (p) => console.log(`${p.progress}%`),
  onComplete: () => console.log('Done!'),
  onError: (e) => console.error(e)
});
```

### 3. Endpoints Disponíveis

#### Downloads
- `POST /api/download` - Criar download
- `GET /api/download/status/:taskId` - Status do download
- `GET /api/download/:taskId/file` - Baixar arquivo
- `GET /api/download/:taskId/sse` - Progresso via SSE
- `GET /api/downloads` - Listar downloads
- `POST /api/download/:taskId/cancel` - Cancelar download
- `GET /api/stats` - Estatísticas

#### Streaming (Nova)
- `POST /api/stream` - Criar stream
- `GET /api/stream/:taskId` - Stream de mídia (HTTP chunked)
- `GET /api/stream/:taskId/status` - Progresso do stream
- `POST /api/stream/:taskId/stop` - Parar stream

### 4. Testar

```bash
# Health check
curl http://localhost:9000/health

# Criar download
curl -X POST http://localhost:9000/api/download \
  -H "Content-Type: application/json" \
  -d '{"url":"https://...","format":"720p"}'

# Ver UI de teste
open browser-extension/public/example-download-ui.html
```

---

## 📊 Componentes

### Models (`models/`)

**DownloadTask** - Representa uma tarefa de download

```javascript
class DownloadTask {
  constructor(url, options) {
    this.taskId = 'task_...';
    this.status = 'pending';         // pending, downloading, merging, completed, error
    this.progress = 0;
    this.speed = '5.23 MiB/s';
    this.eta = '00:23';
    this.total = '123.45 MiB';
    // ... mais propriedades
  }
  
  updateProgress(data)     // Atualizar progresso
  markAsCompleted(file)    // Finalizar com sucesso
  markAsError(msg)         // Finalizar com erro
  toJSON()                 // Serializar para resposta HTTP
}
```

### Services (`services/`)

#### DownloadQueue
Gerencia uma fila de downloads com workers paralelos.

```javascript
class DownloadQueue extends EventEmitter {
  enqueue(task)                      // Adicionar à fila
  processNext()                      // Processar próxima
  markAsCompleted(taskId, file)      // Marcar como concluído
  markAsError(taskId, error)         // Marcar com erro
  cancel(taskId)                     // Cancelar tarefa
  getStats()                         // Obter estatísticas
  getTaskStatus(taskId)              // Obter status
}
```

**Eventos emitidos:**
- `task-queued` - Tarefa enfileirada
- `task-started` - Tarefa iniciada
- `task-completed` - Tarefa completa
- `task-error` - Erro na tarefa
- `task-cancelled` - Tarefa cancelada

#### SSEManager
Gerencia conexões Server-Sent Events.

```javascript
class SSEManager {
  subscribe(taskId, response)           // Cliente se conecta
  unsubscribe(taskId, response)         // Cliente desconecta
  broadcast(taskId, data)               // Enviar a todos
  sendEvent(taskId, eventName, data)    // Enviar evento específico
  closeAllSubscribers(taskId)           // Fechar todas as conexões
  getStats()                            // Estatísticas
}
```

#### DownloadService
Orquestra todo o processo.

```javascript
class DownloadService {
  createDownload(url, options)          // Criar novo download
  executeDownload(task)                 // Executar em background
  getTaskStatus(taskId)                 // Obter status
  getAllDownloads()                     // Listar todos
  cancelDownload(taskId)                // Cancelar
}
```

### Controllers (`controllers/`)

**DownloadController** - Manipula requisições HTTP

```javascript
class DownloadController {
  createDownload(req, res)              // POST /api/download
  getDownloadStatus(req, res)           // GET /api/download/status/:id
  streamProgress(req, res)              // GET /api/download/:id/sse
  getAllDownloads(req, res)             // GET /api/downloads
  cancelDownload(req, res)              // POST /api/download/:id/cancel
  getStats(req, res)                    // GET /api/stats
}
```

### Routes (`routes/`)

Define os endpoints REST.

```javascript
POST   /api/download                    // Criar download
GET    /api/download/status/:taskId     // Obter status
GET    /api/download/:taskId/sse        // Progresso (SSE)
GET    /api/downloads                   // Listar todos
POST   /api/download/:taskId/cancel     // Cancelar
GET    /api/stats                       // Estatísticas
```

### Utilities (`utils/`)

**validators.js** - Validações de entrada

```javascript
validateDownloadRequest(data)           // Validar POST /api/download
validateTaskId(taskId)                  // Validar taskId
```

---

## 🔌 Endpoints

### POST /api/download
**Criar novo download**

```bash
curl -X POST http://localhost:9000/api/download \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://www.youtube.com/watch?v=...",
    "format": "720p",
    "outputPath": "/downloads",
    "audioOnly": false,
    "subtitles": true
  }'
```

**Response:**
```json
{
  "taskId": "task_1705000000000_abc123",
  "status": "pending",
  "message": "Download enfileirado"
}
```

### GET /api/download/status/:taskId
**Obter status (polling)**

```bash
curl http://localhost:9000/api/download/status/task_abc123
```

**Response:**
```json
{
  "taskId": "task_abc123",
  "status": "downloading",
  "phase": "download",
  "progress": 45.5,
  "speed": "5.23 MiB/s",
  "eta": "00:23",
  "total": "123.45 MiB",
  "downloaded": "56.12 MiB",
  "elapsedTime": "00:12:34",
  "outputPath": null,
  "error": null
}
```

### GET /api/download/:taskId/sse
**Server-Sent Events (tempo real)**

```bash
curl http://localhost:9000/api/download/task_abc123/sse
```

**Response (text/event-stream):**
```
data: {"taskId":"task_...","status":"downloading","progress":10,...}

data: {"taskId":"task_...","status":"downloading","progress":20,...}

data: {"taskId":"task_...","status":"merging","progress":85,...}

data: {"taskId":"task_...","status":"completed","progress":100,...}

event: error
data: {"error":"Arquivo corrompido"}
```

### GET /api/downloads
**Listar todos os downloads**

```bash
curl http://localhost:9000/api/downloads
```

**Response:**
```json
{
  "count": 3,
  "downloads": [
    {"taskId":"task_1","status":"downloading","progress":50},
    {"taskId":"task_2","status":"pending","progress":0},
    {"taskId":"task_3","status":"completed","progress":100}
  ],
  "stats": {
    "queue": {"pending":1,"active":1,"completed":1,"failed":0},
    "sse": {"activeTasks":1,"totalSubscribers":1}
  }
}
```

### POST /api/download/:taskId/cancel
**Cancelar um download**

```bash
curl -X POST http://localhost:9000/api/download/task_abc123/cancel
```

**Response:**
```json
{
  "taskId": "task_abc123",
  "status": "cancelled",
  "message": "Download cancelado com sucesso"
}
```

### GET /api/stats
**Estatísticas**

```bash
curl http://localhost:9000/api/stats
```

**Response:**
```json
{
  "timestamp": "2026-01-12T02:30:00Z",
  "stats": {
    "queue": {
      "pending": 2,
      "active": 1,
      "completed": 5,
      "failed": 0,
      "total": 8
    },
    "sse": {
      "activeTasks": 1,
      "totalSubscribers": 2,
      "taskIds": ["task_..."]
    }
  }
}
```

---

## 🔄 Fluxo

```
Cliente (Browser)
    ↓
POST /api/download
    ↓
Controller (valida)
    ↓
Service (cria DownloadTask)
    ↓
Queue (enfileira)
    ↓
Retorna { taskId } imediatamente (não bloqueia)
    ↓
Queue (inicia ytdlp em background)
    ↓
VideoDownloader + ProgressParser
    ↓
SSEManager (envia progresso)
    ↓
Cliente (recebe via SSE)
    ↓
UI atualiza (progress bar, etc)
```

---

## 💡 Exemplos

### JavaScript (Browser)

```javascript
const client = new DownloadClient('http://localhost:9000');

// Criar download
const result = await client.createDownload(
  'https://www.youtube.com/watch?v=...',
  { format: '720p' }
);

// Monitorar com SSE
client.startMonitoringSSE(result.taskId, {
  onProgress: (p) => {
    console.log(`${p.progress}% - ${p.speed}`);
    updateProgressBar(p.progress);
  },
  onComplete: (f) => {
    console.log('✅ Completo!', f.outputPath);
  },
  onError: (e) => {
    console.error('❌ Erro:', e.error);
  }
});

// Cancelar
await client.cancelDownload(result.taskId);
```

### Node.js (Backend)

```javascript
const express = require('express');
const { createDownloadRouter } = require('./routes/download.routes');
const DownloadService = require('./services/download.service');

const app = express();
app.use(express.json());

const router = createDownloadRouter(downloadController);
app.use('/api', router);

app.listen(9000);
```

---

## ⚙️ Configuração

### Máximo de Downloads Paralelos

```javascript
const queue = new DownloadQueue(2); // Max 2 simultâneos
```

Ajuste conforme sua capacidade de CPU/IO.

### Cleanup Automático

```javascript
setInterval(() => {
  queue.cleanup(60); // Remove completados/falhos > 60 minutos
}, 3600000); // A cada 1 hora
```

### CORS

```javascript
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  next();
});
```

---

## 📈 Performance

| Aspecto | Valor |
|---------|-------|
| Máx paralelos | 2 (configurável) |
| Latência SSE | ~0ms (push) |
| Latência Polling | 1000ms (configurável) |
| Memory/tarefa | ~1 MB (após cleanup) |
| Max em fila | Ilimitado (configurável) |

---

## 🧪 Testes

### Health Check
```bash
curl http://localhost:9000/health
```

### Criar Download
```bash
curl -X POST http://localhost:9000/api/download \
  -H "Content-Type: application/json" \
  -d '{"url":"https://...","format":"720p"}'
```

### Monitorar (Node.js)
```javascript
const fetch = require('node-fetch');
const url = 'http://localhost:9000/api/download/task_abc/sse';
const response = await fetch(url);
response.body.on('data', d => console.log(d.toString()));
```

---

## 🐛 Troubleshooting

**API não responde?**
- Verificar se servidor está rodando: `curl http://localhost:9000/health`
- Ver console do Electron para erros

**Download não inicia?**
- Verificar se ytdlp está instalado
- Ver `videoDownloader.init()` foi chamado

**Progresso não aparece?**
- Verificar conexão SSE está aberta
- Verificar se ProgressParser está extraindo dados
- Ver logs do servidor

**Múltiplos downloads não paralelos?**
- Aumentar `new DownloadQueue(4)` para mais paralelos
- Verificar se há recursos disponíveis (CPU/IO)

---

## 📚 Referências

- [API_ARCHITECTURE.md](../docs/API_ARCHITECTURE.md) - Diagramas
- [API_COMPLETE_SCHEMA.md](../docs/API_COMPLETE_SCHEMA.md) - Esquema
- [API_INTEGRATION_EXAMPLE.js](./API_INTEGRATION_EXAMPLE.js) - Exemplos
- [download-client.js](../../browser-extension/public/js/download-client.js) - Cliente JS
- [example-download-ui.html](../../browser-extension/public/example-download-ui.html) - UI

---

**Status**: ✅ Pronto para Produção

*Para mais detalhes, ver `QUICK_START.js` ou `docs/API_ARCHITECTURE.md`*
