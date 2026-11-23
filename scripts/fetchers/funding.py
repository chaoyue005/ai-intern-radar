"""融资新闻 RSS：发现「刚融资的 AI 公司」，写入待审核的公司线索（不直接入库）。"""
from __future__ import annotations

import feedparser
import requests

from ..common import UA, rx, sources, strip_html


def fetch_all(log) -> list[dict]:
    cfg = sources()["funding_rss"]
    fund, ai = rx(cfg["funding_signal"]), rx(cfg["ai_signal"])
    leads = []
    for url in cfg["feeds"]:
        try:
            r = requests.get(url, headers=UA, timeout=20)
            feed = feedparser.parse(r.content)
        except Exception as e:
            log("funding_error", f"{url}: {e}")
            continue
        for e in feed.entries[:60]:
            text = f"{e.get('title','')} {strip_html(e.get('summary',''))[:600]}"
            if fund.search(text) and ai.search(text):
                leads.append({"title": e.get("title"), "url": e.get("link"),
                              "published": (e.get("published") or "")[:25], "source": url})
    return leads
