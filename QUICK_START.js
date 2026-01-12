#!/usr/bin/env node

/**
 * QUICK START - Primeiros passos com a nova API REST
 * 
 * Este script ajuda você a entender e testar a nova arquitetura
 * da API REST de downloads
 */

console.log(`
╔════════════════════════════════════════════════════════════════════╗
║         🎬 YTDLN REST API v2.0 - QUICK START                      ║
╚════════════════════════════════════════════════════════════════════╝

Este documento explica como começar com a nova API REST.

`);

// ============================================================================
// 1. ENTENDER A ARQUITETURA
// ============================================================================

console.log(`
█ PASSO 1: ENTENDER A ARQUITETURA
═══════════════════════════════════════════════════════════════════════

A API é organizada em camadas (MVC + Service Pattern):

  CLIENT (Browser)
       │ HTTP
       ▼
  ROUTES (define endpoints)
       │
       ▼
  CONTROLLER (valida entrada, orquestra)
       │
       ▼
  SERVICES (lógica de negócio)
       │ ├─ DownloadService
       │ ├─ DownloadQueue (fila)
       │ └─ SSEManager (tempo real)
       │
       ▼
  MODELS (estrutura de dados)
       │
       ▼
  Integrações (VideoDownloader, ProgressParser)

📁 Arquivos principais:
   src/api/models/download.model.js         → DownloadTask
   src/api/services/download-queue.js       → Fila (max paralelos)
   src/api/services/download.service.js     → Orquestra tudo
   src/api/services/sse-manager.js          → Tempo real (SSE)
   src/api/controllers/download.controller.js → HTTP handlers
   src/api/routes/download.routes.js        → Endpoints

✅ Leia: docs/API_ARCHITECTURE.md para diagramas ASCII detalhados

`);

// ============================================================================
// 2. ESTRUTURA DE UMA TAREFA
// ============================================================================

console.log(`
█ PASSO 2: ENTENDER UMA TAREFA (DownloadTask)
═══════════════════════════════════════════════════════════════════════

Cada download é uma "tarefa" com estado completo:

  task = {
    taskId: "task_1705000000000_abc123",    ← ID único
    
    Entrada:
    url: "https://www.youtube.com/watch?v=...",
    format: "720p",
    audioOnly: false,
    subtitles: true,
    
    Estado:
    status: "downloading",                   ← pending|downloading|merging|completed|error
    phase: "download",                       ← download|merge|postproc
    
    Progresso:
    progress: 45.5,                          ← 0-100 %
    speed: "5.23 MiB/s",
    eta: "00:23",                            ← Tempo restante
    total: "123.45 MiB",
    downloaded: "56.12 MiB",
    
    Timing:
    startTime: 1705000000000,
    elapsedTime: "00:12:34",
    endTime: null,                           ← Até completar
    
    Resultado:
    outputFile: null,                        ← "/downloads/video.mp4" ao fim
    error: null                              ← Mensagem de erro
  }

`);

// ============================================================================
// 3. FLUXO SIMPLIFICADO
// ============================================================================

console.log(`
█ PASSO 3: FLUXO SIMPLIFICADO (O que acontece)
═══════════════════════════════════════════════════════════════════════

1️⃣  CLIENTE: POST /api/download
    ↓
    { url: "https://...", format: "720p" }

2️⃣  CONTROLLER: Valida entrada
    ↓
    Se OK: continua, se erro: retorna 400

3️⃣  SERVICE: Cria DownloadTask + enfileira
    ↓
    Retorna { taskId, status: "pending" } imediatamente

4️⃣  QUEUE: Processa (background)
    ↓
    Se há espaço (max 2): inicia download
    Se lotado: espera em fila

5️⃣  SERVICE: Executa ytdlp + ffmpeg
    ├─ Captura stdout
    ├─ ProgressParser extrai dados
    ├─ SSEManager envia aos clientes
    └─ Atualiza DownloadTask

6️⃣  CLIENTE: GET /api/download/:id/sse (SSE)
    ├─ Recebe: { progress: 45, speed: "5 MiB/s", ... }
    ├─ Atualiza UI
    └─ Conexão fica aberta até completar

7️⃣  CONCLUSÃO
    ├─ yt-dlp termina
    ├─ QUEUE processa próxima tarefa
    └─ SSEManager fecha conexão

`);

// ============================================================================
// 4. ENDPOINTS
// ============================================================================

