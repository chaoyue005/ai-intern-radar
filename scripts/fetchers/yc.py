"""YC：hiring.json 公司列表 → 每家公司岗位页（data-page JSON）→ 只保留实习岗，再读详情。"""
from __future__ import annotations

import concurrent.futures as cf
import html
import json
import re

import requests

from ..common import UA, criteria, rx, sources, strip_html

HIRING = "https://yc-oss.github.io/api/companies/hiring.json"
AI_TAG = re.compile(r"\bAI\b|artificial intelligence|generative|machine learning|LLM|AI Assistant|AIOps|Conversational", re.I)


def _page_props(url: str) -> dict | None:
    t = requests.get(url, headers=UA, timeout=20).text
    m = re.search(r'data-page="([^"]*)"', t)
    return json.loads(html.unescape(m.group(1)))["props"] if m else None


def fetch_all(log) -> list[dict]:
    cfg = sources()["yc"]
    comps = requests.get(HIRING, timeout=30).json()
    if cfg.get("only_ai"):
        comps = [c for c in comps if AI_TAG.search(" ".join(c.get("tags", []) + c.get("industries", []) + [c.get("one_liner") or ""]))]
    comps = comps[: cfg.get("max_companies", 900)]
    intern_rx = rx(criteria()["intern"]["include"])

    def company_jobs(c):
        try:
            p = _page_props(f"https://www.ycombinator.com/companies/{c['slug']}/jobs")
        except Exception as e:
            log("yc_error", f"{c['slug']}: {e}")
            return []
        if not p:
            return []
        out = []
        for j in p.get("jobPostings") or []:
            if (j.get("type") or "").lower() != "internship" and not intern_rx.search(j.get("title") or ""):
                continue
            if j.get("role") == "eng":  # YC 自带岗位类型，工程岗直接跳过
                continue
            url = "https://www.ycombinator.com" + j["url"]
            desc = ""
            try:
                jp = _page_props(url) or {}
                job = jp.get("job") or {}
                desc = strip_html(job.get("description") or "")
            except Exception:
                pass
            out.append({
                "company": c["name"], "title": j.get("title"), "apply_url": url, "apply_method": "yc",
                "source": "yc", "location": j.get("location") or "", "description": desc,
                "visa": j.get("visa") or "", "pay_text": j.get("salaryRange") or "",
                "posted_ago": j.get("createdAt"), "employment_type": "intern",
                "company_meta": {"site": c.get("website"), "one_liner": c.get("one_liner"),
                                  "batch": c.get("batch"), "team_size": c.get("team_size"),
                                  "funding": {"status": "yc_only", "round": f"YC {c.get('batch','')}"}},
            })
        return out

    jobs: list[dict] = []
    with cf.ThreadPoolExecutor(8) as ex:
        for res in ex.map(company_jobs, comps):
            jobs.extend(res)
    log("yc_companies", len(comps))
    return jobs
