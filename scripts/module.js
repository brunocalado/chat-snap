import { initUploadArea } from "./components/UploadArea.js";
import { initChatSidebar } from "./components/ChatSidebar.js";
import { initChatMessage } from "./components/ChatMessage.js";
import { createUploadFolder, getSettings, registerSetting, getSetting, setSetting } from "./utils/Settings.js";
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
  // Non-GM users lack FILES_BROWSE permission and cannot call createUploadFolder directly.
  // This query runs on any active GM client, which creates the folder on the player's behalf.
  CONFIG.queries[`${MODULE_ID}.ensureFolder`] = async (_userId, { folderPath }) => {
    await createUploadFolder(folderPath);
    return true;
  };
});

Hooks.once("ready", () => {
  // Only GM can browse/create directories; ensure the base upload folder exists now that
  // game.user is fully initialised.
  if (game.user.isGM) createUploadFolder();

  const chatMessage = document.querySelector("#chat-message");
  if (!chatMessage) return;

  const sidebar = chatMessage.closest("#sidebar") ?? chatMessage.parentElement.parentElement;
  initUploadArea(sidebar);
  initChatSidebar(sidebar);

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
