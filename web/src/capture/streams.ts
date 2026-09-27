/** Stop every track of a camera stream (turns the camera light off). */
export function stopStream(stream: MediaStream | undefined): void {
  stream?.getTracks().forEach((track) => track.stop());
}

/**
 * Take `stream` off the shared camera <video>, but only while it is still the one shown: a superseded capture
 * session that finishes starting late must not blank the camera the current session already attached.
 */
export function detachStream(video: { srcObject: MediaProvider | null }, stream: MediaStream | undefined): void {
  if (stream && video.srcObject === stream) video.srcObject = null;
}
