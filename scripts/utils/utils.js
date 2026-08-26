/*!
 * Chat Snap
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

export const ORIGIN_FOLDER = "data";
export const randomString = () =>
    Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
/**
 * Recursively sums the byte size of every file inside folderPath via HTTP HEAD requests.
 * Avoids downloading file contents — only the Content-Length header is read.
 * @param {string} folderPath  Path relative to the Foundry data root.
 * @returns {Promise<number>}  Total size in bytes.
 */
export const calculateFolderSize = async (folderPath) => {
  const FilePicker =
    foundry.applications.apps.FilePicker.implementation ??
    foundry.applications.apps.FilePicker;
  let total = 0;
  try {
    const result = await FilePicker.browse(ORIGIN_FOLDER, folderPath);
    const sizes = await Promise.all(
      result.files.map(async (filePath) => {
        try {
          const res = await fetch(`/${filePath}`, { method: "HEAD" });
          return parseInt(res.headers.get("content-length") || "0", 10);
        } catch { return 0; }
      })
    );
    total += sizes.reduce((sum, s) => sum + s, 0);
    for (const dir of result.dirs) total += await calculateFolderSize(dir);
  } catch { /* folder does not exist yet */ }
  return total;
};

export const userCanUpload = (silent = false) => {
    const userRole = game?.user?.role;
    const fileUploadPermissions = game?.permissions?.FILES_UPLOAD;

    if (!userRole || !fileUploadPermissions) {
        if (!silent) ui.notifications?.warn("You don't have upload privileges");
        return false;
    }

    const uploadPermission = fileUploadPermissions.includes(userRole);
    if (!uploadPermission && !silent) ui.notifications?.warn("You don't have upload privileges");

    return uploadPermission;
};
