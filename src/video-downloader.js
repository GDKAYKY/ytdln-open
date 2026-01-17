/* @ts-check */
/* eslint-disable no-undef */
const { app } = require("electron");
const { join } = require("node:path");
const { spawn } = require("node:child_process");
const { readFileSync } = require("node:fs");
const BinaryDownloader = require("./bin-downloader");

class VideoDownloader {
  constructor() {
    this.binaries = null;
    this.settings = null;
  }

  /**
   * Initializes required binaries.
   * Must be called before any download.
   */
  async init() {
    const downloader = new BinaryDownloader();
    this.binaries = await downloader.ensureAll();
  }

  async getVideoInfo(videoUrl) {
    if (!this.binaries) throw new Error("Binaries not initialized");
    const { ytdlp } = this.binaries;
    return new Promise((resolve) => {
      const infoArgs = ["--dump-json", videoUrl];
      const ytdlpProcess = spawn(ytdlp, infoArgs, {
        stdio: ["ignore", "pipe", "pipe"],
      });
      let infoJson = "";

      ytdlpProcess.stdout.on("data", (data) => {
        infoJson += data.toString();
      });

      ytdlpProcess.on("error", (err) => {
        console.error("Error spawning yt-dlp:", err);
        resolve(null);
      });

      ytdlpProcess.on("close", (code) => {
        if (code !== 0) {
          resolve(null);
          return;
        }
        try {
          const info = JSON.parse(infoJson);
          resolve({
            acodec: info.acodec || "",
            duration: info.duration || 0,
            title: info.title || "video",
            ext: info.ext || "mp4",
          });
        } catch (e) {
          console.error("Error parsing video JSON:", e);
          resolve(null);
        }
      });
    });
  }

  loadSettings(settings) {
    if (!settings || Object.keys(settings).length === 0) {
      const defaultConfigPath = join(__dirname, '..', 'config', 'ytdlp-defaults.json');
      return JSON.parse(readFileSync(defaultConfigPath, 'utf-8'));
    }
    return settings;
  }

  addOutputArgs(args, useStdout, ffmpeg) {
    if (useStdout) {
      args.push("-o", "-");
    } else {
      args.push("-o", join(app.getPath("downloads"), "%(title)s.%(ext)s"));
    }
    args.push("--merge-output-format", useStdout ? "mp4" : this.settings.outputFormat || "mp4");
    args.push("--ffmpeg-location", ffmpeg);
  }

  getQualityFormat(quality, useStdout) {
    if (quality === "worst") return "worst";
    if (quality === "best") {
      return useStdout 
        ? "best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best"
        : "bestvideo+bestaudio/best";
    }
    const height = quality.replace("p", "");
    return useStdout
      ? `best[height<=${height}][ext=mp4]/bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${height}]`
      : `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`;
  }

  addQualityArgs(args, quality, useStdout) {
    if (quality) {
      args.push("-f", this.getQualityFormat(quality, useStdout));
    }
  }

  addPerformanceArgs(args, settings, useStdout) {
    args.push("--js-runtime", "node");
    args.push("--concurrent-fragments", (settings.concurrentFragments || 8).toString());
    args.push("--socket-timeout", (settings.socketTimeout || 30).toString());
    args.push("--retries", (settings.retries || 5).toString());
    args.push("--fragment-retries", (settings.fragmentRetries || 10).toString());
    args.push("--extractor-retries", (settings.extractorRetries || 3).toString());
    args.push("--skip-unavailable-fragments");
    
    if (useStdout) {
      args.push("--sleep-requests", "0.5");
      args.push("--sleep-interval", "1");
      args.push("--no-part");
    }
  }

  addMetadataArgs(args, settings, useStdout) {
    if (!useStdout) {
      if (settings.embedSubs) args.push("--embed-subs");
      if (settings.writeInfoJson) args.push("--write-info-json");
      if (settings.writeDescription) args.push("--write-description");
      args.push("--write-thumbnail");
    }
  }

