import React, { useState, useEffect, useRef } from 'react';

const DownloadPopup = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [progress, setProgress] = useState(0);
  const [filename, setFilename] = useState("Preparing download...");
  const [speed, setSpeed] = useState("--");
  const [eta, setEta] = useState("--");
  const [size, setSize] = useState("--");
  const titleRef = useRef(null);

  useEffect(() => {
    if(!window.electronAPI) return;

    const onProgress = window.electronAPI.onDownloadProgress((data) => {
        setIsVisible(true);
        // Parsing logic from string data or object? 
        // Typically yt-dlp stdout lines are sent.
        // Example: [download]  45.0% of 10.00MiB at 2.00MiB/s ETA 00:05
        
        // Extract Percentage
        const pMatch = data.match(/(\d+\.?\d*)%/);
        if (pMatch) setProgress(parseFloat(pMatch[1]));

        // Extract Speed
        const sMatch = data.match(/at\s+([^\s]+)/);
        if (sMatch) setSpeed(sMatch[1]);
        
        // Extract ETA
        const eMatch = data.match(/ETA\s+([^\s]+)/);
        if (eMatch) setEta(eMatch[1]);
        
        // Extract Size (of X size)
        const zMatch = data.match(/of\s+([^\s]+)/); // or "of ~X"
        if (zMatch) setSize(zMatch[1]);
        
        // Simple filename extraction or set from initial request? 
        // We might not get filename easily from stdout lines always unless capturing "Destination:"
        // For now, keep "Processing..." or update if line says "Destination: ..."
        if(data.includes("Destination:") || data.includes("Merger")) {
             // clean up path to just filename?
             const parts = data.split(/\/|\\/); // split by path separators
             setFilename(parts[parts.length-1].trim());
        }
    });

    const onSuccess = window.electronAPI.onDownloadSuccess(() => {
        setIsVisible(false);
        // Reset states
        setProgress(0);
        setSpeed("--");
        setEta("--");
        setSize("--");
        setFilename("Preparing download...");
    });
    
    const onError = window.electronAPI.onDownloadError(() => {
        setIsVisible(false);
    });

    return () => {
        // clean up listeners
    };
  }, []);

  // Text scramble effect
  useEffect(() => {
      if(isVisible && titleRef.current) {
          const element = titleRef.current;
          const targetText = "Downloading";
          const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
          let iteration = 0;
          let interval = null;
          
          interval = setInterval(() => {
             element.innerText = targetText.split("")
                .map((letter, index) => {
                    if(index < iteration) return targetText[index];
                    return letters[Math.floor(Math.random() * 26)];
                }).join("");
            
             if(iteration >= targetText.length) clearInterval(interval);
             iteration += 1/3;
          }, 30);
          
          return () => clearInterval(interval);
      }
  }, [isVisible]);

  const handleClose = () => setIsVisible(false);

  if (!isVisible) return null;

  return (
    <div id="downloadPopup" className={`download-popup ${isVisible ? 'active' : ''}`}>
      <div className="download-popup-content">
        <div className="download-popup-header">
          <div className="download-popup-icon">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="download-popup-title" ref={titleRef}>Downloading</div>
          <button className="download-popup-close" onClick={handleClose}>
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
        <div className="download-popup-body">
          <div className="download-popup-filename">{filename}</div>
          <div className="download-popup-progress-container">
            <div className="download-popup-progress-bar">
              <div className="download-popup-progress-fill" style={{width: `${progress}%`}}></div>
            </div>
            <div className="download-popup-progress-text">{Math.floor(progress)}%</div>
          </div>
          <div className="download-popup-stats">
            <div className="download-popup-stat">
              <span className="download-popup-stat-label">Speed</span>
              <span className="download-popup-stat-value">{speed}</span>
            </div>
            <div className="download-popup-stat">
              <span className="download-popup-stat-label">ETA</span>
              <span className="download-popup-stat-value">{eta}</span>
            </div>
            <div className="download-popup-stat">
              <span className="download-popup-stat-label">Size</span>
              <span className="download-popup-stat-value">{size}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DownloadPopup;
