"""读取 data/run_log.json；如果有渠道失败或被拦，就在 GitHub 开一个 Issue 提醒（同一问题不重复开）。"""
from __future__ import annotations

import json
import os
import subprocess

from .common import DATA, load_json


def main():
    log = load_json(DATA / "run_log.json", {})
    items = log.get("items", [])
    bad = [i for i in items if i["key"].endswith(("_failed", "_blocked"))]
    ats_errors = [i for i in items if i["key"] == "ats_error"]
    if len(ats_errors) >= 5:
        bad.append({"key": "ats_error", "value": f"{len(ats_errors)} 家公司招聘页抓取失败，例如：{ats_errors[0]['value']}"})
    if not bad:
        print("全部渠道正常")
        return
    body = "每日抓取时以下渠道出错（可能是网站改版或临时限制），请让 Claude 看一下：\n\n" + \
        "\n".join(f"- `{b['key']}`：{b['value']}" for b in bad) + f"\n\n运行时间：{log.get('at')}"
    print(body)
    repo = os.environ.get("REPO")
    if not repo or not os.environ.get("GH_TOKEN"):
        return
    existing = subprocess.run(["gh", "issue", "list", "-R", repo, "--label", "health", "--state", "open", "--json", "number"],
                              capture_output=True, text=True).stdout
    if json.loads(existing or "[]"):
        subprocess.run(["gh", "issue", "comment", str(json.loads(existing)[0]["number"]), "-R", repo, "-b", body])
    else:
        subprocess.run(["gh", "label", "create", "health", "-R", repo, "-c", "d73a4a", "-f"], capture_output=True)
        subprocess.run(["gh", "issue", "create", "-R", repo, "-t", "⚠️ 每日抓取有渠道出错", "-b", body, "-l", "health"])


if __name__ == "__main__":
    main()
