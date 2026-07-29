#input_type_name: ApplyResultInput
#output_type_name: ApplyResultResult
#function_name: apply_result
#config_type_name: ApplyResultConfig

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod


class ApplyResultConfig(BaseModel):
    pass


class ProposedAction(BaseModel):
    kind: str = "other"
    title: str = ""
    summary: str = ""
    preview: str = ""
    connector: str = ""
    operation: str = ""
    payload: dict[str, Any] = {}
    requires_approval: bool = True


class NewMemory(BaseModel):
    kind: str = "fact"
    label: str = ""
    value: str = ""
    confidence: str = "medium"


class ApplyResultInput(BaseModel):
    task_id: str
    summary: str = ""
    result: str = ""
    kind: str = "general"
    plan: list[Any] = []
    actions: list[ProposedAction] = []
    new_memory: list[NewMemory] = []
    reasoning: str = ""


class ApplyResultResult(BaseModel):
    task_id: str
    status: str
    actions_created: int = 0
    memory_created: int = 0


async def apply_result(ctx: FunctionContext, data: ApplyResultInput) -> ApplyResultResult:
    pod = Pod.from_env()
    tasks = pod.table("tasks")
    task = tasks.get(data.task_id)

    # Create proposed actions — the approval queue. Nothing is executed here.
    actions_created = 0
    any_pending = False
    for a in data.actions:
        if not a.title:
            continue
        requires = bool(a.requires_approval)
        pod.table("actions").create({
            "task_id": data.task_id,
            "kind": a.kind or "other",
            "title": a.title,
            "summary": a.summary,
            "preview": a.preview,
            "payload": a.payload or {},
            "connector": a.connector or "",
            "operation": a.operation or "",
            "requires_approval": requires,
            "status": "pending",
        })
        actions_created += 1
        if requires:
            any_pending = True

    # Append durable learned facts.
    memory_created = 0
    for m in data.new_memory:
        if not (m.label and m.value):
            continue
        pod.table("memory").create({
            "kind": m.kind or "fact",
            "label": m.label,
            "value": m.value,
            "confidence": m.confidence or "medium",
            "source": (task.get("title") or "task")[:120],
            "active": True,
        })
        memory_created += 1

    # A task with pending approvals waits; otherwise it's done.
    status = "needs_approval" if any_pending else "done"
    tasks.update(data.task_id, {
        "status": status,
        "summary": data.summary,
        "result": data.result,
        "kind": data.kind or task.get("kind") or "general",
        "plan": data.plan or [],
        "reasoning": data.reasoning,
    })

    # Stamp the routine's last run, if this task came from one.
    routine_id = task.get("routine_id")
    if routine_id:
        try:
            pod.table("routines").update(routine_id, {"last_run_at": datetime.now(timezone.utc).isoformat()})
        except Exception:
            pass

    return ApplyResultResult(
        task_id=data.task_id, status=status,
        actions_created=actions_created, memory_created=memory_created,
    )
