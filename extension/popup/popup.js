const downloadsList = document.getElementById("downloadsList");
const downloadsContainer = document.getElementById("downloadsContainer");
const urlInput = document.getElementById("urlInput");
const downloadBtn = document.getElementById("downloadBtn");

// Solicita o estado inicial ao abrir o popup
chrome.runtime.sendMessage({ action: "get_queue_state" }, (response) => {
  if (response && response.queue) {
    updateUI(response.queue);
  }
});

// Escuta atualizações em tempo real vindas do background.js
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "update_ui") {
    if (message.type === "queue") {
      updateUI(message.payload);
    } else if (message.type === "progress") {
      updateJobProgress(message.payload);
    }
  }
});

function updateUI(queue) {
  const activeJobs = queue.filter(
    (j) => j.status === "RUNNING" || j.status === "PENDING"
  );

  if (activeJobs.length === 0) {
    downloadsContainer.classList.remove("active");
    return;
  }

  downloadsContainer.classList.add("active");
  downloadsList.innerHTML = "";

  activeJobs.forEach((job) => {
    const item = document.createElement("div");
    item.className = "job-item";
    item.id = `job-${job.id}`;

    const displayTitle =
      job.title || job.url.split("v=")[1]?.split("&")[0] || "Download...";

    item.innerHTML = `
      <div class="job-title" title="${job.url}">${displayTitle}</div>
      <div class="progress-bar-bg">
        <div class="progress-bar-fill" style="width: ${job.progress || 0}%"></div>
      </div>
      <div class="job-meta">
        <span class="job-status">${job.status}</span>
        <span class="job-percentage">${Math.floor(job.progress || 0)}%</span>
      </div>
    `;
    downloadsList.appendChild(item);
  });
}

function updateJobProgress(data) {
  const item = document.getElementById(`job-${data.id}`);
  if (item) {
    const fill = item.querySelector(".progress-bar-fill");
    const perc = item.querySelector(".job-percentage");
    const status = item.querySelector(".job-status");

    if (fill) fill.style.width = `${data.progress}%`;
    if (perc) perc.textContent = `${Math.floor(data.progress)}%`;
    if (status) status.textContent = `BAIXANDO...`;
  }
}

downloadBtn.addEventListener("click", async () => {
  let url = urlInput.value.trim();

  if (!url) {
    // Se não tiver URL no input, pega da aba ativa
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    url = tab?.url;
  }

  if (url) {
    chrome.runtime.sendMessage(
      {
        action: "openApp",
        url: url,
      },
      (response) => {
        urlInput.value = "";
      }
    );
  }
});

document.getElementById("settingsBtn").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
