const videoUrlInput = document.getElementById('videoUrl');
const downloadBtn = document.getElementById('downloadBtn');
const statusDiv = document.getElementById('status');
const debugModeCheckbox = document.getElementById('debugMode');

// Clear status on new download
downloadBtn.addEventListener('click', () => {
  const url = videoUrlInput.value;
  if (url) {
    statusDiv.innerText = 'Iniciando download...';
    window.electronAPI.send('download-video', url);
  }
});

// Listen for download progress updates from the main process
window.electronAPI.on('download-progress', (data) => {
  if (debugModeCheckbox.checked) {
    statusDiv.innerText += data; // Append for debug log
  } else {
    const lines = data.trim().split('\n');
    const lastLine = lines[lines.length - 1];
    statusDiv.innerText = lastLine; // Overwrite with the last line for clean status
  }
});

// Listen for download success message
window.electronAPI.on('download-success', () => {
  const successMessage = '\n\nDownload concluído com sucesso!';
  if (debugModeCheckbox.checked) {
    statusDiv.innerText += successMessage;
  } else {
    statusDiv.innerText = successMessage.trim();
  }
});

// Listen for download error message
window.electronAPI.on('download-error', (errorMessage) => {
  const finalErrorMessage = `\n\nERRO: ${errorMessage}`;
   if (debugModeCheckbox.checked) {
    statusDiv.innerText += finalErrorMessage;
  } else {
    statusDiv.innerText = finalErrorMessage.trim();
  }
});
