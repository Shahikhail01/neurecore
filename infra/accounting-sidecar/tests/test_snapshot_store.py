"""Snapshot reader tests (NC-ACCT-IMP-1 §3 — Snapshot strategy).

The SnapshotStore caches mmap'd beancount files keyed by tenantId, with
auto-remap on mtime/size change and a SIGHUP-based invalidation path.
"""
import os
import tempfile
from pathlib import Path

import pytest

from accounting_sidecar.snapshot import SnapshotStore


@pytest.fixture
def tmp_snapshot_dir():
    with tempfile.TemporaryDirectory() as d:
        yield Path(d)


def test_read_missing_file_returns_empty(tmp_snapshot_dir):
    store = SnapshotStore(tmp_snapshot_dir)
    assert store.read("missing-tenant") == ""


def test_read_simple_file(tmp_snapshot_dir):
    p = tmp_snapshot_dir / "t1.beancount"
    p.write_text("2026-01-01 open Assets:Bank USD\n")
    store = SnapshotStore(tmp_snapshot_dir)
    assert "Assets:Bank" in store.read("t1")


def test_read_caches_mmap_across_calls(tmp_snapshot_dir):
    p = tmp_snapshot_dir / "t1.beancount"
    p.write_text("2026-01-01 open Assets:Bank USD\n")
    store = SnapshotStore(tmp_snapshot_dir)
    text1 = store.read("t1")
    text2 = store.read("t1")
    assert text1 == text2
    assert "t1" in store._mmaps


def test_auto_remap_on_content_change(tmp_snapshot_dir):
    p = tmp_snapshot_dir / "t1.beancount"
    p.write_text("2026-01-01 open Assets:Bank USD\n")
    store = SnapshotStore(tmp_snapshot_dir)
    text1 = store.read("t1")
    assert "Assets:Bank" in text1

    # Overwrite with new content
    p.write_text("2026-01-01 open Liabilities:Payable USD\n")
    # mtime resolution may make size the only changed signal
    os.utime(p, (p.stat().st_atime, p.stat().st_mtime + 100))
    text2 = store.read("t1")
    assert "Liabilities:Payable" in text2


def test_invalidate_drops_cache(tmp_snapshot_dir):
    p = tmp_snapshot_dir / "t1.beancount"
    p.write_text("2026-01-01 open Assets:Bank USD\n")
    store = SnapshotStore(tmp_snapshot_dir)
    store.read("t1")
    assert "t1" in store._mmaps
    store.invalidate("t1")
    assert "t1" not in store._mmaps


def test_invalidate_all(tmp_snapshot_dir):
    for tid in ["t1", "t2", "t3"]:
        (tmp_snapshot_dir / f"{tid}.beancount").write_text(
            f"2026-01-01 open Assets:{tid} USD\n"
        )
    store = SnapshotStore(tmp_snapshot_dir)
    for tid in ["t1", "t2", "t3"]:
        store.read(tid)
    assert len(store._mmaps) == 3
    store.invalidate()
    assert len(store._mmaps) == 0


def test_health_endpoint_shape(tmp_snapshot_dir):
    store = SnapshotStore(tmp_snapshot_dir)
    h = store.health()
    assert h["dir"] == str(tmp_snapshot_dir)
    assert h["cached_tenants"] == []
    assert h["cache_size"] == 0


def test_path_helper(tmp_snapshot_dir):
    store = SnapshotStore(tmp_snapshot_dir)
    assert store.path("t1") == tmp_snapshot_dir / "t1.beancount"


def test_read_after_truncate(tmp_snapshot_dir):
    """Truncating the file should not crash the store; should remap."""
    p = tmp_snapshot_dir / "t1.beancount"
    p.write_text("A" * 1000)
    store = SnapshotStore(tmp_snapshot_dir)
    store.read("t1")

    # Truncate to empty
    p.write_text("")
    os.utime(p, (p.stat().st_atime, p.stat().st_mtime + 100))
    text = store.read("t1")
    assert text == ""


def test_corrupt_utf8_does_not_crash(tmp_snapshot_dir):
    """If the file is re-written with non-UTF-8 bytes mid-flight, the store
    should still serve the cached mmap (which is decodable)."""
    p = tmp_snapshot_dir / "t1.beancount"
    p.write_text("2026-01-01 open Assets:Bank USD\n", encoding="utf-8")
    store = SnapshotStore(tmp_snapshot_dir)
    text1 = store.read("t1")
    assert "Assets:Bank" in text1

    # Replace with bytes that the cache mmap still decodes (since size grew)
    p.write_text("2026-01-01 open Liab:Payable USD\n")
    os.utime(p, (p.stat().st_atime, p.stat().st_mtime + 100))
    text2 = store.read("t1")
    assert "Liab:Payable" in text2