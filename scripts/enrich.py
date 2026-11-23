"""用 Claude 为新岗位生成中文摘要：一句话介绍、3 条职责、3 条要求、3 项核心能力、是否要作品集、薪资/天数。

只处理新出现或描述变化的岗位；结果缓存在 data/cache/enrich.json，不会重复花钱。
没有 ANTHROPIC_API_KEY 时自动跳过（网站照常生成，只是没有中文摘要）。
"""
from __future__ import annotations

import hashlib
import json
import os

from .common import DATA, load_json, dump_json

CACHE = DATA / "enrich_cache.json"  # 提交到仓库，避免每天重复花钱
MODEL = "claude-haiku-5-5"

SKILLS = ["数据分析", "AI 工具熟练", "内容与文案", "上线与活动", "增长", "竞品研究",
          "达人合作", "销售线索", "社媒与社区", "用户反馈", "自动化", "英语沟通", "设计与视频"]

SCHEMA = {
    "type": "object",
    "properties": {
        "one_liner_zh": {"type": "string", "description": "公司做什么，一句中文，30 字以内"},
        "is_nontech_intern": {"type": "boolean", "description": "是否为非技术类实习（不需要写代码）"},
        "is_paid": {"type": "boolean"},
        "remote": {"type": "string", "enum": ["remote_ok", "region_limited", "onsite", "hybrid", "unknown"]},
        "remote_region": {"type": "string", "description": "远程限制的地区，例如 US only；没有则空字符串"},
        "us_work_auth_required": {"type": "boolean"},
        "duties_zh": {"type": "array", "items": {"type": "string"}, "description": "3 条主要职责，中文，每条 25 字以内"},
        "requirements_zh": {"type": "array", "items": {"type": "string"}, "description": "3 条核心要求，中文，每条 25 字以内"},
        "skills": {"type": "array", "items": {"type": "string", "enum": SKILLS}, "description": "最多 3 项"},
        "portfolio_required": {"type": "boolean"},
        "days_per_week": {"type": ["integer", "null"]},
        "duration_months": {"type": ["integer", "null"]},
        "grad_year_limit": {"type": "string", "description": "毕业年份要求，没有则空字符串"},
    },
    "required": ["one_liner_zh", "is_nontech_intern", "is_paid", "remote", "remote_region",
                 "us_work_auth_required", "duties_zh", "requirements_zh", "skills",
                 "portfolio_required", "days_per_week", "duration_months", "grad_year_limit"],
    "additionalProperties": False,
}

PROMPT = """你在为「AI 初创非技术实习雷达」整理岗位卡片。读者是不会写代码、想进 AI 公司的中国留学生。
根据下面的岗位信息，按 JSON 格式提取字段。只写原文能支持的内容，原文没写的布尔值填 false、数字填 null。
remote：原文明确说可以远程且不限地区 → remote_ok；远程但限定国家/时区 → region_limited。

公司：{company}
岗位：{title}
地点：{location}
描述：
{description}"""


def _key(job: dict) -> str:
    return hashlib.sha1(f"{job['title']}|{(job.get('description') or '')[:3000]}".encode()).hexdigest()


def enrich(jobs: list[dict], log, limit: int = 120) -> None:
    cache = load_json(CACHE, {})
    todo = [j for j in jobs if _key(j) not in cache]
    for j in jobs:
        if _key(j) in cache:
            j["ai"] = cache[_key(j)]
    if not todo or not os.environ.get("ANTHROPIC_API_KEY"):
        if todo:
            log("enrich_skipped", f"{len(todo)} 条（未设置 ANTHROPIC_API_KEY）")
        return
    import anthropic

    client = anthropic.Anthropic()
    done = 0
    for j in todo[:limit]:
        try:
            resp = client.messages.create(
                model=MODEL, max_tokens=1500,
                output_config={"effort": "low", "format": {"type": "json_schema", "schema": SCHEMA}},
                messages=[{"role": "user", "content": PROMPT.format(
                    company=j["company"], title=j["title"], location=j.get("location", ""),
                    description=(j.get("description") or "")[:6000])}],
            )
            if resp.stop_reason == "refusal":
                continue
            text = next(b.text for b in resp.content if b.type == "text")
            data = json.loads(text)
            cache[_key(j)] = data
            j["ai"] = data
            done += 1
        except anthropic.RateLimitError:
            log("enrich_rate_limited", done)
            break
        except anthropic.APIStatusError as e:
            log("enrich_api_error", f"{e.status_code}: {str(e.message)[:120]}")
            break
        except anthropic.APIConnectionError as e:
            log("enrich_connection_error", str(e)[:120])
            break
        except (StopIteration, json.JSONDecodeError):
            continue
    dump_json(CACHE, cache)
    log("enriched", done)
