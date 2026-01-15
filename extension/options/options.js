const defaultSettings = {
  // Basics
  outputFormat: "mp4",
  quality: "best",
  audioFormat: "best",
  concurrentFragments: 8,
  embedSubs: false,
  writeInfoJson: false,

  // Advanced
  userAgent: "",
  referer: "",
  socketTimeout: 30,
  retries: 5,
  fragmentRetries: 5,
  extractorRetries: 3,
  noCheckCertificate: true,
  ignoreErrors: true,
  writeThumbnail: false,
  writeDescription: false,
  showConsole: true,

  fileNameTemplate: "%(title)s",
  proxy: "",
  restrictFilenames: false,
  forceIpv4: false,
  useSponsorBlock: false,
  sponsorBlockApiUrl: "",
  enableIfModifiedSince: true,
  addExtraCommands: false,
  forceKeyframesOnCuts: false,

  // Advanced YouTube & Commmands
  ytPlayerClient: "default,mediaconnect",
  poToken: "",
  extraExtractorArgs: "",
  extraCommandForDataSearch: false,
  disableWriteInfoJson: false,

  // Folder Settings
  videoFileNameModel: "%(title)s",
  musicFileNameModel: "%(title)s",

  // Processing
  cacheDownloadsFirst: false,
  noFragments: false,
  keepFragments: false,
  restrictFileName: false,
  includeMetadata: true,
  cropThumbnail: false,
  usePlaylistNameAsAlbum: false,
  includeSubtitles: false,
  saveSubtitles: false,
  saveAutoSubtitles: false,
  subtitleLanguage: "en",
  subtitleFormat: "srt",
  thumbnailFormat: "jpg",
  chaptersInVideo: true,
  recodingVideo: false,
  preferredVideoCodec: "H264 (avc1)",
  preferredAudioCodec: "opus",
  preferredAudioBitrate: "medium",
  useCustomAudioQuality: false,
  audioQuality: "5",
  videoFormatId: "",
  audioFormatId: "",
  preferSmallFormats: false,
  audioFormatOrder:
    "1. Preferred format ID\n2. Language\n3. Codec\n4. Container",
  videoFormatOrder:
    "1. Preferred format ID\n2. Video quality\n3. Codec\n4. Video without audio\n5. Container",

  // Download Tab
  anonymous: false,
  showDownloadCard: true,
  fastDownload: false,
  useCookies: false,
  useAria2: false,
  connectionLimit: "",
  bufferSize: "",
  preferredDownloadType: "video",
  rememberDownloadType: false,
  avoidDuplicatedDownloads: "none",
  cleanDownloadLeftovers: "none",
  downloadRegistry: false,
  concurrentDownloads: 1,
};

// Carregar configurações salvas
async function loadSettings() {
  const settings = await chrome.storage.local.get(defaultSettings);

  Object.keys(settings).forEach((key) => {
    const field = document.getElementById(key);
    const valueDisplay = document.getElementById("val_" + key);

    if (!field) return;

    if (field.type === "checkbox") {
      field.checked = settings[key];
    } else {
      field.value = settings[key];
      if (valueDisplay) valueDisplay.textContent = settings[key];
    }
  });

  // Toggle visibility of conditional containers
  toggleConditionalVisibility();
}

function toggleConditionalVisibility() {
  const sponsorBlock = document.getElementById("useSponsorBlock")?.checked;
  const audioQual = document.getElementById("useCustomAudioQuality")?.checked;

  const sponsorContainer = document.getElementById(
    "sponsorBlockApiUrlContainer"
  );
  const audioContainer = document.getElementById("audioQualityContainer");

  if (sponsorContainer)
    sponsorContainer.style.display = sponsorBlock ? "flex" : "none";
  if (audioContainer)
    audioContainer.style.display = audioQual ? "flex" : "none";
}

// Salvar configurações
async function saveSettings() {
  const newSettings = {};
  Object.keys(defaultSettings).forEach((key) => {
    const field = document.getElementById(key);
    if (!field) {
      // Preservar valores que não estão no DOM (como pastas que estão no app mas não na extensão)
      // No entanto, para simplificar, vamos mapear o que está no DOM.
      // O Storage da extensão é independente do App, então preservamos o que já estiver lá.
      return;
    }

    if (field.type === "checkbox") {
      newSettings[key] = field.checked;
    } else if (field.type === "range") {
      newSettings[key] = parseInt(field.value);
    } else {
      newSettings[key] = field.value;
    }
  });

  // Mesclar com o que já está salvo para não perder chaves não editáveis na extensão (ex: musicFolder)
  const current = await chrome.storage.local.get(null);
  await chrome.storage.local.set({ ...current, ...newSettings });

  const status = document.getElementById("status");
  status.textContent = "Configurações salvas!";
  status.style.color = "#28a745";

  setTimeout(() => {
    status.textContent = "";
  }, 2000);
}

// Resetar para o padrão
async function resetSettings() {
  if (confirm("Tem certeza que deseja restaurar as configurações padrão?")) {
    await chrome.storage.local.set(defaultSettings);
    await loadSettings();
  }
}

// Exportar configurações para JSON
async function exportSettings() {
  const settings = await chrome.storage.local.get(null);
  const blob = new Blob([JSON.stringify(settings, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ytdln_config_${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Importar configurações de JSON
function handleImport(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (event) => {
    try {
      const settings = JSON.parse(event.target.result);
      if (
        confirm(
          "Deseja substituir as configurações atuais pelo arquivo importado?"
        )
      ) {
        await chrome.storage.local.set(settings);
        await loadSettings();
        const status = document.getElementById("status");
        status.textContent = "Importado com sucesso!";
        status.style.color = "#28a745";
        setTimeout(() => (status.textContent = ""), 2000);
      }
    } catch (error) {
      alert("Erro ao importar: Arquivo JSON inválido.");
      console.error(error);
    }
    // Limpar input para permitir re-importar o mesmo arquivo
    e.target.value = "";
  };
  reader.readAsText(file);
}

// Alternar abas
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelectorAll(".tab-content")
      .forEach((c) => c.classList.remove("active"));

    btn.classList.add("active");
    const targetTab = document.getElementById(btn.dataset.tab);
    if (targetTab) targetTab.classList.add("active");
  });
});

// listeners para ranges e mudanças condicionais
document.querySelectorAll('input[type="range"]').forEach((range) => {
  range.addEventListener("input", (e) => {
    const valSpan = document.getElementById("val_" + e.target.id);
    if (valSpan) valSpan.textContent = e.target.value;
  });
});

document.querySelectorAll('input[type="checkbox"]').forEach((ck) => {
  ck.addEventListener("change", toggleConditionalVisibility);
});

document.addEventListener("DOMContentLoaded", loadSettings);
document.getElementById("save").addEventListener("click", saveSettings);
document.getElementById("reset").addEventListener("click", resetSettings);

// Novos listeners para Exportar/Importar
document
  .getElementById("exportSettings")
  .addEventListener("click", exportSettings);
document.getElementById("importSettingsBtn").addEventListener("click", () => {
  document.getElementById("importFile").click();
});
document.getElementById("importFile").addEventListener("change", handleImport);
