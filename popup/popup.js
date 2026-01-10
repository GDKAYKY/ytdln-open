document.getElementById("downloadBtn").addEventListener("click", async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab && tab.url) {
    chrome.runtime.sendMessage(
      {
        action: "openApp",
        url: tab.url,
      },
      (response) => {
        window.close(); // Fecha o popup após enviar
      }
    );
  }
});
