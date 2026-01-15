const { app } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");
const BinaryDownloader = require("./bin-downloader");

class VideoDownloader {
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
        cwd: app.getPath("downloads"), // Executar no diretório de downloads
      });
      let infoJson = "";

      ytdlpProcess.stdout.on("data", (data) => {
        infoJson += data.toString();
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

  buildYtdlpArgs(settings, videoUrl, options = {}) {
    const { ffmpeg } = this.binaries;
    const { useStdout = false, acodec = "" } = options;
    const args = ["--progress", "--newline"];

    // 1. Definição de Saída
    if (useStdout) {
      args.push("-o", "-");
    } else {
      args.push("-o", path.join(app.getPath("downloads"), "%(title)s.%(ext)s"));
    }

    // 2. Binários e Formatos
    const outFormat = useStdout ? "mp4" : settings.outputFormat || "mp4";
    args.push("--ffmpeg-location", ffmpeg, "--merge-output-format", outFormat);

    // 3. Qualidade - MESMO PARA STREAMING E DOWNLOAD
    if (settings.quality && settings.quality !== "best") {
      if (settings.quality === "worst") {
        args.push("-f", "worst");
      } else {
        const height = settings.quality.replace("p", "");
        // Para streaming, adicionar filtro de extensão MP4
        if (useStdout) {
          args.push(
            "-f",
            `bestvideo[height<=${height}][ext=mp4]+bestaudio[ext=m4a]/best[height<=${height}][ext=mp4]/best`
          );
        } else {
          args.push(
            "-f",
            `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`
          );
        }
      }
    }

    // 4. Performance e Retentativa - IDÊNTICO PARA AMBOS
    args.push(
      "--concurrent-fragments",
      (settings.concurrentFragments || 8).toString()
    );
    args.push("--socket-timeout", (settings.socketTimeout || 30).toString());
    args.push("--retries", (settings.retries || 5).toString());
    args.push("--fragment-retries", (settings.fragmentRetries || 5).toString());
    
    // Para streaming, adicionar delay para evitar bloqueios
    if (useStdout) {
      args.push("--sleep-requests", "0.5"); // 500ms entre requisições
      args.push("--sleep-interval", "1"); // 1s entre fragmentos
    }

    // 5. Metadados e Subs (skip para streaming)
    if (!useStdout) {
      if (settings.embedSubs) args.push("--embed-subs");
      if (settings.writeInfoJson) args.push("--write-info-json");
      if (settings.writeDescription) args.push("--write-description");
      args.push("--write-thumbnail");
    }

    // 6. Headers / Proxy - IDÊNTICO PARA AMBOS
    // Para streaming, usar User-Agent de navegador real se não especificado
    const userAgent = settings.userAgent || (useStdout 
      ? "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      : "");
    
    if (userAgent) args.push("--user-agent", userAgent);
    if (settings.referer) args.push("--referer", settings.referer);
    if (settings.noCheckCertificate) args.push("--no-check-certificate");
    if (settings.ignoreErrors) args.push("--ignore-errors");
    
    // Headers adicionais para evitar bloqueios (especialmente importante para streaming)
    if (useStdout) {
      // Para streaming, adicionar headers que parecem vir de um navegador real
      args.push("--add-header", "Accept-Language: pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7");
      args.push("--add-header", "Accept-Encoding: gzip, deflate, br");
      args.push("--add-header", "Accept: text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8");
      args.push("--add-header", "Sec-Fetch-Dest: document");
      args.push("--add-header", "Sec-Fetch-Mode: navigate");
      args.push("--add-header", "Sec-Fetch-Site: none");
      args.push("--add-header", "Upgrade-Insecure-Requests: 1");
    }

    // 7. Lógica de Post-Processing (Mesclagem de Áudio/Vídeo)
    let ppArgs = [];

    // Conversão de áudio se solicitado
    const targetFormat = settings.audioFormat;
    if (targetFormat && targetFormat !== "best") {
      const codecMap = {
        mp3: { check: "mp3", ffmpeg: "libmp3lame" },
        aac: { check: "mp4a", ffmpeg: "aac" },
        opus: { check: "opus", ffmpeg: "libopus" },
      };
      const target = codecMap[targetFormat];
      if (target && acodec && !acodec.startsWith(target.check)) {
        ppArgs.push(`-c:v copy -c:a ${target.ffmpeg}`);
      }
    }

    if (ppArgs.length > 0) {
      args.push("--postprocessor-args", `ffmpeg:${ppArgs.join(" ")}`);
    }

    // 8. URL deve ser sempre o último argumento
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
        cwd: app.getPath("downloads"), // Executar no diretório de downloads
      });

      // Necessário para o QueueManager conseguir cancelar o processo
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

    const { ytdlp, ffmpeg } = this.binaries;
    const ytdlpArgs = this.buildYtdlpArgs(settings, videoUrl, {
      useStdout: true,
    });

    console.log("[Stream] Iniciando Double-Pipe: yt-dlp | ffmpeg");
    console.log("[Stream] yt-dlp args:", ytdlpArgs);

    const tempDir = require("node:os").tmpdir();
    
    const downloader = spawn(ytdlp, ytdlpArgs, {
      stdio: ["ignore", "pipe", "pipe"],
      cwd: tempDir,
    });

    const muxer = spawn(
      ffmpeg,
      [
        "-i",
        "pipe:0",
        "-c:v",
        "copy",
        "-c:a",
        "copy",
        "-f",
        "mpegts",
        "-loglevel",
        "info",
        "pipe:1",
      ],
      { 
        stdio: ["pipe", "pipe", "pipe"],
        cwd: tempDir,
      }
    );

    // Encanamento com tratamento de erro
    downloader.stdout.on("error", (err) => {
      console.error("[Stream] Erro no stdout do yt-dlp:", err);
    });

    muxer.stdin.on("error", (err) => {
      if (err.code !== "EPIPE") {
        console.error("[Stream] Erro no stdin do ffmpeg:", err);
      }
    });

    downloader.stdout.pipe(muxer.stdin);
    muxer.stdout.pipe(res);

    // Logs detalhados
    let ytdlpBytes = 0;
    let ffmpegBytes = 0;
    let ytdlpEnded = false;
    let ffmpegEnded = false;

    downloader.stdout.on("data", (chunk) => {
      ytdlpBytes += chunk.length;
      if (ytdlpBytes % (10 * 1024 * 1024) === 0) {
        console.log(`[Stream] yt-dlp enviou: ${(ytdlpBytes / 1024 / 1024).toFixed(2)} MB`);
      }
    });

    muxer.stdout.on("data", (chunk) => {
      ffmpegBytes += chunk.length;
      if (ffmpegBytes % (10 * 1024 * 1024) === 0) {
        console.log(`[Stream] ffmpeg enviou: ${(ffmpegBytes / 1024 / 1024).toFixed(2)} MB`);
      }
    });

    downloader.stderr.on("data", (d) => {
      const msg = d.toString().trim();
      if (msg) console.log(`[yt-dlp] ${msg}`);
    });
    
    muxer.stderr.on("data", (d) => {
      const msg = d.toString().trim();
      if (msg) console.error(`[ffmpeg] ${msg}`);
    });

    downloader.stdout.on("end", () => {
      ytdlpEnded = true;
      console.log(`[Stream] yt-dlp terminou. Total: ${(ytdlpBytes / 1024 / 1024).toFixed(2)} MB`);
    });

    muxer.stdout.on("end", () => {
      ffmpegEnded = true;
      console.log(`[Stream] ffmpeg terminou. Total: ${(ffmpegBytes / 1024 / 1024).toFixed(2)} MB`);
    });

    return new Promise((resolve, reject) => {
      let resolved = false;
      
      const cleanup = () => {
        [downloader, muxer].forEach((p) => {
          if (p && p.exitCode === null) {
            p.kill("SIGKILL");
          }
        });
      };
      
      const handleResolve = () => {
        if (!resolved) {
          resolved = true;
          console.log(`[Stream] Resolvido. yt-dlp: ${ytdlpEnded}, ffmpeg: ${ffmpegEnded}`);
          cleanup();
          resolve();
        }
      };
      
      const handleReject = (err) => {
        if (!resolved) {
          resolved = true;
          console.error(`[Stream] Rejeitado:`, err);
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
          console.error("[Stream] Erro na resposta HTTP:", err);
        }
        handleReject(err);
      });
      
      res.on("close", () => {
        console.log("[Stream] Cliente fechou a conexão");
        handleResolve();
      });
      
      downloader.on("error", (err) => {
        console.error("[Stream] Erro no yt-dlp:", err);
        handleReject(err);
      });
      
      muxer.on("error", (err) => {
        console.error("[Stream] Erro no ffmpeg:", err);
        handleReject(err);
      });
      
      downloader.on("close", (code) => {
        console.log(`[Stream] yt-dlp fechou com código: ${code}`);
        if (code !== 0 && code !== null) {
          handleReject(new Error(`yt-dlp falhou com código ${code}`));
        }
      });
      
      muxer.on("close", (code) => {
        console.log(`[Stream] ffmpeg fechou com código: ${code}`);
        if (code === 0 || code === null || muxer.killed) {
          handleResolve();
        } else {
          handleReject(new Error(`ffmpeg falhou com código ${code}`));
        }
      });
    });
  }
}

module.exports = VideoDownloader;
