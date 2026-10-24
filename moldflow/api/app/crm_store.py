"""SQLite tables for the relationship hub. One table per entity: indexed columns for the fields we filter on
(contact_id, status, day) + the full Pydantic model as JSON. Writes go through one process-wide lock so multi-entity
updates (approve a batch -> messages + interactions + audit) never interleave."""
import asyncio
import json
import sqlite3
import uuid
from contextlib import contextmanager
from typing import Iterable, TypeVar

from pydantic import BaseModel

from app import config
from app.models.crm import AlertEvent, AuditEntry, AutonomySettings, Contact, Interaction, Message, Moment, ProfileFact, Task

T = TypeVar("T", bound=BaseModel)
TABLES: dict[type, str] = {Contact: "contacts", ProfileFact: "facts", Interaction: "interactions", Message: "messages",
                           Moment: "moments", AlertEvent: "alerts", Task: "tasks", AuditEntry: "audit"}
write_lock = asyncio.Lock()


def new_id(prefix: str) -> str:
    return f"{prefix}{uuid.uuid4().hex[:8]}"


@contextmanager
def _conn():
    c = sqlite3.connect(config.DB_PATH)
    try:
        c.execute("PRAGMA journal_mode=WAL")
        for t in TABLES.values():
            c.execute(f"CREATE TABLE IF NOT EXISTS {t} (id TEXT PRIMARY KEY, contact_id TEXT, status TEXT, day TEXT, data TEXT)")
            c.execute(f"CREATE INDEX IF NOT EXISTS {t}_contact ON {t}(contact_id)")
        c.execute("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)")
        c.execute("CREATE TABLE IF NOT EXISTS suppressions (channel TEXT, ident_hash TEXT, at TEXT, PRIMARY KEY(channel, ident_hash))")
        yield c
        c.commit()
    finally:
        c.close()


def _cols(obj: BaseModel) -> tuple:
    d = obj.model_dump(mode="json")
    day = d.get("due") or d.get("at") or d.get("created_at") or d.get("learned_at")
    return obj.id, d.get("contact_id") or (obj.id if isinstance(obj, Contact) else None), d.get("status"), (day or "")[:10], json.dumps(d)


def put(*objs: BaseModel) -> None:
    with _conn() as c:
        for o in objs:
            c.execute(f"INSERT OR REPLACE INTO {TABLES[type(o)]} (id, contact_id, status, day, data) VALUES (?,?,?,?,?)", _cols(o))


def get(cls: type[T], id_: str) -> T | None:
    with _conn() as c:
        row = c.execute(f"SELECT data FROM {TABLES[cls]} WHERE id=?", (id_,)).fetchone()
    return cls.model_validate_json(row[0]) if row else None


def query(cls: type[T], contact_id: str | None = None, status: str | Iterable[str] | None = None) -> list[T]:
    sql, args = f"SELECT data FROM {TABLES[cls]} WHERE 1=1", []
    if contact_id:
        sql += " AND contact_id=?"
        args.append(contact_id)
    if status:
        sts = [status] if isinstance(status, str) else list(status)
        sql += f" AND status IN ({','.join('?' * len(sts))})"
        args += sts
    with _conn() as c:
        rows = c.execute(sql + " ORDER BY day DESC", args).fetchall()
    return [cls.model_validate_json(r[0]) for r in rows]


def delete(cls: type, id_: str) -> None:
    with _conn() as c:
        c.execute(f"DELETE FROM {TABLES[cls]} WHERE id=?", (id_,))


def kv_get(k: str, default=None):
    with _conn() as c:
        row = c.execute("SELECT v FROM kv WHERE k=?", (k,)).fetchone()
    return json.loads(row[0]) if row else default


def kv_set(k: str, v) -> None:
    with _conn() as c:
        c.execute("INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)", (k, json.dumps(v, default=str)))


def autonomy() -> AutonomySettings:
    return AutonomySettings.model_validate(kv_get("autonomy", {}))


def save_autonomy(a: AutonomySettings) -> None:
    kv_set("autonomy", a.model_dump(mode="json"))


def suppress(channel: str, ident_hash: str, at: str) -> None:
    with _conn() as c:
        c.execute("INSERT OR REPLACE INTO suppressions VALUES (?,?,?)", (channel, ident_hash, at))


def is_suppressed(channel: str, ident_hash: str) -> bool:
    with _conn() as c:
        return c.execute("SELECT 1 FROM suppressions WHERE channel=? AND ident_hash=?", (channel, ident_hash)).fetchone() is not None


def wipe_all() -> None:
    with _conn() as c:
        for t in TABLES.values():
            c.execute(f"DELETE FROM {t}")
        c.execute("DELETE FROM kv")
        c.execute("DELETE FROM suppressions")


def audit(actor: str, action: str, target: str, detail: str = "") -> None:
    put(AuditEntry(id=new_id("au"), actor=actor, action=action, target=target, detail=detail[:500]))
