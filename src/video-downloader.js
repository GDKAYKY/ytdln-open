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
          resolve({ acodec: info.acodec || "" });
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

    let fileNameTemplate = settings.fileNameTemplate || "%(title)s";
    if (
      settings.videoFileNameModel &&
      settings.videoFileNameModel.trim() !== ""
    ) {
      fileNameTemplate = settings.videoFileNameModel;
    }

    // Determine base directory
    const baseDir =
      settings.videoFolder && settings.videoFolder.trim() !== ""
        ? settings.videoFolder
        : app.getPath("downloads");

    args.push(
      "-o",
      path.join(baseDir, `${fileNameTemplate}.%(ext)s`),
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

    if (settings.proxy) args.push("--proxy", settings.proxy);
    if (settings.restrictFilenames || settings.restrictFileName)
      args.push("--restrict-filenames");
    if (settings.forceIpv4) args.push("--force-ipv4");
    if (settings.useSponsorBlock) args.push("--sponsorblock-remove", "all");
    if (settings.embedMetadata) args.push("--embed-metadata");
    if (settings.writeAutoSubs) args.push("--write-auto-sub");

    if (settings.cacheDownloadsFirst) {
      const cacheDir = path.join(app.getPath("temp"), "ytdln-cache");
      args.push("-P", `temp:${cacheDir}`);
    }

    if (settings.noFragments) args.push("--no-part");
    if (settings.keepFragments) args.push("--keep-fragments");

    // NEW SETTINGS
    if (settings.useAria2) {
      args.push("--downloader", "aria2c");
      if (settings.connectionLimit) {
        args.push(
          "--downloader-args",
          `aria2c:-x ${settings.connectionLimit} -s ${settings.connectionLimit}`
        );
      }
    }

    if (settings.bufferSize) {
      args.push("--buffer-size", settings.bufferSize);
    }

    if (settings.anonymous) {
      args.push("--no-mtime", "--no-cookies");
    } else if (settings.useCookies) {
      // If we wanted to support browser cookies, we'd add --cookies-from-browser here
      // args.push("--cookies-from-browser", "chrome");
    }

    if (settings.avoidDuplicatedDownloads === "auto") {
      const archivePath = path.join(baseDir, "download_archive.txt");
      args.push("--download-archive", archivePath);
    }

    if (settings.cleanDownloadLeftovers === "all") {
      args.push("--no-part");
    }

    args.push(videoUrl);
    return args;
  }

  async download(videoUrl, settings, callbacks = {}) {
    if (!this.binaries) {
      throw new Error("VideoDownloader not initialized. Call init() first.");
    }

    let acodec = "";
    try {
      const info = await this.getVideoInfo(videoUrl);
      if (info) acodec = info.acodec;
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
          resolve(detectedPath);
        } else {
          reject(new Error(`yt-dlp exited with code ${code}`));
        }
      });
    });
  }
  // FIM
}

module.exports = VideoDownloader;
