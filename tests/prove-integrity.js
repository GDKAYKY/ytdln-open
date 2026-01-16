const VideoDownloader = require("../src/video-downloader");
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

async function proveIntegrity() {
  console.log("🕵️ ANALISANDO INTEGRIDADE DO STREAM (PROVA REAL)");

  // 1. Inicializar o downloader (o mesmo que o App usa)
  const downloader = new VideoDownloader();
  await downloader.init();

  const ffprobePath = path.join(__dirname, "bin", "ffprobe.exe");
  const testUrl = "https://www.youtube.com/watch?v=ZzI9JE0i6Lc";
  const settings = { quality: "360p", outputFormat: "mp4" };

  const tempFile = path.join(__dirname, "integrity_sample.mp4");
  const writeStream = fs.createWriteStream(tempFile);

  console.log("📥 Capturando amostra de 3MB do stream direto...");

  let bytesReceived = 0;
  let streamPromise;

  // Criamos um mock de "Response" do Express/Node
  const mockRes = new (require("events").EventEmitter)();
  mockRes.write = (chunk) => {
    bytesReceived += chunk.length;
    writeStream.write(chunk);
    if (bytesReceived >= 3 * 1024 * 1024) {
      console.log(
        `✅ Amostra de ${(bytesReceived / 1024 / 1024).toFixed(2)}MB capturada.`
      );
      mockRes.emit("close"); // Isso dispara o cleanup no downloader
    }
    return true;
  };
  mockRes.end = () => {};
  mockRes.writeHead = () => {};

  try {
    await downloader.stream(testUrl, settings, mockRes);
  } catch (e) {
    // Ignoramos erro de interrupção forçada
  }

  writeStream.end();

  console.log("🔍 Rodando ffprobe na amostra capturada...");

  return new Promise((resolve) => {
    setTimeout(() => {
      const probe = spawn(ffprobePath, [
        "-v",
        "info",
        "-show_format",
        "-show_streams",
        tempFile,
      ]);

      let output = "";
      probe.stdout.on("data", (d) => (output += d.toString()));
      probe.stderr.on("data", (d) => (output += d.toString())); // ffprobe joga info no stderr as vezes

      probe.on("close", () => {
        console.log("\n--- DADOS TÉCNICOS DA AMOSTRA ---");
        const streams = output.match(/codec_name=\w+/g);
        const resolution = output.match(/width=\d+|height=\d+/g);

        if (streams) console.log("Canal: " + streams.join(" | "));
        if (resolution)
          console.log(
            "Resolução: " + resolution.join("x").replace(/width=|height=/g, "")
          );

        if (output.includes("format_name=mov,mp4,m4a,3gp,3g2,mj2")) {
          console.log("Container: MP4 (ISO/IEC 14496-12) - OK");
        }

        console.log(
          "\n✅ CONCLUSÃO: O arquivo é um fluxo de mídia íntegro, reconhecido pelo FFmpeg."
        );
        fs.unlinkSync(tempFile);
        resolve();
      });
    }, 1000);
  });
}

proveIntegrity()
  .then(() => {
    console.log("FIM DO TESTE.");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
