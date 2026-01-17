const http = require("node:http");
const { WebSocketServer } = require("ws");
const fs = require("node:fs/promises");
const { createReadStream } = require("node:fs");
const { ipcMain } = require("electron");
const crypto = require("node:crypto");
const net = require("node:net");

class AppServer {
  constructor(port = 8888) {
    this.port = port;
    this.server = null;
    this.wss = null;
    this.videoDownloader = null;
    this.pendingStreams = new Map();
    this.extensionWs = null; // Store extension WebSocket connection
    this.PENDING_STREAM_TTL = 1000 * 60 * 5; // 5 min timeout
  }

  setDownloader(downloader) {
    this.videoDownloader = downloader;
  }

  async findAvailablePort(startPort = 8888, maxAttempts = 10) {
    for (let i = 0; i < maxAttempts; i++) {
      const port = startPort + i;
      if (await this.isPortAvailable(port)) {
        return port;
      }
    }
    throw new Error(`No available ports found starting from ${startPort}`);
  }

  isPortAvailable(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once("error", (err) => {
        if (err.code === "EADDRINUSE") {
          resolve(false);
        } else {
          resolve(false);
        }
      });
      server.once("listening", () => {
        server.close();
        resolve(true);
      });
      server.listen(port);
    });
  }

  async init() {
    if (this.server) {
      console.log("[Server] Server already initialized, skipping.");
      return;
    }

    try {
      // Find an available port
      this.port = await this.findAvailablePort(this.port);
      console.log(`[Server] Using port ${this.port}`);

      this.server = http.createServer((req, res) =>
        this.handleHttpRequest(req, res)
      );

      this.wss = new WebSocketServer({ server: this.server });
      this.setupWsListeners();

      this.server.listen(this.port, () => {
        console.log(`[HTTP/WS] Master orchestrator on port ${this.port}`);
      });

      this.server.on("error", (e) => {
        console.error("[Server] Server error:", e);
      });
    } catch (error) {
      console.error(`[Server] Não encontrou porta disponível a partir de ${this.port}`, error);
      return;
    }
  }

  async handleHttpRequest(req, res) {
    res.setHeader("Access-Control-Allow-Origin", "*");

    const protocol = req.headers.protocol || "http";
    const host = req.headers.host;
    const fullUrl = new URL(req.url, `${protocol}://${host}`);

    console.log(`[Server] HTTP Request: ${req.method} ${fullUrl.pathname}${fullUrl.search}`);

    // Status endpoint - returns list of available downloads
    if (fullUrl.pathname === "/status") {
      const downloads = Array.from(this.pendingStreams.entries()).map(([id, entry]) => ({
        id,
        filename: entry.name,
        url: `http://${host}/download?id=${id}`,
      }));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ready", downloads }));
      return;
    }

    if (fullUrl.pathname !== "/download") {
      res.writeHead(200);
      res.end("YTDLN Master Active.");
      return;
    }

    const fileId = fullUrl.searchParams.get("id");
    console.log(`[Server] Download request for fileId: ${fileId}`);
    
    const streamEntry = this.pendingStreams.get(fileId);

    if (streamEntry) {
      console.log(`[Server] Found pending stream, starting direct stream...`);
      return this.streamDirect(streamEntry, res, fileId);
    }

    console.log(`[Server] Stream not found for id: ${fileId}`);
    res.writeHead(404);
    res.end("Stream not found.");
  }

  async streamDirect(streamEntry, res, fileId) {
    // Clear timeout if stream is being used before expiration
    if (streamEntry?.timeoutId) {
      clearTimeout(streamEntry.timeoutId);
    }

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

  setupWsListeners() {
    this.wss.on("connection", (ws) => {
      console.log("[Server] WebSocket client connected (extension)");
      this.extensionWs = ws; // Store the connection
      ws.isAlive = true;

      ws.on("pong", () => {
        ws.isAlive = true;
      });

      ws.on("error", (err) => {
        console.error("[Server] WebSocket erro no client:", err);
      });
      
      ws.on("message", async (msg) => {
        let data;
        try {
          data = JSON.parse(msg);
        } catch (e) {
          ws.send(JSON.stringify({ type: "ERROR", message: "Invalid JSON." }));
          return;
        }

        // Extension sends PREPARE_NATIVE_DOWNLOAD via WebSocket
        if (data.type === "PREPARE_NATIVE_DOWNLOAD") {
          console.log(`[Server] PREPARE_NATIVE_DOWNLOAD received from extension`);
          await this.handleNativeDownloadFlow(data, ws);
        }
      });

      ws.on("close", () => {
        console.log("[Server] WebSocket client disconnected");
        this.extensionWs = null;
      });
    });

    // Heartbeat interval to detect dead sockets
    const heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((client) => {
        if (client.isAlive === false) {
          return client.terminate();
        }
        client.isAlive = false;
        client.ping();
      });
    }, 30000);

    this.wss.on("close", () => {
      clearInterval(heartbeatInterval);
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

      const timeoutId = setTimeout(() => {
        if (this.pendingStreams.has(fileId)) {
          console.log(`[Server] Stream expired timeout: ${fileId}`);
          this.pendingStreams.delete(fileId);
        }
      }, this.PENDING_STREAM_TTL);

      this.pendingStreams.set(fileId, {
        url: data.url,
        settings: data.settings,
        name: filename,
        timeoutId,
      });

      const downloadUrl = `http://localhost:${this.port}/download?id=${fileId}`;
      console.log(`[Master] Stream prepared with downloadId: ${fileId}`);
      console.log(`[Master] Browser can download from: ${downloadUrl}`);
      
      // Notify extension via WebSocket (broadcast to all connected clients)
      const message = JSON.stringify({
        type: "DOWNLOAD_READY",
        downloadId: fileId,
        filename,
        downloadUrl,
      });
      
      console.log(`[Master] Notifying extension: ${message}`);
      
      // Send to specific WebSocket if provided, otherwise broadcast to all
      if (ws && ws.readyState === ws.OPEN) {
        ws.send(message);
      } else if (this.wss) {
        // Broadcast to all connected clients
        this.wss.clients.forEach((client) => {
          if (client.readyState === client.OPEN) {
            client.send(message);
          }
        });
      }
    } catch (e) {
      console.error("[Master] Error preparing stream:", e);
      const errorMsg = JSON.stringify({ type: "ERROR", message: e.message });
      if (ws && ws.readyState === ws.OPEN) {
        ws.send(errorMsg);
      }
    }
  }

  broadcast(type, payload) {
    if (!this.wss) return;
    this.wss.clients.forEach((c) => {
      if (c.readyState === c.OPEN) {
        c.send(JSON.stringify({ type, ...payload }));
      }
    });
  }

  close() {
    this.wss?.close();
    this.server?.close();
  }
}

module.exports = new AppServer();
