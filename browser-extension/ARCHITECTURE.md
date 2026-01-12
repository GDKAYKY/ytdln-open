# Arquitetura da Extensão

## 📐 Estrutura dos Componentes

```
browser-extension/
├── manifest.json              # Configuração da extensão Chrome
├── package.json               # Metadados
├── README.md                  # Documentação principal
├── INSTALLATION.md            # Guia de instalação
├── images/                    # Ícones da extensão
│   ├── icon16.png            # Ícone pequeno (16x16)
│   ├── icon48.png            # Ícone médio (48x48)
│   └── icon128.png           # Ícone grande (128x128)
└── src/
    ├── popup.html            # Interface principal do popup
    ├── popup.js              # Lógica do popup
    ├── background.js         # Service Worker (funções de fundo)
    ├── content.js            # Content script (rodando na página)
    ├── injected.js           # Script injetado no DOM
    ├── options.html          # Página de configurações
    └── options.js            # Lógica de configurações
```

## 🔄 Fluxo de Dados

### 1. **Quando o usuário clica no ícone da extensão:**

```
User clicks icon
    ↓
Popup abre (popup.html)
    ↓
popup.js carrega configurações do Chrome Storage
    ↓
popup.js verifica saúde do servidor (GET /health)
    ↓
Popup exibe status de conexão
    ↓
Usuário enche o formulário e clica "Baixar"
    ↓
popup.js envia POST para http://localhost:9000/api/download
    ↓
stream-download-api.js recebe a requisição
    ↓
VideoDownloader.download() é chamado
    ↓
popup.js monitora progresso (GET /api/download/{id}/progress)
    ↓
Arquivo é salvo na pasta de downloads
```

### 2. **Quando o usuário clica direito (contexto):**

```
User right-clicks
    ↓
background.js intercepta o evento
    ↓
content.js detecta o tipo de link
    ↓
background.js mostra menu de contexto
    ↓
User seleciona opção
    ↓
background.js envia POST para API
    ↓
StreamDownloadAPI inicia download
    ↓
Notificação aparece quando completo
```

### 3. **Botão flutuante:**

```
Page loads
    ↓
content.js verifica se é site de vídeo
    ↓
createFloatingButton() injeta botão no DOM
    ↓
User clica botão
    ↓
popup.html abre
    ↓
Fluxo normal de download
```

## 🔌 Comunicação com Backend

### Endpoints HTTP

#### 1. Health Check
```
GET http://localhost:9000/health
```
- Verifica se a API está rodando
- Chamado a cada 5 segundos do popup
- Chamado a cada 30 segundos do background

#### 2. Iniciar Download
```
POST http://localhost:9000/api/download
Content-Type: application/json

{
  "url": "https://...",
  "format": "best|audio|video",
  "subtitles": true|false,
  "source": "browser-extension"
}
```

**Response:**
```json
{
  "success": true,
  "downloadId": "download_1234567890_1",
  "message": "Download iniciado"
}
```

#### 3. Obter Progresso
```
GET http://localhost:9000/api/download/{downloadId}/progress
```

**Response:**
```json
{
  "status": "downloading|completed|error",
  "progress": 45,
  "eta": "2 minutos",
  "speed": "1.2 MB/s",
  "downloaded": "45 MB",
  "total": "100 MB"
}
```

#### 4. Informações do Vídeo
```
POST http://localhost:9000/api/video-info
Content-Type: application/json

{
  "url": "https://..."
}
```

**Response:**
```json
{
  "title": "Título",
  "uploader": "Autor",
  "duration": "10:32",
  "formats": ["best", "720p", "audio"]
}
```

## 🔐 Segurança e CORS

A extensão implementa CORS adequadamente:
- Headers `Access-Control-Allow-Origin: *` (localhost apenas)
- Validação de URLs antes de enviar
- Sanitização de inputs
- Verificação de channel IPC no Electron

## 🛠️ Implementação do Backend (Electron)

No `src/main.js`:

```javascript
const StreamDownloadAPI = require("./stream-download-api");

// Inicializar
streamDownloadAPI = new StreamDownloadAPI(videoDownloader, 9000);
await streamDownloadAPI.start();

// Ao fechar
await streamDownloadAPI.stop();
```

O arquivo `stream-download-api.js` contém:

- **Servidor HTTP** em porta 9000
- **Endpoints REST** para download com stream
- **Cache de downloads** em memória
- **Callbacks de progresso** ao VideoDownloader
- **Tratamento de erros** robusto

## 🎨 Interface do Usuário

### Popup (popup.html + popup.js)
- 450px de largura
- Design responsivo e moderno
- Gradiente roxo (667eea → 764ba2)
- Status de conexão em tempo real
- Seleção de formato com radio buttons
- Barra de progresso com percentual

### Configurações (options.html + options.js)
- 800px de largura
- 4 seções principais:
  1. Configuração do Servidor
  2. Configuração de Downloads
  3. Interface
  4. Avançado
- Armazenamento em Chrome Storage API
- Validação de URLs e números

### Botão Flutuante (content.js)
- 56x56px
- Posição fixed bottom-right
- Gradiente roxo
- Hover effects
- Z-index: 10000
- Detecta sites de vídeo

## 🔄 Lifecycle da Extensão

```
1. User instala extensão
   ↓
2. chrome.runtime.onInstalled dispara
   ↓
3. Cria menu de contexto
   ↓
4. Carrega configurações do Storage
   ↓
5. Service Worker roda em background
   ↓
6. Quando user clica ícone:
   - popup.js executa
   - Verifica saúde do servidor
   - Renderiza UI
   ↓
7. Content script roda em toda página
   ↓
8. Detecta links de vídeo
   ↓
9. Injeta botão flutuante se necessário
```

## 🌟 Recursos Avançados

### 1. **Monitoramento Contínuo**
- Polling a cada 1 segundo durante download
- Atualiza UI com progresso
- Mostra velocidade e tempo estimado

### 2. **Detecção de Vídeo**
- Monkey patch de `window.fetch`
- Content Security Policy aware
- Suporta 1000+ sites

### 3. **Gerenciamento de Downloads**
- Cache em memória de estados
- Cancelamento de downloads
- Histórico de downloads

### 4. **Armazenamento**
- Chrome Storage API (sync)
- Persistência de configurações
- Sincronização entre dispositivos

## 📦 Build e Deploy

### Empacotamento para Chrome Web Store
```bash
cd browser-extension
# Criar zip
zip -r ytdln-extension.zip . -x "*.git*" "node_modules/*" ".DS_Store"
# Enviar para Chrome Web Store
```

### Atualização da Extensão
1. Modificar versão em manifest.json
2. Fazer alterações no código
3. Testar em chrome://extensions (reload)
4. Criar novo .zip para upload

## 🐛 Debug e Development

### Chrome DevTools para Extensão
1. `chrome://extensions/`
2. Clique em "background page" para Service Worker console
3. Abra DevTools (F12) no popup para debug de popup.js

### Logs Detalhados
```javascript
// No popup.js
console.log('Status:', statusDiv.textContent);

// No background.js
console.log('Download iniciado:', downloadId);

// No content.js
console.log('[YTDLN] Vídeo detectado:', url);
```

## 🔗 Integração com YTDLN Desktop

A extensão se integra com:
- **VideoDownloader** classe
- **libraryManager** para metadados
- **FileSystem** para salvar downloads
- **Process IPC** para comunicação Electron

Sem modificar nenhum código existente do Electron, apenas adicionando:
- `StreamDownloadAPI` nova classe
- Inicialização no `main.js`
- Endpoints HTTP para comunicação
