import React, { createContext, useState, useContext, useEffect } from 'react';

const defaultSettings = {
  // Basics
  outputFormat: "mp4",
  quality: "best",
  audioFormat: "mp3",
  concurrentFragments: 8,
  embedSubs: false,
  writeInfoJson: false,

  // Advanced
  userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  referer: "https://www.youtube.com/",
  socketTimeout: 30,
  retries: 5,
  fragmentRetries: 5,
  extractorRetries: 3,
  noCheckCertificate: true,
  ignoreErrors: true,
  writeThumbnail: true,
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
  musicFolder: "",
  videoFolder: "",
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
  audioFormatOrder: "1. Preferred format ID\n2. Language\n3. Codec\n4. Container",
  videoFormatOrder: "1. Preferred format ID\n2. Video quality\n3. Codec\n4. Video without audio\n5. Container",

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

const SettingsContext = createContext();

export const useSettings = () => useContext(SettingsContext);

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(defaultSettings);

  useEffect(() => {
    // Load settings from localStorage
    const saved = localStorage.getItem("ytdln-settings");
    if (saved) {
      try {
          const parsed = JSON.parse(saved);
          setSettings(prev => ({ ...prev, ...parsed }));
      } catch (e) {
          console.error("Failed to parse settings", e);
      }
    }
  }, []);

  const updateSettings = (newSettings) => {
    setSettings(prev => {
        const updated = { ...prev, ...newSettings };
        localStorage.setItem("ytdln-settings", JSON.stringify(updated));
        return updated;
    });
  };

  const resetSettings = () => {
      setSettings(defaultSettings);
      localStorage.setItem("ytdln-settings", JSON.stringify(defaultSettings));
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, resetSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};
