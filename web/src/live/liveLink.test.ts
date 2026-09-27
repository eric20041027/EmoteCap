import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { tposeFrame } from '../motion';
import { LiveLinkSender, type SocketLike } from './liveLink';

class FakeSocket implements SocketLike {
  static instances: FakeSocket[] = [];
  readyState = 0;
  bufferedAmount = 0;
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(readonly url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
}

const makeSender = (statuses: string[] = []) =>
  new LiveLinkSender({ url: 'ws://test/ws/live?role=source', createSocket: (url) => new FakeSocket(url) }, (s) => statuses.push(s));

describe('LiveLinkSender', () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('sends hello with the bone order as soon as the socket opens', () => {
    const sender = makeSender();
    sender.start();
    FakeSocket.instances[0].open();
    const hello = JSON.parse(FakeSocket.instances[0].sent[0]);
    expect(hello.type).toBe('hello');
    expect(hello.bones[0]).toBe('Hips');
    expect(hello.bones).toHaveLength(48);
  });

  it('sends frames with type "frame" and the full rotation array', () => {
    const sender = makeSender();
    sender.start();
    FakeSocket.instances[0].open();
    expect(sender.send(tposeFrame(1.25))).toBe(true);
    const frame = JSON.parse(FakeSocket.instances[0].sent[1]);
    expect(frame).toMatchObject({ type: 'frame', t: 1.25 });
    expect(frame.r).toHaveLength(192);
    expect(frame.h).toHaveLength(3);
  });

  it('drops frames while the socket is not open or is backed up', () => {
    const sender = makeSender();
    sender.start();
    expect(sender.send(tposeFrame())).toBe(false);
    FakeSocket.instances[0].open();
    FakeSocket.instances[0].bufferedAmount = 1_000_000;
    expect(sender.send(tposeFrame())).toBe(false);
  });

  it('reconnects after the socket closes and reports status changes', () => {
    const statuses: string[] = [];
    const sender = makeSender(statuses);
    sender.start();
    FakeSocket.instances[0].open();
    FakeSocket.instances[0].close();
    vi.advanceTimersByTime(2000);
    expect(FakeSocket.instances).toHaveLength(2);
    expect(statuses).toEqual(['connecting', 'live', 'connecting']);
  });

  it('stays stopped after stop()', () => {
    const sender = makeSender();
    sender.start();
    FakeSocket.instances[0].open();
    sender.stop();
    vi.advanceTimersByTime(5000);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(sender.send(tposeFrame())).toBe(false);
  });
});
