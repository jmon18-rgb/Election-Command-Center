#!/usr/bin/env python3
"""External news RSS may fail without stopping independently verified polling."""
import json
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest.mock import patch
import update_briefing as news

class NewsResilienceTests(unittest.TestCase):
    def test_all_six_upstream_queries_fail_and_cached_news_is_preserved(self):
        with tempfile.TemporaryDirectory() as d:
            file=Path(d)/"briefing.json"
            old_at="2026-10-22T12:00:00Z"
            item={"title":"Previous reported election story","url":"https://example.org/news",
                  "published_at":old_at,"source":"Verified original source"}
            file.write_text(json.dumps({"updated_at":old_at,
                "updates":[item],"security":[item],"pipeline":{"successful_queries":6}}))
            upstream=urllib.error.HTTPError("https://news.google.com",503,
                                           "Service Unavailable",None,None)
            with patch.object(news,"OUTPUT",file),patch.object(news,"rss_search",side_effect=upstream):
                news.main()
            result=json.loads(file.read_text())
            self.assertEqual(result["updated_at"],old_at)
            self.assertEqual(result["updates"],[item])
            self.assertEqual(result["security"],[item])
            self.assertEqual(result["pipeline"]["successful_queries"],0)
            self.assertEqual(result["pipeline"]["status"],"degraded_upstream_news_unavailable")
            self.assertEqual(len(result["pipeline"]["errors"]),6)
            self.assertTrue(result["pipeline"]["last_attempt_at"])

    def test_recovery_restores_current_timestamp(self):
        with tempfile.TemporaryDirectory() as d:
            file=Path(d)/"briefing.json"
            item={"title":"Recovered news item","url":"https://example.org/recovered",
                  "published_at":"2026-10-23T12:00:00Z","source":"News"}
            with patch.object(news,"OUTPUT",file),patch.object(news,"rss_search",return_value=[item]):
                news.main()
            data=json.loads(file.read_text())
            self.assertEqual(data["pipeline"]["successful_queries"],6)
            self.assertEqual(data["pipeline"]["status"],"ok")
            self.assertTrue(data["updates"] and data["security"])
            self.assertEqual(data["updated_at"],data["pipeline"]["last_attempt_at"])

if __name__=="__main__":
    unittest.main()
