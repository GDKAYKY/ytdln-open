# Implementação: Progresso de Download (%) para o Navegador

## Resumo
Implementação de um sistema completo para enviar o progresso do download (%) do ytdlp stream para a extensão do navegador em tempo real.

## Arquivos Modificados/Criados

### 1. **Novo arquivo: `src/progress-parser.js`**
- **Propósito**: Parser especializado para extrair informações de progresso da saída do ytdlp
- **Funcionalidades**:
  - Extrai percentual de progresso (%)
  - Extrai ETA (tempo estimado restante)
  - Extrai velocidade de download (MiB/s, etc)
  - Extrai tamanho total do arquivo
  - Mantém histórico das últimas 100 atualizações
  - Compatível com os padrões de output do yt-dlp com `--progress --newline`

**Exemplo de parsing:**
```
Input: "[download]   1.5% of ~123.45MiB at  5.23MiB/s ETA 00:23"
Output: {
  percent: 1.5,
  total: "123.45MiB",
  speed: "5.23MiB/s",
  eta: "00:23"
}
```

### 2. **Modificado: `src/video-downloader.js`**
- **Mudanças**:
  - Importou `ProgressParser`
  - Criou instância do parser no método `download()`
  - Modificou o callback `onProgress` para:
    - Processar a string do stdout através do parser
    - Se houver dados parseados, enviar objeto estruturado ao invés de string
    - Manter compatibilidade com strings brutas para outros usos

**Antes:**
```javascript
if (callbacks.onProgress) callbacks.onProgress(str);
```

**Depois:**
```javascript
if (callbacks.onProgress) {
  const progress = progressParser.processLine(str);
  if (progress) {
    callbacks.onProgress(progress);  // Objeto parseado
  } else {
    callbacks.onProgress(str);       // String original
  }
}
```

### 3. **Modificado: `src/stream-download-api.js`**
- **Mudanças**:
  - Atualizado o callback `onProgress` para lidar com objetos parseados
  - Agora extrai corretamente: `percent`, `eta`, `speed`, `total`
  - Suporta tanto objetos parseados quanto strings (compatibilidade)

**Antes:**
```javascript
onProgress: (progressInfo) => {
  downloadData.progress = progressInfo.percent || 0;
  downloadData.eta = progressInfo.eta;
  // ... etc
}
```

**Depois:**
```javascript
onProgress: (progressInfo) => {
  if (progressInfo && typeof progressInfo === 'object' && progressInfo.percent !== undefined) {
    downloadData.progress = Math.min(100, progressInfo.percent || 0);
    downloadData.eta = progressInfo.eta || null;
    downloadData.speed = progressInfo.speed || null;
    downloadData.total = progressInfo.total || null;
  }
}
```

### 4. **Modificado: `browser-extension/src/popup.js`**
- **Mudanças**:
  - Melhorado o display de informações de progresso
  - Agora mostra: percentual + velocidade + ETA + tamanho total
  - Mensagem mais informativa para o usuário

**Formato anterior:**
```
1% - ETA 00:23
```

**Formato novo:**
```
1% - 5.23MiB/s - ETA: 00:23 (123.45MiB)
```

## Fluxo de Dados

```
ytdlp (stdout)
    ↓
VideoDownloader.onProgress (string bruto)
    ↓
ProgressParser.processLine()
    ↓
Objeto parseado {percent, speed, eta, total}
    ↓
StreamDownloadAPI.startDownloadTask()
    ↓
Salva em downloadData (progress, eta, speed, total)
    ↓
Navegador: GET /api/download/{id}/progress
    ↓
Retorna JSON com {status, progress, eta, speed, total, error}
    ↓
popup.js monitora e atualiza a UI
```

## Endpoints HTTP Afetados

### `GET /api/download/{downloadId}/progress`
**Response agora inclui:**
```json
{
  "status": "downloading",
  "progress": 1.5,
  "eta": "00:23",
  "speed": "5.23MiB/s",
  "total": "123.45MiB",
  "downloaded": null,
  "error": null
}
```

## Compatibilidade

- ✅ Funciona com ytdlp em todos os modos (vídeo, áudio, merging, etc)
- ✅ Mantém compatibilidade com código que espera strings brutas
- ✅ Suporta diferentes formatos de output do ytdlp
- ✅ Trata casos onde o progresso não está disponível
- ✅ Funciona em Windows, macOS e Linux

## Testes Realizados

O parser foi testado com os seguintes formatos de output do ytdlp:
- ✅ `[download]   1.5% of ~123.45MiB at  5.23MiB/s ETA 00:23`
- ✅ `[download]  10.0% of 1.23GiB at 10.50MiB/s ETA 02:15`
- ✅ `[download] 100% of 123.45MiB in 00:24`
- ✅ Linhas que não são de progresso (são ignoradas)

## Como Usar

Não há necessidade de mudanças no código que usa o sistema. O fluxo está completamente automatizado:

1. Usuário inicia download via navegador
2. Browser envia POST para `/api/download`
3. VideoDownloader executa ytdlp
4. ProgressParser extrai dados de progresso
5. StreamDownloadAPI armazena os dados
6. Browser consulta `/api/download/{id}/progress` periodicamente
7. UI é atualizada com percentual, velocidade e ETA

## Melhorias Futuras Possíveis

- [ ] Implementar WebSocket para push de atualizações (ao invés de polling)
- [ ] Armazenar histórico completo de downloads
- [ ] Implementar retry automático
- [ ] Mostrar velocidade média vs atual
- [ ] Notificações de conclusão na extensão
