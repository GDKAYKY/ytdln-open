---

## 🔥 Fluxo “Real-time Streaming”

### 1️⃣ Backend

* Quando o usuário solicita o download, **o backend começa a baixar o vídeo**.
* Imediatamente, ele abre um endpoint que **repassa o stream do vídeo em tempo real** para quem se conectar (Chrome).

```javascript
// GET /api/download/:taskId/stream
app.get('/api/download/:taskId/stream', async (req, res) => {
  const task = downloadService.getTask(req.params.taskId);

  if (!task) return res.status(404).send('Task não encontrada');

  res.setHeader('Content-Disposition', `attachment; filename="${task.fileName}"`);
  res.setHeader('Content-Type', 'application/octet-stream');

  // Se o arquivo já está parcialmente baixado
  const stream = downloadService.createReadStream(task); // gera stream em tempo real
  stream.pipe(res);
});
```

* `createReadStream(task)` precisa suportar **ler enquanto o download ainda está em progresso**.
* Se o Chrome se conectar antes do arquivo terminar, ele **recebe o stream conforme o backend vai baixando**, sem criar outro download.

---

### 2️⃣ Extensão (popup.js)

* Conecta **direto ao endpoint de streaming** assim que o usuário clica.
* **Não espera “completo”**, só inicia o download real-time.

```javascript
chrome.downloads.download({
  url: `http://localhost:9001/api/download/${taskId}/stream`,
  filename: task.fileName
});
```

✅ Benefícios:

* **Um único fluxo**: backend baixa + Chrome consome.
* Sem duplicação em disco.
* Sem buffering duplo em memória.
* Funciona em tempo real, mesmo para vídeos grandes.

---

### 3️⃣ Fluxo final

```text
Usuário clica "Download"
         ↓
popup.js → POST /api/download
         ↓
Backend inicia download em tempo real
         ↓
popup.js chama chrome.downloads.download() → /api/download/:taskId/stream
         ↓
Backend streama o vídeo em tempo real
         ↓
Chrome salva enquanto recebe o stream
```

* Nenhuma duplicação de recursos
* Nenhum arquivo extra criado antes do download do Chrome
* Download em tempo real, com progresso atualizado via SSE se quiser

---