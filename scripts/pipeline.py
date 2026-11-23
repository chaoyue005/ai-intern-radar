"""每日流水线：抓取 → 规则分类 → AI 摘要 → 合并历史 → 新鲜度 → 排序 → 输出 data/*.json

用法：
  python -m scripts.pipeline                 # 全部渠道
  python -m scripts.pipeline --only ats,yc   # 只跑部分渠道
  python -m scripts.pipeline --no-enrich     # 不调用 Claude
"""
from __future__ import annotations

import argparse
import re
import time
from datetime import date, datetime, timedelta, timezone

import yaml

from .common import (DATA, classify, company_index, criteria, dump_json, job_id, load_json,
                     norm_company, now_iso, sources, today)
from .enrich import enrich
from .fetchers import ats, eleduck, funding, hn, shixiseng, yc

FETCHERS = {"ats": ats, "yc": yc, "hn": hn, "shixiseng": shixiseng, "eleduck": eleduck}
JOBS = DATA / "jobs.json"
CHANGES = DATA / "changes.json"
REJECTED = DATA / "rejected.json"
LEADS = DATA / "funding_leads.json"
RUNLOG = DATA / "run_log.json"
REVIEW = DATA / "review_queue.json"

TIER_BY_STATUS = {"verified": "A", "public": "A", "yc_only": "B", "self_reported": "B"}


class Log:
    def __init__(self):
        self.items = []

    def __call__(self, key, value):
        print(f"[{key}] {value}", flush=True)
        self.items.append({"key": key, "value": value})


def _parse_date(s):
    if not s:
        return None
    try:
        return date.fromisoformat(str(s)[:10])
    except ValueError:
        return None


def _ago_to_date(s: str | None):
    """YC 的 createdAt 是「2 months」这种相对时间。"""
    if not s:
        return None
    m = re.match(r"(?:about |over |almost )?(\d+|a|an) (day|week|month|year)", s)
    if not m:
        return None
    n = 1 if m.group(1) in ("a", "an") else int(m.group(1))
    days = {"day": 1, "week": 7, "month": 30, "year": 365}[m.group(2)] * n
    return date.today() - timedelta(days=days)


def _pay(job: dict) -> dict:
    t = job.get("pay_text") or ""
    nums = [float(x.replace(",", "")) for x in re.findall(r"\d[\d,]*\.?\d*", t)]
    if not nums:
        return {"text": t or None}
    cur = "CNY" if re.search(r"元|/天|¥|RMB", t) and "$" not in t else ("USD" if "$" in t else "")
    unit = "day" if re.search(r"天|day", t, re.I) else ("hour" if re.search(r"hr|hour|小时", t, re.I) else
            ("month" if re.search(r"月|month", t, re.I) else ("year" if re.search(r"K|year", t) else "")))
    mult = 1000 if re.search(r"\dK", t) else 1
    return {"text": t, "min": nums[0] * mult, "max": (nums[1] if len(nums) > 1 else nums[0]) * mult,
            "currency": cur, "unit": unit}


def _company(job: dict, idx: dict) -> dict:
    c = idx.get(norm_company(job["company"]))
    meta = job.get("company_meta") or {}
    if c is None:
        c = {"name": job["company"], "site": meta.get("site"),
             "funding": meta.get("funding") or {"status": "unverified"},
             "chinese_team": meta.get("chinese_team", False)}
    funding = dict(c.get("funding") or {"status": "unverified"})
    status = funding.get("status", "unverified")
    if status == "verified" and not funding.get("source_url"):
        funding["needs_source"] = True
    tier = TIER_BY_STATUS.get(status) or ("B" if c.get("notable") or c.get("big_tech") else "C")
    return {
        "name": c["name"], "site": c.get("site") or meta.get("site"),
        "one_liner": c.get("one_liner_zh") or meta.get("one_liner"),
        "chinese_team": bool(c.get("chinese_team")), "funding": funding, "tier": tier,
        "big_tech": bool(c.get("big_tech")), "blocked": c.get("blocked"), "batch": meta.get("batch"), "team_size": meta.get("team_size"),
    }


