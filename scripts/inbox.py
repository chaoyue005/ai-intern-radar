"""处理 Chrome 巡检的候选：--check 预筛并编号；--approve 1,3 / all 写入 data/manual_jobs.yaml。"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import yaml

from .common import DATA, classify, today

MANUAL = DATA / "manual_jobs.yaml"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("--check", action="store_true")
    ap.add_argument("--approve", default="")
    a = ap.parse_args()
    cands = json.loads(Path(a.file).read_text(encoding="utf-8"))
    existing = yaml.safe_load(MANUAL.read_text(encoding="utf-8")) or []
    known = {i.get("apply_url") for i in existing}
    rows = []
    for n, c in enumerate(cands, 1):
        cls = classify({**c, "employment_type": "intern"})
        dup = c.get("apply_url") in known
        rows.append((n, c, cls, dup))
        flag = "已收录" if dup else ("✅" if cls["keep"] else "⚠️ " + ",".join(cls["reasons"]))
        print(f"{n:>2}. [{flag}] {c.get('company')} | {c.get('title')} | {c.get('location','')} | {c.get('pay_text','')} | {c.get('source')}")
    if a.check or not a.approve:
        return
    pick = {n for n, *_ in rows} if a.approve == "all" else {int(x) for x in a.approve.split(",") if x.strip()}
    added = []
    for n, c, cls, dup in rows:
        if n not in pick or dup:
            continue
        job = {k: v for k, v in c.items() if k in ("company", "title", "apply_url", "source", "location",
                                                    "pay_text", "deadline", "description") and v}
        job["apply_method"] = c.get("source", "ats")
        job["verified_at"] = today()
        if any(w in (c.get("location") or "").lower() for w in ("远程", "remote", "anywhere", "线上")):
            job["is_remote"] = True
        added.append(job)
    if added:
        with MANUAL.open("a", encoding="utf-8") as f:
            f.write(f"\n# —— 巡检收录 {today()} ——\n" + yaml.safe_dump(added, allow_unicode=True, sort_keys=False))
    print(f"已收录 {len(added)} 条")


if __name__ == "__main__":
    main()
