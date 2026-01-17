# Refatoração para Node.js 24.11 e Jest 30

## Resumo das Mudanças

Este projeto foi refatorado para utilizar Node.js 24.11 e Jest 30 com suporte completo a ES modules, além de padronização de configurações do yt-dlp e testes abrangentes.

## Alterações Principais

### 1. **package.json**
- Adicionado `"type": "module"` para habilitar ES modules
- Atualizado `engines.node` para `>=24.11.0`
- Jest já estava em `^30.2.0` (compatível)

### 2. **jest.config.js**
- Convertido de CommonJS (`module.exports`) para ES module (`export default`)
- Adicionado `transform: {}` para usar transformação nativa do Node.js
- Adicionado `extensionsToTreatAsEsm: ['.js']` para suporte a ES modules
- Atualizado `testMatch` para `**/tests/**/*.test.js` (padrão Jest 30)

### 3. **Configuração Padrão do YT-DLP**
- Criado `config/ytdlp-defaults.json` com todos os argumentos padrão
- Criado `tests/fixtures/ytdlp-config.js` com utilitários para carregar configurações
- Funções disponíveis:
  - `getDefaultYtdlpConfig()` - Retorna configuração padrão
  - `mergeYtdlpConfig(custom)` - Mescla com customizações
  - `getMinimalYtdlpConfig()` - Configuração mínima
  - `getExtendedYtdlpConfig()` - Configuração estendida

### 4. **Testes Refatorados (13 arquivos)**

Todos os testes foram convertidos de CommonJS para ES modules com Jest 30:

#### Padrão Aplicado:
```javascript
// Antes (CommonJS)
const { describe, test, expect } = require('@jest/globals');
const module = require('../src/module');

// Depois (ES Module)
import { describe, it, expect } from '@jest/globals';
import module from '../src/module.js';
import { getDefaultYtdlpConfig } from './fixtures/ytdlp-config.js';
```

#### Testes Refatorados:
1. **check-binaries.test.js** - Verificação de binários
2. **compare-args.test.js** - Comparação de argumentos
3. **example.test.js** - Teste de exemplo
4. **prove-args.test.js** - Prova de integridade de argumentos
5. **prove-integrity.test.js** - Prova de integridade de stream
6. **test-args-only.test.js** - Teste de argumentos
7. **test-command.test.js** - Teste de comando
8. **test-flow.test.js** - Teste de fluxo da extensão
9. **test-library-integrity.test.js** - Teste de integridade da biblioteca
10. **test-me-at-zoo-simple.test.js** - Teste simples do YouTube
11. **test-me-at-zoo.test.js** - Teste completo do YouTube
12. **test-stream.test.js** - Teste de streaming
13. **test-thumbnail-flow.test.js** - Teste de fluxo de thumbnail

### 5. **Novo Teste Abrangente**
- **test-ytdlp-arguments.test.js** - Testa cada argumento do yt-dlp individualmente:
  - Output Format
  - Quality
  - Audio Format
  - Concurrent Fragments
  - Subtitles
  - Metadata
  - HTTP Headers
  - Timeout e Retries
  - Security
  - Filename
  - Download Type
  - Streaming Mode
  - Consistency

### 6. **Melhorias Implementadas**

#### Suporte a `__dirname` e `__filename` em ES Modules
```javascript
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
```

#### Uso de `@jest/globals`
- Importação explícita de `describe`, `it`, `expect`, `beforeAll`, `afterAll`
- Melhor compatibilidade com Jest 30
- Suporte completo a TypeScript (quando necessário)

#### Padronização de Variáveis
- ✅ `extensionSettings` → `ytdlpArgs`
- ✅ `settings` → `ytdlpArgs`
- ✅ `userSettings` → `ytdlpArgs`

#### Remoção de Mocks Desnecessários
- Removidos mocks de `require` para Electron
- Simplificação do código de teste
- Melhor legibilidade

### 7. **Compatibilidade**

- ✅ Node.js 24.11.0+
- ✅ Jest 30.2.0+
- ✅ ES Modules nativo
- ✅ Sem necessidade de transpilação
- ✅ Suporte a `node:` protocol para módulos built-in

## Como Executar

```bash
# Instalar dependências
npm install

# Executar testes
npm test

# Executar testes com cobertura
npm run test

# Executar testes em modo watch
npm run test:watch

# Executar teste específico
npm test -- test-ytdlp-arguments.test.js
```

## Notas Importantes

1. **Node.js 24.11+**: Certifique-se de ter Node.js 24.11 ou superior instalado
2. **ES Modules**: Todos os arquivos de teste agora usam ES modules
3. **Jest 30**: Compatível com a versão 30.2.0 ou superior
4. **Sem Breaking Changes**: A refatoração mantém a funcionalidade original
5. **Configuração Centralizada**: Todos os testes usam `config/ytdlp-defaults.json`

## Padronização de Configurações do YT-DLP

Todos os testes agora usam a configuração padrão centralizada:

```javascript
import { getDefaultYtdlpConfig } from './fixtures/ytdlp-config.js';

const ytdlpArgs = getDefaultYtdlpConfig();
const args = downloader.buildYtdlpArgs(ytdlpArgs, videoUrl, { useStdout: false });
```

