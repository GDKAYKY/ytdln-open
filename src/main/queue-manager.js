const { ipcMain, BrowserWindow } = require("electron");
const crypto = require("node:crypto");
const VideoDownloader = require("../video-downloader");
const libraryManager = require("./library-manager");

class QueueManager {
  constructor() {
    this.queue = [];
    this.activeJobs = new Map(); // id -> process
    this.concurrency = 1;
    this.videoDownloader = new VideoDownloader();
    this.isInitialized = false;
  }

  async init() {
    if (this.isInitialized) return;
    await this.videoDownloader.init();
    this.isInitialized = true;
    this.setupIpc();
    console.log("[Queue] Gerenciador de fila inicializado.");
  }

  setupIpc() {
    ipcMain.on("queue:add", async (event, { url, settings }) => {
      const job = this.addJob(url, settings);
      this.broadcast("queue:update", this.getQueueState());
      this.processNext();
    });

    ipcMain.on("queue:remove", (event, { id }) => {
      this.cancelJob(id);
      this.broadcast("queue:update", this.getQueueState());
    });

    ipcMain.handle("queue:get-state", () => {
      return this.getQueueState();
    });

    // Listener para pedidos internos (ex: do server.js)
    ipcMain.on("queue:request-state", () => {
      this.broadcast("queue:update", this.getQueueState());
    });
  }

  addJob(url, settings) {
    const id = crypto.randomUUID();
    const job = {
      id,
      url,
      settings,
      status: "PENDING",
      progress: 0,
      speed: "",
      eta: "",
      size: "",
      startTime: Date.now(),
      error: null,
    };
    this.queue.push(job);
    return job;
  }

  cancelJob(id) {
    const job = this.queue.find((j) => j.id === id);
    if (!job) return;

    if (job.status === "RUNNING") {
      const proc = this.activeJobs.get(id);
      if (proc) {
        try {
          proc.kill();
          console.log(`[Queue] Processo do job ${id} encerrado.`);
        } catch (e) {
          console.error(`[Queue] Erro ao encerrar processo do job ${id}:`, e);
        }
      }
    }
    this.queue = this.queue.filter((j) => j.id !== id);
    this.activeJobs.delete(id);
    this.processNext();
  }

  getQueueState() {
    return this.queue.map((j) => ({
      id: j.id,
      url: j.url,
      status: j.status,
      progress: j.progress,
      speed: j.speed,
      eta: j.eta,
      size: j.size,
      error: j.error,
    }));
  }

  broadcast(channel, data) {
    const windows = BrowserWindow.getAllWindows();
    windows.forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data);
      }
    });
    // Emite internamente para outros módulos no Main Process (ex: server.js)
    ipcMain.emit(channel, null, data);
  }

  async processNext() {
    const runningCount = this.queue.filter(
      (j) => j.status === "RUNNING"
    ).length;
    if (runningCount >= this.concurrency) return;

    const nextJob = this.queue.find((j) => j.status === "PENDING");
    if (!nextJob) return;

    await this.runJob(nextJob);
  }

  async runJob(job) {
    job.status = "RUNNING";
    this.broadcast("queue:update", this.getQueueState());

    try {
      // Need to modify VideoDownloader to report structured progress
      await this.videoDownloader
        .download(job.url, job.settings, {
          onProgress: (raw) => {
            this.parseProgress(job, raw);
            this.broadcast("queue:progress", {
              id: job.id,
              ...this.getJobProgress(job),
            });
          },
          onError: (err) => {
            job.error = err;
          },
          // We'll need to pass something to kill it
          onSpawn: (proc) => {
            this.activeJobs.set(job.id, proc);
          },
        })
        .then(async (result) => {
          job.status = "DONE";
          this.activeJobs.delete(job.id);

          // Track in library
          await libraryManager.trackDownloadedFile(
            job.url,
            result.detectedPath,
            job.settings,
            result.duration
          );

          this.broadcast("queue:update", this.getQueueState());
          this.processNext();
        });
    } catch (error) {
      console.error(`[Queue] Job ${job.id} failed:`, error);
      job.status = "ERROR";
      job.error = error.message;
      this.activeJobs.delete(job.id);
      this.broadcast("queue:update", this.getQueueState());
      this.processNext();
    }
  }

  parseProgress(job, raw) {
    // [download]  10.0% of 100.00MiB at 1.00MiB/s ETA 01:30
    const progressMatch = raw.match(/\[download\]\s+(\d+\.?\d*)%/);
    const sizeMatch = raw.match(/of\s+(\d+\.?\d*\w+)/);
    const speedMatch = raw.match(/at\s+(\d+\.?\d*\w+\/s)/);
    const etaMatch = raw.match(/ETA\s+(\d+:\d+)/);

    if (progressMatch) job.progress = parseFloat(progressMatch[1]);
    if (sizeMatch) job.size = sizeMatch[1];
    if (speedMatch) job.speed = speedMatch[1];
    if (etaMatch) job.eta = etaMatch[1];
  }

  getJobProgress(job) {
    return {
      progress: job.progress,
      speed: job.speed,
      eta: job.eta,
      size: job.size,
    };
  }
}

module.exports = new QueueManager();
