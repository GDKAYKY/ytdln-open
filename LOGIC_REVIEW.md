# Revisão de Lógica - Streaming com Progresso

## 🔴 Problemas Identificados

### 1. **Problema Crítico: Progresso Não Funciona Corretamente**

#### Situação Atual:
```javascript
// StreamPipeService.startStream()
ffmpegProcess.stdout.on('data', (chunk) => {
  const stream = this.streams.get(taskId);
  if (stream) {
    stream.bytesTransferred += chunk.length;
    
    // Calcular percentual se souber o tamanho total
    if (fileSize > 0) {
      const percent = Math.round((stream.bytesTransferred / fileSize) * 100);
      if (onProgress) {
        onProgress({
          percent,
          bytesTransferred: stream.bytesTransferred,
          fileSize,
          speed: this.calculateSpeed(stream),
        });
      }
    }
  }
});
```

#### Problema:
- ❌ O `fileSize` vem do parâmetro `metadata`, mas pode ser **0** se `getFileSize()` falhar
- ❌ Se `fileSize === 0`, o progresso **nunca é calculado**
- ❌ O progresso só é enviado via callback, mas o controller não usa esse callback
- ❌ O endpoint `/status` retorna progresso do `StreamDownloadService`, não do `StreamPipeService`
- ❌ Dois serviços diferentes gerenciando streams (confusão de responsabilidades)

### 2. **Problema: Dois Serviços Fazendo a Mesma Coisa**

#### Situação:
- `StreamDownloadService` - Gerencia streams com progresso
- `StreamPipeService` - Gerencia streams com progresso (duplicado!)

#### Problema:
- ❌ Código duplicado
- ❌ Lógica inconsistente
- ❌ Confusão sobre qual usar
- ❌ Testes testam ambos separadamente

### 3. **Problema: Controller Não Usa Callbacks**

#### Situação Atual:
```javascript
// StreamPipeController.createStream()
this.streamPipeService.startStream(
  taskId,
  url,
  { format: format || 'best', audioOnly: audioOnly || false },
  {
    onProgress: (msg) => {
      console.log(`[Stream ${taskId}] ${msg}`);  // ← Só loga!
    },
    onError: (err) => {
      console.error(`[Stream ${taskId}] Erro:`, err);
    },
  },
  { fileSize } // ← Passa fileSize aqui
).catch((err) => {
  console.error(`[StreamPipeController] Erro ao iniciar stream:`, err);
});
```

#### Problema:
- ❌ Callbacks só fazem logging
- ❌ Progresso não é armazenado em lugar acessível
- ❌ Endpoint `/status` não consegue retornar progresso em tempo real
- ❌ Cliente não consegue monitorar progresso

### 4. **Problema: Progresso Não Persiste**

#### Situação:
```javascript
// StreamPipeService.getStreamStatus()
const percent = stream.fileSize > 0 
  ? Math.round((stream.bytesTransferred / stream.fileSize) * 100)
  : 0;
```

#### Problema:
- ❌ Se `fileSize === 0`, retorna `percent: 0` sempre
- ❌ Não há fallback para calcular progresso sem saber tamanho total
- ❌ Cliente vê 0% o tempo todo

### 5. **Problema: Timing de Obtenção de Tamanho**

#### Situação Atual:
```javascript
// StreamPipeController.createStream()
const fileSize = await this.streamPipeService.getFileSize(url, { 
  format: format || 'best', 
  audioOnly: audioOnly || false 
});
```

#### Problema:
- ❌ Bloqueia resposta ao cliente (await)
- ❌ Se `getFileSize()` falhar, `fileSize = 0`
- ❌ Stream inicia com `fileSize = 0`, progresso não funciona
- ❌ Cliente recebe resposta lenta

### 6. **Problema: Progresso Não é Enviado ao Cliente**

#### Situação:
- ❌ Progresso é calculado no callback `onProgress`
- ❌ Callback só faz logging
- ❌ Progresso não é armazenado
- ❌ Endpoint `/status` não consegue retornar progresso atualizado

### 7. **Problema: Teste E2E Não Valida Fluxo Real**

#### Situação:
```javascript
// stream-pipe.e2e.test.js
// Simula dados sendo transferidos
mockFfmpegProcess.stdout.emit('data', chunk);
```

#### Problema:
- ❌ Testes usam mocks, não testam fluxo real
- ❌ Não validam que progresso é enviado ao cliente
- ❌ Não validam que Chrome recebe Content-Length correto
- ❌ Não validam que progresso é atualizado em tempo real

## 🔧 Soluções Propostas

