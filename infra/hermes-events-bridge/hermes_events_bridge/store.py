"""Event model + event store for the bridge.

The store is a thin SQLite abstraction. In production, the events flow
into NeureCore's audit log (Postgres). For Phase 1.4, the local store
proves the receive path works end-to-end.
"""

from __future__ import annotations

import json
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any


class EventStore:
    """Thread-safe SQLite event store."""

    def __init__(self, db_path: str | Path) -> None:
        self.db_path = Path(db_path)
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.RLock()
        self._conn = sqlite3.connect(str(self.db_path), check_same_thread=False)
        self._conn.execute(
            """
            CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                event_type TEXT NOT NULL,
                execution_id TEXT NOT NULL,
                ts INTEGER NOT NULL,
                payload_json TEXT NOT NULL,
                received_at INTEGER NOT NULL,
                raw_body TEXT NOT NULL
            )
            """
        )
        self._conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_events_execution_id ON events(execution_id)"
        )
        self._conn.commit()

    def record(
        self,
        event_type: str,
        execution_id: str,
        ts: int,
        payload: dict[str, Any],
        raw_body: str,
    ) -> int:
        with self._lock:
            cur = self._conn.execute(
                """
                INSERT INTO events (event_type, execution_id, ts, payload_json, received_at, raw_body)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    event_type,
                    execution_id,
                    ts,
                    json.dumps(payload, separators=(",", ":")),
                    int(time.time() * 1000),
                    raw_body,
                ),
            )
            self._conn.commit()
            return cur.lastrowid or 0

    def list_by_execution(self, execution_id: str) -> list[dict[str, Any]]:
        with self._lock:
            cur = self._conn.execute(
                """
                SELECT id, event_type, execution_id, ts, payload_json, received_at
                FROM events WHERE execution_id = ?
                ORDER BY id ASC
                """,
                (execution_id,),
            )
            rows = cur.fetchall()
        return [
            {
                "id": r[0],
                "type": r[1],
                "executionId": r[2],
                "ts": r[3],
                "payload": json.loads(r[4]),
                "receivedAt": r[5],
            }
            for r in rows
        ]

    def list_all(self, limit: int = 100) -> list[dict[str, Any]]:
        with self._lock:
            cur = self._conn.execute(
                """
                SELECT id, event_type, execution_id, ts, payload_json, received_at
                FROM events ORDER BY id DESC LIMIT ?
                """,
                (limit,),
            )
            rows = cur.fetchall()
        return [
            {
                "id": r[0],
                "type": r[1],
                "executionId": r[2],
                "ts": r[3],
                "payload": json.loads(r[4]),
                "receivedAt": r[5],
            }
            for r in rows
        ]

    def close(self) -> None:
        with self._lock:
            self._conn.close()
