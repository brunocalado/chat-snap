/*!
 * Chat Snap
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * The single source of truth for the module id. Must match the `id` field in module.json
 * verbatim and be imported wherever the id is needed (settings, flags, template paths, CSS).
 * @type {string}
 */
export const MODULE_ID = "chat-snap";

/**
 * Setting key for tracking whether the first-run upload-permissions setup dialog has been shown.
 * Used in Settings.js (registration), module.js (read), and setup-dialog.js (write).
 * @type {string}
 */
export const SETTING_SETUP_COMPLETE = "setupComplete";

/**
 * Setting key for toggling date-based subfolder organization for uploaded files.
 * Used in Settings.js (registration) and FileProcessor.js (upload logic).
 * @type {string}
 */
export const SETTING_USE_DATE_FOLDERS = "useDateFolders";

/**
 * Setting key for showing/hiding the download button on chat media items.
 * Used in Settings.js (registration) and ChatMessage.js (render logic).
 * @type {string}
 */
export const SETTING_SHOW_DOWNLOAD_BUTTON = "showDownloadButton";

/**
 * Setting key for the per-file upload size cap in megabytes.
 * Used in Settings.js (registration) and FileProcessor.js (pre-upload guard).
 * @type {string}
 */
export const SETTING_MAX_FILE_SIZE_MB = "maxFileSizeMb";

/**
 * Setting key for the master toggle that enables re-encoding uploaded raster images to WebP.
 * Enabled by default. Used in Settings.js (registration) and FileProcessor.js (compression gate).
 * @type {string}
 */
export const SETTING_COMPRESS_IMAGES = "compressImages";

/**
 * Setting key for the WebP re-encoding quality (0.1–1.0). Only applies when SETTING_COMPRESS_IMAGES
 * is enabled. Used in Settings.js (registration) and FileProcessor.js (toBlob quality argument).
 * @type {string}
 */
export const SETTING_IMAGE_QUALITY = "imageQuality";

/**
 * Setting key for the master toggle that re-encodes animated GIF uploads to silent VP9 WebM.
 * Enabled by default. Used in Settings.js (registration) and FileProcessor.js (conversion gate).
 * @type {string}
 */
export const SETTING_CONVERT_GIFS = "convertGifs";

/**
 * Setting key for the WebM encoding quality, expressed in bits per pixel per frame. Only applies
 * when SETTING_CONVERT_GIFS is enabled. Used in Settings.js (registration) and GifToWebm.js
 * (bitrate derivation).
 * @type {string}
 */
export const SETTING_GIF_QUALITY = "gifQuality";

/**
 * Setting key storing the byte total from the last manual storage check.
 * Persisted so the StorageDialog can show the result across sessions.
 * @type {string}
 */
export const SETTING_STORAGE_LAST_CHECK_BYTES = "storageLastCheckBytes";

/**
 * Setting key storing the ISO date string of the last manual storage check.
 * @type {string}
 */
export const SETTING_STORAGE_LAST_CHECK_DATE = "storageLastCheckDate";

/**
 * 3D model file extensions that open in the interactive ModelPopout viewer (powered by
 * the <model-viewer> web component). Only glTF-family formats are renderable; other
 * 3D/game formats (.fbx, .obj, .stl, .usdz, .mtl) stay download-only in FileProcessor's
 * "downloadable" category because <model-viewer> cannot load them.
 * Used in FileProcessor.js (classification + upload preview) and ChatSidebar.js (message template).
 * @type {string[]}
 */
export const MODEL_EXTENSIONS = [".glb", ".gltf"];
