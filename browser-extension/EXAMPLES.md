# Exemplos de Uso - YTDLN Browser Extension

## 🎬 Casos de Uso Práticos

### 1. Baixar um vídeo do YouTube em melhor qualidade

```
1. Abra o YouTube e encontre o vídeo desejado
2. Clique no ícone roxo da extensão (YTDLN)
3. Veja a URL do vídeo já preenchida
4. Selecione "Melhor Qualidade"
5. Clique "⬇️ Baixar"
6. Acompanhe o progresso na barra
7. Arquivo salvo em Downloads/
```

**Resultado:** Vídeo MP4 com melhor qualidade disponível

---

### 2. Converter vídeo para MP3

```
1. Navegue para o vídeo (YouTube, Vimeo, etc)
2. Clique com botão direito no link do vídeo
3. Selecione "🎵 Baixar como MP3"
4. Download inicia automaticamente
5. Arquivo .mp3 é salvo em Downloads/
```

**Resultado:** Arquivo de áudio MP3

---

### 3. Download com legendas

```
1. Abra o popup da extensão
2. Cole a URL do vídeo
3. Selecione "Melhor Qualidade"
4. Marque ✓ "Baixar legendas"
5. Clique "⬇️ Baixar"
6. Legendas são baixadas junto com o vídeo
```

**Resultado:** Vídeo + arquivo .srt de legendas

---

### 4. Usar o botão flutuante

```
1. Visite um site de vídeo (YouTube, Vimeo, TikTok, etc)
2. Procure pelo botão roxo 🎥 no canto inferior direito
3. Clique nele
4. Preencha/confirme a URL
5. Selecione formato
6. Clique "⬇️ Baixar"
```

**Resultado:** Download rápido sem abrir popup separado

---

### 5. Multiple downloads simultâneos

```
1. Configure "Downloads simultâneos: 3" em Configurações
2. Cole URL 1 → Clique Baixar
3. Cole URL 2 → Clique Baixar
4. Cole URL 3 → Clique Baixar
5. Todos os 3 downloads rodam em paralelo
6. Monitor progresso de cada um
```

**Resultado:** 3 vídeos baixando ao mesmo tempo

---

### 6. Download de qualidade específica

```
1. Abra popup YTDLN
2. Cole URL do vídeo
3. Selecione "720p (se disponível)"
4. Clique "⬇️ Baixar"
```

**Resultado:** Vídeo em 720p (ou melhor se não disponível)

---

## 🔧 Cenários de Configuração

### Cenário A: Downloads Rápidos (Padrão)

**Configurações:**
- Formato: Melhor Qualidade
- Legendas automáticas: ❌ Desativado
- Downloads simultâneos: 2
- Timeout: 30s

**Uso:** Downloads rápidos de vídeos populares

---

### Cenário B: Máxima Qualidade + Legendas

**Configurações:**
- Formato: Melhor Qualidade
- Legendas automáticas: ✓ Ativado
- Downloads simultâneos: 1
- Timeout: 120s

**Uso:** Arquivamento de conteúdo importante

---

### Cenário C: Downloads de Áudio

**Configurações:**
- Formato: Apenas Áudio (MP3)
- Legendas automáticas: ❌ Desativado
- Downloads simultâneos: 5
- Timeout: 30s

**Uso:** Podcasts, músicas, audiobooks

---

### Cenário D: Servidor Remoto

**Configurações:**
- URL do Servidor: `http://192.168.1.100:9000`
- Conexão Automática: ✓ Ativado
- Retry Attempts: 5
- Timeout: 60s

**Uso:** YTDLN Desktop em outro computador da rede

---

## 🎯 Integração com Fluxos de Trabalho

### Criar Biblioteca de Vídeos

```
1. Escrever lista de URLs em arquivo .txt
2. Para cada URL:
   a. Copiar URL
   b. Abrir popup YTDLN
   c. Colar URL
   d. Configurar (formato, legendas)
   e. Clicar Baixar
3. Todos os vídeos salvos em Downloads/
4. Organizar em pastas
```

**Ferramenta Complementar:** Usar yt-dlp CLI para lotes

---

### Arquivamento Web

