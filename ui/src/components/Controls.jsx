import React, { useState, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';

const Controls = ({ disabled, setStatus }) => {
  const { settings } = useSettings();
  const [url, setUrl] = useState('');
  const [progress, setProgress] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (window.electronAPI) {
        // Escuta atualizações da fila (quando um download entra, sai ou muda de estado)
        const offUpdate = window.electronAPI.onQueueUpdate((queue) => {
          // Se houver algo sendo baixado, marcamos como isDownloading
          const runningJob = queue.find(j => j.status === 'RUNNING');
          if (runningJob) {
            setIsDownloading(true);
            setProgress(runningJob.progress || 0);
          } else {
            // Se não tem nada rodando e não tem nada pendente, resetamos
            if (!queue.some(j => j.status === 'PENDING')) {
              setIsDownloading(false);
            }
          }
        });

        // Escuta o progresso detalhado do job ativo
        const offProgress = window.electronAPI.onQueueProgress((data) => {
          // Aqui data é { id, progress, speed, eta, size }
          setProgress(data.progress);
          // Opcionalmente podemos mostrar speed/eta em algum lugar
        });
        
        window.electronAPI.onDownloadSuccess(() => {
            // Mantido para compatibilidade ou legados, mas a fila deve ser a fonte da verdade
            setProgress(100);
            setTimeout(() => {
                setProgress(0);
                setUrl('');
            }, 1000);
        });
        
        window.electronAPI.onDownloadError((msg) => {
             setIsDownloading(false);
             setProgress(0);
             // setStatus(msg); // O ideal é passar o setStatus via prop ou context
        });

        // Integração com a Extensão de Navegador
        const offExternal = window.electronAPI.onExternalDownload((data) => {
          if (data && data.url) {
            console.log("Requisicão externa recebida:", data);
            setUrl(data.url);
            
            setTimeout(() => {
              // Agora usamos addToQueue diretamente se vier com settings
              if (data.settings) {
                window.electronAPI.addToQueue({ url: data.url, settings: data.settings });
              } else {
                document.getElementById('downloadBtn')?.click();
              }
            }, 100);
          }
        });

        return () => {
          if (typeof offUpdate === 'function') offUpdate();
          if (typeof offProgress === 'function') offProgress();
          if (typeof offExternal === 'function') offExternal();
        };
    }
  }, []);

  const handleDownload = () => {
    let cleanUrl = url.trim();

    // Remove prefixo blob: se existir (comum em cliques acidentais no player)
    if (cleanUrl.startsWith('blob:')) {
      // Tenta extrair a parte interna se for blob:https://...
      const internalMatch = cleanUrl.match(/blob:(https?:\/\/.+)/);
      if (internalMatch) {
         cleanUrl = internalMatch[1];
      } else {
         setStatus("ERROR: Blob URLs are not supported directly. Please use the page URL.");
         return;
      }
    }

    if (!cleanUrl) {
        setStatus("ERROR: Please enter a valid URL.");
        return;
    }
    
    // Basic validation
    try {
        const u = new URL(cleanUrl);
        if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
    } catch {
        setStatus("ERROR: Invalid URL. Use http:// or https://");
        return;
    }

    setIsDownloading(true);
    // Para manter o input atualizado com a URL limpa
    setUrl(cleanUrl);
    window.electronAPI.addToQueue({ url: cleanUrl, settings });
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
