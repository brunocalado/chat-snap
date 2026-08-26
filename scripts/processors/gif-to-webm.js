/*!
 * Chat Snap
 * Copyright (c) 2026 https://github.com/brunocalado
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License version 3.
 */

/**
 * Animated GIF to VP9 WebM.
 *
 * Encoding goes through MediaRecorder on a canvas capture stream rather than WebCodecs.
 * `VideoEncoder` and `ImageDecoder` are `[SecureContext]` in Chromium, so they do not exist at all
 * when Foundry is reached over plain HTTP on a LAN address (`http://192.168.x.x:30000`) — a very
 * common table setup. MediaRecorder with VP9 is available there, so this path works on every
 * client instead of only on localhost, HTTPS and hosted setups.
 *
 * The price is that recording happens in real time: a five-second GIF takes five seconds. The chat
 * input already shows its loading bar for the whole drop, so the wait is visible to the user.
 */

const GIF_SIGNATURES = ["GIF87a", "GIF89a"];

/** Recording is real time, so a long GIF would hold the chat input for as long as it plays. */
const MAX_SOURCE_DURATION_MS = 30_000;

/** Chromium clamps GIF frame delays below 2 hundredths to 10; match it so our duration agrees. */
const MIN_FRAME_DELAY_CS = 10;

/** A GIF slower than this is padded up so a 2-frame blinker still yields a usable stream. */
const FPS_RANGE = { min: 1, max: 30 };

const BITRATE_RANGE = { min: 100_000, max: 4_000_000 };

const RECORDER_MIME = "video/webm;codecs=vp9";

/**
 * Whether this client can encode WebM at all. False on browsers without MediaRecorder VP9, where
 * every GIF is simply left alone.
 * @returns {boolean}
 */
const isRecordingSupported = () =>
  typeof MediaRecorder !== "undefined" &&
  MediaRecorder.isTypeSupported(RECORDER_MIME) &&
  typeof document.createElement("canvas").captureStream === "function";

/**
 * Walk a GIF's block structure to collect what the encoder needs. Only block headers are read —
 * the LZW pixel data is skipped — so this stays cheap even on a multi-megabyte file.
 * @param {Uint8Array} bytes  The raw GIF.
 * @returns {{width: number, height: number, frames: number, durationMs: number}|null}
 *          Null when the bytes are not a GIF or the structure does not parse.
 */
const readGifMetadata = (bytes) => {
  if (bytes.length < 13) return null;
  if (!GIF_SIGNATURES.includes(String.fromCharCode(...bytes.slice(0, 6)))) return null;

  const width = bytes[6] | (bytes[7] << 8);
  const height = bytes[8] | (bytes[9] << 8);
  const packedScreen = bytes[10];

  let at = 13;
  // Skip the global colour table when present; its size is encoded in the low three bits.
  if (packedScreen & 0x80) at += 3 * (1 << ((packedScreen & 0x07) + 1));

  // Sub-blocks are a chain of length-prefixed runs terminated by a zero-length block.
  const skipSubBlocks = () => {
    while (at < bytes.length && bytes[at]) at += bytes[at] + 1;
    at++;
  };

  let frames = 0;
  let delayCs = 0;

  while (at < bytes.length && bytes[at] !== 0x3b) {
    if (bytes[at] === 0x21) {
      const label = bytes[at + 1];
      if (label === 0xf9) {
        // Graphic Control Extension: the frame delay lives here, in hundredths of a second.
        const delay = bytes[at + 4] | (bytes[at + 5] << 8);
        delayCs += delay < 2 ? MIN_FRAME_DELAY_CS : delay;
      }
      at += 2;
      skipSubBlocks();
    } else if (bytes[at] === 0x2c) {
      frames++;
      const packedImage = bytes[at + 9];
      at += 10;
      if (packedImage & 0x80) at += 3 * (1 << ((packedImage & 0x07) + 1));
      at++; // LZW minimum code size
      skipSubBlocks();
    } else {
      return null; // Unknown introducer — refuse rather than guess at the rest.
    }
  }

  if (!width || !height || !frames) return null;
  return { width, height, frames, durationMs: delayCs * 10 };
};

/**
 * Load the GIF into an `<img>` that the document is actually rendering. Chromium only advances an
 * animated GIF once the element is attached, so a detached image would sit on frame one forever.
 * @param {string} url  Object URL for the GIF.
 * @returns {Promise<HTMLImageElement>}  Parked off-screen; the caller removes it.
 */
const loadHiddenImage = async (url) => {
  const img = new Image();
  img.style.cssText = "position:fixed;left:-99999px;top:0;pointer-events:none;";
  img.src = url;
  document.body.appendChild(img);
  try {
    await img.decode();
  } catch (error) {
    img.remove();
    throw error;
  }
  return img;
};

/**
 * Whether the GIF composites to a picture with see-through pixels, in which case it must be left
 * as a GIF: VP9 through MediaRecorder discards alpha and would flatten those areas to black.
 *
 * The GIF's own per-frame transparency flag cannot answer this. Nearly every multi-frame GIF sets
 * it to mark pixels unchanged since the previous frame — an inter-frame size optimisation that
 * still composites to a fully opaque picture — so keying off the flag would reject almost every
 * animation. Only the rendered result settles it.
 *
 * A GIF that is opaque on frame one but develops holes later is missed; that needs a disposal mode
 * no common encoder emits, and the cost of being wrong is a black patch rather than a broken file.
 * @param {HTMLImageElement} img
 * @param {number} width
 * @param {number} height
 * @returns {boolean}
 */
const hasVisibleTransparency = (img, width, height) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const { data } = ctx.getImageData(0, 0, width, height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 250) return true;
  }
  return false;
};

