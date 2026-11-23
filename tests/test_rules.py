"""用交接文档第 11 节的「已失效」例子和种子岗位测试过滤逻辑。运行：python -m unittest discover tests"""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.common import classify, company_index  # noqa: E402
from scripts.pipeline import _company, _lane, freshness_status  # noqa: E402


def job(title, desc="", loc="", company="X", **kw):
    return {"title": title, "description": desc, "location": loc, "company": company, **kw}


class FilterOut(unittest.TestCase):
    def test_meshy_us_only(self):
        c = classify(job("Community Intern", "Remote (US). Must be authorized to work in the United States.", "Remote - US"))
        self.assertFalse(c["keep"])
        self.assertIn("us_only", c["reasons"])

    def test_openart_bay_area_onsite(self):
        c = classify(job("Early Adopter Intern", "This role is on-site in our Bay Area office.", "San Francisco"))
        self.assertFalse(c["keep"])

    def test_clay_unpaid_ambassador(self):
        c = classify(job("Clay Ambassador", "This is an unpaid volunteer ambassador program."))
        self.assertIn("unpaid", c["reasons"])

    def test_blocked_companies(self):
        idx = company_index()
        for name in ["冰创未来", "LockedIn AI"]:
            self.assertTrue(_company(job("运营实习", company=name), idx)["blocked"], name)

    def test_rally_zombie(self):
        self.assertEqual(freshness_status("2020-01-01", None, None, "2020-01-01"), "zombie")

    def test_deadline_passed_closed(self):  # 石墨文档、极群
        self.assertEqual(freshness_status("2026-10-01", None, "2026-11-01", "2026-11-01"), "closed")

    def test_technical_titles(self):
        for t in ["Software Engineer Intern", "Research Intern", "SWE Fellow", "算法实习生", "Applied Researcher Intern"]:
            self.assertIn("technical", classify(job(t))["reasons"], t)

    def test_fulltime_not_intern(self):
        self.assertIn("not_intern", classify(job("Growth Marketing Manager"))["reasons"])

    def test_international_not_intern(self):
        self.assertIn("not_intern", classify(job("International Growth Lead"))["reasons"])

    def test_web3(self):
        self.assertFalse(classify(job("Community Intern", "Join our web3 crypto community. Remote anywhere."))["keep"])

    def test_mba(self):
        self.assertFalse(classify(job("Investment Banking - AI Research (MBA Intern)", "Remote"))["keep"])


class KeepIn(unittest.TestCase):
    def test_remote_gtm(self):
        c = classify(job("GTM Growth Ops Intern", "Fully remote, work from anywhere.", "Remote"))
        self.assertTrue(c["keep"], c)
        self.assertEqual(_lane(c), "remote")
        self.assertEqual(c["role_family"], "growth")

    def test_chinese_remote(self):
        c = classify(job("海外社媒运营实习生", "全远程，每周 4 天", "北京 远程"))
        self.assertTrue(c["keep"], c)
        self.assertEqual(_lane(c), "remote")

    def test_china_onsite(self):
        c = classify(job("AI 产品运营实习生", "坐班，每周 5 天", "上海"))
        self.assertTrue(c["keep"], c)
        self.assertEqual(_lane(c), "china_onsite")

    def test_market_bd_not_technical(self):
        self.assertNotIn("technical", classify(job("市场开发实习生", "", "深圳"))["reasons"])

    def test_devrel_semi_technical(self):
        c = classify(job("DevRel Intern", "remote anywhere", "Remote"))
        self.assertTrue(c["semi_technical"])
        self.assertTrue(c["keep"], c)

    def test_seed_tiers(self):
        idx = company_index()
        self.assertEqual(_company(job("x", company="Simular"), idx)["tier"], "A")
        self.assertEqual(_company(job("x", company="词擎聚联"), idx)["tier"], "B")
        self.assertEqual(_company(job("x", company="麦汐"), idx)["tier"], "C")


if __name__ == "__main__":
    unittest.main()
