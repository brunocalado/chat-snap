/*!
 * Chat Snap
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

import { MODULE_ID } from "../constants.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Lightweight popout that fetches and displays a plain-text or JSON file.
 * JSON files are pretty-printed automatically. The content is served into a
 * scrollable <pre> element so the original formatting is preserved.
 * @extends {foundry.applications.api.ApplicationV2}
 */
export default class TextPopout extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {string} Original file URL as stored in the chat message. */
  #src;

  /** @type {boolean} Whether the file should be treated as JSON. */
  #isJson;

  static DEFAULT_OPTIONS = {
    classes: [MODULE_ID],
    window: { resizable: true },
    position: { width: 640, height: 480 },
  };

  static PARTS = {
    popout: {
      template: `modules/${MODULE_ID}/templates/text-popout-dialog.hbs`,
    },
  };

  /**
   * @param {string} src     URL of the text file to display.
   * @param {string} [title] Window title shown in the header.
   * @param {boolean} [isJson] Whether the file is JSON (enables pretty-printing).
   */
  constructor(src, title = "File", isJson = false) {
    super({ window: { title } });
    this.#src = src;
    this.#isJson = isJson;
  }

  /**
   * Fetch the text file with the current session credentials and prepare its content for display.
   * JSON files are parsed and re-serialised with 2-space indentation. Falls back to raw content
   * when parsing fails (e.g. the file is malformed JSON).
   * Called from the `_prepareContext` ApplicationV2 lifecycle stage.
   * @param {object} options  Render options.
   * @returns {Promise<{src: string, content: string, isJson: boolean}>}
   */
  async _prepareContext(options) {
    try {
      const response = await fetch(this.#src, { credentials: "include" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      let content = await response.text();
      if (this.#isJson) {
        try {
          content = JSON.stringify(JSON.parse(content), null, 2);
        } catch {
          // Malformed JSON — display raw text as-is.
        }
      }
      return { src: this.#src, content, isJson: this.#isJson };
    } catch (e) {
      console.warn("Chat Snap: Could not fetch text file for inline display.", e);
      return { src: this.#src, content: "Error: could not load file.", isJson: this.#isJson };
    }
  }
}
