<h1 align="center">
	<img src="assets/logo_2048x2048.png" width="25%" /><br>
	YTDLN-OPEN
</h1>

<div align="center">
	English
	&nbsp;&nbsp;| &nbsp;&nbsp;
	<a href="https://github.com/GDKAYKY/ytdln-open/blob/main/README-es.md">Español</a>
	&nbsp;&nbsp;| &nbsp;&nbsp;
	<a href="https://github.com/GDKAYKY/ytdln-open/blob/main/README-fr.md">Français</a>
	&nbsp;&nbsp;| &nbsp;&nbsp;
	<a href="https://github.com/GDKAYKY/ytdln-open/blob/main/README-de.md">Deutsch</a>
	&nbsp;&nbsp;| &nbsp;&nbsp;
	<a href="https://github.com/GDKAYKY/ytdln-open/blob/main/README-ja.md">日本語</a>
	&nbsp;&nbsp;| &nbsp;&nbsp;
	<a href="https://github.com/GDKAYKY/ytdln-open/blob/main/README-zh.md">中文</a>
	&nbsp;&nbsp;| &nbsp;&nbsp;
	<a href="https://github.com/GDKAYKY/ytdln-open/blob/main/README-ru.md">Русский</a>
	&nbsp;&nbsp;| &nbsp;&nbsp;
	<a href="https://github.com/GDKAYKY/ytdln-open/blob/main/README-pt.md">Português</a>
</div>

<h3 align="center">
	YTDLN-OPEN is a free and open source desktop video/audio downloader using yt-dlp for Windows, macOS, and Linux.
</h3>
<h4 align="center">
	Created by GDKAYKY
</h4>

<div align="center">

[![GitHub Releases](https://custom-icon-badges.herokuapp.com/badge/Download-blue?style=for-the-badge&logo=download&logoColor=white)](https://github.com/GDKAYKY/ytdln-open/releases/latest)
[![GitHub](https://custom-icon-badges.herokuapp.com/badge/GitHub-black?style=for-the-badge&logo=github&logoColor=white)](https://github.com/GDKAYKY/ytdln-open)

[![Latest release](https://img.shields.io/github/release/GDKAYKY/ytdln-open.svg?maxAge=3600&include_prereleases&label=latest)](https://github.com/GDKAYKY/ytdln-open/releases) 
[![Downloads](https://img.shields.io/github/downloads/GDKAYKY/ytdln-open/total?style=flat-square)](https://github.com/GDKAYKY/ytdln-open/releases) 
[![License](https://img.shields.io/github/license/GDKAYKY/ytdln-open?style=flat-square)](https://github.com/GDKAYKY/ytdln-open/blob/main/LICENSE)

### Only the links above are the only trusted sources of YTDLN-OPEN. Everything else is not related to us.

</div>

## 🔧 Technologies Used

- **Electron**: Cross-platform desktop application framework
- **yt-dlp**: Core video downloading engine with extensive site support
- **aria2c**: High-speed download accelerator with multi-connection support
- **ffmpeg**: Advanced video processing and format conversion
- **Node.js**: Backend runtime environment
- **HTML/CSS/JavaScript**: Frontend interface

## 💡 Features:

- Download audio/video files from more than <a href="https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md">1000 websites</a>
- **Accelerated Downloads**: Utilize `aria2c` for faster and more efficient downloads with multi-connection transfers
- **Advanced Video Processing**: Built-in `ffmpeg` support for format conversion and video manipulation
- **Cross-Platform**: Native desktop application for Windows, macOS, and Linux
- **User-Friendly Interface**: Clean and intuitive Electron-based GUI
- **Batch Downloads**: Download multiple videos simultaneously
- **Playlist Support**: Download entire playlists with custom settings
- **Format Selection**: Choose from various audio and video formats
- **Quality Selection**: Select different quality options for downloads
- **Custom Output Paths**: Organize your downloads with custom folder structures
- **Download History**: Keep track of your downloaded content
- **Resume Downloads**: Resume interrupted downloads automatically
- **Proxy Support**: Download through proxy servers for enhanced privacy
- **Subtitle Downloads**: Download subtitles along with videos
- **Metadata Preservation**: Keep original video metadata and thumbnails
- **Custom Commands**: Use advanced yt-dlp options and custom commands
- **Dark/Light Theme**: Modern theming options for better user experience
- **Auto-Updates**: Automatic application updates for the latest features
- **Free & Open Source**: Completely free with transparent development

## 🚀 Installation

### Download from Releases
1. Go to the [Releases page](https://github.com/GDKAYKY/ytdln-open/releases/latest)
2. Download the installer for your operating system:
   - **Windows**: `YTDLN-OPEN-Setup-x.x.x.exe`
   - **macOS**: `YTDLN-OPEN-x.x.x.dmg`
   - **Linux**: `YTDLN-OPEN-x.x.x.AppImage`

### Alternatively you can run from Source
```bash
# Clone the repository
git clone https://github.com/GDKAYKY/ytdln-open.git
cd ytdln-open

# Install dependencies
npm install

# Run the application
npm start
```

## 📄 License

[GNU GPL v3.0](https://github.com/GDKAYKY/ytdln-open/blob/main/LICENSE)

Except for the source code licensed under the GPLv3 license, all other parties are prohibited from using the "YTDLN-OPEN" name as a downloader app, and the same is true for its derivatives. Derivatives include but are not limited to forks and unofficial builds.

## 🙏 Thanks

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) and its contributors for making this tool possible. Without it this app wouldn't exist
- [aria2](https://github.com/aria2/aria2) for providing fast and reliable download capabilities
- [ffmpeg](https://ffmpeg.org/) for comprehensive multimedia processing
- [Electron](https://www.electronjs.org/) for enabling cross-platform desktop development
- All contributors and community members who help improve this project

## 🔗 Related Projects

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) - The core downloading engine
- [aria2](https://github.com/aria2/aria2) - Multi-connection download accelerator
- [ffmpeg](https://ffmpeg.org/) - Multimedia framework