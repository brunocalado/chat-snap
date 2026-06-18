import VideoPopout from "../share-media/video-popout.js";
import PDFPopout from "../share-media/pdf-popout.js";
import TextPopout from "../share-media/text-popout.js";
import ModelPopout from "../share-media/model-popout.js";
import ActorPickerApp from "../share-media/actor-picker.js";
import { getSetting } from "../utils/settings.js";
import { SETTING_SHOW_DOWNLOAD_BUTTON } from "../constants.js";

const ImagePopout = foundry.applications.apps.ImagePopout;

/**
 * Return true when src is an absolute URL pointing to a different origin than the Foundry host.
 * Relative paths and same-origin absolute URLs (locally uploaded files) return false.
 * @param {string} src
 * @returns {boolean}
 */
const isExternalUrl = (src) => {
  try {
    return new URL(src).origin !== window.location.origin;
  } catch {
    return false;
  }
};

/**
 * Inject a download anchor (and optional canvas drag handle) into a `.chat-snap-hint` element
 * and apply the appropriate flex-layout modifier class. Stops click propagation so parent popout
 * handlers don't fire. External URLs render an "Open" button; same-origin URLs render "Download".
 * @param {HTMLElement} hintEl  The hint paragraph to inject the button into.
 * @param {string} src  The asset URL.
 * @param {boolean} [downloadOnly=false]  True when the hint has no existing text (audio).
 * @param {"tile"|"sound"|null} [canvasDropType=null]  Canvas drop target type; null disables the drag handle.
 * @returns {void}
 */
const injectDownloadButton = (hintEl, src, downloadOnly = false, canvasDropType = null) => {
  hintEl.classList.add(downloadOnly ? "chat-snap-hint--download-only" : "chat-snap-hint--with-download");
  const btn = document.createElement("a");
  btn.className = "chat-snap-download-btn";
  btn.href = src;

  if (isExternalUrl(src)) {
    btn.setAttribute("target", "_blank");
    btn.setAttribute("rel", "noopener noreferrer");
    btn.innerHTML = '<i class="fas fa-external-link-alt"></i> Open';
  } else {
    btn.setAttribute("download", src.split("/").pop().split("?")[0] || "");
    btn.innerHTML = '<i class="fas fa-download"></i> Download';
  }

  // Prevent the click from bubbling to parent popout handlers (critical for .chat-snap-pdf-item).
  btn.addEventListener("click", (evt) => evt.stopPropagation());

  const showDrag = canvasDropType !== null && !isExternalUrl(src) && game.user.isGM;

  if (showDrag) {
    const handle = document.createElement("span");
    handle.className = "chat-snap-drag-handle";
    handle.setAttribute("title", "Drag to canvas");
    handle.setAttribute("draggable", "true");
    handle.innerHTML = '<i class="fas fa-grip-vertical"></i>';

    handle.addEventListener("dragstart", (evt) => {
      if (!canvas?.ready) {
        ui.notifications?.warn("Chat Snap: Open a scene before dragging to the canvas.");
        evt.preventDefault();
        return;
      }
      const payload = canvasDropType === "tile"
        ? JSON.stringify({ type: "Tile", texture: { src } })
        : JSON.stringify({ type: "PlaylistSound", data: { path: src, name: src.split("/").pop().split("?")[0] || "sound", volume: 0.5 } });
      evt.dataTransfer.setData("text/plain", payload);
    });

    const actions = document.createElement("span");
    actions.className = "chat-snap-hint-actions";
    actions.appendChild(btn);
    actions.appendChild(handle);
    hintEl.appendChild(actions);
  } else {
    hintEl.appendChild(btn);
  }
};

/** Image extensions for which the Copy Link and Set Actor Portrait buttons are shown. */
const PORTRAIT_EXTENSIONS = /\.(webp|png|jpe?g)(\?.*)?$/i;

/**
 * Inject GM-only Copy Link and Set Actor Portrait buttons on image media items.
 * Only images with a portrait-compatible extension (webp, png, jpg, jpeg) receive the buttons.
 * Runs independently of the showDownloadButton setting.
 * @param {HTMLElement} html  The rendered chat message element.
 * @returns {void}
 */
