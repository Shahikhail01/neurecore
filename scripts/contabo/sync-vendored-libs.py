#!/usr/bin/env python3
"""
sync-vendored-libs.py — one-way sync from infra/_common/ → backend/src/common/auth/_common/.

Vendored copies of the shared auth HMAC libraries live in TWO places:

    infra/_common/scope_token.py       (Python source-of-truth, used by sidecars)
    infra/_common/scope_token.ts       (TS source-of-truth, used by NestJS)
    infra/_common/webhook_sig.py       (Python SOT)
    infra/_common/webhook_sig.ts       (TS SOT)

The backend (NestJS / Node) uses .ts files at infra/_common/scope_token.ts.
We do NOT need a separate vendored copy in backend/src/common/auth/_common/
because the backend's package.json does a relative require
(`require('../../../../infra/_common/scope_token')`) — wait, ACTUALLY the
backend copies them at backend/src/common/auth/_common/ and the code
imports via RELATIVE path that resolves to the vendored copy.

Decide what's the source of truth:
- The infra/_common/*.ts file is the canonical TS source.
- The vendored copy at backend/src/common/auth/_common/*.ts MUST be identical.
- This script enforces that invariant and can repair drift (default = dry-run).

NEVER edit the vendored copies directly. Always edit infra/_common/ and
re-run with --apply.

Usage:
    python3 scripts/contabo/sync-vendored-libs.py            # dry-run, shows drift
    python3 scripts/contabo/sync-vendored-libs.py --apply   # actually write
    python3 scripts/contabo/sync-vendored-libs.py --check   # exit 1 if drift, no write
"""
from __future__ import annotations

import argparse
import hashlib
import sys
from pathlib import Path

REPO = Path("/home/najeeb/Linux-Dev/neurecore-2026/neurecore")
SOURCE_DIR = REPO / "infra" / "_common"
TARGET_DIR = REPO / "backend" / "src" / "common" / "auth" / "_common"

# Each pair is (source_name_in_infra, target_name_in_backend_vendored).
# Both must have the same content (yes, .py source → .ts vendored is NOT
# the right symmetry — the TS source is infra/_common/scope_token.ts and
# the vendored copy is the same filename with the same content).
PAIRS = [
    ("scope_token.ts", "scope_token.ts"),
    ("webhook_sig.ts", "webhook_sig.ts"),
    # Python artifacts (.py) live ONLY at infra/_common/. The sidecar uses
    # them directly (via sys.path) and the backend does NOT vendor them.
    # Hence no Python → backend copy needed.
]


def sha256(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true",
                    help="Write the vendored copies (default: dry-run).")
    ap.add_argument("--check", action="store_true",
                    help="Exit non-zero if vendored copies are out of sync.")
    args = ap.parse_args()

    if not SOURCE_DIR.is_dir():
        print(f"ERROR: source dir missing: {SOURCE_DIR}", file=sys.stderr)
        return 1
    TARGET_DIR.mkdir(parents=True, exist_ok=True)

    drifts: list[str] = []
    missing: list[str] = []
    compared = 0
    for name in [p[0] for p in PAIRS]:
        assert [p[0] for p in PAIRS] == [p[1] for p in PAIRS], \
            "PAIRS must be self-symmetric (same filename)"
        src = SOURCE_DIR / name
        tgt = TARGET_DIR / name
        if not src.exists():
            missing.append(f"source: {src}")
            continue
        if not tgt.exists():
            missing.append(f"target: {tgt}")
            continue
        compared += 1
        if sha256(src) != sha256(tgt):
            drifts.append(name)
            if args.apply:
                tgt.write_bytes(src.read_bytes())
                print(f"  SYNCED {name}")
    if missing:
        print("MISSING:", file=sys.stderr)
        for m in missing:
            print(f"  {m}", file=sys.stderr)
    if drifts:
        print(f"DRIFT ({len(drifts)} file(s)):", file=sys.stderr)
        for d in drifts:
            print(f"  {d}", file=sys.stderr)
        if not args.apply:
            print("(dry-run; pass --apply to sync)", file=sys.stderr)
    if compared == 0:
        print("WARN: no files were compared; check infra/_common/ exists.")
    if args.check and (drifts or missing):
        return 1
    if missing:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())