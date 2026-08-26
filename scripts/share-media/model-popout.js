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
 * Tracks the one-time load of the bundled <model-viewer> web component. The library is ~900KB,
 * so it is lazily imported on the first popout open rather than at world load. Importing the
 * module self-registers the `<model-viewer>` custom element via customElements.define.
 * @type {Promise<unknown>|null}
 */
let modelViewerLoad = null;

/**
 * Import (once) the bundled <model-viewer> library so its custom element is defined before render.
 * @returns {Promise<unknown>}
 */
const ensureModelViewer = () => {
  if (!modelViewerLoad) {
    modelViewerLoad = import(`/modules/${MODULE_ID}/scripts/lib/model-viewer.min.js`).catch((e) => {
      // Reset so a later attempt can retry rather than caching the rejected promise.
      modelViewerLoad = null;
      throw e;
    });
  }
  return modelViewerLoad;
};

/**
 * Interactive 3D model viewer popout. Renders a glTF/GLB asset inside a <model-viewer> element
 * with orbit controls so the file can be inspected in-app instead of only downloaded. The viewer
 * is intentionally never embedded in the chat message itself (Foundry sanitizes message HTML and
 * would strip the custom element) — it lives only in this module-owned Application.
 * @extends {foundry.applications.api.ApplicationV2}
 */
export default class ModelPopout extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {string} URL of the model file as stored in the chat message. */
  #src;

  static DEFAULT_OPTIONS = {
    classes: [MODULE_ID],
    window: { resizable: true },
    position: { width: 720, height: 600 },
  };

  static PARTS = {
    popout: {
      template: `modules/${MODULE_ID}/templates/model-popout-dialog.hbs`,
    },
  };

  /**
   * @param {string} src     URL of the 3D model (.glb/.gltf) to display.
   * @param {string} [title] Window title shown in the header.
   */
  constructor(src, title = "3D Model") {
    super({ window: { title } });
    this.#src = src;
  }

  /**
   * Load the <model-viewer> library so the custom element is upgraded the moment the template
   * is inserted. On load failure the viewer still renders the element (a no-op without the
   * library), and the download fallback in the toolbar keeps the file reachable.
   * Called from the `_prepareContext` ApplicationV2 lifecycle stage.
   * @param {object} options  Render options.
   * @returns {Promise<{src: string}>}
   */
  async _prepareContext(options) {
    try {
      await ensureModelViewer();
    } catch (e) {
      console.warn("Chat Snap: Could not load the 3D model viewer library.", e);
    }
    return { src: this.#src };
  }
}