const addGMButtons = (html) => {
  if (!game.user.isGM) return;

  html.querySelectorAll(".chat-snap-media-item img").forEach((img) => {
    const src = img.dataset.src || img.src;
    if (!PORTRAIT_EXTENSIONS.test(src)) return;

    const mediaItem = img.closest(".chat-snap-media-item");
    if (!mediaItem) return;

    const hint = mediaItem.querySelector(".chat-snap-hint");
    if (!hint) return;

    // Ensure the hint uses flex layout so the actions bar renders beside the hint text.
    if (!hint.classList.contains("chat-snap-hint--with-download") &&
        !hint.classList.contains("chat-snap-hint--download-only")) {
      hint.classList.add("chat-snap-hint--with-download");
    }

    // Find or create the inline actions wrapper (shared with download and drag buttons).
    let actions = hint.querySelector(".chat-snap-hint-actions");
    if (!actions) {
      actions = document.createElement("span");
      actions.className = "chat-snap-hint-actions";
      hint.appendChild(actions);
    }

    const copyBtn = document.createElement("button");
    copyBtn.type = "button";
    copyBtn.className = "chat-snap-copy-btn";
    copyBtn.setAttribute("data-tooltip", "Copy image link");
    copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
    copyBtn.addEventListener("click", async (evt) => {
      evt.stopPropagation();
      try {
        await navigator.clipboard.writeText(src);
        ui.notifications.info("Chat Snap: Link copied to clipboard.");
      } catch {
        ui.notifications.warn("Chat Snap: Could not copy link to clipboard.");
      }
    });
    actions.appendChild(copyBtn);

    const actorBtn = document.createElement("button");
    actorBtn.type = "button";
    actorBtn.className = "chat-snap-actor-btn";
    actorBtn.setAttribute("data-tooltip", "Set as actor portrait");
    actorBtn.innerHTML = '<i class="fas fa-portrait"></i>';
    actorBtn.addEventListener("click", (evt) => {
      evt.stopPropagation();
      new ActorPickerApp(src).render(true);
    });
    actions.appendChild(actorBtn);
  });
};

/**
 * Add download buttons to all media items in the rendered chat message.
 * Buttons are injected into existing `.chat-snap-hint` elements; a new hint is created
 * for audio items which have no hint by default.
 * Called from `initChatMessage` when the showDownloadButton setting is enabled.
 * @param {HTMLElement} html  The rendered chat message element.
 * @returns {void}
 */
const addDownloadButtons = (html) => {
  html.querySelectorAll(".chat-snap-media-item img").forEach((img) => {
    const hint = img.closest(".chat-snap-media-item")?.querySelector(".chat-snap-hint");
    if (!hint) return;
    injectDownloadButton(hint, img.dataset.src || img.src, false, "tile");
  });

  html.querySelectorAll(".chat-snap-media-item video").forEach((video) => {
    const hint = video.closest(".chat-snap-media-item")?.querySelector(".chat-snap-hint");
    if (!hint) return;
    injectDownloadButton(hint, video.dataset.src || video.src, false, "tile");
  });

  html.querySelectorAll(".chat-snap-media-item audio").forEach((audio) => {
    const item = audio.closest(".chat-snap-media-item");
    if (!item) return;
    const src = audio.src || audio.querySelector("source")?.src || "";
    if (!src) return;
    let hint = item.querySelector(".chat-snap-hint");
    const hasText = !!hint?.textContent?.trim();
    if (!hint) {
      hint = document.createElement("p");
      hint.className = "chat-snap-hint";
      item.appendChild(hint);
    }
    injectDownloadButton(hint, src, !hasText, "sound");
  });

  html.querySelectorAll(".chat-snap-pdf-item[data-pdf-src]").forEach((el) => {
    const hint = el.querySelector(".chat-snap-hint");
    if (!hint) return;
    injectDownloadButton(hint, el.dataset.pdfSrc);
  });

  html.querySelectorAll(".chat-snap-text-item[data-text-src]").forEach((el) => {
    const hint = el.querySelector(".chat-snap-hint");
    if (!hint) return;
    injectDownloadButton(hint, el.dataset.textSrc);
  });

  html.querySelectorAll(".chat-snap-downloadable-item[data-download-src]").forEach((el) => {
    const hint = el.querySelector(".chat-snap-hint");
    if (!hint) return;
    injectDownloadButton(hint, el.dataset.downloadSrc);
  });

  html.querySelectorAll(".chat-snap-model-item[data-model-src]").forEach((el) => {
    const hint = el.querySelector(".chat-snap-hint");
    if (!hint) return;
    injectDownloadButton(hint, el.dataset.modelSrc);
  });

};

/**
 * Wire click handlers onto media embedded in a rendered chat message: images open the core
 * ImagePopout, videos open the custom MediaPopout (single click) or go fullscreen (double click).
 * Called from the `renderChatMessageHTML` hook via module.js.
 * @param {HTMLElement} html  The rendered chat message element.
 * @returns {void}
 */
