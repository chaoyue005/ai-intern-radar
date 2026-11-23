"""公开 ATS 接口：Ashby / Greenhouse / Lever / Workable / SmartRecruiters / Recruitee。

只抓 companies.yaml 里登记了 ats 字段的公司。先按标题粗筛出实习岗，再保留描述，避免无用数据。
"""
from __future__ import annotations

import concurrent.futures as cf
from datetime import datetime, timezone

import requests

from ..common import UA, companies, criteria, rx, strip_html

TIMEOUT = 20


def _ms_to_iso(ms):
    try:
        return datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc).date().isoformat()
    except Exception:
        return None


def _intern_title(title: str) -> bool:
    return bool(rx(criteria()["intern"]["include"]).search(title or ""))


def ashby(slug: str, company: str) -> list[dict]:
    r = requests.get(
        f"https://api.ashbyhq.com/posting-api/job-board/{slug}",
        params={"includeCompensation": "true"}, headers=UA, timeout=TIMEOUT)
    r.raise_for_status()
    out = []
    for j in r.json().get("jobs", []):
        if not (_intern_title(j.get("title")) or (j.get("employmentType") or "").lower() == "intern"):
            continue
        comp = (j.get("compensation") or {}).get("compensationTierSummary") or ""
        out.append({
            "company": company, "title": j.get("title"),
            "apply_url": j.get("jobUrl") or j.get("applyUrl"), "apply_method": "ats",
            "source": "ashby", "location": j.get("location") or "",
            # isRemote 不可靠，只作参考，最终以描述为准
            "is_remote": None, "description": j.get("descriptionPlain") or strip_html(j.get("descriptionHtml")),
            "posted_at": (j.get("publishedAt") or "")[:10] or None, "pay_text": comp,
            "employment_type": "intern" if (j.get("employmentType") or "").lower() == "intern" else None,
        })
    return out


def greenhouse(slug: str, company: str) -> list[dict]:
    r = requests.get(f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs",
                     params={"content": "true"}, headers=UA, timeout=TIMEOUT)
    r.raise_for_status()
    out = []
    for j in r.json().get("jobs", []):
        if not _intern_title(j.get("title")):
            continue
        out.append({
            "company": company, "title": j.get("title"), "apply_url": j.get("absolute_url"),
            "apply_method": "ats", "source": "greenhouse",
            "location": (j.get("location") or {}).get("name", ""),
            "description": strip_html(j.get("content")),
            "posted_at": (j.get("first_published") or j.get("updated_at") or "")[:10] or None,
        })
    return out


def lever(slug: str, company: str) -> list[dict]:
    r = requests.get(f"https://api.lever.co/v0/postings/{slug}", params={"mode": "json"},
                     headers=UA, timeout=TIMEOUT)
    r.raise_for_status()
    out = []
    for j in r.json():
        cats = j.get("categories") or {}
        if not (_intern_title(j.get("text")) or "intern" in (cats.get("commitment") or "").lower()):
            continue
        desc = j.get("descriptionPlain") or ""
        for lst in j.get("lists") or []:
            desc += f"\n{lst.get('text','')}\n{strip_html(lst.get('content'))}"
        out.append({
            "company": company, "title": j.get("text"), "apply_url": j.get("hostedUrl"),
            "apply_method": "ats", "source": "lever", "location": cats.get("location", ""),
            "is_remote": (j.get("workplaceType") == "remote") or None,
            "description": desc, "posted_at": _ms_to_iso(j.get("createdAt")),
            "employment_type": "intern" if "intern" in (cats.get("commitment") or "").lower() else None,
        })
    return out


def workable(slug: str, company: str) -> list[dict]:
    r = requests.get(f"https://apply.workable.com/api/v1/widget/accounts/{slug}",
                     params={"details": "true"}, headers=UA, timeout=TIMEOUT)
    r.raise_for_status()
    out = []
    for j in r.json().get("jobs", []):
        if not (_intern_title(j.get("title")) or "intern" in (j.get("employment_type") or "").lower()):
            continue
        out.append({
            "company": company, "title": j.get("title"), "apply_url": j.get("url") or j.get("shortlink"),
            "apply_method": "ats", "source": "workable",
            "location": ", ".join(filter(None, [j.get("city"), j.get("country")])),
            "is_remote": j.get("telecommuting") or None,
            "description": strip_html(j.get("description")), "posted_at": (j.get("published_on") or "")[:10] or None,
        })
    return out


def smartrecruiters(slug: str, company: str) -> list[dict]:
    r = requests.get(f"https://api.smartrecruiters.com/v1/companies/{slug}/postings",
                     params={"limit": 100}, headers=UA, timeout=TIMEOUT)
    r.raise_for_status()
    out = []
    for j in r.json().get("content", []):
        if not _intern_title(j.get("name")):
            continue
        loc = j.get("location") or {}
        out.append({
            "company": company, "title": j.get("name"),
            "apply_url": f"https://jobs.smartrecruiters.com/{slug}/{j.get('id')}",
            "apply_method": "ats", "source": "smartrecruiters",
            "location": ", ".join(filter(None, [loc.get("city"), loc.get("country")])),
            "is_remote": loc.get("remote") or None, "description": "",
            "posted_at": (j.get("releasedDate") or "")[:10] or None,
        })
    return out


def recruitee(slug: str, company: str) -> list[dict]:
    r = requests.get(f"https://{slug}.recruitee.com/api/offers/", headers=UA, timeout=TIMEOUT)
    r.raise_for_status()
    out = []
    for j in r.json().get("offers", []):
        if not _intern_title(j.get("title")):
            continue
        out.append({
            "company": company, "title": j.get("title"), "apply_url": j.get("careers_url"),
            "apply_method": "ats", "source": "recruitee", "location": j.get("location", ""),
            "is_remote": j.get("remote") or None,
            "description": strip_html(j.get("description")) + "\n" + strip_html(j.get("requirements")),
            "posted_at": (j.get("published_at") or "")[:10] or None,
        })
    return out


FETCHERS = {"ashby": ashby, "greenhouse": greenhouse, "lever": lever, "workable": workable,
            "smartrecruiters": smartrecruiters, "recruitee": recruitee}


def fetch_all(log) -> list[dict]:
    targets = [(c["ats"]["type"], c["ats"]["slug"], c["name"]) for c in companies()
               if c.get("ats") and not c.get("blocked")]
    jobs: list[dict] = []

    def run(t):
        kind, slug, name = t
        try:
            return FETCHERS[kind](slug, name)
        except Exception as e:  # 单个公司失败不影响整体
            log("ats_error", f"{kind}/{slug}: {str(e)[:160]}")
            return []

    with cf.ThreadPoolExecutor(8) as ex:
        for res in ex.map(run, targets):
            jobs.extend(res)
    return jobs
