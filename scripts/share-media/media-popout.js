/*!
 * Chat Snap
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

import { MODULE_ID } from "../constants.js";
import { getVideoType, isVideo } from "../lib/lib.js";
import { getSetting } from "../utils/settings.js";

/**
 * Extends the core ImagePopout so it can also display videos in the lightbox frame.
 * @extends {foundry.applications.apps.ImagePopout}
 */
export default class MediaPopout extends foundry.applications.apps.ImagePopout {
  /** @type {boolean} Whether the popped-out media is a video. */
  video;

  static DEFAULT_OPTIONS = {
    classes: [MODULE_ID],
  };

  static PARTS = {
    popout: {
      template: `modules/${MODULE_ID}/templates/media-popout-dialog.hbs`,
    },
  };

  /**
   * @param {string} src  The media source path or data URL.
   * @param {object} [options]  Standard ImagePopout options.
   */
  constructor(src, options = {}) {
    super({ ...options, src });
    this.video = isVideo(src);
  }

  /**
   * Inject video-specific context on top of the core ImagePopout context.
   * @param {object} options  Render options.
   * @returns {Promise<object>}  The render context.
   */
  async _prepareContext(options) {
    const data = await super._prepareContext(options);

    data.isVideo = this.video;
    if (this.video) {
      data.video = data.image;
      data.isLoop = true;
      data.isMuted = false;
      data.autoplay = getSetting("videoAutoplay");
      data.controls = true;
      data.videoType = getVideoType(data.video);
    }

    return data;
  }
}
