import {
  eventDataContainsMedia,
  getMediaQueue,
  processDropAndPaste,
  removeAllFromQueue,
} from "../processors/file-processor.js";
import { getUploadingStates } from "./loader.js";
import { getSetting } from "../utils/settings.js";
import { MODEL_EXTENSIONS } from "../constants.js";

let hookIsHandlingTheMessage = false;
let eventIsHandlingTheMessage = false;
let processingDropOrPaste = false;

/**
 * Return the FontAwesome icon class for a text/data file extension.
 * @param {string} name  Filename (extension extracted internally).
 * @returns {string}
 */
const getTextIcon = (name) => {
  const ext = (name ?? "").substring((name ?? "").lastIndexOf(".")).toLowerCase();
  if (ext === ".json") return "fa-solid fa-code";
  if (ext === ".csv" || ext === ".tsv") return "fa-solid fa-table";
  if (ext === ".xml" || ext === ".yml" || ext === ".yaml") return "fa-regular fa-file-code";
  if (ext === ".md") return "fa-brands fa-markdown";
  return "fa-regular fa-file-lines";
};

/**
 * Return the FontAwesome icon class for a downloadable (font / 3D asset) file.
 * @param {string} name  Filename (extension extracted internally).
 * @returns {string}
 */
const getDownloadableIcon = (name) => {
  const ext = (name ?? "").substring((name ?? "").lastIndexOf(".")).toLowerCase();
  if ([".otf", ".ttf", ".woff", ".woff2"].includes(ext)) return "fa-solid fa-font";
  return "fa-solid fa-cube";
};

/**
 * Build the HTML for a single queued media item.
 * @param {{imageSrc: string, name?: string, type?: string}} mediaProps
 * @returns {string}
 */
const mediaTemplate = (mediaProps) => {
  const isVideo = mediaProps.type?.startsWith("video/");
  const isAudio = mediaProps.type?.startsWith("audio/");
  const isPdf =
    mediaProps.type === "application/pdf" || mediaProps.name?.toLowerCase().endsWith(".pdf");

  const TEXT_EXTS = [".txt", ".json", ".csv", ".md", ".tsv", ".xml", ".yml", ".yaml"];
  const nameExt = mediaProps.name ? mediaProps.name.substring(mediaProps.name.lastIndexOf(".")).toLowerCase() : "";
  const isText =
    mediaProps.type === "text/plain" ||
    mediaProps.type === "application/json" ||
    mediaProps.type === "text/csv" ||
    mediaProps.type === "text/markdown" ||
    mediaProps.type === "text/x-markdown" ||
    mediaProps.type === "text/tab-separated-values" ||
    mediaProps.type === "text/xml" ||
    mediaProps.type === "application/xml" ||
    mediaProps.type === "text/yaml" ||
    mediaProps.type === "application/yaml" ||
    TEXT_EXTS.includes(nameExt);

  const isModel = MODEL_EXTENSIONS.includes(nameExt);

  const DOWNLOAD_EXTS = [".otf", ".ttf", ".woff", ".woff2", ".basis", ".ktx2", ".fbx", ".mtl", ".obj", ".stl", ".usdz"];
  const isDownloadable = DOWNLOAD_EXTS.includes(nameExt);

  if (isAudio) {
    return `<div class="chat-snap-media-item">
  <audio controls src="${mediaProps.imageSrc}">
    <source src="${mediaProps.imageSrc}" type="${mediaProps.type}">
  </audio>
</div>`;
  }

  if (isPdf) {
    const shortName = (mediaProps.name || "document").replace(/\.[^.]+$/, "");
    return `<div class="chat-snap-media-item chat-snap-pdf-item"
     data-pdf-src="${mediaProps.imageSrc}"
     data-pdf-name="${shortName}">
  <i class="fa-regular fa-file-pdf"></i>
  <span class="chat-snap-pdf-filename">${shortName}</span>
  <p class="chat-snap-hint">Click to view</p>
</div>`;
  }

  if (isText) {
    const shortName = (mediaProps.name || "file").replace(/\.[^.]+$/, "");
    const isJson = mediaProps.type === "application/json" || nameExt === ".json";
    return `<div class="chat-snap-media-item chat-snap-text-item"
     data-text-src="${mediaProps.imageSrc}"
     data-text-name="${shortName}"
     data-text-json="${isJson ? "true" : "false"}">
  <i class="${getTextIcon(mediaProps.name)}"></i>
  <span class="chat-snap-text-filename">${shortName}</span>
  <p class="chat-snap-hint">Click to view</p>
</div>`;
  }

  if (isModel) {
    const shortName = (mediaProps.name || "model").replace(/\.[^.]+$/, "");
    return `<div class="chat-snap-media-item chat-snap-model-item"
     data-model-src="${mediaProps.imageSrc}"
     data-model-name="${shortName}">
  <i class="fa-solid fa-cube"></i>
  <span class="chat-snap-model-filename">${shortName}</span>
  <p class="chat-snap-hint">Click to view 3D</p>
</div>`;
  }

  if (isDownloadable) {
    const shortName = (mediaProps.name || "file").replace(/\.[^.]+$/, "");
    return `<div class="chat-snap-media-item chat-snap-downloadable-item"
     data-download-src="${mediaProps.imageSrc}"
     data-download-name="${shortName}">
  <i class="${getDownloadableIcon(mediaProps.name)}"></i>
  <span class="chat-snap-downloadable-filename">${shortName}</span>
  <p class="chat-snap-hint">Click to download</p>
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

  removeAllFromQueue();
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
  removeAllFromQueue();
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

  // Show the loading bar the instant media is dropped/pasted — before files are read or uploaded —
  // so the indicator reflects the start of the operation rather than its tail end.
  const uploadState = getUploadingStates(sidebar);
  uploadState.on();

  processingDropOrPaste = true;
  try {
    await processDropAndPaste(eventData);
  } finally {
    processingDropOrPaste = false;
    uploadState.off();
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
