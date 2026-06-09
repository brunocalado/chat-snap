import { ORIGIN_FOLDER, randomString, userCanUpload } from "../utils/Utils.js";
import { htmlToElement } from "../helpers.js";
import { anchorUploadArea } from "../components/UploadArea.js";
import { getSetting, createUploadFolder } from "../utils/Settings.js";
import { MODULE_ID, SETTING_USE_DATE_FOLDERS } from "../constants.js";

const RESTRICTED_DOMAINS = ["static.wikia"];

const DOM_PARSER = new DOMParser();

let mediaQueue = [];

const IMAGE_EXTENSIONS = [".apng", ".avif", ".bmp", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".tiff", ".webp"];
const VIDEO_EXTENSIONS = [".webm", ".m4v", ".mp4", ".ogv"];
const AUDIO_EXTENSIONS = [".mp3", ".wav", ".ogg", ".opus", ".flac", ".aac"];
const PDF_EXTENSIONS = [".pdf"];
// All text/data formats allowed by Foundry's upload whitelist that the module supports.
const TEXT_EXTENSIONS = [".txt", ".json", ".csv"];

/**
 * @param {File|DataTransferItem} file
 * @returns {string}  Lower-cased file extension including the leading dot, or "".
 */
const fileExtension = (file) => {
  const name = file.name || "";
  return name.substring(name.lastIndexOf(".")).toLowerCase();
};

/** @param {File|DataTransferItem} file @returns {boolean} */
const isFileImage = (file) => IMAGE_EXTENSIONS.includes(fileExtension(file));

/** @param {File|DataTransferItem} file @returns {boolean} */
const isFileVideo = (file) => VIDEO_EXTENSIONS.includes(fileExtension(file));

/** @param {File|DataTransferItem} file @returns {boolean} */
const isFileAudio = (file) => AUDIO_EXTENSIONS.includes(fileExtension(file));

/** @param {File|DataTransferItem} file @returns {boolean} */
const isFilePdf = (file) => PDF_EXTENSIONS.includes(fileExtension(file));

/** @param {File|DataTransferItem} file @returns {boolean} */
const isFileText = (file) => TEXT_EXTENSIONS.includes(fileExtension(file));

/** @param {File|DataTransferItem} file @returns {boolean} */
const isAllowedFile = (file) => isFileImage(file) || isFileVideo(file) || isFileAudio(file) || isFilePdf(file) || isFileText(file);

/**
 * Resolve the active FilePicker implementation so host environments can substitute their own.
 * @returns {typeof foundry.applications.apps.FilePicker}
 */
const getFilePicker = () =>
  foundry.applications.apps.FilePicker.implementation ?? foundry.applications.apps.FilePicker;

/**
 * True when this save value represents an audio file, checking MIME type first and
 * falling back to the filename extension so empty-type edge cases are covered.
 * @param {{type?: string, name?: string}} saveValue
 * @returns {boolean}
 */
const isSaveValueAudio = (saveValue) =>
  saveValue.type?.startsWith("audio/") || (!!saveValue.name && isFileAudio({ name: saveValue.name }));

/**
 * True when this save value represents a PDF file.
 * @param {{type?: string, name?: string}} saveValue
 * @returns {boolean}
 */
const isSaveValuePdf = (saveValue) =>
  saveValue.type === "application/pdf" || (!!saveValue.name && isFilePdf({ name: saveValue.name }));

/**
 * True when this save value represents a plain-text, JSON, or CSV file.
 * @param {{type?: string, name?: string}} saveValue
 * @returns {boolean}
 */
const isSaveValueText = (saveValue) =>
  saveValue.type === "text/plain" ||
  saveValue.type === "application/json" ||
  saveValue.type === "text/csv" ||
  (!!saveValue.name && isFileText({ name: saveValue.name }));

/**
 * Classify a queued item into one of four mutually-exclusive media categories.
 * @param {{type?: string, name?: string}} saveValue
 * @returns {"audio"|"pdf"|"text"|"visual"}
 */