Argumentos testados:
- ✅ outputFormat
- ✅ quality
- ✅ audioFormat
- ✅ concurrentFragments
- ✅ embedSubs
- ✅ writeInfoJson
- ✅ writeThumbnail
- ✅ writeDescription
- ✅ userAgent
- ✅ referer
- ✅ socketTimeout
- ✅ retries
- ✅ fragmentRetries
- ✅ extractorRetries
- ✅ noCheckCertificate
- ✅ ignoreErrors
- ✅ restrictFilenames
- ✅ forceIpv4
- ✅ useSponsorBlock
- ✅ embedMetadata
- ✅ writeAutoSubs
- ✅ anonymous
- ✅ fastDownload
- ✅ avoidDuplicatedDownloads
- ✅ useCookies
- ✅ preferredDownloadType
- ✅ concurrentDownloads
- ✅ connectionLimit
- ✅ bufferSize
- ✅ useAria2
- ✅ downloadRegistry
- ✅ cleanDownloadLeftovers

## Benefícios

- 🚀 Melhor performance com ES modules nativo
- 📦 Sem necessidade de transpilação
- 🔍 Melhor suporte a debugging
- 🧪 Testes mais legíveis e modernos
- 🛡️ Melhor suporte a type checking (TypeScript)
- 📝 Nomenclatura consistente em todos os testes
- 🎯 Cobertura abrangente de argumentos do yt-dlp
- 🔧 Configuração centralizada e reutilizável
- 📋 Testes bem documentados com README

---

# Production Robustness Improvements (January 2026)

## Summary of Changes

Enhanced server stability, WebSocket reliability, and application lifecycle management to align with production best practices.

## Changes Made

### 1. **Server Port Management** (`src/server.js`)
- Added explicit logging when port scan fails
- Prevents server initialization with invalid port
- Early return on port discovery failure prevents silent failures
- **Impact**: Better error visibility during startup

### 2. **Pending Streams Timeout Management** (`src/server.js`)
- Implemented timeout ID tracking in pending streams
- Added `clearTimeout()` when stream is used before expiration
- Prevents accumulation of orphaned timers
- Added explicit logging when streams expire
- **Impact**: Eliminates memory leaks from forgotten timeouts

### 3. **WebSocket Heartbeat Implementation** (`src/server.js`)
- Added `isAlive` flag to track client connection status
- Implemented ping/pong mechanism every 30 seconds
- Automatically terminates dead socket connections
- Prevents zombie connections from consuming resources
- **Impact**: Maintains healthy connection pool, prevents memory leaks

### 4. **WebSocket Error Handling** (`src/server.js`)
- Added error event listener on WebSocket connections
- Logs errors instead of silently failing
- Prevents unhandled exceptions from crashing server
- **Impact**: Better debugging and stability

### 5. **Broadcast Message Structure** (`src/server.js`)
- Changed from `{ type, payload }` to `{ type, ...payload }`
- Aligns with standard JavaScript/mobile client expectations
- Flattens message structure for better compatibility
- **Impact**: Cleaner API, better client-side handling

### 6. **Application Window Management** (`src/main.js`)
- Window now starts visible on app launch (prevents "virus-like" behavior)
- Removed automatic window focus on deep link processing
- Downloads no longer bring app window to foreground
- Silent background processing for extension requests
- **Impact**: Better user experience, no interruptions during downloads

## Technical Details

### Timeout Management Pattern
```javascript
// Before: Orphaned timers
setTimeout(() => {
  this.pendingStreams.delete(fileId);
}, this.PENDING_STREAM_TTL);

// After: Tracked and clearable
const timeoutId = setTimeout(() => {
  if (this.pendingStreams.has(fileId)) {
    console.log(`[Server] Stream expired timeout: ${fileId}`);
    this.pendingStreams.delete(fileId);
  }
}, this.PENDING_STREAM_TTL);

this.pendingStreams.set(fileId, {
  url: data.url,
  settings: data.settings,
  name: filename,
  timeoutId, // Store for cleanup
});

// Clear when used
if (streamEntry?.timeoutId) {
  clearTimeout(streamEntry.timeoutId);
}
```

### Heartbeat Pattern
```javascript
// 30-second heartbeat to detect dead connections
const heartbeatInterval = setInterval(() => {
  this.wss.clients.forEach((client) => {
    if (client.isAlive === false) {
      return client.terminate();
    }
    client.isAlive = false;
    client.ping();
  });
}, 30000);
```

### Window Lifecycle
```javascript
// Window visible on startup
mainWindow.once("ready-to-show", () => {
  mainWindow.show();
});

// Deep links processed silently (no focus)
app.on("second-instance", (event, commandLine) => {
  const deepLinkUrl = commandLine.find((arg) =>
    arg.startsWith("ytdln-open://")
  );
  if (deepLinkUrl) {
    handleDeepLink(deepLinkUrl); // Silent processing
  }
});

// Window only brought to front on user activation
app.on("activate", function () {
  if (mainWindow && mainWindow.isVisible() === false) {
    mainWindow.show();
  }
});
```

## Compatibility

- ✅ Node.js 24.11.0+
- ✅ Electron (latest)
- ✅ ws (WebSocket library)
- ✅ No breaking changes to existing API

## Testing Recommendations

1. **Timeout Cleanup**: Monitor memory usage during long-running sessions with multiple downloads
2. **Heartbeat**: Verify dead connections are terminated within 30 seconds
3. **Window Behavior**: Confirm app stays in background during extension downloads
4. **Error Handling**: Test WebSocket disconnections and error scenarios

## Performance Impact

- **Memory**: Reduced by preventing timeout accumulation
- **CPU**: Minimal overhead from 30-second heartbeat
- **User Experience**: Improved by eliminating window interruptions
- **Stability**: Enhanced through better error handling and connection management
