#!/usr/bin/env python3
import unittest
from trace_ohio_nist_download_action import (
    PAGE,scan_document,safe_script_url,function_excerpts,
)
class OhioActionTraceTests(unittest.TestCase):
    def test_only_real_official_js_sources_with_inert_evidence(self):
        html="""<!doctype html><html><script src="/Scripts/results.js"></script>
        <script src="https://unverified.example.com/inject.js"></script>
        <script>function downloadReport(k){return fetch('/Home/GetReport?key='+k)}</script>
        <a href="javascript:downloadReport('VSSC1622XmlFileBlob');">XML Feed</a>
        </html>"""
        sources={
            "https://liveresults.ohiosos.gov/Scripts/results.js":
            "function downloadReport(objectName){return '/Reports/Download/'+objectName}"
        }
        output=scan_document(html,lambda url:sources[url])
        self.assertTrue(output["document_contains_action"])
        self.assertEqual(output["scripts_inspected"],1)
        self.assertEqual(output["skipped_external_or_unsafe_assets"],1)
        self.assertTrue(output["inline_evidence"])
        self.assertTrue(output["official_script_evidence"][0]["excerpts"])
        self.assertIsNone(output["derived_verified_xml_endpoint"])
        self.assertFalse(output["candidate_votes_read"])
        self.assertFalse(output["may_move_national_needle"])
    def test_non_official_script_or_result_url_rejected(self):
        for url in (
            "https://evil.example.org/a.js",
            "https://liveresults.ohiosos.gov.attacker.org/a.js",
            "http://liveresults.ohiosos.gov/Scripts/a.js",
            "https://user:password@liveresults.ohiosos.gov/Scripts/a.js",
            "https://liveresults.ohiosos.gov/Feed/results.xml",
            "file:///etc/hosts",
        ):
            self.assertIsNone(safe_script_url(url),url)
        self.assertEqual(safe_script_url("/Scripts/results.js"),
                         "https://liveresults.ohiosos.gov/Scripts/results.js")
    def test_function_excerpts_are_bounded(self):
        evidence=function_excerpts("x"*10000+"\nfunction downloadReport(id){return '/file/'+id;}")
        self.assertGreater(len(evidence),0)
        self.assertTrue(all(len(v["evidence"])<760 for v in evidence))
    def test_missing_sources_not_counted_live(self):
        out=scan_document("<script src='/JS/nope.js'></script>")
        self.assertFalse(out["document_contains_action"])
        self.assertFalse(out["pre_election_mock_votes_permitted"])
    def test_reject_unbounded_page(self):
        with self.assertRaises(ValueError):
            scan_document("x"*1500001)
if __name__=="__main__":unittest.main()
