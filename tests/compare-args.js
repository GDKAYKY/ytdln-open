require("module").prototype.require = (function (orig) {
  return function (name) {
    if (name === "electron") {
      return { app: { getPath: (n) => `C:\\Users\\${process.env.USERNAME}\\Downloads` } };
    }
    return orig.apply(this, arguments);
  };
})(require("module").prototype.require);

const VideoDownloader = require("../src/video-downloader");
const path = require("path");

const downloader = new VideoDownloader();
downloader.binaries = {
  ytdlp: path.resolve(__dirname, "..", "bin", "yt-dlp.exe"),
  ffmpeg: path.resolve(__dirname, "..", "bin", "ffmpeg.exe"),
};

const settings = {
  outputFormat: "mp4",
  quality: "best",
  concurrentFragments: 8,
  embedSubs: false,
  writeInfoJson: false,
  writeThumbnail: true,
  writeDescription: false,
  userAgent: "",
  referer: "",
  socketTimeout: 30,
  retries: 5,
  fragmentRetries: 5,
  extractorRetries: 3,
  noCheckCertificate: true,
  ignoreErrors: true,
  audioFormat: "best",
};

const url = "https://www.youtube.com/watch?v=jNQXAC9IVRw";

console.log("=== DESKTOP DOWNLOAD ARGS ===\n");
const desktopArgs = downloader.buildYtdlpArgs(settings, url, { useStdout: false });
console.log(desktopArgs.join(" \\\n"));

console.log("\n\n=== STREAMING ARGS ===\n");
const streamArgs = downloader.buildYtdlpArgs(settings, url, { useStdout: true });
console.log(streamArgs.join(" \\\n"));

console.log("\n\n=== DIFFERENCES ===\n");
const desktopSet = new Set(desktopArgs);
const streamSet = new Set(streamArgs);

console.log("Only in DESKTOP:");
desktopArgs.forEach((arg, i) => {
  if (!streamArgs.includes(arg)) {
    console.log(`  [${i}] ${arg}`);
  }
});

console.log("\nOnly in STREAM:");
streamArgs.forEach((arg, i) => {
  if (!desktopArgs.includes(arg)) {
    console.log(`  [${i}] ${arg}`);
  }
});
