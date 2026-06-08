# 0.0.1

### Added
- Audio file support: drag & drop `.mp3`, `.wav`, `.ogg`, `.opus`, `.flac`, `.aac` files onto the chat input to send them as messages with native browser playback controls. Playback is client-side only — each player controls their own volume and timing independently.
- Audio preview badge in the upload strip (music icon + filename) since audio has no visual thumbnail.
- Queue conflict guard: audio and visual media (images/videos) cannot coexist in the same queued message; a warning notification is shown if mixed.
