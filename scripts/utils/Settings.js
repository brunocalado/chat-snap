import { MODULE_ID, SETTING_SETUP_COMPLETE, SETTING_USE_DATE_FOLDERS, SETTING_SHOW_DOWNLOAD_BUTTON } from "../constants.js";
import { ORIGIN_FOLDER } from "./Utils.js";

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
