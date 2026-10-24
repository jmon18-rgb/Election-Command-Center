import unittest
from probe_ohio_xml_export_headers import (
 KEY,SCRIPT_RESOLVED,ROOT_ALTERNATIVE,evaluate,probe
)

class OhioXmlHeadProbe(unittest.TestCase):
    def test_true_javascript_relative_path_is_retained(self):
        self.assertEqual(SCRIPT_RESOLVED,
            "https://liveresults.ohiosos.gov/Home/Api/v1/download?filename="+KEY)
        self.assertEqual(ROOT_ALTERNATIVE,
            "https://liveresults.ohiosos.gov/Api/v1/download?filename="+KEY)

    def test_probe_keeps_mock_data_separate_from_source_metadata(self):
        seen=[]
        def fake(url):
            seen.append(url)
            return {"status":200,"content_type":"application/xml",
                    "content_length":"50214","last_modified":"Fri, 23 Oct 2026 15:00:00 GMT"}
        res=probe(fake)
        self.assertEqual(seen,[SCRIPT_RESOLVED,ROOT_ALTERNATIVE])
        self.assertEqual(res["endpoint_metadata"][0]["http_status"],200)
        self.assertFalse(res["endpoint_metadata"][0]["xml_candidate_verified"])
        self.assertFalse(res["candidate_votes_ingested"])
        self.assertFalse(res["source_approved_for_election_night"])
        self.assertTrue(res["2026_early_results_are_mock_until_proven_otherwise"])
        self.assertTrue(res["http_head_only"])
        self.assertFalse(res["may_move_national_needle"])

    def test_302_external_host_reported_but_not_approved(self):
        out=evaluate({"status":302,"content_type":"text/html",
            "location":"https://cloud.example.com/download?token=secret"})
        self.assertEqual(out["redirect_hostname_only"],"cloud.example.com")
        self.assertFalse(out["xml_candidate_verified"])
        self.assertNotIn("secret",str(out))
        self.assertNotIn("location",out)

    def test_no_head_or_untrusted_content_never_becomes_result(self):
        def failed(_):raise OSError("405 HEAD unsupported")
        res=probe(failed)
        self.assertEqual(len(res["endpoint_metadata"]),2)
        self.assertEqual(res["endpoint_metadata"][0]["unavailable_reason"],
                         "405 HEAD unsupported")
        self.assertFalse(res["candidate_votes_ingested"])
        for status in [-1,0,600,"200"]:
            with self.assertRaises(ValueError):
                evaluate({"status":status})
        with self.assertRaises(ValueError):
            evaluate({"status":200,"content_length":"1e300"})

if __name__=="__main__":
    unittest.main()
