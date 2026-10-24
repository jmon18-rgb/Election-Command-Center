import unittest
from discover_ohio_official_nist_xml import inspect,PAGE

class OfficialOhioPreElectionSource(unittest.TestCase):
    def test_extract_only_official_xml_anchor_and_mark_mock_results(self):
        html='''<!doctype html><html><body>
            <h1>Ohio Secretary of State</h1>
            <p>The vote totals currently being displayed are the result
               of mock elections performed ahead of November 3, 2026.</p>
            <a href="/home/ExportXML">Election Results XML Feed</a>
            <a href="https://unverified.example.com/file.xml">download</a>
            </body></html>'''
        result=inspect(html)
        self.assertTrue(result["mock_or_test_banner_detected"])
        self.assertEqual(result["possible_feed_links"][0]["href"],
                         "https://liveresults.ohiosos.gov/home/ExportXML")
        self.assertTrue(result["possible_feed_links"][0]["verified_official_host"])
        self.assertIsNone(result["possible_feed_links"][1]["href"])
        self.assertTrue(result["possible_feed_links"][1]["needs_manual_host_review"])
        self.assertFalse(result["source_votes_ingested"])
        self.assertFalse(result["ready_for_automatic_2026_ingestion"])
        self.assertFalse(result["may_move_national_needle"])

    def test_do_not_invent_feed_if_anchor_is_missing(self):
        doc=inspect('<html><body>Ohio results updates every three minutes</body></html>')
        self.assertEqual(doc["possible_feed_links"],[])
        self.assertFalse(doc["ready_for_automatic_2026_ingestion"])

    def test_https_and_domain_boundary(self):
        doc=inspect('<a href="http://liveresults.ohiosos.gov/Results.xml">XML Feed</a>'
                    '<a href="https://liveresults.ohiosos.gov.evil.example/results.xml">'
                    'Election Results XML Feed</a>')
        self.assertEqual(len(doc["possible_feed_links"]),2)
        self.assertTrue(all(r["href"] is None for r in doc["possible_feed_links"]))
        self.assertTrue(all(r["needs_manual_host_review"] for r in doc["possible_feed_links"]))

    def test_missing_or_oversized_html_blocked(self):
        for text in ("", "x"*1_500_001):
            with self.assertRaises(ValueError):
                inspect(text)

if __name__=="__main__":
    unittest.main()
