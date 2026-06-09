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