  addHeaderArgs(args, settings) {
    const userAgent = settings.userAgent || "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
    args.push("--user-agent", userAgent);
    if (settings.referer) args.push("--referer", settings.referer);
    if (settings.noCheckCertificate) args.push("--no-check-certificate");
    if (settings.ignoreErrors) args.push("--ignore-errors");
    
    args.push("--add-header", "Accept-Language: pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7");
    args.push("--add-header", "Accept-Encoding: gzip, deflate, br");
    args.push("--add-header", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8");
    args.push("--add-header", "Sec-Fetch-Dest: document");
    args.push("--add-header", "Sec-Fetch-Mode: navigate");
    args.push("--add-header", "Sec-Fetch-Site: none");
    args.push("--add-header", "Upgrade-Insecure-Requests: 1");
  }

  addPostProcessingArgs(args, settings, acodec) {
    const targetFormat = settings.audioFormat;
    if (!targetFormat || targetFormat === "best") return;

    const codecMap = {
      mp3: { check: "mp3", ffmpeg: "libmp3lame" },
      aac: { check: "mp4a", ffmpeg: "aac" },
      opus: { check: "opus", ffmpeg: "libopus" },
    };
    const target = codecMap[targetFormat];
    if (target && acodec && !acodec.startsWith(target.check)) {
      args.push("--postprocessor-args", `ffmpeg:-c:v copy -c:a ${target.ffmpeg}`);
    }
  }

  buildYtdlpArgs(settings, videoUrl, options = {}) {
    const { ffmpeg } = this.binaries;
    const { useStdout = false, acodec = "" } = options;
    
    settings = this.loadSettings(settings);
    this.settings = settings;
    
    const args = ["--progress", "--newline"];
    this.addOutputArgs(args, useStdout, ffmpeg);
    this.addQualityArgs(args, settings.quality, useStdout);
    this.addPerformanceArgs(args, settings, useStdout);
    this.addMetadataArgs(args, settings, useStdout);
    this.addHeaderArgs(args, settings);
    this.addPostProcessingArgs(args, settings, acodec);
    
    args.push(videoUrl);
    return args;
  }

  async download(videoUrl, settings, callbacks = {}) {
    if (!this.binaries) {
      throw new Error("VideoDownloader not initialized. Call init() first.");
    }

    let acodec = "";
    let duration = 0;
    try {
      const info = await this.getVideoInfo(videoUrl);
      if (info) {
        acodec = info.acodec;
        duration = info.duration;
      }
    } catch (e) {
      console.warn(
        "Could not get video info, proceeding without codec check",
        e
      );
    }

    const args = this.buildYtdlpArgs(settings, videoUrl, { acodec });
    const { ytdlp } = this.binaries;

    return new Promise((resolve, reject) => {
      const process = spawn(ytdlp, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      // Required for QueueManager to be able to cancel the process
      if (callbacks.onSpawn) callbacks.onSpawn(process);

      let detectedPath = null;

      process.stdout.on("data", (data) => {
        const str = data.toString();
        if (callbacks.onProgress) callbacks.onProgress(str);

        const destMatch = str.match(/\[download\] Destination: (.+)/);
        if (destMatch) detectedPath = destMatch[1].trim();

        const mergeMatch = str.match(/\[Merger\] Merging formats into "(.+)"/);
        if (mergeMatch) detectedPath = mergeMatch[1].trim();

        const fixupMatch = str.match(/\[Fixup.+\] Saving .* to "(.+)"/);
        if (fixupMatch) detectedPath = fixupMatch[1].trim();

        // Match "has already been downloaded" pattern
        const alreadyMatch = str.match(/\[download\] (.+\.mp4) has already been downloaded/);
        if (alreadyMatch) detectedPath = alreadyMatch[1].trim();
      });

      process.stderr.on("data", (data) => {
        const str = data.toString();
        console.log(`[yt-dlp] ${str}`);
        if (str.toLowerCase().includes("error") && callbacks.onError) {
          callbacks.onError(str);
        }
      });
      process.on("close", (code) => {
        if (code === 0) {
          resolve({ detectedPath, duration });
        } else {
          reject(new Error(`yt-dlp exited with code ${code}`));
        }
      });
    });
  }

  async stream(videoUrl, settings, res) {
    if (!this.binaries) {
      throw new Error("VideoDownloader not initialized. Call init() first.");
    }

    const { ytdlp } = this.binaries;
    const ytdlpArgs = this.buildYtdlpArgs(settings, videoUrl, {
      useStdout: true,
    });

    console.log("[Stream] Starting stream with yt-dlp (using internal ffmpeg downloader)");
    console.log("[Stream] yt-dlp args:", ytdlpArgs);
    
    const downloader = spawn(ytdlp, ytdlpArgs, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    // Handle spawn errors
    downloader.on("error", (err) => {
      console.error("[Stream] yt-dlp error:", err);
      if (!res.destroyed) res.destroy();
    });

    // Direct pipe from yt-dlp to HTTP response
    downloader.stdout.pipe(res);

    // Detailed logging
    let bytesStreamed = 0;

    downloader.stdout.on("data", (chunk) => {
      bytesStreamed += chunk.length;
      if (bytesStreamed % (10 * 1024 * 1024) === 0) {
        console.log(`[Stream] Sent: ${(bytesStreamed / 1024 / 1024).toFixed(2)} MB`);
      }
    });

    downloader.stderr.on("data", (d) => {
      const msg = d.toString().trim();
      if (msg) console.log(`[yt-dlp] ${msg}`);
    });

    downloader.stdout.on("end", () => {
      console.log(`[Stream] yt-dlp finished. Total: ${(bytesStreamed / 1024 / 1024).toFixed(2)} MB`);
    });

    return new Promise((resolve, reject) => {
      let resolved = false;
      
      const cleanup = () => {
        if (downloader && downloader.exitCode === null) {
          downloader.kill("SIGKILL");
        }
      };
      
      const handleResolve = () => {
        if (!resolved) {
          resolved = true;
          console.log(`[Stream] Resolved`);
          cleanup();
          resolve();
        }
      };
      
      const handleReject = (err) => {
        if (!resolved) {
          resolved = true;
          console.error(`[Stream] Rejected:`, err);
          cleanup();
          if (err && (err.code === "EPIPE" || err.code === "ECONNRESET")) {
            resolve();
          } else {
            reject(err);
          }
        }
      };
      
      res.on("error", (err) => {
        if (err.code !== "EPIPE" && err.code !== "ECONNRESET") {
          console.error("[Stream] HTTP response error:", err);
        }
        handleReject(err);
      });
      
      res.on("close", () => {
        console.log("[Stream] Client closed connection");
        handleResolve();
      });
      
      downloader.on("error", (err) => {
        console.error("[Stream] yt-dlp error:", err);
        handleReject(err);
      });
      
      downloader.on("close", (code) => {
        console.log(`[Stream] yt-dlp closed with code: ${code}`);
        if (code !== 0 && code !== null) {
          handleReject(new Error(`yt-dlp failed with code ${code}`));
        } else {
          handleResolve();
        }
      });
    });
  }
}

module.exports = VideoDownloader;