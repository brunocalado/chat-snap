# Chat Snap

**Share images, videos, audio, PDFs, text files, 3D assets, and fonts in your Foundry VTT chat — as easily as texting a friend.**

Drop a file. Paste a link. Hit Enter. Your whole table sees it.

![Chat Snap preview](docs/chat-snap-preview.webp)

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Donate-red?style=for-the-badge&logo=buy-me-a-coffee)](https://buymeacoffee.com/mestredigital)

---

## What It Does

Chat Snap adds image, video, audio, and file sharing directly to your game chat. No external tools, no copying links manually — just drag, drop, and post.

Whether you're a GM setting the atmosphere with a dramatic scene illustration, a player sharing a portrait of a new character, or anyone at the table sending a sound clip to complement the moment, Chat Snap keeps everyone in sync.

---

## Features

### Drag & Drop
Drag any image, video, or audio file from your computer straight onto the chat box. A preview appears before you send — remove it if you change your mind, add a caption, and post when ready.

### Paste to Post
Copy an image URL from the web and paste it into the chat. The module detects it automatically and queues it as a preview. Works with images copied from web pages too.

### Preview Before Sending
Queued media shows up as thumbnails (or an audio badge) above the chat input. You can remove items before posting, or mix media with a text message — all sent together in one click.

### Click to Enlarge
Any image in chat can be clicked to open a larger view. Videos embed with full playback controls and can be opened fullscreen.

### Download Button
Every media item in chat shows a **Download** link in the hint row below it — on the right side, with the "Click to open larger" label on the left. Click it to save the file to your device. Can be disabled in module settings.

### Storage & Upload Management
A dedicated **Storage & Upload** dialog (accessible from the module settings panel) lets the GM configure the file size limit and check how much disk space the upload folder is using. Click **Check Usage** to scan the folder — the result and date are saved and shown on the next visit.

### Audio Playback
Audio files embed directly in chat with native browser playback controls. Playback is client-side only — each player controls their own volume and timing independently, so playing a clip only affects the client that pressed play.

### PDF Sharing
Drag a PDF onto the chat input to share it. A badge (PDF icon + filename) appears in the upload strip before sending, and again in the posted message. Click the badge to open the PDF in a viewer dialog, which includes an **Open in new tab** button as fallback. The viewer fetches the file with your session credentials, so it works reliably for both GMs and players across browsers.

### Text & Data Files
Drag a `.txt`, `.json`, `.csv`, `.md`, `.tsv`, `.xml`, `.yml`, or `.yaml` file onto the chat input to share it. A badge with a type-specific icon appears in the message. Click the badge to open a viewer dialog with the file contents — JSON is automatically pretty-printed. An **Open in new tab** button is available as fallback.

### 3D Model Viewer
Drag a glTF model (`.glb` or `.gltf`) onto the chat input. A cube badge appears in the message — clicking it opens an interactive 3D viewer in a resizable popout, where you can orbit, zoom, and watch the model auto-rotate. The model is never embedded directly in chat; it only renders when you open the viewer. A **Download** button is available in the viewer's toolbar.

### Fonts & Other 3D/Game Assets
Drag a font (`.otf`, `.ttf`, `.woff`, `.woff2`) or other 3D/game asset (`.fbx`, `.obj`, `.stl`, `.usdz`, `.mtl`, `.basis`, `.ktx2`) onto the chat input. A badge with a type-specific icon (font or cube) appears in the message. Clicking it opens the file in a new browser tab to download. (These formats aren't supported by the in-app 3D viewer, which renders glTF models only.)

> **Note:** Only one audio, PDF, text, model, or asset file can be queued per message. These types cannot be mixed with each other or with visual media (images/videos) in the same message.

## Supported Formats

| Type   | Formats |
|--------|---------|
| Images | APNG, AVIF, BMP, GIF, JPEG, JPG, PNG, SVG, TIFF, WEBP |
| Videos | MP4, WEBM, M4V, OGV |
| Audio  | MP3, WAV, OGG, OPUS, FLAC, AAC, M4A, MID |
| PDF    | PDF |
| Text / Data | TXT, JSON, CSV, MD, TSV, XML, YML, YAML |
| Fonts | OTF, TTF, WOFF, WOFF2 |
| 3D Models (interactive viewer) | GLB, GLTF |
| 3D / Game Assets (download only) | FBX, OBJ, STL, USDZ, MTL, BASIS, KTX2 |

---

## Setup

### Installation

1. Open Foundry VTT and go to **Add-on Modules**.
2. Click **Install Module**.
3. Paste the manifest URL below and click **Install**.

```
https://raw.githubusercontent.com/brunocalado/chat-snap/main/module.json
```

4. Enable the module in your world via **Manage Modules**.

### Giving Players Permission to Post Media

By default, only the GM can upload files to the server. The first time Chat Snap loads in your world, a setup dialog will appear and offer to grant the **Upload Files** permission to players automatically.

If you skipped that step or want to change permissions later, go to:
> **Game Settings → Configure Settings → Permissions → Upload Files**

Check the roles you want to allow, then save.

---

## Settings

| Setting | Who Can Change It | What It Does |
|---|---|---|
| Upload Location | GM only | Folder where uploaded media files are stored on the server. Default: `uploaded-chat-snap`. |
| Organize uploads by date | GM only | Groups uploaded files into daily subfolders (e.g. `uploaded-chat-snap/2026-06-08/`). On by default. Disable on hosting platforms where folder creation behaves differently, such as The Forge. |
| Video Autoplay | GM only | Whether videos play automatically when they appear in chat. On by default. |
| Show download button on chat media | GM only | Displays a **Download** link below every media item (images, videos, audio, PDFs, text files) in chat. On by default. |
| Setup Complete | GM only | Hides the first-run permissions dialog. Uncheck to show it again. |

### Storage & Upload Dialog

Accessible via the **Configure** button in the module settings panel.

| Option | What It Does |
|---|---|
| Max File Size (MB) | Files larger than this limit are rejected before upload for non-GM users. GMs are exempt and can upload any size. Accepts 1–1000 MB. Default: 120 MB. |
| Check Usage | Scans the upload folder and shows the total disk usage. The result and date are saved and displayed on the next visit. |

---

## Notes

- Works with hosting services like The Forge that use custom file management.

---

## Bug Reports & Feature Requests

https://github.com/brunocalado/chat-snap/issues

---

## Credits and License

- Released under the [LICENSE](LICENSE).
- Forked from [Chat Media](https://github.com/p4535992/foundryvtt-chat-media) by p4535992.
