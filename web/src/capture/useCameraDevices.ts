import { useCallback, useEffect, useState } from 'react';

export interface CameraDevice {
  deviceId: string;
  label: string;
}

/**
 * The camera is remembered by label ("澎澎man相機"), not deviceId: Safari issues new deviceIds on every
 * page load, so a saved id would point at nothing after a reload.
 */
const STORAGE_KEY = 'emotecap.cameraLabel';

function readSavedLabel(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveLabel(label: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, label);
  } catch {
    // Private mode or blocked storage: the choice just is not remembered.
  }
}

/**
 * Video inputs (the built-in camera, an iPhone via Continuity Camera, virtual cameras) plus the chosen one.
 * An empty deviceId means "browser default". Labels only appear after camera permission is granted,
 * so call `refresh` once the camera is running; the remembered camera is then re-selected by label.
 */
export function useCameraDevices() {
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [preferredLabel, setPreferredLabel] = useState(readSavedLabel);

  const refresh = useCallback(async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      setDevices(
        all
          .filter((d) => d.kind === 'videoinput' && d.deviceId)
          .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` })),
      );
    } catch (error) {
      console.warn('Could not list cameras:', error);
    }
  }, []);

  useEffect(() => {
    void refresh();
    navigator.mediaDevices?.addEventListener?.('devicechange', refresh);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', refresh);
  }, [refresh]);

  // Once labels are known, switch to the remembered camera if it is connected.
  useEffect(() => {
    if (!preferredLabel) return;
    const match = devices.find((d) => d.label === preferredLabel);
    if (match) setDeviceId(match.deviceId);
  }, [devices, preferredLabel]);

  const choose = useCallback(
    (id: string) => {
      const label = devices.find((d) => d.deviceId === id)?.label ?? '';
      saveLabel(label);
      setPreferredLabel(label);
      setDeviceId(id);
    },
    [devices],
  );

  // An id from a device that disappeared (unplugged iPhone) falls back to the default camera.
  const current = devices.some((d) => d.deviceId === deviceId) ? deviceId : '';
  return { devices, deviceId: current, setDeviceId: choose, refresh };
}
