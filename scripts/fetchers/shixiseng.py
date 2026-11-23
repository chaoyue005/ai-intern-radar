"""实习僧：低频关键词查询。页面用自定义字体混淆数字/部分汉字，用字体 cmap 还原。

每天每个关键词只看前 N 页，请求之间有间隔；遇到异常状态码立即停止，不尝试绕过。
"""
from __future__ import annotations

import html
import io
import logging
import re
import time

import requests
from fontTools.ttLib import TTFont

from ..common import UA, criteria, rx, sources, strip_html

BASE = "https://www.shixiseng.com"
logging.getLogger("fontTools").setLevel(logging.ERROR)


class Blocked(Exception):
    pass


def _decode(s: requests.Session, text: str) -> str:
    m = re.search(r"url\((/interns/iconfonts/file\?rand=[0-9.]+)\)", text)
    mapping = {}
    if m:
        f = TTFont(io.BytesIO(s.get(BASE + m.group(1), headers=UA, timeout=20).content))
        mapping = {k: chr(int(v[3:], 16)) for k, v in f.getBestCmap().items() if v.startswith("uni")}
    text = html.unescape(text)
    return "".join(mapping.get(ord(ch), ch) for ch in text)


def _get(s: requests.Session, url: str, **kw) -> str:
    r = s.get(url, headers=UA, timeout=20, **kw)
    if r.status_code != 200 or "captcha" in r.url:
        raise Blocked(f"{r.status_code} {r.url}")
    return _decode(s, r.text)


def parse_list(t: str) -> list[tuple]:
    """按 data-intern-id 切块，每块独立用简单正则取字段（避免大正则回溯卡死）。"""
    out = []
    chunks = t.split('data-intern-id="')[1:]
    for ch in chunks:
        ch = ch[:6000]
        iid = ch[: ch.find('"')]
        def g(pat):
            m = re.search(pat, ch, re.S)
            return strip_html(m.group(1)) if m else ""
        title = g(r'class="title ellipsis font"[^>]*>([^<]*)</a>')
        pay = g(r'class="day font"[^>]*>([^<]*)</span>')
        city = g(r'class="city ellipsis"[^>]*>([^<]*)</span>')
        fonts = re.findall(r'<span class="font"[^>]*>([^<]*)</span>', ch)
        days = strip_html(fonts[0]) if len(fonts) > 0 else ""
        months = strip_html(fonts[1]) if len(fonts) > 1 else ""
        company = g(r'intern-detail__company[^>]*>\s*<p[^>]*>\s*<a title="([^"]*)"')
        if iid.startswith("inn_") and title:
            out.append((iid, title, pay, city, days, months, company))
    return out


def _field(t: str, cls: str) -> str:
    m = re.search(rf'class="{cls}[^"]*"[^>]*>(.*?)</', t, re.S)
    return strip_html(m.group(1)) if m else ""


def detail(s: requests.Session, iid: str) -> dict:
    t = _get(s, f"{BASE}/intern/{iid}")
    desc = ""
    m = re.search(r'class="job_detail"[^>]*>(.*?)</div>\s*</div>', t, re.S)
    if m:
        desc = strip_html(m.group(1))
    comp_intro = ""
    m = re.search(r'class="com-detail"[^>]*>(.*?)</div>', t, re.S)
    if m:
        comp_intro = strip_html(m.group(1))[:300]
    deadline = re.search(r"截止日期[:：]\s*(\d{4}-\d{2}-\d{2})", t)
    refresh = re.search(r'class="job_date[^"]*"[^>]*>.*?(\d{4}-\d{2}-\d{2}|\d+天前|今天|昨天)', t, re.S)
    return {
        "description": desc, "company_intro": comp_intro,
        "deadline": deadline.group(1) if deadline else None,
        "refreshed": refresh.group(1) if refresh else None,
        "offline": "已下线" in t or "职位已关闭" in t,
        "remote_flag": bool(re.search(r'class="job_good_list"[^>]*>(?:(?!</div>).)*远程', t, re.S))
        or bool(re.search(r"远程实习|全远程|线上实习|居家办公", desc)),
    }


def fetch_all(log) -> list[dict]:
    cfg = sources()["shixiseng"]
    s = requests.Session()
    ai = rx(cfg["ai_signal"])
    tech = rx(criteria()["technical"]["exclude_title"])
    seen: dict[str, dict] = {}
    try:
        for kw in cfg["keywords"]:
            for page in range(1, cfg.get("pages_per_keyword", 2) + 1):
                t = _get(s, f"{BASE}/interns", params={"keyword": kw, "city": "全国", "page": page})
                items = parse_list(t)
                for iid, title, pay, city, days, months, company in items:
                    title = strip_html(title)
                    if iid in seen or tech.search(title):
                        continue
                    seen[iid] = {"title": title, "pay_text": strip_html(pay), "city": strip_html(city),
                                 "days": strip_html(days), "months": strip_html(months),
                                 "company": strip_html(company), "kw": kw}
                time.sleep(cfg.get("delay_seconds", 2.5))
                if len(items) < 10:
                    break
        out = []
        for iid, it in list(seen.items())[: cfg.get("max_details", 150)]:
            d = detail(s, iid)
            time.sleep(cfg.get("delay_seconds", 2.5))
            if d["offline"]:
                continue
            # AI 相关性：标题/公司名/公司简介直接命中，或描述里至少出现 2 次 AI 信号
            if not ai.search(f"{it['title']} {it['company']} {d['company_intro']}") and len(ai.findall(d["description"])) < 2:
                continue
            loc = it["city"] + (" 远程" if d["remote_flag"] else "")
            out.append({
                "company": it["company"], "title": it["title"],
                "apply_url": f"{BASE}/intern/{iid}", "apply_method": "shixiseng", "source": "shixiseng",
                "location": loc, "description": d["description"], "deadline": d["deadline"],
                "pay_text": it["pay_text"], "days_text": it["days"], "months_text": it["months"],
                "posted_at": d["refreshed"] if d["refreshed"] and d["refreshed"][:2] == "20" else None,
                "employment_type": "intern", "is_remote": d["remote_flag"] or None,
                "company_meta": {"one_liner": d["company_intro"][:120], "chinese_team": True},
            })
        log("shixiseng_candidates", len(seen))
        return out
    except Blocked as e:
        log("shixiseng_blocked", str(e))
        return []
