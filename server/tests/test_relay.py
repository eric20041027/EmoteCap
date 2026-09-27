"""Live Link relay tests: /ws/live over TestClient websockets, plus a fake-sink broadcast test."""
import asyncio
import json
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from emotecap_server import main
from emotecap_server.contract import BONE_COUNT, BONES
from emotecap_server.relay import LiveRelay

SOURCE_URL = "/ws/live?role=source"
SINK_URL = "/ws/live?role=sink"
POLICY_VIOLATION = 1008


def hello_text() -> str:
    return json.dumps({"type": "hello", "version": 1, "bones": BONES})


def frame_text(t: float) -> str:
    """Default json.dumps spacing: a relay that re-serialized JSON would change these bytes."""
    frame = {"type": "frame", "t": t, "h": [0.0, 0.93, 0.0], "r": [0.0, 0.0, 0.0, 1.0] * BONE_COUNT}
    return json.dumps(frame)


@pytest.fixture
def relay(monkeypatch: pytest.MonkeyPatch) -> LiveRelay:
    """A fresh relay per test, so sinks never leak from one test into the next."""
    fresh = LiveRelay()
    monkeypatch.setattr(main, "relay", fresh)
    return fresh


@pytest.fixture
def client(relay: LiveRelay) -> Iterator[TestClient]:
    # As a context manager, TestClient runs every websocket session on one event loop, as uvicorn does.
    with TestClient(main.app) as test_client:
        yield test_client


def test_source_message_reaches_sink_unchanged(client: TestClient) -> None:
    message = frame_text(1 / 30)
    with client.websocket_connect(SINK_URL) as sink, client.websocket_connect(SOURCE_URL) as source:
        source.send_text(message)

        assert sink.receive_text() == message


def test_source_messages_reach_every_sink_in_order(client: TestClient) -> None:
    messages = [hello_text(), frame_text(0.0), frame_text(1 / 30)]
    with (
        client.websocket_connect(SINK_URL) as sink_a,
        client.websocket_connect(SINK_URL) as sink_b,
        client.websocket_connect(SOURCE_URL) as source,
    ):
        for message in messages:
            source.send_text(message)

        assert [sink_a.receive_text() for _ in messages] == messages
        assert [sink_b.receive_text() for _ in messages] == messages


def test_sink_disconnect_does_not_break_source(client: TestClient, relay: LiveRelay) -> None:
    later = [frame_text(k / 30) for k in range(1, 4)]
    with client.websocket_connect(SINK_URL) as survivor, client.websocket_connect(SOURCE_URL) as source:
        with client.websocket_connect(SINK_URL) as leaver:
            source.send_text(frame_text(0.0))
            assert leaver.receive_text() == frame_text(0.0)
        # Leaving the block closed the leaver and waited for its server task to finish.

        for message in later:
            source.send_text(message)

        assert survivor.receive_text() == frame_text(0.0)
        assert [survivor.receive_text() for _ in later] == later
        assert relay.sink_count == 1


def test_sinks_do_not_relay_what_they_send(client: TestClient) -> None:
    with (
        client.websocket_connect(SINK_URL) as chatty,
        client.websocket_connect(SINK_URL) as listener,
        client.websocket_connect(SOURCE_URL) as source,
    ):
        chatty.send_text("sinks are listen-only")
        source.send_text(frame_text(0.0))

        # Each sink's first message is the source's frame, not the chatty sink's text.
        assert listener.receive_text() == frame_text(0.0)
        assert chatty.receive_text() == frame_text(0.0)


@pytest.mark.parametrize("url", ["/ws/live?role=spectator", "/ws/live"])
def test_invalid_or_missing_role_is_closed_with_1008(
    client: TestClient, relay: LiveRelay, url: str
) -> None:
    with pytest.raises(WebSocketDisconnect) as closed, client.websocket_connect(url) as websocket:
        websocket.receive_text()

    assert closed.value.code == POLICY_VIOLATION
    assert relay.sink_count == 0


class FakeSink:
    """Just enough of a Starlette WebSocket for LiveRelay.serve(..., "sink")."""

    client = None

    def __init__(self, *, broken: bool = False) -> None:
        self.broken = broken
        self.received: list[str] = []
        self.gone = asyncio.Event()

    async def accept(self) -> None:
        return None

    async def receive(self) -> dict[str, Any]:
        await self.gone.wait()
        return {"type": "websocket.disconnect", "code": 1000}

    async def send_text(self, text: str) -> None:
        if self.broken:
            raise ConnectionResetError("sink vanished before its disconnect was processed")
        self.received.append(text)


def test_broadcast_drops_sink_whose_send_fails_and_keeps_the_rest() -> None:
    async def scenario() -> None:
        relay = LiveRelay()
        healthy, broken = FakeSink(), FakeSink(broken=True)
        tasks = [asyncio.create_task(relay.serve(sink, "sink")) for sink in (healthy, broken)]
        await asyncio.sleep(0)  # let both sinks register
        assert relay.sink_count == 2

        await relay.broadcast("one")  # must not raise
        await relay.broadcast("two")

        assert healthy.received == ["one", "two"]
        assert relay.sink_count == 1
        for sink in (healthy, broken):
            sink.gone.set()
        await asyncio.gather(*tasks)
        assert relay.sink_count == 0

    asyncio.run(scenario())
