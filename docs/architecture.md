# Project Architecture: Electron Desktop Application

This document outlines the technical architecture for the desktop application.

## 1. High-Level Diagram

The application is built using the Electron framework. This architecture separates the application's User Interface (Renderer Process) from its backend logic (Main Process).

```
+-----------------------------------------------------------------+
|                   Your Desktop Application                      |
|                                                                 |
|  +------------------------------+      IPC      +-------------+ |
|  |      Renderer Process        | <-----------> |    Main     | |
|  | (A Chromium Browser Window)  |   (Bridge)    |   Process   | |
|  |                              |               |  (Node.js)  | |
|  | - Your App's UI              |               |             | |
|  | - index.html, style.css      |               | - Has full  | |
|  | - renderer.js                |               |   OS access | |
|  | - User clicks "Download"     |               |             | |
|  +------------------------------+               +-------------+ |
|                                                       |         |
|                                                       | spawn() |
|                                                       |         |
|                                            +--------------------+ 
|                                            |  yt-dlp / aria2c   |
|                                            | (Child Processes)  |
|                                            +--------------------+ 
+-----------------------------------------------------------------+
```

## 2. Low-Level Programming Flow

Here is the step-by-step flow of how this works at a programming level.

### a. The User Interface (Renderer Process)

- This is the window the user sees (`index.html`). It is controlled by a JavaScript file (`renderer.js`).
- When a user clicks a "Download" button, the `renderer.js` script sends a message and the video URL to the Main Process using Electron's `ipcRenderer.send()` function.

### b. The Backend (Main Process)

- This is a Node.js script (`main.js`) with full access to the computer's operating system. It is **not sandboxed**.
- It listens for messages from the UI using `ipcMain.on()`.
- When it receives a download message, it uses Node.js's built-in `child_process.spawn()` function to execute `yt-dlp` as a new child process. This is the key step that was impossible in a browser extension.

### c. Getting Progress (Child Process -> Main Process)

- The `yt-dlp` command runs on the computer and prints progress updates to its standard output (`stdout`).
- The `main.js` script listens to this `stdout` in real-time, reading the progress updates as they happen.

### d. Displaying Progress (Main Process -> Renderer Process)

- As the Main Process reads the progress from `yt-dlp`, it sends the data back to the UI window using `mainWindow.webContents.send()`.
- The `renderer.js` script receives these messages and updates the UI in real-time (e.g., filling a progress bar).

This architecture provides the full power of native command-line tools while still allowing the UI to be built with standard web technologies.

## 3. Technology Stack

### Core Framework
*   **Electron**

### Programming Languages
*   **JavaScript**
*   **HTML**
*   **CSS**

### Key Projects & Libraries
*   **Node.js**
*   **electron-builder** or **electron-forge** (for packaging the final app)

### External Command-Line Tools (The "Engine")
*   **yt-dlp**
*   **aria2c**
*   **ffmpeg**