const getMediaType = (saveValue) => {
  if (isSaveValueAudio(saveValue)) return "audio";
  if (isSaveValuePdf(saveValue)) return "pdf";
  if (isSaveValueText(saveValue)) return "text";
  return "visual";
};

/**
 * Build a preview tile (image, video, audio badge, PDF badge, or text badge) for the upload strip.
 * @param {{imageSrc: string, id: string, type?: string, name?: string}} saveValue
 * @returns {HTMLElement}
 */
const createMediaPreview = ({ imageSrc, id, type, name }) => {
  const isVideo = type?.startsWith("video/");
  const isAudio = type?.startsWith("audio/") || (!!name && isFileAudio({ name }));
  const isPdf = type === "application/pdf" || (!!name && isFilePdf({ name }));

  if (isAudio) {
    const shortName = (name || "audio").replace(/\.[^.]+$/, "");
    return htmlToElement(
      `<div id="${id}" class="chat-snap-upload-area-item chat-snap-audio-preview">
                <i class="chat-snap-remove-icon fa-regular fa-circle-xmark"></i>
                <i class="chat-snap-audio-icon fa-solid fa-music"></i>
                <span class="chat-snap-audio-filename">${shortName}</span>
            </div>`,
    );
  }

  if (isPdf) {
    const shortName = (name || "document").replace(/\.[^.]+$/, "");
    return htmlToElement(
      `<div id="${id}" class="chat-snap-upload-area-item chat-snap-pdf-preview">
                <i class="chat-snap-remove-icon fa-regular fa-circle-xmark"></i>
                <i class="chat-snap-pdf-icon fa-regular fa-file-pdf"></i>
                <span class="chat-snap-pdf-filename">${shortName}</span>
            </div>`,
    );
  }

  const isText = type === "text/plain" || type === "application/json" || type === "text/csv" || (!!name && isFileText({ name }));
  if (isText) {
    const shortName = (name || "file").replace(/\.[^.]+$/, "");
    const ext = fileExtension({ name: name ?? "" });
    const icon = ext === ".json" || type === "application/json"
      ? "fa-solid fa-code"
      : ext === ".csv" || type === "text/csv"
        ? "fa-solid fa-table"
        : "fa-regular fa-file-lines";
    return htmlToElement(
      `<div id="${id}" class="chat-snap-upload-area-item chat-snap-text-preview">
                <i class="chat-snap-remove-icon fa-regular fa-circle-xmark"></i>
                <i class="chat-snap-text-icon ${icon}"></i>
                <span class="chat-snap-text-filename">${shortName}</span>
            </div>`,
    );
  }

  if (isVideo) {
    const autoplay = getSetting("videoAutoplay");
    return htmlToElement(
      `<div id="${id}" class="chat-snap-upload-area-item">
                <i class="chat-snap-remove-icon fa-regular fa-circle-xmark"></i>
                <video class="chat-snap-media-preview" data-src="${imageSrc}" src="${imageSrc}"${autoplay ? " autoplay" : ""} loop muted>
                    <source src="${imageSrc}" type="${type}">
                </video>
            </div>`,
    );
  }

  return htmlToElement(
    `<div id="${id}" class="chat-snap-upload-area-item">
                <i class="chat-snap-remove-icon fa-regular fa-circle-xmark"></i>
                <img class="chat-snap-media-preview" data-src="${imageSrc}" src="${imageSrc}" alt="Unable to load image"/>
            </div>`,
  );
};

/**
 * Remove a queued preview (and its data) when its close icon is clicked.
 * @param {HTMLElement} removeButton  The close icon.
 * @param {{id: string}} saveValue  The queued media descriptor.
 * @param {HTMLElement} uploadArea  The preview strip.
 * @returns {void}
 */
const addEventToRemoveButton = (removeButton, saveValue, uploadArea) => {
  removeButton.addEventListener("click", () => {
    uploadArea.querySelector(`[id="${saveValue.id}"]`)?.remove();
    mediaQueue = mediaQueue.filter((item) => saveValue.id !== item.id);

    if (!mediaQueue.length) uploadArea.classList.add("hidden");
  });
};

