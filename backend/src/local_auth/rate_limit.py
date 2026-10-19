"""A small in-memory rate limiter for the sign-in and sign-up routes.

This is the second line of defence. The first is the per-account lockout
(5 wrong passwords → 15 minutes). This limiter stops one address hammering
many different accounts.

Limits: it lives in one process's memory, so it resets on restart and isn't
shared between workers. Behind a proxy every request may look like it comes
from the proxy's address, so the budget is generous. Good enough for a pilot;
a shared store (Postgres or Redis) is the upgrade path.
"""

import threading
import time
from collections import defaultdict, deque


class SlidingWindowLimiter:
    def __init__(self, max_events: int, window_seconds: float):
        self.max_events = max_events
        self.window_seconds = window_seconds
        self._events: dict[str, deque] = defaultdict(deque)
        # FastAPI runs plain `def` routes on a thread pool, so guard the dict.
        self._lock = threading.Lock()

    def allow(self, key: str) -> bool:
        """Record one event for `key`; False if it is over budget."""
        now = time.monotonic()
        with self._lock:
            events = self._events[key]
            while events and now - events[0] > self.window_seconds:
                events.popleft()
            if len(events) >= self.max_events:
                return False
            events.append(now)
            return True

    def reset(self) -> None:
        """Forget everything (used by tests so they don't share one budget)."""
        with self._lock:
            self._events.clear()
