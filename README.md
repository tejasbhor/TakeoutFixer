# TakeoutFixer

![Tauri](https://img.shields.io/badge/Tauri-2.0-FFC131?logo=tauri&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-1.75+-000000?logo=rust&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![License](https://img.shields.io/badge/License-MIT-green)

TakeoutFixer is a high-performance, cross-platform desktop application designed to repair and organize photo/video archives exported from Google Takeout. It intelligently matches JSON sidecars with their original media files, restores missing EXIF metadata, and reorganizes your library into a clean, searchable structure.

---

## Features

- **8-Stage High-Performance Pipeline**: Built in Rust for maximum speed and memory safety.
- **Metadata Matching**: Automatically reconnects Google's detached JSON metadata with original images and videos.
- **EXIF Restoration**: Injects original timestamps, GPS coordinates, and descriptions directly into file headers.
- **Configurable Reorganization**: Supports Flat, Date-based (YYYY/MM), or Album-based folder structures.
- **Scan & Preview Mode**: Analyze library health and metadata integrity without modifying files on disk.
- **Integrity Validation**: Detects corrupt segments and missing archive parts prior to processing.
- **Native UI**: Modern design featuring dark mode and OS-native backdrop effects (Mica/Vibrancy).

---

## Supported Platforms

TakeoutFixer is natively compiled for:
- **Windows**: Full support for Mica effects and Windows Long Paths.
- **macOS**: Native architecture support for Intel and Apple Silicon (Universal) with native vibrancy.
- **Linux**: Distributed via AppImage and Debian packages.

---

## Installation & Setup

### For Users
1. Download the latest release for your operating system from the [Releases](https://github.com/tejasbhor/TakeoutFixer/releases) page.
2. **Windows**: Execute the `.exe` installer.
3. **macOS**: Move the application to the `/Applications` directory.
4. **Linux**: Grand execution permissions to the `.AppImage` or install the `.deb` package.

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

## Deployment & CI/CD

This repository utilizes **GitHub Actions** for automated multi-platform builds.
To initiate a release:
1. Update version strings in `package.json` and `src-tauri/tauri.conf.json`.
2. Push a new semantic version tag:
   ```bash
   git tag -a v1.0.0 -m "Release v1.0.0"
   git push origin v1.0.0
   ```
3. The automated pipeline will compile the binaries and generate a draft release.

---

## Design System

The application utilizes a custom design system built with:
- **React 19**
- **Tailwind CSS**
- **Framer Motion** for interface transitions
- **Lucide React** for iconography
- **Mica/Acrylic** backdrop filters

---

## License

Distributed under the MIT License. See `LICENSE` for more information.
