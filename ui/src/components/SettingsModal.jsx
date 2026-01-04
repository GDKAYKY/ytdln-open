import React, { useState, useEffect } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import Checkbox from './Checkbox';

const SettingsModal = ({ isOpen, onClose }) => {
  const { settings, updateSettings, resetSettings } = useSettings();
  const [localSettings, setLocalSettings] = useState(settings);
  const [activeTab, setActiveTab] = useState('basic');

  useEffect(() => {
    if(isOpen) setLocalSettings(settings);
  }, [isOpen, settings]);

  const handleChange = (key, value) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    updateSettings(localSettings);
    onClose();
  };
  
  const handleReset = () => {
      if(confirm("Are you sure you want to reset all settings to default?")) {
          resetSettings();
          setLocalSettings(settings); // Settings context will update 'settings', but we need to sync local state or close
          onClose(); // Easier to just close for now
      }
  };

  const handleSelectFolder = (type) => {
      if(window.electronAPI) {
          // Listen for folder selection response just once or manage globally?
          // The main process sends 'folder-selected' event.
          // In React, it's better if we just invoke methods and wait for update? 
          // Current renderer.js structure uses a listener.
          // Let's rely on App.jsx (global listener) or add a temp one here?
          // Actually, let's create a temporary listener inside this component is fine.
          
           const cleanup = window.electronAPI.onFolderSelected((data) => {
               if(data.type === type) {
                  handleChange(type === 'music' ? 'musicFolder' : 'videoFolder', data.path);
               }
           });
           
           window.electronAPI.selectFolder(type);
           
           // Cleanup listener after some time or on unmount? 
           // Listener in preload returns a cleanup function, but we need to call it.
           // Ideally we should manage this better, but for now:
           setTimeout(cleanup, 60000); // Auto remove after 60s to avoid leaks if user cancels
      }
  };
  
  const handleOpenFolder = (path) => {
      if(window.electronAPI) window.electronAPI.openSpecificFolder(path);
  };
  
  if (!isOpen) return null;

  return (
    <div id="settingsModal" className="modal show" style={{display: 'block'}}>
      <div className="modal-content">
        <div className="modal-header">
          <h2>Settings</h2>
          <span className="close" onClick={onClose}>&times;</span>
        </div>
        <div className="tabs">
          {['basic', 'folders', 'download', 'processing', 'update', 'advanced'].map(tab => (
              <button 
                key={tab} 
                className={`tab-btn ${activeTab === tab ? 'active' : ''}`} 
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
          ))}
        </div>
        
        <div className="modal-body">
            {/* BASIC TAB */}
            <div className={`tab-content ${activeTab === 'basic' ? 'active' : ''}`}>
                <div className="setting-item">
                    <div className="setting-label-group">
                        <i className="material-icons">movie</i>
                        <label>Output Format:</label>
                    </div>
                    <select value={localSettings.outputFormat} onChange={(e) => handleChange('outputFormat', e.target.value)}>
                        <option value="mp4">MP4</option>
                        <option value="mkv">MKV</option>
                        <option value="webm">WebM</option>
                    </select>
                </div>
                <div className="setting-item">
                    <div className="setting-label-group">
                        <i className="material-icons">hd</i>
                        <label>Quality:</label>
                    </div>
                    <select value={localSettings.quality} onChange={(e) => handleChange('quality', e.target.value)}>
                        <option value="best">Best</option>
                        <option value="1080p">1080p</option>
                        <option value="720p">720p</option>
                        <option value="480p">480p</option>
                    </select>
                </div>
                <div className="setting-item">
                     <div className="setting-label-group">
                         <i className="material-icons">audiotrack</i>
                         <label>Audio Format:</label>
                     </div>
                     <select value={localSettings.audioFormat} onChange={(e) => handleChange('audioFormat', e.target.value)}>
                        <option value="mp3">MP3</option>
                        <option value="wav">WAV</option>
                        <option value="aac">AAC</option>
                     </select>
                </div>
                <div className="setting-item">
                    <div className="setting-label-group">
                        <i className="material-icons">grid_view</i>
                        <label>Concurrent Fragments:</label>
                    </div>
                    <input type="range" min="1" max="25" value={localSettings.concurrentFragments} onChange={(e) => handleChange('concurrentFragments', parseInt(e.target.value))} />
                    <span>{localSettings.concurrentFragments}</span>
                </div>
                <div className="setting-item">
                    <div className="setting-label-group">
                        <i className="material-icons">subtitles</i>
                        <label>Embed Subtitles:</label>
                    </div>
                    <Checkbox checked={localSettings.embedSubs} onChange={(val) => handleChange('embedSubs', val)} id="embedSubs" />
                </div>
                <div className="setting-item">
                    <div className="setting-label-group">
                        <i className="material-icons">code</i>
                        <label>Write Info JSON:</label>
                    </div>
                    <Checkbox checked={localSettings.writeInfoJson} onChange={(val) => handleChange('writeInfoJson', val)} id="writeInfoJson" />
                </div>
                <div className="setting-item">
                    <div className="setting-label-group">
                        <i className="material-icons">terminal</i>
                        <label>Show Console:</label>
                    </div>
                    <Checkbox checked={localSettings.showConsole} onChange={(val) => handleChange('showConsole', val)} id="showConsole" />
                </div>
            </div>

            {/* FOLDERS TAB */}
            <div className={`tab-content ${activeTab === 'folders' ? 'active' : ''}`}>
                 <div className="settings-group">
                    <h3 className="settings-group-title">Storage Locations</h3>
                    <div className="setting-item" style={{flexDirection: 'column', alignItems: 'flex-start'}}>
                        <div className="setting-label-group" style={{marginBottom: 8}}>
                            <i className="material-icons">music_note</i>
                            <label>Music Folder:</label>
                        </div>
                        <div className="folder-input-group" style={{display: 'flex', gap: 8, width: '100%'}}>
                             <button className="header-button" style={{padding: 8}} onClick={() => handleOpenFolder(localSettings.musicFolder)}>
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 6H6C4.89543 6 4 6.89543 4 8V18C4 19.1046 4.89543 20 6 20H18C19.1046 20 20 19.1046 20 18V10C20 8.89543 19.1046 8 18 8H14L12 6H10Z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                             </button>
                             <input type="text" readOnly value={localSettings.musicFolder} placeholder="Default Downloads" style={{flex: 1}} />
                             <button className="download-button" style={{padding: '0 16px', margin: 0, minWidth: 'auto'}} onClick={() => handleSelectFolder('music')}>Select</button>
                        </div>
                    </div>
                    <div className="setting-item" style={{flexDirection: 'column', alignItems: 'flex-start', marginTop: 16}}>
                        <div className="setting-label-group" style={{marginBottom: 8}}>
                            <i className="material-icons">videocam</i>
                            <label>Video Folder:</label>
                        </div>
                        <div className="folder-input-group" style={{display: 'flex', gap: 8, width: '100%'}}>
                             <button className="header-button" style={{padding: 8}} onClick={() => handleOpenFolder(localSettings.videoFolder)}>
                                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 6H6C4.89543 6 4 6.89543 4 8V18C4 19.1046 4.89543 20 6 20H18C19.1046 20 20 19.1046 20 18V10C20 8.89543 19.1046 8 18 8H14L12 6H10Z" strokeLinecap="round" strokeLinejoin="round"/></svg>
                             </button>
                             <input type="text" readOnly value={localSettings.videoFolder} placeholder="Default Downloads" style={{flex: 1}} />
                             <button className="download-button" style={{padding: '0 16px', margin: 0, minWidth: 'auto'}} onClick={() => handleSelectFolder('video')}>Select</button>
                        </div>
                    </div>
                 </div>
                 
                 <hr style={{margin: '20px 0', border: 0, borderTop: '1px solid rgba(255, 255, 255, 0.1)'}} />

                 <div className="settings-group">
                    <h3 className="settings-group-title">Naming Models</h3>
                    <div className="setting-item">
                        <label>Video Filename Model:</label>
                        <input type="text" value={localSettings.videoFileNameModel} onChange={(e) => handleChange('videoFileNameModel', e.target.value)} placeholder="%(title)s" />
                    </div>
                    <div className="setting-item">
                        <label>Music Filename Model:</label>
                        <input type="text" value={localSettings.musicFileNameModel} onChange={(e) => handleChange('musicFileNameModel', e.target.value)} placeholder="%(title)s" />
                    </div>
                    <div className="setting-item">
                        <label>Restrict Filenames:</label>
                        <Checkbox checked={localSettings.restrictFileName} onChange={(val) => handleChange('restrictFileName', val)} id="restrictFileName" />
                    </div>
                 </div>

                 <hr style={{margin: '20px 0', border: 0, borderTop: '1px solid rgba(255, 255, 255, 0.1)'}} />

                 <div className="settings-group">
                    <h3 className="settings-group-title">Processing & Maintenance</h3>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">cached</i>
                            <label>Cache Downloads First:</label>
                        </div>
                        <Checkbox checked={localSettings.cacheDownloadsFirst} onChange={(val) => handleChange('cacheDownloadsFirst', val)} id="cacheDownloadsFirst" />
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">layers_clear</i>
                            <label>No Fragments:</label>
                        </div>
                        <Checkbox checked={localSettings.noFragments} onChange={(val) => handleChange('noFragments', val)} id="noFragments" />
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">layers</i>
                            <label>Keep Fragments:</label>
                        </div>
                        <Checkbox checked={localSettings.keepFragments} onChange={(val) => handleChange('keepFragments', val)} id="keepFragments" />
                    </div>
                    <div style={{marginTop: 24, display: 'flex', gap: 12, flexWrap: 'wrap'}}>
                         <button className="download-button" style={{flex: 1, minWidth: 180}} onClick={() => {if(confirm("Move temp files?")) window.electronAPI.moveTempFilesToDownloads()}}>Move Temp Files</button>
                         <button className="download-button" style={{flex: 1, minWidth: 180, background: 'rgba(220, 53, 69, 0.1)', borderColor: 'rgba(220, 53, 69, 0.2)', color: '#ff6b6b'}} onClick={() => {if(confirm("Delete temp files?")) window.electronAPI.cleanTempFiles()}}>Clean Temp Files</button>
                    </div>
                 </div>
            </div>

            {/* DOWNLOAD TAB */}
            <div className={`tab-content ${activeTab === 'download' ? 'active' : ''}`}>
                 <div className="settings-group">
                     <h3 className="settings-group-title">General</h3>
                     <div className="setting-item">
                         <div className="setting-label-group">
                             <i className="material-icons">visibility_off</i>
                             <label>Anonymous:</label>
                         </div>
                         <Checkbox checked={localSettings.anonymous} onChange={(val) => handleChange('anonymous', val)} id="anonymous" />
                     </div>
                     <div className="setting-item">
                         <div className="setting-label-group">
                             <i className="material-icons">smart_display</i>
                             <label>Show Download Card:</label>
                         </div>
                         <Checkbox checked={localSettings.showDownloadCard} onChange={(val) => handleChange('showDownloadCard', val)} id="showDownloadCard" />
                     </div>
                     <div className="setting-item">
                         <div className="setting-label-group">
                             <i className="material-icons">speed</i>
                             <label>Fast Download:</label>
                         </div>
                         <Checkbox checked={localSettings.fastDownload} onChange={(val) => handleChange('fastDownload', val)} id="fastDownload" />
                     </div>
                     <div className="setting-item">
                         <div className="setting-label-group">
                             <i className="material-icons">cookie</i>
                             <label>Use Cookies:</label>
                         </div>
                         <Checkbox checked={localSettings.useCookies} onChange={(val) => handleChange('useCookies', val)} id="useCookies" />
                     </div>
                 </div>
                 
                 <hr style={{margin: '20px 0', border: 0, borderTop: '1px solid rgba(255, 255, 255, 0.1)'}} />

                 <div className="settings-group">
                    <h3 className="settings-group-title">Connection & Proxy</h3>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">settings_ethernet</i>
                            <label>Proxy Socks5 URL:</label>
                        </div>
                        <input type="text" value={localSettings.proxy} onChange={(e) => handleChange('proxy', e.target.value)} placeholder="socks5://user:pass@host:port" />
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">network_check</i>
                            <label>Force IPV4:</label>
                        </div>
                        <Checkbox checked={localSettings.forceIpv4} onChange={(val) => handleChange('forceIpv4', val)} id="forceIpv4" />
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">rocket_launch</i>
                            <label>Use aria2:</label>
                        </div>
                        <Checkbox checked={localSettings.useAria2} onChange={(val) => handleChange('useAria2', val)} id="useAria2" />
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">multiple_stop</i>
                            <label>Connection Limit:</label>
                        </div>
                        <input type="text" value={localSettings.connectionLimit} onChange={(e) => handleChange('connectionLimit', e.target.value)} placeholder="e.g. 5" />
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">memory</i>
                            <label>Buffer Size:</label>
                        </div>
                        <input type="text" value={localSettings.bufferSize} onChange={(e) => handleChange('bufferSize', e.target.value)} placeholder="e.g. 16K" />
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">timer</i>
                            <label>Socket Time Limit (s):</label>
                        </div>
                        <input type="text" value={localSettings.socketTimeout} onChange={(e) => handleChange('socketTimeout', e.target.value)} placeholder="30" />
                    </div>
                 </div>

                 <hr style={{margin: '20px 0', border: 0, borderTop: '1px solid rgba(255, 255, 255, 0.1)'}} />

                 <div className="settings-group">
                    <h3 className="settings-group-title">Download Behavior</h3>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">download_for_offline</i>
                            <label>Predefined Download Type:</label>
                        </div>
                        <select 
                            value={localSettings.preferredDownloadType} 
                            onChange={(e) => handleChange('preferredDownloadType', e.target.value)}
                        >
                            <option value="video">Video</option>
                            <option value="audio">Audio</option>
                            <option value="ask">Ask</option>
                        </select>
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">save</i>
                            <label>Remember Download Type:</label>
                        </div>
                        <Checkbox checked={localSettings.rememberDownloadType} onChange={(val) => handleChange('rememberDownloadType', val)} id="rememberDownloadType" />
                    </div>
                    <div className="setting-item">
                         <div className="setting-label-group">
                             <i className="material-icons">difference</i>
                             <label>Avoid Duplicated Downloads:</label>
                         </div>
                         <select 
                            value={localSettings.avoidDuplicatedDownloads} 
                            onChange={(e) => handleChange('avoidDuplicatedDownloads', e.target.value)}
                         >
                            <option value="none">None</option>
                            <option value="ask">Ask</option>
                            <option value="auto">Auto</option>
                         </select>
                    </div>
                    <div className="setting-item">
                         <div className="setting-label-group">
                             <i className="material-icons">cleaning_services</i>
                             <label>Clean Download Leftovers:</label>
                         </div>
                         <select 
                            value={localSettings.cleanDownloadLeftovers} 
                            onChange={(e) => handleChange('cleanDownloadLeftovers', e.target.value)}
                         >
                            <option value="none">None</option>
                            <option value="temp">Temporary</option>
                            <option value="all">All</option>
                         </select>
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">history</i>
                            <label>Download Registry:</label>
                        </div>
                        <Checkbox checked={localSettings.downloadRegistry} onChange={(val) => handleChange('downloadRegistry', val)} id="downloadRegistry" />
                    </div>
                 </div>

                 <hr style={{margin: '20px 0', border: 0, borderTop: '1px solid rgba(255, 255, 255, 0.1)'}} />

                 <div className="settings-group">
                    <h3 className="settings-group-title">Limits & Trials</h3>
                    <div className="setting-item">
                         <div className="setting-label-group">
                             <i className="material-icons">grid_view</i>
                             <label>Simultaneous Fragments:</label>
                         </div>
                         <input type="range" min="1" max="25" value={localSettings.concurrentFragments} onChange={(e) => handleChange('concurrentFragments', parseInt(e.target.value))} />
                         <span>{localSettings.concurrentFragments}</span>
                    </div>
                    <div className="setting-item">
                         <div className="setting-label-group">
                             <i className="material-icons">downloading</i>
                             <label>Simultaneous Downloads:</label>
                         </div>
                         <input type="range" min="1" max="10" value={localSettings.concurrentDownloads} onChange={(e) => handleChange('concurrentDownloads', parseInt(e.target.value))} />
                         <span>{localSettings.concurrentDownloads}</span>
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">refresh</i>
                            <label>New Trials (Retries):</label>
                        </div>
                        <input type="text" value={localSettings.retries} onChange={(e) => handleChange('retries', e.target.value)} placeholder="5" />
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">refresh</i>
                            <label>New Fragment Trials:</label>
                        </div>
                        <input type="text" value={localSettings.fragmentRetries} onChange={(e) => handleChange('fragmentRetries', e.target.value)} placeholder="5" />
                    </div>
                 </div>
            </div>

            {/* PROCESSING TAB */}
            <div className={`tab-content ${activeTab === 'processing' ? 'active' : ''}`}>
                 <div className="settings-group">
                    <h3 className="settings-group-title">General</h3>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">attach_money</i>
                            <label>Enable SponsorBlock:</label>
                        </div>
                        <Checkbox checked={localSettings.useSponsorBlock} onChange={(val) => handleChange('useSponsorBlock', val)} id="useSponsorBlock" />
                    </div>
                    {localSettings.useSponsorBlock && (
                        <div className="setting-item">
                            <div className="setting-label-group">
                                <i className="material-icons">api</i>
                                <label>SponsorBlock API URL:</label>
                            </div>
                            <input type="text" value={localSettings.sponsorBlockApiUrl} onChange={(e) => handleChange('sponsorBlockApiUrl', e.target.value)} placeholder="https://sponsor.ajay.app" />
                        </div>
                    )}
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">history</i>
                            <label>Enable If-Modified-Since:</label>
                        </div>
                        <Checkbox checked={localSettings.enableIfModifiedSince} onChange={(val) => handleChange('enableIfModifiedSince', val)} id="enableIfModifiedSince" />
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">description</i>
                            <label>Save description:</label>
                        </div>
                        <Checkbox checked={localSettings.writeDescription} onChange={(val) => handleChange('writeDescription', val)} id="writeDescription" />
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">terminal</i>
                            <label>Add extra commands:</label>
                        </div>
                        <Checkbox checked={localSettings.addExtraCommands} onChange={(val) => handleChange('addExtraCommands', val)} id="addExtraCommands" />
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">content_cut</i>
                            <label>Force keyframes on cuts:</label>
                        </div>
                        <Checkbox checked={localSettings.forceKeyframesOnCuts} onChange={(val) => handleChange('forceKeyframesOnCuts', val)} id="forceKeyframesOnCuts" />
                    </div>
                 </div>

                 <hr style={{margin: '20px 0', border: 0, borderTop: '1px solid rgba(255, 255, 255, 0.1)'}} />

                 <div className="settings-group">
                    <h3 className="settings-group-title">Audio</h3>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">branding_watermark</i>
                            <label>Include metadata:</label>
                        </div>
                        <Checkbox checked={localSettings.includeMetadata} onChange={(val) => handleChange('includeMetadata', val)} id="includeMetadata" />
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">image</i>
                            <label>Include thumbnail:</label>
                        </div>
                        <Checkbox checked={localSettings.writeThumbnail} onChange={(val) => handleChange('writeThumbnail', val)} id="writeThumbnail" />
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">content_cut</i>
                            <label>Crop thumbnail:</label>
                        </div>
                        <Checkbox checked={localSettings.cropThumbnail} onChange={(val) => handleChange('cropThumbnail', val)} id="cropThumbnail" />
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">album</i>
                            <label>Use playlist name as album metadata:</label>
                        </div>
                        <Checkbox checked={localSettings.usePlaylistNameAsAlbum} onChange={(val) => handleChange('usePlaylistNameAsAlbum', val)} id="usePlaylistNameAsAlbum" />
                    </div>
                 </div>

                 <hr style={{margin: '20px 0', border: 0, borderTop: '1px solid rgba(255, 255, 255, 0.1)'}} />

                 <div className="settings-group">
                    <h3 className="settings-group-title">Video</h3>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">subtitles</i>
                            <label>Include subtitles:</label>
                        </div>
                        <Checkbox checked={localSettings.includeSubtitles} onChange={(val) => handleChange('includeSubtitles', val)} id="includeSubtitles" />
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">save</i>
                            <label>Save subtitles:</label>
                        </div>
                        <Checkbox checked={localSettings.saveSubtitles} onChange={(val) => handleChange('saveSubtitles', val)} id="saveSubtitles" />
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">closed_caption</i>
                            <label>Save automatic subtitles:</label>
                        </div>
                        <Checkbox checked={localSettings.saveAutoSubtitles} onChange={(val) => handleChange('saveAutoSubtitles', val)} id="saveAutoSubtitles" />
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">translate</i>
                            <label>Subtitle language:</label>
                        </div>
                        <input type="text" value={localSettings.subtitleLanguage} onChange={(e) => handleChange('subtitleLanguage', e.target.value)} />
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">format_align_left</i>
                            <label>Subtitle format:</label>
                        </div>
                        <select value={localSettings.subtitleFormat} onChange={(e) => handleChange('subtitleFormat', e.target.value)}>
                            <option value="srt">SRT</option>
                            <option value="vtt">VTT</option>
                            <option value="ass">ASS/SSA</option>
                        </select>
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">image</i>
                            <label>Thumbnail format:</label>
                        </div>
                        <select value={localSettings.thumbnailFormat} onChange={(e) => handleChange('thumbnailFormat', e.target.value)}>
                            <option value="jpg">JPG</option>
                            <option value="png">PNG</option>
                            <option value="webp">WebP</option>
                        </select>
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">view_list</i>
                            <label>Chapters in videos:</label>
                        </div>
                        <Checkbox checked={localSettings.chaptersInVideo} onChange={(val) => handleChange('chaptersInVideo', val)} id="chaptersInVideo" />
                    </div>
                 </div>

                 <hr style={{margin: '20px 0', border: 0, borderTop: '1px solid rgba(255, 255, 255, 0.1)'}} />

                 <div className="settings-group">
                    <h3 className="settings-group-title">Format</h3>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">audiotrack</i>
                            <label>Audio format:</label>
                        </div>
                        <select value={localSettings.audioFormat} onChange={(e) => handleChange('audioFormat', e.target.value)}>
                            <option value="mp3">MP3</option>
                            <option value="m4a">M4A</option>
                            <option value="opus">Opus</option>
                            <option value="wav">WAV</option>
                            <option value="flac">FLAC</option>
                        </select>
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">movie</i>
                            <label>Video format:</label>
                        </div>
                        <select value={localSettings.outputFormat} onChange={(e) => handleChange('outputFormat', e.target.value)}>
                            <option value="mp4">MP4</option>
                            <option value="mkv">MKV</option>
                            <option value="webm">WebM</option>
                        </select>
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">transform</i>
                            <label>Recode video:</label>
                        </div>
                        <Checkbox checked={localSettings.recodingVideo} onChange={(val) => handleChange('recodingVideo', val)} id="recodingVideo" />
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">code</i>
                            <label>Preferred video codec:</label>
                        </div>
                        <select value={localSettings.preferredVideoCodec} onChange={(e) => handleChange('preferredVideoCodec', e.target.value)}>
                            <option value="H264 (avc1)">H264 (avc1)</option>
                            <option value="H265 (hevc)">H265 (hevc)</option>
                            <option value="VP9">VP9</option>
                            <option value="AV1">AV1</option>
                        </select>
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">code</i>
                            <label>Preferred audio codec:</label>
                        </div>
                        <select value={localSettings.preferredAudioCodec} onChange={(e) => handleChange('preferredAudioCodec', e.target.value)}>
                            <option value="aac">AAC</option>
                            <option value="mp3">MP3</option>
                            <option value="opus">Opus</option>
                            <option value="vorbis">Vorbis</option>
                        </select>
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">speed</i>
                            <label>Preferred audio bitrate:</label>
                        </div>
                        <select value={localSettings.preferredAudioBitrate} onChange={(e) => handleChange('preferredAudioBitrate', e.target.value)}>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                        </select>
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">music_note</i>
                            <label>Use custom audio quality:</label>
                        </div>
                        <Checkbox checked={localSettings.useCustomAudioQuality} onChange={(val) => handleChange('useCustomAudioQuality', val)} id="useCustomAudioQuality" />
                    </div>
                    {localSettings.useCustomAudioQuality && (
                        <div className="setting-item">
                            <div className="setting-label-group" style={{flex: 1}}>
                                <i className="material-icons">hdr_strong</i>
                                <label>Audio quality (0-9):</label>
                            </div>
                            <input type="range" min="0" max="9" value={localSettings.audioQuality} onChange={(e) => handleChange('audioQuality', e.target.value)} />
                            <span>{localSettings.audioQuality}</span>
                        </div>
                    )}
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">hd</i>
                            <label>Video quality:</label>
                        </div>
                        <select value={localSettings.quality} onChange={(e) => handleChange('quality', e.target.value)}>
                            <option value="best">Best quality</option>
                            <option value="1080p">1080p</option>
                            <option value="720p">720p</option>
                            <option value="480p">480p</option>
                            <option value="360p">360p</option>
                        </select>
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">edit</i>
                            <label>Preferred format ID [Video]:</label>
                        </div>
                        <input type="text" value={localSettings.videoFormatId} onChange={(e) => handleChange('videoFormatId', e.target.value)} placeholder="e.g. 137+140" />
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">edit</i>
                            <label>Preferred format ID [Audio]:</label>
                        </div>
                        <input type="text" value={localSettings.audioFormatId} onChange={(e) => handleChange('audioFormatId', e.target.value)} placeholder="e.g. 140" />
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">compress</i>
                            <label>Prefer smaller formats:</label>
                        </div>
                        <Checkbox checked={localSettings.preferSmallFormats} onChange={(val) => handleChange('preferSmallFormats', val)} id="preferSmallFormats" />
                    </div>
                    <div className="setting-item" style={{flexDirection: 'column', alignItems: 'flex-start'}}>
                        <div className="setting-label-group" style={{marginBottom: 8}}>
                             <i className="material-icons">reorder</i>
                             <label>Preferred format order [Audio]:</label>
                        </div>
                        <textarea 
                            style={{width: '100%', minHeight: 80, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 8, color: '#fff', fontSize: 12}}
                            value={localSettings.audioFormatOrder} 
                            onChange={(e) => handleChange('audioFormatOrder', e.target.value)}
                        />
                    </div>
                    <div className="setting-item" style={{flexDirection: 'column', alignItems: 'flex-start', marginTop: 12}}>
                        <div className="setting-label-group" style={{marginBottom: 8}}>
                             <i className="material-icons">reorder</i>
                             <label>Preferred format order [Video]:</label>
                        </div>
                        <textarea 
                            style={{width: '100%', minHeight: 100, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: 8, color: '#fff', fontSize: 12}}
                            value={localSettings.videoFormatOrder} 
                            onChange={(e) => handleChange('videoFormatOrder', e.target.value)}
                        />
                    </div>
                 </div>
            </div>

            {/* UPDATE TAB */}
            <div className={`tab-content ${activeTab === 'update' ? 'active' : ''}`}>
                 <p style={{padding: 20, color: '#888'}}>Update settings coming soon...</p>
            </div>

            {/* ADVANCED TAB */}
            <div className={`tab-content ${activeTab === 'advanced' ? 'active' : ''}`}>
                <div className="settings-group">
                    <h3 className="settings-group-title">YouTube</h3>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">code</i>
                            <label>Player Client:</label>
                        </div>
                        <input type="text" value={localSettings.ytPlayerClient} onChange={(e) => handleChange('ytPlayerClient', e.target.value)} placeholder="default,mediaconnect" />
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">vpn_key</i>
                            <label>PO Token [Web]:</label>
                        </div>
                        <input type="text" value={localSettings.poToken} onChange={(e) => handleChange('poToken', e.target.value)} placeholder="Not defined" />
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">terminal</i>
                            <label>Other YouTube Extractor arguments:</label>
                        </div>
                        <input type="text" value={localSettings.extraExtractorArgs} onChange={(e) => handleChange('extraExtractorArgs', e.target.value)} placeholder="Not defined" />
                    </div>
                </div>

                <hr style={{margin: '20px 0', border: 0, borderTop: '1px solid rgba(255, 255, 255, 0.1)'}} />

                <div className="settings-group">
                    <h3 className="settings-group-title">Command Templates</h3>
                    <div className="setting-item" style={{flexDirection: 'column', alignItems: 'flex-start'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center'}}>
                            <div className="setting-label-group">
                                <i className="material-icons">terminal</i>
                                <label>Extra command for data search:</label>
                            </div>
                            <Checkbox checked={localSettings.extraCommandForDataSearch} onChange={(val) => handleChange('extraCommandForDataSearch', val)} id="extraCommandForDataSearch" />
                        </div>
                        <p style={{fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4, marginLeft: 30}}>
                            Allow command templates to be used for data search from extra commands
                        </p>
                    </div>
                </div>

                <hr style={{margin: '20px 0', border: 0, borderTop: '1px solid rgba(255, 255, 255, 0.1)'}} />

                <div className="settings-group">
                    <h3 className="settings-group-title">Downloading</h3>
                    <div className="setting-item" style={{flexDirection: 'column', alignItems: 'flex-start'}}>
                        <div style={{display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center'}}>
                            <div className="setting-label-group">
                                <i className="material-icons">edit</i>
                                <label>Disable Write Info Json:</label>
                            </div>
                            <Checkbox checked={localSettings.disableWriteInfoJson} onChange={(val) => handleChange('disableWriteInfoJson', val)} id="disableWriteInfoJson" />
                        </div>
                        <p style={{fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 4, marginLeft: 30}}>
                            (Not Recommended) Every time you restart / resume the download, yt-dlp will re-download json data from the servers.
                        </p>
                    </div>
                </div>

                <hr style={{margin: '20px 0', border: 0, borderTop: '1px solid rgba(255, 255, 255, 0.1)'}} />

                <div className="settings-group">
                    <h3 className="settings-group-title">Other</h3>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">browser_updated</i>
                            <label>User Agent:</label>
                        </div>
                        <input type="text" value={localSettings.userAgent} onChange={(e) => handleChange('userAgent', e.target.value)} />
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">link</i>
                            <label>Referer:</label>
                        </div>
                        <input type="text" value={localSettings.referer} onChange={(e) => handleChange('referer', e.target.value)} />
                    </div>
                    <div className="setting-item">
                        <div className="setting-label-group">
                            <i className="material-icons">title</i>
                            <label>Filename Template:</label>
                        </div>
                        <input type="text" value={localSettings.fileNameTemplate} onChange={(e) => handleChange('fileNameTemplate', e.target.value)} placeholder="%(title)s" />
                    </div>
                </div>
            </div>
        </div>
        
        <div className="modal-footer">
          <button id="saveSettingsBtn" onClick={handleSave}>Save</button>
          <button id="cancelSettingsBtn" onClick={onClose}>Cancel</button>
          <button id="resetSettingsBtn" onClick={handleReset}>Reset to Default</button>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
