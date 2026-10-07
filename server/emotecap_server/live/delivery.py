"""One writer, one pending latest frame and independent non-droppable hello."""
import asyncio

class PairingExpired(Exception):pass

class SinkDelivery:
    def __init__(self,socket,session,send_timeout=.5,*,close=None):
        self.socket=socket;self.session=session;self.send_timeout=send_timeout;self._close=close or self._close_socket
        self._hello=None;self._frame=None;self._stream_id=None;self._wake=asyncio.Event()
        self.closed=False;self.task=None;self.owner_task=None
    @property
    def pending_frames(self):return int(self._frame is not None)
    def offer_hello(self,text,stream_id):
        if self.closed:return
        self._stream_id=stream_id;self._hello=(text,stream_id);self._frame=None;self._wake.set()
    def offer_frame(self,text,stream_id):
        if self.closed or stream_id is None or stream_id!=self._stream_id:return
        self._frame=(text,stream_id);self._wake.set()
    async def _close_socket(self,socket,code=1000,reason=''):
        try:await asyncio.wait_for(socket.close(code=code,reason=reason),self.send_timeout)
        except Exception:pass
    def _remaining(self):
        remaining=self.session.deadline-self.session.clock()
        if not self.session.active or remaining<=0:raise PairingExpired()
        return remaining
    async def _send(self,text):
        remaining=self._remaining()
        async def admitted_send():
            # A child can start after an event-loop pause; recheck at its actual entry.
            self._remaining();await self.socket.send_text(text)
        try:await asyncio.wait_for(admitted_send(),min(self.send_timeout,remaining))
        except TimeoutError:
            self._remaining() # Distinguish pairing expiry from an ordinary stalled receiver.
            raise
    async def run(self):
        self.task=asyncio.current_task();delivered_stream=None
        try:
            while not self.closed:
                remaining=self._remaining()
                try:await asyncio.wait_for(self._wake.wait(),remaining)
                except TimeoutError as exc:raise PairingExpired() from exc
                self._remaining()
                self._wake.clear();control,frame=self._hello,self._frame;self._hello=None;self._frame=None
                if control:
                    await self._send(control[0]);delivered_stream=control[1]
                    self._remaining()
                if frame and frame[1]==self._stream_id==delivered_stream:
                    await self._send(frame[0])
        except asyncio.CancelledError:raise
        except PairingExpired:await self._close(self.socket,1008,'Pairing expired')
        except Exception:
            await self._close(self.socket,1011,'Receiver could not keep up')
        finally:
            self.closed=True;self._hello=None;self._frame=None
    async def aclose(self,*,close_socket=True):
        self.closed=True;self._hello=None;self._frame=None;self._wake.set()
        task=self.task
        if task and task is not asyncio.current_task() and not task.done():
            task.cancel();await asyncio.wait({task},timeout=self.send_timeout)
        if close_socket:await self._close(self.socket,1008,'Pairing stopped or expired')
