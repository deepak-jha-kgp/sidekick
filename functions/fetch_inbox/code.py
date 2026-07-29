#input_type_name: FetchInboxInput
#output_type_name: FetchInboxResult
#config_type_name: FetchInboxConfig
#function_name: fetch_inbox

import html
import re
from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

GMAIL = "gmail"
_ZW = re.compile(r"[​-‏‪-‮⁠﻿͏­]")


def S(v) -> str:
    return v if isinstance(v, str) else ("" if v is None else str(v))


def T(v) -> str:
    """Clean text for display: unwrap dict-shaped bodies, strip zero-width junk,
    collapse whitespace. COMPOSIO returns some previews as {'body': '...'}."""
    if isinstance(v, dict):
        v = v.get("body") or v.get("text") or v.get("content") or v.get("plain") or ""
    v = _ZW.sub("", S(v))
    v = html.unescape(v)
    v = re.sub(r"[ \t ]+", " ", v)
    v = re.sub(r"\n{3,}", "\n\n", v)
    return v.strip()


def _when(v) -> Optional[str]:
    if not v:
        return None
    if isinstance(v, str):
        if v.isdigit():
            try:
                return datetime.fromtimestamp(int(v) / 1000, tz=timezone.utc).isoformat()
            except Exception:
                return None
        return v
    if isinstance(v, (int, float)):
        try:
            return datetime.fromtimestamp(float(v) / 1000, tz=timezone.utc).isoformat()
        except Exception:
            return None
    return None


class FetchInboxConfig(BaseModel):
    pass


class FetchInboxInput(BaseModel):
    inbox_limit: int = 30
    sent_limit: int = 20


class FetchInboxResult(BaseModel):
    fetched: int = 0
    inserted: int = 0
    inbox: int = 0
    sent: int = 0
    sample_keys: list[str] = []


def _account(pod: Pod) -> Optional[str]:
    try:
        rows = pod.records.list("assistant", limit=1).to_dict()["items"]
        return rows[0].get("google_account_id") if rows else None
    except Exception:
        return None


def _first(d: dict, *keys, default=""):
    for k in keys:
        v = d.get(k)
        if v:
            return v
    return default


def _split_sender(s: str) -> tuple:
    s = s or ""
    if "<" in s and ">" in s:
        name = s.split("<")[0].strip().strip('"')
        email = s.split("<")[1].split(">")[0].strip()
        return name, email
    return "", s.strip()


def _fetch(pod: Pod, acct: Optional[str], query: str, limit: int) -> list:
    try:
        res = pod.connectors.execute(
            GMAIL, "GMAIL_FETCH_EMAILS",
            {"user_id": "me", "query": query, "max_results": limit,
             "include_payload": True, "verbose": True},
            account_id=acct,
        ).to_dict().get("result") or {}
    except Exception:
        try:
            res = pod.connectors.execute(
                GMAIL, "GMAIL_FETCH_EMAILS",
                {"user_id": "me", "query": query, "max_results": limit, "include_payload": True},
            ).to_dict().get("result") or {}
        except Exception:
            return []
    if isinstance(res, dict):
        return res.get("messages") or res.get("data", {}).get("messages") or res.get("emails") or []
    return res if isinstance(res, list) else []


def _upsert(pod: Pod, msg: dict, from_me: bool, seen: set) -> Optional[str]:
    mid = S(_first(msg, "messageId", "message_id", "id"))
    if not mid or mid in seen:
        return None
    seen.add(mid)
    existing_id = None
    try:
        ex = pod.records.list("emails", limit=1,
                              filters=[{"field": "gmail_message_id", "op": "eq", "value": mid}]).to_dict()["items"]
        if ex:
            existing_id = ex[0]["id"]
    except Exception:
        pass
    sender = S(_first(msg, "sender", "from", "From"))
    name, email = _split_sender(sender)
    body = T(_first(msg, "messageText", "message_text", "body", "text", "preview"))
    rec = {
        "gmail_message_id": S(mid)[:120],
        "thread_id": S(_first(msg, "threadId", "thread_id"))[:120],
        "from_email": S(email)[:320], "from_name": (S(name) or S(_first(msg, "senderName")))[:240],
        "to_email": S(_first(msg, "to", "To", "recipient"))[:640],
        "subject": T(_first(msg, "subject", "Subject"))[:900],
        "snippet": (T(_first(msg, "preview", "snippet", "messageText")) or body)[:1200],
        "body_text": body,
        "received_at": _when(msg.get("messageTimestamp") or msg.get("date") or msg.get("internalDate")),
        "is_from_me": from_me,
        "labels": msg.get("labelIds") or msg.get("labels") or [],
    }
    try:
        if existing_id:
            pod.table("emails").update(existing_id, rec)
            return None  # refreshed, not newly inserted
        pod.table("emails").create(rec)
    except Exception:
        return None
    return mid


async def fetch_inbox(ctx: FunctionContext, data: FetchInboxInput) -> FetchInboxResult:
    pod = Pod.from_env()
    acct = _account(pod)
    inbox = _fetch(pod, acct, "in:inbox", data.inbox_limit)
    sent = _fetch(pod, acct, "in:sent", data.sent_limit)
    sample = list(inbox[0].keys()) if inbox else (list(sent[0].keys()) if sent else [])

    inserted = 0
    seen: set = set()
    for m in inbox:
        if isinstance(m, dict) and _upsert(pod, m, False, seen):
            inserted += 1
    for m in sent:
        if isinstance(m, dict) and _upsert(pod, m, True, seen):
            inserted += 1

    return FetchInboxResult(
        fetched=len(inbox) + len(sent), inserted=inserted,
        inbox=len(inbox), sent=len(sent), sample_keys=sample[:20],
    )
