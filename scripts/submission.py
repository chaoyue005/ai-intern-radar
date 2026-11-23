"""把审核通过（加了 approved 标签）的投稿 Issue 写入 data/manual_jobs.yaml。

Issue 表单生成的正文格式是「### 字段名\n\n值」，这里按字段名解析。
"""
from __future__ import annotations

import os
import re

import yaml

from .common import DATA, today

FIELDS = {"公司": "company", "岗位名称": "title", "投递链接或邮箱": "apply_url", "来源": "source_label",
          "地点 / 是否远程": "location", "薪资": "pay_text", "截止日期（可选）": "deadline", "岗位描述（粘贴 JD）": "description"}
SOURCE = {"Boss 直聘": "boss", "实习僧": "shixiseng", "LinkedIn": "linkedin", "X/Twitter": "x", "小红书": "xiaohongshu",
          "即刻": "jike", "牛客": "nowcoder", "公司官网": "submission", "内推/朋友": "submission", "其他": "submission"}


def parse(body: str) -> dict:
    out = {}
    for block in re.split(r"^### ", body or "", flags=re.M)[1:]:
        head, _, val = block.partition("\n")
        key = FIELDS.get(head.strip())
        val = val.strip()
        if key and val and val != "_No response_":
            out[key] = val
    return out


def main():
    d = parse(os.environ.get("ISSUE_BODY", ""))
    for k in ("company", "title", "apply_url"):
        if not d.get(k):
            raise SystemExit(f"缺少必填字段：{k}")
    url = d["apply_url"]
    if "@" in url and not url.startswith(("http", "mailto:")):
        url = f"mailto:{url}"
    src = SOURCE.get(d.pop("source_label", "其他"), "submission")
    job = {"company": d["company"], "title": d["title"], "apply_url": url, "source": src,
           "apply_method": src if src in ("boss", "shixiseng", "linkedin", "x") else ("email" if url.startswith("mailto:") else "ats"),
           "verified_at": today(), "issue": int(os.environ.get("ISSUE_NUMBER", 0) or 0)}
    for k in ("location", "pay_text", "deadline", "description"):
        if d.get(k):
            job[k] = d[k]
    if re.search(r"远程|remote|anywhere", job.get("location", ""), re.I):
        job["is_remote"] = True
    path = DATA / "manual_jobs.yaml"
    items = yaml.safe_load(path.read_text(encoding="utf-8")) or []
    if any(i.get("apply_url") == url for i in items):
        print("已存在，跳过")
        return
    with path.open("a", encoding="utf-8") as f:
        f.write("\n" + yaml.safe_dump([job], allow_unicode=True, sort_keys=False))
    print("已收录", job["company"], job["title"])


if __name__ == "__main__":
    main()
