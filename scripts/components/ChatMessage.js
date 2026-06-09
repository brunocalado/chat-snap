import VideoPopout from "../share-media/VideoPopout.js";
import PDFPopout from "../share-media/PDFPopout.js";
import TextPopout from "../share-media/TextPopout.js";
import { getSetting } from "../utils/Settings.js";
import { SETTING_SHOW_DOWNLOAD_BUTTON } from "../constants.js";

const ImagePopout = foundry.applications.apps.ImagePopout;

/**
 * Inject a download anchor into a `.chat-snap-hint` element and apply the appropriate
 * flex-layout modifier class. Stops click propagation so parent popout handlers don't fire.
 * @param {HTMLElement} hintEl  The hint paragraph to inject the button into.
 * @param {string} src  The asset URL to download.
 * @param {boolean} [downloadOnly=false]  True when the hint has no existing text (audio).
 * @returns {void}
 */
const injectDownloadButton = (hintEl, src, downloadOnly = false) => {
  hintEl.classList.add(downloadOnly ? "chat-snap-hint--download-only" : "chat-snap-hint--with-download");
  const btn = document.createElement("a");
  btn.className = "chat-snap-download-btn";
  btn.href = src;
  btn.setAttribute("download", src.split("/").pop().split("?")[0] || "");
  btn.textContent = "Download";
  // Prevent the click from bubbling to parent popout handlers (critical for .chat-snap-pdf-item).
  btn.addEventListener("click", (evt) => evt.stopPropagation());
  hintEl.appendChild(btn);
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
    injectDownloadButton(hint, img.dataset.src || img.src);
  });

  html.querySelectorAll(".chat-snap-media-item video").forEach((video) => {
    const hint = video.closest(".chat-snap-media-item")?.querySelector(".chat-snap-hint");
    if (!hint) return;
    injectDownloadButton(hint, video.dataset.src || video.src);
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
    injectDownloadButton(hint, src, !hasText);
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
};
