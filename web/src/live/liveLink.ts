/**
 * Browser side of Live Link: streams MotionFrames to the server relay (contracts/motion-v1.md, phase 2).
 * Frames are dropped, never queued, while the socket is closed or backed up, so Unity always
 * gets the freshest pose and a paused sink cannot stall capture.
 */
import { CONTRACT_VERSION, DRIVEN_BONES, type MotionFrame } from '../motion';

export type LiveLinkStatus = 'off' | 'connecting' | 'live';

/** The subset of WebSocket this sender uses (lets tests inject a fake). */
export interface SocketLike {
  readonly readyState: number;
  readonly bufferedAmount: number;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  send(data: string): void;
  close(): void;
}

export interface LiveLinkOptions {
  url: string;
  createSocket?: (url: string) => SocketLike;
  /** Skip frames while more than this many bytes are waiting to be sent. */
  maxBufferedBytes?: number;
  reconnectDelayMs?: number;
}

const OPEN = 1;
const round = (value: number) => Math.round(value * 1e5) / 1e5;

/** Default relay URL, going through the Vite dev-server proxy. */
export function defaultLiveLinkUrl(): string {
  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${scheme}://${window.location.host}/ws/live?role=source`;
}

export class LiveLinkSender {
  private socket: SocketLike | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private running = false;
  private status: LiveLinkStatus = 'off';
  private readonly createSocket: (url: string) => SocketLike;
  private readonly maxBufferedBytes: number;
  private readonly reconnectDelayMs: number;

  constructor(
    private readonly options: LiveLinkOptions,
    private readonly onStatus: (status: LiveLinkStatus) => void = () => undefined,
  ) {
    this.createSocket = options.createSocket ?? ((url) => new WebSocket(url) as unknown as SocketLike);
    this.maxBufferedBytes = options.maxBufferedBytes ?? 64 * 1024;
    this.reconnectDelayMs = options.reconnectDelayMs ?? 2000;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.connect();
  }

  stop(): void {
    this.running = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const socket = this.socket;
    this.socket = null;
    socket?.close();
    this.setStatus('off');
  }

  /** Returns true when the frame was handed to the socket. */
  send(frame: MotionFrame): boolean {
    const socket = this.socket;
    if (!socket || socket.readyState !== OPEN || socket.bufferedAmount > this.maxBufferedBytes) return false;
    socket.send(JSON.stringify({ type: 'frame', t: round(frame.t), h: frame.h.map(round), r: frame.r.map(round) }));
    return true;
  }

  private connect(): void {
    this.setStatus('connecting');
    const socket = this.createSocket(this.options.url);
    this.socket = socket;
    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'hello', version: CONTRACT_VERSION, bones: DRIVEN_BONES }));
      this.setStatus('live');
    };
    socket.onclose = () => {
      if (this.socket !== socket || !this.running) return;
      this.socket = null;
      this.setStatus('connecting');
      this.reconnectTimer = setTimeout(() => this.connect(), this.reconnectDelayMs);
    };
    socket.onerror = () => socket.close();
  }

  private setStatus(status: LiveLinkStatus): void {
    if (status === this.status) return;
    this.status = status;
    this.onStatus(status);
  }
}
