# Sistema de Download Automático de Binários

Este documento descreve o sistema de download automático de binários implementado no YTDLN Open.

## Funcionalidades

### Detecção Automática do Modo de Execução
- **Instalado**: Detecta quando o app foi instalado via instalador
- **Desenvolvimento**: Detecta quando roda via `npm start`
- **Node.js**: Detecta quando roda diretamente via Node.js (testes)

### Detecção Automática do Sistema Operacional
- Detecta automaticamente o SO (Windows, macOS, Linux)
- Identifica a arquitetura (x64, arm64, etc.)
- Seleciona os binários apropriados para cada plataforma

### Download Automático
- **yt-dlp**: Downloader principal de vídeos
- **aria2c**: Downloader acelerado para melhor performance
- **ffmpeg**: Conversor de vídeo/áudio

### Suporte Multiplataforma

#### Windows
- `yt-dlp.exe` - Binário Windows
- `aria2-1.37.0-win-64bit-build1.zip` - Aria2c para Windows
- `ffmpeg-release-essentials.zip` - FFmpeg para Windows

#### macOS
- `yt-dlp_macos` - Binário macOS
- `aria2-1.37.0-osx-darwin-build1.tar.bz2` - Aria2c para macOS
- `ffmpeg-6.1.1.zip` - FFmpeg para macOS

#### Linux
- `yt-dlp` - Binário Linux
- `aria2-1.37.0-linux-gnu-build1.tar.bz2` - Aria2c para Linux
- `ffmpeg-release-amd64-static.tar.xz` - FFmpeg para Linux

## Como Funciona

### Inicialização
1. Ao iniciar a aplicação, o sistema verifica se os binários já existem
2. Se não existirem, inicia o download automático
3. Extrai os arquivos compactados automaticamente
4. Define permissões de execução (Unix/Linux/macOS)
5. Verifica se todos os binários estão funcionais

### Estrutura de Diretórios
```
bin/
├── yt-dlp[.exe]           # yt-dlp executável
├── aria2-[version]/       # Diretório do aria2c extraído
│   └── aria2c[.exe]       # aria2c executável
└── ffmpeg-[version]/      # Diretório do ffmpeg extraído
    └── bin/
        └── ffmpeg[.exe]   # ffmpeg executável
```

### Desenvolvimento vs Release
- **Desenvolvimento** (`npm start`): Binários são salvos em `./bin/`
- **Instalado** (via instalador): Binários são salvos em `process.resourcesPath/bin/`
- **Node.js** (testes): Binários são salvos em `./bin/`

## Implementação Técnica

### Classe BinaryDownloader
Localizada em `src/downloader.js`, esta classe gerencia todo o processo:

```javascript
const downloader = new BinaryDownloader();
const paths = await downloader.checkAndDownloadBinaries();
```

### Métodos Principais
- `getAppMode()`: Detecta como o app está rodando (instalado/desenvolvimento/nodejs)
- `checkAndDownloadBinaries()`: Verifica e baixa binários faltantes
- `downloadFile(url, filename)`: Baixa um arquivo específico
- `extractArchive(archivePath, extractTo)`: Extrai arquivos compactados
- `getBinaryPaths()`: Retorna os caminhos dos binários encontrados

### Integração com Electron
- **Main Process**: Gerencia downloads e execução de binários
- **Renderer Process**: Exibe status e progresso para o usuário
- **IPC**: Comunicação entre processos para status e erros

## Tratamento de Erros

### Erros de Download
- Falha de conexão de rede
- URLs inválidas ou arquivos não encontrados
- Falha de permissão de escrita

### Erros de Extração
- Arquivos corrompidos
- Falta de ferramentas de extração (unzip, tar)
- Falha de permissão de execução

### Erros de Execução
- Binários não encontrados
- Falha de permissão de execução
- Incompatibilidade de arquitetura

## Logs e Debugging

### Modo Debug
Ative o checkbox "Ativar log de depuração" na interface para ver logs detalhados.

### Logs do Console
```javascript
console.log('Detectado SO: win32 (x64)');
console.log('Baixando yt-dlp.exe...');
console.log('Arquivo extraído: aria2c.zip');
console.log('Binários inicializados:', paths);
```

## Configuração e Personalização

### URLs de Download
As URLs podem ser modificadas no método `getDownloadUrls()` da classe `BinaryDownloader`.

### Diretório de Binários
O diretório pode ser alterado modificando o método `getBinDirectory()`.

### Timeout e Retry
Atualmente não implementado, mas pode ser adicionado para maior robustez.

## Troubleshooting

### Problemas Comuns

1. **Binários não baixam**
   - Verificar conexão de internet
   - Verificar permissões de escrita no diretório
   - Verificar URLs de download

2. **Erro de extração**
   - Windows: Verificar se PowerShell está disponível
   - macOS/Linux: Verificar se `unzip` e `tar` estão instalados

3. **Erro de execução**
   - Verificar permissões de execução
   - Verificar se a arquitetura é compatível
   - Verificar se os binários não estão corrompidos

### Limpeza Manual
Para forçar novo download, delete o diretório `bin/` e reinicie a aplicação.

## Benefícios

1. **Facilidade de Uso**: Usuário não precisa baixar binários manualmente
2. **Multiplataforma**: Funciona em Windows, macOS e Linux
3. **Atualizações Automáticas**: Sempre baixa as versões mais recentes
4. **Robustez**: Verifica integridade e funcionalidade dos binários
5. **Performance**: Usa aria2c para downloads mais rápidos