export const initChatMessage = (html) => {
  const images = html.querySelectorAll(".chat-snap-media-item img");
  if (images.length > 0) {
    /** @param {MouseEvent} evt */
    const clickImageHandle = (evt) => {
      const target = /** @type {HTMLImageElement} */ (evt.currentTarget);
      const src = target.dataset.src ?? target.src;
      new ImagePopout({ src, editable: false, shareable: true }).render(true);
    };

    images.forEach((img) => img.addEventListener("click", clickImageHandle));
  }

  const videos = html.querySelectorAll(".chat-snap-media-item video");
  if (videos.length > 0) {
    /** @param {MouseEvent} evt */
    const clickVideoHandle = (evt) => {
      const target = /** @type {HTMLVideoElement} */ (evt.currentTarget);

      if (document.fullscreenElement === target) return;

      // Prevent the native play/pause toggle so a single click can open the popout instead.
      evt.preventDefault();
      evt.stopPropagation();

      // When controls are shown, treat clicks in the bottom strip as control interactions
      // (the browser's own play/pause) rather than popout triggers.
      const rect = target.getBoundingClientRect();
      const clickX = evt.clientX - rect.left;
      const clickY = evt.clientY - rect.top;

      if (target.hasAttribute("controls")) {
        const controlsHeight = Math.max(30, rect.height * 0.15);
        const isClickOnControls = clickY > rect.height - controlsHeight;

        if (isClickOnControls) {
          // We swallowed the default above, so emulate the play/pause toggle for the play button.
          setTimeout(() => {
            const controlAreaCenter = rect.width / 2;
            const isNearPlayButton = Math.abs(clickX - controlAreaCenter) < 50;
            if (isNearPlayButton) {
              if (target.paused) target.play().catch((err) => console.warn("Chat Snap: play failed:", err));
              else target.pause();
            }
          }, 10);
          return;
        }
      }

      if (target.dataset.clickTimeout) {
        clearTimeout(parseInt(target.dataset.clickTimeout));
        delete target.dataset.clickTimeout;
      }

      // Delay the popout so a following dblclick (fullscreen) can cancel it.
      const clickTimeout = setTimeout(async () => {
        if (!target.dataset.doubleClickFlag) {
          const src = target.dataset.src ?? target.src;
          const popout = await VideoPopout.create(src);
          popout.render(true);
        }
        delete target.dataset.clickTimeout;
        delete target.dataset.doubleClickFlag;
      }, 300);

      target.dataset.clickTimeout = clickTimeout.toString();
    };

    /** @param {MouseEvent} evt */
    const dblClickVideoHandle = (evt) => {
      const target = /** @type {HTMLVideoElement} */ (evt.currentTarget);

      // Flag the double-click so the pending single-click popout is suppressed.
      target.dataset.doubleClickFlag = "true";
      if (target.dataset.clickTimeout) {
        clearTimeout(parseInt(target.dataset.clickTimeout));
        delete target.dataset.clickTimeout;
      }

      // We suppress the native single-click default, so request fullscreen manually.
      target.requestFullscreen().catch((err) => console.warn("Chat Snap: fullscreen request failed:", err));

      setTimeout(() => delete target.dataset.doubleClickFlag, 500);
    };

    videos.forEach((video) => {
      video.addEventListener("click", clickVideoHandle);
      video.addEventListener("dblclick", dblClickVideoHandle);
    });
  }

  const pdfItems = html.querySelectorAll(".chat-snap-pdf-item");
  if (pdfItems.length > 0) {
    /** @param {MouseEvent} evt */
    const clickPdfHandle = (evt) => {
      const target = /** @type {HTMLElement} */ (evt.currentTarget);
      const src = target.dataset.pdfSrc;
      const name = target.dataset.pdfName ?? "PDF";

      if (!navigator.pdfViewerEnabled) {
        ui.notifications?.warn("Chat Snap: Your browser does not support PDF viewing. Opening in a new tab instead.");
        window.open(src, "_blank");
        return;
      }

      new PDFPopout(src, name).render(true);
    };

    pdfItems.forEach((el) => el.addEventListener("click", clickPdfHandle));
  }

  const downloadItems = html.querySelectorAll(".chat-snap-downloadable-item");
  if (downloadItems.length > 0) {
    /** @param {MouseEvent} evt */
    const clickDownloadHandle = (evt) => {
      const target = /** @type {HTMLElement} */ (evt.currentTarget);
      window.open(target.dataset.downloadSrc, "_blank", "noopener,noreferrer");
    };
    downloadItems.forEach((el) => el.addEventListener("click", clickDownloadHandle));
  }

  const modelItems = html.querySelectorAll(".chat-snap-model-item");
  if (modelItems.length > 0) {
    /** @param {MouseEvent} evt */
    const clickModelHandle = (evt) => {
      const target = /** @type {HTMLElement} */ (evt.currentTarget);
      const src = target.dataset.modelSrc;
      const name = target.dataset.modelName ?? "3D Model";
      new ModelPopout(src, name).render(true);
    };

    modelItems.forEach((el) => el.addEventListener("click", clickModelHandle));
  }

  const textItems = html.querySelectorAll(".chat-snap-text-item");
  if (textItems.length > 0) {
    /** @param {MouseEvent} evt */
    const clickTextHandle = (evt) => {
      const target = /** @type {HTMLElement} */ (evt.currentTarget);
      const src = target.dataset.textSrc;
      const name = target.dataset.textName ?? "File";
      const isJson = target.dataset.textJson === "true";
      new TextPopout(src, name, isJson).render(true);
    };

    textItems.forEach((el) => el.addEventListener("click", clickTextHandle));
  }

  if (getSetting(SETTING_SHOW_DOWNLOAD_BUTTON)) addDownloadButtons(html);
  addGMButtons(html);
};
