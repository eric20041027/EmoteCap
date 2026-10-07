interface ProcessingConsentPanelProps {
  allowed:boolean;
  onChange:(allowed:boolean)=>void;
}
export function ProcessingConsentPanel({allowed,onChange}:ProcessingConsentPanelProps){
  return <section aria-label="MediaPipe processing" className="studio-processing">
    <h2>Camera and video processing</h2>
    <p id="sdk-processing-help">Images and video are processed on this device. MediaPipe APIs send performance and usage metrics to Google.</p>
    <label className="studio-processing__choice"><input type="checkbox" checked={allowed}
      onChange={event=>onChange(event.target.checked)} aria-describedby="sdk-processing-help sdk-processing-limits" />
      Allow MediaPipe performance and usage metrics</label>
    <p id="sdk-processing-limits">Camera and video processing require this choice. Samples, saved takes, editing and export remain available without it.
      Turning this off stops new processing; it cannot remove metrics already sent, and already-started operations may finish.</p>
    <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a>
  </section>;
}
