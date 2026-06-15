import { MODULE_ID, SETTING_SETUP_COMPLETE, SETTING_USE_DATE_FOLDERS, SETTING_SHOW_DOWNLOAD_BUTTON, SETTING_MAX_FILE_SIZE_MB, SETTING_COMPRESS_IMAGES, SETTING_IMAGE_QUALITY, SETTING_STORAGE_LAST_CHECK_BYTES, SETTING_STORAGE_LAST_CHECK_DATE } from "../constants.js";
import { ORIGIN_FOLDER } from "./Utils.js";
import { StorageDialog } from "../storage/StorageDialog.js";

/**
 * Resolve the active FilePicker implementation so host environments (e.g. The Forge) can
 * substitute their own. Per the v14 FilePicker contract, never reference the bare class.
 * @returns {typeof foundry.applications.apps.FilePicker}
 */
const getFilePicker = () =>
  foundry.applications.apps.FilePicker.implementation ?? foundry.applications.apps.FilePicker;

/**
 * Ensure the upload destination folder exists, creating it if necessary.
 * Called from the `init` hook and when the upload location setting changes.
 * @param {string} [uploadLocation]  Override for the configured upload location.
 * @returns {Promise<void>}
 */
export const createUploadFolder = async (uploadLocation = "") => {
  const location = uploadLocation || getSetting("uploadLocation");
  const FilePicker = getFilePicker();
  try {
    const folderLocation = await FilePicker.browse(ORIGIN_FOLDER, location);
    if (folderLocation.target === ".") await FilePicker.createDirectory(ORIGIN_FOLDER, location, {});
  } catch (e) {
    await FilePicker.createDirectory(ORIGIN_FOLDER, location, {});
  }
};

export const setSetting = (key, value) => {
  return game.settings.set(MODULE_ID, key, value);
};

export const getSettings = () => [
  {
    key: "uploadLocation",
    options: {
      name: "Upload location",
      hint: "[Will take effect after refresh] Where should the images be uploaded",
      type: String,
      default: "uploaded-chat-snap",
      scope: "world",
      config: true,
      restricted: true,
      onChange: async (newUploadLocation) => {
        const defaultLocation = "uploaded-chat-snap";
        let location = newUploadLocation.trim();
        let shouldChangeLocation = false;

        if (!location) {
          location = defaultLocation;
          shouldChangeLocation = true;
        }

        location = location.replace(/\s+/g, "-");
        if (newUploadLocation !== location) shouldChangeLocation = true;

        await createUploadFolder(location);
        if (shouldChangeLocation) await setSetting("uploadLocation", location);
      },
    },
  },
  {
    key: SETTING_USE_DATE_FOLDERS,
    options: {
      name: "Organize uploads by date",
      hint: "Upload files into daily subfolders (e.g. uploaded-chat-snap/2026-06-08/). Disable on hosting platforms where folder creation behaves differently (e.g. The Forge).",
      type: Boolean,
      default: true,
      scope: "world",
      config: true,
      restricted: true,
    },
  },
  {
    key: "videoAutoplay",
    options: {
      name: "Video Autoplay",
      hint: "Automatically play videos when they appear in chat",
      type: Boolean,
      default: true,
      scope: "world",
      config: true,
      restricted: true,
    },
  },
  {
    key: SETTING_SHOW_DOWNLOAD_BUTTON,
    options: {
      name: "Show download button on chat media",
      hint: "Display a download button alongside media items sent through Chat Snap.",
      type: Boolean,
      default: true,
      scope: "world",
      config: true,
      restricted: true,
    },
  },
  {
    key: SETTING_MAX_FILE_SIZE_MB,
    options: {
      // Managed by StorageDialog; hidden from the main settings panel.
      type: Number,
      default: 120,
      scope: "world",
      config: false,
      restricted: true,
    },
  },
  {
    key: SETTING_COMPRESS_IMAGES,
    options: {
      name: "Compress images to WebP",
      hint: "When enabled, BMP, JPEG, JPG, and PNG uploads are re-encoded to WebP to save storage. Enabled by default.",
      type: Boolean,
      default: true,
      scope: "world",
      config: true,
      restricted: true,
    },
  },
  {
    key: SETTING_IMAGE_QUALITY,
    options: {
      name: "WebP compression quality",
      hint: "Quality of WebP re-encoding, from 0.6 (smallest file) to 0.95 (best quality). Only applies when image compression is enabled.",
      type: Number,
      default: 0.85,
      scope: "world",
      config: true,
      restricted: true,
      range: { min: 0.6, max: 0.95, step: 0.05 },
    },
  },
  {
    key: SETTING_STORAGE_LAST_CHECK_BYTES,
    options: { type: Number, default: 0, scope: "world", config: false },
  },
  {
    key: SETTING_STORAGE_LAST_CHECK_DATE,
    options: { type: String, default: "", scope: "world", config: false },
  },
  {
    key: SETTING_SETUP_COMPLETE,
    options: {
      name: "Setup complete",
      hint: "When unchecked, the upload permissions setup dialog will appear again on the next world load.",
      type: Boolean,
      default: false,
      scope: "world",
      config: true,
      restricted: true,
    },
  },
];

export const registerSetting = (setting) => {
  return game.settings.register(MODULE_ID, setting.key, setting.options);
};

export const getSetting = (key) => {
  return game.settings.get(MODULE_ID, key);
};

/**
 * Register the Storage & Upload menu entry in the module settings panel.
 * Opens StorageDialog where the GM can configure max file size and check/clear the upload folder.
 * Called from the `init` hook after registerSettings().
 * @returns {void}
 */
export const registerStorageMenu = () => {
  game.settings.registerMenu(MODULE_ID, "storageMenu", {
    name: "Storage & Upload",
    label: "Configure",
    hint: "Configure file size limits and check upload folder disk usage.",
    icon: "fa-solid fa-hard-drive",
    type: StorageDialog,
    restricted: true,
  });
};
