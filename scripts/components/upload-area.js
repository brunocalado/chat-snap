/*!
 * Chat Snap
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

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
 * Keep the preview strip docked immediately above the live chat input. Foundry relocates the
 * `<prose-mirror id="chat-message">` between the collapsed popout (`#ui-right-column-1`) and the
 * expanded sidebar (`#sidebar`) on every collapse/expand; the strip is a separate node that does not
 * travel with it, so it must be re-parented to stay above whichever location currently holds the input.
 * Both elements carry stable ids, so they are resolved from the live document rather than a captured
 * (and possibly relocated) container reference.
 * @returns {void}
 */
export const anchorUploadArea = () => {
  const uploadArea = document.querySelector("#chat-snap-chat-upload-area");
  const chatMessage = document.querySelector("#chat-message");
  if (!uploadArea || !chatMessage) return;
  if (chatMessage.previousElementSibling === uploadArea) return;
  chatMessage.before(uploadArea);
};

/**
 * Create the preview strip, dock it above the chat input, and keep it docked when the sidebar is
 * collapsed/expanded (which relocates the chat input).
 * Called from the `renderChatInput` hook via module.js, so it must be safe to call repeatedly:
 * once the strip exists it is only re-anchored, never rebuilt (which would drop queued previews).
 * @returns {void}
 */
export const initUploadArea = () => {
  if (document.querySelector("#chat-snap-chat-upload-area")) {
    anchorUploadArea();
    return;
  }

  const uploadArea = createUploadArea();
  document.querySelector("#chat-message")?.before(uploadArea);

  setupHorizontalScrolling(uploadArea);

  // collapseSidebar fires when the sidebar toggles, which moves the chat input between the popout and
  // the sidebar. Re-dock on the next frame, after Foundry has finished relocating the input.
  Hooks.on("collapseSidebar", () => requestAnimationFrame(anchorUploadArea));
};
