import { MODULE_ID, SETTING_SETUP_COMPLETE } from "../constants.js";
import { setSetting } from "../utils/Settings.js";

/**
 * First-run dialog that prompts the GM to grant file-upload permissions to Player and/or
 * Trusted Player roles. Triggered from the `ready` hook when `setupComplete` is false.
 * Closing the dialog by any means marks setup as complete so it does not reappear.
 */
export class SetupDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2
) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-setup-dialog`,
    classes: [MODULE_ID, "setup-dialog"],
    window: {
      title: "Chat Snap — Upload Permissions Setup",
      resizable: false,
    },
    position: { width: 480 },
    actions: {
      confirm: this.prototype._onConfirm,
      skip: this.prototype._onSkip,
    },
  };

  static PARTS = {
    content: {
      template: `modules/${MODULE_ID}/templates/setup-dialog.hbs`,
    },
  };

  /**
   * Returns true if at least one of the relevant non-GM roles (Player, Trusted Player) is
   * missing the FILES_UPLOAD permission. Used in the `ready` hook to decide whether to open
   * the dialog at all.
   * @returns {boolean}
   */
  static shouldShow() {
    const uploadRoles = game.settings.get("core", "permissions")?.["FILES_UPLOAD"];
    if (!Array.isArray(uploadRoles)) return true; // corrupted/unset value — surface the dialog
    return (
      !uploadRoles.includes(CONST.USER_ROLES.PLAYER) ||
      !uploadRoles.includes(CONST.USER_ROLES.TRUSTED)
    );
  }

  /**
   * Build the template context by reflecting the current FILES_UPLOAD permission state.
   * Roles that already have the permission are pre-checked; roles that are missing it are
   * unchecked, making it immediately clear what still needs to be granted.
   * @param {object} options  Render options passed by the framework.
   * @returns {Promise<{playerChecked: boolean, trustedChecked: boolean}>}
   */
  async _prepareContext(options) {
    const uploadRoles = game.settings.get("core", "permissions")?.["FILES_UPLOAD"];
    const current = Array.isArray(uploadRoles) ? uploadRoles : [];
    return {
      playerChecked: current.includes(CONST.USER_ROLES.PLAYER),
      trustedChecked: current.includes(CONST.USER_ROLES.TRUSTED),
    };
  }

  /**
   * Read the role checkboxes, apply the selected permissions, then close.
   * Called from `data-action="confirm"`.
   * @param {PointerEvent} event
   * @param {HTMLElement} _target
   * @returns {Promise<void>}
   */
  async _onConfirm(event, _target) {
    const grantPlayer = this.element.querySelector('[name="grantPlayer"]')?.checked ?? false;
    const grantTrusted = this.element.querySelector('[name="grantTrusted"]')?.checked ?? false;

    if (grantPlayer || grantTrusted) {
      await this._applyUploadPermissions(grantPlayer, grantTrusted);
    }

    this.close();
  }

  /**
   * Dismiss the dialog without changing permissions.
   * Called from `data-action="skip"`.
   * @param {PointerEvent} event
   * @param {HTMLElement} _target
   * @returns {void}
   */
  _onSkip(event, _target) {
    this.close();
  }

  /**
   * Mark setup as complete whenever the dialog is closed, regardless of the close path
   * (confirm, skip, or the window's X button). This prevents the dialog from reappearing
   * unless the GM manually resets the setting in the module configuration.
   * @param {object} options  Close options passed by the framework.
   * @returns {Promise<void>}
   */
  async _onClose(options) {
    await setSetting(SETTING_SETUP_COMPLETE, true);
  }

  /**
   * Update the core `FILES_UPLOAD` permission to include the selected roles.
   * V14 stores each permission as an explicit array of role numbers (not a minimum integer).
   * Granting Player (1) implicitly includes all higher roles; granting only Trusted (2) starts
   * from role 2. NONE (0) is always excluded — anonymous users cannot upload.
   * @param {boolean} grantPlayer   Whether to include the base Player role.
   * @param {boolean} grantTrusted  Whether to include the Trusted Player role.
   * @returns {Promise<void>}
   */
  async _applyUploadPermissions(grantPlayer, grantTrusted) {
    const minRole = grantPlayer ? CONST.USER_ROLES.PLAYER : CONST.USER_ROLES.TRUSTED;
    // Build an explicit array of every role at or above the minimum (NONE=0 is always excluded).
    const roles = Object.values(CONST.USER_ROLES).filter(r => r >= minRole);
    const perms = foundry.utils.deepClone(game.settings.get("core", "permissions"));
    perms["FILES_UPLOAD"] = roles;
    await game.settings.set("core", "permissions", perms);
  }
}
