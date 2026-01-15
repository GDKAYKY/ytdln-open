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

function proveArguments() {
  console.log("🕵️ PROVA DE INTEGRIDADE DOS ARGUMENTOS");

  const downloader = new VideoDownloader();
  downloader.binaries = { ytdlp: "ytdlp.exe", ffmpeg: "ffmpeg.exe" };

  const userSettings = {
    quality: "1080p",
    concurrentFragments: 16,
    socketTimeout: 30,
    retries: 5,
    embedSubs: true,
    userAgent: "Agent/1.0 (Antigravity)",
    outputFormat: "mp4",
  };

  const videoUrl = "https://www.youtube.com/watch?v=example";

  console.log("\n--- TESTE 1: DOWNLOAD CONVENCIONAL (DISCO) ---");
  const diskArgs = downloader.buildYtdlpArgs(userSettings, videoUrl, {
    useStdout: false,
  });

  const hasQuality = diskArgs.includes(
    "bestvideo[height<=1080]+bestaudio/best[height<=1080]/best"
  );
  const hasFragments =
    diskArgs.includes("--concurrent-fragments") && diskArgs.includes("16");
  const hasUA =
    diskArgs.includes("--user-agent") &&
    diskArgs.includes("Agent/1.0 (Antigravity)");

  console.log(`- Qualidade 1080p preservada? ${hasQuality ? "✅" : "❌"}`);
  console.log(`- Fragmentos (16) preservados? ${hasFragments ? "✅" : "❌"}`);
  console.log(`- User-Agent preservado? ${hasUA ? "✅" : "❌"}`);

  console.log("\n--- TESTE 2: STREAMING (MODO GOLD STANDARD) ---");
  const streamArgs = downloader.buildYtdlpArgs(userSettings, videoUrl, {
    useStdout: true,
  });

  const hasStreamQuality = streamArgs.includes(
    "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best"
  );
  const hasStdout =
    streamArgs.includes("-o") &&
    streamArgs[streamArgs.indexOf("-o") + 1] === "-";

  console.log(
    `- Qualidade 1080p + Filtro MP4 ativos? ${hasStreamQuality ? "✅" : "❌"}`
  );
  console.log(`- Destino stdout (-) ativo? ${hasStdout ? "✅" : "❌"}`);
  console.log(
    `- Fragmentos (16) preservados no stream? ${streamArgs.includes("16") ? "✅" : "❌"}`
  );

  if (hasQuality && hasFragments && hasUA && hasStreamQuality) {
    console.log(
      "\n🔥 CONCLUSÃO: Os argumentos do usuário são MERGEADOS com as necessidades técnicas do streaming sem perda de dados."
    );
  } else {
    console.log("\n❌ FALHA: Algum argumento foi sobreposto indevidamente.");
  }
}

proveArguments();
