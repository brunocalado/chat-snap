import { ORIGIN_FOLDER, randomString, userCanUpload } from "../utils/Utils.js";
import { htmlToElement } from "../helpers.js";
import { getUploadingStates } from "../components/Loader.js";
import { getSetting, createUploadFolder } from "../utils/Settings.js";
import { SETTING_USE_DATE_FOLDERS } from "../constants.js";

const RESTRICTED_DOMAINS = ["static.wikia"];

const DOM_PARSER = new DOMParser();

let mediaQueue = [];

const IMAGE_EXTENSIONS = [".apng", ".avif", ".bmp", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".tiff", ".webp"];
const VIDEO_EXTENSIONS = [".webm", ".m4v", ".mp4", ".ogv"];
const AUDIO_EXTENSIONS = [".mp3", ".wav", ".ogg", ".opus", ".flac", ".aac"];

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
const isAllowedFile = (file) => isFileImage(file) || isFileVideo(file) || isFileAudio(file);

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
 * Build a preview tile (image, video, or audio badge) for the upload strip.
 * @param {{imageSrc: string, id: string, type?: string, name?: string}} saveValue
 * @returns {HTMLElement}
 */
const createMediaPreview = ({ imageSrc, id, type, name }) => {
  const isVideo = type?.startsWith("video/");
  const isAudio = type?.startsWith("audio/") || (!!name && isFileAudio({ name }));

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
      await createUploadFolder(effectiveLocation);
    }

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
 * Return true when the incoming item conflicts with what is already queued.
 * Audio and visual media (image/video) cannot coexist in the same message.
 * @param {boolean} incomingIsAudio
 * @returns {boolean}
 */
const queueConflicts = (incomingIsAudio) => {
  if (!mediaQueue.length) return false;
  const queueHasAudio = mediaQueue.some((item) => isSaveValueAudio(item));
  // incoming visual + queued audio, or incoming audio + queued visual
  return incomingIsAudio !== queueHasAudio;
};

/**
 * Upload (if needed) and add a media item to the preview queue.
 * @param {object} saveValue  The media descriptor.
 * @param {HTMLElement} sidebar  The chat sidebar container.
 * @returns {Promise<void>}
 */
const addMediaToQueue = async (saveValue, sidebar) => {
  const uploadingStates = getUploadingStates(sidebar);

  uploadingStates.on();
  const uploadArea = sidebar.querySelector("#chat-snap-chat-upload-area");
  if (!uploadArea) return;

  const incomingIsAudio = isSaveValueAudio(saveValue);

  if (queueConflicts(incomingIsAudio)) {
    ui.notifications?.warn("Chat Snap: Cannot mix audio and visual media in the same message.");
    uploadingStates.off();
    return;
  }

  // Audio is single-slot: silently replace any existing audio item before adding the new one.
  if (incomingIsAudio && mediaQueue.length) {
    const existing = mediaQueue[0];
    uploadArea.querySelector(`[id="${existing.id}"]`)?.remove();
    mediaQueue = [];
  }

  if (saveValue.file) {
    if (!userCanUpload()) {
      uploadingStates.off();
      return;
    }
    saveValue.imageSrc = await uploadFile(saveValue);
  }

  const mediaPreview = createMediaPreview(saveValue);
  if (!mediaPreview) return;

  uploadArea.classList.remove("hidden");
  uploadArea.append(mediaPreview);
  mediaQueue.push(saveValue);

  const removeButton = mediaPreview.querySelector(".chat-snap-remove-icon");
  addEventToRemoveButton(removeButton, saveValue, uploadArea);
  uploadingStates.off();
};

/**
 * FileReader load handler that queues a read local file.
 * @param {File} file
 * @param {HTMLElement} sidebar
 * @returns {(evt: ProgressEvent<FileReader>) => Promise<void>}
 */
const filesFileReaderHandler = (file, sidebar) => async (evt) => {
  const imageSrc = evt.target?.result;
  const saveValue = { type: file.type, name: file.name, imageSrc, id: randomString(), file };
  await addMediaToQueue(saveValue, sidebar);
};

/**
 * Read and queue a list of local files dragged onto the chat input.
 * @param {FileList|File[]} files
 * @param {HTMLElement} sidebar
 * @returns {void}
 */
export const processFiles = (files, sidebar) => {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!isAllowedFile(file)) {
      console.warn(`Chat Snap: File type not allowed: ${file.name}`);
      continue;
    }

    const reader = new FileReader();
    reader.addEventListener("load", filesFileReaderHandler(file, sidebar));
    reader.readAsDataURL(file);
  }
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

  const urls = extractUrlFromEventData(eventData);
  if (urls && urls.length) return true;

  return extractFilesFromEventData(eventData).length > 0;
};

/**
 * Queue media from a paste or drop: prefer image URLs in the payload, otherwise read files.
 * @param {DataTransfer} eventData  The clipboardData or dataTransfer payload.
 * @param {HTMLElement} sidebar
 * @returns {Promise<void>}
 */
export const processDropAndPaste = async (eventData, sidebar) => {
  if (!eventData) return;

  const urlsFromEventDataHandler = async (urls) => {
    for (let i = 0; i < urls.length; i++) {
      const saveValue = { imageSrc: urls[i], id: randomString() };
      await addMediaToQueue(saveValue, sidebar);
    }
  };

  const urls = extractUrlFromEventData(eventData);
  if (urls && urls.length) return await urlsFromEventDataHandler(urls);

  const filesExtracted = extractFilesFromEventData(eventData);
  if (filesExtracted && filesExtracted.length) return await processFiles(filesExtracted, sidebar);
};

/** @returns {object[]}  The current preview queue. */
export const getMediaQueue = () => mediaQueue;

/**
 * Empty the preview queue and clear the strip.
 * @param {HTMLElement} sidebar
 * @returns {void}
 */
export const removeAllFromQueue = (sidebar) => {
  while (mediaQueue.length) {
    const item = mediaQueue.pop();
    if (!item) continue;
    sidebar.querySelector(`[id="${item.id}"]`)?.remove();
  }

  sidebar.querySelector("#chat-snap-chat-upload-area")?.classList.add("hidden");
};
