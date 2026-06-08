export function isVideo(imgSrc) {
  const re = /(?:\.([^.]+))?$/;
  const ext = re.exec(imgSrc)?.[1]?.toLowerCase();
  return ext === "webm" || ext === "m4v" || ext === "mp4" || ext === "ogv";
}

export function getVideoType(imgSrc) {
  const src = imgSrc.toLowerCase();
  if (src.endsWith("webm")) {
    return "video/webm";
  } else if (src.endsWith("mp4")) {
    return "video/mp4";
  } else if (src.endsWith("m4v")) {
    return "video/mp4";
  } else if (src.endsWith("ogv")) {
    return "video/ogg";
  }
  return "video/mp4";
}
