import { ExportErrorAlert } from './ExportErrorAlert';
import type { Exporter } from './useExporter';

interface ExportFormProps {
  exporter: Exporter;
  onExport: () => void;
}

/** Clip name, loop flag, Export button and the last export error. */
export function ExportForm({ exporter, onExport }: ExportFormProps) {
  const { name, setName, nameIsValid, loop, setLoop, busy, error } = exporter;

  return (
    <form
      className="export-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (nameIsValid && !busy) onExport();
      }}
    >
      <label className="field">
        <span className="field__label">Clip name</span>
        <input
          className={`field__input${nameIsValid ? '' : ' field__input--invalid'}`}
          value={name}
          maxLength={24}
          spellCheck={false}
          aria-invalid={!nameIsValid}
          onChange={(e) => setName(e.target.value)}
        />
        {!nameIsValid && <span className="field__error">Use 1–24 letters, digits or underscores.</span>}
      </label>
      <label className="checkbox">
        <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} />
        <span>Loop</span>
      </label>
      <button type="submit" className="btn btn--primary btn--large" disabled={!nameIsValid || busy}>
        {busy ? 'Exporting…' : 'Export FBX'}
      </button>
      <ExportErrorAlert error={error} />
    </form>
  );
}
