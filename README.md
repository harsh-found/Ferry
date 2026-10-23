<div align="center">

# 🚢 Ferry

### High-Performance Anonymous File Drop & Ephemeral Sharing Utility

[![React](https://img.shields.io/badge/React-19.2.0-61DAFB?style=for-the-badge&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-7.3-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4.2-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![Framer Motion](https://img.shields.io/badge/Framer_Motion-12.35-FF0055?style=for-the-badge&logo=framer&logoColor=white)](https://www.framer.com/motion/)
[![Cloudflare Pages](https://img.shields.io/badge/Cloudflare_Pages-Ready-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://pages.cloudflare.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)

<p align="center">
  <b>No accounts. No trackers. Zero friction.</b><br>
  Drag, drop, set auto-expiration, generate QR codes, and share files with cryptographic SHA-256 verification in milliseconds.
</p>

[Key Features](#-key-features) • [Architecture](#-architecture--how-it-works) • [Directory Structure](#-directory-structure) • [Getting Started](#-getting-started) • [Deployment](#-deployment) • [Keyboard Shortcuts](#-keyboard-shortcuts)

</div>

---

## 🌟 Overview

**Ferry** is a sleek, privacy-first web application designed for fast, hassle-free ephemeral file transfers. Built with modern web primitives, Ferry bridges the gap between quick scratchpad uploads and enterprise-grade file management without forcing users through a login wall.

Whether sending an APK to an Android TV, sharing a large PDF document with a classmate, or generating a temporary download link with a countdown timer, Ferry handles uploads up to **100 MB** with multi-provider redundancy, real-time speed monitoring, cryptographic verification, and instant mobile handoff.

---

## ✨ Key Features

### 1. ⚡ Instant & Anonymous Drops
* **Zero Registration:** Start uploading immediately. No email, password, or OAuth required.
* **Up to 100 MB per File:** Upload documents, videos, source code archives, firmware, and images.
* **Auto-Expiration Policies:** Pick custom lifespans: `1 Hour`, `6 Hours`, `24 Hours`, `48 Hours`, or `Forever (∞)` (provider-dependent).

### 2. 🌐 Multi-Provider Hosting Backend
Ferry integrates with battle-tested storage hosts with automated fallback and provider selection:
* **`tmpfiles.org`:** Ultra-fast temporary file hosting with automated timed expiration (1h to 48h).
* **`OnlyFiles`:** High-capacity hosting with permanent storage options, 500 uploads/hr, and 5,000 uploads/day limits.

### 3. 🔒 Client-Side Cryptographic Verification
* **SHA-256 Fingerprinting:** Calculates cryptographic file hashes locally using the Web Crypto API (`crypto.subtle.digest`) before and during transmission.
* **Data Integrity:** Guarantees that downloaded content matches the exact byte sequence uploaded.

### 4. 📱 Instant Mobile Handoff (QR Engine)
* **Real-time QR Codes:** Generates high-contrast QR codes directly in the browser using the `qrcode` engine.
* **Seamless Cross-Device Sharing:** Scan from your phone or tablet camera to instantly trigger the download without copy-pasting long URLs.

### 5. 📊 Real-Time Upload Engine
* **Concurrent Chunked Queue:** Queue multiple files simultaneously with distinct lifecycle stages: `Queued` → `Preparing` → `Uploading` → `Done`.
* **Telemetry & Speed Meter:** Live transfer rate calculation (MB/s or KB/s), byte counters, upload progress bars, and ETA calculations.
* **Actionable Controls:** Cancel in-flight transfers, retry failed uploads, or copy URLs instantly upon completion.

### 6. 🗃️ Personal Local Library
* **100% Client-Side History:** Upload history is persisted in `localStorage`. Nothing is tracked on external analytics servers.
* **Metadata & Organization:** Add custom labels, markdown notes, tags, and bookmark important files (`Pinned`).
* **Category Auto-Detection:** Automatically sorts files into `Image`, `Video`, `Audio`, `Document`, `Archive`, `Code`, and `Other`.
* **Export & Import:** Export your full file ledger to JSON or restore it on any device.

### 7. ⌨️ Command Palette (`⌘K` / `Ctrl+K`)
* Global modal palette with fuzzy search across all active and historic uploads, quick navigation, provider switching, and batch actions.

---

## 🏗️ Architecture & How It Works

```
┌─────────────────────────────────────────────────────────────┐
│                       Client Browser                        │
│                                                             │
│   [File Drop] ───► [Web Crypto API] ───► SHA-256 Digest     │
│          │                                                  │
│          ▼                                                  │
│   [Upload Queue Manager (XHR + Progress Event)]             │
│          │                                                  │
│          ├──► Provider: tmpfiles.org (1h - 48h)             │
│          └──► Provider: OnlyFiles (Permanent / Multi-tier)  │
│                                                             │
│   [Response Parser] ──► Direct CDN Download Link            │
│          │                                                  │
│          ├──► [QR Generator] (Canvas/SVG for mobile)        │
│          └──► [Local Storage Ledger] (Tags, notes, expiry)  │
└─────────────────────────────────────────────────────────────┘
```

1. **Local Intake:** When files are dropped, Ferry extracts MIME metadata, computes local preview thumbnails (for images/videos), and calculates the SHA-256 checksum in an asynchronous worker thread.
2. **Streaming Dispatch:** Uses native `XMLHttpRequest` to allow granular byte-level upload progress tracking, upload speed computation, and network cancellation triggers.
3. **Ledger Update:** Upon receiving `200 OK`, Ferry registers the remote URL in the local store along with expiration timestamps.

---

## 📁 Directory Structure

```text
web/Ferry/
├── public/                       # Static public assets & icons
├── src/
│   ├── assets/                   # Vector graphics and bundled illustrations
│   ├── components/               # Modular UI component tree
│   │   ├── CommandPalette.tsx    # ⌘K power-user search and action menu
│   │   ├── FileDrawer.tsx        # Slide-over inspector for file details, QR & notes
│   │   ├── FileVisual.tsx        # Dynamic file type icons and thumbnail renderer
│   │   ├── Header.tsx            # Navigation bar, live stats badge & palette trigger
│   │   ├── HowItWorks.tsx        # Explanatory onboarding accordion and guide
│   │   ├── Library.tsx           # History view with category tabs, search & filters
│   │   ├── Stats.tsx             # Aggregate usage telemetry (total MB, active files)
│   │   └── UploadPanel.tsx       # Drag-and-drop zone, expiry selectors & queue view
│   ├── lib/                      # Core business logic & utilities
│   │   ├── format.ts             # Human-readable file sizes, speeds, countdowns
│   │   ├── hooks.ts              # Custom React hooks (interval timers, keyboard)
│   │   ├── media.ts              # Client-side thumbnail generator & image dimensions
│   │   ├── providers.ts          # Storage provider definitions (tmpfiles, onlyfiles)
│   │   ├── search.ts             # Multi-field filtering and fuzzy search logic
│   │   ├── store.tsx             # React Context & LocalStorage state persistence
│   │   ├── types.ts              # Strong TypeScript interfaces & constants
│   │   ├── ui.tsx                # Toast notifications & theme providers
│   │   └── upload.ts             # Native XHR file dispatch and progress tracking
│   ├── App.tsx                   # Main layout container and view coordinator
│   ├── index.css                 # Tailwind CSS v4 directives and design tokens
│   └── main.tsx                  # Application bootstrap entry point
├── eslint.config.js              # ESLint flat config with TypeScript rules
├── index.html                    # Single Page Application HTML5 entry point
├── package.json                  # Dependencies, scripts and package metadata
├── tsconfig.json                 # TypeScript compiler configuration root
├── tsconfig.app.json             # App-specific TS rules
├── tsconfig.node.json            # Node/Vite specific TS rules
└── vite.config.ts                # Vite 7 build configuration with Tailwind plugin
```

---

## 🚀 Getting Started

### Prerequisites
* **Node.js:** `v20.x` or later (tested on Node v22)
* **Package Manager:** `npm`, `pnpm`, or `bun`

### Installation

1. **Navigate to the project directory:**
   ```bash
   cd /home/code/projects/web/Ferry
   ```

2. **Install dependencies:**
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   The application will be live at `http://localhost:5173`.

---

## 🛠️ Build & Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts Vite development server with Hot Module Replacement (HMR). |
| `npm run build` | Compiles TypeScript and builds production-optimized static bundle to `dist/`. |
| `npm run preview` | Previews the production build locally via Cloudflare Wrangler dev server. |
| `npm run lint` | Runs ESLint 9 checks across all source files. |
| `npm run deploy` | Builds the project and deploys directly to Cloudflare Pages via Wrangler. |

---

## ☁️ Deployment

### Deploy to Cloudflare Pages (Recommended)

Ferry is pre-configured with `@cloudflare/vite-plugin` and `wrangler` for seamless edge hosting.

```bash
# 1. Login to Cloudflare
npx wrangler login

# 2. Build and deploy
npm run deploy
```

Alternatively, push to GitHub and link the repository in the **Cloudflare Pages Dashboard**:
* **Framework Preset:** `Vite`
* **Build Command:** `npm run build`
* **Build Output Directory:** `dist`

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `⌘K` / `Ctrl+K` | Open / Close Command Palette |
| `Esc` | Close slide-over drawer / Command Palette |
| `U` | Scroll to upload panel & focus file picker |
| `L` | Jump to files library |

---

## 🔒 Security & Privacy Notice

* Ferry does **not** route files through proprietary proxy servers. Uploads stream directly from the user's browser to the selected hosting provider.
* File records, notes, tags, and pinned statuses live exclusively in the user's local browser storage (`localStorage`). Clearing browser cache purges the local ledger completely.

---

<div align="center">
  <sub>Crafted with precision for private, fast, and frictionless web sharing.</sub>
</div>