/**
 * Ensure the target upload folder exists. GMs call Settings.createUploadFolder directly;
 * non-GM users (who lack FILES_BROWSE) ask the active GM via a socket query instead.
 * Falls through silently when no GM is available so the upload can still be attempted
 * (the folder may already exist from an earlier upload that session).
 * @param {string} folderPath  Server-relative folder path to ensure.
 * @returns {Promise<void>}
 */
const ensureFolder = async (folderPath) => {
  if (game.user.isGM) {
    await createUploadFolder(folderPath);
    return;
  }
  // Queries target a specific User document; find any active GM to handle the request.
  const gm = game.users.find(u => u.isGM && u.active);
  if (!gm) {
    console.warn("Chat Snap: No active GM found to create upload folder; proceeding without it.");
    return;
  }
  try {
    await gm.query(`${MODULE_ID}.ensureFolder`, { folderPath });
  } catch (e) {
    // Query timed out or GM rejected; proceed and let the upload surface any real error.
    console.warn("Chat Snap: Could not ensure upload folder via GM query:", e);
  }
};

/**
 * Upload a local file to the configured location, organized into a date subfolder
 * when the useDateFolders setting is enabled.
 * @param {{type?: string, name?: string, id: string, imageSrc: string, file: File}} saveValue
 * @returns {Promise<string>}  The uploaded path, or the original source on failure.
 */
const uploadFile = async (saveValue) => {
  const generateFileName = (saveValue) => {
    const { type, name, id } = saveValue;
    let ext = name?.substring(name.lastIndexOf("."), name.length);

    if (!ext) {
      if (type?.startsWith("image/")) {
        ext = type.replace("image/", ".") || ".jpeg";
      } else if (type?.startsWith("video/")) {
        ext = type.replace("video/", ".") || ".mp4";
      } else if (type?.startsWith("audio/")) {
        ext = type.replace("audio/", ".").split(";")[0] || ".mp3";
      } else if (type === "application/pdf") {
        ext = ".pdf";
      } else if (type === "text/plain") {
        ext = ".txt";
      } else if (type === "application/json") {
        ext = ".json";
      } else if (type === "text/csv") {
        ext = ".csv";
      } else {
        throw new Error("Unsupported file type for upload");
      }
    }

    return `${id}${ext}`;
  };

  try {
    const newName = generateFileName(saveValue);
    const fileToUpload = new File([saveValue.file], newName, { type: saveValue.type });

    const uploadLocation = getSetting("uploadLocation");
    const useDateFolders = getSetting(SETTING_USE_DATE_FOLDERS);

    let effectiveLocation = uploadLocation;
    if (useDateFolders) {
      const dateFolder = new Date().toISOString().slice(0, 10);
      effectiveLocation = `${uploadLocation}/${dateFolder}`;
    }

    await ensureFolder(effectiveLocation);

    const FilePicker = getFilePicker();
    const fileLocation = await FilePicker.upload(ORIGIN_FOLDER, effectiveLocation, fileToUpload, {}, { notify: false });

    if (!fileLocation || !fileLocation.path) return saveValue.imageSrc;
    return fileLocation.path;
  } catch (e) {
    console.error("Chat Snap: Error uploading file:", e);
    return saveValue.imageSrc;
  }
};

/**
 * Return true when the incoming item's media type differs from what is already queued.
 * Audio, PDF, text, and visual media (image/video) cannot coexist in the same message.
 * @param {"audio"|"pdf"|"text"|"visual"} incomingType
 * @returns {boolean}
 */
const queueConflicts = (incomingType) => {
  if (!mediaQueue.length) return false;
  return getMediaType(mediaQueue[0]) !== incomingType;
};

