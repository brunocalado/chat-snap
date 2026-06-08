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
