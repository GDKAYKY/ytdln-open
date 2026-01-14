# 📋 Revisão Completa das Rotas da API

## 🔍 Resumo Executivo

A API possui **duas versões** rodando em portas diferentes:
- **API v1.0** (porta 9000): `stream-download-api.js` - Mantida para compatibilidade
- **API v2.0** (porta 9001): Express Router - Nova implementação REST

---

## 🌐 API v2.0 (Porta 9001) - Express Router

### Health Check
```
GET /health
```
**Resposta:**
```json
{
  "status": "ok",
  "version": "2.0.0",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "queue": { ... },
  "streaming": { ... }
}
```

---

### 📥 Rotas de Download (`/api`)

#### 1. Criar Download
```
POST /api/download
```
**Body:**
```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "format": "best",
  "outputPath": null,
  "audioOnly": false,
  "subtitles": false
}
```
**Response:** `{ taskId, status, message }`

#### 2. Status do Download
```
GET /api/download/status/:taskId
```
**Response:** `{ taskId, status, progress, ... }`

#### 3. Baixar Arquivo
```
GET /api/download/:taskId/file
```
**Response:** Arquivo binário (video/audio)
**Headers:**
- `Content-Type`: `application/octet-stream`
- `Content-Disposition`: `attachment; filename="..."`

#### 4. Progresso SSE (Server-Sent Events)
```
GET /api/download/:taskId/sse
```
**Response:** `text/event-stream`
**Eventos:**
- `progress`: Atualizações de progresso
- `complete`: Download completo
- `error`: Erro no download

#### 5. Listar Downloads
```
GET /api/downloads
```
**Response:** `{ count, downloads[], stats }`

#### 6. Cancelar Download
```
POST /api/download/:taskId/cancel
```
**Response:** `{ taskId, status, message }`

#### 7. Estatísticas
```
GET /api/stats
```
**Response:** `{ timestamp, stats }`

---

### 📡 Rotas de Streaming (`/api`)

