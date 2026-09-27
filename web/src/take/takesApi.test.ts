import { describe, expect, it, vi } from 'vitest';
import {
  MAX_TAKE_SECONDS,
  SliceFailure,
  buildTakeForm,
  failureForStatus,
  parseTakeResponse,
  preflightFailure,
  requestSegments,
  sliceFailure,
  toSliceFailure,
} from './takesApi';

const VIDEO = new Blob(['webm-bytes'], { type: 'video/webm;codecs=vp9' });
const SEGMENT = { name: 'Wave_Right', start: 1.2, end: 2.5, loop: false, description: 'Waves the right hand' };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

async function failureOf(promise: Promise<unknown>): Promise<SliceFailure> {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(SliceFailure);
  return error as SliceFailure;
}

describe('buildTakeForm', () => {
  it('sends the video as take.webm plus the take duration', () => {
    const form = buildTakeForm(VIDEO, 12.34567);
    const video = form.get('video');
    expect(video).toBeInstanceOf(File);
    expect((video as File).name).toBe('take.webm');
    expect((video as File).type).toBe('video/webm;codecs=vp9');
    expect(form.get('duration')).toBe('12.346');
  });

  it('labels an untyped blob as video/webm so the server accepts it', () => {
    const video = buildTakeForm(new Blob(['x']), 3).get('video') as File;
    expect(video.type).toBe('video/webm');
  });
});

describe('parseTakeResponse', () => {
  it('returns the segments', () => {
    expect(parseTakeResponse({ takeId: 'abc', segments: [SEGMENT] })).toEqual([SEGMENT]);
  });

  it('defaults a missing loop flag and description', () => {
    expect(parseTakeResponse({ segments: [{ name: 'A', start: 0, end: 1 }] })).toEqual([
      { name: 'A', start: 0, end: 1, loop: false, description: '' },
    ]);
  });

  it.each([null, 'oops', {}, { segments: 'x' }, { segments: [{ name: 'A', start: '0', end: 1 }] }])(
    'rejects malformed body %j as bad-response',
    (body) => {
      expect(() => parseTakeResponse(body)).toThrow(SliceFailure);
      try {
        parseTakeResponse(body);
      } catch (error) {
        expect((error as SliceFailure).kind).toBe('bad-response');
      }
    },
  );

  it('treats an empty list as "no moves found" so the take falls back', () => {
    expect(() => parseTakeResponse({ segments: [] })).toThrow(expect.objectContaining({ kind: 'no-segments' }));
  });
});

describe('failureForStatus (error -> fallback reason)', () => {
  it.each([
    [503, 'not-configured', 'no API key'],
    [502, 'gemini-failed', 'Gemini request failed'],
    [413, 'too-large', 'take too large'],
    [415, 'unsupported-video', 'video format rejected'],
    [500, 'server-error', 'server error 500'],
    [422, 'server-error', 'server error 422'],
  ])('HTTP %i -> %s (%s)', (status, kind, reason) => {
    const failure = failureForStatus(status, { detail: 'why' });
    expect(failure.kind).toBe(kind);
    expect(failure.message).toBe(reason);
    expect(failure.details).toBe('why');
  });

  it('keeps the Gemini message of a 502 as details', () => {
    const body = { detail: { message: 'Gemini timed out after 30 s', fallback: 'motion-energy' } };
    expect(failureForStatus(502, body).details).toBe('Gemini timed out after 30 s');
  });
});

describe('toSliceFailure', () => {
  it('passes a SliceFailure through', () => {
    const failure = sliceFailure('timeout');
    expect(toSliceFailure(failure)).toBe(failure);
  });

  it('maps a network TypeError to "server unreachable"', () => {
    const failure = toSliceFailure(new TypeError('Failed to fetch'));
    expect([failure.kind, failure.message]).toEqual(['unreachable', 'server unreachable']);
  });

  it('maps an AbortError to "skipped"', () => {
    expect(toSliceFailure(new DOMException('aborted', 'AbortError')).kind).toBe('skipped');
  });

  it('maps anything else to an unexpected error', () => {
    expect(toSliceFailure(new Error('boom'))).toMatchObject({ kind: 'unknown', details: 'Error: boom' });
  });
});

describe('preflightFailure', () => {
  it('passes a normal take', () => {
    expect(preflightFailure(VIDEO, 20)).toBeNull();
  });

  it.each([
    ['no video', null, 10, 'no-video'],
    ['an empty video', new Blob([]), 10, 'no-video'],
    ['a zero-length take', VIDEO, 0, 'too-short'],
    ['a take over 3 minutes', VIDEO, MAX_TAKE_SECONDS + 1, 'too-long'],
    ['a video over 100 MB', { size: 101 * 1024 * 1024, type: 'video/webm' } as Blob, 10, 'too-large'],
  ])('rejects %s without uploading', (_label, video, duration, kind) => {
    expect(preflightFailure(video, duration)?.kind).toBe(kind);
  });
});

describe('requestSegments', () => {
  it('POSTs the multipart take and returns the segments', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(200, { takeId: 't1', segments: [SEGMENT] }));
    await expect(requestSegments(VIDEO, 5, { fetchFn })).resolves.toEqual([SEGMENT]);
    expect(fetchFn).toHaveBeenCalledWith('/api/takes', expect.objectContaining({ method: 'POST' }));
    const init = (fetchFn.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('duration')).toBe('5.000');
  });

  it('turns a 503 into a not-configured failure', async () => {
    const fetchFn = vi.fn(async () => jsonResponse(503, { detail: 'Gemini is not configured' }));
    const failure = await failureOf(requestSegments(VIDEO, 5, { fetchFn }));
    expect([failure.kind, failure.details]).toEqual(['not-configured', 'Gemini is not configured']);
  });

  it('reads a non-JSON error body as text', async () => {
    const fetchFn = vi.fn(async () => new Response('Bad Gateway', { status: 502 }));
    const failure = await failureOf(requestSegments(VIDEO, 5, { fetchFn }));
    expect([failure.kind, failure.details]).toEqual(['gemini-failed', 'Bad Gateway']);
  });

  it('reports an unreachable server', async () => {
    const fetchFn = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    });
    expect((await failureOf(requestSegments(VIDEO, 5, { fetchFn }))).kind).toBe('unreachable');
  });

  it('rejects with the abort reason (timeout or skip)', async () => {
    const controller = new AbortController();
    const fetchFn = vi.fn(async (_url: string, init: RequestInit) => {
      controller.abort(sliceFailure('timeout'));
      throw init.signal?.reason;
    });
    const failure = await failureOf(requestSegments(VIDEO, 5, { fetchFn, signal: controller.signal }));
    expect(failure.kind).toBe('timeout');
  });
});
