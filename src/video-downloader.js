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
    // Para streaming, forçamos MP4 para evitar problemas de pipe com WebM no Windows
    const outFormat = useStdout ? "mp4" : settings.outputFormat || "mp4";

    args.push("--ffmpeg-location", ffmpeg, "--merge-output-format", outFormat);

    // 3. Qualidade
    if (settings.quality && settings.quality !== "best") {
      if (settings.quality === "worst") {
        args.push("-f", "worst");
      } else {
        const height = settings.quality.replace("p", "");
        args.push(
          "-f",
          `bestvideo[height<=${height}]+bestaudio/best[height<=${height}]/best`
        );
      }
    }

    // 4. Performance e Retentativa
    args.push(
      "--concurrent-fragments",
      (settings.concurrentFragments || 8).toString()
    );
    if (settings.socketTimeout)
      args.push("--socket-timeout", settings.socketTimeout.toString());
    if (settings.retries) args.push("--retries", settings.retries.toString());
    if (settings.fragmentRetries)
      args.push("--fragment-retries", settings.fragmentRetries.toString());

    // 5. Metadados e Subs
    if (settings.embedSubs) args.push("--embed-subs");
    if (settings.writeInfoJson) args.push("--write-info-json");
    if (settings.writeDescription) args.push("--write-description");
    args.push("--write-thumbnail");

    // 6. Headers / Proxy
    if (settings.userAgent) args.push("--user-agent", settings.userAgent);
    if (settings.referer) args.push("--referer", settings.referer);
    if (settings.noCheckCertificate) args.push("--no-check-certificate");

    // 7. Lógica de Post-Processing (Mesclagem de Áudio/Vídeo + Streaming)
    // NOTA: Flags de fragmentação só são usados no método stream() diretamente,
    // não via post-processor do yt-dlp para evitar criação de arquivos --Frag*
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
      // Passar argumentos como string corretamente formatada
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

    // Usar diretório temporário para evitar criar arquivos na raiz do repo
    const tempDir = require("node:os").tmpdir();
    
    const downloader = spawn(ytdlp, ytdlpArgs, {
      stdio: ["ignore", "pipe", "pipe"],
      cwd: tempDir, // Executar em diretório temporário
    });

    // O trunfo: FFmpeg recebe o lixo do yt-dlp e cospe fMP4 limpo
    const muxer = spawn(
      ffmpeg,
      [
        "-i",
        "pipe:0",
        "-c",
        "copy", // Apenas move os bytes, sem processamento pesado de CPU
        "-f",
        "mp4",
        "-movflags",
        "frag_keyframe+empty_moov+default_base_moof",
        "-loglevel",
        "error",
        "pipe:1",
      ],
      { 
        stdio: ["pipe", "pipe", "pipe"],
        cwd: tempDir, // Executar em diretório temporário
      }
    );

    // Encanamento
    downloader.stdout.pipe(muxer.stdin);
    
    // Tratamento de erro para evitar EPIPE quando o cliente fecha a conexão
    muxer.stdout.on("error", (err) => {
      if (err.code !== "EPIPE") {
        console.error("[Stream] Erro no pipe do muxer:", err);
      }
    });
    
    muxer.stdout.pipe(res);

    // Tratamento de erro no pipe de entrada do muxer
    muxer.stdin.on("error", (err) => {
      if (err.code !== "EPIPE") {
        console.error("[Stream] Erro no pipe de entrada do muxer:", err);
      }
    });

    // Logs de erro para debug real
    downloader.stderr.on("data", (d) =>
      console.log(`[yt-dlp] ${d.toString().trim()}`)
    );
    muxer.stderr.on("data", (d) =>
      console.error(`[muxer] ${d.toString().trim()}`)
    );

    return new Promise((resolve, reject) => {
      let resolved = false;
      
      const cleanup = () => {
        [downloader, muxer].forEach((p) => {
          if (p.exitCode === null) p.kill("SIGKILL");
        });
      };
      
      const handleResolve = () => {
        if (!resolved) {
          resolved = true;
          cleanup();
          resolve();
        }
      };
      
      const handleReject = (err) => {
        if (!resolved) {
          resolved = true;
          cleanup();
          // Ignorar EPIPE e ECONNRESET (cliente fechou a conexão)
          if (err && (err.code === "EPIPE" || err.code === "ECONNRESET")) {
            resolve();
          } else {
            reject(err);
          }
        }
      };
      
      // Tratamento de erro na resposta HTTP para evitar EPIPE não capturado
      res.on("error", (err) => {
        if (err.code !== "EPIPE" && err.code !== "ECONNRESET") {
          console.error("[Stream] Erro na resposta HTTP:", err);
        }
        handleReject(err);
      });
      
      res.on("close", () => {
        // Cliente fechou a conexão - isso é normal, não é um erro
        handleResolve();
      });
      
      // Tratamento de erro nos processos filhos
      downloader.on("error", (err) => {
        console.error("[Stream] Erro no processo yt-dlp:", err);
        handleReject(err);
      });
      
      muxer.on("error", (err) => {
        console.error("[Stream] Erro no processo ffmpeg:", err);
        handleReject(err);
      });
      
      muxer.on("close", (code) => {
        if (code === 0 || code === null || muxer.killed) {
          handleResolve();
        } else {
          handleReject(new Error(`Muxer falhou com código ${code}`));
        }
      });
    });
  }
}

module.exports = VideoDownloader;
