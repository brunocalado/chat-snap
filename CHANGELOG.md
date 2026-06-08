# 0.0.2

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
