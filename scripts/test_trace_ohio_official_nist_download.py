#!/usr/bin/env python3
import unittest
from trace_ohio_official_nist_download import collect, official_js_url, find_snippets

PAGE = '''<!doctype html><html><body>
<a href="javascript:downloadReport('VSSC1622XmlFileBlob')">
Election Results XML Feed</a>
<script src="/Content/Scripts/results.js?v=123"></script>
<script src="https://hostile.example/steal.js"></script>
<script>function downloadReport(key) {
 var report = getSASLink(key);
 return window.location.assign(report);
}</script>
</body></html>'''


class OhioReadOnlyNistTrace(unittest.TestCase):
    def test_official_static_js_only(self):
        self.assertEqual(official_js_url("/Content/Scripts/results.js?v=123"),
            "https://liveresults.ohiosos.gov/Content/Scripts/results.js?v=123")
        for src in ["https://hostile.example/evil.js",
                    "http://liveresults.ohiosos.gov/foo.js",
                    "https://liveresults.ohiosos.gov.attacker.example/script.js",
                    "/api/v1/results.xml", "javascript:alert(1)"]:
            self.assertIsNone(official_js_url(src))

    def test_extract_action_without_fetching_result_file(self):
        requested = []
        def source(url):
            requested.append(url)
            return """function downloadReport(fileType) {
              fetch('/ElectionReport/Download?type=' + fileType)
            }"""
        report = collect(PAGE, source)
        self.assertEqual(report["download_actions"],
             [{"action":"downloadReport","object_key":"VSSC1622XmlFileBlob"}])
        self.assertEqual(len(requested),1)
        self.assertEqual(report["official_js_files_listed"],1)
        self.assertGreater(len(report["source_excerpts"]),0)
        self.assertIn("downloadReport",str(report["source_excerpts"]))
        self.assertFalse(report["ready_for_automatic_2026_ingestion"])
        self.assertFalse(report["source_vote_counts_ingested"])
        self.assertFalse(report["may_move_national_needle"])

    def test_missing_action_produces_no_guessed_results_url(self):
        r=collect("<html><script src='/vendor/jquery.js'></script></html>",
                  lambda url: "const unrelated = 1")
        self.assertEqual(r["download_actions"],[])
        self.assertEqual(r["source_excerpts"],[])
        self.assertFalse(r["official_feed_url_certified"])

    def test_script_failure_is_visible_not_guessed_or_misclassified(self):
        def bad(url):
            raise OSError("simulated official script unavailable")
        r=collect(PAGE,bad)
        self.assertEqual(len(r["failed_first_party_script_reads"]),1)
        self.assertIn("simulated",r["failed_first_party_script_reads"][0]["error"])
        self.assertFalse(r["ready_for_automatic_2026_ingestion"])

    def test_source_budgets(self):
        with self.assertRaises(ValueError):
            collect("x"*1_500_001)
        with self.assertRaises(ValueError):
            find_snippets(None)
        r=collect(PAGE, lambda url:"x"*800_001)
        self.assertEqual(len(r["failed_first_party_script_reads"]),1)


if __name__=="__main__":
    unittest.main()
