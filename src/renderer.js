const downloadButton = document.getElementById('download-button');
const urlInput = document.getElementById('url-input');

downloadButton.addEventListener('click', () => {
  const url = urlInput.value;
  // Use the electronAPI exposed in preload.js to send a message to the main process
  window.electronAPI.sendMessage('download-video', { url: url });
});

// Example of receiving a message from the main process
window.electronAPI.onMessage('download-progress', (args) => {
  console.log('Progress:', args.percent);
});
