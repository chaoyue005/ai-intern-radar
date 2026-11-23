"""共享工具：读配置、文本清洗、规则分类。"""
from __future__ import annotations

import hashlib
import html
import json
import re
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
CONFIG = ROOT / "config"
DATA = ROOT / "data"

UA = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/131.0 Safari/537.36"
}


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


@lru_cache
def criteria() -> dict:
    return yaml.safe_load((CONFIG / "criteria.yaml").read_text(encoding="utf-8"))


@lru_cache
def sources() -> dict:
    return yaml.safe_load((CONFIG / "sources.yaml").read_text(encoding="utf-8"))


def companies() -> list[dict]:
    return yaml.safe_load((DATA / "companies.yaml").read_text(encoding="utf-8")) or []


@lru_cache(maxsize=512)
def rx(pattern: str) -> re.Pattern:
    return re.compile(pattern, re.I)


def strip_html(s: str | None) -> str:
    if not s:
        return ""
    s = html.unescape(s)
    s = re.sub(r"<(br|/p|/li|/h\d)[^>]*>", "\n", s, flags=re.I)
    s = re.sub(r"<li[^>]*>", "• ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", " ", s)
    s = html.unescape(s)
    s = re.sub(r"[ \t\xa0]+", " ", s)
    s = re.sub(r"\n\s*\n+", "\n", s)
    return s.strip()


def job_id(company: str, title: str, url: str) -> str:
    return hashlib.sha1(f"{company}|{title}|{url}".lower().encode()).hexdigest()[:12]


def norm_company(name: str) -> str:
    return re.sub(r"[\s\.\-（）()·,]+", "", (name or "").lower())


def company_index() -> dict[str, dict]:
    idx = {}
    for c in companies():
        for n in [c["name"], *(c.get("aliases") or [])]:
            idx[norm_company(n)] = c
        if c.get("ats"):
            idx[norm_company(c["ats"]["slug"])] = c
    return idx


# ---------------- 规则分类 ----------------

def classify(job: dict) -> dict:
    """返回分类结果：keep(bool)、reasons(排除原因)、role_family、remote、work_auth 等。"""
    c = criteria()
    title = job.get("title") or ""
    desc = job.get("description") or ""
    loc = job.get("location") or ""
    blob = f"{title}\n{loc}\n{desc}"
    head = f"{title}\n{loc}\n{desc[:1500]}"
    reasons: list[str] = []

    is_intern = bool(rx(c["intern"]["include"]).search(title)) or (job.get("employment_type") == "intern")
    if not is_intern:
        reasons.append("not_intern")
    if rx(c["intern"]["exclude_title"]).search(title) and not rx(r"intern|实习").search(title):
        reasons.append("senior_or_fulltime")

    semi = bool(rx(c["technical"]["semi_technical"]).search(title))
    if rx(c["technical"]["exclude_title"]).search(title) and not semi:
        reasons.append("technical")

    family = None
    for fam, pat in c["role_families"].items():
        if rx(pat).search(title):
            family = fam
            break
    if family is None:
        for fam, pat in c["role_families"].items():
            if rx(pat).search(desc[:800]):
                family = fam
                break

    if rx(c["unpaid"]).search(blob) and not rx(r"paid internship|带薪|\$\d|¥|元/天|/天").search(blob):
        reasons.append("unpaid")
    for key, pat in c["hard_exclude"].items():
        if rx(pat).search(f"{title}\n{job.get('company','')}\n{desc[:3000]}"):
            reasons.append(key)

    # 远程判断
    pos = bool(rx(c["remote"]["positive"]).search(head)) or job.get("is_remote") is True
    neg = rx(c["remote"]["negative"]).search(head)
    # 地点写的是某个国家/美国城市，且没说全球 → 视为地区限制
    us_loc = rx(r"\b(united states|usa|u\.s\.|us|canada|[A-Z][a-z]+, (CA|NY|WA|TX|MA))\b").search(loc)
    global_ok = rx(r"anywhere|global|worldwide|全球|不限地区").search(head)
    if pos and us_loc and not global_ok:
        neg = True
    if pos and not neg:
        remote = "remote_ok"
    elif pos and neg:
        remote = "region_limited"
    elif rx(r"hybrid").search(head):
        remote = "hybrid"
    elif loc:
        remote = "onsite"
    else:
        remote = "unknown"

    # 签证/工作许可
    visa = job.get("visa") or ""
    if "not required" in visa.lower():
        work_auth = "none_stated"
    elif rx(c["work_auth"]["us_only"]).search(blob) or "us citizen" in visa.lower():
        work_auth = "us_only"
    elif rx(r"sponsor (visas?|h-?1b)|visa sponsorship (is )?available").search(blob):
        work_auth = "sponsors"
    else:
        work_auth = "none_stated"
    if remote == "region_limited" and rx(r"\b(us|usa|united states)\b").search(head):
        work_auth = "us_only" if work_auth == "none_stated" else work_auth

    # 国内线下城市
    city = next((x for x in c["china_cities"] if x.lower() in f"{loc} {title}".lower()), None)

    # 海外线下且不远程：只有在国内城市时保留（5 月后线下页签）
    if remote in ("onsite", "hybrid") and not city:
        reasons.append("overseas_onsite")
    if work_auth == "us_only":
        reasons.append("us_only")
    if remote == "region_limited" and not city:
        reasons.append("region_limited")

    return {
        "keep": not reasons,
        "reasons": reasons,
        "role_family": family or ("semi_tech" if semi else "other"),
        "semi_technical": semi,
        "remote": remote,
        "work_auth": work_auth,
        "china_city": city,
    }


def load_json(path: Path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def dump_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=1), encoding="utf-8")
