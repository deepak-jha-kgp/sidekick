import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Home, Mail, Zap, Library, Users, Bell, Check, Sparkles, Search, Calendar,
  Paperclip, Mic, ArrowRight, ArrowUp, Pencil, Trash2, X, Brain, FileText, Plus, Send,
} from 'lucide-react'
import { useCurrentUser, useLiveRecords } from 'lemma-sdk/react'
import { lemmaClient as C } from './lemma-client'

/* ---------------- helpers ---------------- */
const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)
const pid = () => (C as any).podId
function rel(iso?: string) {
  if (!iso) return ''
  let d = (Date.now() - new Date(iso).getTime()) / 1000
  if (d < 0) d = 0
  if (d < 60) return 'now'
  if (d < 3600) return Math.floor(d / 60) + 'm'
  if (d < 86400) return Math.floor(d / 3600) + 'h'
  return Math.floor(d / 86400) + 'd'
}
function greetWord() { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening' }
function today() { return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' }) }
const PCOL = ['#5B4BFF', '#9B6BFF', '#0CA5B8', '#0FA36B', '#E08600', '#EC4899', '#F5533D']
function pcol(s = '') { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return PCOL[h % PCOL.length] }
const KIND: any = { brief: '📋', reply: '✉️', research: '🔎', schedule: '🗓️', general: '✨' }
const ACTIC: any = { send_email: '✉️', create_event: '🗓️', send_message: '💬', other: '⚡' }

function esc(s: any) { return (s == null ? '' : String(s)).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string)) }
function md(t?: string) {
  if (!t) return ''
  const out: string[] = []; const ls = String(t).split(/\r?\n/); let il = false
  const inl = (s: string) => {
    s = esc(s)
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    s = s.replace(/(^|[\s(])((https?:\/\/)[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>')
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'); s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
    return s
  }
  ls.forEach((ln) => {
    let m: any
    if ((m = ln.match(/^#{3,}\s+(.*)/))) { if (il) { out.push('</ul>'); il = false } out.push('<h4>' + inl(m[1]) + '</h4>') }
    else if ((m = ln.match(/^#{1,2}\s+(.*)/))) { if (il) { out.push('</ul>'); il = false } out.push('<h3>' + inl(m[1]) + '</h3>') }
    else if ((m = ln.match(/^\s*[-*]\s+(.*)/))) { if (!il) { out.push('<ul>'); il = true } out.push('<li>' + inl(m[1]) + '</li>') }
    else if (ln.trim() === '') { if (il) { out.push('</ul>'); il = false } }
    else { if (il) { out.push('</ul>'); il = false } out.push('<p>' + inl(ln) + '</p>') }
  })
  if (il) out.push('</ul>')
  return out.join('')
}

/* ---------------- toast ---------------- */
function toast(msg: string) { window.dispatchEvent(new CustomEvent('sk-toast', { detail: msg })) }
function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null)
  useEffect(() => {
    const on = (e: any) => { setMsg(e.detail); window.clearTimeout((on as any)._t); (on as any)._t = window.setTimeout(() => setMsg(null), 2600) }
    window.addEventListener('sk-toast', on as any); return () => window.removeEventListener('sk-toast', on as any)
  }, [])
  return (
    <AnimatePresence>
      {msg && <motion.div className="toast" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}>{msg}</motion.div>}
    </AnimatePresence>
  )
}

/* ---------------- data ---------------- */
function useLive(tableName: string, opts: any = {}) {
  const r = useLiveRecords({ client: C as any, tableName, reconcile: 'merge', ...opts }) as any
  return (r.records || []) as any[]
}
const Data = createContext<any>(null)
const useD = () => useContext(Data)

function meFirst(u: any) { if (!u) return 'there'; if (u.first_name) return cap(u.first_name); const e = u.email || ''; return cap((e.split('@')[0] || 'there').split(/[\s.@_0-9]+/)[0] || 'there') }
function meName(u: any) { if (!u) return 'there'; if (u.first_name) return cap(u.first_name) + (u.last_name ? ' ' + cap(u.last_name) : ''); return u.name || (u.email ? u.email.split('@')[0] : 'there') }

/* ---------------- small UI ---------------- */
const Rise = ({ children, i = 0 }: any) => (
  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.04, 0.3), type: 'spring', stiffness: 320, damping: 26 }}>{children}</motion.div>
)
const Tap: any = ({ children, className, ...p }: any) => (
  <motion.button whileTap={{ scale: 0.95 }} className={className} {...p}>{children}</motion.button>
)

/* ================= ROOT ================= */
export default function Root() {
  const { user } = useCurrentUser({ client: C as any }) as any
  const assistantList = useLive('assistant', { limit: 1 })
  const assistant = assistantList[0]
  const loading = assistantList == null
  const [org, setOrg] = useState<string | null>(null)
  useEffect(() => { (async () => { try { const p = await (C as any).pods.get(pid()); setOrg(p.organization_id) } catch {} })() }, [])

  // everything else, live
  const tasks = useLive('tasks', { limit: 100, sort: [{ field: 'created_at', direction: 'desc' }] })
  const actions = useLive('actions', { limit: 200, sort: [{ field: 'created_at', direction: 'desc' }] })
  const routines = useLive('routines', { limit: 100, sort: [{ field: 'created_at', direction: 'asc' }] })
  const memory = useLive('memory', { limit: 200 })
  const skills = useLive('skills', { limit: 100, sort: [{ field: 'sort', direction: 'asc' }] })
  const emails = useLive('emails', { limit: 80, sort: [{ field: 'received_at', direction: 'desc' }] })

  const [gmail, setGmail] = useState<any>({ on: false, email: '' })
  const [cal, setCal] = useState(false)
  const refreshConn = async () => {
    if (!org) return
    const chk = async (conn: string) => {
      try { const a = ((await (C as any).connectors.accounts.list(org, { connectorId: conn })).items || []).find((x: any) => ((x.status || '') + '').toUpperCase().match(/CONNECT|ACTIVE/)); return a } catch { return null }
    }
    const g = await chk('gmail'); setGmail({ on: !!g, email: g?.email || '' })
    const c = await chk('google_calendar'); setCal(!!c)
  }
  useEffect(() => { refreshConn() }, [org])

  const d = {
    user, assistant, org, tasks, actions, routines, memory, skills, emails, gmail, cal, refreshConn,
    nm: () => assistant?.name || 'your assistant',
    aemail: () => (((assistant?.name || 'sidekick') + '@sidekick.me').toLowerCase().replace(/\s+/g, '')),
    pend: () => actions.filter((a) => a.status === 'pending'),
    actsFor: (t: string) => actions.filter((a) => a.task_id === t),
    contacts: () => memory.filter((m) => m.kind === 'contact'),
    facts: () => memory.filter((m) => m.kind === 'fact'),
    inboxMail: () => emails.filter((e) => !e.is_from_me),
    docs: () => tasks.filter((t) => t.status === 'done' && t.result && t.result.length > 120),
    latestBrief: () => { const b = tasks.filter((t) => t.kind === 'brief' && t.status === 'done' && t.result && (t.title || '').toLowerCase().includes('brief')); return b.find((t) => t.source === 'routine') || b[0] },
  }

  if (loading) return <div className="boot">Loading…</div>
  if (!assistant) return <Data.Provider value={d}><Onboarding /><ToastHost /></Data.Provider>
  return <Data.Provider value={d}><AppShell /><ToastHost /></Data.Provider>
}

/* ================= SHELL ================= */
const NAV = [['home', Home, 'Home'], ['inbox', Mail, 'Inbox'], ['powers', Zap, 'Powers'], ['library', Library, 'Library'], ['people', Users, 'People']] as const
function AppShell() {
  const d = useD()
  const [view, setView] = useState('home')
  const [modal, setModal] = useState<any>(null)
  const nMail = d.inboxMail().length, nPend = d.pend().length
  const go = (v: string) => { setView(v); window.scrollTo(0, 0); const m = document.querySelector('.main'); if (m) (m as any).scrollTop = 0 }
  const ctx = { view, go, modal, setModal }
  return (
    <>
      <div className="mesh" />
      <div className={'app-shell' + (view === 'home' ? ' home' : '')}>
        <aside className="sidebar">
          <div className="sbrand"><div className="sbmk">S</div> Sidekick</div>
          {NAV.map(([v, Ic, l]) => (
            <button key={v} className={'snav' + (view === v ? ' on' : '')} onClick={() => go(v)}>
              <Ic size={19} /> <span>{l}</span>
              {v === 'inbox' && nMail ? <span className="pip">{nMail}</span> : v === 'home' && nPend ? <span className="pip">{nPend}</span> : null}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <div className="sid-id"><div className="av" style={{ width: 38, height: 38, borderRadius: 12, fontSize: 19 }}>{d.assistant.avatar_emoji || '🟣'}</div><div style={{ minWidth: 0 }}><div className="ttl" style={{ fontSize: 14 }}>{d.assistant.name}</div><div className="rt mono" style={{ fontSize: 11, color: 'var(--ink3)' }}>{d.aemail()}</div></div><span className="live" style={{ marginLeft: 'auto' }} /></div>
          <div className="sid-user"><div className="pav" style={{ width: 30, height: 30, fontSize: 12, background: pcol(meName(d.user)) }}>{meFirst(d.user).slice(0, 1)}</div><div style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 700 }}>{meName(d.user)}</div><div className="rt mono" style={{ fontSize: 10.5, color: 'var(--ink3)' }}>{d.user?.email}</div></div></div>
        </aside>
        <main className="main"><div className="mwrap">
          <AnimatePresence mode="wait">
            <motion.div key={view} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
              {view === 'home' && <HomeView ctx={ctx} />}
              {view === 'inbox' && <InboxView ctx={ctx} />}
              {view === 'powers' && <PowersView />}
              {view === 'library' && <LibraryView ctx={ctx} />}
              {view === 'people' && <PeopleView />}
            </motion.div>
          </AnimatePresence>
        </div></main>
        {view === 'home' && <Rail ctx={ctx} />}
      </div>
      <nav className="tabbar"><div className="tabbar-in">
        {NAV.map(([v, Ic, l]) => (
          <button key={v} className={'tab' + (view === v ? ' on' : '')} onClick={() => go(v)}>
            <span className="ti"><Ic size={21} />{((v === 'inbox' && nMail) || (v === 'home' && nPend)) ? <span className="dt" /> : null}</span>{l}
          </button>
        ))}
      </div></nav>
      <AnimatePresence>{modal && <Sheet modal={modal} onClose={() => setModal(null)} />}</AnimatePresence>
    </>
  )
}

/* ---------------- HOME ---------------- */
const MODES = ['Task', 'Research', 'Ask']
function HomeView({ ctx }: any) {
  const d = useD()
  const [draft, setDraft] = useState(''); const [mode, setMode] = useState('Task')
  const pend = d.pend(); const brief = d.latestBrief()
  const send = async () => {
    const v = draft.trim(); if (!v) return; setDraft('')
    const kind = mode === 'Research' ? 'research' : 'general'
    toast(d.nm() + (kind === 'research' ? ' is researching…' : ' is on it…'))
    try { await (C as any).records.create('tasks', { title: v.length > 70 ? v.slice(0, 67) + '…' : v, request: v, kind, source: 'chat' }) } catch { toast("Couldn't send that.") }
  }
  const autonomy = async () => { const o = ['ask', 'trusted', 'auto']; const nx = o[(o.indexOf(d.assistant.autonomy) + 1) % 3]; try { await (C as any).records.update('assistant', d.assistant.id, { autonomy: nx }); toast('Autonomy: ' + (nx === 'auto' ? 'full' : nx === 'trusted' ? 'trusted' : 'asks first')) } catch {} }
  return (
    <>
      <div className="hd hd-mobile"><div className="av">{d.assistant.avatar_emoji || '🟣'}</div><div className="who"><div className="nm">{d.assistant.name} <span className="live" /></div><div className="st">{d.aemail()}</div></div><Tap className="iconbtn" onClick={() => toast('Coming soon ✨')}><Bell size={19} /></Tap></div>
      <div className="greet">
        <div className="eyebrow"><Sparkles size={13} /> {today()}</div>
        <h1>{greetWord()},<br /><span className="u">{meFirst(d.user)}</span>.</h1>
        <p>{pend.length ? <>You've got <span className="lk" onClick={() => document.getElementById('pend')?.scrollIntoView({ behavior: 'smooth' })}>{pend.length} to approve</span>{brief ? <> · a fresh <span className="lk" onClick={() => ctx.setModal({ t: 'task', id: brief.id })}>brief</span></> : ''}.</> : "You're all caught up — ask me anything."}</p>
      </div>
      <div className="composer glass">
        <textarea rows={1} placeholder={'Ask ' + d.assistant.name + ' anything…'} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
        <div className="ctools">
          <Tap className="modepill" onClick={() => setMode(MODES[(MODES.indexOf(mode) + 1) % 3])}>{mode === 'Research' ? <Search size={14} /> : mode === 'Ask' ? <Sparkles size={14} /> : <Zap size={14} />} {mode}</Tap>
          <Tap className="ct" onClick={autonomy}><Check size={18} /></Tap>
          <Tap className="ct" onClick={() => toast('Coming soon ✨')}><Paperclip size={18} /></Tap>
          <div className="ctsp" />
          <Tap className="ct" onClick={() => toast('Coming soon ✨')}><Mic size={18} /></Tap>
          <Tap className="send" onClick={send}><ArrowUp size={18} /></Tap>
        </div>
      </div>
      <div className="bento">
        <Tap className="stat glass" onClick={() => ctx.go('inbox')}><div className="ic"><Mail size={18} /></div><div className="n">{d.inboxMail().length}</div><div className="l">In your inbox</div></Tap>
        <Tap className="stat accent" onClick={() => document.getElementById('pend')?.scrollIntoView({ behavior: 'smooth' })}><div className="ic"><Check size={18} /></div><div className="n">{pend.length}</div><div className="l">Need your OK</div></Tap>
        <div className="stat glass"><div className="ic"><Sparkles size={18} /></div><div className="n">{d.tasks.filter((t: any) => t.status === 'done').length}</div><div className="l">Handled</div></div>
      </div>
      {(d.assistant.user_role || d.facts().length) ? (
        <Tap className="knows glass" onClick={() => ctx.setModal({ t: 'profile' })} style={{ width: '100%' }}>
          <div className="ki"><Brain size={20} /></div>
          <div className="grow" style={{ textAlign: 'left' }}><div className="kt">{d.assistant.name} knows you</div><div className="ks">{d.assistant.user_role || ''}{d.facts().filter((m: any) => m.source === 'email').length ? ' · learned ' + d.facts().filter((m: any) => m.source === 'email').length + ' things from your inbox' : ''}. Tap to see.</div></div>
          <ArrowRight size={16} />
        </Tap>
      ) : null}
      <div id="pend" />
      {pend.length > 0 && <><Section t="Needs your OK" c={pend.length} />{pend.map((a: any, i: number) => <Rise i={i} key={a.id}><Approval a={a} /></Rise>)}</>}
      <Section t={d.assistant.name + ' handled'} />
      {d.tasks.length === 0 ? <Empty ic="✨" t="Nothing yet" s={'Ask ' + d.assistant.name + ' for something above.'} /> : d.tasks.map((t: any, i: number) => <Rise i={i} key={t.id}><TaskRow t={t} ctx={ctx} /></Rise>)}
    </>
  )
}
const Section = ({ t, c }: any) => <div className="sec"><span className="t">{t}</span>{c ? <span className="c mono">{c}</span> : null}<span className="sp" /></div>
const Empty = ({ ic, t, s }: any) => <div className="empty"><div className="e-ic">{ic}</div><div className="e-t">{t}</div><div className="e-s">{s}</div></div>

function Approval({ a }: any) {
  const d = useD(); const [edit, setEdit] = useState(false); const [txt, setTxt] = useState(a.preview || '')
  const approve = async () => { toast('Approved ✓'); try { await (C as any).functions.run('execute_action', { input: { action_id: a.id, preview: edit ? txt : undefined } }) } catch { toast('Approval failed.') } }
  const decline = async () => { try { await (C as any).records.update('actions', a.id, { status: 'rejected' }); const sib = d.actions.filter((x: any) => x.task_id === a.task_id && x.id !== a.id && x.status === 'pending'); if (!sib.length && a.task_id) { try { await (C as any).records.update('tasks', a.task_id, { status: 'done' }) } catch {} } toast('Skipped.') } catch {} }
  const lbl = a.kind === 'send_email' ? 'Approve & send' : a.kind === 'create_event' ? 'Approve & book' : 'Approve'
  return (
    <div className="card plain">
      <div className="row-h"><div className="tile" style={{ background: 'var(--amber-weak)' }}>{ACTIC[a.kind] || '⚡'}</div><div className="grow"><div className="ttl">{a.title}</div><div className="sub">{a.summary}</div></div></div>
      {edit ? <textarea className="edit" value={txt} onChange={(e) => setTxt(e.target.value)} /> : <div className="preview md" dangerouslySetInnerHTML={{ __html: md(a.preview) }} />}
      <div className="btns"><Tap className="btn btn-primary" onClick={approve}>{lbl}</Tap><Tap className="btn btn-soft" onClick={() => setEdit(!edit)}>{edit ? 'Done' : 'Edit'}</Tap><Tap className="btn btn-quiet" onClick={decline}>Skip</Tap></div>
    </div>
  )
}
function Badge({ s }: any) {
  if (s === 'done') return <span className="badge b-done">Done</span>
  if (s === 'needs_approval') return <span className="badge b-need">Needs you</span>
  if (s === 'failed') return <span className="badge b-fail">Failed</span>
  return <span className="badge b-work"><Spin /> Working</span>
}
const Spin = () => <motion.span style={{ width: 10, height: 10, borderRadius: 999, border: '2px solid var(--accent-ring)', borderTopColor: 'var(--accent)', display: 'inline-block' }} animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }} />
function TaskRow({ t }: any) {
  const d = useD(); const [open, setOpen] = useState(false)
  const w = t.status === 'queued' || t.status === 'working'
  return (
    <div className={'card plain task' + (t.status === 'done' ? ' done' : '')} onClick={() => setOpen(!open)}>
      <div className="row-h"><div className="tile">{KIND[t.kind] || '✨'}</div><div className="grow"><div className="ttl">{t.title}</div><div className="sub">{w ? <><Spin /> {d.nm()} is on it…</> : t.summary}</div></div>{!w && <Badge s={t.status} />}</div>
      {open && !w && (
        <div className="detail">
          <div className="md" dangerouslySetInnerHTML={{ __html: md(t.result || '_No details._') }} />
          {Array.isArray(t.plan) && t.plan.length > 0 && (
            <div className="plan"><h4>How {d.nm()} did it</h4>{t.plan.map((s: any, i: number) => <div className="step" key={i}><div className="n"><Check size={11} /></div><div><div>{s.step}</div>{s.detail && <div className="sd">{s.detail}</div>}</div></div>)}</div>
          )}
          {d.actsFor(t.id).map((a: any) => <div className="actline" key={a.id}>{a.status === 'executed' ? '✅' : a.status === 'rejected' ? '🚫' : a.status === 'failed' ? '⚠️' : '⏳'} {a.title} · {a.status === 'executed' ? 'Done' : a.status === 'rejected' ? 'Skipped' : a.status === 'failed' ? 'Failed' : 'Waiting'}</div>)}
        </div>
      )}
    </div>
  )
}

/* ---------------- RAIL ---------------- */
function Rail({ ctx }: any) {
  const d = useD(); const brief = d.latestBrief()
  const sugg: any[] = []
  d.pend().slice(0, 2).forEach((a: any) => sugg.push({ Ic: a.kind === 'create_event' ? Calendar : FileText, text: 'Review & approve — ' + a.title, sub: a.summary, act: () => document.getElementById('pend')?.scrollIntoView({ behavior: 'smooth' }) }))
  d.routines.filter((r: any) => r.enabled && r.trigger_type === 'schedule' && !r.last_run_at).slice(0, 1).forEach((r: any) => sugg.push({ Ic: Zap, text: 'Run “' + r.name + '” now', sub: r.schedule_label, act: () => runRoutine(r, ctx) }))
  if (!d.cal) sugg.push({ Ic: Calendar, text: 'Connect Calendar so ' + d.nm() + ' can book', sub: 'Integrations →', act: () => ctx.go('powers') })
  const snip = brief ? (brief.result || '').replace(/[#*`>]/g, '').split(/\n+/).filter((x: string) => x.trim()).slice(1, 3).join(' ').slice(0, 170) : ''
  return (
    <aside className="rail">
      <div className="rh"><span>Need to know</span>{brief && <span className="m">{rel(brief.updated_at)} ago</span>}</div>
      {brief ? <div className="railcard glass"><p>{snip}…</p><div className="runbtn" style={{ marginTop: 11 }} onClick={() => ctx.setModal({ t: 'task', id: brief.id })}>Read the brief →</div></div> : <div className="railcard glass"><p>{d.nm()} will drop your daily brief here.</p></div>}
      <div className="rh"><span>Suggestions</span><span className="m"><Spin /> live</span></div>
      {sugg.length === 0 ? <div className="railcard glass"><p>Nothing needs you right now.</p></div> : sugg.slice(0, 4).map((s, i) => <div className="sug" key={i} onClick={s.act}><div className="si"><s.Ic size={16} /></div><div><div className="stt">{s.text}</div>{s.sub && <div className="ss">{s.sub}</div>}</div></div>)}
      <div className="rh" style={{ marginTop: 24 }}><span>Create</span></div>
      <div className="qa"><button className="glass" onClick={() => toast('Coming soon ✨')}><Mic size={15} /> Audio brief</button><button className="glass" onClick={() => toast('Coming soon ✨')}><FileText size={15} /> Document</button></div>
    </aside>
  )
}

async function runRoutine(r: any, ctx: any) { toast('Running “' + r.name + '”…'); if (ctx) ctx.go('home'); try { await (C as any).records.create('tasks', { title: r.name, request: r.instruction, kind: r.kind || 'general', source: 'routine', routine_id: r.id }) } catch { toast("Couldn't run it.") } }

/* ---------------- INBOX ---------------- */
function InboxView({ ctx }: any) {
  const d = useD(); const mail = d.inboxMail()
  const sync = async () => { toast('Syncing your inbox…'); try { await (C as any).functions.run('fetch_inbox', { input: { inbox_limit: 40, sent_limit: 20 } }); toast('Inbox synced ✓') } catch { toast('Sync failed.') } }
  return (
    <>
      <div className="ph"><h1>Inbox</h1><p>Your real Gmail, mirrored. {d.nm()} reads these to learn your voice and who matters.</p></div>
      {!d.gmail.on ? <div className="banner" style={{ marginTop: 16 }}><div className="tile" style={{ background: '#fff' }}><Mail size={19} /></div><div className="grow"><div className="ttl">Connect Gmail</div><div className="sub">to pull your real email in.</div></div><Tap className="conn" onClick={() => connect(d, 'gmail')}>Connect</Tap></div>
        : <div className="sec"><span className="t">Recent</span><span className="sp" /><span className="runbtn" onClick={sync}>↻ Sync</span></div>}
      {mail.length === 0 ? <Empty ic="📭" t="No mail yet" s={d.gmail.on ? 'Hit Sync to pull your inbox.' : 'Connect Gmail first.'} /> : mail.map((e: any, i: number) => {
        const who = e.from_name || e.from_email || '?'
        return <Rise i={i} key={e.id}><div className="mail glass" onClick={() => ctx.setModal({ t: 'email', id: e.id })}><div className="mav" style={{ background: pcol(who) }}>{who.slice(0, 1).toUpperCase()}</div><div className="grow"><div className="mt"><div className="fn">{who}</div><div className="rt">{rel(e.received_at || e.created_at)}</div></div><div className="sj">{e.subject || '(no subject)'}</div><div className="sn">{(e.snippet || '').slice(0, 90)}</div></div></div></Rise>
      })}
    </>
  )
}

/* ---------------- POWERS ---------------- */
const SK_EMOJI = ['✉️', '🗓️', '🔎', '📋', '📄', '✅', '💬', '📊', '🧠', '🎯', '📞', '🧾']
const SK_COL = ['#5B4BFF', '#9B6BFF', '#0CA5B8', '#0FA36B', '#E08600', '#EC4899', '#F5533D']
function PowersView() {
  const d = useD(); const [tab, setTab] = useState('routines')
  return (
    <>
      <div className="ph"><h1>Powers</h1><p>What {d.nm()} runs, connects to, and can do.</p></div>
      <div className="subtabs">{['routines', 'integrations', 'skills'].map((k) => <div key={k} className={'subtab' + (tab === k ? ' on' : '')} onClick={() => setTab(k)}>{cap(k)}</div>)}</div>
      {tab === 'routines' && (d.routines.length === 0 ? <Empty ic="🔁" t="No routines" s={'Standing jobs ' + d.nm() + ' runs on repeat.'} /> : d.routines.map((r: any, i: number) => <Rise i={i} key={r.id}><Routine r={r} /></Rise>))}
      {tab === 'integrations' && <Integrations />}
      {tab === 'skills' && <Skills />}
    </>
  )
}
function Routine({ r }: any) {
  const toggle = async () => { try { await (C as any).records.update('routines', r.id, { enabled: !r.enabled }) } catch {} }
  return <div className="rcard glass"><div className="top"><div className="tile" style={{ fontSize: 22 }}>{r.icon || '✨'}</div><div className={'toggle' + (r.enabled ? ' on' : '')} onClick={toggle} /></div><div className="nm">{r.name}</div><div className="ds">{r.description}</div><div className="ft"><span className="chip">{r.schedule_label || 'manual'}</span><span className="runbtn" onClick={() => runRoutine(r, null)}>Run now →</span></div></div>
}
function Integrations() {
  const d = useD()
  const rows = [
    { ic: '✉️', nm: 'Gmail', ds: 'Read, draft, and send email.', on: d.gmail.on, who: d.gmail.email, conn: 'gmail' },
    { ic: '🗓️', nm: 'Google Calendar', ds: 'See your schedule and book meetings.', on: d.cal, conn: 'google_calendar' },
    { ic: '💬', nm: 'Slack', ds: 'Summaries where your team works.', soon: true },
    { ic: '📄', nm: 'Notion', ds: 'Save briefs to your workspace.', soon: true },
  ]
  return <>{rows.map((r, i) => <Rise i={i} key={r.nm}><div className="intg glass"><div className="lg">{r.ic}</div><div className="grow"><div className="ttl">{r.nm}</div><div className={'st' + (r.on ? ' ok' : '')}>{r.on ? 'Connected' + (r.who ? ' · ' + r.who : '') : r.ds}</div></div>{r.on ? <Check size={20} color="var(--green)" /> : r.soon ? <button className="conn soon">Soon</button> : <Tap className="conn" onClick={() => connect(d, r.conn!)}>Connect</Tap>}</div></Rise>)}</>
}
function Skills() {
  const d = useD(); const [editId, setEditId] = useState<string | null>(null); const [draft, setDraft] = useState<any>({})
  const openNew = () => { setDraft({ icon: '✨', color: '#5B4BFF' }); setEditId('new') }
  const openEdit = (s: any) => { setDraft({ ...s }); setEditId(s.id) }
  const save = async () => { const name = (draft.name || '').trim(); if (!name) { toast('Name your skill.'); return } const rec = { name, description: draft.description || '', icon: draft.icon || '✨', color: draft.color || '#5B4BFF', enabled: draft.enabled != null ? draft.enabled : true }; try { if (editId === 'new') { await (C as any).records.create('skills', { ...rec, sort: d.skills.length + 1 }) } else { await (C as any).records.update('skills', editId, rec) } setEditId(null); toast('Saved ✓') } catch { toast("Couldn't save.") } }
  const del = async () => { try { await (C as any).records.delete('skills', editId); setEditId(null); toast('Removed.') } catch {} }
  const toggle = async (s: any) => { try { await (C as any).records.update('skills', s.id, { enabled: !s.enabled }) } catch {} }
  const Form = () => (
    <div className="rcard glass" style={{ borderColor: 'var(--accent-ring)' }}>
      <input className="inp" placeholder="Skill name" value={draft.name || ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
      <input className="inp" placeholder={'What can ' + d.nm() + ' do?'} value={draft.description || ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
      <div className="emojipick" style={{ marginBottom: 12 }}>{SK_EMOJI.map((e) => <div key={e} className={'ep' + (draft.icon === e ? ' on' : '')} onClick={() => setDraft({ ...draft, icon: e })}>{e}</div>)}</div>
      <div style={{ display: 'flex', gap: 9, marginBottom: 12 }}>{SK_COL.map((c) => <div key={c} onClick={() => setDraft({ ...draft, color: c })} style={{ width: 30, height: 30, borderRadius: 99, background: c, cursor: 'pointer', boxShadow: draft.color === c ? '0 0 0 3px #fff,0 0 0 5px var(--ink)' : 'none' }} />)}</div>
      <div className="btns"><Tap className="btn btn-primary" onClick={save}>Save</Tap>{editId !== 'new' && <Tap className="btn btn-soft" onClick={del}><Trash2 size={16} /></Tap>}<Tap className="btn btn-quiet" onClick={() => setEditId(null)}>Cancel</Tap></div>
    </div>
  )
  return (
    <>
      <div className="sec"><span className="t">Your skills</span><span className="sp" /><span className="runbtn" onClick={openNew}>+ Add skill</span></div>
      {editId === 'new' && <Form />}
      {d.skills.length === 0 && editId !== 'new' ? <Empty ic="🧩" t="No skills yet" s={'Add what ' + d.nm() + ' should be great at.'} /> : d.skills.map((s: any) => editId === s.id ? <Form key={s.id} /> : (
        <div className="rcard glass" key={s.id}><div className="top"><div className="tile" style={{ background: (s.color || '#5B4BFF') + '22', color: s.color || '#5B4BFF' }}>{s.icon || '✨'}</div><div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><div className={'toggle' + (s.enabled ? ' on' : '')} onClick={() => toggle(s)} /><button className="kebab" onClick={() => openEdit(s)}><Pencil size={17} /></button></div></div><div className="nm">{s.name}</div><div className="ds">{s.description}</div></div>
      ))}
    </>
  )
}

/* ---------------- LIBRARY ---------------- */
function LibraryView({ ctx }: any) {
  const d = useD(); const docs = d.docs()
  return (
    <>
      <div className="ph"><h1>Library</h1><p>Everything {d.nm()} has written for you.</p></div>
      <div style={{ height: 14 }} />
      {docs.length === 0 ? <Empty ic="📄" t="Nothing saved yet" s="Briefs and dossiers land here." /> : docs.map((t: any, i: number) => {
        const snip = (t.result || '').replace(/[#*`>]/g, '').split(/\n+/).filter((x: string) => x.trim())[1] || t.summary || ''
        return <Rise i={i} key={t.id}><div className="card plain" style={{ cursor: 'pointer' }} onClick={() => ctx.setModal({ t: 'task', id: t.id })}><div className="row-h"><div className="tile">{KIND[t.kind] || '📄'}</div><div className="grow"><div className="ttl">{t.title}</div><div className="sub">{snip.slice(0, 110)}…</div><div className="rt" style={{ marginTop: 6 }}>{t.kind || 'note'} · {rel(t.updated_at || t.created_at)}</div></div></div></div></Rise>
      })}
    </>
  )
}

/* ---------------- PEOPLE ---------------- */
function PeopleView() {
  const d = useD(); const c = d.contacts(); const [adding, setAdding] = useState(false); const [f, setF] = useState<any>({})
  const save = async () => { if (!(f.name || '').trim()) { toast('Add a name.'); return } const label = f.name.trim() + (f.role?.trim() ? ' — ' + f.role.trim() : ''); try { await (C as any).records.create('memory', { kind: 'contact', label, value: (f.note || '').trim(), source: 'you', confidence: 'high', active: true }); setAdding(false); setF({}); toast(d.nm() + ' will remember ' + f.name.trim() + '.') } catch { toast("Couldn't save.") } }
  const toggle = async (m: any) => { try { await (C as any).records.update('memory', m.id, { active: !m.active }) } catch {} }
  return (
    <>
      <div className="ph" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}><div><h1>People</h1><p>{d.nm()} knows these from your inbox + what you add.</p></div><Tap className="conn" onClick={() => setAdding(true)}>+ Add</Tap></div>
      <div style={{ height: 12 }} />
      {adding && <div className="card plain"><div className="ttl" style={{ marginBottom: 11 }}>Add someone {d.nm()} should know</div><input className="inp" placeholder="Name" value={f.name || ''} onChange={(e) => setF({ ...f, name: e.target.value })} /><input className="inp" placeholder="Role, company (optional)" value={f.role || ''} onChange={(e) => setF({ ...f, role: e.target.value })} /><input className="inp" placeholder={'What should ' + d.nm() + ' remember?'} value={f.note || ''} onChange={(e) => setF({ ...f, note: e.target.value })} /><div className="btns"><Tap className="btn btn-primary" onClick={save}>Save</Tap><Tap className="btn btn-quiet" onClick={() => setAdding(false)}>Cancel</Tap></div></div>}
      {c.length === 0 && !adding ? <Empty ic="🧑" t="No people yet" s={'They show up as ' + d.nm() + ' learns.'} /> : c.map((m: any, i: number) => {
        const name = (m.label || '').split(' — ')[0]; const role = (m.label || '').split(' — ')[1] || ''
        return <Rise i={i} key={m.id}><div className="pc glass"><div className="pav" style={{ background: pcol(name) }}>{name.slice(0, 1).toUpperCase()}</div><div className="grow"><div className="ttl">{name}</div><div className="sub">{role || m.value}</div></div><div className={'toggle' + (m.active ? ' on' : '')} onClick={() => toggle(m)} /></div></Rise>
      })}
    </>
  )
}

/* ---------------- SHEET (modal) ---------------- */
function Sheet({ modal, onClose }: any) {
  const d = useD()
  let inner: any = null
  if (modal.t === 'task') { const t = d.tasks.find((x: any) => x.id === modal.id); if (t) inner = <><div className="mt">{t.title}</div><div className="mc">{t.kind || 'note'} · {rel(t.updated_at || t.created_at)} ago</div><div className="md" dangerouslySetInnerHTML={{ __html: md(t.result || '') }} /></> }
  else if (modal.t === 'email') { const e = d.emails.find((x: any) => x.id === modal.id); if (e) inner = <><div className="mt">{e.subject || '(no subject)'}</div><div className="mc">{e.from_name || e.from_email} · {rel(e.received_at || e.created_at)} ago</div><div className="md"><p style={{ whiteSpace: 'pre-wrap' }}>{e.body_text || e.snippet}</p></div></> }
  else if (modal.t === 'profile') {
    const f = d.facts().filter((m: any) => m.source === 'email'); const c = d.contacts().filter((m: any) => m.source === 'email'); const vs = d.memory.filter((m: any) => m.kind === 'voice'); const v = vs.find((m: any) => m.source === 'email') || vs[0]
    inner = <><div className="mt">What {d.assistant.name} knows about you</div><div className="mc">distilled from your real email</div>
      {d.assistant.user_role && <div className="knows glass" style={{ cursor: 'default', marginBottom: 16 }}><div className="ki"><Brain size={20} /></div><div><div className="kt">You</div><div className="ks">{d.assistant.user_role}</div></div></div>}
      {v && <><div className="obsec">Your voice</div><div className="railcard glass" style={{ margin: '0 0 14px' }}><p>{(v.value || '').slice(0, 200)}</p></div></>}
      {c.length > 0 && <><div className="obsec">People ({c.length})</div>{c.slice(0, 8).map((m: any) => { const name = (m.label || '').split(' — ')[0]; return <div className="pc" style={{ background: 'transparent', padding: '8px 2px', marginBottom: 0 }} key={m.id}><div className="pav" style={{ width: 34, height: 34, fontSize: 13, background: pcol(name) }}>{name.slice(0, 1).toUpperCase()}</div><div className="grow"><div className="ttl" style={{ fontSize: 14 }}>{name}</div><div className="sub" style={{ fontSize: 12.5 }}>{(m.label || '').split(' — ')[1] || m.value}</div></div></div> })}</>}
      {f.length > 0 && <><div className="obsec">Good to know</div>{f.slice(0, 4).map((m: any) => <div className="railcard glass" style={{ margin: '0 0 9px', padding: '12px 14px' }} key={m.id}><div className="ttl" style={{ fontSize: 13.5 }}>{m.label}</div><div className="sub" style={{ fontSize: 12.5 }}>{(m.value || '').slice(0, 140)}</div></div>)}</>}
    </>
  }
  return (
    <motion.div className="ov" onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="sheet" onClick={(e) => e.stopPropagation()} initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }}>
        <div className="grab" />{inner}
      </motion.div>
    </motion.div>
  )
}

/* ---------------- connectors ---------------- */
async function connect(d: any, conn: string) {
  if (!d.org) { toast('Setting up…'); return }
  toast('Opening Google…')
  try {
    const r = await (C as any).connectors.createConnectRequest(d.org, conn)
    const url = r.authorization_url || r.redirect_url || r.url; if (url) window.open(url, '_blank')
    let tries = 0
    const iv = setInterval(async () => {
      tries++
      try { const a = ((await (C as any).connectors.accounts.list(d.org, { connectorId: conn })).items || []).find((x: any) => ((x.status || '') + '').toUpperCase().match(/CONNECT|ACTIVE/)); if (a) { clearInterval(iv); toast(cap(conn.replace('google_', '')) + ' connected ✓'); if (conn === 'gmail' && d.assistant) { try { await (C as any).records.update('assistant', d.assistant.id, { google_account_id: a.id, google_address: a.email || '' }) } catch {} } d.refreshConn() } } catch {}
      if (tries > 40) clearInterval(iv)
    }, 3000)
  } catch { toast("Couldn't start Google connect.") }
}

/* ================= ONBOARDING ================= */
const OB_TIPS: any[] = [
  [Sparkles, 'Just ask, in plain words', '“Reply to Ayush,” “what’s on today,” “research Sigmoid” — I take it from there.'],
  [Check, 'You’re always in control', 'I never send an email or book a meeting without your one-tap OK.'],
  [Zap, 'Routines run the repeat work', 'Morning briefs, chasing follow-ups, weekly reviews — on autopilot.'],
  [Brain, 'I learn how you sound', 'The more we work together, the more my drafts read like you wrote them.'],
  [Search, 'I research the live web', 'Real dossiers on people and companies, with sources — never guesses.'],
  [Calendar, 'Hand me your calendar', 'and I’ll find slots and put meetings on it — you just approve.'],
  [Mail, 'Your inbox, handled', 'I triage what actually matters and draft the replies that need one.'],
]
function Onboarding() {
  const d = useD()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('🟣')
  const [busy, setBusy] = useState(false)
  const createdRef = useRef<any>(null)

  const createAssistant = async () => {
    if (!name.trim()) { toast('Give it a name.'); return }
    try {
      if (!createdRef.current) { const a = await (C as any).records.create('assistant', { name: name.trim(), avatar_emoji: emoji, accent: '#5B4BFF', user_name: meFirst(d.user), autonomy: 'ask', onboarded: false }); createdRef.current = a }
      setStep(2)
    } catch { toast("Couldn't set up.") }
  }
  const connectStep = async () => {
    if (d.gmail.on) { await pin(); setStep(3); return }
    setBusy(true)
    try {
      const r = await (C as any).connectors.createConnectRequest(d.org, 'gmail'); const url = r.authorization_url || r.redirect_url || r.url; if (url) window.open(url, '_blank')
      let tries = 0; const iv = setInterval(async () => { tries++; const ok = await pin(); if (ok) { clearInterval(iv); setBusy(false); setStep(3) } if (tries > 40) { clearInterval(iv); setBusy(false) } }, 3000)
    } catch { setBusy(false); toast("Couldn't start Google connect.") }
  }
  const pin = async () => { try { const a = ((await (C as any).connectors.accounts.list(d.org, { connectorId: 'gmail' })).items || []).find((x: any) => ((x.status || '') + '').toUpperCase().match(/CONNECT|ACTIVE/)); if (a && createdRef.current) { try { await (C as any).records.update('assistant', createdRef.current.id, { google_account_id: a.id, google_address: a.email || '' }) } catch {} d.refreshConn(); return true } } catch {} return false }
  const finish = async () => { if (createdRef.current) { try { await (C as any).records.update('assistant', createdRef.current.id, { onboarded: true }) } catch {} } toast("You're all set 🎉") /* live query will pick up the assistant and swap to app */ }

  return (
    <>
      <div className="mesh" />
      <div className="obwrap">
        {step >= 1 && step <= 4 && <div className="odots">{[1, 2, 3, 4].map((i) => <span key={i} className={'odot' + (step >= i ? ' on' : '')} />)}</div>}
        <AnimatePresence mode="wait">
          <motion.div key={step} className="obcard" initial={{ opacity: 0, y: 12, scale: 0.99 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8 }} transition={{ type: 'spring', stiffness: 300, damping: 28 }}>
            {step === 0 && (
              <div className="obhero">
                <motion.div className="oblogo" initial={{ scale: 0.6, rotate: -12 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 240, damping: 14 }}><Sparkles size={30} /></motion.div>
                <h1 className="obh1">Meet your<br />Sidekick.</h1>
                <p className="obp">A personal assistant that reads your inbox, learns how you actually work, and does the work — always checking with you first.</p>
                <div className="obfeats">
                  {[[Mail, 'Reads your email', 'learns your world from real context'], [Brain, 'Gets to know you', 'your people, your voice, your priorities'], [Check, 'Asks before acting', 'nothing leaves your hands without a tap']].map(([Ic, t, s]: any, i) => (
                    <motion.div className="obfeat" key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.08 }}><div className="obfi"><Ic size={18} /></div><div><div className="obft">{t}</div><div className="obfs">{s}</div></div></motion.div>
                  ))}
                </div>
                <Tap className="btn btn-primary obbtn" onClick={() => setStep(1)}>Get started <ArrowRight size={17} /></Tap>
                <div className="obsign">Signed in as {d.user?.email || meName(d.user)}</div>
              </div>
            )}
            {step === 1 && (
              <div style={{ textAlign: 'center' }}>
                <div className="obav">{emoji}</div><h1 className="obh2">Name your assistant</h1><p className="obp2">You’ll talk to it by name. Make it yours.</p>
                <input className="inp" style={{ textAlign: 'center', fontSize: 18, maxWidth: 340, margin: '0 auto 14px' }} placeholder="e.g. Ori, Remy, Sage" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createAssistant()} autoFocus />
                <div className="emojipick" style={{ justifyContent: 'center', margin: '0 0 22px' }}>{['🟣', '🌟', '🦉', '🐨', '🍵', '🧭', '🪁', '🌊'].map((e) => <div key={e} className={'ep' + (emoji === e ? ' on' : '')} onClick={() => setEmoji(e)}>{e}</div>)}</div>
                <Tap className="btn btn-primary obbtn" onClick={createAssistant}>Continue <ArrowRight size={17} /></Tap>
              </div>
            )}
            {step === 2 && (
              <div style={{ textAlign: 'center' }}>
                <div className="obav">📥</div><h1 className="obh2">Connect your inbox</h1><p className="obp2">So {name || 'your assistant'} can read your email and learn who and what matters to you. It never sends anything without your OK.</p>
                {d.gmail.on ? <div className="intg glass" style={{ textAlign: 'left', margin: '6px 0 18px' }}><div className="lg">✉️</div><div className="grow"><div className="ttl">Gmail</div><div className="st ok">Connected{d.gmail.email ? ' · ' + d.gmail.email : ''}</div></div><Check size={20} color="var(--green)" /></div> : null}
                <Tap className="btn btn-primary obbtn" onClick={connectStep}>{d.gmail.on ? <>Continue <ArrowRight size={17} /></> : busy ? 'Opening Google…' : 'Connect Gmail'}</Tap>
                <div className="oblink" onClick={finish}>Skip for now</div>
              </div>
            )}
            {step === 3 && <Learning onDone={() => setStep(4)} name={name} />}
            {step === 4 && <Review name={name} onFinish={finish} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </>
  )
}
function Learning({ onDone }: any) {
  const d = useD(); const [tip, setTip] = useState(0)
  useEffect(() => {
    let cancelled = false
    const iv = setInterval(() => setTip((t) => t + 1), 3600)
    ;(async () => {
      let before: any = {}; try { (await (C as any).records.list('memory', { limit: 200 })).items.forEach((m: any) => { if (m.source === 'email') before[m.id] = 1 }) } catch {}
      try { await (C as any).functions.run('fetch_inbox', { input: { inbox_limit: 40, sent_limit: 25 } }) } catch {}
      try { await (C as any).records.create('profile_runs', { status: 'requested' }) } catch {}
      const start = Date.now()
      while (Date.now() - start < 48000 && !cancelled) {
        await new Promise((r) => setTimeout(r, 3000))
        let em: any[] = []; try { em = (await (C as any).records.list('memory', { limit: 200 })).items.filter((m: any) => m.source === 'email') } catch {}
        if (em.length && em.some((m: any) => !before[m.id])) { break }
      }
      if (!cancelled) { await new Promise((r) => setTimeout(r, 1200)); onDone() }
    })()
    return () => { cancelled = true; clearInterval(iv) }
  }, [])
  const [Ic, t, s] = OB_TIPS[tip % OB_TIPS.length]
  return (
    <div style={{ textAlign: 'center' }}>
      <motion.div className="orbwrap" animate={{ scale: [1, 1.08, 1] }} transition={{ repeat: Infinity, duration: 1.8 }}><div className="obav" style={{ margin: 0 }}>{d.assistant?.avatar_emoji || '🟣'}</div></motion.div>
      <h1 className="obh2" style={{ marginTop: 22 }}>Getting to know you…</h1>
      <div className="obbar"><motion.div className="obbar-fill" initial={{ width: '6%' }} animate={{ width: '94%' }} transition={{ duration: 36, ease: 'easeOut' }} /></div>
      <div className="obsec" style={{ textAlign: 'center', margin: '0 0 12px' }}>While I read your inbox — here’s what I can do</div>
      <AnimatePresence mode="wait">
        <motion.div className="obtip" key={tip} initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -9 }} transition={{ duration: 0.35 }}>
          <div className="obtip-i"><Ic size={19} /></div><div><div className="obtip-t">{t}</div><div className="obtip-s">{s}</div></div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
function Review({ name, onFinish }: any) {
  const d = useD()
  const a = d.assistant; const f = d.facts().filter((m: any) => m.source === 'email'); const c = d.contacts().filter((m: any) => m.source === 'email'); const vs = d.memory.filter((m: any) => m.kind === 'voice'); const v = vs.find((m: any) => m.source === 'email') || vs[0]
  return (
    <div>
      <div className="obav" style={{ margin: '0 auto 14px' }}>{a?.avatar_emoji || '🟣'}</div>
      <h1 className="obh2" style={{ textAlign: 'center' }}>Here’s what {a?.name || name} learned</h1>
      <p className="obp2" style={{ textAlign: 'center' }}>Straight from your inbox — you can edit any of this later.</p>
      {a?.user_role && <div className="knows glass" style={{ cursor: 'default', margin: '8px 0 14px' }}><div className="ki"><Brain size={20} /></div><div><div className="kt">You</div><div className="ks">{a.user_role}</div></div></div>}
      {v && <><div className="obsec">Your voice</div><div className="railcard glass" style={{ margin: '0 0 14px' }}><p>{(v.value || '').slice(0, 190)}</p></div></>}
      {c.length > 0 && <><div className="obsec">People it found ({c.length})</div><div className="obpeople">{c.slice(0, 6).map((m: any) => { const nm = (m.label || '').split(' — ')[0]; return <div className="oppill" key={m.id}><div className="pav" style={{ width: 26, height: 26, fontSize: 11, background: pcol(nm) }}>{nm.slice(0, 1).toUpperCase()}</div>{nm}</div> })}</div></>}
      {f.length > 0 && <><div className="obsec">Good to know</div>{f.slice(0, 3).map((m: any) => <div className="railcard glass" key={m.id} style={{ margin: '0 0 9px', padding: '12px 14px' }}><div className="ttl" style={{ fontSize: 13.5 }}>{m.label}</div><div className="sub" style={{ fontSize: 12.5 }}>{(m.value || '').slice(0, 120)}</div></div>)}</>}
      {!c.length && !f.length && !v && <div className="obp2" style={{ textAlign: 'center', padding: '20px 0' }}>{a?.name || name} is still reading — you can sync your inbox anytime from the Inbox tab.</div>}
      <Tap className="btn btn-primary obbtn" style={{ marginTop: 16 }} onClick={onFinish}>Looks right — let’s go <ArrowRight size={17} /></Tap>
    </div>
  )
}
