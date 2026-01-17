# YT-DLP Test Suite

## Visão Geral

Este diretório contém testes abrangentes para validar a construção de argumentos do yt-dlp e o fluxo de download de vídeos.

## Estrutura de Testes

### Configuração Padrão

- **`config/ytdlp-defaults.json`** - Configuração padrão do yt-dlp com todos os argumentos suportados
- **`tests/fixtures/ytdlp-config.js`** - Utilitários para carregar e manipular configurações

### Testes Principais

#### 1. **test-ytdlp-arguments.test.js** (Novo - Abrangente)
Testa cada argumento do yt-dlp individualmente:
- Output Format
- Quality
- Audio Format
- Concurrent Fragments
- Subtitles (embed, auto-subs)
- Metadata (info json, thumbnail, description, metadata)
- HTTP (user-agent, referer)
- Timeout e Retries
- Security (certificate, errors, anonymous, ipv4)
- Filename
- Download Type
- Streaming Mode
- Consistency

#### 2. **compare-args.test.js**
Compara argumentos entre modo desktop e streaming

#### 3. **test-stream.test.js**
Testa o fluxo de streaming com configuração padrão

#### 4. **test-flow.test.js**
Testa o fluxo completo da extensão

#### 5. **test-command.test.js**
Testa a construção do comando yt-dlp

#### 6. **test-args-only.test.js**
Testa apenas os argumentos

#### 7. **prove-args.test.js**
Prova a integridade dos argumentos com configurações customizadas

#### 8. **prove-integrity.test.js**
Prova a integridade do stream

#### 9. **test-me-at-zoo.test.js**
Testa com o vídeo "Me at the Zoo" do YouTube

#### 10. **test-me-at-zoo-simple.test.js**
Versão simplificada do teste anterior

#### 11. **check-binaries.test.js**
Verifica se os binários (yt-dlp, ffmpeg) estão disponíveis

#### 12. **example.test.js**
Teste de exemplo básico

#### 13. **test-library-integrity.test.js**
Testa a integridade da biblioteca de downloads

#### 14. **test-thumbnail-flow.test.js**
Testa o fluxo de thumbnails

## Configuração Padrão

A configuração padrão está em `config/ytdlp-defaults.json` e inclui:

```json
{
  "outputFormat": "mp4",
  "quality": "best",
  "audioFormat": "best",
  "concurrentFragments": 8,
  "embedSubs": false,
  "writeInfoJson": false,
  "writeThumbnail": true,
  "writeDescription": false,
  "userAgent": "Mozilla/5.0...",
  "referer": "https://www.youtube.com/",
  "socketTimeout": 30,
  "retries": 5,
  "fragmentRetries": 5,
  "extractorRetries": 3,
  "noCheckCertificate": true,
  "ignoreErrors": true,
  ...
}
```

## Utilitários de Configuração

### `getDefaultYtdlpConfig()`
Retorna uma cópia profunda da configuração padrão

```javascript
import { getDefaultYtdlpConfig } from './fixtures/ytdlp-config.js';

const config = getDefaultYtdlpConfig();
```

### `mergeYtdlpConfig(customConfig)`
Mescla configuração customizada com os padrões

```javascript
import { mergeYtdlpConfig } from './fixtures/ytdlp-config.js';

const config = mergeYtdlpConfig({
  quality: '720p',
  embedSubs: true,
});
```

### `getMinimalYtdlpConfig()`
Retorna configuração mínima para testes

```javascript
import { getMinimalYtdlpConfig } from './fixtures/ytdlp-config.js';

const config = getMinimalYtdlpConfig();
// { outputFormat: 'mp4', quality: 'best' }
```

### `getExtendedYtdlpConfig()`
Retorna configuração estendida com mais opções

```javascript
import { getExtendedYtdlpConfig } from './fixtures/ytdlp-config.js';

const config = getExtendedYtdlpConfig();
```

## Executando os Testes

```bash
# Executar todos os testes
npm test

# Executar com cobertura
npm test -- --coverage

# Executar teste específico
npm test -- test-ytdlp-arguments.test.js

# Modo watch
npm run test:watch
```

