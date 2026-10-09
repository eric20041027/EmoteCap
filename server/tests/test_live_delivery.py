"""Real async stalled writes/lifecycle; no actual socket, camera or Unity."""
import asyncio
import json
from contextlib import asynccontextmanager
from uuid import uuid4
from starlette.datastructures import URL,Headers
from emotecap_server.relay import LiveRelay
from live_support import hello,frame_text

class Socket:
    url=URL('ws://localhost:8787/ws/live')
    headers=Headers({'Origin':'http://localhost:5173'})
    client=None
    def __init__(self,*,block=None,broken=False,block_close=False):
        self.block=block;self.broken=broken;self.block_close=block_close
        self.messages=[];self.codes=[];self.incoming=asyncio.Queue()
        self.ack=asyncio.Event();self.changed=asyncio.Event();self.entered=asyncio.Event();self.release=asyncio.Event();self.closed=asyncio.Event()
    async def accept(self):pass
    async def receive(self):return await self.incoming.get()
    def put(self,text):self.incoming.put_nowait({'type':'websocket.receive','text':text})
    async def send_text(self,text):
        kind=json.loads(text)['type']
        if kind==self.block:self.entered.set();await self.release.wait()
        if self.broken and kind=='frame':raise ConnectionResetError('Receiver gone')
        self.messages.append(text)
        if kind=='hello':self.ack.set()
        self.changed.set()
    async def close(self,code=1000,reason=''):
        self.codes.append(code);self.closed.set()
        if self.block_close:await asyncio.Event().wait()
        # Sending Close does not magically unblock the server's receive.
    @property
    def frames(self):return [m for m in self.messages if json.loads(m)['type']=='frame']

async def frames(socket,count):
    while len(socket.frames)<count:
        await socket.changed.wait();socket.changed.clear()

@asynccontextmanager
async def paired(*sockets,send_timeout=.5):
    relay=LiveRelay(send_timeout=send_timeout);session=relay.sessions.issue();session.stream_id=str(uuid4())
    tasks=[]
    try:
        for socket in sockets:
            socket.put(hello(session.public(),'sink'));tasks.append(asyncio.create_task(relay.serve(socket,'sink')))
        for socket in sockets:
            await asyncio.wait_for(socket.entered.wait() if socket.block=='hello' else socket.ack.wait(),.2)
        yield relay,session,tasks
    finally:
        for socket in sockets:socket.release.set()
        for task in tasks:task.cancel()
        await asyncio.gather(*tasks,return_exceptions=True)
        await relay.aclose()

def test_broadcast_returns_before_stalled_frame_and_healthy_receiver_progresses():
    async def scenario():
        slow,healthy=Socket(block='frame'),Socket()
        async with paired(slow,healthy) as (relay,session,tasks):
            await asyncio.wait_for(relay.broadcast(session,frame_text(0)),.1)
            await asyncio.wait_for(frames(healthy,1),.1)
            assert healthy.frames==[frame_text(0)] and slow.frames==[]
            await asyncio.wait_for(slow.closed.wait(),.7)
            await relay.broadcast(session,frame_text(1));await asyncio.wait_for(frames(healthy,2),.1)
            assert healthy.frames==[frame_text(0),frame_text(1)]
    asyncio.run(scenario())

def test_thousand_unsent_frames_use_one_slot_and_preserve_new_hello():
    async def scenario():
        slow=Socket(block='hello')
        async with paired(slow,send_timeout=2) as (relay,session,tasks):
            for t in range(1000):await relay.broadcast(session,frame_text(t))
            delivery=next(iter(session.sinks))
            assert delivery.pending_frames<=1 and slow.frames==[]
            session.stream_id=str(uuid4());await relay._announce(session)
            await relay.broadcast(session,frame_text(1000));slow.release.set()
            await asyncio.wait_for(frames(slow,1),.2)
            assert slow.frames==[frame_text(1000)]
            messages=list(map(json.loads,slow.messages))
            assert messages[-2]['type']=='hello' and messages[-2]['streamId']==session.stream_id
    asyncio.run(scenario())

def test_stalled_sink_hello_does_not_delay_source_or_healthy_frames():
    async def scenario():
        slow,healthy,source=Socket(block='hello'),Socket(),Socket()
        async with paired(slow,healthy) as (relay,session,tasks):
            source.put(hello(session.public()));source.put(frame_text(0))
            source_task=asyncio.create_task(relay.serve(source,'source'));tasks.append(source_task)
            await asyncio.wait_for(frames(healthy,1),.1)
            assert healthy.frames==[frame_text(0)] and not slow.closed.is_set()
    asyncio.run(scenario())

