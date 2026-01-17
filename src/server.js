const http = require("node:http");
const { WebSocketServer } = require("ws");
const fs = require("node:fs/promises");
const { createReadStream } = require("node:fs");
const { ipcMain } = require("electron");
const crypto = require("node:crypto");

class AppServer {
  constructor(port = 8888) {
    this.port = port;
    this.server = null;
    this.wss = null;
    this.videoDownloader = null;
    this.readyFiles = new Map();
    this.pendingStreams = new Map();
    this.PENDING_STREAM_TTL = 1000 * 60 * 5; // 5 min timeout
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

    this.server.listen(this.port, () => {
      console.log(`[HTTP/WS] Master orchestrator on port ${this.port}`);
    });

    this.server.on("error", this.onServerError.bind(this));
  }

  onServerError(e) {
    if (e.code === "EADDRINUSE") {
      console.error(`[Server] Port ${this.port} is already in use.`);
    } else {
      console.error("[Server] Server error:", e);
    }
  }

  async handleHttpRequest(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");

    const protocol = req.headers.protocol || "http";
    const host = req.headers.host;
    const fullUrl = new URL(req.url, `${protocol}://${host}`);

    if (fullUrl.pathname !== "/download") {
      res.writeHead(200);
      res.end("YTDLN Master Active.");
      return;
    }

    const fileId = fullUrl.searchParams.get("id");
    const streamEntry = this.pendingStreams.get(fileId);
    const fileEntry = this.readyFiles.get(fileId);

    if (streamEntry) {
      return this.streamDirect(streamEntry, res, fileId);
    }

    if (fileEntry) {
      return this.sendSavedFile(fileEntry, res, fileId);
    }

    res.writeHead(404);
    res.end("File not found.");
  }

  async streamDirect(streamEntry, res, fileId) {
    res.writeHead(200, {
      "Content-Type": "video/mp4",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(
        streamEntry.name
      )}"`,
      "Cache-Control": "no-cache",
    });

    try {
      await this.videoDownloader.stream(
        streamEntry.url,
        streamEntry.settings,
        res
      );
    } catch (err) {
      console.error("[Server] Streaming error:", err);
      if (!res.headersSent) {
        res.writeHead(500);
        res.end("Streaming error.");
      }
    }

    this.pendingStreams.delete(fileId);
  }

  async sendSavedFile(fileEntry, res, fileId) {
    try {
      const stat = await fs.stat(fileEntry.path);
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Length": stat.size,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(
          fileEntry.name
        )}"`,
      });

      const stream = createReadStream(fileEntry.path)
        .on("error", (err) => {
          if (!["EPIPE", "ECONNRESET"].includes(err.code)) {
            console.error("[Server] Read stream error:", err);
          }
          stream.destroy();
        });

      res.on("error", (err) => {
        if (!["EPIPE", "ECONNRESET"].includes(err.code)) {
          console.error("[Server] Response error:", err);
        }
        stream.destroy();
      });

      stream.pipe(res);
      res.on("finish", () => {
        this.readyFiles.delete(fileId);
      });
    } catch (err) {
      console.error("[Server] Error sending file:", err);
      if (!res.headersSent) {
        res.writeHead(500);
        res.end("Server error.");
      }
    }
  }

  setupWsListeners() {
    this.wss.on("connection", (ws) => {
      ws.on("message", async (msg) => {
        let data;
        try {
          data = JSON.parse(msg);
        } catch (e) {
          ws.send(JSON.stringify({ type: "ERROR", message: "Invalid JSON." }));
          return;
        }

        if (data.type === "PREPARE_NATIVE_DOWNLOAD") {
          this.handleNativeDownloadFlow(data, ws);
        } else if (data.type === "DOWNLOAD_REQUEST") {
          ipcMain.emit("queue:add", null, {
            url: data.url,
            settings: data.settings || {},
          });
        }
      });
    });
  }

  async handleNativeDownloadFlow(data, ws) {
    console.log(`[Master] Preparing stream for: ${data.url}`);

    try {
      const info = await this.videoDownloader.getVideoInfo(data.url);
      const fileId = crypto.randomUUID();
      const filename = info
        ? `${info.title}.mp4`
        : `video-${fileId.slice(0, 8)}.mp4`;

      this.pendingStreams.set(fileId, {
        url: data.url,
        settings: data.settings,
        name: filename,
      });

      setTimeout(() => {
        this.pendingStreams.delete(fileId);
      }, this.PENDING_STREAM_TTL);

      ws.send(
        JSON.stringify({
          type: "DOWNLOAD_READY",
          downloadId: fileId,
          filename,
        })
      );
    } catch (e) {
      console.error("[Master] Error preparing stream:", e);
      ws.send(JSON.stringify({ type: "ERROR", message: e.message }));
    }
  }

  broadcast(type, payload) {
    if (!this.wss) return;
    this.wss.clients.forEach((c) => {
      if (c.readyState === c.OPEN) {
        c.send(JSON.stringify({ type, payload }));
      }
    });
  }

  close() {
    this.wss?.close();
    this.server?.close();
  }
}

module.exports = new AppServer();
