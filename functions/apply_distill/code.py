#input_type_name: ApplyDistillInput
#output_type_name: ApplyDistillResult
#function_name: apply_distill
#config_type_name: ApplyDistillConfig

from typing import Any, Optional

from pydantic import BaseModel
from lemma_sdk import FunctionContext, Pod

SRC = "email"  # marks distilled rows so re-runs replace cleanly


class ApplyDistillConfig(BaseModel):
    pass


class Contact(BaseModel):
    name: str = ""
    email: str = ""
    relationship: str = ""


class Fact(BaseModel):
    label: str = ""
    value: str = ""


class ApplyDistillInput(BaseModel):
    voice: str = ""
    about: str = ""
    role: str = ""
    contacts: list[Contact] = []
    facts: list[Fact] = []


class ApplyDistillResult(BaseModel):
    contacts_written: int = 0
    facts_written: int = 0
    voice_written: bool = False


def _clear_prior(pod: Pod) -> None:
    try:
        rows = pod.records.list("memory", limit=300,
                                filters=[{"field": "source", "op": "eq", "value": SRC}]).to_dict()["items"]
        for r in rows:
            try:
                pod.table("memory").delete(r["id"])
            except Exception:
                pass
    except Exception:
        pass


def _mem(pod: Pod, kind: str, label: str, value: str) -> bool:
    if not (label and value):
        return False
    try:
        pod.table("memory").create({
            "kind": kind, "label": label[:120], "value": value,
            "source": SRC, "confidence": "high", "active": True,
        })
        return True
    except Exception:
        return False


async def apply_distill(ctx: FunctionContext, data: ApplyDistillInput) -> ApplyDistillResult:
    pod = Pod.from_env()
    _clear_prior(pod)

    voice_written = False
    if data.voice.strip():
        voice_written = _mem(pod, "voice", "writing voice", data.voice.strip())
    if data.about.strip():
        _mem(pod, "fact", "about me", data.about.strip())

    facts_written = 0
    for f in data.facts:
        if _mem(pod, "fact", f.label, f.value):
            facts_written += 1

    contacts_written = 0
    for c in data.contacts:
        if not c.name:
            continue
        label = c.name + (" — " + c.relationship if c.relationship else "")
        val = c.relationship or ""
        if c.email:
            val = (val + " · " if val else "") + c.email
        if _mem(pod, "contact", label, val or c.name):
            contacts_written += 1

    # Role onto the assistant so Ori grounds itself in the user's real work.
    if data.role.strip():
        try:
            rows = pod.records.list("assistant", limit=1).to_dict()["items"]
            if rows:
                pod.table("assistant").update(rows[0]["id"], {"user_role": data.role.strip()[:160]})
        except Exception:
            pass

    return ApplyDistillResult(
        contacts_written=contacts_written, facts_written=facts_written, voice_written=voice_written
    )