/**
 * Upload (if needed) and add a media item to the preview queue. The loading-bar lifecycle is owned
 * by the caller (the drop/paste handler), not this function, so the indicator can show from the very
 * start of the gesture and stay up until every queued item finishes.
 * @param {object} saveValue  The media descriptor.
 * @returns {Promise<void>}
 */
const addMediaToQueue = async (saveValue) => {
  // Re-dock the strip above the live chat input first: the input may have moved (sidebar collapse/
  // expand) since it was last positioned, and the strip must follow it wherever it now lives.
  anchorUploadArea();
  const uploadArea = document.querySelector("#chat-snap-chat-upload-area");
  if (!uploadArea) return;

  const incomingType = getMediaType(saveValue);
  const isSingleSlot = incomingType === "audio" || incomingType === "pdf" || incomingType === "text";

  // Single-slot types silently replace an existing item of the same type.
  if (isSingleSlot && mediaQueue.length && getMediaType(mediaQueue[0]) === incomingType) {
    const existing = mediaQueue[0];
    uploadArea.querySelector(`[id="${existing.id}"]`)?.remove();
    mediaQueue = [];
  }

  if (queueConflicts(incomingType)) {
    ui.notifications?.warn("Chat Snap: Cannot mix audio, PDF, and visual media in the same message.");
    return;
  }

  if (saveValue.file) {
    if (!userCanUpload()) return;
    saveValue.imageSrc = await uploadFile(saveValue);
  }

  const mediaPreview = createMediaPreview(saveValue);
  if (!mediaPreview) return;

  uploadArea.classList.remove("hidden");
  uploadArea.append(mediaPreview);
  mediaQueue.push(saveValue);

  const removeButton = mediaPreview.querySelector(".chat-snap-remove-icon");
  addEventToRemoveButton(removeButton, saveValue, uploadArea);
};

/**
 * Read a single local file as a data URL and queue it. Resolves once the item is queued (or the read
 * fails), so callers can await full completion of a drop/paste before hiding the loading bar.
 * @param {File} file
 * @returns {Promise<void>}
 */
const readAndQueueFile = (file) =>
  new Promise((resolve) => {
    const reader = new FileReader();
    reader.addEventListener("load", async (evt) => {
      const imageSrc = evt.target?.result;
      const saveValue = { type: file.type, name: file.name, imageSrc, id: randomString(), file };
      await addMediaToQueue(saveValue);
      resolve();
    });
    reader.addEventListener("error", () => {
      console.warn(`Chat Snap: Failed to read file: ${file.name}`);
      resolve();
    });
    reader.readAsDataURL(file);
  });

/**
 * Read and queue a list of local files dragged onto the chat input. Awaits every read so the
 * surrounding loading-bar guard stays active until all files are processed.
 * @param {FileList|File[]} files
 * @returns {Promise<void>}
 */
export const processFiles = async (files) => {
  const reads = [];
  for (const file of files) {
    if (!isAllowedFile(file)) {
      console.warn(`Chat Snap: File type not allowed: ${file.name}`);
      continue;
    }
    reads.push(readAndQueueFile(file));
  }
  await Promise.all(reads);
};

/**
 * Extract embeddable image URLs from a clipboard/drag payload's HTML representation.
 * @param {DataTransfer} eventData  The clipboardData or dataTransfer payload.
 * @returns {string[]|null}  Image URLs, or null when none are present/allowed.
 */
const extractUrlFromEventData = (eventData) => {
  try {
    const html = eventData.getData("text/html");
    if (!html) return null;

    const images = DOM_PARSER.parseFromString(html, "text/html").querySelectorAll("img");
    if (!images || !images.length) return null;

    const imageUrls = [...images].map((img) => img.src);
    const imagesContainRestrictedDomains = imageUrls.some((iu) => RESTRICTED_DOMAINS.some((rd) => iu.includes(rd)));
    return imagesContainRestrictedDomains ? null : imageUrls;
  } catch (error) {
    console.error("Chat Snap: Error extracting URL from event data:", error);
    return null;
  }
};

