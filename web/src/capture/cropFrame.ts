/** 'portrait' crops a centred 3:4 window out of a landscape camera (e.g. an iPhone via Continuity Camera). */
export type CropMode = 'none' | 'portrait';

/** 3:4 rather than 9:16 so outstretched arms still fit. */
export const PORTRAIT_ASPECT = 3 / 4;

export interface CropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

/** Source rectangle to feed the pose model for a frame of the given size. */
export function cropRect(width: number, height: number, mode: CropMode): CropRect {
  if (mode !== 'portrait' || height <= 0 || width / height <= PORTRAIT_ASPECT) {
    return { sx: 0, sy: 0, sw: width, sh: height };
  }
  const sw = Math.round(height * PORTRAIT_ASPECT);
  return { sx: Math.round((width - sw) / 2), sy: 0, sw, sh: height };
}
