import json
import queue
import threading
from datetime import datetime, timezone, timedelta

NI_TZ = timezone(timedelta(hours=-6))


class OrderEventBus:
    """Bus de eventos en tiempo real (Server-Sent Events) para alertas inmediatas al personal."""

    def __init__(self):
        self._lock = threading.Lock()
        self._subscribers = set()

    def subscribe(self) -> queue.Queue:
        q = queue.Queue(maxsize=50)
        with self._lock:
            self._subscribers.add(q)
        return q

    def unsubscribe(self, q: queue.Queue) -> None:
        with self._lock:
            self._subscribers.discard(q)

    def publish(self, event_type: str, payload: dict) -> None:
        message = {
            'type': event_type,
            'timestamp': datetime.now(NI_TZ).isoformat(),
            'data': payload,
        }
        serialized = f"event: {event_type}\ndata: {json.dumps(message, ensure_ascii=False)}\n\n"
        with self._lock:
            dead = []
            for q in list(self._subscribers):
                try:
                    q.put_nowait(serialized)
                except queue.Full:
                    dead.append(q)
            for q in dead:
                self._subscribers.discard(q)

    @property
    def subscriber_count(self) -> int:
        with self._lock:
            return len(self._subscribers)


order_event_bus = OrderEventBus()
