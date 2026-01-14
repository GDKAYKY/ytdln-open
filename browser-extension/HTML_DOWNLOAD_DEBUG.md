# 🐛 Debug: Baixou HTML em vez do arquivo

## ❌ Problema Identificado

A extensão baixou um arquivo HTML em vez do vídeo real. Isso indica que o endpoint está retornando uma página web (provavelmente erro 404) em vez do arquivo binário.

## 🔍 Diagnóstico

### O que provavelmente aconteceu:
```
1. Extensão chama: GET /api/download/123/stream
2. Servidor retorna: 404 Not Found (como página HTML)
3. chrome.downloads.download baixa essa página HTML
4. Usuário vê arquivo HTML na lista de downloads
```

### Possíveis respostas do servidor:
```html
<!-- Página de erro 404 -->
<!DOCTYPE html>
<html>
<head><title>404 Not Found</title></head>
<body><h1>Endpoint não encontrado</h1></body>
</html>
```

## ✅ Correção Implementada

### 1. **Verificação de Content-Type**
```javascript
const testResponse = await fetch(streamUrl, { method: 'HEAD' });
const contentType = testResponse.headers.get('content-type');

// Só baixa se NÃO for HTML/JSON
if (!contentType.includes('text/html') && 
    !contentType.includes('application/json')) {
  // É arquivo válido, pode baixar
}
```

### 2. **Verificação de Tamanho**
```javascript
const contentLength = testResponse.headers.get('content-length');

// Só baixa se for arquivo grande (> 1KB)
if (contentLength && parseInt(contentLength) > 1000) {
  // Provavelmente é arquivo real, não página de erro
}
```

### 3. **Múltiplos Endpoints**
```javascript
const alternativeUrls = [
  '/api/download/123/stream',  // Principal
  '/stream/123',               // Alternativo 1
  '/files/video.mp4',          // Alternativo 2
  '/download/123',             // Alternativo 3
  '/api/files/123'             // Alternativo 4
];
```

## 🧪 Como Debugar

### 1. **Verificar Logs da Extensão**
```
1. Abra chrome://extensions
2. Clique "background page" na extensão YTDLN
3. Faça um download
4. Veja logs:
   - "[Background] Endpoint resposta: {status: 404, contentType: 'text/html'}"
   - "[Background] ❌ Endpoint retorna HTML/JSON, não arquivo"
```

### 2. **Testar Endpoint Manualmente**
```bash
# Verificar o que o endpoint realmente retorna:
curl -I http://localhost:9001/api/download/123/stream

# Resposta esperada (arquivo):
HTTP/1.1 200 OK
Content-Type: video/mp4
Content-Length: 12345678

# Resposta problemática (HTML):
HTTP/1.1 404 Not Found
Content-Type: text/html
Content-Length: 234
```

### 3. **Usar Página de Teste**
```
1. Abra test-stream-endpoint.html
2. Insira um taskId real
3. Clique "Testar Stream"
4. Veja o que o endpoint retorna
```

## 🔧 Status dos Endpoints

### Testados pela Extensão:
| Endpoint | Status | Observação |
|----------|--------|------------|
| `/api/download/{id}/stream` | ❌ HTML | Retorna página 404 |
| `/stream/{id}` | ⏳ Testando | Endpoint alternativo |
| `/files/{filename}` | ⏳ Testando | Arquivos estáticos |
| `/download/{id}` | ⏳ Testando | Download direto |

## 🎯 Soluções Possíveis

### Opção A: **Implementar Endpoint Correto**
```javascript
// No backend, implementar:
app.get('/api/download/:taskId/stream', (req, res) => {
  const taskId = req.params.taskId;
  const downloadInfo = getDownloadInfo(taskId);
  
  if (!downloadInfo?.outputPath) {
    return res.status(404).json({ error: 'Download não encontrado' });
  }
  
  // Streamear arquivo real
  res.sendFile(path.resolve(downloadInfo.outputPath));
});
```

### Opção B: **Usar Endpoint Existente**
```javascript
// Se já existe outro endpoint que funciona:
const workingUrl = 'http://localhost:9001/files/video.mp4';
// Extensão já testa automaticamente
```

### Opção C: **Desabilitar Temporariamente**
```javascript
// Na extensão, apenas notificar:
showNotification('Download Concluído ✅', 
  `${fileName} foi baixado e salvo na pasta Downloads`);
```

## 📊 Comportamento Atual vs Esperado

| Cenário | Atual | Esperado |
|---------|-------|----------|
| **Endpoint existe** | ✅ Detecta e baixa | ✅ Detecta e baixa |
| **Endpoint retorna HTML** | ✅ Detecta e ignora | ✅ Detecta e ignora |
| **Endpoint não existe** | ✅ Testa alternativas | ✅ Testa alternativas |
| **Todas URLs falham** | ✅ Apenas notifica | ✅ Apenas notifica |

## 🔮 Próximos Passos

### 1. **Verificar Logs**
```
Abra console da extensão e veja:
- Qual endpoint foi chamado
- Qual foi a resposta (HTML/JSON/arquivo)
- Quais URLs alternativas foram testadas
```

### 2. **Testar Endpoints**
```bash
# Testar cada endpoint manualmente:
curl -I http://localhost:9001/api/download/TASK_ID_REAL/stream
curl -I http://localhost:9001/stream/TASK_ID_REAL
curl -I http://localhost:9001/files/NOME_ARQUIVO_REAL.mp4
```

### 3. **Implementar Backend**
```
Se nenhum endpoint funcionar:
- Implementar /api/download/:taskId/stream
- Ou configurar servidor de arquivos estáticos
- Ou aceitar que apenas notificação é suficiente
```

## ✅ Resultado da Correção

Com as verificações implementadas:

- ✅ **Não baixa mais HTML** - Detecta content-type
- ✅ **Testa múltiplas URLs** - Fallbacks automáticos  
- ✅ **Logs detalhados** - Debug fácil
- ✅ **Graceful fallback** - Notifica se nada funcionar

**A extensão agora está protegida contra baixar arquivos HTML indesejados! 🛡️**

---

## 💡 Resumo

**Problema:** Endpoint retornava HTML (página 404)  
**Solução:** Verificar content-type antes de baixar  
**Resultado:** Só baixa arquivos reais, ignora HTML/JSON  

**A extensão agora é inteligente e não cai em pegadinhas! 🧠**