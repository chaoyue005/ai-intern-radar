import { useEffect, useMemo, useState } from 'react'

const REPO = 'https://github.com/chaoyue005/ai-intern-radar'
const SUBMIT = `${REPO}/issues/new?template=submit-job.yml`

const FAMILY = {
  growth: '增长', gtm: 'GTM/商业化', pmm: '产品营销', marketing: '市场/品牌', content: '内容',
  social: '社媒/KOL', community: '社区', pm: 'AI 产品', ops: '运营', bd: 'BD/合作',
  strategy: '战略/研究', founders_office: "Founder's Office", ux_research: '用户研究', hr: 'HR/招聘',
  semi_tech: '半技术', other: '其他',
}
const TIER = { A: { t: '甲', c: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200', d: '融资有公开来源' },
  B: { t: '乙', c: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-200', d: 'YC / 知名公司 / JD 自述融资' },
  C: { t: '丙', c: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300', d: '融资未核实' } }
const MARKS = { want: '想投', maybe: '一般', no: '不想投' }
const STATUS = ['未投', '已投', '笔试/作业', '面试中', 'Offer', '被拒']
const SOURCE = { ashby: 'Ashby 官方', greenhouse: 'Greenhouse 官方', lever: 'Lever 官方', yc: 'YC', hn: 'Hacker News',
  shixiseng: '实习僧', eleduck: '电鸭', boss: 'Boss 直聘', linkedin: 'LinkedIn', x: 'X', seed: '人工核实', submission: '投稿',
  jobsdb: 'JobsDB', jike: '即刻', nowcoder: '牛客', wellfound: 'Wellfound', maimai: '脉脉', xiaohongshu: '小红书', workable: 'Workable' }

const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* 隐私模式等情况 */ } },
}

function daysUntil(s) {
  if (!s) return null
  const d = new Date(s + 'T23:59:59'); return Math.ceil((d - new Date()) / 86400000)
}
function ago(s) {
  if (!s) return ''
  const n = Math.floor((new Date() - new Date(s)) / 86400000)
  return n <= 0 ? '今天' : n === 1 ? '昨天' : n < 30 ? `${n} 天前` : `${Math.floor(n / 30)} 个月前`
}

function Chip({ active, onClick, children }) {
  return (
    <button onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm transition ${active
        ? 'border-brand bg-brand text-white'
        : 'border-slate-300 bg-white text-slate-700 hover:border-brand dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300'}`}>
      {children}
    </button>
  )
}

function Badge({ className = '', children, title }) {
  return <span title={title} className={`inline-flex items-center rounded px-1.5 py-0.5 text-xs font-medium ${className}`}>{children}</span>
}

function JobCard({ j, mine, setMine }) {
  const [open, setOpen] = useState(false)
  const m = mine[j.id] || {}
  const dl = daysUntil(j.deadline)
  const update = (patch) => setMine({ ...mine, [j.id]: { ...m, ...patch, title: j.title, company: j.company.name, url: j.apply_url, deadline: j.deadline } })
  const tier = TIER[j.company.tier]
  const cities = [j.china_city, ...(j.also_cities || [])].filter(Boolean).join(' / ')
  const remoteLabel = j.lane === 'remote' ? (j.remote === 'remote_ok' ? '可远程' : '远程(待确认)') : `线下 · ${cities || j.location}`
  return (
    <article className={`rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md dark:bg-slate-900 ${m.mark === 'no' ? 'opacity-50' : ''} ${m.mark === 'want' ? 'border-brand' : 'border-slate-200 dark:border-slate-800'}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold leading-snug">{j.title}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
            {j.company.site
              ? <a className="font-medium text-slate-800 hover:text-brand dark:text-slate-200" href={j.company.site.startsWith('http') ? j.company.site : `https://${j.company.site}`} target="_blank" rel="noreferrer">{j.company.name}</a>
              : <span className="font-medium text-slate-800 dark:text-slate-200">{j.company.name}</span>}
            <Badge className={tier.c} title={tier.d}>{tier.t}档</Badge>
            {j.company.big_tech && <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300" title="大厂不优先，排在后面">大厂</Badge>}
            {j.company.chinese_team && !j.company.big_tech && <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200">华人团队</Badge>}
            {j.company.funding?.round && <span className="text-xs">· {j.company.funding.round}{j.company.funding.amount_usd ? ` ${(j.company.funding.amount_usd / 1e6).toFixed(1)}M 美元` : ''}{j.company.funding.lead ? ` · ${j.company.funding.lead}` : ''}</span>}
          </div>
          {j.company.one_liner && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{j.company.one_liner}</p>}
        </div>
        <a href={j.apply_url} target="_blank" rel="noreferrer"
          className="shrink-0 rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:opacity-90">去投递 ↗</a>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
        <Badge className="bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200">{FAMILY[j.role_family] || j.role_family}</Badge>
        <Badge className={j.lane === 'remote' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200' : 'bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200'}>{remoteLabel}</Badge>
        {j.work_auth === 'none_stated' && j.lane === 'remote' && <Badge className="bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">未写签证限制</Badge>}
        {j.pay?.text && <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">💰 {j.pay.text}</Badge>}
        {(j.days_text || j.days_per_week) && <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{j.days_text || `${j.days_per_week}天/周`}</Badge>}
        {(j.months_text || j.duration_months) && <Badge className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{j.months_text || `${j.duration_months}个月`}</Badge>}
        {dl !== null && <Badge className={dl <= 3 ? 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'}>截止 {j.deadline}{dl <= 7 ? `（还剩 ${dl} 天）` : ''}</Badge>}
        {j.portfolio_required && <Badge className="bg-purple-50 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200">需作品集</Badge>}
        {j.semi_technical && <Badge className="bg-orange-50 text-orange-700 dark:bg-orange-900/40 dark:text-orange-200">半技术</Badge>}
        {j.status === 'stale_unverified' && <Badge className="bg-yellow-100 text-yellow-800">超过 60 天，待确认</Badge>}
      </div>

      {j.skills?.length > 0 && (
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">核心能力：{j.skills.join(' · ')}</div>
      )}

      {(j.duties_zh?.length > 0 || j.requirements_zh?.length > 0) && (
        <button onClick={() => setOpen(!open)} className="mt-2 text-sm text-brand hover:underline">{open ? '收起' : '看职责和要求'}</button>
      )}
      {open && (
        <div className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
          <div><div className="mb-1 font-medium">做什么</div><ul className="list-disc space-y-0.5 pl-5 text-slate-600 dark:text-slate-300">{j.duties_zh.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
          <div><div className="mb-1 font-medium">要什么人</div><ul className="list-disc space-y-0.5 pl-5 text-slate-600 dark:text-slate-300">{j.requirements_zh.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs dark:border-slate-800">
        <div className="flex flex-wrap gap-1.5 text-slate-500">
          {j.labels.fact.map(x => <span key={x} title="事实">✅ {x}</span>)}
          {j.labels.inferred.map(x => <span key={x} title="推断">🔍 {x}</span>)}
          {j.labels.unverified.map(x => <span key={x} title="未核实">⚠️ {x}</span>)}
          <span>· 来源：{SOURCE[j.source] || j.source} · 收录于 {ago(j.first_seen)}</span>
        </div>
        <div className="flex items-center gap-1">
          {Object.entries(MARKS).map(([k, v]) => (
            <button key={k} onClick={() => update({ mark: m.mark === k ? undefined : k })}
              className={`rounded px-2 py-0.5 ${m.mark === k ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}>{v}</button>
          ))}
          <select value={m.status || '未投'} onChange={e => update({ status: e.target.value })}
            className="rounded border border-slate-200 bg-white px-1 py-0.5 dark:border-slate-700 dark:bg-slate-900">
            {STATUS.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
    </article>
  )
}

function Filters({ f, setF, jobs, lane }) {
  const families = useMemo(() => {
    const c = {}; jobs.forEach(j => { c[j.role_family] = (c[j.role_family] || 0) + 1 }); return Object.entries(c).sort((a, b) => b[1] - a[1])
  }, [jobs])
  const cities = useMemo(() => [...new Set(jobs.map(j => j.china_city).filter(Boolean))], [jobs])
  const skills = useMemo(() => [...new Set(jobs.flatMap(j => j.skills || []))], [jobs])
  const toggle = (key, v) => setF({ ...f, [key]: f[key] === v ? null : v })
  const [more, setMore] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 640)
  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <input value={f.q} onChange={e => setF({ ...f, q: e.target.value })} placeholder="搜索公司、岗位、关键词…"
        className="w-full rounded-lg border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand dark:border-slate-700" />
      <div className="flex flex-wrap gap-1.5">
        <Chip active={!f.family} onClick={() => setF({ ...f, family: null })}>全部方向</Chip>
        {families.map(([k, n]) => <Chip key={k} active={f.family === k} onClick={() => toggle('family', k)}>{FAMILY[k] || k} {n}</Chip>)}
      </div>
      <button onClick={() => setMore(!more)} className="text-sm text-brand sm:hidden">{more ? '收起筛选 ▴' : '更多筛选 ▾'}</button>
      {more && <>
      <div className="flex flex-wrap gap-1.5">
        <Chip active={f.chinese} onClick={() => setF({ ...f, chinese: !f.chinese })}>只看华人团队/出海</Chip>
        <Chip active={f.paid} onClick={() => setF({ ...f, paid: !f.paid })}>写了薪资</Chip>
        <Chip active={f.soon} onClick={() => setF({ ...f, soon: !f.soon })}>7 天内截止</Chip>
        <Chip active={f.tierA} onClick={() => setF({ ...f, tierA: !f.tierA })}>只看甲档</Chip>
        <Chip active={f.showC} onClick={() => setF({ ...f, showC: !f.showC })}>显示丙档（融资未核实）</Chip>
        <Chip active={f.hideBig} onClick={() => setF({ ...f, hideBig: !f.hideBig })}>隐藏大厂</Chip>
        <Chip active={f.hideNo} onClick={() => setF({ ...f, hideNo: !f.hideNo })}>隐藏「不想投」</Chip>
      </div>
      {lane === 'china_onsite' && cities.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {cities.map(c => <Chip key={c} active={f.city === c} onClick={() => toggle('city', c)}>{c}</Chip>)}
        </div>
      )}
      {skills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 text-xs">
          <span className="self-center text-slate-500">按能力：</span>
          {skills.map(s => <Chip key={s} active={f.skill === s} onClick={() => toggle('skill', s)}>{s}</Chip>)}
        </div>
      )}
      </>}
    </div>
  )
}

function applyFilters(list, f, mine) {
  const q = f.q.trim().toLowerCase()
  return list.filter(j => {
    if (q && !`${j.title} ${j.company.name} ${j.company.one_liner || ''} ${j.location}`.toLowerCase().includes(q)) return false
    if (f.family && j.role_family !== f.family) return false
    if (f.chinese && !j.company.chinese_team) return false
    if (f.paid && !j.pay?.text) return false
    if (f.soon) { const d = daysUntil(j.deadline); if (d === null || d > 7) return false }
    if (f.tierA && j.company.tier !== 'A') return false
    if (!f.showC && j.company.tier === 'C') return false
    if (f.hideNo && mine[j.id]?.mark === 'no') return false
    if (f.hideBig && j.company.big_tech) return false
    if (f.city && j.china_city !== f.city && !(j.also_cities || []).includes(f.city)) return false
    if (f.skill && !(j.skills || []).includes(f.skill)) return false
    return true
  })
}

function Changes({ changes }) {
  const byDate = useMemo(() => {
    const g = {}; changes.forEach(c => { (g[c.date] ||= []).push(c) }); return Object.entries(g).slice(0, 14)
  }, [changes])
  if (!byDate.length) return <Empty text="最近还没有变动记录。" />
  return (
    <div className="space-y-4">
      {byDate.map(([d, items]) => (
        <section key={d} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h3 className="mb-2 font-semibold">{d}</h3>
          <ul className="space-y-1 text-sm">
            {items.map(c => (
              <li key={c.type + c.id} className="flex gap-2">
                <span className={c.type === 'added' ? 'text-emerald-600' : 'text-red-500'}>{c.type === 'added' ? '新增' : '下线'}</span>
                <span className="font-medium">{c.company}</span>
                {c.url ? <a className="truncate text-slate-600 hover:text-brand dark:text-slate-300" href={c.url} target="_blank" rel="noreferrer">{c.title}</a> : <span>{c.title}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function Companies({ jobs }) {
  const list = useMemo(() => {
    const m = {}
    jobs.forEach(j => { const c = (m[j.company.name] ||= { ...j.company, n: 0 }); c.n++ })
    return Object.values(m).sort((a, b) => a.tier.localeCompare(b.tier) || b.n - a.n)
  }, [jobs])
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <table className="w-full text-left text-sm">
        <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/50"><tr>
          <th className="px-3 py-2">公司</th><th className="px-3 py-2">档位</th><th className="px-3 py-2">融资</th><th className="px-3 py-2">在招实习</th><th className="hidden px-3 py-2 sm:table-cell">一句话</th>
        </tr></thead>
        <tbody>
          {list.map(c => (
            <tr key={c.name} className="border-t border-slate-100 dark:border-slate-800">
              <td className="px-3 py-2 font-medium">{c.site ? <a className="hover:text-brand" href={c.site.startsWith('http') ? c.site : `https://${c.site}`} target="_blank" rel="noreferrer">{c.name}</a> : c.name}{c.chinese_team && <span className="ml-1 text-xs text-rose-600">华人</span>}</td>
              <td className="px-3 py-2"><Badge className={TIER[c.tier].c}>{TIER[c.tier].t}</Badge></td>
              <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                {[c.funding?.round, c.funding?.amount_usd ? `${(c.funding.amount_usd / 1e6).toFixed(1)}M$` : null, c.funding?.lead].filter(Boolean).join(' · ') || '—'}
                {c.funding?.source_url && <a className="ml-1 text-brand" href={c.funding.source_url} target="_blank" rel="noreferrer">来源</a>}
              </td>
              <td className="px-3 py-2">{c.n}</td>
              <td className="hidden px-3 py-2 text-slate-500 sm:table-cell">{c.one_liner || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Mine({ mine, setMine }) {
  const rows = Object.entries(mine).filter(([, v]) => v.mark === 'want' || (v.status && v.status !== '未投'))
  if (!rows.length) return <Empty text="还没有标记岗位。在岗位卡片上点「想投」或更改投递状态，就会出现在这里。数据只保存在你自己的浏览器里。" />
  const counts = STATUS.map(s => [s, rows.filter(([, v]) => (v.status || '未投') === s).length])
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 text-sm">{counts.map(([s, n]) => <span key={s} className="rounded-lg bg-white px-3 py-1 dark:bg-slate-900">{s} <b>{n}</b></span>)}</div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-800/50"><tr><th className="px-3 py-2">公司 / 岗位</th><th className="px-3 py-2">截止</th><th className="px-3 py-2">状态</th></tr></thead>
          <tbody>
            {rows.sort((a, b) => (a[1].deadline || '9').localeCompare(b[1].deadline || '9')).map(([id, v]) => {
              const d = daysUntil(v.deadline)
              return (
                <tr key={id} className="border-t border-slate-100 dark:border-slate-800">
                  <td className="px-3 py-2"><div className="font-medium">{v.company}</div><a className="text-slate-600 hover:text-brand dark:text-slate-300" href={v.url} target="_blank" rel="noreferrer">{v.title}</a></td>
                  <td className={`px-3 py-2 ${d !== null && d <= 3 ? 'font-semibold text-red-600' : ''}`}>{v.deadline || '—'}{d !== null && d >= 0 && d <= 3 ? `（${d} 天）` : ''}</td>
                  <td className="px-3 py-2">
                    <select value={v.status || '未投'} onChange={e => setMine({ ...mine, [id]: { ...v, status: e.target.value } })}
                      className="rounded border border-slate-200 bg-white px-1 py-0.5 dark:border-slate-700 dark:bg-slate-900">{STATUS.map(s => <option key={s}>{s}</option>)}</select>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Empty({ text }) {
  return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">{text}</div>
}

const DEFAULT_F = { q: '', family: null, chinese: false, paid: false, soon: false, tierA: false, showC: true, hideNo: true, hideBig: false, city: null, skill: null }

export default function App() {
  const [data, setData] = useState(null)
  const [changes, setChanges] = useState([])
  const [err, setErr] = useState(null)
  const [tab, setTab] = useState(() => store.get('tab', 'remote'))
  const [f, setF] = useState(() => ({ ...DEFAULT_F, ...store.get('filters', {}), q: '' }))
  const [mine, setMineState] = useState(() => store.get('mine', {}))
  const setMine = (v) => { setMineState(v); store.set('mine', v) }

  useEffect(() => { store.set('tab', tab) }, [tab])
  useEffect(() => { const { q, ...rest } = f; store.set('filters', rest) }, [f])
  useEffect(() => {
    fetch('data/jobs.json', { cache: 'no-cache' }).then(r => r.json()).then(setData).catch(e => setErr(String(e)))
    fetch('data/changes.json', { cache: 'no-cache' }).then(r => r.json()).then(setChanges).catch(() => {})
  }, [])

  const live = useMemo(() => (data?.jobs || []).filter(j => j.status === 'open' || j.status === 'stale_unverified'), [data])
  const laneJobs = useMemo(() => live.filter(j => j.lane === tab), [live, tab])
  const shown = useMemo(() => applyFilters(laneJobs, f, mine), [laneJobs, f, mine])
  const s = data?.stats
  const dueSoon = Object.values(mine).filter(v => v.mark === 'want' && (v.status || '未投') === '未投' && (() => { const d = daysUntil(v.deadline); return d !== null && d >= 0 && d <= 3 })()).length

  const tabs = [
    ['remote', `远程岗位 ${s ? s.remote : ''}`], ['china_onsite', `国内线下 ${s ? s.china_onsite : ''}`],
    ['changes', '本周变动'], ['companies', '公司库'], ['mine', `我的投递${dueSoon ? ` · ${dueSoon} 个快截止` : ''}`],
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 pb-16">
      <header className="pt-8 pb-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">📡 AI 实习雷达</h1>
            <p className="mt-1 text-slate-600 dark:text-slate-400">只收录<b>有融资的 AI 公司</b>正在招的<b>非技术实习</b>，标清能不能远程、卡不卡签证。每天自动更新。</p>
            <p className="text-sm text-slate-500">AI startup internships for non-technical students · updated daily</p>
          </div>
          <div className="flex gap-2 text-sm">
            <a href={SUBMIT} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-300 px-3 py-1.5 hover:border-brand dark:border-slate-700">＋ 提交岗位</a>
            <a href={REPO} target="_blank" rel="noreferrer" className="rounded-lg bg-slate-900 px-3 py-1.5 text-white dark:bg-white dark:text-slate-900">★ GitHub</a>
          </div>
        </div>
        {s && (
          <div className="mt-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            {[['今日新增', s.added_today], ['在招岗位', s.total], ['覆盖公司', s.companies], ['近 7 天下线', s.removed_7d]].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
                <div className="text-slate-500">{k}</div><div className="text-xl font-semibold">{v}</div>
              </div>
            ))}
          </div>
        )}
        {s && <p className="mt-2 text-xs text-slate-500">最近更新：{new Date(s.updated_at).toLocaleString('zh-CN')}</p>}
      </header>

      <nav className="sticky top-0 z-10 -mx-4 mb-4 flex gap-1 overflow-x-auto bg-slate-50/90 px-4 py-2 backdrop-blur dark:bg-slate-950/90">
        {tabs.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)}
            className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${tab === k ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800'}`}>{label}</button>
        ))}
      </nav>

      {err && <Empty text={`数据加载失败：${err}`} />}
      {!data && !err && <Empty text="加载中…" />}

      {data && (tab === 'remote' || tab === 'china_onsite') && (
        <div className="space-y-4">
          {tab === 'china_onsite' && <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">国内线下岗位（上海 / 杭州 / 深圳 / 广州 / 北京），适合明年 5 月回国后投递。很多岗位会滚动招聘，可以提前关注公司。</p>}
          <Filters f={f} setF={setF} jobs={laneJobs} lane={tab} />
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>共 {shown.length} 个岗位</span>
            <button className="hover:text-brand" onClick={() => setF(DEFAULT_F)}>重置筛选</button>
          </div>
          {shown.length ? shown.map(j => <JobCard key={j.id} j={j} mine={mine} setMine={setMine} />) : <Empty text="没有符合条件的岗位，试试放宽筛选。" />}
        </div>
      )}
      {data && tab === 'changes' && <Changes changes={changes} />}
      {data && tab === 'companies' && <Companies jobs={live} />}
      {data && tab === 'mine' && <Mine mine={mine} setMine={setMine} />}

      <footer className="mt-12 border-t border-slate-200 pt-6 text-xs leading-relaxed text-slate-500 dark:border-slate-800">
        <p>✅ 事实：有公开来源　🔍 推断：根据岗位描述判断　⚠️ 未核实：需要你自己再确认。档位：甲 = 融资有公开来源；乙 = YC / 知名公司 / JD 自述；丙 = 融资未核实。</p>
        <p className="mt-1">数据来自各公司官方招聘页（Ashby、Greenhouse、Lever）、YC、Hacker News、实习僧、电鸭，以及人工核实的 Boss 直聘、LinkedIn、X、即刻等。投递前请以原链接为准。不收录无薪、Web3、只限美国身份的岗位。</p>
        <p className="mt-1">「我的投递」只保存在你的浏览器里，不会上传。<a className="text-brand" href={REPO} target="_blank" rel="noreferrer">开源仓库</a> · <a className="text-brand" href={SUBMIT} target="_blank" rel="noreferrer">提交岗位或纠错</a></p>
      </footer>
    </div>
  )
}
