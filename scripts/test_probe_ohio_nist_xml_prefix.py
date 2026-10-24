import unittest

from probe_ohio_nist_xml_prefix import (
    ROOT_ALTERNATIVE, SCRIPT_RESOLVED, LIMIT,
    allow_target, characterize, run,
)


class OhioExportBoundedPrefix(unittest.TestCase):
    def test_exact_official_export_routes_only(self):
        self.assertTrue(allow_target(ROOT_ALTERNATIVE))
        self.assertTrue(allow_target(SCRIPT_RESOLVED))
        for url in (
            "http://liveresults.ohiosos.gov/Api/v1/download?filename=VSSC1622XmlFileBlob",
            ROOT_ALTERNATIVE + "&filename=other",
            "https://liveresults.ohiosos.gov.evil.example/Api/v1/download",
            "https://user@liveresults.ohiosos.gov/Api/v1/download?filename=VSSC1622XmlFileBlob",
            "https://liveresults.ohiosos.gov:444/Api/v1/download?filename=VSSC1622XmlFileBlob",
        ):
            self.assertFalse(allow_target(url))

    def test_xml_shape_is_not_authorization_for_live_results(self):
        blob=(b'<?xml version="1.0" encoding="utf-8"?>'
              b'<ElectionReport xmlns="urn:ohio"><Election>mock</Election></ElectionReport>')
        a=characterize(blob,{"status":206,"mime":"application/xml"})
        self.assertTrue(a["looks_like_nist_election_report_xml"])
        self.assertEqual(a["response_bytes_sampled"],len(blob))
        self.assertFalse(a["official_2026_election_verified"])
        self.assertFalse(a["candidate_votes_parsed"])
        self.assertFalse(a["complete_xml_downloaded"])
        self.assertEqual(len(a["prefix_sha256"]),64)

    def test_html_redirect_entities_and_errors_never_classed_as_nist_results(self):
        html=characterize(b"<!doctype html><html><title>503</title></html>",
                          {"status":200,"mime":"text/html"})
        self.assertFalse(html["looks_like_nist_election_report_xml"])
        self.assertTrue(html["html_or_gateway_page_detected"])
        xml=b'<!DOCTYPE ElectionReport [<!ENTITY x SYSTEM "file:///etc/passwd">]><ElectionReport/>'
        danger=characterize(xml,{"status":200,"mime":"application/xml"})
        self.assertTrue(danger["doctype_or_external_entity_risk"])
        self.assertFalse(danger["looks_like_nist_election_report_xml"])
        forbidden=characterize(b"<ElectionReport/>",{"status":302,"mime":"text/xml",
            "redirect_hostname":"untrusted.example"})
        self.assertFalse(forbidden["looks_like_nist_election_report_xml"])
        self.assertEqual(forbidden["redirect_hostname_only"],"untrusted.example")
        with self.assertRaises(ValueError):
            characterize(b"x"*(LIMIT+1),{"status":200})
        with self.assertRaises(ValueError):
            characterize(b"",{"status":"200"})

    def test_unavailable_route_does_not_fabricate_valid_xml(self):
        def fetch(url):
            if url==ROOT_ALTERNATIVE:
                return characterize(b"<ElectionReport/>",{"status":405})
            raise OSError("simulated gateway outage")
        r=run(fetch)
        self.assertEqual(len(r["probes"]),2)
        self.assertFalse(r["probes"][0]["looks_like_nist_election_report_xml"])
        self.assertIn("simulated",r["probes"][1]["error"])
        self.assertFalse(r["may_move_national_needle"])
        self.assertFalse(r["independent_vote_validation_completed"])
        self.assertTrue(r["source_approval_required_after_real_nov_3_publication"])


if __name__=="__main__":
    unittest.main()
