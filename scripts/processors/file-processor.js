import { ORIGIN_FOLDER, randomString, userCanUpload } from "../utils/utils.js";
import { htmlToElement } from "../helpers.js";
import { anchorUploadArea } from "../components/upload-area.js";
import { getSetting, createUploadFolder } from "../utils/settings.js";
import { MODULE_ID, SETTING_USE_DATE_FOLDERS, SETTING_MAX_FILE_SIZE_MB, SETTING_COMPRESS_IMAGES, SETTING_IMAGE_QUALITY, MODEL_EXTENSIONS } from "../constants.js";

const RESTRICTED_DOMAINS = ["static.wikia"];

const DOM_PARSER = new DOMParser();

let mediaQueue = [];

const IMAGE_EXTENSIONS = [".apng", ".avif", ".bmp", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".tiff", ".webp"];
// Subset of IMAGE_EXTENSIONS that decode natively in Foundry's Chromium/Electron runtime and can be
// re-encoded to WebP via canvas. TIFF is excluded — <img>/canvas cannot decode it there. Animated/
// vector formats (.gif, .apng, .svg, .webp, .avif) are left out so they pass through untouched.
const COMPRESSIBLE_IMAGE_EXTENSIONS = [".bmp", ".jpeg", ".jpg", ".png"];
const VIDEO_EXTENSIONS = [".webm", ".m4v", ".mp4", ".ogv"];
// m4a and mid are in Foundry's upload whitelist and play via the native <audio> element.
const AUDIO_EXTENSIONS = [".mp3", ".wav", ".ogg", ".opus", ".flac", ".aac", ".m4a", ".mid"];
const PDF_EXTENSIONS = [".pdf"];
// All text/data formats allowed by Foundry's upload whitelist that are viewable as text.
const TEXT_EXTENSIONS = [".txt", ".json", ".csv", ".md", ".tsv", ".xml", ".yml", ".yaml"];
// Foundry-allowed formats with no inline viewer: fonts and 3D/game assets <model-viewer> can't render.
// glTF formats (.glb, .gltf) are handled separately via MODEL_EXTENSIONS — they open in ModelPopout.
const DOWNLOADABLE_EXTENSIONS = [
  ".otf", ".ttf", ".woff", ".woff2",
  ".basis", ".ktx2",
  ".fbx", ".mtl", ".obj", ".stl", ".usdz",
];

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
const isCompressibleImage = (file) => COMPRESSIBLE_IMAGE_EXTENSIONS.includes(fileExtension(file));

/** @param {File|DataTransferItem} file @returns {boolean} */
const isFileVideo = (file) => VIDEO_EXTENSIONS.includes(fileExtension(file));

/** @param {File|DataTransferItem} file @returns {boolean} */
const isFileAudio = (file) => AUDIO_EXTENSIONS.includes(fileExtension(file));

/** @param {File|DataTransferItem} file @returns {boolean} */
const isFilePdf = (file) => PDF_EXTENSIONS.includes(fileExtension(file));

/** @param {File|DataTransferItem} file @returns {boolean} */
const isFileText = (file) => TEXT_EXTENSIONS.includes(fileExtension(file));

/** @param {File|DataTransferItem} file @returns {boolean} */
const isFileDownloadable = (file) => DOWNLOADABLE_EXTENSIONS.includes(fileExtension(file));

/** @param {File|DataTransferItem} file @returns {boolean} */
const isFileModel = (file) => MODEL_EXTENSIONS.includes(fileExtension(file));

/** @param {File|DataTransferItem} file @returns {boolean} */
const isAllowedFile = (file) =>
  isFileImage(file) || isFileVideo(file) || isFileAudio(file) ||
  isFilePdf(file) || isFileText(file) || isFileDownloadable(file) || isFileModel(file);

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
 * True when this save value represents a viewable text or data file.
 * @param {{type?: string, name?: string}} saveValue
 * @returns {boolean}
 */
