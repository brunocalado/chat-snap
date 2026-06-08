# Chat Snap

**Share images and videos in your Foundry VTT chat — as easily as texting a friend.**

Drop a file. Paste a link. Hit Enter. Your whole table sees it.

[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-Donate-red?style=for-the-badge&logo=buy-me-a-coffee)](https://buymeacoffee.com/mestredigital)

---

## What It Does

Chat Snap adds image and video sharing directly to your game chat. No external tools, no copying links manually — just drag, drop, and post.

Whether you're a GM setting the atmosphere with a dramatic scene illustration, or a player sharing a portrait of a new character, Chat Snap keeps everyone at the table in sync, visually.

---

## Features

### Drag & Drop
Drag any image or video file from your computer straight onto the chat box. A preview appears before you send — remove anything you don't want, add a caption, and post when ready.

### Paste to Post
Copy an image URL from the web and paste it into the chat. The module detects it automatically and queues it as a preview. Works with images copied from web pages too.

### Preview Before Sending
Queued media shows up as thumbnails above the chat input. You can remove individual items before posting, or mix media with a text message — all sent together in one click.

### Click to Enlarge
Any image in chat can be clicked to open a larger view. Videos embed with full playback controls and can be opened fullscreen.

## Supported Formats

| Type   | Formats |
|--------|---------|
| Images | APNG, AVIF, BMP, GIF, JPEG, JPG, PNG, SVG, TIFF, WEBP |
| Videos | MP4, WEBM, M4V, OGV |

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
| Video Autoplay | GM only | Whether videos play automatically when they appear in chat. On by default. |
| Setup Complete | GM only | Hides the first-run permissions dialog. Uncheck to show it again. |

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
