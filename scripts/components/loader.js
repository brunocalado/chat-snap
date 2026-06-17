const LOADING_CLASS = "chat-snap-loading";

/**
 * In-flight upload/send operations. The loading bar stays visible while this is > 0 so that
 * overlapping operations (e.g. a multi-file drop) don't hide the bar before all of them finish.
 * @type {number}
 */
let activeOperations = 0;

/**
 * Enable or disable the chat input while an upload is in flight.
 * @param {HTMLElement|null} chat  The chat input element (`<prose-mirror>`).
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
 * Show or hide the horizontal loading bar by toggling a class on the chat `<prose-mirror>` host.
 * The bar itself is a CSS `::before` on the `#chat-message` host element (see base.css) — never on an
 * inner child, because disabling the input tears down and rebuilds the prose-mirror's inner containers
 * and would wipe a bar attached to a child. The host is re-queried from the live document on every call
 * so a stale reference to a replaced prose-mirror is never used.
 * @param {boolean} visible  Whether the bar should be shown.
 * @returns {void}
 */
const toggleLoadingBar = (visible) => {
  const host = document.querySelector("#chat-message");
  host?.classList.toggle(LOADING_CLASS, visible);
};

/**
 * Build the on/off controls that gate the chat input and toggle the loading bar during uploads.
 * Reference-counted: each `on()` must be paired with an `off()`; the bar hides only once the last
 * operation completes.
 * @param {HTMLElement} sidebar  The chat sidebar container.
 * @returns {{on: () => void, off: () => void}}
 */
export const getUploadingStates = (sidebar) => {
  const chat = sidebar.querySelector("#chat-message");

  return {
    on() {
      activeOperations++;
      toggleChat(chat, false);
      toggleLoadingBar(true);
    },
    off() {
      activeOperations = Math.max(0, activeOperations - 1);
      if (activeOperations > 0) return;
      toggleChat(chat, true);
      toggleLoadingBar(false);
    },
  };
};