console.log(`
█ PASSO 4: ENDPOINTS DISPONÍVEIS
═══════════════════════════════════════════════════════════════════════

1. POST /api/download
   ├─ Criar novo download
   ├─ Body: { url*, format?, audioOnly?, subtitles? }
   └─ Response: { taskId, status, message }

2. GET /api/download/status/:taskId
   ├─ Obter status (polling)
   ├─ Params: taskId
   └─ Response: { taskId, status, progress, speed, eta, ... }

3. GET /api/download/:taskId/sse
   ├─ Server-Sent Events (tempo real)
   ├─ Params: taskId
   └─ Response: text/event-stream (eventos contínuos)

4. GET /api/downloads
   ├─ Listar todos os downloads
   └─ Response: { count, downloads[], stats }

5. POST /api/download/:taskId/cancel
   ├─ Cancelar um download
   ├─ Params: taskId
   └─ Response: { taskId, status: "cancelled" }

6. GET /api/stats
   ├─ Estatísticas da fila
   └─ Response: { stats: { queue, sse } }

7. GET /health
   ├─ Health check
   └─ Response: { status, version, timestamp }

`);

// ============================================================================
// 5. EXEMPLO: CRIAR E MONITORAR
// ============================================================================

console.log(`
█ PASSO 5: EXEMPLO PRÁTICO (JavaScript)
═══════════════════════════════════════════════════════════════════════

// 1. Importar cliente
const DownloadClient = require('./browser-extension/public/js/download-client.js');
const client = new DownloadClient('http://localhost:9000');

// 2. Verificar conexão
const health = await client.checkHealth();
if (!health.connected) {
  console.error('Servidor offline!');
  return;
}

// 3. Criar download
const result = await client.createDownload(
  'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  {
    format: '720p',
    audioOnly: false,
    subtitles: true
  }
);

console.log('Tarefa criada:', result.taskId);

// 4. Monitorar com SSE (tempo real)
client.startMonitoringSSE(result.taskId, {
  onProgress: (progress) => {
    console.log(\`\${progress.progress}% - \${progress.speed} - ETA: \${progress.eta}\`);
    // Atualizar UI (progress bar, etc)
  },
  
  onComplete: (final) => {
    console.log('✅ Completo!', final.outputPath);
  },
  
  onError: (error) => {
    console.error('❌ Erro:', error.error);
  }
});

// 5. (Opcional) Cancelar depois
setTimeout(() => {
  client.cancelDownload(result.taskId);
}, 30000); // Cancelar após 30 segundos

`);

// ============================================================================
// 6. PADRÕES DE RESPOSTA
// ============================================================================

console.log(`
█ PASSO 6: ENTENDER AS RESPOSTAS
═══════════════════════════════════════════════════════════════════════

✅ SUCESSO (200, 201):
{
  "taskId": "task_1705000000000_abc123",
  "status": "downloading",
  "progress": 45,
  ...
}

⚠️  ERRO (400, 404, 500):
{
  "error": "Descrição do erro",
  "code": "INVALID_URL",              ← Código específico
  "timestamp": "2026-01-12T02:30:00Z",
  "taskId": "task_..." (opcional)
}

🔄 STREAMING (SSE - text/event-stream):
data: {"taskId":"...","status":"downloading","progress":10,...}
data: {"taskId":"...","status":"downloading","progress":20,...}
...
event: error
data: {"error":"Arquivo corrompido"}

`);

// ============================================================================
// 7. TESTANDO
// ============================================================================

console.log(`
█ PASSO 7: TESTANDO A API
═══════════════════════════════════════════════════════════════════════

OPÇÃO 1: Usar exemplo HTML fornecido
─────────────────────────────────────
  1. Abra: browser-extension/public/example-download-ui.html
  2. Insira uma URL de vídeo
  3. Clique em "Iniciar Download"
  4. Veja o progresso em tempo real

OPÇÃO 2: Testar com curl
────────────────────────
  # Health check
  curl http://localhost:9000/health

  # Criar download
  curl -X POST http://localhost:9000/api/download \\
    -H "Content-Type: application/json" \\
    -d '{
      "url": "https://www.youtube.com/watch?v=...",
      "format": "720p"
    }'

  # Obter status (substitua TASKID)
  curl http://localhost:9000/api/download/status/TASKID

OPÇÃO 3: Node.js script
───────────────────────
  const client = require('./browser-extension/public/js/download-client.js');
  // ... código do exemplo acima ...

OPÇÃO 4: Insomnia/Postman
──────────────────────────
  1. Importe: docs/API_COMPLETE_SCHEMA.md (endpoints)
  2. Configure request POST /api/download
  3. Execute!

`);

