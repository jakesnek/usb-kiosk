# USB Kiosk

A fullscreen Electron kiosk application designed for touchscreen displays. Allows visitors to plug in a USB drive and browse files — no keyboard or mouse required.

## Supported File Types

| Category  | Formats                                    |
|-----------|--------------------------------------------|
| Video     | MP4, WebM, OGG                             |
| Images    | PNG, JPG, GIF, BMP, WebP, HEIC             |
| Documents | PDF, DOCX, XLSX, TXT                       |

## Features

- **USB auto-detection** — polls for drives every 3 seconds with insert/remove notifications
- **Auto-select** — skips drive selection when a single USB is connected
- **Icon strip** — vertical sidebar control with quick-access icons for each file type
- **Swipe navigation** — swipe left/right to switch between Videos, Images, and Documents
- **Image viewer** — pan/zoom via Panzoom, carousel navigation, HEIC conversion
- **PDF viewer** — multi-page navigation with 6-level zoom (1x–3x)
- **Document rendering** — DOCX via Mammoth.js, XLSX with multi-sheet support
- **Touch optimized** — 40px+ touch targets, custom scrollbars, swipe gestures, no hover dependencies

## Tech Stack

- Electron 38 (context isolation, frameless fullscreen window)
- Bootstrap 5 + Bootstrap Icons
- Panzoom, pdf.js, Mammoth.js, xlsx, heic-convert, drivelist

## Usage

```bash
npm install
npm start        # development
npm run dist     # build NSIS installer
```

## Security

- Context isolation enabled, node integration disabled
- Navigation restricted to `file://` URLs
- New window creation blocked
- HTML sanitization on rendered documents
