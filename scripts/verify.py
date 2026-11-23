"""每天核实人工收录岗位的链接是否仍在招聘。

返回 True（仍在招）、False（已下线/404）、None（需要登录无法核实，如 Boss、LinkedIn、邮箱投递）。
"""
from __future__ import annotations

import concurrent.futures as cf
import re

import requests

from .common import UA

CLOSED = re.compile(
    r"no longer (accepting|available|open)|position (has been )?(filled|closed)|job (is )?(closed|expired)"
    r"|this job (posting )?(has|is) (expired|closed)|已下线|职位已关闭|停止招聘|该职位已失效", re.I)
LOGIN_ONLY = re.compile(r"zhipin\.com|linkedin\.com|x\.com|twitter\.com|maimai\.cn|okjike\.com|xiaohongshu\.com")


def check(url: str) -> bool | None:
    if not url or url.startswith("mailto:") or LOGIN_ONLY.search(url):
        return None
    try:
        r = requests.get(url, headers=UA, timeout=20, allow_redirects=True)
    except requests.RequestException:
        return None  # 网络问题不判定下线
    if r.status_code in (404, 410):
        return False
    if r.status_code != 200:
        return None
    # Ashby 下线岗位会跳回公司招聘首页
    if "jobs.ashbyhq.com" in url and url.rstrip("/").count("/") >= 4 and r.url.rstrip("/").count("/") < 4:
        return False
    return not CLOSED.search(r.text[:300000])


def check_many(urls: list[str]) -> dict[str, bool | None]:
    with cf.ThreadPoolExecutor(8) as ex:
        return dict(zip(urls, ex.map(check, urls)))
