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
        Download the FBX files and add them to your Unity project.
      </p>
    </div>
  );
}