const isSaveValueText = (saveValue) =>
  saveValue.type === "text/plain" ||
  saveValue.type === "application/json" ||
  saveValue.type === "text/csv" ||
  saveValue.type === "text/markdown" ||
  saveValue.type === "text/x-markdown" ||
  saveValue.type === "text/tab-separated-values" ||
  saveValue.type === "text/xml" ||
  saveValue.type === "application/xml" ||
  saveValue.type === "text/yaml" ||
  saveValue.type === "application/yaml" ||
  (!!saveValue.name && isFileText({ name: saveValue.name }));

/**
 * True when this save value is a download-only file (fonts or 3D/game assets — no inline viewer).
 * Relies on filename extension because MIME types for these formats are inconsistent across OS/browser.
 * @param {{name?: string}} saveValue
 * @returns {boolean}
 */
const isSaveValueDownloadable = (saveValue) =>
  !!saveValue.name && isFileDownloadable({ name: saveValue.name });

/**
 * True when this save value is a viewable 3D model (glTF family — opens in ModelPopout).
 * Relies on filename extension because MIME types for glTF formats are inconsistent across OS/browser.
 * @param {{name?: string}} saveValue
 * @returns {boolean}
 */
const isSaveValueModel = (saveValue) =>
  !!saveValue.name && isFileModel({ name: saveValue.name });

/**
 * Classify a queued item into one of six mutually-exclusive media categories.
 * @param {{type?: string, name?: string}} saveValue
 * @returns {"audio"|"pdf"|"text"|"model"|"downloadable"|"visual"}
 */
const getMediaType = (saveValue) => {
  if (isSaveValueAudio(saveValue)) return "audio";
  if (isSaveValuePdf(saveValue)) return "pdf";
  if (isSaveValueText(saveValue)) return "text";
  if (isSaveValueModel(saveValue)) return "model";
  if (isSaveValueDownloadable(saveValue)) return "downloadable";
  return "visual";
};

/**
 * Return the FontAwesome icon class string for a given text file extension.
 * @param {string} ext  Lower-cased extension including the dot.
 * @returns {string}
 */
const getTextIcon = (ext) => {
  if (ext === ".json") return "fa-solid fa-code";
  if (ext === ".csv" || ext === ".tsv") return "fa-solid fa-table";
  if (ext === ".xml" || ext === ".yml" || ext === ".yaml") return "fa-regular fa-file-code";
  if (ext === ".md") return "fa-brands fa-markdown";
  return "fa-regular fa-file-lines";
};

/**
 * Return the FontAwesome icon class string for a downloadable file extension.
 * @param {string} ext  Lower-cased extension including the dot.
 * @returns {string}
 */
const getDownloadableIcon = (ext) => {
  if ([".otf", ".ttf", ".woff", ".woff2"].includes(ext)) return "fa-solid fa-font";
  return "fa-solid fa-cube";
};

/**
 * Build a preview tile (image, video, audio badge, PDF badge, text badge, or download badge)
 * for the upload strip.
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

  const isText = !!name && isFileText({ name });
  if (isText) {
    const shortName = (name || "file").replace(/\.[^.]+$/, "");
    const ext = fileExtension({ name });
    return htmlToElement(
      `<div id="${id}" class="chat-snap-upload-area-item chat-snap-text-preview">
                <i class="chat-snap-remove-icon fa-regular fa-circle-xmark"></i>
                <i class="chat-snap-text-icon ${getTextIcon(ext)}"></i>
                <span class="chat-snap-text-filename">${shortName}</span>
            </div>`,
    );
  }

  if (!!name && isFileModel({ name })) {
    const shortName = (name || "model").replace(/\.[^.]+$/, "");
    return htmlToElement(
      `<div id="${id}" class="chat-snap-upload-area-item chat-snap-model-preview">
                <i class="chat-snap-remove-icon fa-regular fa-circle-xmark"></i>
                <i class="chat-snap-model-icon fa-solid fa-cube"></i>
                <span class="chat-snap-model-filename">${shortName}</span>
            </div>`,
    );
  }

  if (!!name && isFileDownloadable({ name })) {
    const shortName = (name || "file").replace(/\.[^.]+$/, "");
    const ext = fileExtension({ name });
    return htmlToElement(
      `<div id="${id}" class="chat-snap-upload-area-item chat-snap-downloadable-preview">
                <i class="chat-snap-remove-icon fa-regular fa-circle-xmark"></i>
                <i class="chat-snap-downloadable-icon ${getDownloadableIcon(ext)}"></i>
                <span class="chat-snap-downloadable-filename">${shortName}</span>
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
 * Folder paths a GM has already confirmed for this (non-GM) client, keyed by path.
 * Mirrors the cache in Settings.createUploadFolder so a multi-file paste sends one query
 * instead of one per file.
 * @type {Map<string, Promise<boolean>>}
 */
