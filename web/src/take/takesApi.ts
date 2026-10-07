import type { Segment } from '../motion/index';
import { describeErrorDetail } from '../record/exportApi';
import { HttpFailure,httpJSON } from '../cloud/transport';

export const TAKES_ENDPOINT = '/api/takes';
export const TAKE_FILENAME = 'take.webm';
/** Server limits (contracts/motion-v1.md): checked before uploading. */
export const MAX_TAKE_SECONDS = 180;
export const MAX_TAKE_BYTES = 100 * 1024 * 1024;
const DEFAULT_VIDEO_TYPE = 'video/webm';

export type SliceFailureKind =
  | 'consent-required'
  | 'no-video'
  | 'too-short'
  | 'too-long'
  | 'too-large'
  | 'unsupported-video'
  | 'not-configured'
  | 'gemini-failed'
  | 'no-segments'
  | 'bad-response'
  | 'unreachable'
  | 'timeout'
  | 'skipped'
  | 'server-error'
  | 'unknown';

/** Short reasons for the "Split at pauses — Gemini unavailable (…)" badge. */
const REASONS: Record<SliceFailureKind, string> = {
  'consent-required': 'explicit Gemini permission required',
  'no-video': 'no video recorded',
  'too-short': 'take too short',
  'too-long': 'take longer than 3 min',
  'too-large': 'take too large',
  'unsupported-video': 'video format rejected',
  'not-configured': 'no API key',
  'gemini-failed': 'Gemini request failed',
  'no-segments': 'no moves found',
  'bad-response': 'unexpected response',
  unreachable: 'server unreachable',
  timeout: 'timed out',
  skipped: 'skipped',
  'server-error': 'server error',
  unknown: 'unexpected error',
};

/** Why Gemini could not slice a take. `message` is the short badge reason, `details` the full story. */
export class SliceFailure extends Error {
  readonly kind: SliceFailureKind;
  readonly details: string;

  constructor(kind: SliceFailureKind, reason: string, details = '') {
    super(reason);
    this.name = 'SliceFailure';
    this.kind = kind;
    this.details = details;
  }
}

export function sliceFailure(kind: SliceFailureKind, details = ''): SliceFailure {
  return new SliceFailure(kind, REASONS[kind], details);
}

type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

export interface RequestOptions {
  fetchFn?: FetchFn;
  signal?: AbortSignal;
  consent?:CloudGrant;
}
export interface CloudGrant {readonly token:string;readonly takeId:string}
export function hasCloudGrant(grant:CloudGrant|undefined):grant is CloudGrant {
  return !!grant&&/^[A-Za-z0-9_-]{43}$/.test(grant.token)&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(grant.takeId);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Multipart body for POST /api/takes: the raw (un-mirrored) take video plus its duration. */
export function buildTakeForm(video: Blob, duration: number,takeId?:string): FormData {
  const typed = video.type ? video : new Blob([video], { type: DEFAULT_VIDEO_TYPE });
  const form = new FormData();
  form.append('video', typed, TAKE_FILENAME);
  form.append('duration', duration.toFixed(3));
  if(takeId)form.append('takeId',takeId);
  return form;
}

function parseSegment(item: unknown): Segment {
  if (!isRecord(item) || typeof item.name !== 'string' || !isFiniteNumber(item.start) || !isFiniteNumber(item.end)) {
    throw sliceFailure('bad-response', JSON.stringify(item) ?? '');
  }
  return {
    name: item.name,
    start: item.start,
    end: item.end,
    loop: item.loop === true,
    description: typeof item.description === 'string' ? item.description : '',
  };
}

/** Validate `{ takeId, segments }`; an empty list counts as a failure so the take falls back. */
export function parseTakeResponse(body: unknown): Segment[] {
  if (!isRecord(body) || !Array.isArray(body.segments)) {
    throw sliceFailure('bad-response', JSON.stringify(body) ?? '');
  }
  const segments = body.segments.map(parseSegment);
  if (segments.length === 0) throw sliceFailure('no-segments');
  return segments;
}

/** Error -> fallback reason for a non-2xx answer (503 no key, 502 Gemini failed, 413 too big, 415 not a video). */
export function failureForStatus(status: number, body: unknown): SliceFailure {
  const details = describeErrorDetail(body);
  switch (status) {
    case 403:
      return sliceFailure('consent-required',details);
    case 503:
      return sliceFailure('not-configured', details);
    case 502:
      return sliceFailure('gemini-failed', details);
    case 413:
      return sliceFailure('too-large', details);
    case 415:
      return sliceFailure('unsupported-video', details);
    default:
      return new SliceFailure('server-error', `server error ${status}`, details);
  }
}

/** Any thrown value -> SliceFailure (network errors mean the server is unreachable). */
export function toSliceFailure(error: unknown): SliceFailure {
  if (error instanceof SliceFailure) return error;
  if (error instanceof DOMException && error.name === 'AbortError') return sliceFailure('skipped');
  if (error instanceof DOMException && error.name === 'TimeoutError') return sliceFailure('timeout');
  if (error instanceof TypeError) return sliceFailure('unreachable', error.message);
  return sliceFailure('unknown', String(error));
}

/** Reasons to skip the upload entirely (the server would reject it anyway). */
export function preflightFailure(video: Blob | null, duration: number): SliceFailure | null {
  if (!video || video.size === 0) return sliceFailure('no-video');
  if (!(duration > 0)) return sliceFailure('too-short');
  if (duration > MAX_TAKE_SECONDS) return sliceFailure('too-long');
  if (video.size > MAX_TAKE_BYTES) return sliceFailure('too-large');
  return null;
}

/** POST the take to Gemini via the server; resolves with its segments or rejects with a SliceFailure. */
export async function requestSegments(video: Blob, duration: number, options: RequestOptions = {}): Promise<Segment[]> {
  const { fetchFn = fetch, signal,consent } = options;
  if(!hasCloudGrant(consent))throw sliceFailure('consent-required');
  try {
    const body=await httpJSON(TAKES_ENDPOINT,{method:'POST',body:buildTakeForm(video,duration,consent.takeId),headers:{'X-EmoteCap-Consent':consent.token}},{fetchFn,signal});
    return parseTakeResponse(body);
  } catch (error) {
    if(error instanceof HttpFailure)throw failureForStatus(error.status,error.body);
    throw toSliceFailure(signal?.aborted ? signal.reason : error);
  }
}
