# Documentação do Projeto: YTDLN Open

## 1. Visão Geral

O YTDLN Open é um aplicativo de desktop multiplataforma, construído com Electron, para baixar vídeos da internet. Ele utiliza o poder do `yt-dlp` e outras ferramentas de linha de comando para fornecer uma funcionalidade robusta de download através de uma interface gráfica simples.

## 2. Tecnologias Utilizadas

- **Framework Principal:** Electron
- **Ambiente de Execução:** Node.js
- **Linguagens:** JavaScript, HTML, CSS
- **Ferramentas de Download (Motor):**
    - `yt-dlp`: Para extrair informações e URLs de download de vídeos.
    - `aria2c`: Um acelerador de download que pode baixar um arquivo em múltiplas conexões.
    - `ffmpeg`: Para juntar (mux) faixas de vídeo e áudio separadas, essencial para downloads em alta qualidade.
- **Empacotamento:** electron-builder

## 3. Estrutura do Projeto

- `src/main.js`: O processo principal (backend). Gerencia a janela do aplicativo, tem acesso ao sistema de arquivos e executa os processos de download (`yt-dlp`).
- `src/renderer.js`: O processo de renderização (frontend). Controla a lógica da interface do usuário.
- `src/preload.js`: Script de ponte segura entre o `main.js` e o `renderer.js`.
- `src/index.html`: A estrutura da interface do usuário.
- `package.json`: Define as dependências, scripts e configurações de build do projeto.
- `bin/`: Pasta (usada em desenvolvimento) para colocar os executáveis das ferramentas de download.

## 4. Configuração do Ambiente de Desenvolvimento

1.  **Instalar Dependências Node.js:**
    ```sh
    npm install
    ```

2.  **Configurar Binários Externos:**
    Para rodar o projeto em modo de desenvolvimento (`npm start`), é necessário baixar as ferramentas externas manualmente e colocá-las na pasta `bin` na raiz do projeto.

    - Crie a pasta `C:\repos\ytdln-open\bin`.
    - Baixe e coloque o `yt-dlp.exe` diretamente na pasta `bin`.
    - Baixe e extraia o `aria2c` e o `ffmpeg` de forma que a estrutura final seja:
      ```
      C:\repos\ytdln-open\bin\
      ├── yt-dlp.exe
      ├── aria2-1.37.0-win-64bit-build1\
      │   └── aria2c.exe
      └── ffmpeg-7.0-essentials_build\
          └── bin\
              └── ffmpeg.exe
      ```

## 5. Scripts Disponíveis

- **Para rodar em modo de desenvolvimento:**
  ```sh
  npm start
  ```

- **Para criar o instalador final:**
  O `electron-builder` está configurado para baixar automaticamente as versões corretas do `yt-dlp`, `aria2c` e `ffmpeg` durante o processo de build.
  ```sh
  npm run dist
  ```
  O instalador será gerado na pasta `dist/`.

## 6. Local de Download dos Arquivos

Os vídeos baixados pelo aplicativo são salvos, por padrão, na pasta de **Downloads** do usuário do sistema operacional (ex: `C:\Users\SeuUsuario\Downloads`).
