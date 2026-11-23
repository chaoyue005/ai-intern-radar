"""Hacker News 最新一期 Who is hiring（Algolia 公开接口）。只保留提到 intern 的非技术帖子。"""
from __future__ import annotations

import re

import requests

from ..common import rx, criteria, strip_html

API = "https://hn.algolia.com/api/v1"


def fetch_all(log) -> list[dict]:
    hits = requests.get(f"{API}/search_by_date", params={"tags": "story,author_whoishiring",
                        "query": "Who is hiring", "hitsPerPage": 5}, timeout=20).json()["hits"]
    story = next((h for h in hits if h["title"].startswith("Ask HN: Who is hiring")), None)
    if not story:
        return []
    item = requests.get(f"{API}/items/{story['objectID']}", timeout=30).json()
    intern = rx(criteria()["intern"]["include"])
    nontech = rx("|".join(criteria()["role_families"].values()))
    out = []
    for ch in item.get("children") or []:
        text = strip_html(ch.get("text") or "")
        if not text or not intern.search(text):
            continue
        first = text.split("\n", 1)[0]
        # 帖子首行一般是「公司 | 岗位 | 地点 | Remote」
        parts = [p.strip() for p in first.split("|")]
        company = parts[0][:80] if parts else "HN"
        # 在正文中找出提到 intern 的那一行作为标题
        line = next((l for l in text.split("\n") if intern.search(l)), first)
        if not nontech.search(line):
            continue
        out.append({
            "company": company, "title": re.sub(r"\s+", " ", line)[:140],
            "apply_url": f"https://news.ycombinator.com/item?id={ch['id']}", "apply_method": "email",
            "source": "hn", "location": " | ".join(parts[1:])[:200], "description": text[:4000],
            "posted_at": (ch.get("created_at") or "")[:10] or None, "employment_type": "intern",
            "needs_review": True,
        })
    log("hn_story", story["title"])
    return out
