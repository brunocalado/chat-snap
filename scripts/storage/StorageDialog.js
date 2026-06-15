import {
  MODULE_ID,
  SETTING_MAX_FILE_SIZE_MB,
  SETTING_STORAGE_LAST_CHECK_BYTES,
  SETTING_STORAGE_LAST_CHECK_DATE,
} from "../constants.js";
import { getSetting, setSetting } from "../utils/Settings.js";
import { calculateFolderSize } from "../utils/Utils.js";

/**
 * Settings dialog for storage management. Lets the GM configure the max file size,
 * run a manual disk-usage check against the upload folder, and delete all uploaded files.
 * Opened via the "Storage & Upload" menu entry registered by registerStorageMenu().
 */
export class StorageDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-storage-dialog`,
    classes: [MODULE_ID, "storage-dialog"],
    window: { title: "Chat Snap — Storage", resizable: false },
    position: { width: 480 },
    actions: {
      checkUsage: StorageDialog.prototype._onCheckUsage,
      save: StorageDialog.prototype._onSave,
    },
  };

  static PARTS = {
    content: { template: `modules/${MODULE_ID}/templates/storage-dialog.hbs` },
  };

  /**
   * Build template context from persisted settings and live chat log stats.
   * @param {object} _options  Render options passed by the framework.
   * @returns {Promise<object>}
   */
  async _prepareContext(_options) {
    const lastBytes = getSetting(SETTING_STORAGE_LAST_CHECK_BYTES);
    const lastDate  = getSetting(SETTING_STORAGE_LAST_CHECK_DATE);

    const messages  = game.messages.contents;
    const chatBytes = new TextEncoder().encode(JSON.stringify(messages)).byteLength;

    return {
      maxFileSizeMb:      getSetting(SETTING_MAX_FILE_SIZE_MB),
      lastCheckLabel:     lastBytes > 0 ? _formatBytes(lastBytes) : null,
      lastCheckDate:      lastDate || null,
      chatMessageCount:   messages.length,
      chatSizeLabel:      _formatBytes(chatBytes),
    };
  }

  /**
   * Recursively measure the upload folder and persist the result.
   * Called from `data-action="checkUsage"`.
   * @param {PointerEvent} _event
   * @param {HTMLElement} target
   * @returns {Promise<void>}
   */
  async _onCheckUsage(_event, target) {
    target.disabled = true;
    const saved = target.innerHTML;
    target.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Checking…';
    try {
      const totalBytes = await calculateFolderSize(getSetting("uploadLocation"));
      const now = new Date().toISOString().slice(0, 10);
      await setSetting(SETTING_STORAGE_LAST_CHECK_BYTES, totalBytes);
      await setSetting(SETTING_STORAGE_LAST_CHECK_DATE, now);
      this.element.querySelector(".storage-check-result").innerHTML =
        `Usage: <strong>${_formatBytes(totalBytes)}</strong> &nbsp;|&nbsp; Last Check: ${now}`;
    } finally {
      target.disabled = false;
      target.innerHTML = saved;
    }
  }

  /**
   * Persist the max file size and close the dialog.
   * Called from `data-action="save"`.
   * @param {PointerEvent} _event
   * @param {HTMLElement} _target
   * @returns {Promise<void>}
   */
  async _onSave(_event, _target) {
    const raw   = this.element.querySelector('[name="maxFileSizeMb"]')?.value;
    const value = parseInt(raw || "120", 10);
    if (value >= 1 && value <= 1000) await setSetting(SETTING_MAX_FILE_SIZE_MB, value);
    this.close();
  }
}

/**
 * Format a raw byte count as a human-readable MB or GB string.
 * @param {number} bytes
 * @returns {string}
 */
const _formatBytes = (bytes) => {
  const mb = bytes / (1024 * 1024);
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`;
};
