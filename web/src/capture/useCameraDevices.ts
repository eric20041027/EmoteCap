import { useCallback, useEffect, useState } from 'react';

export interface CameraDevice {
  deviceId: string;
  label: string;
}

const STORAGE_KEY = 'emotecap.cameraDeviceId';

function readSaved(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function save(deviceId: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, deviceId);
  } catch {
    // Private mode or blocked storage: the choice just is not remembered.
  }
}

/**
 * Video inputs (the built-in camera, an iPhone via Continuity Camera, virtual cameras) plus the chosen one.
 * An empty deviceId means "browser default". Labels only appear after camera permission is granted,
 * so call `refresh` once the camera is running.
 */
export function useCameraDevices() {
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [deviceId, setDeviceIdState] = useState<string>(readSaved);

  const refresh = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      const cameras = all
        .filter((d) => d.kind === 'videoinput' && d.deviceId)
        .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
      setDevices(cameras);
    } catch (error) {
      console.warn('Could not list cameras:', error);
    }
  }, []);

  useEffect(() => {
    void refresh();
    navigator.mediaDevices?.addEventListener?.('devicechange', refresh);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', refresh);
  }, [refresh]);

  const setDeviceId = useCallback((id: string) => {
    save(id);
    setDeviceIdState(id);
  }, []);

  // A saved camera that is no longer connected falls back to the default.
  const available = deviceId === '' || devices.length === 0 || devices.some((d) => d.deviceId === deviceId);
  return { devices, deviceId: available ? deviceId : '', setDeviceId, refresh };
}
