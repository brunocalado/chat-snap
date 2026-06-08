import { htmlToElement } from "../helpers.js";

/**
 * Enable or disable the chat input while an upload is in flight.
 * @param {HTMLElement|null} chat  The chat textarea.
 * @param {boolean} enabled  Whether the input should accept text.
 * @returns {void}
 */
const toggleChat = (chat, enabled) => {
  if (!chat) return;
  if (!enabled) {
    chat.setAttribute("disabled", "true");
    return;
  }
  chat.removeAttribute("disabled");
  chat.focus();
};

/**
 * Show or hide the upload spinner inside the chat form.
 * @param {HTMLElement} chatForm  The container that hosts the spinner.
 * @param {boolean} visible  Whether the spinner should be shown.
 * @returns {void}
 */
const toggleSpinner = (chatForm, visible) => {
  const spinnerId = "chat-snap-spinner";
  const spinner = chatForm.querySelector(`#${spinnerId}`);

  if (!visible) {
    spinner?.remove();
    return;
  }

  if (!spinner) chatForm.append(htmlToElement(`<div id="${spinnerId}"></div>`));
};

/**
 * Build the on/off controls that gate the chat input and toggle the spinner during uploads.
 * @param {HTMLElement} sidebar  The chat sidebar container.
 * @returns {{on: () => void, off: () => void}}
 */
export const getUploadingStates = (sidebar) => {
  const chat = sidebar.querySelector("#chat-message");

  return {
    on() {
      toggleChat(chat, false);
      toggleSpinner(sidebar, true);
    },
    off() {
      toggleChat(chat, true);
      toggleSpinner(sidebar, false);
    },
  };
};
