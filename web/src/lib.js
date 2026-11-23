export const REPO = 'https://github.com/chaoyue005/ai-intern-radar'
export const SUBMIT = `${REPO}/issues/new?template=submit-job.yml`
export const GOAL = 30

export const FAMILY = {
  growth: '增长', gtm: 'GTM', pmm: '产品营销', marketing: '市场品牌', content: '内容',
  social: '社媒 KOL', community: '社区', pm: 'AI 产品', ops: '运营', bd: 'BD 合作',
  strategy: '战略研究', founders_office: "Founder's Office", ux_research: '用户研究', hr: 'HR 招聘',
  semi_tech: '半技术', other: '其他',
}

export const TIER = {
  A: { label: '融资已核实', cls: 'text-mint border-mint/30 bg-mint/10' },
  B: { label: 'YC / 知名', cls: 'text-sky-300 border-sky-400/30 bg-sky-400/10' },
  C: { label: '融资待核实', cls: 'text-ink-300 border-ink-600 bg-ink-800' },
}

export function tierLabel(c) {
  const st = c.funding?.status
  if (c.tier === 'A') return { label: st === 'public' ? '已上市' : '融资已核实', cls: TIER.A.cls }
  if (st === 'yc_only') return { label: 'YC 投资', cls: 'text-orange-300 border-orange-400/30 bg-orange-400/10' }
  if (st === 'self_reported') return { label: '融资为公司自述', cls: TIER.B.cls }
  if (c.big_tech) return { label: '大厂', cls: TIER.C.cls }
  if (c.tier === 'B') return { label: '知名公司 · 融资待补来源', cls: TIER.B.cls }
  return { label: '融资待核实', cls: TIER.C.cls }
}

export const STATUS = ['想投', '已投', '笔试/作业', '面试中', 'Offer', '被拒']

export const SOURCE = {
  ashby: '官网 Ashby', greenhouse: '官网 Greenhouse', lever: '官网 Lever', yc: 'YC', hn: 'Hacker News',
  shixiseng: '实习僧', eleduck: '电鸭', boss: 'Boss 直聘', linkedin: 'LinkedIn', x: 'X', seed: '人工核实',
  submission: '投稿', jobsdb: 'JobsDB', jike: '即刻', nowcoder: '牛客', wellfound: 'Wellfound', maimai: '脉脉',
  xiaohongshu: '小红书', workable: '官网 Workable',
}

export const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d } catch { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* 隐私模式 */ } },
}

export function daysSince(s) {
  if (!s) return null
  return Math.max(0, Math.floor((Date.now() - new Date(s + 'T00:00:00').getTime()) / 86400000))
}

export function daysUntil(s) {
  if (!s) return null
  return Math.ceil((new Date(s + 'T23:59:59').getTime() - Date.now()) / 86400000)
}

export function fresh(j) {
  const d = daysSince(j.posted_at || j.first_seen)
  if (d === null) return { text: '新收录', cls: 'text-mint' }
  if (d === 0) return { text: '今天', cls: 'text-mint' }
  if (d <= 7) return { text: `${d} 天前`, cls: 'text-mint' }
  if (d <= 30) return { text: `${d} 天前`, cls: 'text-ink-300' }
  return { text: `${Math.floor(d / 30)} 个月前 · 今日核实在招`, cls: 'text-amber' }
}

export function money(f) {
  if (!f?.amount_usd) return ''
  const m = f.amount_usd / 1e6
  return m >= 1000 ? `$${(m / 1000).toFixed(1)}B` : `$${m >= 10 ? Math.round(m) : m.toFixed(1)}M`
}

export function siteUrl(site) {
  if (!site) return null
  return site.startsWith('http') ? site : `https://${site}`
}

export function domainOf(site) {
  if (!site) return null
  try { return new URL(siteUrl(site)).hostname.replace(/^www\./, '') } catch { return null }
}

export function groupCompanies(jobs) {
  const m = new Map()
  for (const j of jobs) {
    const k = j.company.name
    if (!m.has(k)) m.set(k, { ...j.company, jobs: [], score: 0, newest: 99999 })
    const c = m.get(k)
    c.jobs.push(j)
    c.score = Math.max(c.score, j.score)
    c.newest = Math.min(c.newest, daysSince(j.posted_at || j.first_seen) ?? 99999)
    c.remote = c.remote || j.lane === 'remote'
  }
  return [...m.values()]
}