/**
 * Extract a media URL from the clipboard's plain-text representation.
 * Handles the case where the user pastes a bare URL string with no HTML wrapping,
 * e.g. pasting a direct image link from an address bar or chat.
 * @param {DataTransfer} eventData  The clipboardData or dataTransfer payload.
 * @returns {string[]|null}  The URL in a single-element array, or null when not a media URL.
 */
const extractPlainTextUrlFromEventData = (eventData) => {
  try {
    const text = eventData.getData("text/plain")?.trim();
    if (!text || text.includes("\n")) return null;

    let url;
    try { url = new URL(text); } catch { return null; }
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;

    const pathname = url.pathname.toLowerCase();
    const ALL_EXTENSIONS = [...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS, ...PDF_EXTENSIONS, ...TEXT_EXTENSIONS];
    if (!ALL_EXTENSIONS.some(ext => pathname.endsWith(ext))) return null;

    return [text];
  } catch (error) {
    console.error("Chat Snap: Error extracting plain text URL:", error);
    return null;
  }
};

/**
 * Extract allowed media files from a drag payload's item list.
 * @param {DataTransfer} eventData  The clipboardData or dataTransfer payload.
 * @returns {File[]}  Allowed media files (empty when none).
 */
const extractFilesFromEventData = (eventData) => {
  if (!eventData.items) return [];

  const files = [];
  try {
    for (const item of eventData.items) {
      if (item.kind !== "file") continue;

      const file = item.getAsFile();
      if (!file || !isAllowedFile(file)) continue;

      files.push(file);
    }
  } catch (error) {
    console.error("Chat Snap: Error processing event data items:", error);
  }
  return files;
};

/**
 * Synchronously test whether a paste/drop payload holds media this module would queue.
 * Must stay synchronous so callers can decide to `preventDefault()` before the browser's
 * default action (and Foundry v14's native ProseMirror paste/drop) consumes the same media.
 * @param {DataTransfer} eventData  The clipboardData or dataTransfer payload.
 * @returns {boolean}
 */
export const eventDataContainsMedia = (eventData) => {
  if (!eventData) return false;

  const urls = extractUrlFromEventData(eventData) ?? extractPlainTextUrlFromEventData(eventData);
  if (urls && urls.length) return true;

  return extractFilesFromEventData(eventData).length > 0;
};

/**
 * Queue media from a paste or drop: prefer image URLs in the payload, otherwise read files.
 * @param {DataTransfer} eventData  The clipboardData or dataTransfer payload.
 * @returns {Promise<void>}
 */
export const processDropAndPaste = async (eventData) => {
  if (!eventData) return;

  const urlsFromEventDataHandler = async (urls) => {
    for (let i = 0; i < urls.length; i++) {
      const saveValue = { imageSrc: urls[i], id: randomString() };
      await addMediaToQueue(saveValue);
    }
  };

  const urls = extractUrlFromEventData(eventData);
  if (urls && urls.length) return await urlsFromEventDataHandler(urls);

  const plainUrls = extractPlainTextUrlFromEventData(eventData);
  if (plainUrls && plainUrls.length) {
    const filename = new URL(plainUrls[0]).pathname.split("/").pop();
    for (const url of plainUrls) {
      const saveValue = { imageSrc: url, id: randomString(), name: filename };
      await addMediaToQueue(saveValue);
    }
    return;
  }

  const filesExtracted = extractFilesFromEventData(eventData);
  if (filesExtracted && filesExtracted.length) return await processFiles(filesExtracted);
};

/** @returns {object[]}  The current preview queue. */
export const getMediaQueue = () => mediaQueue;

/**
 * Empty the preview queue and clear the strip.
 * @returns {void}
 */
export const removeAllFromQueue = () => {
  const uploadArea = document.querySelector("#chat-snap-chat-upload-area");

  while (mediaQueue.length) {
    const item = mediaQueue.pop();
    if (!item) continue;
    uploadArea?.querySelector(`[id="${item.id}"]`)?.remove();
  }

  uploadArea?.classList.add("hidden");
};
