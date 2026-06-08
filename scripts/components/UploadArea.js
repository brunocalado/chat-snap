import { htmlToElement } from "../helpers.js";

/**
 * Build the (initially hidden) strip that previews queued media before sending.
 * @returns {HTMLElement}
 */
const createUploadArea = () => htmlToElement(`<div id="chat-snap-chat-upload-area" class="hidden"></div>`);

/**
 * Convert vertical wheel scrolling into horizontal scrolling while the sidebar is collapsed,
 * so a row of previews can be navigated without an expanded sidebar.
 * @param {HTMLElement} uploadArea  The preview strip element.
 * @returns {void}
 */
const setupHorizontalScrolling = (uploadArea) => {
  if (!uploadArea) return;

  const handleWheel = (e) => {
    const sidebarContent = document.querySelector("#sidebar-content");
    const isExpanded = sidebarContent?.classList.contains("expanded");
    if (!isExpanded) {
      e.preventDefault();
      uploadArea.scrollLeft += e.deltaY;
    }
  };

  uploadArea.addEventListener("wheel", handleWheel, { passive: false });
};

/**
 * Insert the preview strip just above the chat input.
 * Called from the `ready` hook via module.js.
 * @param {HTMLElement} sidebar  The chat sidebar container.
 * @returns {void}
 */
export const initUploadArea = (sidebar) => {
  const uploadArea = createUploadArea();
  const chatMessage = sidebar.querySelector("#chat-message");
  if (chatMessage) chatMessage.before(uploadArea);

  setupHorizontalScrolling(uploadArea);
};
