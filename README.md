# Discord Quest Completer

A lightweight Windows desktop application designed to complete Discord Quests without installing massive game files, high-demand graphics, or intrusive anti-cheat software. Includes an **automated sequential quest queue** with user-defined timers that automatically opens, runs, and closes game windows one by one.

---

## ✨ Features

- **🌙 Playnight Generator**: Automatically generates a randomized batch of games with random durations within your user-defined total time (e.g. 5 random games across 1 hour 30 mins). Supports exact random time partitioning or Quest-Safe mode (~15-18m each with natural jitter).
- **Automated Quest Queue**: Queue up multiple games to complete multiple quests in sequence. The app launches each game window, counts down your chosen duration, automatically closes the window, and launches the next game.
- **Custom & Per-Game Timers**: Set custom durations in minutes or seconds globally or per individual game in the queue. Includes quick presets (1m, 5m, 10m, 15m, 30m).
- **Instant, Zero-Freeze Search**: High-performance indexer scans 20,000+ Discord verified games in under 3ms with zero input stutter or lag.
- **Single Game Auto-Close**: Run individual games directly from search with an optional auto-close timer.
- **Audible Completion Chimes**: Plays a gentle audio notification whenever a quest window finishes and when the full queue is complete.
- **Zero Storage Burden**: Generates tiny dummy executables (~130 KB - 250 KB) that Discord detects as verified games, saving tens of gigabytes of disk space and bandwidth.
- **Discord Verified Game Library**: Searches and filters through Discord's officially detectable game database.
- **Persistent State**: Queued games, timer settings, and custom durations are automatically preserved in local storage.

---

## 🚀 How It Works

Discord's quest detection monitors the process table for specific registered executable names and directory signatures. 

This application generates minimal dummy executable binaries that match those exact process names and directory structures. When launched:
1. Discord detects the dummy process as the verified game and starts tracking quest progress (usually requiring 15 minutes of activity).
2. The queue timer runs down in the background.
3. Upon timer completion, the process is cleanly terminated, and the next queued game window launches automatically.

---

## 📥 Installation & Running

### Using the Portable Release (Recommended)

1. Download the latest `discord-quest-completer-win64.zip` from the [Releases](https://github.com) section.
2. Extract the `.zip` archive into a folder where you have read/write permissions (e.g., your Desktop or user directory).
3. Ensure `WebView2Loader.dll` remains in the same folder as `discord-quest-completer.exe`.
4. Double-click **`discord-quest-completer.exe`** to start.

> [!NOTE]
> Microsoft Edge WebView2 runtime is required. It comes pre-installed on Windows 11 and modern Windows 10 updates. If missing, download it from [Microsoft's WebView2 page](https://developer.microsoft.com/en-us/microsoft-edge/webview2).

### Folder Structure

```text
discord-quest-completer/
├── discord-quest-completer.exe  # Main application
├── WebView2Loader.dll           # WebView2 runtime loader
├── data/
│   └── src-win.exe              # Minimal dummy game runner binary
└── games/                       # Generated dummy game executables
```

---

## 📖 How to Use the Queue

1. **Search for a Game**: Type the quest game's name in the search bar on the Home tab (instant search across 20,000+ games).
2. **Add to Queue**: Click the **`+ Queue`** button on the game card or executable list.
3. **Configure Duration**:
   - Go to the **Queue** tab.
   - Adjust the time for each item using presets (`1m`, `5m`, `15m`) or enter custom minutes and seconds.
4. **Start the Queue**: Click **Start Queue**.
5. **Sit Back**: The app will sequentially launch each window, wait for the timer to elapse, close the process, and proceed to the next item automatically.

---

## 🌙 How to Use the Playnight Generator

1. Click the **`🌙 Playnight`** button in the header, home screen, or queue toolbar.
2. Set your **Amount of Random Games** (e.g. 5 games).
3. Set your **Total Night Duration** (e.g. 1 hr 30 min).
4. Select your distribution style:
   - **Random Slice**: Partitions the total time randomly across the games, summing exactly to your chosen total.
   - **Quest Optimal**: Gives each game ~15-18 minutes with random jitter to safely guarantee 15m Discord quest requirements.
5. Click **"🎲 Re-roll / Shuffle"** to preview different combinations of games and times.
6. Click **"🚀 Start Playnight Now"** or **"+ Add to Queue"**.

---

## 🛠️ Building from Source

### Prerequisites

- [Rust](https://rustup.rs/) (1.75+ with either MSVC or GNU toolchain)
- [Node.js](https://nodejs.org/) (v20+)
- [pnpm](https://pnpm.io/) or `npm`

### Setup & Compilation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/TanvirRahi03/discord-quest-completer.git
   cd discord-quest-completer
   ```

2. **Install frontend dependencies**:
   ```bash
   npm install
   ```

3. **Build the runner binary**:
   ```bash
   npm run build:runner:win
   npm run copy:runner:win
   ```

4. **Run in development mode**:
   ```bash
   npx tauri dev
   ```

5. **Compile the release executable**:
   ```bash
   npm run build
   npx tauri build --no-bundle
   ```
   The compiled executable will be located in `src-tauri/target/release/discord-quest-completer.exe`.

---

## 🧹 Maintenance & Uninstallation

To remove the application:
1. Delete the folder where you extracted the app.
2. The generated dummy executable files stored under `games/` are self-contained and deleted along with the app folder.

---

## ⚠️ Disclaimer

This tool is intended for educational and personal use only. Please respect Discord's Terms of Service, partners, game publishers, and advertisers. The authors and contributors are not responsible for any account actions or damages resulting from the use of this software.

Discord is a registered trademark of Discord Inc. This project is not affiliated with, sponsored by, or endorsed by Discord Inc.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
