# Problema: Lógica de Envio do Stream

## 🔴 Problema Crítico Identificado

### Situação Atual (Quebrada)

```javascript
// StreamPipeController.getStream()
async getStream(req, res) {
  const stream = this.streamPipeService.streams.get(taskId);
  
  // Pipar FFmpeg stdout para response
  stream.ffmpegProcess.stdout.pipe(res);
  
  // Tratar desconexão
  res.on('close', () => {
    this.streamPipeService.stopStream(taskId);
  });
}
```

### Problemas:

1. **❌ Pipe Direto Sem Controle**
   - Envia dados tão rápido quanto FFmpeg produz
   - Sem throttling ou controle de fluxo
   - Pode sobrecarregar o cliente

2. **❌ Headers Enviados Antes do Stream Estar Pronto**
   ```javascript
   // Headers são enviados ANTES de pipar
   res.setHeader('Content-Length', contentLength);
   res.setHeader('Content-Type', 'video/mp4');
   
   // Depois faz pipe
   stream.ffmpegProcess.stdout.pipe(res);
   ```
   - Se `contentLength === 0`, Chrome não sabe tamanho
   - Headers não podem ser alterados depois

3. **❌ Sem Tratamento de Erro no Pipe**
   - Se FFmpeg falhar, cliente não sabe
   - Se pipe quebrar, stream continua
   - Sem retry ou fallback

4. **❌ Sem Monitoramento de Progresso**
   - Progresso é calculado mas não enviado
   - Cliente não consegue monitorar em tempo real
   - Só consegue via polling em `/status`

5. **❌ Sem Controle de Backpressure**
   - FFmpeg pode produzir dados mais rápido que cliente consome
   - Pode causar memory leak
   - Sem pausa/resume

6. **❌ Sem Timeout**
   - Se cliente desconectar, stream continua
   - Se FFmpeg travar, resposta fica pendurada
   - Sem timeout de inatividade

## 📊 Fluxo Atual (Quebrado)

```
Cliente → GET /api/stream-pipe/:taskId/stream
  ↓
Servidor verifica se stream existe
  ↓
Servidor envia headers:
  ├─ Content-Type: video/mp4
  ├─ Content-Length: 0 (se fileSize ainda não chegou)
  └─ Transfer-Encoding: chunked
  ↓
Servidor faz pipe direto:
  ffmpegProcess.stdout.pipe(res)
  ↓
FFmpeg envia dados tão rápido quanto pode
  ↓
Cliente recebe dados sem saber tamanho total
  ↓
Chrome Download Manager não consegue calcular %
  ↓
❌ Progresso não funciona
```

## ✅ Solução: Envio Controlado com Monitoramento

### 1. Aguardar Tamanho Antes de Enviar Headers

```javascript
async getStream(req, res) {
  const { taskId } = req.params;
  const stream = this.streamPipeService.streams.get(taskId);
  
  if (!stream) {
    return res.status(404).json({ error: 'Stream não encontrado' });
  }

  // Aguardar tamanho estar disponível (com timeout)
  const fileSize = await this.waitForFileSize(stream, 30000); // 30s timeout
  
  // Agora enviar headers com tamanho correto
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Content-Disposition', `attachment; filename="${stream.filename}"`);
  
  if (fileSize > 0) {
    res.setHeader('Content-Length', fileSize);
  } else {
    res.setHeader('Transfer-Encoding', 'chunked');
  }
  
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'no-cache');
  
  // Agora fazer pipe
  this.pipeStreamWithMonitoring(stream, res);
}

// Aguardar tamanho estar disponível
async waitForFileSize(stream, timeout = 30000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (stream.fileSize > 0) {
      return stream.fileSize;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Timeout - retornar 0 (usar chunked)
  return 0;
}
```

### 2. Pipe com Monitoramento de Progresso

```javascript
pipeStreamWithMonitoring(stream, res) {
  const ffmpegStdout = stream.ffmpegProcess.stdout;
  
  // Monitorar dados sendo enviados
  ffmpegStdout.on('data', (chunk) => {
    // Atualizar progresso
    stream.progress.bytesTransferred += chunk.length;
    
    if (stream.fileSize > 0) {
      stream.progress.percent = Math.round(
        (stream.progress.bytesTransferred / stream.fileSize) * 100
      );
    }
    
    // Enviar chunk para cliente
    res.write(chunk);
  });
  
  // Tratar fim do stream
  ffmpegStdout.on('end', () => {
    stream.progress.percent = 100;
    res.end();
  });
  
  // Tratar erro no FFmpeg
  ffmpegStdout.on('error', (err) => {
    console.error(`[Stream] Erro no FFmpeg:`, err);
    res.status(500).json({ error: 'Erro ao servir stream' });
  });
  
  // Tratar desconexão do cliente
  res.on('close', () => {
    console.log(`[Stream] Cliente desconectou`);
    this.streamPipeService.stopStream(stream.taskId);
  });
  
  // Tratar erro na resposta
  res.on('error', (err) => {
    console.error(`[Stream] Erro na resposta:`, err);
    this.streamPipeService.stopStream(stream.taskId);
  });
}
```

### 3. Controle de Backpressure

```javascript
pipeStreamWithBackpressure(stream, res) {
  const ffmpegStdout = stream.ffmpegProcess.stdout;
  
  ffmpegStdout.on('data', (chunk) => {
    // Atualizar progresso
    stream.progress.bytesTransferred += chunk.length;
    
    // Enviar chunk
    const canContinue = res.write(chunk);
    
    // Se cliente não consegue acompanhar, pausar
    if (!canContinue) {
      console.log(`[Stream] Pausando - cliente não acompanha`);
      ffmpegStdout.pause();
    }
  });
  
  // Quando cliente consegue receber mais
  res.on('drain', () => {
    console.log(`[Stream] Resumindo - cliente pronto`);
    ffmpegStdout.resume();
  });
  
  ffmpegStdout.on('end', () => {
    res.end();
  });
}
```

