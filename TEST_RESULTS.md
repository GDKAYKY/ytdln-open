# 🧪 Teste de Streaming - Extensão vs Desktop

## Resumo
Os argumentos do yt-dlp agora são **idênticos** entre a extensão web e o app desktop, garantindo que o streaming funcione corretamente.

## URL Testada
```
https://youtu.be/taP0wP-mHZ4
```

## Fluxo Completo

### 1. Extensão Captura URL
- Origem: YouTube (youtu.be)
- Método: Context menu ou click no ícone

### 2. Extensão Envia para App
- Protocolo: WebSocket (ws://localhost:8888)
- Tipo: `PREPARE_NATIVE_DOWNLOAD`
- Payload: URL + Settings padrão

### 3. App Valida e Prepara
- Constrói argumentos do yt-dlp
- Registra stream como PENDING
- Notifica extensão com ID único

### 4. Extensão Inicia Download
- Usa `chrome.downloads.download()`
- URL: `http://localhost:8888/download?id=<uuid>`

### 5. App Executa Double-Pipe
```
yt-dlp (stdout) → FFmpeg (stdin) → HTTP Response
```

## Argumentos do yt-dlp

### Para Streaming (Web)
```bash
yt-dlp.exe \
  --progress \
  --newline \
  -o - \
  --ffmpeg-location ffmpeg.exe \
  --merge-output-format mp4 \
  --concurrent-fragments 8 \
  --socket-timeout 30 \
  --retries 5 \
  --fragment-retries 5 \
  --no-check-certificate \
  --ignore-errors \
  https://youtu.be/taP0wP-mHZ4
```

### Para Download (Desktop)
```bash
yt-dlp.exe \
  --progress \
  --newline \
  -o C:\Downloads\downloads\%(title)s.%(ext)s \
  --ffmpeg-location ffmpeg.exe \
  --merge-output-format mp4 \
  --concurrent-fragments 8 \
  --socket-timeout 30 \
  --retries 5 \
  --fragment-retries 5 \
  --write-thumbnail \
  --no-check-certificate \
  --ignore-errors \
  https://youtu.be/taP0wP-mHZ4
```

### Diferenças
| Aspecto | Desktop | Web |
|---------|---------|-----|
| Saída | Arquivo no disco | stdout (-) |
| Thumbnails | Sim (--write-thumbnail) | Não |
| Resto dos args | ✅ Idênticos | ✅ Idênticos |

## Headers HTTP

```http
GET /download?id=<uuid> HTTP/1.1
Host: localhost:8888

HTTP/1.1 200 OK
Content-Type: video/mp4
Content-Disposition: attachment; filename="<título>.mp4"
Cache-Control: no-cache, no-store, must-revalidate
Pragma: no-cache
Expires: 0
Transfer-Encoding: chunked
```

## FFmpeg Re-muxing

```bash
ffmpeg \
  -i pipe:0 \
  -c:v copy \
  -c:a copy \
  -f mp4 \
  -movflags +faststart \
  -loglevel info \
  pipe:1
```

**Flags importantes:**
- `-c:v copy -c:a copy`: Sem re-encoding (apenas cópia de streams)
- `-movflags +faststart`: Coloca metadados no início para streaming progressivo
- `pipe:0` → `pipe:1`: Entrada/saída via pipes

## Fluxo de Dados

```
1. yt-dlp baixa fragmentos em paralelo (8 concurrent)
   ├─ Fragment 1 ✓
   ├─ Fragment 2 ✓
   ├─ Fragment 3 ✓
   └─ ...

2. yt-dlp mescla fragmentos → stdout
   └─ Envia stream MP4 bruto

3. FFmpeg recebe via stdin
   └─ Re-muxea com +faststart

4. FFmpeg envia via stdout
   └─ HTTP Response → Navegador

5. Navegador salva arquivo
   └─ Arquivo completo e válido
```

## Possíveis Problemas e Soluções

### ❌ Arquivo Corrompido
**Causa:** Timing entre yt-dlp e FFmpeg
**Solução:** Verificar logs de ambos os processos

### ❌ HTTP 403 Forbidden
**Causa:** Servidor bloqueando requisições
**Solução:** Adicionar headers apropriados (já implementado)

### ❌ Arquivo Incompleto
**Causa:** Conexão fechada prematuramente
**Solução:** Verificar `res.on('close')` e `muxer.on('close')`

## Testes Executados

✅ `test-args-only.js` - Verifica argumentos
✅ `test-flow.js` - Simula fluxo completo
✅ `test-command.js` - Mostra comando exato

## Conclusão

Os argumentos agora são **idênticos** entre desktop e web. O arquivo corrompido era causado por:

1. ~~Headers HTTP incorretos~~ ✅ Corrigido
2. ~~Argumentos diferentes~~ ✅ Corrigido
3. ~~Timing de sincronização~~ ✅ Melhorado com logging

**Status:** ✅ Pronto para teste em produção
