# 每日 Chrome 巡检说明（给 Claude 定时任务用）

> 这份文件是定时任务的说明书。每天北京时间 09:00，Claude 桌面版按这里的步骤，在**你已经登录的 Chrome**里巡检登录类渠道，把候选岗位交给你审核。

## 规则（必须遵守）
1. **只访问下面列出的渠道和关键词**，不点开与岗位无关的页面（省 token）。
2. 列表页先看标题：标题里没有「实习 / intern」或者明显是技术岗（工程师、算法、开发、研发、测试），**不点开**。
3. 每个渠道每天最多点开 **8 条**详情；整次巡检最多 **50 条**。
4. 遇到验证码、登录弹窗、「访问异常」提示：**立即停止这个渠道**，在报告里注明，不尝试绕过。
5. 只读不写：不投递、不发消息、不点赞、不关注、不改任何账号设置。
6. 候选必须满足：AI 公司 + 非技术实习 + 有薪 + （可远程，或者在上海 / 杭州 / 深圳 / 广州 / 北京）。不要 Web3、不要全职。

## 渠道和关键词
关键词在 `config/sources.yaml` 的 `patrol` 部分，可以随时改。

| 渠道 | 怎么搜 |
|---|---|
| Boss 直聘 zhipin.com | 每个关键词搜一次；城市依次选「全国」和 `boss_cities` 里的城市（只看第一页） |
| LinkedIn Jobs | 关键词 + 筛选 Experience level = Internship；再筛一次 Remote |
| X / Twitter | 用 `x` 里的搜索式，切到「最新」，只看最近 3 天 |
| JobsDB 香港 hk.jobsdb.com | `jobsdb` 关键词 |
| 即刻 web.okjike.com | `jike` 关键词，看最近 7 天 |
| 牛客 nowcoder.com | `nowcoder` 关键词，实习板块 |
| Wellfound wellfound.com | `wellfound` 关键词，Job type = Internship |
| 脉脉 maimai.cn | `maimai` 关键词，只看招聘帖 |
| 小红书网页版 xiaohongshu.com（不登录） | `xiaohongshu` 关键词；出现登录弹窗就跳过 |

## 各渠道已知情况（2026-11-23 实测）
- **Boss 直聘**：打开搜索链接 `https://www.zhipin.com/web/geek/job?query=关键词&city=100010000`（全国；上海 101020100、杭州 101210100、深圳 101280600、广州 101280100、北京 101010100）。先出现「请稍候」页面是正常的，等 5 秒会自动进入结果，不是验证码。用 `get_page_text` 读列表即可（列表里包含公司、天数/周、月数、地点），只对候选岗位点开详情拿 JD。列表页的薪资数字被字体隐藏，显示为「-元/天」，要从详情页取，取不到就留空。
- 用 `get_page_text` 读文字，不要截图（省 token）。

## 输出
1. 把候选写进 `patrol/inbox/YYYY-MM-DD.json`（今天日期），格式是数组，每条：
   ```json
   {"company": "", "title": "", "apply_url": "", "source": "boss|linkedin|x|jobsdb|jike|nowcoder|wellfound|maimai|xiaohongshu",
    "location": "", "pay_text": "", "deadline": "", "description": "JD 原文（尽量完整）", "note": "为什么值得收录 / 有什么疑点"}
   ```
2. 先运行 `.venv/bin/python -m scripts.inbox patrol/inbox/今天.json --check`，它会按网站同样的规则预筛，并标出已经收录过的。
3. 在对话里给用户看一张**编号清单**（公司、岗位、地点、薪资、来源、疑点），问：「哪些收录？」
4. 用户回复后运行 `.venv/bin/python -m scripts.inbox patrol/inbox/今天.json --approve 1,3,4`（或 `--approve all`）。
5. `git add data/manual_jobs.yaml patrol/inbox && git commit -m "巡检收录 今天日期" && git push`。推送后网站会在几分钟内自动更新。
6. 最后一句话汇报：每个渠道看了几条、收录几条、哪些渠道被拦。
