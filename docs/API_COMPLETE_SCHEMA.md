# 🎬 YTDLN REST API - ESQUEMA COMPLETO

**Versão**: 2.0  
**Data**: Janeiro 2026  
**Framework**: Node.js + Express  
**Status**: ✅ Pronto para implementação

---

## 📋 ÍNDICE

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Estrutura de Pastas](#estrutura-de-pastas)
4. [Componentes Principais](#componentes-principais)
5. [Endpoints REST](#endpoints-rest)
6. [Fluxo de Dados](#fluxo-de-dados)
7. [Estados do Download](#estados-do-download)
8. [Como Usar](#como-usar)
9. [Exemplos Práticos](#exemplos-práticos)
10. [Performance & Escalabilidade](#performance--escalabilidade)

---

## 🎯 Visão Geral

Este é um esquema completo de uma **API REST em Node.js** para gerenciar downloads de vídeos com:

✅ **Progresso em Tempo Real** via Server-Sent Events (SSE)  
✅ **Fila de Processamento** (não bloqueia thread principal)  
✅ **Integração yt-dlp + ffmpeg** (sem travar)  
✅ **Múltiplos Downloads Simultâneos** (configurável)  
✅ **Status Detalhado** (downloading, merging, done, error)  
✅ **Cliente JavaScript** completo e funcional  
✅ **Separação Clara de Responsabilidades** (MVC/Service Pattern)

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENTE (Browser/Extension)               │
│  POST /api/download  │  GET /api/download/status/:id         │
│  GET /api/download/:id/sse (SSE)                             │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTP
┌──────────────────────▼──────────────────────────────────────┐
│               EXPRESS SERVER (9000)                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Routes Layer (download.routes.js)                      │ │
│  │  ├─ POST /api/download → createDownload()             │ │
│  │  ├─ GET /api/download/status/:taskId                  │ │
│  │  ├─ GET /api/download/:taskId/sse                     │ │
│  │  └─ POST /api/download/:taskId/cancel                 │ │
│  └──────────────────┬───────────────────────────────────┘ │
│                     │                                        │
│  ┌──────────────────▼───────────────────────────────────┐ │
│  │ Controllers Layer (download.controller.js)           │ │
│  │  ├─ Validações (validators.js)                       │ │
│  │  └─ Orquestração                                     │ │
│  └──────────────────┬───────────────────────────────────┘ │
│                     │                                        │
│  ┌──────────────────▼───────────────────────────────────┐ │
│  │ Services Layer                                       │ │
│  │  ├─ DownloadService (orquestração)                   │ │
│  │  ├─ DownloadQueue (fila + workers)                   │ │
│  │  └─ SSEManager (progresso em tempo real)             │ │
│  └──────────────────┬───────────────────────────────────┘ │
│                     │                                        │
│  ┌──────────────────▼───────────────────────────────────┐ │
│  │ Models Layer (download.model.js)                     │ │
│  │  └─ DownloadTask (estrutura de dados)                │ │
│  └──────────────────┬───────────────────────────────────┘ │
└─────────────────────┼───────────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        │             │             │
    ┌───▼──────┐  ┌───▼──────┐  ┌──▼───────┐
    │VideoDown-│  │Progress- │  │yt-dlp +  │
    │loader    │  │Parser    │  │ffmpeg    │
    │          │  │          │  │subprocess│
    └──────────┘  └──────────┘  └──────────┘
```

---

## 📁 Estrutura de Pastas

```
ytdln-open/
│
├── src/
│   ├── main.js (Electron entry point)
│   ├── video-downloader.js (Base downloader)
│   ├── progress-parser.js (Parser de progresso)
│   │
│   └── api/ ✨ NOVA ARQUITETURA
│       │
│       ├── models/
│       │   └── download.model.js
│       │       Class: DownloadTask
│       │       - taskId, url, format
│       │       - status, phase, progress
│       │       - speed, eta, total
│       │       - toJSON(), updateProgress()
│       │
│       ├── services/
│       │   ├── download-queue.js
│       │   │   Class: DownloadQueue (extends EventEmitter)
│       │   │   - enqueue(task)
│       │   │   - processNext()
│       │   │   - markAsCompleted(taskId, file)
│       │   │   - markAsError(taskId, error)
│       │   │   - getStats()
│       │   │
│       │   ├── sse-manager.js
│       │   │   Class: SSEManager
│       │   │   - subscribe(taskId, response)
│       │   │   - broadcast(taskId, data)
│       │   │   - sendEvent(taskId, eventName, data)
│       │   │   - closeAllSubscribers(taskId)
│       │   │
│       │   └── download.service.js
│       │       Class: DownloadService
│       │       - createDownload(url, options)
│       │       - executeDownload(task)
│       │       - getTaskStatus(taskId)
│       │
│       ├── controllers/
│       │   └── download.controller.js
│       │       Class: DownloadController
│       │       - createDownload(req, res)
│       │       - getDownloadStatus(req, res)
│       │       - streamProgress(req, res)
│       │       - cancelDownload(req, res)
│       │
│       ├── routes/
│       │   └── download.routes.js
│       │       createDownloadRouter(controller)
│       │       - POST /api/download
│       │       - GET /api/download/status/:taskId
│       │       - GET /api/download/:taskId/sse
│       │       - POST /api/download/:taskId/cancel
│       │
│       ├── utils/
│       │   └── validators.js
│       │       - validateDownloadRequest()
│       │       - validateTaskId()
│       │
│       └── API_INTEGRATION_EXAMPLE.js
│           Exemplo de como integrar no main.js
│
├── browser-extension/
│   ├── src/
│   │   ├── popup.js (Extensão popup)
│   │   ├── background.js (Service worker)
│   │   └── content.js (Content script)
│   │
│   └── public/
│       ├── js/
│       │   └── download-client.js
│       │       Class: DownloadClient
│       │       - createDownload(url, options)
│       │       - startMonitoringSSE(taskId, callbacks)
│       │       - startMonitoringPolling(taskId, callbacks)
│       │       - cancelDownload(taskId)
│       │
│       └── example-download-ui.html
│           UI completa e funcional para testar
│
└── docs/
    ├── API_ARCHITECTURE.md (Diagramas ASCII)
    └── API_COMPLETE_SCHEMA.md (Este arquivo)
```

---

## 🔧 Componentes Principais

### 1. **DownloadTask** (Model)

Representa uma tarefa de download com toda sua informação.

```javascript
const task = new DownloadTask(url, {
  format: '720p',
  outputPath: '/downloads',
  audioOnly: false,
  subtitles: true
});

// Propriedades
task.taskId         // "task_1705000000000_abc"
task.status         // "pending|downloading|merging|completed|error"
task.progress       // 0-100
task.speed          // "5.23 MiB/s"
task.eta            // "00:23"
task.total          // "123.45 MiB"
task.outputFile     // "/downloads/video.mp4" (ao completar)
```

### 2. **DownloadQueue** (Service)

Gerencia uma fila de downloads com workers paralelos.

```javascript
const queue = new DownloadQueue(2); // Max 2 simultâneos

// Enfileirar uma tarefa
const taskId = queue.enqueue(downloadTask);

// Eventos emitidos
queue.on('task-started', (task) => {});
queue.on('task-completed', (task) => {});
queue.on('task-error', (task) => {});

// Métodos úteis
queue.getStats()        // { pending, active, completed, failed }
queue.getTaskStatus(id) // Info da tarefa
queue.cancel(taskId)    // Cancelar download
```

### 3. **SSEManager** (Service)

Gerencia conexões Server-Sent Events.

```javascript
const sse = new SSEManager();

// Quando cliente conecta a /api/download/:id/sse
sse.subscribe(taskId, response);

// Quando há progresso
sse.broadcast(taskId, {
  taskId: "...",
  progress: 45,
  speed: "5.23 MiB/s",
  eta: "00:23"
});

// Ao terminar
sse.closeAllSubscribers(taskId);
```

### 4. **DownloadService** (Service)

Orquestra todo o processo de download.

```javascript
const service = new DownloadService(
  videoDownloader,
  downloadQueue,
  sseManager
);

// Criar novo download
const result = service.createDownload(url, options);
// Retorna: { taskId, status, message }

// Executado automaticamente pelo queue
await service.executeDownload(task);

// Obter status
const status = service.getTaskStatus(taskId);
```

### 5. **DownloadController** (Controller)

Manipula requisições HTTP.

```javascript
const controller = new DownloadController(downloadService);

// Cada método corresponde a um endpoint
await controller.createDownload(req, res);
await controller.getDownloadStatus(req, res);
await controller.streamProgress(req, res);
await controller.cancelDownload(req, res);
```

### 6. **DownloadClient** (Cliente JavaScript)

Cliente para consumir a API no navegador.

```javascript
const client = new DownloadClient('http://localhost:9000');

// Criar download
const result = await client.createDownload(url, {
  format: '720p',
  audioOnly: false
});

// Monitorar com SSE
client.startMonitoringSSE(result.taskId, {
  onProgress: (progress) => {
    console.log(`${progress.progress}%`);
  },
  onComplete: (final) => {
    console.log('Download completo!');
  },
  onError: (error) => {
    console.error(error.error);
  }
});

// Cancelar
await client.cancelDownload(result.taskId);
```

---

## 🔌 Endpoints REST

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

**Response (200):**
```json
{
  "taskId": "task_1705000000000_abc123",
  "status": "pending",
  "message": "Download enfileirado"
}
```

---

### GET /api/download/status/:taskId
**Obter status atual**

```bash
curl http://localhost:9000/api/download/status/task_1705000000000_abc123
```

**Response (200):**
```json
{
  "taskId": "task_1705000000000_abc123",
  "status": "downloading",
  "phase": "download",
  "progress": 45.5,
  "speed": "5.23 MiB/s",
  "eta": "00:23",
  "total": "123.45 MiB",
  "downloaded": "56.12 MiB",
  "startTime": 1705000000000,
  "elapsedTime": "00:12:34",
  "outputPath": null,
  "error": null,
  "url": "https://..."
}
```

---

### GET /api/download/:taskId/sse
**Server-Sent Events - Progresso em Tempo Real**

```javascript
const eventSource = new EventSource(
  'http://localhost:9000/api/download/task_abc123/sse'
);

eventSource.onmessage = (event) => {
  const progress = JSON.parse(event.data);
  console.log(`${progress.progress}% - ${progress.speed}`);
};

eventSource.addEventListener('error', (e) => {
  console.error('Erro:', JSON.parse(e.data));
});
```

**Stream (exemplo):**
```
data: {"taskId":"task_...","status":"downloading","progress":10,...}

data: {"taskId":"task_...","status":"downloading","progress":20,...}

data: {"taskId":"task_...","status":"merging","progress":85,...}

data: {"taskId":"task_...","status":"completed","progress":100,...}

event: error
data: {"error":"Arquivo corrompido"}
```

---

### POST /api/download/:taskId/cancel
**Cancelar um download**

```bash
curl -X POST http://localhost:9000/api/download/task_abc123/cancel
```

**Response (200):**
```json
{
  "taskId": "task_abc123",
  "status": "cancelled",
  "message": "Download cancelado com sucesso"
}
```

---

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
    { "taskId": "...", "status": "downloading", "progress": 50 },
    { "taskId": "...", "status": "pending", "progress": 0 },
    { "taskId": "...", "status": "completed", "progress": 100 }
  ],
  "stats": {
    "queue": { "pending": 1, "active": 1, "completed": 1, "failed": 0 },
    "sse": { "activeTasks": 2, "totalSubscribers": 3 }
  }
}
```

---

### GET /api/stats
**Estatísticas da API**

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

## 🔄 Fluxo de Dados

```
1. CLIENTE
   └─ POST /api/download
      { url, format, audioOnly, subtitles }

2. CONTROLLER (download.controller.js)
   └─ Valida entrada
   └─ Chama downloadService.createDownload()

3. SERVICE (download.service.js)
   └─ Cria DownloadTask
   └─ Enfileira em DownloadQueue

4. QUEUE (download-queue.js)
   └─ Enfileira tarefa
   └─ Se há espaço, emite 'task-started'
   └─ Retorna imediatamente ao cliente

5. SERVICE (recebe 'task-started')
   └─ Chama executeDownload()
   └─ Inicia VideoDownloader em background
   └─ Ativa ProgressParser

6. PROGRESS
   └─ yt-dlp emite: "[download] 10% of 100MiB at 5MiB/s ETA 00:19"
   └─ ProgressParser extrai dados
   └─ DownloadTask atualiza progress
   └─ SSEManager envia aos subscribers via SSE

7. CLIENTE (SSE)
   └─ Recebe: { progress: 10, speed: "5 MiB/s", eta: "00:19" }
   └─ Atualiza UI (progress bar, etc)

8. CONCLUSÃO
   └─ yt-dlp termina
   └─ DownloadTask marcado como 'completed'
   └─ Queue processa próxima tarefa
   └─ SSEManager envia status final e fecha conexão
```

---

## 🎯 Estados do Download

```
┌─────────────┬─────────────┬─────────────────────────────────────┐
│  Status     │  Phase      │  Descrição                          │
├─────────────┼─────────────┼─────────────────────────────────────┤
│ pending     │ -           │ Aguardando processamento (na fila)   │
│ downloading │ "download"  │ Baixando stream de vídeo             │
│ merging     │ "merge"     │ Fundindo áudio + vídeo (ffmpeg)      │
│ processing  │ "postproc"  │ Pós-processamento (legenda, etc)     │
│ completed   │ -           │ ✅ Completado com sucesso            │
│ error       │ -           │ ❌ Erro durante processamento        │
│ cancelled   │ -           │ ⏸️  Cancelado pelo usuário            │
└─────────────┴─────────────┴─────────────────────────────────────┘
```

---

## 📖 Como Usar

### 1. Integrar no main.js (Electron)

```javascript
// src/main.js

const { initializeRestAPI } = require('./api/API_INTEGRATION_EXAMPLE');

async function onAppReady() {
  // ... código existente ...
  
  const videoDownloader = new VideoDownloader();
  await videoDownloader.init();
  
  // Inicializar nova API
  const server = await initializeRestAPI(videoDownloader);
  
  // ... resto do código ...
}

app.on('before-quit', () => {
  server.close();
});
```

### 2. Usar no Navegador/Extensão

```html
<!-- Carregar cliente -->
<script src="js/download-client.js"></script>

<script>
  const client = new DownloadClient();
  
  // Criar download
  const result = await client.createDownload(url);
  
  // Monitorar
  client.startMonitoringSSE(result.taskId, {
    onProgress: (p) => console.log(p.progress + '%'),
    onComplete: (f) => console.log('Done!'),
    onError: (e) => console.error(e.error)
  });
</script>
```

### 3. Testar Manualmente

```bash
# Iniciar servidor (Execute YTDLN Desktop)
# O servidor rodará em http://localhost:9000

# Health check
curl http://localhost:9000/health

# Criar download
curl -X POST http://localhost:9000/api/download \
  -H "Content-Type: application/json" \
  -d '{"url":"https://...","format":"720p"}'

# Monitorar com SSE no navegador
# Abra: browser-extension/public/example-download-ui.html
```

---

## 💡 Exemplos Práticos

### Exemplo 1: Download Simples + SSE

```javascript
const client = new DownloadClient();

async function downloadVideo() {
  // 1. Criar download
  const result = await client.createDownload(
    'https://www.youtube.com/watch?v=...',
    { format: '720p' }
  );

  // 2. Monitorar com SSE
  client.startMonitoringSSE(result.taskId, {
    onProgress: (p) => {
      document.getElementById('progress').style.width = p.progress + '%';
      document.getElementById('text').textContent = 
        `${p.progress}% - ${p.speed} - ETA: ${p.eta}`;
    },
    onComplete: (final) => {
      alert('✅ Download concluído!');
      console.log('Arquivo:', final.outputPath);
    },
    onError: (err) => {
      alert('❌ Erro: ' + err.error);
    }
  });
}
```

### Exemplo 2: Polling (Alternativa ao SSE)

```javascript
async function downloadWithPolling() {
  const client = new DownloadClient();
  
  // Criar download
  const result = await client.createDownload(url);
  
  // Polling a cada 1 segundo
  client.startMonitoringPolling(result.taskId, {
    onProgress: (status) => {
      console.log(`${status.progress}% - ${status.speed}`);
      updateUI(status);
    },
    onComplete: () => console.log('Done!'),
    onError: (err) => console.error(err)
  }, 1000); // Check every second
}
```

### Exemplo 3: Múltiplos Downloads

```javascript
const client = new DownloadClient();
const downloads = [];

async function downloadMultiple(urls) {
  for (const url of urls) {
    const result = await client.createDownload(url);
    downloads.push(result.taskId);
    
    // Monitorar cada um
    client.startMonitoringSSE(result.taskId, {
      onProgress: (p) => updateUI(result.taskId, p)
    });
  }
}

// Listar todos
async function showAllDownloads() {
  const all = await client.getAllDownloads();
  console.log(all.downloads);
}
```

### Exemplo 4: Cancelar Download

```javascript
let currentTaskId = null;

// Iniciar
const result = await client.createDownload(url);
currentTaskId = result.taskId;
client.startMonitoringSSE(currentTaskId, {...});

// Cancelar depois
document.getElementById('cancelBtn').onclick = async () => {
  await client.cancelDownload(currentTaskId);
  console.log('Cancelado!');
};
```

---

## ⚡ Performance & Escalabilidade

### Queue com Limite de Concorrência

```javascript
// Máximo 2 downloads simultâneos
const queue = new DownloadQueue(2);

// Benefícios:
// ✅ Não trava Express (non-blocking)
// ✅ Não sobrecarrega CPU/I/O
// ✅ Downloads iniciados em orden
// ✅ Fácil monitorar progresso
```

### SSE vs Polling

| Aspecto | SSE | Polling |
|---------|-----|---------|
| Latência | ~0ms (push) | 500-2000ms |
| Banda | Muito baixa | Média-Alta |
| Implementação | Mais simples | Mais simples ainda |
| Compatibilidade | IE10+ | Todos |
| **Recomendado** | ✅ Para produção | Para fallback |

### Memory Management

```javascript
// ProgressHistory limitado a 100 entradas
progressHistory.push({...});
if (progressHistory.length > 100) {
  progressHistory.shift();
}

// Cache cleanup (a cada hora)
setInterval(() => {
  queue.cleanup(60); // Remove completados/falhos > 60min
}, 3600000);
```

### Escalabilidade Futura

- **Redis Cache**: Armazenar progresso em Redis (multi-instância)
- **WebSocket**: Substituir SSE por WebSocket (full-duplex)
- **Database**: PostgreSQL/SQLite para persistência
- **Retry Logic**: Retry automático em falhas de rede
- **Load Balancer**: Múltiplas instâncias do servidor

---

## 📦 Arquivos Criados/Modificados

```
✨ NOVO - src/api/models/download.model.js
✨ NOVO - src/api/services/download-queue.js
✨ NOVO - src/api/services/sse-manager.js
✨ NOVO - src/api/services/download.service.js
✨ NOVO - src/api/controllers/download.controller.js
✨ NOVO - src/api/routes/download.routes.js
✨ NOVO - src/api/utils/validators.js
✨ NOVO - src/api/API_INTEGRATION_EXAMPLE.js
✨ NOVO - browser-extension/public/js/download-client.js
✨ NOVO - browser-extension/public/example-download-ui.html
✅ MODIFICADO - src/video-downloader.js (para retornar dados parseados)
✅ MODIFICADO - src/progress-parser.js (novo arquivo criado anteriormente)
📄 NOVO - docs/API_ARCHITECTURE.md (Diagramas ASCII)
📄 NOVO - docs/API_COMPLETE_SCHEMA.md (Este documento)
```

---

## 🚀 Próximos Passos

1. **Integrar no main.js**
   - Substituir StreamDownloadAPI antigo
   - Testar com Electron

2. **Atualizar popup.js**
   - Usar novo DownloadClient
   - Exibir progresso com SSE

3. **Adicionar Testes**
   - Unit tests para cada serviço
   - Integration tests para fluxo completo

4. **Melhorias Opcionais**
   - WebSocket em vez de SSE
   - Persistência em banco de dados
   - Autenticação/Autorização

---

## 📞 Suporte

Para dúvidas ou problemas:
- Ver diagramas em `docs/API_ARCHITECTURE.md`
- Ver exemplos em `src/api/API_INTEGRATION_EXAMPLE.js`
- Ver cliente em `browser-extension/public/js/download-client.js`
- Ver UI de teste em `browser-extension/public/example-download-ui.html`

---

**Status**: ✅ Pronto para usar!  
**Última Atualização**: Janeiro 2026

