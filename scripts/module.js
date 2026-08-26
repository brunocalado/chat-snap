/*!
 * Chat Snap
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

import { initUploadArea } from "./components/upload-area.js";
import { initChatSidebar } from "./components/chat-sidebar.js";
import { initChatMessage } from "./components/chat-message.js";
import { createUploadFolder, getSettings, registerSetting, getSetting, setSetting, registerStorageMenu } from "./utils/settings.js";
import { SetupDialog } from "./setup/setup-dialog.js";
import { MODULE_ID, SETTING_SETUP_COMPLETE } from "./constants.js";

/**
 * Register every module setting declared in Settings.js.
 * Called from the `init` hook.
 * @returns {void}
 */
const registerSettings = () => {
  const settings = getSettings();
  settings.forEach((setting) => registerSetting(setting));
};

Hooks.once("init", () => {
  registerSettings();
  registerStorageMenu();
  // Non-GM users lack FILES_BROWSE permission and cannot call createUploadFolder directly.
  // This query runs on any active GM client, which creates the folder on the player's behalf.
  // The v14 query handler signature is (queryData, {timeout, user}) — the payload is the FIRST
  // argument, not the querying user id.
  CONFIG.queries[`${MODULE_ID}.ensureFolder`] = async ({ folderPath, force }) =>
    createUploadFolder(folderPath, { force });
});

/**
 * Wire the preview strip and the paste/drop capture onto the live chat input.
 * Both steps are idempotent, so this can run on every chat render.
 * @param {HTMLElement} [inputElement]  The `<prose-mirror id="chat-message">` element.
 * @returns {void}
 */
const initChatInterface = (inputElement = document.querySelector("#chat-message")) => {
  if (!inputElement) return;
  initUploadArea();
  initChatSidebar(inputElement);
};

// The chat log renders asynchronously and is frequently still rendering when `ready` fires, so
// `#chat-message` cannot be resolved there reliably — when it was missing the module stayed inert
// for the whole session and pasted media fell through to the core editor. `renderChatInput` is
// core's own signal for the chat input being rendered (and re-parented on sidebar collapse), and it
// hands over the element directly.
Hooks.on("renderChatInput", (_chatLog, elements) => initChatInterface(elements["#chat-message"]));

Hooks.once("ready", () => {
  // Only GM can browse/create directories; ensure the base upload folder exists now that
  // game.user is fully initialised.
  if (game.user.isGM) createUploadFolder();

  // Covers the case where the chat input rendered before this module registered its hook.
  initChatInterface();

  // Show the setup dialog to the GM only when at least one relevant role still lacks
  // FILES_UPLOAD permission. If permissions are already fully configured, mark as complete
  // without interrupting the GM.
  if (game.user.isGM && !getSetting(SETTING_SETUP_COMPLETE)) {
    if (SetupDialog.shouldShow()) {
      new SetupDialog().render(true);
    } else {
      setSetting(SETTING_SETUP_COMPLETE, true);
    }
  }
});

Hooks.once("setup", () => {
  Hooks.on("renderChatMessageHTML", (chatMessage, html) => {
    if (html.querySelector(".chat-snap-media-item")) initChatMessage(html);
  });
});
