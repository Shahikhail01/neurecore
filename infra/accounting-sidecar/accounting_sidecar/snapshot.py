"""Snapshot reader — mmap'd per-tenant beancount files.

Plan ref: NC-ACCT-IMP-1 §3 (Snapshot strategy).

In production, NestJS writes the beancount file to
`/var/lib/neurecore/accounting/snapshots/<tenantId>.beancount` and the
sidecar reads it (mmap'd) without DB access.

State model:
- One mmap per tenant, kept in `_MMAPS: dict[str, mmap]`.
- A SIGHUP handler remaps on demand (cheap, mmap ~ms).
- On every report call, we re-validate the mmap's freshness by stat-ing
  the file mtime; if it differs from the cached mtime, remap.

Failure mode:
- File doesn't exist (regen hasn't run yet, or tenant has no entries):
  fall back to an empty beancount text. Report returns zeroed values.
- File is malformed: return 400. Caller decides how to recover.
"""
from __future__ import annotations

import mmap
import os
import signal
from pathlib import Path
from typing import Optional, Union


class _EmptyMmap:
    """Sentinel for an empty file (mmap requires non-zero size)."""
    def close(self) -> None:
        pass
    def __getitem__(self, key):
        return b""
    def __getslice__(self, i, j):
        return b""


SNAPSHOT_DIR = Path(
    os.environ.get(
        "ACCOUNTING_SNAPSHOT_DIR",
        "/var/lib/neurecore/accounting/snapshots",
    )
)


class SnapshotStore:
    """Thread-safe-ish mmap cache keyed by tenantId."""

    def __init__(self, snapshot_dir: Path = SNAPSHOT_DIR) -> None:
        self._dir = snapshot_dir
        self._mmaps: dict[str, tuple[mmap.mmap, float, int]] = {}
        # Map tenant → (mmap, mtime_at_load, size_at_load).

    @property
    def dir(self) -> Path:
        return self._dir

    def path(self, tenant_id: str) -> Path:
        return self._dir / f"{tenant_id}.beancount"

    def read(self, tenant_id: str) -> str:
        """Return the beancount text for a tenant, with mmap cache + auto-remap.

        Returns empty string if the file does not exist.
        """
        p = self.path(tenant_id)
        if not p.exists():
            return ""

        try:
            stat = p.stat()
        except OSError:
            return ""

        cached = self._mmaps.get(tenant_id)
        if cached is not None:
            mm, mtime, size = cached
            if mtime == stat.st_mtime and size == stat.st_size:
                # Cache hit
                try:
                    return mm[:].decode("utf-8")
                except (ValueError, UnicodeDecodeError):
                    # mmap was resized out from under us — force remap
                    pass

        # (Re)map
        self._remap(tenant_id, stat)
        cached = self._mmaps.get(tenant_id)
        if cached is None:
            return ""
        mm, _, _ = cached
        return mm[:].decode("utf-8")

    def _remap(self, tenant_id: str, stat: os.stat_result) -> None:
        # Close prior mmap, if any.
        prior = self._mmaps.pop(tenant_id, None)
        if prior is not None:
            try:
                prior[0].close()
            except Exception:
                pass

        try:
            fd = os.open(str(self.path(tenant_id)), os.O_RDONLY)
        except OSError:
            return
        try:
            if stat.st_size == 0:
                # Empty file: cannot mmap. Cache a sentinel that yields "".
                self._mmaps[tenant_id] = (_EmptyMmap(), stat.st_mtime, 0)
            else:
                mm = mmap.mmap(fd, 0, prot=mmap.PROT_READ)
                self._mmaps[tenant_id] = (mm, stat.st_mtime, stat.st_size)
        finally:
            os.close(fd)

    def invalidate(self, tenant_id: Optional[str] = None) -> None:
        """Drop the cached mmap for a tenant (or all tenants if None)."""
        if tenant_id is None:
            tenants = list(self._mmaps.keys())
        else:
            tenants = [tenant_id]
        for tid in tenants:
            entry = self._mmaps.pop(tid, None)
            if entry is not None:
                try:
                    entry[0].close()
                except Exception:
                    pass

    def health(self) -> dict[str, object]:
        """Diagnostic snapshot of the store."""
        return {
            "dir": str(self._dir),
            "cached_tenants": list(self._mmaps.keys()),
            "cache_size": len(self._mmaps),
        }


# ─── Global instance + SIGHUP handler ────────────────────────────────────────

_store: SnapshotStore | None = None


def get_store() -> SnapshotStore:
    global _store
    if _store is None:
        _store = SnapshotStore()
        # SIGHUP is the canonical "remap" signal (used by nginx, etc.).
        # NestJS will send SIGHUP after writing a new snapshot file.
        try:
            signal.signal(signal.SIGHUP, lambda *_: _store.invalidate())
        except (ValueError, AttributeError):
            # Windows / non-main thread — skip.
            pass
    return _store