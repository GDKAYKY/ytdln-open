# Guia de Instalação - YTDLN Browser Extension

## 📋 Índice
1. [Instalação na Chrome](#instalação-na-chrome)
2. [Instalação no Edge](#instalação-no-edge)
3. [Configuração Inicial](#configuração-inicial)
4. [Primeiro Download](#primeiro-download)
5. [Troubleshooting](#troubleshooting)

## 🚀 Instalação na Chrome

### Passo 1: Ativar Modo Desenvolvedor
1. Abra o Chrome e digite `chrome://extensions` na barra de endereços
2. Ative o switch "**Modo de desenvolvedor**" no canto superior direito
3. Você verá novos botões aparecerem

### Passo 2: Carregar a Extensão
1. Clique em "**Carregar extensão descompactada**"
2. Navegue até a pasta `browser-extension` do projeto YTDLN
3. Clique em "Selecionar Pasta"
4. A extensão será carregada e o ícone roxo aparecerá na barra de ferramentas

### Passo 3: Fixar a Extensão
1. Clique no ícone de extensões (quebra-cabeça) na barra de ferramentas
2. Encontre "YTDLN Browser Extension"
3. Clique no ícone de pino para fixar na barra principal

## 🌐 Instalação no Edge

O processo é muito semelhante:

1. Digite `edge://extensions` na barra de endereços
2. Ative o "Modo de desenvolvedor" no canto inferior esquerdo
3. Clique em "Carregar extensão descompactada"
4. Selecione a pasta `browser-extension`

## ⚙️ Configuração Inicial

### Verificar Conexão com Servidor
1. Certifique-se de que **YTDLN Desktop está em execução**
2. Clique no ícone da extensão na barra de ferramentas
3. Você deve ver "🟢 Conectado ao YTDLN" no topo do popup

Se ver "🔴 Desconectado":
- Inicie o aplicativo YTDLN Desktop
- Verifique se está ouvindo na porta 9000 (padrão)
- Tente atualizar a página (F5)

### Configurações Recomendadas
1. Clique em "⚙️ Configurações"
2. Configure conforme necessário:
   - **Formato padrão**: Recomendado "Melhor Qualidade"
   - **Downloads simultâneos**: 2-3 para máximo desempenho
   - **Legendas automáticas**: Ative se desejar legendas por padrão

## 🎬 Primeiro Download

### Via Popup
1. Acesse um site com vídeos (YouTube, Vimeo, etc)
2. Clique no ícone roxo da extensão
3. A URL da página será preenchida automaticamente
4. Escolha o formato desejado
5. Clique em "⬇️ Baixar"
6. Aguarde a conclusão

### Via Menu de Contexto
1. Clique com botão direito em um link de vídeo
2. Selecione:
   - "⬇️ Baixar com YTDLN" (melhor qualidade)
   - "🎵 Baixar como MP3" (apenas áudio)
3. Download iniciará automaticamente

### Via Botão Flutuante
1. Visite um site de vídeo suportado
2. Procure pelo botão roxo no canto inferior direito
3. Clique para abrir o popup de download

## 🔧 Troubleshooting

### Problema: "Desconectado do servidor"

**Solução:**
```
1. Verifique se YTDLN Desktop está em execução
2. Abra http://localhost:9000/health no navegador
3. Se nada aparecer, o servidor não está rodando
4. Reinicie o YTDLN Desktop
5. Atualize a página do navegador (Ctrl+F5)
```

### Problema: Extensão não aparece na barra de ferramentas

**Solução:**
```
1. Digite chrome://extensions
2. Encontre "YTDLN Browser Extension"
3. Clique no ícone de pino para fixar
4. Se não aparecer na lista:
   - Verifique se o "Modo de desenvolvedor" está ativado
   - Tente recarregar a extensão (ícone de reload)
```

### Problema: Downloads não iniciam

**Solução:**
```
1. Verifique se a URL é válida (começa com http/https)
2. Teste em um site conhecido (YouTube, Vimeo)
3. Verifique as permissões da pasta de downloads
4. Abra o Console do Navegador (F12) para ver erros
5. Tente restaurar as configurações padrão
```

### Problema: Botão flutuante não aparece

**Solução:**
```
1. Ative-o em Configurações > Interface
2. Certifique-se de estar em um site suportado
3. Recarregue a página (Ctrl+F5)
4. Verifique se o site permite injeção de scripts
```

### Problema: Download muito lento

**Solução:**
```
1. Reduza o número de downloads simultâneos em Configurações
2. Feche outras abas/downloads
3. Verifique sua conexão de internet
4. Tente um formato diferente (às vezes resolução menor é mais rápida)
5. Tente novamente em outro horário
```

### Problema: Erro de permissão na pasta de downloads

**Solução:**
```
1. Windows:
   - Verifique propriedades da pasta de downloads
   - Garanta que tem permissão de escrita
   - Tente desabilitar antivírus temporariamente

2. Linux/Mac:
   - Abra terminal: chmod 755 ~/Downloads
   - Verifique propriedades do arquivo
```

### Problema: YTDLN Desktop não inicia

**Solução:**
```
1. Verifique se yt-dlp está instalado
2. Tente executar YTDLN com privilégios de administrador
3. Verifique o log do aplicativo
4. Reinicie o computador
```

## 📝 Logs e Debugging

### Ver Logs do Console
1. Abra a página da extensão: `chrome://extensions/`
2. Clique em "background page" abaixo da extensão
3. O console abrirá com logs detalhados

### Ver Logs da API
```
A API está rodando em http://localhost:9000
Logs aparecem no console do YTDLN Desktop
```

## 🔄 Atualizar a Extensão

### Após Fazer Mudanças no Código:
1. Abra `chrome://extensions`
2. Clique no ícone de recarga (🔄) embaixo da extensão
3. A extensão será recarregada com as mudanças

### Atualizar para Nova Versão:
1. Substitua a pasta `browser-extension` pela nova
2. Abra `chrome://extensions`
3. Clique em recarga na extensão
4. Limpe o cache se necessário (Ctrl+Shift+Delete)

## 💡 Dicas Úteis

- **Atalho Rápido**: Use as opções do menu de contexto para downloads imediatos
- **Múltiplos Downloads**: A extensão permite vários downloads simultâneos
- **Legendas**: Ative em Configurações para downloads automáticos de legendas
- **Playlists**: Copie a URL de uma playlist e a extensão processará cada vídeo

## 🆘 Ainda com Problemas?

1. Verifique a documentação do [README.md](README.md)
2. Abra uma issue no repositório GitHub
3. Colete logs do console (F12) e inclua na issue
4. Descreva a URL exata que você está tentando baixar (sem informações sensíveis)

## 📞 Suporte

Para suporte, consulte:
- [Repositório YTDLN-OPEN](https://github.com/GDKAYKY/ytdln-open)
- [Documentação do Projeto](../docs/DOCUMENTATION.md)
