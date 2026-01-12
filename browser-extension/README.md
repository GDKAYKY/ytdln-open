# YTDLN Browser Extension

Extensão de navegador Chrome que permite baixar vídeos diretamente do seu navegador usando o servidor YTDLN Desktop.

## 🚀 Instalação

### Pré-requisitos
- Chrome 90+
- YTDLN Desktop aplicativo em execução na sua máquina

### Passos para Instalar (Modo Desenvolvedor)

1. **Clonar ou descompactar a extensão**
   - Certifique-se que a pasta `browser-extension` está acessível

2. **Abrir Chrome Extension Manager**
   - Digite `chrome://extensions` na barra de endereços
   - Ative o "Modo de desenvolvedor" (canto superior direito)

3. **Carregar extensão descompactada**
   - Clique em "Carregar extensão descompactada"
   - Selecione a pasta `browser-extension`

4. **Iniciar YTDLN Desktop**
   - Execute o aplicativo YTDLN Desktop
   - A extensão se conectará automaticamente

## 📋 Funcionalidades

### Popup Principal
- ✅ Preenche automaticamente a URL da aba atual
- ✅ Seleção de formato (Melhor Qualidade, MP3, MP4)
- ✅ Opção para baixar legendas
- ✅ Barra de progresso em tempo real
- ✅ Status de conexão com o servidor

### Menu de Contexto
- **Clique direito em qualquer link**: Opções rápidas de download
  - "Baixar com YTDLN" (melhor qualidade)
  - "Baixar como MP3" (áudio apenas)
  - "Copiar informações do vídeo"

### Botão Flutuante
- Aparece automaticamente em sites de vídeo
- Download rápido com um clique
- Design minimalista e não intrusivo

### Configurações
- URL do servidor personalizável
- Formato padrão configurável
- Controle de downloads simultâneos
- Configurações de interface e notificações

## 🔧 Configuração

Acesse as configurações clicando no ícone da extensão e depois em "⚙️ Configurações"

### Configurações Principais

#### 🔗 Servidor
- **URL do Servidor**: Endereço do YTDLN Desktop (padrão: `http://localhost:9000`)
- **Conexão Automática**: Conecta ao servidor quando a extensão carrega

#### ⬇️ Downloads
- **Formato Padrão**: Qualidade padrão para novos downloads
- **Legendas Automáticas**: Baixa legendas se disponíveis
- **Downloads Simultâneos**: Número máximo de downloads simultâneos

#### 🎨 Interface
- **Botão Flutuante**: Mostra botão flutuante em páginas de vídeo
- **Menu de Contexto**: Habilita opções no clique direito
- **Notificações**: Mostra notificações de progresso

#### ⚙️ Avançado
- **Timeout de Requisição**: Tempo máximo de espera por resposta
- **Tentativas de Conexão**: Quantas vezes tentar reconectar

## 🌐 Sites Suportados

A extensão funciona com qualquer site suportado pelo `yt-dlp`:

- YouTube
- Vimeo
- DailyMotion
- Twitch
- Instagram
- TikTok
- Reddit
- Twitter/X
- Facebook
- Bilibili
- E mais de 1000+ sites

## 📱 Como Usar

### Método 1: Popup
1. Clique no ícone da extensão na barra de ferramentas
2. A URL da aba atual será preenchida automaticamente
3. Escolha o formato desejado
4. Clique em "⬇️ Baixar"
5. O download será iniciado na pasta de downloads

### Método 2: Menu de Contexto
1. Clique direito em um link de vídeo
2. Selecione a opção desejada
3. Download iniciado automaticamente

### Método 3: Botão Flutuante
1. Visite um site de vídeo suportado
2. Clique no botão roxo flutuante
3. Preencha a URL e clique em "Baixar"

## 🔄 Stream de Download

A extensão implementa um sistema de stream eficiente:

- **Monitoramento em Tempo Real**: Acompanha progresso e tempo estimado
- **Comunicação Bidirecional**: Popup e servidor se comunicam continuamente
- **Tratamento de Erros**: Tentativas automáticas e mensagens claras
- **Fila de Downloads**: Gerencia múltiplos downloads simultâneos

## 🛠️ Integração com Backend

A extensão se comunica com o servidor YTDLN via endpoints HTTP:

### `POST /api/download`
Inicia um novo download

**Request:**
```json
{
  "url": "https://example.com/video",
  "format": "best|audio|video",
  "subtitles": true|false,
  "source": "browser-extension"
}
```

**Response:**
```json
{
  "success": true,
  "downloadId": "uuid",
  "message": "Download iniciado"
}
```

### `GET /api/download/{downloadId}/progress`
Obtém progresso do download

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

### `POST /api/video-info`
Obtém informações do vídeo

**Request:**
```json
{
  "url": "https://example.com/video"
}
```

**Response:**
```json
{
  "title": "Título do Vídeo",
  "uploader": "Canal/Autor",
  "duration": "10:32",
  "description": "...",
  "formats": ["best", "720p", "audio"]
}
```

### `GET /health`
Verifica se o servidor está rodando

## 📝 Permissões Usadas

- `downloads`: Para gerenciar downloads
- `tabs`: Para ler URL da aba atual
- `scripting`: Para injetar content scripts
- `webRequest`: Para monitorar requisições (futuro)

## 🐛 Troubleshooting

### "Desconectado do servidor"
- Certifique-se que YTDLN Desktop está rodando
- Verifique se a URL do servidor está correta nas configurações
- Tente acessar `http://localhost:9000/health` no navegador

### Downloads não iniciam
- Verifique as permissões da pasta de downloads
- Tente restaurar as configurações padrão
- Verifique o console do navegador para erros

### Botão flutuante não aparece
- Ative-o nas configurações
- Certifique-se de estar em um site suportado
- Recarregue a página

## 🔐 Segurança

- A extensão se comunica apenas com `localhost` por padrão
- Nenhum dado é enviado para servidores externos
- URLs são apenas processadas localmente
- Toda comunicação é através do servidor YTDLN que você controla

## 📄 Licença

Mesma licença do projeto YTDLN-OPEN (ISC)

## 👨‍💻 Desenvolvido para YTDLN-OPEN

Para mais informações sobre o projeto principal, visite:
https://github.com/GDKAYKY/ytdln-open
