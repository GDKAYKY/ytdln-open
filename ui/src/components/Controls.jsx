import React, { useState, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';

const Controls = ({ disabled, setStatus }) => {
  const { settings } = useSettings();
  const [url, setUrl] = useState('');
  const [progress, setProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (window.electronAPI) {
        const removeProgress = window.electronAPI.onDownloadProgress((data) => {
             const match = data.match(/(\d+\.?\d*)%/);
             if (match) {
                 const p = parseFloat(match[1]);
                 setProgress(p);
             }
        });
        // Note: Generic event listeners might need cleanup if the API supports it, 
        // but often in Electron preload they are just adding listeners.
        // Assuming window.electronAPI.on... returns nothing or a cleanup fn?
        // Checking renderer.js implies it just adds listener.
        
        window.electronAPI.onDownloadSuccess(() => {
            setIsDownloading(false);
            setProgress(100);
            setTimeout(() => {
                setProgress(0);
                setUrl('');
            }, 1000);
            // Toast should handle success message usually
        });
        
        window.electronAPI.onDownloadError((msg) => {
             setIsDownloading(false);
             setProgress(0);
        });
    }
  }, []);

  const handleDownload = () => {
    if (!url.trim()) {
        setStatus("ERROR: Please enter a valid URL.");
        return;
    }
    
    // Basic validation
    try {
        const u = new URL(url);
        if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
    } catch {
        setStatus("ERROR: Invalid URL. Use http:// or https://");
        return;
    }

    setIsDownloading(true);
    // setStatus('Iniciando download...'); // Handled by App listening to same events
    window.electronAPI.downloadVideoWithSettings(url, settings);
  };

  const radius = 22;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (progress / 100) * circumference;

  return (
        <div className="controls">
          <input
            type="text"
            id="videoUrl"
            className="input-field"
            placeholder="Insert the Link"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={disabled || isDownloading}
          />
          <button 
                id="downloadBtn" 
                className={`download-button ${isDownloading ? 'downloading' : ''}`}
                onClick={handleDownload}
                disabled={disabled || isDownloading}
            >
            {isDownloading ? <span className="btn-shine">Downloading...</span> : 'Download'}
          </button>
          <div className={`progress-frame ${isDownloading || progress > 0 ? 'active' : ''}`}>
            <svg className="progress-ring" width="52" height="52">
              <circle
                className="progress-ring__circle-bg"
                stroke="rgba(255, 255, 255, 0.1)"
                strokeWidth="4"
                fill="transparent"
                r="22"
                cx="26"
                cy="26"
              />
              <circle
                className="progress-ring__circle"
                stroke="#28A745"
                strokeWidth="4"
                fill="transparent"
                r="22"
                cx="26"
                cy="26"
                style={{ strokeDasharray: circumference, strokeDashoffset: offset }}
              />
            </svg>
            <div className="progress-text">{Math.floor(progress)}%</div>
          </div>
        </div>
  );
};

export default Controls;