// ============================================================================
// 8. INTEGRANDO NO SEU CÓDIGO
// ============================================================================

console.log(`
█ PASSO 8: INTEGRAR NO CÓDIGO EXISTENTE
═══════════════════════════════════════════════════════════════════════

No seu main.js (Electron):

  const { initializeRestAPI } = require('./api/API_INTEGRATION_EXAMPLE');
  
  async function onAppReady() {
    const videoDownloader = new VideoDownloader();
    await videoDownloader.init();
    
    // Inicializar nova API REST
    const server = await initializeRestAPI(videoDownloader);
    
    // ... resto do código ...
  }

Na extensão do navegador (popup.js):

  const client = new DownloadClient('http://localhost:9000');
  
  document.getElementById('downloadBtn').onclick = async () => {
    const url = document.getElementById('url').value;
    const result = await client.createDownload(url);
    
    client.startMonitoringSSE(result.taskId, {
      onProgress: updateUI,
      onComplete: showSuccess,
      onError: showError
    });
  };

`);

// ============================================================================
// 9. ENTENDER A FILA
// ============================================================================

console.log(`
█ PASSO 9: COMO A FILA FUNCIONA
═══════════════════════════════════════════════════════════════════════

Por padrão: MAX 2 downloads simultâneos

Timeline:
┌──────────────────────────────────────────────────────┐
│ T=0s: Cliente 1 → POST /download (task1)              │
│       └─ Retorna: { taskId: "task1", status: "pending" } IMEDIATAMENTE
│                                                       │
│ T=0.1s: Cliente 2 → POST /download (task2)            │
│         └─ Retorna: { taskId: "task2", status: "pending" } IMEDIATAMENTE
│                                                       │
│ T=0.2s: Cliente 3 → POST /download (task3)            │
│         └─ Retorna: { taskId: "task3", status: "pending" } IMEDIATAMENTE
│                                                       │
│ T=1s: QUEUE inicia task1 e task2 (max 2)              │
│       task3 fica em fila esperando                    │
│                                                       │
│ T=301s: task1 completa                                │
│         task3 é iniciada (tira a fila)                │
│                                                       │
│ T=601s: task2 completa                                │
│                                                       │
│ T=900s: task3 completa                                │
└──────────────────────────────────────────────────────┘

BENEFÍCIOSSS:
✅ Express NUNCA bloqueia (não aguarda download)
✅ Clientes recebem taskId em millisegundos
✅ UI não congela
✅ Múltiplos downloads em paralelo
✅ Não sobrecarrega sistema

`);

// ============================================================================
// 10. CHECKLIST
// ============================================================================

console.log(`
█ PASSO 10: CHECKLIST FINAL
═══════════════════════════════════════════════════════════════════════

□ Revisei docs/API_ARCHITECTURE.md (diagramas)
□ Revisei docs/API_COMPLETE_SCHEMA.md (esquema completo)
□ Entendi a estrutura de pastas (src/api/...)
□ Entendi DownloadTask (modelo)
□ Entendi DownloadQueue (fila)
□ Entendi SSEManager (tempo real)
□ Entendi DownloadService (orquestra)
□ Testei com curl os endpoints
□ Testei com o HTML de exemplo
□ Integrei no meu código

═══════════════════════════════════════════════════════════════════════

🎉 SUCESSO! Você está pronto para usar a API REST v2.0!

📚 Referências:
   • docs/API_ARCHITECTURE.md
   • docs/API_COMPLETE_SCHEMA.md
   • src/api/API_INTEGRATION_EXAMPLE.js
   • browser-extension/public/js/download-client.js
   • browser-extension/public/example-download-ui.html

💡 Dúvidas?
   → Ver exemplos em API_INTEGRATION_EXAMPLE.js
   → Ver cliente em download-client.js
   → Rodar exemplo HTML (example-download-ui.html)

═══════════════════════════════════════════════════════════════════════

`);

// ============================================================================
// CÓDIGO EXECUTÁVEL
// ============================================================================

// Se executado como script (node quick-start.js)
if (require.main === module) {
  console.log(`
✅ Este é um guia de referência.

Para começar:
  1. Leia este arquivo completamente
  2. Abra: browser-extension/public/example-download-ui.html
  3. Inicie YTDLN Desktop
  4. Faça um download de teste!

Boa sorte! 🚀

`);
}

module.exports = {
  guide: 'Veja o console para o guia completo'
};