```
1. Encontrar conteúdo importante online
2. Clique direito → "Baixar com YTDLN"
3. Arquivo salvo automaticamente
4. Gravar em HD externo ou nuvem
5. Organizar por data/tema
```

**Benefício:** Backup local de conteúdo web

---

### Criação de Conteúdo

```
1. Pesquisar vídeos de referência
2. Usar extensão para baixar clips
3. Editar no software de vídeo
4. Criar derivados com atribuição
```

**Lembrete:** Respeitar direitos autorais e licenças

---

## 📱 Atalhos de Teclado Úteis

### Chrome
- `Ctrl+Shift+Y` → Abrir histórico de downloads
- `Ctrl+J` → Gerenciador de downloads
- `F12` → DevTools (para debug)

### Extensão
- Clique ícone + `Espaço` → Preenche URL automática
- Clique direito em qualquer link → Menu rápido
- Botão flutuante em sites de vídeo → Download rápido

---

## 🌐 Websites Testados

### Suportados Completamente
- ✅ YouTube
- ✅ Vimeo
- ✅ DailyMotion
- ✅ Twitch (clips)
- ✅ TikTok
- ✅ Instagram
- ✅ Reddit

### Suportados com Restrições
- ⚠️ Twitter/X (vídeos públicos)
- ⚠️ Facebook (vídeos públicos)
- ⚠️ Linkedin (com login)

### Requerem Configuração
- 🔧 Netflix (requer plugin especial)
- 🔧 Disney+ (requer plugin especial)
- 🔧 Amazon Prime (requer plugin especial)

---

## 🐛 Troubleshooting por Caso de Uso

### "Não consigo baixar do YouTube"
1. Verifique se yt-dlp está atualizado
   ```bash
   yt-dlp --version
   ```
2. Tente copiar URL exata do vídeo
3. Verifique se não está em modo privado

### "Download inicia mas não termina"
1. Verifique espaço em disco
2. Reduza downloads simultâneos
3. Tente novamente após reiniciar YTDLN

### "Legenda não é baixada"
1. Verifique se vídeo tem legendas disponíveis
2. Ative em Configurações
3. Alguns sites bloqueiam legendas

### "Extensão perdeu conexão"
1. Reinicie YTDLN Desktop
2. Atualize página (Ctrl+F5)
3. Verifique firewall

---

## 📊 Performance Tips

### Otimizar Downloads
1. **Velocidade:** Use formato menor (720p em vez de 1080p)
2. **Armazenamento:** Escolha "Apenas Áudio" para podcasts
3. **Paralelismo:** Aumente downloads simultâneos (até 5)

### Otimizar Extensão
1. **RAM:** Feche extensão se não usar (clique ícone)
2. **Disco:** Limpe Downloads periodicamente
3. **Rede:** Baixe em horários fora de pico

---

## 🎓 Aprendizado e Recursos

### Comandos yt-dlp Úteis
```bash
# Ver formatos disponíveis
yt-dlp -F "https://..."

# Baixar com configuração customizada
yt-dlp -f 'best' --write-subs "https://..."

# Baixar playlist inteira
yt-dlp -i "https://...playlist..."
```

### Extensão como Complemento
A extensão é ideal para:
- ✅ Download rápido de vídeo único
- ✅ Downloads ocasionais
- ✅ Descoberta e teste

Use CLI (yt-dlp) para:
- ❌ Bulk downloads
- ❌ Automação em scripts
- ❌ Configurações complexas

---

## 💡 Pro Tips

1. **Duplo-clique no botão flutuante** para minimizar popup
2. **Configuração por site:** Use diferentes formatos por tipo de conteúdo
3. **Monitorar via Chrome DevTools:** F12 → Network para ver requisições
4. **Backup de downloads:** Mova pasta Downloads para outro disco regularmente
5. **Testes de velocidade:** Compare formatos para seu internet

---

## 🔗 Links Úteis

- [yt-dlp GitHub](https://github.com/yt-dlp/yt-dlp)
- [Sites Suportados](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)
- [Chrome Extensions Docs](https://developer.chrome.com/docs/extensions/)
- [YTDLN-OPEN Repository](https://github.com/GDKAYKY/ytdln-open)
