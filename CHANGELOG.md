# 0.0.7

### Added
- New **Storage & Upload** settings menu (replaces the old inline *Max file size* setting). Opens a dedicated dialog where the GM can set the file size limit and run a manual **Check Usage** scan that sums the real disk usage of the upload folder via HTTP HEAD requests. The last result and its date are persisted and shown on reopening the dialog.

### Changed
- **Max file size limit no longer applies to GMs.** GMs can upload files of any size regardless of the configured limit. The limit continues to apply to all non-GM roles.
- Max file size setting moved out of the main settings panel into the new Storage & Upload dialog.

# 0.0.6

### Added
- New **Max file size (MB)** setting (1–1000 MB, default 120 MB): local files that exceed the configured limit are rejected before upload with a warning notification showing the filename and the active limit. Remote URLs pasted into chat are not affected.
- Support for `.txt` and `.json` files: drag-and-drop or paste them into chat to upload and share. Files appear as a named badge in the message; clicking opens a viewer popout with the raw content (JSON is automatically pretty-printed). A download link is also injected when the *Show download button* setting is enabled.
- Added audio formats `.m4a` and `.mid`.
- Added text/data formats `.csv`, `.md`, `.tsv`, `.xml`, `.yml`, `.yaml` — all viewable in the text viewer with type-specific icons.
- Added download-only support for fonts (`.otf`, `.ttf`, `.woff`, `.woff2`) and 3D/game assets (`.glb`, `.gltf`, `.fbx`, `.obj`, `.stl`, `.usdz`, `.mtl`, `.basis`, `.ktx2`). Files appear as a font or cube icon badge; clicking opens in a new tab.

# 0.0.4

### Added
- Download button on chat media: images, videos, audio, and PDFs now show a **Download** link in the hint row below the asset. The link is on the right side of the row, with "Click to open larger" (or "Click to view" for PDFs) left-aligned on the same line. A new world setting **Show download button on chat media** (enabled by default) controls the feature.

# 0.0.3

- improved loading indicator

# 0.0.2

### Fixed
- Pasting a plain image/video/audio/PDF URL (e.g. `https://example.com/image.png`) now correctly queues a media preview instead of inserting the URL as plain text.
- Non-GM users with `FILES_UPLOAD` permission could not upload videos (or any file) when **Organize uploads by date** was enabled. The date subfolder creation requires `FILES_BROWSE`, which players typically lack. Folder creation is now delegated to the GM via a socket query (`CONFIG.queries`), so non-GM uploads work correctly and the video is served from a real server path visible to all clients.
- Non-GM clients were triggering a spurious unhandled-promise-rejection at module startup because `createUploadFolder` (which calls `FilePicker.browse`) was called for all users in the `init` hook. It is now called only for the GM in the `ready` hook.

### Changed
- Video popout is now a dedicated `VideoPopout` class (replacing the `MediaPopout` path for videos), giving full control over window sizing independent of the core `ImagePopout` logic.

### Added
- Video popout now opens sized to match the video's aspect ratio. A 9:16 portrait video opens a tall window; a 16:9 landscape video opens a wide one — no manual resizing needed. Dimensions are pre-fetched before the window renders, so there is no resize flash on open.
- PDF support: drag & drop `.pdf` files onto the chat input to share them. A PDF badge (file icon + filename) appears in the upload strip before sending and in the posted message. Clicking the badge opens an inline PDF viewer dialog with an **Open in new tab** fallback button. The viewer fetches the file with session credentials and uses a Blob URL for reliable rendering across browsers and user roles.
- PDF follows the same single-slot rule as audio: only one PDF per message, and PDFs cannot be mixed with images, videos, or audio in the same message.

# 0.0.1

### Added
- Uploaded files are now organized into daily subfolders (e.g. `uploaded-chat-snap/2026-06-08/`). Each session's files are grouped by date, making it easy to browse or clean up old uploads. Controlled by the new **Organize uploads by date** setting (enabled by default). Disable it on hosting platforms where folder creation behaves differently, such as The Forge.
- Audio file support: drag & drop `.mp3`, `.wav`, `.ogg`, `.opus`, `.flac`, `.aac` files onto the chat input to send them as messages with native browser playback controls. Playback is client-side only — each player controls their own volume and timing independently.
- Audio preview badge in the upload strip (music icon + filename) since audio has no visual thumbnail.
- Queue conflict guard: audio and visual media (images/videos) cannot coexist in the same queued message; a warning notification is shown if mixed.
