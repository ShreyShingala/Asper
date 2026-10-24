"""SQLite persistence: one JSON blob per case. Single-writer via per-case asyncio locks."""
import asyncio
import sqlite3
from collections import defaultdict
from contextlib import asynccontextmanager

from app import config
from app.models.passport import Case

_locks: dict[str, asyncio.Lock] = defaultdict(asyncio.Lock)


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(config.DB_PATH)
    c.execute("CREATE TABLE IF NOT EXISTS cases (id TEXT PRIMARY KEY, schema_version INT, data TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)")
    return c


def get(case_id: str) -> Case | None:
    with _conn() as c:
        row = c.execute("SELECT data FROM cases WHERE id=?", (case_id,)).fetchone()
    return Case.model_validate_json(row[0]) if row else None


def list_all() -> list[Case]:
    with _conn() as c:
        rows = c.execute("SELECT data FROM cases ORDER BY updated_at DESC").fetchall()
    return [Case.model_validate_json(r[0]) for r in rows]


def save(case: Case) -> Case:
    with _conn() as c:
        c.execute("INSERT INTO cases(id, schema_version, data, updated_at) VALUES(?,?,?,CURRENT_TIMESTAMP) "
                  "ON CONFLICT(id) DO UPDATE SET data=excluded.data, schema_version=excluded.schema_version, updated_at=CURRENT_TIMESTAMP",
                  (case.id, case.schema_version, case.model_dump_json()))
    return case


def wipe() -> None:
    with _conn() as c:
        c.execute("DELETE FROM cases")


@asynccontextmanager
async def editing(case_id: str):
    """Load -> mutate -> save atomically per case."""
    async with _locks[case_id]:
        case = get(case_id)
        if case is None:
            raise KeyError(case_id)
        yield case
        save(case)
