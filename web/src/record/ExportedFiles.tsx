import type { ExportedFile } from './exportApi';

interface ExportedFilesProps {
  files: ExportedFile[];
}

/** Download links for every clip exported this session. */
export function ExportedFiles({ files }: ExportedFilesProps) {
  if (files.length === 0) return null;
  return (
    <div className="exported">
      <h3 className="exported__title">Exported clips</h3>
      <ul className="exported__list">
        {files.map((file, index) => (
          <li key={`${file.url}-${files.length - index}`} className="exported__item">
            <span className="exported__name">{file.name}</span>
            <a className="btn btn--link" href={file.url} download>
              Download .fbx
            </a>
          </li>
        ))}
      </ul>
      <p className="dock__meta">
        With UNITY_EXPORT_DIR set on the server, clips also land in your Unity project automatically.
      </p>
    </div>
  );
}
