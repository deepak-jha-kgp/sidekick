# Sidekick app — DESIGN.md

## Purpose & persona
One person opens this the way they'd glance at a text from a great assistant. Their
named assistant (e.g. "Ori") has already done work overnight — a morning brief, a
drafted reply, a researched dossier — and anything that leaves the app is waiting as
a one-tap approval. The feeling is calm, warm, personal. Not a dashboard, not an ops
tool. Phone-first (works at 375px), a single centered column.

## The first 5 seconds
Open → the assistant greets you by name ("Good morning, Alex") and shows, in order:
**Needs your OK** (approval cards you can Approve / Edit / Decline) and **{name}
handled this** (a feed of what it already did — tap to read the brief, the dossier,
or see "how I did it"). At the top, an "Ask {name} to do something…" box. No empty
state, no connect-wall — seeded so the hero lands immediately. Connecting Google is a
header pill, an enhancement, never a gate.

## Page map (single-file HTML, three tabs — a phone segmented control)
- **Today** (default): greeting header (avatar emoji in accent ring, name, autonomy
  pill) · Ask composer (creates a `tasks` row → the assistant works → it streams in
  live) · **Needs your OK** = pending `actions` as review cards (title, summary,
  formatted email/event preview, Approve/Edit/Decline) · **{name} handled this** =
  recent `tasks`, each a card (kind icon, title, summary, time, status) that expands
  to the full `result` (markdown) + "How I did it" (`plan` steps).
- **Routines**: one card per `routines` row (icon, name, cadence label, description),
  an enable toggle, and **Run now** (fires a task immediately). This is the "set it
  and forget it" surface — users shape what the assistant does on repeat.
- **Memory**: what {name} knows about you, grouped voice / contacts / preferences /
  facts. Each `memory` row a small card with an active toggle; add your own. Framed as
  "this is how {name} sounds like you and remembers what matters."

## Data (by name)
- `assistant` (identity, accent, user_name, autonomy — drives the whole chrome),
  `tasks` (the feed + composer target), `actions` (approval queue), `routines`,
  `memory`. Live refresh via `datastore.watchChanges`.
- Actions: create `tasks` (Ask + Run now); `execute_action` function (Approve);
  `records.update` for Decline (action→rejected), routine enable, memory toggle/add.

## States
Skeleton cards on load; warm empty copy per section ("Nothing needs you right now —
{name} will surface things here."); optimistic "on it…" chip when you ask; per-card
approve/decline feedback; Google-not-connected shown as an honest note on approve
("Approved — sends once you connect Google"), never a fake "sent".

## Tone / visual
Warm off-white canvas, soft rounded cards (16px), one violet accent from
`assistant.accent`, rounded system font, generous spacing, three type sizes. Status as
a small badge. Motion is gentle (cards fade/slide in). It should feel like a delightful
consumer app, not enterprise software.