const gmEnsuredFolders = new Map();

/**
 * Ask an active GM to create the folder on this player's behalf. Never throws.
 * @param {string} folderPath  Server-relative folder path to ensure.
 * @param {boolean} [force]    Ask the GM to re-check even if their client ensured it earlier.
 * @returns {Promise<boolean>}  True when a GM confirmed the folder exists.
 */
const requestFolderFromGM = async (folderPath, force) => {
  // Queries target a specific User document; find any active GM to handle the request.
  const gm = game.users.find(u => u.isGM && u.active);
  if (!gm) {
    console.warn("Chat Snap: No active GM found to create the upload folder.");
    return false;
  }
  // User#query throws outright when the querying user lacks QUERY_USER; check first so a
  // restricted world degrades quietly to the fallback folder.
  if (!game.user.hasPermission("QUERY_USER")) {
    console.warn("Chat Snap: This user lacks the QUERY_USER permission needed to request a folder.");
    return false;
  }
  try {
    return await gm.query(`${MODULE_ID}.ensureFolder`, { folderPath, force }, { timeout: 10000 }) === true;
  } catch (e) {
    console.warn("Chat Snap: Could not ensure upload folder via GM query:", e);
    return false;
  }
};

/**
 * Ensure the target upload folder exists. GMs call Settings.createUploadFolder directly;
 * non-GM users (who lack FILES_BROWSE) ask the active GM via a query instead.
 * @param {string} folderPath  Server-relative folder path to ensure.
 * @param {object} [options]
 * @param {boolean} [options.force=false]  Re-check a folder already ensured this session.
 * @returns {Promise<boolean>}  True when the folder is known to exist.
 */
const ensureFolder = async (folderPath, { force = false } = {}) => {
  if (game.user.isGM) return createUploadFolder(folderPath, { force });

  if (force) gmEnsuredFolders.delete(folderPath);
  const pending = gmEnsuredFolders.get(folderPath);
  if (pending) return pending;

  const request = requestFolderFromGM(folderPath, force);
  gmEnsuredFolders.set(folderPath, request);

  const created = await request;
  // Only cache successes: a failed attempt must be retried on the next upload (the GM may
  // have been offline at the time).
  if (!created) gmEnsuredFolders.delete(folderPath);
  return created;
};

/**
 * Server-side upload failures that Chat Snap resolves on its own (by falling back to the base
 * upload folder), so they must not reach the player as a red notification.
 * @type {RegExp}
 */
const RECOVERABLE_UPLOAD_ERRORS = /does not exist|EEXIST|already exists/i;

/**
 * Number of uploads currently in flight. The notification filter stays installed until the last
 * one finishes, so parallel uploads (a multi-file paste) cannot uninstall it from under each other.
 * @type {number}
 */
let uploadsInFlight = 0;

/**
 * Upload a file without letting a recoverable server error raise a UI notification.
 * FilePicker.upload reports `response.error` through ui.notifications.error() unconditionally —
 * the `notify: false` option does not cover that branch in v14 — so matching messages are routed
 * to the console for the duration of the request. Any other error still notifies normally.
 * @param {string} target  Server-relative destination folder.
 * @param {File} file      The file to upload.
 * @returns {Promise<object|false|undefined>}  The FilePicker response.
 */
