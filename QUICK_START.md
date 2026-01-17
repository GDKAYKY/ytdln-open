# Quick Start - Testes YT-DLP

## 🚀 Começar Rápido

### 1. Executar Todos os Testes
```bash
npm test
```

### 2. Executar Teste Específico
```bash
npm test -- test-ytdlp-arguments.test.js
```

### 3. Modo Watch
```bash
npm run test:watch
```

## 📦 Usar Configuração em Novo Teste

### Opção 1: Configuração Padrão
```javascript
import { getDefaultYtdlpConfig } from './fixtures/ytdlp-config.js';

const ytdlpArgs = getDefaultYtdlpConfig();
const args = downloader.buildYtdlpArgs(ytdlpArgs, videoUrl, { useStdout: false });
```

### Opção 2: Configuração Customizada
```javascript
import { mergeYtdlpConfig } from './fixtures/ytdlp-config.js';

const ytdlpArgs = mergeYtdlpConfig({
  quality: '720p',
  embedSubs: true,
});
const args = downloader.buildYtdlpArgs(ytdlpArgs, videoUrl, { useStdout: false });
```

### Opção 3: Configuração Mínima
```javascript
import { getMinimalYtdlpConfig } from './fixtures/ytdlp-config.js';

const ytdlpArgs = getMinimalYtdlpConfig();
const args = downloader.buildYtdlpArgs(ytdlpArgs, videoUrl, { useStdout: false });
```

### Opção 4: Configuração Estendida
```javascript
import { getExtendedYtdlpConfig } from './fixtures/ytdlp-config.js';

const ytdlpArgs = getExtendedYtdlpConfig();
const args = downloader.buildYtdlpArgs(ytdlpArgs, videoUrl, { useStdout: false });
```

## 📝 Adicionar Novo Argumento

### Passo 1: Adicionar em config/ytdlp-defaults.json
```json
{
  "newArgument": "defaultValue"
}
```

### Passo 2: Criar Teste em test-ytdlp-arguments.test.js
```javascript
describe('New Argument', () => {
  it('should include new argument', () => {
    const args = downloader.buildYtdlpArgs(defaultConfig, videoUrl, { useStdout: false });
    expect(args.includes('--new-argument')).toBe(true);
  });
});
```

### Pronto! ✅
Todos os testes usarão automaticamente o novo argumento.

## 📂 Estrutura de Arquivos

```
config/
├── default.json (original)
└── ytdlp-defaults.json (novo - padrão para testes)

tests/
├── fixtures/
│   └── ytdlp-config.js (utilitários)
├── test-ytdlp-arguments.test.js (novo - 50+ testes)
├── README.md (documentação)
└── *.test.js (13 testes atualizados)
```

## 🔍 Argumentos Disponíveis

Veja `config/ytdlp-defaults.json` para lista completa:

- outputFormat
- quality
- audioFormat
- concurrentFragments
- embedSubs
- writeInfoJson
- writeThumbnail
- writeDescription
- userAgent
- referer
- socketTimeout
- retries
- fragmentRetries
- extractorRetries
- noCheckCertificate
- ignoreErrors
- restrictFilenames
- forceIpv4
- useSponsorBlock
- embedMetadata
- writeAutoSubs
- anonymous
- fastDownload
- avoidDuplicatedDownloads
- useCookies
- preferredDownloadType
- concurrentDownloads
- connectionLimit
- bufferSize
- useAria2
- downloadRegistry
- cleanDownloadLeftovers

## 💡 Dicas

### Testar Argumento Específico
```javascript
it('should have correct timeout', () => {
  const args = downloader.buildYtdlpArgs(defaultConfig, videoUrl, { useStdout: false });
  const index = args.indexOf('--socket-timeout');
  expect(args[index + 1]).toBe('30');
});
```

### Testar Variação de Configuração
```javascript
it('should handle custom quality', () => {
  const config = mergeYtdlpConfig({ quality: '720p' });
  const args = downloader.buildYtdlpArgs(config, videoUrl, { useStdout: false });
  expect(Array.isArray(args)).toBe(true);
});
```

### Testar Modo Streaming
```javascript
it('should use stdout for streaming', () => {
  const args = downloader.buildYtdlpArgs(defaultConfig, videoUrl, { useStdout: true });
  expect(args.includes('-o')).toBe(true);
  expect(args.includes('-')).toBe(true);
});
```

## 📚 Documentação Completa

- **REFACTORING_SUMMARY.md** - Resumo da refatoração
- **IMPLEMENTATION_SUMMARY.md** - Detalhes da implementação
- **tests/README.md** - Guia completo dos testes
- **QUICK_START.md** - Este arquivo

## ❓ FAQ

### P: Como adicionar um novo teste?
R: Crie um novo arquivo em `tests/` com sufixo `.test.js` e use `getDefaultYtdlpConfig()`.

### P: Como testar com configuração customizada?
R: Use `mergeYtdlpConfig({ customKey: 'value' })`.

### P: Onde está a configuração padrão?
R: Em `config/ytdlp-defaults.json`.

### P: Como executar um teste específico?
R: `npm test -- test-name.test.js`.

### P: Posso modificar a configuração padrão?
R: Sim, edite `config/ytdlp-defaults.json` e todos os testes usarão a nova configuração.

## 🎯 Próximos Passos

1. ✅ Executar `npm test` para validar
2. ✅ Revisar `tests/README.md` para detalhes
3. ✅ Adicionar novos testes conforme necessário
4. ✅ Manter `config/ytdlp-defaults.json` atualizado

## 🆘 Suporte

Para mais informações:
- Veja `tests/README.md` para documentação completa
- Veja `IMPLEMENTATION_SUMMARY.md` para detalhes técnicos
- Veja `REFACTORING_SUMMARY.md` para contexto da refatoração
