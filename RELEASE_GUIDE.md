# 📦 Guia de Release - YTDLN-OPEN

## Como Criar a Extensão para Release

### 1. Gerar o ZIP da Extensão

Execute o script PowerShell:
```powershell
.\build-extension.ps1
```

Isso vai criar: `ytdln-open-extension.zip` (44 KB)

### 2. Fazer Upload no GitHub

#### Opção A: Via GitHub Web (Mais Fácil)

1. Vá para seu repositório no GitHub
2. Clique em **"Releases"** (lado direito)
3. Clique em **"Create a new release"**
4. Preencha:
   - **Tag version:** `v1.1.0` (ou a versão atual)
   - **Release title:** `YTDLN-OPEN v1.1.0`
   - **Description:** Descreva as mudanças
5. Clique em **"Attach binaries"** e selecione `ytdln-open-extension.zip`
6. Clique em **"Publish release"**

#### Opção B: Via Git CLI

```bash
# Criar tag
git tag -a v1.1.0 -m "Release v1.1.0"

# Fazer push da tag
git push origin v1.1.0

# Depois criar release no GitHub Web
```

### 3. Instruções para Usuários Instalarem

Adicione no README.md:

```markdown
## Instalação da Extensão

1. Baixe `ytdln-open-extension.zip` da [Release](https://github.com/seu-usuario/ytdln-open/releases)
2. Descompacte o arquivo
3. Abra Chrome e vá para `chrome://extensions/`
4. Ative **"Modo de desenvolvedor"** (canto superior direito)
5. Clique em **"Carregar extensão sem empacotamento"**
6. Selecione a pasta descompactada
7. Pronto! A extensão está instalada
```

## Estrutura do Release

Recomendo ter na release:

- `ytdln-open-extension.zip` - Extensão Chrome
- `ytdln-open-setup.exe` - App Desktop (se tiver)
- `CHANGELOG.md` - Mudanças da versão

## Versionamento

Siga [Semantic Versioning](https://semver.org/):
- `1.0.0` - Primeira release
- `1.1.0` - Nova feature (streaming web)
- `1.1.1` - Bug fix
- `2.0.0` - Breaking changes

## Checklist Antes de Release

- [ ] Testar extensão no Chrome
- [ ] Testar app desktop
- [ ] Atualizar versão em `manifest.json`
- [ ] Atualizar versão em `package.json`
- [ ] Criar `CHANGELOG.md`
- [ ] Gerar ZIP com `build-extension.ps1`
- [ ] Fazer commit e push
- [ ] Criar release no GitHub

## Exemplo de CHANGELOG

```markdown
# v1.1.0 - 2026-01-14

## ✨ Novas Features
- Streaming web via extensão Chrome
- Headers de navegador real para evitar bloqueios
- Suporte a MPEGTS para streaming

## 🐛 Bug Fixes
- Corrigido arquivo corrompido ao fazer download via web
- Resolvido HTTP 403 Forbidden em fragmentos

## 🔧 Melhorias
- Argumentos unificados entre desktop e web
- Melhor tratamento de erros
- Logging detalhado para debug
```

## Pronto!

Agora você tem tudo para fazer release profissional no GitHub! 🚀
