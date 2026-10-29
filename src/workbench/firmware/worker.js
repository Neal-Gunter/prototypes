/**
 * FIRMWARE SEAM (worker side)
 * This module worker only imports the interpreter. It has no DOM access.
 * It does not eval the user's source.
 *
 * A future ESP32-S3 emulator can replace this file. Keep the reply shape:
 *   { id, ok: true, events } or { id, ok: false, error }
 * Events are the list returned by interpretSource().
 */
import { interpretSource } from "./engine.js";

self.onmessage = (event) => {
  const { id, source } = event.data || {};
  try {
    const events = interpretSource(source);
    self.postMessage({ id, ok: true, events });
  } catch (error) {
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : "解释失败",
    });
  }
};