### 4. Timeout de Inatividade

```javascript
pipeStreamWithTimeout(stream, res, timeoutMs = 60000) {
  const ffmpegStdout = stream.ffmpegProcess.stdout;
  let lastActivityTime = Date.now();
  let timeoutHandle;
  
  const resetTimeout = () => {
    clearTimeout(timeoutHandle);
    lastActivityTime = Date.now();
    
    timeoutHandle = setTimeout(() => {
      console.error(`[Stream] Timeout de inatividade`);
      res.status(408).json({ error: 'Timeout' });
      this.streamPipeService.stopStream(stream.taskId);
    }, timeoutMs);
  };
  
  ffmpegStdout.on('data', (chunk) => {
    resetTimeout();
    stream.progress.bytesTransferred += chunk.length;
    res.write(chunk);
  });
  
  ffmpegStdout.on('end', () => {
    clearTimeout(timeoutHandle);
    res.end();
  });
  
  res.on('close', () => {
    clearTimeout(timeoutHandle);
    this.streamPipeService.stopStream(stream.taskId);
  });
  
  resetTimeout();
}
```

## 📋 Comparação: Antes vs Depois

### Antes (Quebrado)
```
GET /stream
  ↓
Headers com Content-Length = 0
  ↓
Pipe direto (sem controle)
  ↓
FFmpeg envia tão rápido quanto pode
  ↓
Sem monitoramento
  ↓
Chrome não consegue calcular %
  ↓
❌ FALHA
```

### Depois (Corrigido)
```
GET /stream
  ↓
Aguardar fileSize estar disponível
  ↓
Headers com Content-Length correto
  ↓
Pipe com monitoramento
  ↓
Atualizar progresso a cada chunk
  ↓
Controle de backpressure
  ↓
Timeout de inatividade
  ↓
Chrome consegue calcular %
  ↓
✅ SUCESSO
```

## 🔧 Implementação Corrigida

```javascript
class StreamPipeController {
  async getStream(req, res) {
    try {
      const { taskId } = req.params;
      const stream = this.streamPipeService.streams.get(taskId);
      
      if (!stream) {
        return res.status(404).json({ error: 'Stream não encontrado' });
      }

      // 1. Aguardar tamanho
      const fileSize = await this.waitForFileSize(stream, 30000);
      
      // 2. Enviar headers corretos
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Content-Disposition', `attachment; filename="${stream.filename}"`);
      
      if (fileSize > 0) {
        res.setHeader('Content-Length', fileSize);
      } else {
        res.setHeader('Transfer-Encoding', 'chunked');
      }
      
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'no-cache');
      
      // 3. Pipe com monitoramento e controle
      this.pipeStreamControlled(stream, res);
      
    } catch (error) {
      console.error('[Stream] Erro:', error);
      res.status(500).json({ error: 'Erro ao servir stream' });
    }
  }

  async waitForFileSize(stream, timeout) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (stream.fileSize > 0) {
        return stream.fileSize;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return 0;
  }

  pipeStreamControlled(stream, res) {
    const ffmpegStdout = stream.ffmpegProcess.stdout;
    let lastActivityTime = Date.now();
    let timeoutHandle;
    
    const resetTimeout = () => {
      clearTimeout(timeoutHandle);
      timeoutHandle = setTimeout(() => {
        console.error(`[Stream] Timeout`);
        this.streamPipeService.stopStream(stream.taskId);
      }, 60000);
    };
    
    ffmpegStdout.on('data', (chunk) => {
      resetTimeout();
      stream.progress.bytesTransferred += chunk.length;
      
      if (stream.fileSize > 0) {
        stream.progress.percent = Math.round(
          (stream.progress.bytesTransferred / stream.fileSize) * 100
        );
      }
      
      const canContinue = res.write(chunk);
      if (!canContinue) {
        ffmpegStdout.pause();
      }
    });
    
    res.on('drain', () => {
      ffmpegStdout.resume();
    });
    
    ffmpegStdout.on('end', () => {
      clearTimeout(timeoutHandle);
      stream.progress.percent = 100;
      res.end();
    });
    
    ffmpegStdout.on('error', (err) => {
      clearTimeout(timeoutHandle);
      console.error(`[Stream] Erro FFmpeg:`, err);
      res.status(500).json({ error: 'Erro ao servir stream' });
    });
    
    res.on('close', () => {
      clearTimeout(timeoutHandle);
      this.streamPipeService.stopStream(stream.taskId);
    });
    
    res.on('error', (err) => {
      clearTimeout(timeoutHandle);
      console.error(`[Stream] Erro resposta:`, err);
      this.streamPipeService.stopStream(stream.taskId);
    });
    
    resetTimeout();
  }
}
```

## ✅ Benefícios da Solução

✅ Headers com tamanho correto  
✅ Chrome calcula % automaticamente  
✅ Progresso atualizado em tempo real  
✅ Controle de backpressure (sem memory leak)  
✅ Timeout de inatividade  
✅ Tratamento de erros robusto  
✅ Desconexão limpa  

## 🎯 Próximos Passos

1. Implementar `waitForFileSize()`
2. Implementar `pipeStreamControlled()`
3. Atualizar testes
4. Testar com URLs reais
5. Validar no Chrome
