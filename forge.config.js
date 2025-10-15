module.exports = {
  packagerConfig: {
    // Remove console window
    win32metadata: {
      CompanyName: 'YTDLN-OPEN',
      ProductName: 'YTDLN-OPEN',
      FileDescription: 'Desktop video/audio downloader using yt-dlp',
      OriginalFilename: 'ytdln-open.exe',
      InternalName: 'ytdln-open',
      LegalCopyright: 'Copyright © 2025 YTDLN-OPEN Team'
    },
    // Hide console window
    executableName: 'ytdln-open',
    icon: './assets/logo_2048x2048.png'
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@felixrieseberg/electron-forge-maker-nsis',
      config: {
        name: 'YTDLN-OPEN',
        manufacturer: 'YTDLN-OPEN Team',
        exe: 'ytdln-open',
        description: 'Desktop video/audio downloader using yt-dlp',
        version: '1.0.0',
        language: 1033,
        oneClick: false,
        perMachine: false,
        allowToChangeInstallationDirectory: true,
        createDesktopShortcut: true,
        createStartMenuShortcut: true,
        shortcutName: 'YTDLN-OPEN',
        uninstallDisplayName: 'YTDLN-OPEN',
        installerIcon: './assets/logo.ico',
        uninstallerIcon: './assets/logo.ico'
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'GDKAYKY',
          name: 'ytdln-open'
        },
        prerelease: true
      }
    }
  ]
};