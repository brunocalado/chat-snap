# 0.1.7

### Fixed
- **"Disallowed extension" error when pasting a browser-copied image.** Some sites' "Copy image" puts a `data:` URI (instead of a real URL) in the clipboard's HTML payload. The background upload that mirrors pasted media to the Foundry server derived the filename by parsing that `data:` URI as if it were a normal path, producing a garbage name with no valid extension and triggering a rejected-upload error — even though the image itself pasted and displayed fine. The filename is now derived from the file's MIME type for `data:` URIs, so the background upload succeeds silently as intended.

# 0.1.6

### Added
- **Copy Link button on chat images (GM only).** Images shared in chat (`.webp`, `.png`, `.jpg`, `.jpeg`) now show a small copy icon to the right of the download/drag buttons, visible only to the GM. Clicking it copies the image URL to the clipboard with a confirmation notification.
- **Set Actor Portrait button on chat images (GM only).** Next to the copy button, a portrait icon opens a dialog listing all players' linked actors (those assigned as a user's Player Character in Foundry). Clicking an actor immediately updates its portrait to the shared image and closes the dialog. The button only appears for image formats (`.webp`, `.png`, `.jpg`, `.jpeg`) and both buttons are hidden entirely on audio, video, PDF, and other non-image media.

# 0.1.5

### Added
- **Drag-to-canvas handle for media assets.** Images, videos, and audio files in chat messages now show a grip icon to the right of the Download button (GM only). Grab the icon and drag it onto an active scene to place the asset directly on the canvas: images and videos are placed as **Tiles**, audio files as **AmbientSounds** at the drop position. The handle is hidden for externally-hosted URLs and does not appear when no scene is open.

# 0.1.4

### Added
- **Background mirroring of external media URLs.** When a link is pasted into chat, the module immediately shows a preview using the external URL (no delay). In the background it silently attempts a CORS fetch of that URL and, if allowed by the remote server, uploads the file to the Foundry server — exactly like a drag-and-drop file. If the upload completes before the message is sent the message stores the local copy; if CORS blocks the request or the upload fails the external URL is used as before.

### Changed
- **Download button adapts to URL origin.** The button below a media item now reads **Download** (with a save-file icon) when the file is hosted on the Foundry server, and **Open** (with an external-link icon) when the file is still an external URL. The "Open" button opens the link in a new browser tab instead of navigating the current page, so Foundry stays open.

# 0.1.3

Windows naming bug fixed

# 0.1.2

### Added
- **Chat Log stats in the Storage dialog.** A new *Chat Log* section shows the current message count and estimated in-memory size of the chat log (~bytes of JSON sent to every player on session join). Includes an explanatory note about the performance impact of large chat logs and how to clear them via Foundry's native controls.

### Changed
- **Storage Usage section now includes an explanatory note** clarifying that the displayed size reflects files physically stored on the server, and that clearing the chat log does not delete uploaded files — they must be removed manually via the Foundry file browser or hosting control panel.

# 0.1.1

### Changed
- **WebP compression quality range narrowed to 0.6–0.95** (was 0.1–1.0). The new bounds exclude impractically low quality values and cap the slider before lossless territory, where WebP files tend to grow larger than the originals.

# 0.1.0

### Added
- **Optional image compression to WebP.** BMP, JPEG, JPG, and PNG uploads are re-encoded to WebP to save storage, controlled by the new **Compress images to WebP** setting (enabled by default). A **WebP compression quality** setting (0.1–1.0, default 0.85) tunes the trade-off. Eligible images are compressed before the size-limit check, so an oversized original that fits once re-encoded is still accepted — only the compressed result is rejected if it still exceeds the limit. The original file is kept untouched when re-encoding would not make it smaller or fails.

# 0.0.9

### Added
- **Interactive 3D viewer for glTF models.** `.glb` and `.gltf` files now open in a resizable popout with an interactive 3D viewer (orbit, zoom, auto-rotate) instead of only downloading. The model is never shown inline in chat — the message displays a cube badge ("Click to view 3D"), and clicking it opens the viewer. A **Download** button is available in the viewer's toolbar. Other 3D/game formats (`.fbx`, `.obj`, `.stl`, `.usdz`, `.mtl`, `.basis`, `.ktx2`) are not renderable by the viewer and remain download-only.

# 0.0.8

### Changed
- Download button styling improved: now displays a Font Awesome download icon alongside the text, with a green background and white text for better visibility and contrast.

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
