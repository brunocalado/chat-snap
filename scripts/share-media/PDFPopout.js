import { MODULE_ID } from "../constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Lightweight popout that renders a PDF inside an <object> element.
 * Fetches the PDF bytes via an authenticated request and serves them as a Blob URL so the
 * browser always receives explicit application/pdf typing, bypassing any Content-Disposition
 * or CSP restrictions on the original file URL.
 * @extends {foundry.applications.api.ApplicationV2}
 */
export default class PDFPopout extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {string} Original file URL as stored in the chat message. */
  #src;

  /** @type {string|null} Blob URL created from fetched bytes; revoked on close to free memory. */
  #blobUrl = null;

  static DEFAULT_OPTIONS = {
    classes: [MODULE_ID],
    window: { resizable: true },
    position: { width: 820, height: 640 },
  };

  static PARTS = {
    popout: {
      template: `modules/${MODULE_ID}/templates/pdf-popout-dialog.hbs`,
    },
  };

  /**
   * @param {string} src    URL of the PDF file to display.
   * @param {string} [title]  Window title shown in the header.
   */
  constructor(src, title = "PDF") {
    super({ window: { title } });
    this.#src = src;
  }

  /**
   * Fetch the PDF with the current session credentials and create a Blob URL with an explicit
   * application/pdf MIME type. This ensures the browser renders it inline regardless of the
   * server's Content-Type or Content-Disposition headers, and produces a same-origin Blob URL
   * that is not subject to local-network navigation blocking in Edge.
   * Falls back to the original URL when the fetch fails.
   * Called from the `_prepareContext` ApplicationV2 lifecycle stage.
   * @param {object} options  Render options.
   * @returns {Promise<{src: string}>}
   */
  async _prepareContext(options) {
    try {
      const response = await fetch(this.#src, { credentials: "include" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const buffer = await response.arrayBuffer();
      const blob = new Blob([buffer], { type: "application/pdf" });
      if (this.#blobUrl) URL.revokeObjectURL(this.#blobUrl);
      this.#blobUrl = URL.createObjectURL(blob);
      return { src: this.#blobUrl };
    } catch (e) {
      console.warn("Chat Snap: Could not fetch PDF for inline display, falling back to direct URL.", e);
      return { src: this.#src };
    }
  }

  /**
   * Revoke the Blob URL when the window closes to release the held memory.
   * Called from the `_onClose` ApplicationV2 lifecycle stage.
   * @param {object} options  Close options.
   */
  async _onClose(options) {
    if (this.#blobUrl) {
      URL.revokeObjectURL(this.#blobUrl);
      this.#blobUrl = null;
    }
  }
}