/**
 * How many canvas draws a recording must land before it is considered a faithful capture: one per
 * 100 ms of source, never more than the GIF has frames. Generous enough that a client rendering at
 * a low frame rate still passes, strict enough that a stalled one does not.
 * @param {{frames: number, durationMs: number}} meta
 * @returns {number}
 */
const minimumDraws = (meta) => Math.max(2, Math.min(meta.frames, Math.round(meta.durationMs / 100)));

/**
 * Record one full cycle of the animation off a canvas capture stream.
 *
 * Recording starts a few milliseconds into the GIF rather than exactly on frame one, and that is
 * fine: a full cycle is captured either way and the posted `<video>` carries `loop`, so the phase
 * the clip happens to begin on is not observable. A GIF authored to play only once becomes a
 * looping video, which is the behaviour chat wants anyway.
 * @param {string} url  Object URL for the GIF.
 * @param {{width: number, height: number, frames: number, durationMs: number}} meta
 * @param {number} bitsPerPixel  Quality dial: bitrate is derived from frame area and rate.
 * @returns {Promise<Blob|null>}  Null when the recording cannot be trusted and the GIF must be kept.
 */
const recordAnimation = async (url, meta, bitsPerPixel) => {
  const rawFps = (meta.frames / meta.durationMs) * 1000;
  const fps = Math.min(FPS_RANGE.max, Math.max(FPS_RANGE.min, Math.round(rawFps)));
  const bitrate = Math.min(
    BITRATE_RANGE.max,
    Math.max(BITRATE_RANGE.min, Math.round(meta.width * meta.height * fps * bitsPerPixel))
  );

  const img = await loadHiddenImage(url);
  const canvas = document.createElement("canvas");
  canvas.width = meta.width;
  canvas.height = meta.height;
  // Transparency is ruled out before we get here, so an opaque context skips the per-frame blend.
  const ctx = canvas.getContext("2d", { alpha: false });
  const stream = canvas.captureStream(fps);
  const recorder = new MediaRecorder(stream, { mimeType: RECORDER_MIME, videoBitsPerSecond: bitrate });

  const chunks = [];
  recorder.ondataavailable = (evt) => {
    if (evt.data.size) chunks.push(evt.data);
  };
  const stopped = new Promise((resolve) => {
    recorder.onstop = resolve;
  });

  let interrupted = false;
  let drawn = 0;
  try {
    const startedAt = performance.now();
    recorder.start();
    await new Promise((resolve) => {
      const draw = () => {
        // requestAnimationFrame stops in a hidden tab, and so does the GIF — the remaining time
        // would record as a frozen frame. Abandon the conversion instead of shipping that.
        if (document.hidden) {
          interrupted = true;
          resolve();
          return;
        }
        drawn++;
        ctx.drawImage(img, 0, 0);
        if (performance.now() - startedAt < meta.durationMs) requestAnimationFrame(draw);
        else resolve();
      };
      requestAnimationFrame(draw);
    });
    recorder.stop();
    await stopped;
  } finally {
    stream.getTracks().forEach((track) => track.stop());
    img.remove();
  }

  if (interrupted) return null;

  // A stalled compositor makes requestAnimationFrame fire a handful of times — or once — across the
  // whole recording window. The GIF is driven by the same rendering pipeline, so when that happens
  // nothing was animating and the recorder captured an empty stream: a structurally valid WebM of a
  // hundred-odd bytes with no frames in it, which is small enough to sail past the size comparison
  // and post as an unplayable video. Require enough draws to have actually covered the animation.
  if (drawn < minimumDraws(meta)) return null;

  return new Blob(chunks, { type: "video/webm" });
};

/**
 * Re-encode an animated GIF as a silent VP9 WebM. Returns a NEW File whose name carries a `.webm`
 * extension and whose type is `video/webm`, so the downstream upload path (which derives the
 * extension from the name) writes it correctly and the message renders it in a `<video>`.
 *
 * Resolves the original file untouched whenever the conversion cannot be trusted to be an
 * improvement — unsupported browser, unparseable GIF, a still image, one too long to sit through,
 * visible transparency, an abandoned recording, or a result that is not actually smaller.
 * Caller gates this behind the convert-GIFs setting.
 * @param {File} file  A `.gif` file.
 * @param {number} bitsPerPixel  Quality dial from settings.
 * @returns {Promise<File>}  The WebM, or the original file.
 */
export const convertGifToWebm = async (file, bitsPerPixel) => {
  try {
    if (!isRecordingSupported()) return file;

    const meta = readGifMetadata(new Uint8Array(await file.arrayBuffer()));
    if (!meta) return file;
    // A single-frame GIF is a still picture; there is no animation to preserve and no win to take.
    if (meta.frames < 2 || !meta.durationMs) return file;
    if (meta.durationMs > MAX_SOURCE_DURATION_MS) return file;

    const url = URL.createObjectURL(file);
    try {
      const probe = await loadHiddenImage(url);
      let transparent;
      try {
        transparent = hasVisibleTransparency(probe, meta.width, meta.height);
      } finally {
        probe.remove();
      }
      if (transparent) return file;

      const blob = await recordAnimation(url, meta, bitsPerPixel);
      // Keep the original when the recording was abandoned or did not actually shrink the file.
      if (!blob?.size || blob.size >= file.size) return file;

      const dot = file.name.lastIndexOf(".");
      const base = dot > 0 ? file.name.substring(0, dot) : file.name;
      return new File([blob], `${base}.webm`, { type: "video/webm" });
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch (error) {
    console.warn("Chat Snap: GIF conversion failed, keeping the original file.", error);
    return file;
  }
};