def test_failed_receiver_is_dropped_and_healthy_receiver_keeps_order():
    async def scenario():
        broken,healthy=Socket(broken=True),Socket()
        async with paired(broken,healthy) as (relay,session,tasks):
            await relay.broadcast(session,frame_text(0));await asyncio.wait_for(broken.closed.wait(),.1)
            await asyncio.wait_for(frames(healthy,1),.1)
            await relay.broadcast(session,frame_text(1));await asyncio.wait_for(frames(healthy,2),.1)
            assert healthy.frames==[frame_text(0),frame_text(1)] and broken.frames==[]
    asyncio.run(scenario())

def test_shutdown_cancels_owned_idle_receivers_and_source_tasks():
    async def scenario():
        sink,source=Socket(),Socket()
        async with paired(sink) as (relay,session,tasks):
            source.put(hello(session.public()));owned=asyncio.create_task(relay.serve(source,'source'));tasks.append(owned)
            await asyncio.wait_for(source.ack.wait(),.1)
            await asyncio.wait_for(relay.aclose(),.2)
            assert all(task.done() for task in tasks) and relay.sink_count==0
    asyncio.run(scenario())

def test_shutdown_is_bounded_even_when_receiver_close_stalls():
    async def scenario():
        sink=Socket(block_close=True)
        async with paired(sink) as (relay,session,tasks):
            await asyncio.wait_for(relay.aclose(),.7)
            assert all(task.done() for task in tasks) and relay.sink_count==0
    asyncio.run(scenario())

def test_explicit_revocation_does_not_close_another_session():
    async def scenario():
        a,b=Socket(),Socket();relay=LiveRelay();first,other=relay.sessions.issue(),relay.sessions.issue();tasks=[]
        try:
            for socket,session in [(a,first),(b,other)]:
                session.stream_id=str(uuid4());socket.put(hello(session.public(),'sink'))
                tasks.append(asyncio.create_task(relay.serve(socket,'sink')))
            await asyncio.wait_for(asyncio.gather(a.ack.wait(),b.ack.wait()),.1)
            closed=relay.sessions.revoke(first.id,first.source_token);await relay.close_session(closed)
            assert tasks[0].done() and not tasks[1].done() and not b.closed.is_set()
            await relay.broadcast(other,frame_text(0));await asyncio.wait_for(frames(b,1),.1)
            assert b.frames==[frame_text(0)]
        finally:
            for task in tasks:task.cancel()
            await asyncio.gather(*tasks,return_exceptions=True);await relay.aclose()
    asyncio.run(scenario())

def test_queued_frame_behind_stalled_hello_is_never_sent_after_expiry():
    async def scenario():
        sink=Socket(block='hello')
        async with paired(sink) as (relay,session,tasks):
            clock=[session.clock()];session.clock=lambda:clock[0];relay.sessions.clock=session.clock;session.deadline=clock[0]+1
            await relay.broadcast(session,frame_text(0));clock[0]+=2;sink.release.set()
            await asyncio.wait_for(sink.closed.wait(),.2)
            assert sink.frames==[] and sink.codes[0]==1008 and not relay.sessions.live(session)
    asyncio.run(scenario())

def test_send_timeout_never_extends_the_remaining_pairing_lifetime():
    async def scenario():
        sink=Socket(block='frame')
        async with paired(sink) as (relay,session,tasks):
            session.deadline=session.clock()+.02
            await relay.broadcast(session,frame_text(0));await asyncio.wait_for(sink.entered.wait(),.1)
            await asyncio.wait_for(sink.closed.wait(),.15)
            assert sink.frames==[] and sink.codes[0]==1008
    asyncio.run(scenario())

def test_lifetime_timer_firing_early_still_has_expiry_semantics(monkeypatch):
    from emotecap_server.live.delivery import SinkDelivery,PairingExpired
    async def scenario():
        relay=LiveRelay(clock=lambda:0);session=relay.sessions.issue();session.deadline=.02
        delivery=SinkDelivery(Socket(),session,send_timeout=.5)
        async def early_timeout(awaitable,timeout):
            assert timeout==.02;awaitable.close();raise TimeoutError()
        monkeypatch.setattr(asyncio,'wait_for',early_timeout)
        import pytest
        with pytest.raises(PairingExpired):await delivery._send(frame_text(0))
    asyncio.run(scenario())