### Solução 1: Unificar Serviços
```
StreamDownloadService (existente)
    ↓
Usar APENAS este para streaming
    ↓
StreamPipeService (remover ou refatorar)
```

### Solução 2: Armazenar Progresso em Tempo Real
```javascript
// StreamDownloadService
this.streams.set(taskId, {
  ...
  progress: {
    percent: 0,
    bytesTransferred: 0,
    fileSize: 0,
    speed: '0 MB/s',
    eta: 'unknown',
  }
});

// Atualizar progresso em tempo real
ffmpegProcess.stdout.on('data', (chunk) => {
  const stream = this.streams.get(taskId);
  stream.progress.bytesTransferred += chunk.length;
  stream.progress.percent = Math.round(
    (stream.progress.bytesTransferred / stream.progress.fileSize) * 100
  );
  stream.progress.speed = this.calculateSpeed(stream);
});
```

### Solução 3: Obter Tamanho em Background
```javascript
// Não bloquear resposta
this.streamPipeService.getFileSize(url, options)
  .then(fileSize => {
    // Atualizar stream com tamanho
    const stream = this.streams.get(taskId);
    if (stream) {
      stream.fileSize = fileSize;
      stream.progress.fileSize = fileSize;
    }
  })
  .catch(err => console.error('Erro ao obter tamanho:', err));
```

### Solução 4: Retornar Progresso Atualizado
```javascript
// StreamPipeController.getStreamStatus()
getStreamStatus(req, res) {
  const { taskId } = req.params;
  const status = this.streamPipeService.getStreamStatus(taskId);
  
  if (!status) {
    return res.status(404).json({ error: 'Stream não encontrado' });
  }
  
  // Retornar progresso atualizado
  res.status(200).json({
    taskId,
    status: status.status,
    fileSize: status.fileSize,
    bytesTransferred: status.progress.bytesTransferred,
    percent: status.progress.percent,
    speed: status.progress.speed,
    eta: status.progress.eta,
  });
}
```

### Solução 5: Validar Fluxo Real
```javascript
// Testes devem validar:
// 1. Content-Length é enviado
// 2. Progresso é atualizado
// 3. Percentual aumenta de 0 a 100
// 4. Velocidade é calculada
// 5. Cliente recebe dados em chunks
```

## 📊 Comparação: Antes vs Depois

### Antes (Atual - Quebrado)
```
Cliente → POST /api/stream-pipe
  ↓
Servidor obtém fileSize (pode falhar)
  ↓
Servidor inicia stream com fileSize = 0 (se falhou)
  ↓
Cliente → GET /api/stream-pipe/:taskId/stream
  ↓
Servidor envia Content-Length = 0 (Chrome não calcula %)
  ↓
Cliente → GET /api/stream-pipe/:taskId/status
  ↓
Servidor retorna percent = 0 (sempre)
  ↓
❌ Chrome Download Manager mostra 0% o tempo todo
```

### Depois (Corrigido)
```
Cliente → POST /api/stream-pipe
  ↓
Servidor inicia stream IMEDIATAMENTE
  ↓
Servidor obtém fileSize em BACKGROUND
  ↓
Cliente → GET /api/stream-pipe/:taskId/stream
  ↓
Servidor envia Content-Length (quando disponível)
  ↓
Servidor rastreia bytesTransferred em tempo real
  ↓
Cliente → GET /api/stream-pipe/:taskId/status (polling)
  ↓
Servidor retorna percent atualizado (0% → 100%)
  ↓
✅ Chrome Download Manager mostra progresso em tempo real
```

## 🎯 Próximos Passos

1. **Refatorar StreamPipeService**
   - Armazenar progresso em tempo real
   - Obter fileSize em background
   - Não bloquear resposta

2. **Atualizar StreamPipeController**
   - Retornar progresso atualizado em `/status`
   - Não bloquear em `getFileSize()`

3. **Reescrever Testes**
   - Validar fluxo real (não mocks)
   - Validar que progresso é atualizado
   - Validar que Chrome recebe headers corretos

4. **Validar em Produção**
   - Testar com URLs reais
   - Verificar progresso no Chrome
   - Monitorar performance

## ✅ Checklist de Correção

- [ ] Unificar lógica de streaming
- [ ] Armazenar progresso em tempo real
- [ ] Obter fileSize em background
- [ ] Retornar progresso atualizado em `/status`
- [ ] Reescrever testes para validar fluxo real
- [ ] Testar com URLs reais
- [ ] Validar no Chrome Download Manager
- [ ] Documentar mudanças