#### 1. Criar Stream
```
POST /api/stream
```
**Body:**
```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "format": "best",
  "audioOnly": false
}
```
**Response:**
```json
{
  "taskId": "stream_1234567890_abc",
  "status": "streaming",
  "streamUrl": "/api/stream/stream_1234567890_abc",
  "statusUrl": "/api/stream/stream_1234567890_abc/status",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### 2. Status do Stream
```
GET /api/stream/:taskId/status
```
**Response:**
```json
{
  "taskId": "stream_1234567890_abc",
  "status": "downloading|completed|error",
  "progress": {
    "ytdlp": {
      "percent": 45.5,
      "speed": "2.5 MiB/s",
      "eta": "00:23"
    }
  },
  "outputPath": "/path/to/file.mp4",
  "error": null,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### 3. Baixar Arquivo do Stream
```
GET /api/stream/:taskId/file
```
**Response:** Arquivo binário (video/audio)
**Headers:**
- `Content-Type`: `video/mp4` | `audio/mpeg` | etc.
- `Content-Length`: Tamanho do arquivo
- `Content-Disposition`: `attachment; filename="..."`
- `Access-Control-Allow-Origin`: `*`

#### 4. Parar Stream
```
POST /api/stream/:taskId/stop
```
**Response:**
```json
{
  "taskId": "stream_1234567890_abc",
  "status": "stopped",
  "message": "Stream parado com sucesso",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## 🔧 API v1.0 (Porta 9000) - StreamDownloadAPI

### Endpoints Disponíveis

#### 1. Health Check
```
GET /health
```

#### 2. Criar Download
```
POST /api/download
```
**Body:**
```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "format": "best",
  "subtitles": false
}
```

#### 3. Progresso do Download
```
GET /api/download/:downloadId/progress
```

#### 4. Informações do Vídeo
```
POST /api/video-info
```

#### 5. Listar Downloads
```
GET /api/downloads
```

#### 6. Cancelar Download
```
POST /api/download/:downloadId/cancel
```

---

## ⚠️ Problemas Identificados

### 1. **Conflito de Rotas Potencial**
**Problema:** A ordem das rotas em `download.routes.js` pode causar conflitos:
- `/api/download/:taskId/file` (linha 39)
- `/api/download/:taskId/sse` (linha 48)

**Status:** ✅ **CORRIGIDO** - A rota `/file` está antes de `/sse`, então não há conflito. Express vai fazer match na primeira rota que corresponder.

### 2. **Inconsistência de Nomenclatura**
**Problema:** 
- Download usa: `/api/download/status/:taskId`
- Stream usa: `/api/stream/:taskId/status`

**Recomendação:** Manter padrão consistente. Atualmente:
- ✅ Download: `/api/download/status/:taskId` (status antes do taskId)
- ✅ Stream: `/api/stream/:taskId/status` (status depois do taskId)

**Decisão:** Manter como está, mas documentar a diferença.

### 3. **Falta de Validação de Parâmetros**
**Problema:** Algumas rotas não validam parâmetros antes de processar.

**Status:** ✅ **CORRIGIDO**
- ✅ `StreamController.createStream` valida URL
- ✅ `DownloadController.createDownload` usa validator
- ✅ Todas as rotas com `:taskId` agora têm middleware de validação
- ✅ Validador aceita tanto `task_` quanto `stream_` como prefixos

### 4. **Tratamento de Erros Inconsistente**
**Status:** ✅ **CORRIGIDO**
- Todos os controllers têm try/catch
- Respostas de erro seguem formato padrão com `code` e `timestamp`

### 5. **CORS Configurado**
**Status:** ✅ **OK**
- CORS habilitado para todas as rotas
- Headers configurados corretamente

---

## 📊 Tabela Comparativa de Endpoints

| Funcionalidade | Download API | Stream API | Notas |
|---------------|--------------|------------|-------|
| Criar | `POST /api/download` | `POST /api/stream` | ✅ Similar |
| Status | `GET /api/download/status/:taskId` | `GET /api/stream/:taskId/status` | ⚠️ Ordem diferente |
| Arquivo | `GET /api/download/:taskId/file` | `GET /api/stream/:taskId/file` | ✅ Similar |
| Progresso SSE | `GET /api/download/:taskId/sse` | ❌ Não tem | Download tem SSE |
| Cancelar | `POST /api/download/:taskId/cancel` | `POST /api/stream/:taskId/stop` | ⚠️ Nome diferente |
| Listar | `GET /api/downloads` | ❌ Não tem | Apenas Download |
| Stats | `GET /api/stats` | ❌ Não tem | Apenas Download |

---

## ✅ Recomendações

### 1. **Padronizar Nomenclatura**
- Considerar usar `/api/stream/:taskId/status` como padrão para ambos
- OU usar `/api/download/:taskId/status` para ambos

### 2. **Adicionar Validação de TaskId**
✅ **IMPLEMENTADO**
- Middleware `validateTaskIdMiddleware` adicionado em todas as rotas com `:taskId`
- Validador aceita `task_` e `stream_` como prefixos
- Validação de comprimento mínimo implementada

### 3. **Adicionar Rate Limiting**
- Limitar requisições por IP
- Prevenir abuso da API

### 4. **Documentação OpenAPI/Swagger**
- Criar documentação automática
- Facilitar testes e integração

### 5. **Adicionar Logging**
- Log de todas as requisições
- Métricas de performance

---

## 🧪 Testes Recomendados

1. ✅ Testar todas as rotas com `test-stream-lifecycle.js`
2. ✅ Verificar tratamento de erros
3. ✅ Validar CORS
4. ✅ Testar conflitos de rotas
5. ✅ Verificar performance com múltiplas requisições

---

## 📝 Notas Finais

- **API v2.0** é a versão principal e recomendada
- **API v1.0** é mantida apenas para compatibilidade
- Todas as rotas estão funcionais
- Tratamento de erros está implementado
- CORS está configurado corretamente

**Status Geral:** ✅ **APROVADO COM RECOMENDAÇÕES**