const uploadQuietly = async (target, file) => {
  const FilePicker = getFilePicker();
  const notifications = ui.notifications;

  if (uploadsInFlight === 0) {
    const original = notifications.error.bind(notifications);
    // Own property shadowing the prototype method; removed once the last upload settles.
    notifications.error = (message, options) => {
      if (typeof message === "string" && RECOVERABLE_UPLOAD_ERRORS.test(message)) {
        console.warn("Chat Snap: recoverable upload error:", message);
        return null;
      }
      return original(message, options);
    };
  }
  uploadsInFlight++;

  try {
    return await FilePicker.upload(ORIGIN_FOLDER, target, file, {}, { notify: false });
  } finally {
    uploadsInFlight--;
    if (uploadsInFlight === 0) delete notifications.error;
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
      } else if (type === "text/markdown" || type === "text/x-markdown") {
        ext = ".md";
      } else if (type === "text/tab-separated-values") {
        ext = ".tsv";
      } else if (type === "text/xml" || type === "application/xml") {
        ext = ".xml";
      } else if (type === "text/yaml" || type === "application/yaml") {
        ext = ".yaml";
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
      const datedLocation = `${uploadLocation}/${dateFolder}`;
      // Only use the date subfolder once it is confirmed to exist. When it cannot be created
      // (no GM online, restricted permissions, host quirks) the upload still succeeds in the
      // base folder rather than failing with "target directory does not exist".
      if (await ensureFolder(datedLocation)) effectiveLocation = datedLocation;
    }
    if (effectiveLocation === uploadLocation) await ensureFolder(uploadLocation);

    let fileLocation = await uploadQuietly(effectiveLocation, fileToUpload);

    // A folder ensured earlier this session is cached as existing, so a folder deleted from disk
    // in the meantime is only detected here. Re-create the whole chain, bypassing the caches,
    // and retry the same destination so files keep landing in the date subfolder.
    if (!fileLocation?.path) {
      await ensureFolder(effectiveLocation, { force: true });
      fileLocation = await uploadQuietly(effectiveLocation, fileToUpload);
    }

    // Last resort: the base folder, so a subfolder that cannot be created never costs the upload.
    if (!fileLocation?.path && effectiveLocation !== uploadLocation) {
      await ensureFolder(uploadLocation, { force: true });
      fileLocation = await uploadQuietly(uploadLocation, fileToUpload);
    }

    if (!fileLocation?.path) return saveValue.imageSrc;
    return fileLocation.path;
  } catch (e) {
    console.error("Chat Snap: Error uploading file:", e);
    return saveValue.imageSrc;
  }
};

/**
 * Return true when the incoming item's media type differs from what is already queued.
 * Audio, PDF, text, model, downloadable, and visual media (image/video) cannot coexist in the same message.
 * @param {"audio"|"pdf"|"text"|"model"|"downloadable"|"visual"} incomingType
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
  const isSingleSlot = incomingType === "audio" || incomingType === "pdf" || incomingType === "text" || incomingType === "model" || incomingType === "downloadable";

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
 * Re-encode a raster image to WebP using the Canvas API. Returns a NEW File whose name carries a
 * `.webp` extension and whose type is `image/webp`, so the downstream upload path (`uploadFile`,
 * which derives the extension from the name) writes it correctly. Resolves the original file
 * unchanged on any decode/encode failure — or when the WebP is not actually smaller — so the upload
 * never breaks or grows. Caller gates this behind SETTING_COMPRESS_IMAGES and isCompressibleImage().
 * @param {File} file  A BMP/JPEG/JPG/PNG file (see COMPRESSIBLE_IMAGE_EXTENSIONS).
 * @param {number} quality  WebP quality in the 0.0–1.0 range.
 * @returns {Promise<File>}
 */
const compressImageToWebp = (file, quality) =>
  new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d").drawImage(img, 0, 0);
      canvas.toBlob(
        (blob) => {
          // Keep the original when the WebP failed or didn't actually shrink the file.
          if (!blob || blob.size >= file.size) {
            resolve(file);
            return;
          }
          const base = file.name.substring(0, file.name.lastIndexOf("."));
          resolve(new File([blob], `${base}.webp`, { type: "image/webp" }));
        },
        "image/webp",
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });

