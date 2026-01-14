const { app } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");
const BinaryDownloader = require("./bin-downloader");
const ProgressParser = require("./progress-parser");

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
          });
        } catch (e) {
          console.error("Error parsing video JSON:", e);
          resolve(null);
        }
      });
    });
  }

  buildYtdlpArgs(settings, videoUrl) {
    const { ffmpeg } = this.binaries;
    const args = ["--progress", "--newline"];

    // Se taskId foi fornecido, usar no nome do arquivo para identificação única
    const outputTemplate = settings.taskId 
      ? `download_${settings.taskId}.%(ext)s`
      : "%(title)s.%(ext)s";

    args.push(
      "-o",
      path.join(app.getPath("downloads"), outputTemplate),
      "--ffmpeg-location",
      ffmpeg,
      "--merge-output-format",
      settings.outputFormat || "mp4"
    );

    if (settings.quality && settings.quality !== "best") {
      if (settings.quality === "worst") {
        args.push("-f", "worst");
      } else {
        args.push("-f", `best[height<=${settings.quality.replace("p", "")}]`);
      }
    }

    args.push(
      "--concurrent-fragments",
      (settings.concurrentFragments || 8).toString()
    );

    if (settings.embedSubs) args.push("--embed-subs");
    if (settings.writeInfoJson) args.push("--write-info-json");
    args.push("--write-thumbnail");
    if (settings.writeDescription) args.push("--write-description");
    if (settings.userAgent) args.push("--user-agent", settings.userAgent);
    if (settings.referer) args.push("--referer", settings.referer);

    if (settings.socketTimeout)
      args.push("--socket-timeout", settings.socketTimeout.toString());
    if (settings.retries) args.push("--retries", settings.retries.toString());
    if (settings.fragmentRetries)
      args.push("--fragment-retries", settings.fragmentRetries.toString());
    if (settings.extractorRetries)
      args.push("--extractor-retries", settings.extractorRetries.toString());

    if (settings.noCheckCertificate) args.push("--no-check-certificate");
    if (settings.ignoreErrors) args.push("--ignore-errors");

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

    const args = this.buildYtdlpArgs(settings, videoUrl);
    const { ytdlp } = this.binaries;

    const targetFormat = settings.audioFormat;
    if (targetFormat && targetFormat !== "best") {
      const codecMap = {
        mp3: { check: "mp3", ffmpeg: "libmp3lame" },
        aac: { check: "mp4a", ffmpeg: "aac" },
        opus: { check: "opus", ffmpeg: "libopus" },
      };
      const target = codecMap[targetFormat];
      if (target && acodec && !acodec.startsWith(target.check)) {
        console.log(
          `Audio codec detected: ${acodec}. Re-encoding to ${targetFormat.toUpperCase()}.`
        );
        args.push(
          "--postprocessor-args",
          `ffmpeg:-c:v copy -c:a ${target.ffmpeg}`
        );
      }
    }

    return new Promise((resolve, reject) => {
      const process = spawn(ytdlp, args, {
        stdio: ["ignore", "pipe", "pipe"],
      });

      let detectedPath = null;
      const progressParser = new ProgressParser();

      process.stdout.on("data", (data) => {
        const str = data.toString();
        
        // Chamar o callback original com a string
        if (callbacks.onProgress) {
          // Tentar parsear o progresso
          const progress = progressParser.processLine(str);
          
          // Chamar com dados parseados se disponível, caso contrário com string
          if (progress) {
            callbacks.onProgress(progress);
          } else {
            callbacks.onProgress(str);
          }
        }

        // Detectar caminho do arquivo, mas ignorar arquivos JSON/info
        const destMatch = str.match(/\[download\] Destination: (.+)/);
        if (destMatch) {
          const path = destMatch[1].trim();
          // Ignorar arquivos JSON e outros arquivos auxiliares
          if (!path.match(/\.(json|description|info\.json)$/i)) {
            detectedPath = path;
          }
        }

        const mergeMatch = str.match(/\[Merger\] Merging formats into "(.+)"/);
        if (mergeMatch) {
          const path = mergeMatch[1].trim();
          // Merge sempre é o arquivo final de vídeo/áudio
          detectedPath = path;
        }

        const fixupMatch = str.match(/\[Fixup.+\] Saving .* to "(.+)"/);
        if (fixupMatch) {
          const path = fixupMatch[1].trim();
          // Fixup sempre é o arquivo final
          detectedPath = path;
        }
      });

      process.stderr.on("data", (data) => {
        const str = data.toString();
        console.log(`[yt-dlp] ${str}`);
        if (str.toLowerCase().includes("error") && callbacks.onError) {
          callbacks.onError(str);
        }
      });

      process.on("close", async (code) => {
        if (code === 0) {
          const fs = require("node:fs");
          const downloadsPath = app.getPath("downloads");
          
          // Se temos taskId, sabemos exatamente o nome do arquivo
          if (settings.taskId && !detectedPath) {
            const expectedFile = path.join(downloadsPath, `download_${settings.taskId}.${settings.outputFormat || 'mp4'}`);
            if (fs.existsSync(expectedFile)) {
              detectedPath = expectedFile;
              console.log(`[VideoDownloader] Arquivo encontrado pelo taskId: ${detectedPath}`);
            }
          }
          
          // Fallback: Se detectedPath não foi encontrado, tentar encontrar o arquivo de mídia
          if (!detectedPath || detectedPath.match(/\.(json|description)$/i)) {
            try {
              const files = fs.readdirSync(downloadsPath)
                .map(file => ({
                  name: file,
                  path: path.join(downloadsPath, file),
                  time: fs.statSync(path.join(downloadsPath, file)).mtime.getTime()
                }))
                .filter(file => {
                  const ext = path.extname(file.name).toLowerCase();
                  const isMedia = /\.(mp4|mp3|webm|mkv|avi|mov|flv|wmv|m4a|ogg|opus)$/i.test(ext);
                  // Se temos taskId, filtrar por ele
                  if (settings.taskId) {
                    return isMedia && file.name.includes(settings.taskId);
                  }
                  return isMedia;
                })
                .sort((a, b) => b.time - a.time);
              
              if (files.length > 0) {
                detectedPath = files[0].path;
                console.log(`[VideoDownloader] Arquivo detectado automaticamente: ${detectedPath}`);
              }
            } catch (err) {
              console.warn("[VideoDownloader] Erro ao detectar arquivo automaticamente:", err);
            }
          }
          
          resolve({ detectedPath, duration });
        } else {
          reject(new Error(`yt-dlp exited with code ${code}`));
        }
      });
    });
  }
}

module.exports = VideoDownloader;
