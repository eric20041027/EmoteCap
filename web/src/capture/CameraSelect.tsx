import type { CameraDevice } from './useCameraDevices';

interface CameraSelectProps {
  devices: CameraDevice[];
  deviceId: string;
  onChange: (deviceId: string) => void;
}

/** Camera picker; an iPhone shows up here via Continuity Camera (stand it upright for a full-body shot). */
export function CameraSelect({ devices, deviceId, onChange }: CameraSelectProps) {
  return (
    <label className="camera-select" title="Mount an iPhone upright (Continuity Camera) to fit your whole body from closer.">
      <select aria-label="Camera" value={deviceId} onChange={(event) => onChange(event.target.value)}>
        <option value="">Default camera</option>
        {devices.map((device) => (
          <option key={device.deviceId} value={device.deviceId}>
            {device.label}
          </option>
        ))}
      </select>
    </label>
  );
}
