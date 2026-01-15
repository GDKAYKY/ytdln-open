const http = require("node:http");
const { WebSocketServer } = require("ws");
const fs = require("node:fs");
const path = require("node:path");
const { ipcMain } = require("electron");
const crypto = require("node:crypto");

class AppServer {
  constructor(port = 8888) {
    this.port = port;
    this.server = null;
    this.wss = null;
    this.videoDownloader = null;
    this.readyFiles = new Map(); // Arquivos físicos já no disco
    this.pendingStreams = new Map(); // Metadados para streaming em tempo real
  }

  setDownloader(downloader) {
    this.videoDownloader = downloader;
  }

  init() {
    this.server = http.createServer((req, res) =>
      this.handleHttpRequest(req, res)
    );
    this.wss = new WebSocketServer({ server: this.server });
    this.setupWsListeners();
    this.server.on("error", (e) => {
      if (e.code === "EADDRINUSE") {
        console.error(
          `[Server] Erro: A porta ${this.port} já está sendo usada por outro processo.`
        );
      } else {
        console.error("[Server] Erro no servidor HTTP:", e);
      }
    });

    this.server.listen(this.port, () => {
      console.log(`[HTTP/WS] Orquestrador Master na porta ${this.port}`);
    });
  }

  async handleHttpRequest(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Padrão Node 25+: Usar a classe global URL em vez de url.parse legada
    const protocol = req.headers.protocol || "http";
    const host = req.headers.host || `localhost:${this.port}`;
    const fullUrl = new URL(req.url, `${protocol}://${host}`);

    if (fullUrl.pathname === "/download") {
      const fileId = fullUrl.searchParams.get("id");
      const fileEntry = this.readyFiles.get(fileId);
      const streamEntry = this.pendingStreams.get(fileId);

      if (streamEntry) {
        console.log(`[Server] Iniciando stream direto: ${streamEntry.name}`);
        res.writeHead(200, {
          "Content-Type": "video/mp4",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(streamEntry.name)}"; filename*=UTF-8''${encodeURIComponent(streamEntry.name)}"`,
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0",
        });

        try {
          await this.videoDownloader.stream(
            streamEntry.url,
            streamEntry.settings,
            res
          );
          this.pendingStreams.delete(fileId);
        } catch (err) {
          console.error("[Server] Erro no streaming:", err);
          if (!res.headersSent) {
            res.writeHead(500);
            res.end("Erro ao processar stream.");
          }
        }
        return;
      }

      if (fileEntry && fs.existsSync(fileEntry.path)) {
        // Entrega o arquivo pronto do disco pro navegador
        const stat = fs.statSync(fileEntry.path);
        res.writeHead(200, {
          "Content-Type": "application/octet-stream",
          "Content-Length": stat.size,
          "Content-Disposition": `attachment; filename="${encodeURIComponent(fileEntry.name)}"; filename*=UTF-8''${encodeURIComponent(fileEntry.name)}"`,
        });

        const readStream = fs.createReadStream(fileEntry.path);
        
        // Tratamento de erro para evitar EPIPE quando o cliente fecha a conexão
        readStream.on("error", (err) => {
          if (err.code !== "EPIPE" && err.code !== "ECONNRESET") {
            console.error("[Server] Erro ao ler arquivo:", err);
          }
          if (!res.headersSent) {
            res.writeHead(500);
            res.end("Erro ao ler arquivo.");
          }
        });
        
        res.on("error", (err) => {
          if (err.code !== "EPIPE" && err.code !== "ECONNRESET") {
            console.error("[Server] Erro na resposta HTTP:", err);
          }
          readStream.destroy();
        });
        
        readStream.pipe(res);

        res.on("finish", () => {
          console.log(
            `[Server] Entrega de arquivo concluída: ${fileEntry.name}`
          );
          this.readyFiles.delete(fileId);
        });
        return;
      }

      res.writeHead(404);
      res.end("Arquivo não encontrado.");
    } else {
      res.writeHead(200);
      res.end("YTDLN Master Active.");
    }
  }

  setupWsListeners() {
    this.wss.on("connection", (ws) => {
      ws.on("message", async (msg) => {
        try {
          const data = JSON.parse(msg);
          if (data.type === "PREPARE_NATIVE_DOWNLOAD") {
            this.handleNativeDownloadFlow(data, ws);
          } else if (data.type === "DOWNLOAD_REQUEST") {
            ipcMain.emit("queue:add", null, {
              url: data.url,
              settings: data.settings || {},
            });
          }
        } catch (e) {
          ws.send(JSON.stringify({ type: "ERROR", message: e.message }));
        }
      });
    });
  }

  async handleNativeDownloadFlow(data, ws) {
    console.log(`[Master] Preparando stream para: ${data.url}`);

    try {
      // 1. Obtém info completa (rápido)
      const info = await this.videoDownloader.getVideoInfo(data.url);
      const fileId = crypto.randomUUID();

      // Para streaming, forçamos MP4 independente da configuração geral
      // para garantir que os flags de fragmentação do FFmpeg funcionem no stdout.
      const outExt = "mp4";
      const filename = info
        ? `${info.title}.${outExt}`
        : `video-${fileId.slice(0, 8)}.${outExt}`;

      // 2. Registra para quando o navegador fizer o GET
      this.pendingStreams.set(fileId, {
        url: data.url,
        settings: data.settings,
        name: filename,
      });

      // 3. Avisa a extensão que o navegador já pode iniciar o download "fantasma"
      ws.send(
        JSON.stringify({
          type: "DOWNLOAD_READY",
          downloadId: fileId,
          filename: filename,
        })
      );
    } catch (e) {
      console.error("[Master] Erro ao preparar stream:", e);
      ws.send(
        JSON.stringify({ type: "ERROR", message: "Erro no App: " + e.message })
      );
    }
  }

  broadcast(type, payload) {
    if (!this.wss) return;
    this.wss.clients.forEach(
      (c) => c.readyState === 1 && c.send(JSON.stringify({ type, payload }))
    );
  }

  close() {
    if (this.wss) this.wss.close();
    if (this.server) this.server.close();
    console.log("[Server] Parado.");
  }
}

module.exports = new AppServer();