/**
 * Read and queue a list of local files dragged onto the chat input. Awaits every read so the
 * surrounding loading-bar guard stays active until all files are processed. Eligible images are
 * compressed to WebP BEFORE the size-limit check, so an oversized original that fits once re-encoded
 * is still accepted; only the resulting file's size is enforced against the limit.
 * @param {FileList|File[]} files
 * @returns {Promise<void>}
 */
export const processFiles = async (files) => {
  const maxBytes = getSetting(SETTING_MAX_FILE_SIZE_MB) * 1024 * 1024;
  const compressEnabled = getSetting(SETTING_COMPRESS_IMAGES);
  const reads = [];
  for (const file of files) {
    if (!isAllowedFile(file)) {
      console.warn(`Chat Snap: File type not allowed: ${file.name}`);
      continue;
    }

    const processedFile = compressEnabled && isCompressibleImage(file)
      ? await compressImageToWebp(file, getSetting(SETTING_IMAGE_QUALITY))
      : file;

    // GMs bypass the file size limit entirely.
    if (!game.user.isGM && processedFile.size > maxBytes) {
      ui.notifications?.warn(
        `Chat Snap: "${file.name}" exceeds the ${getSetting(SETTING_MAX_FILE_SIZE_MB)} MB limit and was not uploaded.`
      );
      continue;
    }

    reads.push(readAndQueueFile(processedFile));
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
    const ALL_EXTENSIONS = [
      ...IMAGE_EXTENSIONS, ...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS,
      ...PDF_EXTENSIONS, ...TEXT_EXTENSIONS, ...DOWNLOADABLE_EXTENSIONS, ...MODEL_EXTENSIONS,
    ];
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
 * Silently attempt to fetch an external URL and mirror it to the Foundry server.
 * Runs entirely in the background — never throws, never blocks the caller.
 * On success, mutates saveValue.imageSrc in-place so any subsequent message send
 * picks up the locally-hosted copy. Skips immediately when the current user lacks
 * upload permission or when CORS blocks the fetch.
 * @param {{imageSrc: string, id: string, name?: string}} saveValue
 * @returns {void}
 */
const backgroundUploadExternalUrl = (saveValue) => {
  if (!userCanUpload()) return;

  (async () => {
    try {
      const response = await fetch(saveValue.imageSrc, { mode: "cors" });
      if (!response.ok) return;

      const blob = await response.blob();
      if (!blob.size) return;

      // data: URIs have no real path — new URL(...).pathname returns the whole base64 payload,
      // and splitting that on "/" (part of base64's alphabet) yields a garbage filename with no
      // valid extension. Skip straight to the blob.type-based fallback below for those.
      const isDataUri = saveValue.imageSrc.startsWith("data:");
      let filename = isDataUri ? "" : new URL(saveValue.imageSrc).pathname.split("/").pop().split("?")[0];
      if (!filename) {
        const ext = blob.type.split("/")[1]?.split(";")[0] ?? "bin";
        filename = `${saveValue.id}.${ext}`;
      }

      const compressEnabled = getSetting(SETTING_COMPRESS_IMAGES);
      let file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
      if (compressEnabled && isCompressibleImage(file)) {
        file = await compressImageToWebp(file, getSetting(SETTING_IMAGE_QUALITY));
      }

      const uploadSaveValue = { id: saveValue.id, imageSrc: saveValue.imageSrc, file, type: file.type, name: file.name };
      const serverPath = await uploadFile(uploadSaveValue);
      if (serverPath && serverPath !== saveValue.imageSrc) {
        saveValue.imageSrc = serverPath;
      }
    } catch {
      // CORS blocked, network error, or upload failed — keep the external URL silently.
    }
  })();
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
      backgroundUploadExternalUrl(saveValue);
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
      backgroundUploadExternalUrl(saveValue);
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
