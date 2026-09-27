"""Live Link relay (phase 2): ws://<server>/ws/live?role=source|sink.

Every text message a source (the browser) sends is forwarded unchanged to every connected sink
(Unity). Sinks only listen. See contracts/motion-v1.md, "Live Link WebSocket".
"""
import asyncio
import logging

from fastapi import WebSocket, status

logger = logging.getLogger(__name__)

SOURCE = "source"
SINK = "sink"


class LiveRelay:
    def __init__(self) -> None:
        # Replaced on every change, never mutated, so a broadcast can iterate its own snapshot.
        self._sinks: frozenset[WebSocket] = frozenset()

    @property
    def sink_count(self) -> int:
        return len(self._sinks)

    async def serve(self, websocket: WebSocket, role: str | None) -> None:
        """Run one /ws/live connection until it disconnects."""
        # Accept before rejecting: a close sent before accept reaches the client as a bare HTTP 403
        # without the 1008 code and reason.
        await websocket.accept()
        if role == SOURCE:
            await self._serve_source(websocket)
        elif role == SINK:
            await self._serve_sink(websocket)
        else:
            logger.warning("Rejected live connection from %s with role=%r", websocket.client, role)
            await websocket.close(
                code=status.WS_1008_POLICY_VIOLATION, reason=f"role must be {SOURCE} or {SINK}"
            )

    async def broadcast(self, text: str) -> None:
        """Send `text` to every sink concurrently and drop sinks whose send fails. Never raises."""
        sinks = tuple(self._sinks)
        if not sinks:
            return
        delivered = await asyncio.gather(*(_send(sink, text) for sink in sinks))
        failed = {sink for sink, ok in zip(sinks, delivered, strict=True) if not ok}
        if failed:
            self._sinks = self._sinks - failed

    async def _serve_source(self, source: WebSocket) -> None:
        logger.info("Live source %s connected (%d sinks)", source.client, self.sink_count)
        while True:
            message = await source.receive()
            if message["type"] == "websocket.disconnect":
                break
            text = message.get("text")
            if text is not None:  # binary messages are not part of the contract
                await self.broadcast(text)
        logger.info("Live source %s disconnected", source.client)

    async def _serve_sink(self, sink: WebSocket) -> None:
        self._sinks = self._sinks | {sink}
        logger.info("Live sink %s connected (%d sinks)", sink.client, self.sink_count)
        try:
            while (await sink.receive())["type"] != "websocket.disconnect":
                pass  # sinks are listen-only; drop whatever they send
        finally:
            self._sinks = self._sinks - {sink}
            logger.info("Live sink %s disconnected (%d sinks)", sink.client, self.sink_count)


async def _send(sink: WebSocket, text: str) -> bool:
    """True if `text` went out. A failing sink is logged here and never reaches the source."""
    try:
        await sink.send_text(text)
    except Exception as exc:  # noqa: BLE001 - any sink failure must only drop that sink
        logger.warning("Dropping live sink %s: %r", sink.client, exc)
        return False
    return True
