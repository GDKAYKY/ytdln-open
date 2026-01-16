module.exports = {
  packagerConfig: {
    win32metadata: {
      CompanyName: "YTDLN-OPEN",
      ProductName: "YTDLN-OPEN",
      FileDescription: "Desktop video/audio downloader using yt-dlp",
      OriginalFilename: "ytdln-open.exe",
      InternalName: "ytdln-open",
      LegalCopyright: "Copyright © 2025 YTDLN-OPEN Team",
    },
    executableName: "ytdln-open",
    icon: "./assets/app_icon.ico",
  },
  rebuildConfig: {},
  makers: [
    {
      name: "electron-forge-maker-nsis",
      platforms: ["win32"],
      config: {
        installerIcon: "./assets/app_icon.ico",
        uninstallerIcon: "./assets/app_icon.ico",
        installerHeaderIcon: "./assets/app_icon.ico",
      },
    },
  ],
  publishers: [
    {
      name: "@electron-forge/publisher-github",
      config: {
        repository: {
          owner: "GDKAYKY",
          name: "ytdln-open",
        },
        prerelease: true,
      },
    },
  ],
};