## Argumentos Testados

### Output & Format
- ✅ outputFormat (mp4, mkv, etc)
- ✅ quality (best, 720p, 1080p, etc)
- ✅ audioFormat (best, mp3, aac, etc)

### Performance
- ✅ concurrentFragments (número de fragmentos paralelos)
- ✅ socketTimeout (timeout de conexão)
- ✅ retries (tentativas de download)
- ✅ fragmentRetries (tentativas de fragmento)
- ✅ extractorRetries (tentativas de extrator)

### Metadata
- ✅ embedSubs (incorporar legendas)
- ✅ writeInfoJson (salvar info json)
- ✅ writeThumbnail (salvar thumbnail)
- ✅ writeDescription (salvar descrição)
- ✅ embedMetadata (incorporar metadados)
- ✅ writeAutoSubs (salvar legendas automáticas)

### HTTP
- ✅ userAgent (user agent customizado)
- ✅ referer (referer customizado)

### Security
- ✅ noCheckCertificate (ignorar certificado SSL)
- ✅ ignoreErrors (ignorar erros)
- ✅ anonymous (modo anônimo)
- ✅ forceIpv4 (forçar IPv4)

### Filename
- ✅ restrictFilenames (restringir nomes de arquivo)
- ✅ fileNameTemplate (template de nome de arquivo)

### Download
- ✅ preferredDownloadType (tipo de download preferido)
- ✅ useSponsorBlock (usar SponsorBlock)

### Streaming
- ✅ useStdout (usar stdout para streaming)

## Padrões de Teste

### Teste de Argumento Individual
```javascript
it('should include concurrent fragments in arguments', () => {
  const args = downloader.buildYtdlpArgs(defaultConfig, videoUrl, { useStdout: false });
  const hasFragments = args.includes('--concurrent-fragments');
  expect(hasFragments).toBe(true);
});
```

### Teste de Valor de Argumento
```javascript
it('should have correct timeout value', () => {
  const args = downloader.buildYtdlpArgs(defaultConfig, videoUrl, { useStdout: false });
  const timeoutIndex = args.indexOf('--socket-timeout');
  if (timeoutIndex >= 0) {
    expect(args[timeoutIndex + 1]).toBe('30');
  }
});
```

### Teste de Configuração Customizada
```javascript
it('should handle different quality settings', () => {
  const config = { ...defaultConfig, quality: '720p' };
  const args = downloader.buildYtdlpArgs(config, videoUrl, { useStdout: false });
  expect(Array.isArray(args)).toBe(true);
});
```

## Cobertura de Testes

O suite de testes cobre:
- ✅ Todos os argumentos do yt-dlp
- ✅ Modo desktop vs streaming
- ✅ Configurações customizadas
- ✅ Valores padrão
- ✅ Consistência de argumentos
- ✅ Ordem de argumentos
- ✅ Validação de URL
- ✅ Tratamento de erros

## Adicionando Novos Testes

1. Adicione o novo argumento em `config/ytdlp-defaults.json`
2. Crie um teste em `test-ytdlp-arguments.test.js`
3. Use `getDefaultYtdlpConfig()` para carregar a configuração
4. Teste o argumento individual e com variações

Exemplo:
```javascript
describe('New Argument', () => {
  it('should include new argument in arguments', () => {
    const args = downloader.buildYtdlpArgs(defaultConfig, videoUrl, { useStdout: false });
    const hasNewArg = args.includes('--new-argument');
    expect(hasNewArg).toBe(true);
  });
});
```

## Notas Importantes

- Todos os testes usam a configuração padrão de `config/ytdlp-defaults.json`
- A configuração é carregada dinamicamente em tempo de execução
- Mudanças na configuração padrão são refletidas automaticamente em todos os testes
- Use `mergeYtdlpConfig()` para testes com configurações customizadas
- Mantenha a consistência de nomenclatura: `ytdlpArgs` para variáveis de configuração
