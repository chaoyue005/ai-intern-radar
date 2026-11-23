"""电鸭社区（远程工作）。只看招聘分类，保留提到实习且与 AI 相关的帖子。"""
from __future__ import annotations

import requests

from ..common import UA, criteria, rx, sources, strip_html

API = "https://svc.eleduck.com/api/v1/posts"


def _poster(p: dict) -> str:
    name = (p.get("user") or {}).get("nickname") or ""
    # 手机号掩码之类的昵称没有意义
    return name if name and "*" not in name and not name.isdigit() else "电鸭社区帖子"


def fetch_all(log) -> list[dict]:
    cfg = sources()["eleduck"]
    intern = rx(criteria()["intern"]["include"] + r"|在校|大学生|应届")
    ai = rx(sources()["shixiseng"]["ai_signal"])
    tech = rx(criteria()["technical"]["exclude_title"])
    out = []
    for page in range(1, cfg.get("pages", 3) + 1):
        r = requests.get(API, params={"category": 5, "page": page}, headers=UA, timeout=20)
        if r.status_code != 200:
            log("eleduck_error", r.status_code)
            break
        for p in r.json().get("posts", []):
            title = p.get("full_title") or p.get("title") or ""
            summary = strip_html(p.get("summary") or "")
            if not intern.search(f"{title} {summary}") or not ai.search(f"{title} {summary}") or tech.search(title):
                continue
            out.append({
                "company": _poster(p), "title": title,
                "apply_url": f"https://eleduck.com/posts/{p['id']}", "apply_method": "eleduck",
                "source": "eleduck", "location": "远程", "is_remote": True, "description": summary,
                "posted_at": (p.get("published_at") or p.get("created_at") or "")[:10] or None,
                "employment_type": "intern", "needs_review": True,
            })
    return out
