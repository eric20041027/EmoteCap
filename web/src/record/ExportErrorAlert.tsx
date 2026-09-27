import type { ExportFailure } from './exportApi';

/** The last export error: headline plus server output (e.g. Blender stderr). */
export function ExportErrorAlert({ error }: { error: ExportFailure | null }) {
  if (!error) return null;
  return (
    <div className="alert alert--error" role="alert">
      <strong>{error.message}</strong>
      {error.details && <pre className="alert__details">{error.details}</pre>}
    </div>
  );
}