def _lane(cls: dict) -> str | None:
    if cls["remote"] == "remote_ok" and cls["work_auth"] != "us_only":
        return "remote"
    if cls["china_city"]:
        return "china_onsite"
    return None


def _apply_ai(job: dict, cls: dict) -> None:
    """AI 摘要可以纠正规则判断，但只往更严格的方向纠正（除远程以外）。"""
    ai = job.get("ai")
    if not ai:
        return
    if not ai.get("is_nontech_intern", True):
        cls["reasons"].append("ai_says_technical_or_not_intern")
    if ai.get("us_work_auth_required"):
        cls["work_auth"] = "us_only"
        if not cls["china_city"]:
            cls["reasons"].append("us_only")
    if ai.get("remote") == "region_limited" and cls["remote"] == "remote_ok":
        cls["remote"] = "region_limited"
    elif ai.get("remote") == "remote_ok" and cls["remote"] in ("unknown",):
        cls["remote"] = "remote_ok"
    if ai.get("is_paid") is False and re.search(r"unpaid|无薪|实习证明", job.get("description") or "", re.I):
        cls["reasons"].append("unpaid")
    cls["reasons"] = sorted(set(cls["reasons"]))
    cls["keep"] = not cls["reasons"]


def freshness_status(posted_at, first_seen, deadline, last_verified_at) -> str:
    """过截止日 → closed；超过 180 天 → zombie；超过 60 天且今天没核实 → stale_unverified。"""
    fc = criteria()["freshness"]
    ref = _parse_date(posted_at) or _parse_date(first_seen)
    age = (date.today() - ref).days if ref else 0
    dl = _parse_date(deadline)
    if dl and dl < date.today():
        return "closed"
    if age > fc["zombie_days"]:
        return "zombie"
    if age > fc["stale_days"] and str(last_verified_at) != today():
        return "stale_unverified"
    return "open"


def _score(j: dict) -> float:
    w = criteria()["ranking"]
    s = 0.0
    if j["lane"] == "remote":
        s += w["remote_no_visa"]
    if j["company"]["chinese_team"] and not j["company"].get("big_tech"):
        s += w["chinese_team"]
    if j["company"].get("big_tech"):
        s -= w.get("big_tech_penalty", 25)
    s += w["tier"].get(j["company"]["tier"], 0)
    dl = _parse_date(j.get("deadline"))
    if dl and 0 <= (dl - date.today()).days <= 14:
        s += w["deadline_within_14d"]
    if j["pay"].get("min"):
        s += w["has_pay"]
    seen = _parse_date(j.get("posted_at") or j.get("first_seen"))
    if seen:
        s += max(0, 30 - (date.today() - seen).days) / 3
    return round(s, 1)


