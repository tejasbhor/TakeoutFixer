# TakeoutFixer 📸

**Restore your memories. Fix your metadata. Sync your life.**

TakeoutFixer is a high-performance, cross-platform desktop application designed to repair and organize photo/video archives exported from Google Takeout. It intelligently matches JSON sidecars with their original media files, restores missing EXIF metadata, and reorganizes your library into a clean, searchable structure.

---

## ✨ Key Features

- **🚀 8-Stage High-Performance Pipeline**: Built in Rust for maximum speed and memory safety.
- **🔍 Metadata Matching**: Automatically reconnects Google's detached JSON metadata with images and videos.
- **🛠️ EXIF Restoration**: Injects original timestamps (Created Date), GPS coordinates, and descriptions directly into file headers.
- **📂 Smart Reorganization**: Choose between Flat, Date-based (YYYY/MM), or Album-based folder structures.
- **💡 Scan & Preview Mode**: Analyze your library health without modifying a single file on disk.
- **🛡️ Integrity Checks**: Detects corrupt segments and missing archive parts before you start.
- **🎨 Premium UI**: Modern, responsive design with fluent animations, dark mode, and multi-platform aesthetics.

---

## 💻 Supported Platforms

TakeoutFixer is natively compiled for:
- **Windows**: Built-in Mica effects and Long Path support.
- **macOS**: Native Silicon (M1/M2/M3) and Intel support with Apple Vibrancy.
- **Linux**: Universal AppImage and Debian packages.

---

## 🛠️ Installation & Setup

### For Users
1. Download the latest release for your OS from the [Releases](https://github.com/tejasbhor/TakeoutFixer/releases) page.
2. **Windows**: Run the `.exe` installer.
3. **macOS**: Drag the `.app` to your Applications folder.
4. **Linux**: Give the `.AppImage` execution permissions or install the `.deb`.

### For Developers
**Prerequisites:**
- [Node.js](https://nodejs.org/) (LTS)
- [Rust](https://rustup.rs/) (Stable)
- [Tauri Dependencies](https://tauri.app/v1/guides/getting-started/prerequisites)

**Steps:**
1. Clone the repository:
   ```bash
   git clone https://github.com/tejasbhor/TakeoutFixer.git
   cd TakeoutFixer
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run in development mode:
   ```bash
   npm run tauri dev
   ```
4. Build for production:
   ```bash
   npm run tauri build
   ```

---

## 🤖 Automating Releases

This project uses **GitHub Actions** to automate multi-platform builds.
To trigger a new release:
1. Update the version in `package.json` and `src-tauri/tauri.conf.json`.
2. Create and push a new tag:
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```
3. GitHub will build all binaries and create a draft release for you.

---

## 🎨 Design System

TakeoutFixer uses a custom "Fluent-inspired" design system built with:
- **React 19** + **Vite**
- **Tailwind CSS**
- **Framer Motion** for micro-interactions
- **Lucide React** for iconography
- **Mica & Acrylic** backdrop effects (OS-dependent)

---

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

**Made with ❤️ for photo enthusiasts.**
