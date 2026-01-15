// MOCK para evitar erro do Electron em ambiente Node puro
require("module").prototype.require = (function (orig) {
  return function (name) {
    if (name === "electron") {
      return { app: { getPath: (n) => `C:\\Downloads\\${n}` } };
    }
    return orig.apply(this, arguments);
  };
})(require("module").prototype.require);

const VideoDownloader = require("./src/video-downloader");

function showCommand() {
  console.log("🎬 COMANDO QUE SERÁ EXECUTADO");
  console.log("================================================\n");

  const videoUrl = "https://youtu.be/taP0wP-mHZ4";
  
  const extensionSettings = {
    outputFormat: "mp4",
    quality: "best",
    concurrentFragments: 8,
    embedSubs: false,
    writeInfoJson: false,
    writeThumbnail: false,
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

  const downloader = new VideoDownloader();
  downloader.binaries = {
    ytdlp: "yt-dlp.exe",
    ffmpeg: "ffmpeg.exe",
  };

  const streamArgs = downloader.buildYtdlpArgs(extensionSettings, videoUrl, {
    useStdout: true,
  });

  console.log("📝 COMANDO COMPLETO (para streaming web):\n");
  console.log("yt-dlp.exe \\");
  streamArgs.forEach((arg, i) => {
    const isLast = i === streamArgs.length - 1;
    const separator = isLast ? "" : " \\";
    console.log(`  "${arg}"${separator}`);
  });

  console.log("\n\n📝 COMANDO SIMPLIFICADO:\n");
  console.log("yt-dlp.exe " + streamArgs.map(arg => {
    if (arg.includes(" ") || arg.includes("\\")) {
      return `"${arg}"`;
    }
    return arg;
  }).join(" "));

  console.log("\n\n🔍 DETALHES DOS ARGUMENTOS:\n");
  
  const argGroups = {
    "Saída": ["-o"],
    "FFmpeg": ["--ffmpeg-location", "--merge-output-format"],
    "Qualidade": ["-f"],
    "Performance": ["--concurrent-fragments", "--socket-timeout", "--retries", "--fragment-retries"],
    "Segurança": ["--no-check-certificate", "--ignore-errors"],
  };

  for (const [group, keywords] of Object.entries(argGroups)) {
    console.log(`${group}:`);
    for (let i = 0; i < streamArgs.length; i++) {
      const arg = streamArgs[i];
      if (keywords.includes(arg)) {
        const value = streamArgs[i + 1];
        console.log(`  ${arg} ${value}`);
        i++; // Skip next since we already printed it
      }
    }
    console.log();
  }

  console.log("URL:");
  console.log(`  ${videoUrl}`);
}

showCommand();
