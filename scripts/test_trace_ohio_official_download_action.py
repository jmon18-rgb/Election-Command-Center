import unittest
from trace_ohio_official_download_action import (
    script_candidates,trace,findings,allowed,KEY
)

class OhioScriptEvidence(unittest.TestCase):
    def test_discover_official_script_without_executing_any_vote_download(self):
        html='''<html><script src="/assets/ohio-results.js"></script>
          <script src="https://evil.example.org/untrusted.js"></script>
          <a href="javascript:downloadReport('VSSC1622XmlFileBlob')">
          Election Results XML Feed</a>
          <script>window.a=1;</script></html>'''
        calls=[]
        def fetch(url):
            calls.append(url)
            return """function downloadReport(key) {
               var type='NIST1500'; var base='/Home/GetReport';
               console.log(key); }
               var blobKey='VSSC1622XmlFileBlob';"""
        result=trace(html,fetch)
        self.assertEqual(calls,["https://liveresults.ohiosos.gov/assets/ohio-results.js"])
        self.assertTrue(result["expected_export_action_seen"])
        self.assertEqual(result["official_blob_object_key"],KEY)
        self.assertTrue(any(r["marker"]==KEY for r in result["observed_function_or_key_references"]))
        self.assertTrue(any(r["marker"]=="downloadReport" for r in result["observed_function_or_key_references"]))
        for name in ("real_election_results_verified","resolved_xml_endpoint_verified",
                     "source_votes_ingested","may_move_national_needle"):
            self.assertFalse(result[name])

    def test_off_origin_and_redirects_never_allowed(self):
        self.assertFalse(allowed("http://liveresults.ohiosos.gov/mock.xml"))
        self.assertFalse(allowed("https://liveresults.ohiosos.gov.evil.com/app.js"))
        self.assertFalse(allowed("javascript:downloadReport('VSSC1622XmlFileBlob')"))
        self.assertFalse(allowed("https://a@liveresults.ohiosos.gov/app.js"))
        self.assertTrue(allowed("https://liveresults.ohiosos.gov/js/app.js"))

    def test_missing_export_link_never_promoted(self):
        document='<html><script>function downloadReport(){}</script></html>'
        result=trace(document,lambda _: "")
        self.assertFalse(result["expected_export_action_seen"])
        self.assertFalse(result["resolved_xml_endpoint_verified"])
        self.assertTrue(result["observed_function_or_key_references"])

    def test_scripts_are_bounded_and_errors_preserved(self):
        doc='<html><script src="/content/bundle.js"></script></html>'
        result=trace(doc,lambda _: (_ for _ in ()).throw(OSError("503 unavailable")))
        self.assertEqual(len(result["fetch_errors"]),1)
        self.assertEqual(result["observed_function_or_key_references"],[])
        with self.assertRaises(ValueError):
            script_candidates("x"*1500001)
        with self.assertRaises(ValueError):
            findings("x"*750001,"official inline")

if __name__=="__main__":
    unittest.main()
