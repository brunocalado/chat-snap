import {
  eventDataContainsMedia,
  getMediaQueue,
  processDropAndPaste,
  removeAllFromQueue,
} from "../processors/FileProcessor.js";
import { getUploadingStates } from "./Loader.js";
import { getSetting } from "../utils/Settings.js";

let hookIsHandlingTheMessage = false;
let eventIsHandlingTheMessage = false;
let processingDropOrPaste = false;

/**
 * Build the HTML for a single queued media item.
 * @param {{imageSrc: string, name?: string, type?: string}} mediaProps
 * @returns {string}
 */
const mediaTemplate = (mediaProps) => {
  const isVideo = mediaProps.type?.startsWith("video/");
  const isAudio = mediaProps.type?.startsWith("audio/");

  if (isAudio) {
    return `<div class="chat-snap-media-item">
  <audio controls src="${mediaProps.imageSrc}">
    <source src="${mediaProps.imageSrc}" type="${mediaProps.type}">
  </audio>
</div>`;
  }

  if (isVideo) {
    const autoplay = getSetting("videoAutoplay");

    return `<div class="chat-snap-media-item">
  <video class="chat-snap-video" data-src="${mediaProps.imageSrc}" src="${mediaProps.imageSrc}"${autoplay ? " autoplay" : ""} loop muted>
    <source src="${mediaProps.imageSrc}" type="${mediaProps.type}">
  </video>
  <p class="chat-snap-hint">Click to open larger</p>
</div>`;
  }

  return `<div class="chat-snap-media-item">
  <img data-src="${mediaProps.imageSrc}" src="${mediaProps.imageSrc}" alt="${mediaProps.name || "Unable to load image"}" />
  <p class="chat-snap-hint">Click to open larger</p>
</div>`;
};

/**
 * Build the chat message body wrapping all queued media items.
 * @param {object[]} mediaQueue
 * @returns {string}
 */
const messageTemplate = (mediaQueue) => {
  const templates = mediaQueue.map((props) => mediaTemplate(props));
  return `<div class="chat-snap-message">${templates.join("")}</div>`;
};

/**
 * `preCreateChatMessage` hook handler: if media is queued, fold it into the message being sent
 * (so typed notes and queued media ship together) and clear the queue.
 * @param {HTMLElement} sidebar
 * @returns {(chatMessage: ChatMessage, userOptions: object, messageOptions: object) => void}
 */
export const preCreateChatMessageHandler = (sidebar) => (chatMessage, userOptions, messageOptions) => {
  if (eventIsHandlingTheMessage) return;

  hookIsHandlingTheMessage = true;
  const mediaQueue = getMediaQueue();
  if (!mediaQueue.length) {
    hookIsHandlingTheMessage = false;
    return;
  }

  const uploadState = getUploadingStates(sidebar);
  uploadState.on();

  const content = `${messageTemplate(mediaQueue)}<div class="chat-snap-notes">${chatMessage.content}</div>`;
  chatMessage.content = content;
  chatMessage._source.content = content;
  messageOptions.chatBubble = false;

  removeAllFromQueue(sidebar);
  hookIsHandlingTheMessage = false;
  uploadState.off();
};

/**
 * Send queued media as its own message when Enter is pressed on an otherwise empty input.
 * @param {HTMLElement} sidebar
 * @returns {(evt: KeyboardEvent) => Promise<void>}
 */
const emptyChatEventHandler = (sidebar) => async (evt) => {
  if (hookIsHandlingTheMessage || (evt.code !== "Enter" && evt.code !== "NumpadEnter") || evt.shiftKey) return;
  eventIsHandlingTheMessage = true;

  const uploadState = getUploadingStates(sidebar);
  const mediaQueue = getMediaQueue();
  if (!mediaQueue.length) {
    eventIsHandlingTheMessage = false;
    return;
  }
  uploadState.on();

  await ChatMessage.create({
    content: messageTemplate(mediaQueue),
    style: CONST.CHAT_MESSAGE_STYLES.OOC,
  });
  removeAllFromQueue(sidebar);
  uploadState.off();
  eventIsHandlingTheMessage = false;
};

/**
 * Queue media dropped or pasted onto the chat input. Guards against duplicate processing of the
 * same gesture (some browsers fire both a paste and a drop for one action).
 *
 * Foundry v14's chat input is a native ProseMirror editor that also handles pasted/dropped images.
 * When the payload holds media, we suppress the event synchronously and in the capture phase so the
 * editor never embeds it too — otherwise the image is queued by us AND inlined by the editor,
 * producing the message twice. Text-only pastes fall through untouched so normal editing still works.
 * @param {HTMLElement} sidebar
 * @returns {(evt: ClipboardEvent|DragEvent) => Promise<void>}
 */
const pastAndDropEventHandler = (sidebar) => async (evt) => {
  if (processingDropOrPaste) return;

  const eventData = evt.clipboardData || evt.dataTransfer;
  // preventDefault/stopPropagation must run synchronously (before any await) to beat the editor.
  if (!eventDataContainsMedia(eventData)) return;

  evt.preventDefault();
  evt.stopPropagation();

  processingDropOrPaste = true;
  try {
    await processDropAndPaste(eventData, sidebar);
  } finally {
    processingDropOrPaste = false;
  }
};

/**
 * Attach the chat-input listeners that power queued-media sending and drag/drop/paste capture.
 * Called from the `ready` hook via module.js.
 * @param {HTMLElement} sidebar  The chat sidebar container.
 * @returns {void}
 */
export const initChatSidebar = (sidebar) => {
  Hooks.on("preCreateChatMessage", preCreateChatMessageHandler(sidebar));

  const textArea = sidebar.querySelector("#chat-message");
  if (!textArea) {
    console.warn("Chat Snap: #chat-message not found; drag/drop disabled");
    return;
  }

  textArea.addEventListener("keyup", emptyChatEventHandler(sidebar));
  // Capture phase: fire before the ProseMirror editor's own paste/drop handlers so stopPropagation
  // can prevent the editor from also consuming the same media (see pastAndDropEventHandler).
  textArea.addEventListener("paste", pastAndDropEventHandler(sidebar), { capture: true });
  textArea.addEventListener("drop", pastAndDropEventHandler(sidebar), { capture: true });
  textArea.addEventListener("dragover", (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
  });
  textArea.addEventListener("dragenter", (evt) => {
    evt.preventDefault();
    evt.stopPropagation();
  });
};
