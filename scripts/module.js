import { initUploadArea } from "./components/UploadArea.js";
import { initChatSidebar } from "./components/ChatSidebar.js";
import { initChatMessage } from "./components/ChatMessage.js";
import { createUploadFolder, getSettings, registerSetting, getSetting, setSetting } from "./utils/Settings.js";
import { SetupDialog } from "./setup/setup-dialog.js";
import { SETTING_SETUP_COMPLETE } from "./constants.js";

/**
 * Register every module setting declared in Settings.js.
 * Called from the `init` hook.
 * @returns {void}
 */
const registerSettings = () => {
  const settings = getSettings();
  settings.forEach((setting) => registerSetting(setting));
};

Hooks.once("init", async () => {
  registerSettings();
  await createUploadFolder();
});

Hooks.once("ready", () => {
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
    if (html.querySelector(".chat-snap-image")) initChatMessage(html);
  });
});
