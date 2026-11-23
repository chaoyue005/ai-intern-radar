<div align="center">

# 📡 AI 实习雷达

**专给非技术同学的 AI 初创实习清单 · 每天自动更新**

只收录 **有融资的 AI 公司** 正在招的 **非技术实习**：增长、GTM、产品营销、内容、社媒、社区、运营、BD、AI 产品……
每一条都标清楚：**能不能远程、卡不卡签证、公司融资靠不靠谱**。

[**👉 打开网站**](https://chaoyue005.github.io/ai-intern-radar/) · [提交岗位](https://github.com/chaoyue005/ai-intern-radar/issues/new?template=submit-job.yml) · [English](#english)

![每日更新](https://img.shields.io/github/actions/workflow/status/chaoyue005/ai-intern-radar/daily.yml?label=每日更新)
![最近提交](https://img.shields.io/github/last-commit/chaoyue005/ai-intern-radar?label=最近更新)

</div>

---

## 为什么做这个

我是一名商科学生，在找 AI 公司的非技术实习。实际找起来发现：

- 岗位**分散在十几个渠道**：公司官网、YC、实习僧、Boss、LinkedIn、X、即刻、小红书……
- 现有的实习清单**几乎全是美国技术岗**，非技术岗被淹没。
- 写着 Remote 的岗位，很多其实是 *Remote (US only)*；还有大量**过期、僵尸岗**。
- 看不出公司**有没有融资、靠不靠谱**。

所以我做了这个雷达：程序每天抓取官方招聘页，人工+AI 双重筛选，只留下**真正能投**的岗位。

## 收录标准

| ✅ 收录 | ❌ 不收录 |
|---|---|
| 有融资的 AI 公司（或已上市 / 大厂 AI 部门） | 无薪、只给实习证明 |
| 明确标注 intern / 实习 | 全职、Manager、技术岗（工程、算法、研究） |
| 非技术岗位（见下方 15 类） | Web3 / 加密项目 |
| 可远程且不限美国身份；或国内线下（沪杭深广京） | 只限美国身份、指定海外线下、只收 MBA |

**15 类岗位**：增长 · GTM/商业化 · 产品营销 · 市场/品牌 · 内容 · 社媒/KOL · 社区 · 产品/用户运营 · AI 产品经理 · BD/合作 · 战略/市场情报 · Founder's Office · 用户研究 · HR/招聘 · 半技术（AI 训练师、DevRel，单独标注）

**公司档位**：甲 = 融资有公开来源；乙 = YC / 知名公司 / JD 自述；丙 = 融资未核实（照常展示，排在后面）。

## 数据从哪里来

| 方式 | 渠道 | 频率 |
|---|---|---|
| 程序自动抓取 | Ashby / Greenhouse / Lever 等官方招聘接口、YC Work at a Startup、Hacker News「Who is hiring」、实习僧、电鸭社区、融资新闻 RSS | 每天 08:00（北京时间） |
| 浏览器人工巡检 | Boss 直聘、LinkedIn、X、JobsDB、即刻、牛客、Wellfound、脉脉、小红书 | 每天，人工审核后收录 |
| 社区投稿 | 任何人都可以 [提交岗位](https://github.com/chaoyue005/ai-intern-radar/issues/new?template=submit-job.yml) | 审核后收录 |

每天还会自动：重新核实远程/签证条件、标记超过 60 天未核实的岗位、隐藏超过 180 天的僵尸岗、生成「本周新增 / 下线」列表。

## 网站功能

- **远程岗位 / 国内线下** 两个列表，按「可远程不卡签证 > 华人出海公司 > 档位 > 截止日 > 新鲜度」排序
- 按岗位方向、档位、薪资、截止日、核心能力筛选
- 每张卡片：公司一句话介绍、融资、3 条职责、3 条要求、是否要作品集
- 事实 ✅ / 推断 🔍 / 未核实 ⚠️ 三种标签
- 「我的投递」：标记想投、记录状态、截止前 3 天提醒（只存在你的浏览器里）

## 怎么参与

- ⭐ **Star 一下**，让更多同学看到
- 看到好岗位 → [提交岗位](https://github.com/chaoyue005/ai-intern-radar/issues/new?template=submit-job.yml)
- 发现信息不对 → 开 Issue 告诉我
- 想加一个渠道或公司 → 修改 `data/companies.yaml` 提 PR

## 技术实现

```
GitHub Actions（每天定时）
  └─ scripts/pipeline.py
       ├─ fetchers/   各渠道抓取（官方公开接口优先，低频，遵守 robots，不绕过登录）
       ├─ common.py   规则分类：实习识别 / 技术岗排除 / 远程 & 签证判断
       ├─ enrich.py   Claude 生成中文摘要（职责、要求、核心能力），带缓存
       └─ 输出 data/jobs.json → web/（React + Tailwind 静态网站）→ GitHub Pages
```

- 规则集中在 [`config/criteria.yaml`](config/criteria.yaml)，渠道在 [`config/sources.yaml`](config/sources.yaml)
- 过滤逻辑有单元测试：`python -m unittest discover tests`
- 本地运行：`pip install -r requirements.txt && python -m scripts.pipeline --no-enrich`

---

## English

**AI Intern Radar** is a daily-updated list of **non-technical internships** (growth, GTM, product marketing, content, community, ops, BD, AI PM…) at **funded AI startups**, built for students who can't code but want to work in AI.

Every listing says whether it's **truly remote**, whether it **requires US work authorization**, and how **verifiable the company's funding** is. Data comes from official ATS boards (Ashby, Greenhouse, Lever), YC, Hacker News, Chinese platforms (Shixiseng, Boss Zhipin), and human-reviewed posts from LinkedIn and X. Unpaid, Web3, full-time and engineering roles are excluded.

[Open the site](https://chaoyue005.github.io/ai-intern-radar/) · [Submit a role](https://github.com/chaoyue005/ai-intern-radar/issues/new?template=submit-job.yml)

## License

代码：MIT。岗位信息版权归各公司所有，本项目只做索引并链接到原始页面。
