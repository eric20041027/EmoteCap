import type { Clip } from '../motion/index';

export interface ExportedFile {
  name: string;
  url: string;
}

/** A failed export: `message` is the headline, `details` holds server output (e.g. Blender stderr). */
export class ExportFailure extends Error {
  readonly details: string;

  constructor(message: string, details = '') {
    super(message);
    this.name = 'ExportFailure';
    this.details = details;
  }
}

type FetchFn = (input: string, init: RequestInit) => Promise<Response>;

const EXPORT_ENDPOINT = '/api/export';
const FILES_PREFIX = '/files/';
const SERVER_HINT =
  'Is the export server running on port 8787? (cd server && uv run uvicorn emotecap_server.main:app --port 8787)';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatValidationIssue(issue: unknown): string {
  if (!isRecord(issue)) return JSON.stringify(issue);
  const location = Array.isArray(issue.loc) ? issue.loc.join('.') : '';
  const message = typeof issue.msg === 'string' ? issue.msg : JSON.stringify(issue);
  return location ? `${location}: ${message}` : message;
}

/** Human-readable text for a FastAPI error body (string, validation list, or {message, stderr}). */
export function describeErrorDetail(body: unknown): string {
  if (body === undefined || body === null || body === '') return '';
  if (typeof body === 'string') return body;
  const detail = isRecord(body) && 'detail' in body ? body.detail : body;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.map(formatValidationIssue).join('\n');
  if (isRecord(detail) && typeof detail.message === 'string') {
    const stderr = typeof detail.stderr === 'string' ? detail.stderr : '';
    return [detail.message, stderr].filter(Boolean).join('\n');
  }
  return JSON.stringify(detail);
}

/** Validate the `{ files: [{ name, url }] }` response; only same-origin /files/ links are accepted. */
export function parseExportResponse(body: unknown): ExportedFile[] {
  if (!isRecord(body) || !Array.isArray(body.files)) {
    throw new ExportFailure('Unexpected response from the export server', JSON.stringify(body) ?? '');
  }
  return body.files.map((file: unknown) => {
    if (!isRecord(file) || typeof file.name !== 'string' || typeof file.url !== 'string' || !file.url.startsWith(FILES_PREFIX)) {
      throw new ExportFailure('Unexpected file entry from the export server', JSON.stringify(file) ?? '');
    }
    return { name: file.name, url: file.url };
  });
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** POST one clip to the server; resolves with the exported files or throws ExportFailure. */
export async function postExport(clip: Clip, fetchFn: FetchFn = fetch): Promise<ExportedFile[]> {
  let response: Response;
  try {
    response = await fetchFn(EXPORT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clips: [clip] }),
    });
  } catch (error) {
    throw new ExportFailure(`Cannot reach the export server. ${SERVER_HINT}`, String(error));
  }
  const body = await readBody(response);
  if (!response.ok) {
    const details = describeErrorDetail(body) || (response.status >= 500 ? SERVER_HINT : '');
    throw new ExportFailure(`Export failed (HTTP ${response.status})`, details);
  }
  return parseExportResponse(body);
}
