import { describe, expect, it, vi } from 'vitest';
import { tposeFrame, type Clip } from '../motion/index';
import { ExportFailure, describeErrorDetail, parseExportResponse, postClips, postExport } from './exportApi';
import { setSkeleton } from '../settings/skeleton';

const CLIP: Clip = { name: 'Clip_01', loop: false, fps: 30, frames: [tposeFrame(0)] };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('parseExportResponse', () => {
  it('returns the exported files', () => {
    const body = { files: [{ name: 'Clip_01', url: '/files/Clip_01.fbx' }] };
    expect(parseExportResponse(body)).toEqual(body.files);
  });

  it.each([null, {}, { files: 'x' }, { files: [{ name: 1, url: '/files/a.fbx' }] }])(
    'rejects malformed body %j',
    (body) => {
      expect(() => parseExportResponse(body)).toThrow(ExportFailure);
    },
  );

  it('rejects URLs outside /files/', () => {
    expect(() => parseExportResponse({ files: [{ name: 'X', url: 'javascript:alert(1)' }] })).toThrow(ExportFailure);
  });
});

describe('describeErrorDetail', () => {
  it('passes a string detail through', () => {
    expect(describeErrorDetail({ detail: 'Not Found' })).toBe('Not Found');
  });

  it('formats FastAPI validation errors', () => {
    const body = { detail: [{ loc: ['body', 'clips', 0, 'name'], msg: 'String should match pattern' }] };
    expect(describeErrorDetail(body)).toBe('body.clips.0.name: String should match pattern');
  });

  it('formats a Blender failure with its stderr tail', () => {
    const body = { detail: { message: 'Blender failed', stderr: 'line 1\nline 2' } };
    expect(describeErrorDetail(body)).toBe('Blender failed\nline 1\nline 2');
  });

  it('falls back to JSON for anything else', () => {
    expect(describeErrorDetail({ oops: true })).toBe('{"oops":true}');
    expect(describeErrorDetail(undefined)).toBe('');
  });
});

describe('postExport', () => {
  it('POSTs the clip and returns the files', async () => {
    const files = [{ name: 'Clip_01', url: '/files/Clip_01.fbx' }];
    const fetchFn = vi.fn(async () => jsonResponse(200, { files }));
    await expect(postExport(CLIP, fetchFn)).resolves.toEqual(files);
    expect(fetchFn).toHaveBeenCalledWith('/api/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clips: [CLIP] }),
    });
  });

  it('reports HTTP errors with status and detail', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(500, { detail: { message: 'Blender failed', stderr: 'boom' } }));
    const error = await postExport(CLIP, fetchFn).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ExportFailure);
    expect((error as ExportFailure).message).toBe('Export failed (HTTP 500)');
    expect((error as ExportFailure).details).toBe('Blender failed\nboom');
  });

  it('reports non-JSON error bodies as text', async () => {
    const fetchFn = vi.fn(async () => new Response('Bad Gateway', { status: 502 }));
    const error = (await postExport(CLIP, fetchFn).catch((e: unknown) => e)) as ExportFailure;
    expect(error.message).toBe('Export failed (HTTP 502)');
    expect(error.details).toBe('Bad Gateway');
  });

  it('POSTs several clips in one request (Export all)', async () => {
    const second: Clip = { ...CLIP, name: 'Clip_02' };
    const files = [
      { name: 'Clip_01', url: '/files/Clip_01.fbx' },
      { name: 'Clip_02', url: '/files/Clip_02.fbx' },
    ];
    const fetchFn = vi.fn(async () => jsonResponse(200, { files }));
    await expect(postClips([CLIP, second], fetchFn)).resolves.toEqual(files);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn).toHaveBeenCalledWith('/api/export', expect.objectContaining({ body: JSON.stringify({ clips: [CLIP, second] }) }));
  });

  it('explains when the server is unreachable', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    const error = (await postExport(CLIP, fetchFn).catch((e: unknown) => e)) as ExportFailure;
    expect(error).toBeInstanceOf(ExportFailure);
    expect(error.message).toMatch(/Cannot reach the export server/);
  });
});

describe('postClips skeleton option', () => {
  it('marks clips as body-only when the body skeleton is selected', async () => {
    setSkeleton('body');
    try {
      const fetchFn = vi.fn().mockResolvedValue(new Response(JSON.stringify({ files: [] }), { status: 200 }));
      await postClips([CLIP], fetchFn);
      const body = JSON.parse(fetchFn.mock.calls[0][1].body as string);
      expect(body.clips[0].skeleton).toBe('body');
    } finally {
      setSkeleton('full');
    }
  });
});
