/*!
 * Chat Snap
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

import { MODULE_ID } from "../constants.js";
import { getVideoType } from "../lib/lib.js";
import { getSetting } from "../utils/settings.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Maximum window width when scaling down an oversized video. */
const MAX_WIDTH = 800;

/** Maximum window height when scaling down an oversized video. */
const MAX_HEIGHT = 700;

/**
 * Dedicated popout for video media. Unlike MediaPopout (which extends ImagePopout), this class
 * extends ApplicationV2 directly to avoid any image-sizing interference from the core class.
 *
 * The static `create` factory pre-fetches video dimensions before the window is rendered, so the
 * popout opens at the correct aspect ratio without any resize flash.
 * @extends {foundry.applications.api.ApplicationV2}
 */
export default class VideoPopout extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {string} */
  #src;

  static DEFAULT_OPTIONS = {
    classes: [MODULE_ID],
    window: { resizable: true },
  };

  static PARTS = {
    popout: {
      template: `modules/${MODULE_ID}/templates/video-popout-dialog.hbs`,
    },
  };

  /**
   * @param {string} src       Video source URL.
   * @param {object} [options] ApplicationV2 options. Position is expected to be pre-computed by `create`.
   */
  constructor(src, options = {}) {
    super(options);
    this.#src = src;
  }

  /**
   * Pre-fetch video dimensions via a detached element, then construct a VideoPopout sized to match
   * the video's aspect ratio. The window opens at the correct size with no resize flash.
   * @param {string} src       Video source URL.
   * @param {object} [options] Additional ApplicationV2 options.
   * @returns {Promise<VideoPopout>}
   */
  static async create(src, options = {}) {
    const { width, height } = await VideoPopout.#fetchDimensions(src);
    const title = src.split("/").pop()?.split("?")[0] ?? "Video";
    return new VideoPopout(src, {
      ...options,
      window: { title, ...options.window },
      position: { width, height },
    });
  }

  /**
   * Load video metadata in a detached element to read natural dimensions, then scale them down to
   * fit within MAX_WIDTH × MAX_HEIGHT while preserving aspect ratio.
   * Falls back to a standard 16:9 size when metadata cannot be loaded.
   * @param {string} src
   * @returns {Promise<{width: number, height: number}>}
   */
  static #fetchDimensions(src) {
    return new Promise((resolve) => {
      const video = document.createElement("video");

      const cleanup = () => {
        video.onloadedmetadata = null;
        video.onerror = null;
        video.src = "";
      };

      video.onloadedmetadata = () => {
        // Read dimensions before cleanup — setting src="" discards metadata and resets these to 0.
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        cleanup();
        if (!vw || !vh) {
          resolve({ width: 640, height: 360 });
          return;
        }
        const scale = Math.min(1, MAX_WIDTH / vw, MAX_HEIGHT / vh);
        resolve({
          width: Math.round(vw * scale),
          height: Math.round(vh * scale),
        });
      };

      video.onerror = () => {
        cleanup();
        resolve({ width: 640, height: 360 });
      };

      video.src = src;
    });
  }

  /**
   * Build the template context for the video player.
   * Called from the `_prepareContext` ApplicationV2 lifecycle stage.
   * @param {object} options
   * @returns {Promise<{src: string, videoType: string, autoplay: boolean}>}
   */
  async _prepareContext(options) {
    return {
      src: this.#src,
      videoType: getVideoType(this.#src),
      autoplay: getSetting("videoAutoplay"),
    };
  }
}
