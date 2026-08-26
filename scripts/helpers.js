/*!
 * Chat Snap
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Build a single detached DOM element from an HTML string. Replaces the former jQuery
 * `$(htmlString)` element factory now that the module is vanilla-JS only.
 * @param {string} html  A fragment of HTML describing exactly one root element.
 * @returns {HTMLElement|null}  The first element node, or null if the string is empty.
 */
export function htmlToElement(html) {
  const template = document.createElement("template");
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}
