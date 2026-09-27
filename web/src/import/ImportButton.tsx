import { useRef } from 'react';

interface ImportButtonProps {
  disabled: boolean;
  onFile: (file: File) => void;
}

/** "Import video": pick a recorded video to turn into a take. */
export function ImportButton({ disabled, onFile }: ImportButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        className="btn btn--secondary"
        disabled={disabled}
        title="Turn a recorded video (mp4, mov or webm, up to 3 minutes, one person in full view) into a take"
        onClick={() => inputRef.current?.click()}
      >
        Import video
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        hidden
        aria-label="Video file to import"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = ''; // picking the same file again still fires onChange
          if (file) onFile(file);
        }}
      />
    </>
  );
}
