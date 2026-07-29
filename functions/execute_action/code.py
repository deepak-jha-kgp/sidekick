#input_type_name: ExecuteActionInput
#output_type_name: ExecuteActionResult
#config_type_name: ExecuteActionConfig
#function_name: execute_action

import re
from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")

GMAIL = "gmail"  # COMPOSIO auth-config name (connected account lives at org level)


class ExecuteActionConfig(BaseModel):
    # Live on: email actions with a real recipient actually send via Gmail.
    # Actions with no recipient (or unconnected channels like Calendar) are
    # recorded honestly instead of faking a send.
    live_connectors: bool = True


class ExecuteActionInput(BaseModel):
    action_id: str
    preview: Optional[str] = None
    payload: Optional[dict[str, Any]] = None


class ExecuteActionResult(BaseModel):
    action_id: str
    status: str
    task_status: str
    mode: str


def _account_id(pod: Pod) -> Optional[str]:
    try:
        rows = pod.records.list("assistant", limit=1).to_dict()["items"]
        return rows[0].get("google_account_id") if rows else None
    except Exception:
        return None


def _parse_email(preview: str, payload: dict) -> tuple:
    """Get recipient / subject / body. The agent tends to leave `payload` empty and
    put everything in the human-readable preview (often with markdown 'To:' /
    'Subject:' headers), so parse the preview as the reliable source."""
    to = payload.get("to") or payload.get("recipient_email") or payload.get("email")
    subject = payload.get("subject")
    body = payload.get("body") or payload.get("message_body")

    lines = (preview or "").split("\n")
    body_start = 0
    for i, ln in enumerate(lines):
        s = ln.replace("*", "").strip()
        low = s.lower()
        if low.startswith("to:"):
            if not to:
                m = EMAIL_RE.search(s)
                to = m.group(0) if m else s.split(":", 1)[1].strip()
            body_start = i + 1
        elif low.startswith("subject:"):
            if not subject:
                subject = s.split(":", 1)[1].strip()
            body_start = i + 1
        elif s == "" and body_start == i:
            body_start = i + 1  # skip a blank line right after the headers
        else:
            break
    if not body:
        body = "\n".join(lines[body_start:]).strip()
    # Don't send raw markdown emphasis in the actual email.
    body = re.sub(r"\*\*(.*?)\*\*", r"\1", body or "").replace("__", "")
    if not to and preview:
        m = EMAIL_RE.search(preview)
        to = m.group(0) if m else None

    return to, (subject or "(no subject)"), (body or preview or "")


async def execute_action(ctx: FunctionContext, data: ExecuteActionInput) -> ExecuteActionResult:
    pod = Pod.from_env()
    actions = pod.table("actions")
    action = actions.get(data.action_id)

    payload = data.payload if data.payload is not None else (action.get("payload") or {})
    preview = data.preview if data.preview is not None else (action.get("preview") or "")

    cfg = ctx.config
    live = bool(cfg.live_connectors) if cfg is not None else True

    connector = (action.get("connector") or "").strip()
    is_email = (action.get("kind") == "send_email") or (connector == GMAIL)

    status, mode = "executed", "recorded"
    result: dict[str, Any] = {"note": "Approved and recorded."}

    if live and is_email:
        to, subject, body = _parse_email(preview, payload)
        if to:
            try:
                # Let the connector auto-resolve the single connected account.
                # Pinning a stored id risks a stale ACCOUNT_RESOLUTION_ERROR.
                pinned = _account_id(pod)
                try:
                    res = pod.connectors.execute(
                        GMAIL, "GMAIL_SEND_EMAIL",
                        {"recipient_email": to, "subject": subject, "body": body},
                        account_id=pinned,
                    ).to_dict().get("result")
                except Exception:
                    res = pod.connectors.execute(
                        GMAIL, "GMAIL_SEND_EMAIL",
                        {"recipient_email": to, "subject": subject, "body": body},
                    ).to_dict().get("result")
                status, mode = "executed", "sent"
                result = {"ok": True, "to": to, "subject": subject, "result": res}
            except Exception as e:  # noqa: BLE001
                status, mode = "failed", "error"
                result = {"ok": False, "to": to, "error": str(e)[:400]}
        else:
            result = {"note": "Approved — add a recipient email (or connect Google Contacts) and re-run to send."}
    elif action.get("kind") == "create_event":
        summary = payload.get("summary") or action.get("title") or "Event"
        start = payload.get("start")
        end = payload.get("end")
        if live and start and end:
            try:
                arow = pod.records.list("assistant", limit=1).to_dict()["items"]
                tz = (arow[0].get("timezone") if arow else None) or "America/Los_Angeles"
            except Exception:
                tz = "America/Los_Angeles"
            body: dict[str, Any] = {
                "summary": summary,
                "start": {"dateTime": start, "timeZone": tz},
                "end": {"dateTime": end, "timeZone": tz},
            }
            if payload.get("description"):
                body["description"] = payload["description"]
            atts = payload.get("attendees")
            if atts:
                body["attendees"] = [({"email": x} if isinstance(x, str) else x) for x in atts]
            try:
                res = pod.connectors.execute(
                    "google_calendar", "events_insert",
                    {"calendar_id": "primary", "body": body},
                ).to_dict().get("result")
                status, mode = "executed", "booked"
                result = {"ok": True, "link": (res or {}).get("htmlLink"), "result": res}
            except Exception as e:  # noqa: BLE001
                status, mode = "failed", "error"
                result = {"ok": False, "error": str(e)[:400]}
        else:
            result = {"note": "Approved — give me the exact date & time (and connect Google Calendar) and I'll book it."}

    actions.update(data.action_id, {
        "status": status,
        "preview": preview,
        "payload": payload,
        "result": result,
        "executed_at": datetime.now(timezone.utc).isoformat(),
    })

    # Advance the parent task once nothing is left pending.
    task_id = action.get("task_id")
    task_status = ""
    if task_id:
        try:
            siblings = pod.records.list(
                "actions", limit=200,
                filters=[{"field": "task_id", "op": "eq", "value": task_id}],
            ).to_dict()["items"]
            any_pending = any(s.get("status") == "pending" for s in siblings)
            task = pod.table("tasks").get(task_id)
            if not any_pending and task.get("status") != "done":
                pod.table("tasks").update(task_id, {"status": "done"})
                task_status = "done"
            else:
                task_status = task.get("status", "")
        except Exception:
            pass

    return ExecuteActionResult(
        action_id=data.action_id, status=status, task_status=task_status, mode=mode
    )
