import React, { useState, useEffect } from 'react';
import { useSettings } from './contexts/SettingsContext';
import Header from './components/Header';
import Loader from './components/Loader';
import Controls from './components/Controls';
import Library from './components/Library';
import Console from './components/Console';
import SettingsModal from './components/SettingsModal';
import DownloadPopup from './components/DownloadPopup';
import ToastContainer from './components/ToastContainer';

function App() {
  const { settings } = useSettings();
  const [loading, setLoading] = useState(true);
  const [binariesReady, setBinariesReady] = useState(false);
  const [status, setStatus] = useState("Initializing...");
  const [isConsoleOpen, setIsConsoleOpen] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    // Check binaries status
    if (window.electronAPI) {
        const onStatus = window.electronAPI.onBinariesStatus((data) => {
            if (data.status === 'ready') {
                setBinariesReady(true);
                setLoading(false);
                setStatus(`Binaries ready! OS: ${data.platform} (${data.arch})`);
            } else {
                 setStatus(`Status: ${data.message}`);
            }
        });
        window.electronAPI.checkBinariesStatus();

        return () => {
          if (typeof onStatus === 'function') onStatus();
        };
    } else {
        // Dev mode fallback
        setTimeout(() => setLoading(false), 2000);
    }
  }, []);

  useEffect(() => {
      setIsConsoleOpen(settings.showConsole);
  }, [settings.showConsole]);

  return (
    <>
      {loading && <Loader status={status} />}
      <div className="frame-container">
        <div className="background">
          <Header onOpenSettings={() => setShowSettings(true)} />
          
          <div className="title-frame">
             <div className="title-row">
               <img className="title-icon" src="./assets/logo_2048x2048.png" alt="YTDLN-OPEN Logo" />
               <div className="title">YTDLN-OPEN</div>
             </div>
             <div className="build-version">build v1.1.0</div>
          </div>

          <Controls disabled={!binariesReady} setStatus={setStatus} />
          
          <div className={`main-content ${!isConsoleOpen ? 'console-collapsed' : ''}`}>
             <Console isOpen={isConsoleOpen} status={status} />
             <Library />
          </div>

        </div>
      </div>
      
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <DownloadPopup />
      <ToastContainer />
    </>
  );
}

export default App;
