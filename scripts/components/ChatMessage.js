import MediaPopout from "../share-media/MediaPopout.js";

const ImagePopout = foundry.applications.apps.ImagePopout;

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
      const clickTimeout = setTimeout(() => {
        if (!target.dataset.doubleClickFlag) {
          const src = target.dataset.src ?? target.src;
          new MediaPopout(src, { editable: false, shareable: true }).render(true);
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
};
