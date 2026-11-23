import { useEffect, useMemo, useState } from 'react'
import {
  FAMILY, GOAL, REPO, SOURCE, STATUS, SUBMIT, TIER, daysUntil, domainOf, fresh, groupCompanies,
  money, siteUrl, store, tierLabel,
} from './lib'

/* ---------- 小组件 ---------- */

function Icon({ d, className = 'h-4 w-4' }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{d}</svg>
}
const I = {
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  ext: <><path d="M14 4h6v6" /><path d="M20 4 10 14" /><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" /></>,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  star: <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18" /><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18" /></>,
  pin: <><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /><circle cx="12" cy="10" r="2.5" /></>,
  check: <path d="m5 12 5 5 9-10" />,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7" /><path d="M21.5 20a6.5 6.5 0 0 0-4-6" /></>,
}

function Logo({ c, size = 44 }) {
  const [err, setErr] = useState(false)
  const dom = domainOf(c.site)
  const letter = (c.name || '?').replace(/[（(].*$/, '').trim().slice(0, 1).toUpperCase()
  const hue = [...(c.name || '')].reduce((a, ch) => a + ch.charCodeAt(0), 0) % 360
  const style = { width: size, height: size }
  if (dom && !err) {
    return (
      <div style={style} className="shrink-0 overflow-hidden rounded-xl border border-ink-700 bg-white/95 p-1.5">
        <img src={`https://www.google.com/s2/favicons?domain=${dom}&sz=128`} alt="" className="h-full w-full object-contain" onError={() => setErr(true)} />
      </div>
    )
  }
  return (
    <div style={{ ...style, background: `hsl(${hue} 45% 22%)`, color: `hsl(${hue} 80% 82%)` }}
      className="flex shrink-0 items-center justify-center rounded-xl border border-ink-700 text-base font-semibold">{letter}</div>
  )
}

function Pill({ className = '', children, title }) {
  return <span title={title} className={`inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${className}`}>{children}</span>
}

function Seg({ value, onChange, options }) {
  return (
    <div className="inline-flex rounded-lg border border-ink-700 bg-ink-900 p-0.5">
      {options.map(([v, label]) => (
        <button key={v} onClick={() => onChange(v)}
          className={`rounded-md px-3 py-1.5 text-sm transition ${value === v ? 'bg-ink-700 text-white shadow-sm' : 'text-ink-300 hover:text-white'}`}>{label}</button>
      ))}
    </div>
  )
}

function Toggle({ on, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[13px] transition ${on ? 'border-brand/60 bg-brand-soft text-white' : 'border-ink-700 text-ink-300 hover:border-ink-600 hover:text-white'}`}>{children}</button>
  )
}

function FundingLine({ c }) {
  const f = c.funding || {}
  const parts = [f.round, money(f), f.lead && `领投 ${f.lead}`].filter(Boolean)
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-300">
      <Pill className={tierLabel(c).cls}>{tierLabel(c).label}</Pill>
      {parts.length > 0 && <span>{parts.join(' · ')}</span>}
      {c.team_size && <span className="inline-flex items-center gap-1"><Icon d={I.users} className="h-3.5 w-3.5" />{c.team_size} 人</span>}
      {f.source_url && <a href={f.source_url} target="_blank" rel="noreferrer" className="text-brand hover:underline">融资来源</a>}
    </div>
  )
}

function laneLabel(j) {
  if (j.lane === 'remote') return { text: j.remote === 'remote_ok' ? '远程' : '远程待确认', cls: 'text-mint border-mint/30 bg-mint/10' }
  const cities = [j.china_city, ...(j.also_cities || [])].filter(Boolean).join(' / ')
  return { text: cities || '线下', cls: 'text-amber border-amber/30 bg-amber/10' }
}

/* ---------- 岗位 ---------- */

function JobRow({ j, mine, setMine, showCompany, onCompany }) {
  const [open, setOpen] = useState(false)
  const m = mine[j.id]
  const lane = laneLabel(j)
  const fr = fresh(j)
  const dl = daysUntil(j.deadline)
  const setStatus = (status) => {
    const next = { ...mine }
    if (!status) delete next[j.id]
    else next[j.id] = { status, title: j.title, company: j.company.name, url: j.apply_url, deadline: j.deadline, at: new Date().toISOString().slice(0, 10) }
    setMine(next)
  }
  const hasDetail = j.duties_zh?.length || j.requirements_zh?.length
  return (
    <div className={`group rounded-xl border bg-ink-900/60 transition hover:border-ink-600 ${m ? 'border-brand/50' : 'border-ink-800'}`}>
      <div className="flex flex-wrap items-start gap-3 p-3.5 sm:flex-nowrap">
        {showCompany && <button onClick={() => onCompany?.(j.company.name)}><Logo c={j.company} size={40} /></button>}
        <div className="min-w-0 flex-1">
          {showCompany && <button onClick={() => onCompany?.(j.company.name)} className="text-xs text-ink-300 hover:text-white">{j.company.name}</button>}
          <div className="font-medium leading-snug text-white">{j.title}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Pill className={lane.cls}><Icon d={j.lane === 'remote' ? I.globe : I.pin} className="h-3 w-3" />{lane.text}</Pill>
            {j.lane === 'remote' && j.work_auth !== 'us_only' && <Pill className="border-mint/30 bg-mint/10 text-mint">不卡签证</Pill>}
            <Pill className="border-ink-700 bg-ink-800 text-ink-300">{FAMILY[j.role_family] || j.role_family}</Pill>
            {j.pay?.text && <Pill className="border-ink-700 bg-ink-800 text-ink-100">{j.pay.text}</Pill>}
            {(j.days_text || j.days_per_week) && <Pill className="border-ink-700 bg-ink-800 text-ink-300">{j.days_text || `${j.days_per_week}天/周`}</Pill>}
            {(j.months_text || j.duration_months) && <Pill className="border-ink-700 bg-ink-800 text-ink-300">{j.months_text || `${j.duration_months}个月`}</Pill>}
            {dl !== null && dl >= 0 && <Pill className={dl <= 3 ? 'border-red-400/40 bg-red-400/10 text-red-300' : 'border-ink-700 bg-ink-800 text-ink-300'}>{dl <= 7 ? `${dl} 天后截止` : `截止 ${j.deadline.slice(5)}`}</Pill>}
            {j.portfolio_required && <Pill className="border-ink-700 bg-ink-800 text-ink-300">需作品集</Pill>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-400">
            <span className={fr.cls}>● {fr.text}</span>
            <span>来源 {SOURCE[j.source] || j.source}</span>
            {j.skills?.length > 0 && <span>能力：{j.skills.join(' · ')}</span>}
            {hasDetail ? <button onClick={() => setOpen(!open)} className="text-brand hover:underline">{open ? '收起' : '职责与要求'}</button> : null}
          </div>
          {open && (
            <div className="mt-3 grid gap-3 rounded-lg border border-ink-800 bg-ink-950/60 p-3 text-sm sm:grid-cols-2">
              <div><div className="mb-1 text-xs text-ink-400">做什么</div><ul className="space-y-1 text-ink-100">{j.duties_zh.map((x, i) => <li key={i}>· {x}</li>)}</ul></div>
              <div><div className="mb-1 text-xs text-ink-400">要什么人</div><ul className="space-y-1 text-ink-100">{j.requirements_zh.map((x, i) => <li key={i}>· {x}</li>)}</ul></div>
            </div>
          )}
        </div>
        <div className="flex w-full shrink-0 items-center gap-2 sm:w-auto sm:flex-col sm:items-end">
          <a href={j.apply_url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:brightness-110">去投递<Icon d={I.ext} className="h-3.5 w-3.5" /></a>
          <select value={m?.status || ''} onChange={e => setStatus(e.target.value)}
            className="rounded-lg border border-ink-700 bg-ink-850 px-2 py-1 text-xs text-ink-100 outline-none focus:border-brand">
            <option value="">＋ 加入投递</option>
            {STATUS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}

/* ---------- 公司 ---------- */

function CompanyCard({ c, onOpen, mine }) {
  const shown = c.jobs.slice(0, 3)
  const tracked = c.jobs.filter(j => mine[j.id]).length
  return (
    <button onClick={() => onOpen(c.name)}
      className="group flex h-full flex-col rounded-2xl border border-ink-800 bg-ink-900/70 p-4 text-left transition hover:-translate-y-0.5 hover:border-brand/50 hover:bg-ink-900">
      <div className="flex items-start gap-3">
        <Logo c={c} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold text-white">{c.name}</span>
            {c.chinese_team && !c.big_tech && <Pill className="border-rose-400/30 bg-rose-400/10 text-rose-300">华人团队</Pill>}
          </div>
          {c.one_liner && <p className="mt-0.5 line-clamp-2 text-[13px] leading-relaxed text-ink-300">{c.one_liner}</p>}
        </div>
      </div>
      <div className="mt-3"><FundingLine c={c} /></div>
      <div className="mt-3 flex-1 space-y-1.5 border-t border-ink-800 pt-3">
        {shown.map(j => {
          const l = laneLabel(j); const f = fresh(j)
          return (
            <div key={j.id} className="flex items-center gap-2 text-[13px]">
              <span className="min-w-0 flex-1 truncate text-ink-100">{j.title}</span>
              <span className={`shrink-0 text-[11px] ${l.cls.split(' ')[0]}`}>{l.text}</span>
              <span className={`shrink-0 text-[11px] ${f.cls}`}>{f.text.split(' · ')[0]}</span>
            </div>
          )
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-ink-400">
        <span>{c.jobs.length} 个在招实习{tracked ? ` · 已加入 ${tracked}` : ''}</span>
        <span className="text-brand opacity-0 transition group-hover:opacity-100">查看全部 →</span>
      </div>
    </button>
  )
}

function CompanyPanel({ c, onClose, mine, setMine }) {
  useEffect(() => {
    const k = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', k); document.body.style.overflow = '' }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="scroll-thin h-full w-full max-w-2xl overflow-y-auto border-l border-ink-800 bg-ink-950 p-5 sm:p-7">
        <div className="flex items-start gap-4">
          <Logo c={c} size={56} />
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold text-white">{c.name}</h2>
            {c.one_liner && <p className="mt-1 text-sm text-ink-300">{c.one_liner}</p>}
          </div>
          <button onClick={onClose} aria-label="关闭" className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-800 hover:text-white"><Icon d={I.x} className="h-5 w-5" /></button>
        </div>
        <div className="mt-4 space-y-2">
          <FundingLine c={c} />
          <div className="flex flex-wrap gap-2 text-xs">
            {c.site && <a href={siteUrl(c.site)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-ink-700 px-2.5 py-1 text-ink-100 hover:border-brand">官网<Icon d={I.ext} className="h-3 w-3" /></a>}
            {c.batch && <Pill className="border-orange-400/30 bg-orange-400/10 text-orange-300">YC {c.batch}</Pill>}
            {c.chinese_team && <Pill className="border-rose-400/30 bg-rose-400/10 text-rose-300">华人团队</Pill>}
          </div>
        </div>
        <h3 className="mb-3 mt-6 text-sm font-medium text-ink-300">在招实习 · {c.jobs.length}</h3>
        <div className="space-y-2.5">{c.jobs.map(j => <JobRow key={j.id} j={j} mine={mine} setMine={setMine} />)}</div>
        <p className="mt-6 text-xs leading-relaxed text-ink-400">投递前请以原链接为准。融资信息若有误，欢迎在 <a className="text-brand" href={SUBMIT} target="_blank" rel="noreferrer">GitHub</a> 纠错。</p>
      </div>
    </div>
  )
}

/* ---------- 动态 / 我的投递 ---------- */

function Activity({ changes }) {
  const groups = useMemo(() => {
    const g = {}; changes.forEach(c => { (g[c.date] ||= []).push(c) }); return Object.entries(g).slice(0, 14)
  }, [changes])
  if (!groups.length) return <Empty title="还没有动态" body="每天更新后，这里会列出新增和下线的岗位。" />
  return (
    <div className="space-y-6">
      {groups.map(([d, items]) => {
        const add = items.filter(c => c.type === 'added'); const rm = items.filter(c => c.type === 'removed')
        return (
          <section key={d}>
            <div className="mb-2 flex items-baseline gap-3"><h3 className="font-medium text-white">{d}</h3><span className="text-xs text-ink-400"><span className="text-mint">+{add.length}</span> 新增 · <span className="text-red-300">−{rm.length}</span> 下线</span></div>
            <div className="divide-y divide-ink-800 rounded-xl border border-ink-800 bg-ink-900/60">
              {[...add, ...rm].slice(0, 60).map(c => (
                <a key={c.type + c.id} href={c.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-3.5 py-2 text-sm hover:bg-ink-850">
                  <span className={`w-8 shrink-0 text-xs ${c.type === 'added' ? 'text-mint' : 'text-red-300'}`}>{c.type === 'added' ? '新增' : '下线'}</span>
                  <span className="w-36 shrink-0 truncate text-ink-300">{c.company}</span>
                  <span className={`truncate ${c.type === 'removed' ? 'text-ink-400 line-through' : 'text-ink-100'}`}>{c.title}</span>
                </a>
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function Tracker({ mine, setMine }) {
  const rows = Object.entries(mine)
  const applied = rows.filter(([, v]) => v.status && v.status !== '想投').length
  const pct = Math.min(100, Math.round(applied / GOAL * 100))
  if (!rows.length) return <Empty title="开始你的投递清单" body="在任意岗位右侧选择「加入投递」，它就会出现在这里，并按状态分栏。数据只保存在你的浏览器里。" />
  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-ink-800 bg-ink-900/70 p-5">
        <div className="flex items-baseline justify-between"><span className="text-sm text-ink-300">投递目标</span><span className="text-sm text-ink-300"><span className="text-2xl font-semibold text-white">{applied}</span> / {GOAL}</span></div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-800"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} /></div>
      </div>
      <div className="scroll-thin flex gap-3 overflow-x-auto pb-2">
        {STATUS.map(s => {
          const col = rows.filter(([, v]) => v.status === s)
          return (
            <div key={s} className="w-64 shrink-0 rounded-xl border border-ink-800 bg-ink-900/50 p-2.5">
              <div className="mb-2 flex justify-between px-1 text-xs text-ink-300"><span>{s}</span><span>{col.length}</span></div>
              <div className="space-y-2">
                {col.map(([id, v]) => {
                  const d = daysUntil(v.deadline)
                  return (
                    <div key={id} className="rounded-lg border border-ink-800 bg-ink-850 p-2.5 text-sm">
                      <div className="text-xs text-ink-400">{v.company}</div>
                      <a href={v.url} target="_blank" rel="noreferrer" className="line-clamp-2 text-ink-100 hover:text-brand">{v.title}</a>
                      <div className="mt-2 flex items-center justify-between">
                        <span className={`text-[11px] ${d !== null && d >= 0 && d <= 3 ? 'text-red-300' : 'text-ink-400'}`}>{v.deadline ? `截止 ${v.deadline.slice(5)}` : ''}</span>
                        <select value={v.status} onChange={e => setMine({ ...mine, [id]: { ...v, status: e.target.value } })}
                          className="rounded border border-ink-700 bg-ink-900 px-1 py-0.5 text-[11px] text-ink-100">{STATUS.map(x => <option key={x}>{x}</option>)}</select>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Empty({ title, body }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-700 px-6 py-14 text-center">
      <div className="font-medium text-white">{title}</div>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-400">{body}</p>
    </div>
  )
}

/* ---------- 页面 ---------- */

const DEFAULT_F = { lane: 'remote', q: '', family: null, chinese: false, verified: false, hideBig: false, sort: 'rec' }

export default function App() {
  const [data, setData] = useState(null)
  const [changes, setChanges] = useState([])
  const [err, setErr] = useState(null)
  const [tab, setTab] = useState(() => store.get('tab2', 'companies'))
  const [f, setF] = useState(() => ({ ...DEFAULT_F, ...store.get('filters2', {}), q: '' }))
  const [mine, setMineRaw] = useState(() => store.get('mine2', {}))
  const [openCo, setOpenCo] = useState(null)
  const setMine = v => { setMineRaw(v); store.set('mine2', v) }

  useEffect(() => { store.set('tab2', tab) }, [tab])
  useEffect(() => { const { q, ...rest } = f; store.set('filters2', rest) }, [f])
  useEffect(() => {
    fetch('data/jobs.json', { cache: 'no-cache' }).then(r => r.json()).then(setData).catch(e => setErr(String(e)))
    fetch('data/changes.json', { cache: 'no-cache' }).then(r => r.json()).then(setChanges).catch(() => {})
  }, [])

  const live = useMemo(() => (data?.jobs || []).filter(j => j.status === 'open'), [data])
  const filtered = useMemo(() => {
    const q = f.q.trim().toLowerCase()
    return live.filter(j => {
      if (f.lane !== 'all' && j.lane !== f.lane) return false
      if (f.family && j.role_family !== f.family) return false
      if (f.chinese && !j.company.chinese_team) return false
      if (f.verified && j.company.tier !== 'A') return false
      if (f.hideBig && j.company.big_tech) return false
      if (q && !`${j.title} ${j.company.name} ${j.company.one_liner || ''} ${j.location}`.toLowerCase().includes(q)) return false
      return true
    })
  }, [live, f])
  const companies = useMemo(() => {
    const cs = groupCompanies(filtered)
    const tierRank = { A: 0, B: 1, C: 2 }
    if (f.sort === 'new') cs.sort((a, b) => a.newest - b.newest)
    else if (f.sort === 'jobs') cs.sort((a, b) => b.jobs.length - a.jobs.length)
    else cs.sort((a, b) => (a.big_tech - b.big_tech) || (tierRank[a.tier] - tierRank[b.tier]) || (b.score - a.score))
    return cs
  }, [filtered, f.sort])
  const families = useMemo(() => {
    const c = {}; live.filter(j => f.lane === 'all' || j.lane === f.lane).forEach(j => { c[j.role_family] = (c[j.role_family] || 0) + 1 })
    return Object.entries(c).sort((a, b) => b[1] - a[1])
  }, [live, f.lane])
  const allCompanies = useMemo(() => groupCompanies(live), [live])
  const panelCo = openCo && allCompanies.find(c => c.name === openCo)
  const s = data?.stats
  const tracked = Object.keys(mine).length
  const laneCount = l => live.filter(j => l === 'all' || j.lane === l).length

  const tabs = [['companies', '公司'], ['jobs', '全部岗位'], ['activity', '本周动态'], ['tracker', `我的投递${tracked ? ` ${tracked}` : ''}`]]

  return (
    <div className="min-h-screen">
      <div className="glow-top pointer-events-none absolute inset-x-0 top-0 h-[420px]" />
      <header className="sticky top-0 z-40 border-b border-ink-800/80 bg-ink-950/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <a href="./" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand"><svg viewBox="0 0 32 32" className="h-5 w-5"><path d="M9 22l7-13 7 13" stroke="white" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></div>
            <div className="leading-tight"><div className="text-[15px] font-semibold text-white">AI 初创实习</div><div className="text-[11px] text-ink-400">AIStartupIntern</div></div>
          </a>
          <nav className="ml-4 hidden gap-1 md:flex">
            {tabs.map(([k, label]) => <button key={k} onClick={() => setTab(k)} className={`rounded-lg px-3 py-1.5 text-sm ${tab === k ? 'bg-ink-800 text-white' : 'text-ink-300 hover:text-white'}`}>{label}</button>)}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <a href={SUBMIT} target="_blank" rel="noreferrer" className="hidden items-center gap-1 rounded-lg border border-ink-700 px-3 py-1.5 text-sm text-ink-100 hover:border-ink-600 sm:inline-flex"><Icon d={I.plus} />提交岗位</a>
            <a href={REPO} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-ink-950 hover:bg-ink-100"><Icon d={I.star} />Star</a>
          </div>
        </div>
        <nav className="scroll-thin flex gap-1 overflow-x-auto px-4 pb-2 md:hidden">
          {tabs.map(([k, label]) => <button key={k} onClick={() => setTab(k)} className={`shrink-0 rounded-lg px-3 py-1.5 text-sm ${tab === k ? 'bg-ink-800 text-white' : 'text-ink-300'}`}>{label}</button>)}
        </nav>
      </header>

      <main className="relative mx-auto max-w-6xl px-4 pb-20">
        <section className="pb-8 pt-10 sm:pt-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-ink-700 bg-ink-900/80 px-3 py-1 text-xs text-ink-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" />
            {s ? `${new Date(s.updated_at).toLocaleDateString('zh-CN')} 已核实在招` : '加载中'}
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-5xl">非技术同学，<br className="sm:hidden" />也能进 AI 初创公司</h1>
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-300">只收录<span className="text-white">有融资的 AI 初创公司</span>正在招的<span className="text-white">增长、GTM、市场、内容、运营、产品</span>实习。每天重新核实在招状态，标清能否远程、卡不卡签证。</p>
          {s && (
            <div className="mt-7 grid max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-2xl border border-ink-800 bg-ink-800 sm:grid-cols-4">
              {[['今日新增', s.added_today], ['在招实习', s.total], ['AI 公司', s.companies], ['本周下线', s.removed_7d]].map(([k, v]) => (
                <div key={k} className="bg-ink-900 px-4 py-3"><div className="text-2xl font-semibold text-white">{v}</div><div className="text-xs text-ink-400">{k}</div></div>
              ))}
            </div>
          )}
        </section>

        {err && <Empty title="数据加载失败" body={err} />}
        {!data && !err && <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[...Array(6)].map((_, i) => <div key={i} className="h-56 animate-pulse rounded-2xl bg-ink-900" />)}</div>}

        {data && (tab === 'companies' || tab === 'jobs') && (
          <>
            <div className="z-30 -mx-4 md:sticky md:top-[57px] mb-5 space-y-3 border-b border-ink-800/60 bg-ink-950/90 px-4 py-3 backdrop-blur-md md:top-[57px]">
              <div className="flex flex-wrap items-center gap-2">
                <Seg value={f.lane} onChange={v => setF({ ...f, lane: v, family: null })} options={[['remote', `远程可投 ${laneCount('remote')}`], ['china_onsite', `国内线下 ${laneCount('china_onsite')}`], ['all', '全部']]} />
                <div className="relative min-w-[200px] flex-1">
                  <Icon d={I.search} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <input value={f.q} onChange={e => setF({ ...f, q: e.target.value })} placeholder="搜索公司、岗位、城市"
                    className="w-full rounded-lg border border-ink-700 bg-ink-900 py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-ink-400 focus:border-brand" />
                </div>
                {tab === 'companies' && (
                  <select value={f.sort} onChange={e => setF({ ...f, sort: e.target.value })} className="rounded-lg border border-ink-700 bg-ink-900 px-2.5 py-2 text-sm text-ink-100 outline-none">
                    <option value="rec">推荐排序</option><option value="new">最新发布</option><option value="jobs">岗位最多</option>
                  </select>
                )}
              </div>
              <div className="scroll-thin flex items-center gap-1.5 overflow-x-auto pb-0.5">
                <Toggle on={!f.family} onClick={() => setF({ ...f, family: null })}>全部方向</Toggle>
                {families.map(([k, n]) => <Toggle key={k} on={f.family === k} onClick={() => setF({ ...f, family: f.family === k ? null : k })}>{FAMILY[k] || k} <span className="text-ink-400">{n}</span></Toggle>)}
                <span className="mx-1 h-4 w-px shrink-0 bg-ink-700" />
                <Toggle on={f.chinese} onClick={() => setF({ ...f, chinese: !f.chinese })}>华人团队</Toggle>
                <Toggle on={f.verified} onClick={() => setF({ ...f, verified: !f.verified })}>融资已核实</Toggle>
                <Toggle on={f.hideBig} onClick={() => setF({ ...f, hideBig: !f.hideBig })}>隐藏大厂</Toggle>
              </div>
            </div>
            {f.lane === 'china_onsite' && <p className="mb-4 rounded-xl border border-amber/20 bg-amber/5 px-4 py-2.5 text-sm text-amber">国内线下岗位适合明年 5 月回国后投递。很多公司滚动招聘，可以先关注。</p>}
            <div className="mb-3 flex items-center justify-between text-sm text-ink-400">
              <span>{tab === 'companies' ? `${companies.length} 家公司 · ${filtered.length} 个实习` : `${filtered.length} 个实习`}</span>
              <button className="hover:text-white" onClick={() => setF({ ...DEFAULT_F, lane: f.lane })}>重置筛选</button>
            </div>
            {tab === 'companies' && (companies.length
              ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{companies.map(c => <CompanyCard key={c.name} c={c} onOpen={setOpenCo} mine={mine} />)}</div>
              : <Empty title="没有符合条件的公司" body="试试放宽筛选条件，或切换到「全部」。" />)}
            {tab === 'jobs' && (filtered.length
              ? <div className="space-y-2.5">{filtered.map(j => <JobRow key={j.id} j={j} mine={mine} setMine={setMine} showCompany onCompany={setOpenCo} />)}</div>
              : <Empty title="没有符合条件的岗位" body="试试放宽筛选条件。" />)}
          </>
        )}
        {data && tab === 'activity' && <Activity changes={changes} />}
        {data && tab === 'tracker' && <Tracker mine={mine} setMine={setMine} />}

        <footer className="mt-20 grid gap-6 border-t border-ink-800 pt-8 text-xs leading-relaxed text-ink-400 sm:grid-cols-3">
          <div><div className="mb-1 font-medium text-ink-100">收录标准</div>有融资的 AI 初创公司 · 明确标注实习 · 非技术岗位 · 有薪。不收全职、技术岗、无薪、Web3、只限美国身份的岗位。</div>
          <div><div className="mb-1 font-medium text-ink-100">时效</div>每天北京时间 8:00 重新抓取并逐条核实。发布超过 60 天的岗位只有当天确认仍在招才会显示，超过 180 天一律不显示。</div>
          <div><div className="mb-1 font-medium text-ink-100">数据来源</div>公司官方招聘页（Ashby、Greenhouse、Lever）、YC、Hacker News、实习僧、电鸭，以及人工核实的 Boss 直聘、LinkedIn、X 等。<a className="text-brand" href={REPO} target="_blank" rel="noreferrer">开源</a> · <a className="text-brand" href={SUBMIT} target="_blank" rel="noreferrer">提交岗位</a></div>
        </footer>
      </main>

      {panelCo && <CompanyPanel c={panelCo} onClose={() => setOpenCo(null)} mine={mine} setMine={setMine} />}
    </div>
  )
}