def build(raw: list[dict], fetched_sources: set[str], log: Log, do_enrich: bool) -> None:
    idx = company_index()
    prev = {j["id"]: j for j in load_json(JOBS, {}).get("jobs", [])}
    manual = yaml.safe_load((DATA / "manual_jobs.yaml").read_text(encoding="utf-8")) or []
    for m in manual:
        m.setdefault("apply_method", "ats")
        m["manual"] = True
    all_raw = manual + raw

    # 去重：同一投递链接只保留一条（人工条目优先）
    seen_urls, uniq = set(), []
    for j in all_raw:
        u = (j.get("apply_url") or "").split("?")[0].rstrip("/")
        if u in seen_urls:
            continue
        seen_urls.add(u)
        uniq.append(j)

    # 先用规则粗筛，只有可能保留的才交给 Claude（省钱）
    staged, rejected = [], []
    for j in uniq:
        if j.get("status") == "closed":
            continue
        cls = classify(j)
        comp = _company(j, idx)
        if comp["blocked"]:
            cls["reasons"].append("blocked_company")
            cls["keep"] = False
        soft = {"overseas_onsite", "region_limited"}  # 这两项可能被 AI 改判
        if cls["keep"] or set(cls["reasons"]) <= soft:
            staged.append((j, cls, comp))
        else:
            rejected.append({"company": j["company"], "title": j["title"], "url": j.get("apply_url"),
                             "source": j.get("source"), "reasons": cls["reasons"]})

    if do_enrich:
        enrich([s[0] for s in staged], log)

    out = []
    for j, cls, comp in staged:
        _apply_ai(j, cls)
        lane = _lane(cls)
        if cls["keep"] and lane is None:
            cls["reasons"].append("no_lane")
            cls["keep"] = False
        if not cls["keep"]:
            rejected.append({"company": j["company"], "title": j["title"], "url": j.get("apply_url"),
                             "source": j.get("source"), "reasons": cls["reasons"]})
            continue
        ai = j.get("ai") or {}
        jid = job_id(comp["name"], j["title"], j.get("apply_url", ""))
        old = prev.get(jid, {})
        posted = j.get("posted_at") or (_ago_to_date(j.get("posted_ago")) or None)
        rec = {
            "id": jid, "title": j["title"], "apply_url": j.get("apply_url"),
            "apply_method": j.get("apply_method", "ats"), "source": j.get("source"),
            "location": j.get("location", ""), "lane": lane, "china_city": cls["china_city"],
            "remote": cls["remote"], "work_auth": cls["work_auth"],
            "role_family": cls["role_family"], "semi_technical": cls["semi_technical"],
            "company": {**comp, "one_liner": ai.get("one_liner_zh") or comp["one_liner"]},
            "posted_at": str(posted) if posted else None,
            "deadline": str(j["deadline"]) if j.get("deadline") else None,
            "first_seen": old.get("first_seen") or today(),
            "last_verified_at": today() if j.get("source") in fetched_sources
            else str(j.get("verified_at") or old.get("last_verified_at") or today()),
            "pay": _pay(j), "days_text": j.get("days_text"), "months_text": j.get("months_text"),
            "days_per_week": ai.get("days_per_week"), "duration_months": ai.get("duration_months"),
            "duties_zh": ai.get("duties_zh") or [], "requirements_zh": ai.get("requirements_zh") or [],
            "skills": ai.get("skills") or [], "portfolio_required": ai.get("portfolio_required", False),
            "grad_year_limit": ai.get("grad_year_limit") or "",
            "needs_review": bool(j.get("needs_review")),
            "labels": {
                "fact": [x for x in ["融资有公开来源" if comp["tier"] == "A" else None,
                                     "官方招聘页" if j.get("source") in ("ashby", "greenhouse", "lever", "yc") else None] if x],
                "inferred": ["远程/签证由描述推断"] if cls["remote"] == "remote_ok" and not j.get("manual") else [],
                "unverified": [x for x in ["融资未核实" if comp["tier"] == "C" else None,
                                           "社区帖子，需人工核实" if j.get("needs_review") else None] if x],
            },
        }
        rec["status"] = freshness_status(rec["posted_at"], rec["first_seen"], rec["deadline"], rec["last_verified_at"])
        rec["score"] = _score(rec)
        out.append(rec)

    # 变更：上次在、这次不在（且该渠道这次成功抓取了）→ 下线
    now_ids = {r["id"] for r in out if r["status"] == "open"}
    changes = load_json(CHANGES, [])
    for pid, p in prev.items():
        if p.get("status") == "open" and pid not in now_ids and (p.get("source") in fetched_sources or p.get("source") == "seed"):
            changes.append({"date": today(), "type": "removed", "id": pid, "company": p["company"]["name"],
                            "title": p["title"], "url": p.get("apply_url")})
    for r in out:
        if r["id"] not in prev and r["status"] == "open":
            changes.append({"date": today(), "type": "added", "id": r["id"], "company": r["company"]["name"],
                            "title": r["title"], "url": r.get("apply_url")})
    # 同一天同一条只保留一次；只保留最近 30 天
    cutoff = str(date.today() - timedelta(days=30))
    dedup = {(c["date"], c["type"], c["id"]): c for c in changes if c["date"] >= cutoff}
    changes = sorted(dedup.values(), key=lambda c: c["date"], reverse=True)

    # 同公司、同岗位名（去掉括号里的城市/编号）在多个城市发布 → 合并成一条
    merged, by_key = [], {}
    for r in sorted(out, key=lambda r: -r["score"]):
        k = (r["company"]["name"], r["lane"], re.sub(r"[（(【\[].*?[)）】\]]", "", r["title"]).strip().lower())
        if k in by_key:
            other = by_key[k]
            if r["china_city"] and r["china_city"] not in other.setdefault("also_cities", []) and r["china_city"] != other["china_city"]:
                other["also_cities"].append(r["china_city"])
            continue
        by_key[k] = r
        merged.append(r)
    out = merged
    out.sort(key=lambda r: (-r["score"], r["company"]["name"]))
    visible = [r for r in out if r["status"] in ("open", "stale_unverified")]
    stats = {
        "updated_at": now_iso(), "total": len(visible),
        "remote": sum(r["lane"] == "remote" for r in visible),
        "china_onsite": sum(r["lane"] == "china_onsite" for r in visible),
        "added_today": sum(1 for c in changes if c["date"] == today() and c["type"] == "added"),
        "removed_7d": sum(1 for c in changes if c["type"] == "removed" and c["date"] >= str(date.today() - timedelta(days=7))),
        "companies": len({r["company"]["name"] for r in visible}),
        "sources": sorted(fetched_sources),
    }
    dump_json(JOBS, {"stats": stats, "jobs": out})
    dump_json(CHANGES, changes)
    dump_json(REJECTED, rejected[:3000])
    log("stats", stats)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--no-enrich", action="store_true")
    args = ap.parse_args()
    log = Log()
    only = set(filter(None, args.only.split(",")))
    raw, fetched = [], set()
    t0 = time.time()
    for name, mod in FETCHERS.items():
        cache = DATA / "raw" / f"{name}.json"
        if (only and name not in only) or not sources().get(name, {}).get("enabled", True):
            # 本次不抓这个渠道：沿用上次的抓取结果（不算「已核实」，也不会因此判定下线）
            raw.extend(load_json(cache, []))
            continue
        try:
            got = mod.fetch_all(log)
            if not got and load_json(cache, []):
                # 抓到 0 条但上次有数据：大概率是被拦或改版，沿用旧数据，交给 health 报警
                log(f"{name}_failed", "本次抓到 0 条，已沿用上次数据")
                raw.extend(load_json(cache, []))
                continue
            dump_json(cache, got)
            raw.extend(got)
            # 「本次成功抓取的来源」用于判断岗位是否下线
            fetched |= ({"ashby", "greenhouse", "lever", "workable", "smartrecruiters", "recruitee"} if name == "ats" else {name})
            log(f"{name}_raw", len(got))
        except Exception as e:
            log(f"{name}_failed", str(e)[:300])
    if not only or "funding" in only:
        try:
            leads = funding.fetch_all(log)
            old = {l["url"]: l for l in load_json(LEADS, [])}
            for l in leads:
                old.setdefault(l["url"], {**l, "first_seen": today()})
            dump_json(LEADS, sorted(old.values(), key=lambda l: l["first_seen"], reverse=True)[:300])
            log("funding_leads", len(leads))
        except Exception as e:
            log("funding_failed", str(e)[:300])
    build(raw, fetched, log, do_enrich=not args.no_enrich)
    log("seconds", round(time.time() - t0))
    dump_json(RUNLOG, {"at": now_iso(), "items": log.items})


if __name__ == "__main__":
    main()
