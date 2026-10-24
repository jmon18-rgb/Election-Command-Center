import unittest

from probe_ohio_nist_xml_schema import inspect, MAX_SAMPLE


class OhioNistXmlStructuralPrivacy(unittest.TestCase):
    def test_no_candidate_names_or_vote_values_in_output(self):
        data=(b'<?xml version="1.0" encoding="utf-8"?>'
              b'<ElectionReport xmlns="http://itl.nist.gov/ns/voting/1500-100/v1">'
              b'<Election><Contest><Candidate><Name>SECRET MOCK CANDIDATE</Name>'
              b'<VoteCount>987654321</VoteCount></Candidate></Contest></Election>'
              b'</ElectionReport>')
        report=inspect(data)
        self.assertEqual(report["root_element"],"ElectionReport")
        self.assertIn("ElectionReport/Election/Contest/Candidate/VoteCount",
                      [x["path"] for x in report["structural_paths"]])
        self.assertNotIn("SECRET MOCK CANDIDATE",str(report))
        self.assertNotIn("987654321",str(report))
        self.assertFalse(report["official_votes_ingested"])
        self.assertFalse(report["ready_for_automatic_2026_ingestion"])
        self.assertFalse(report["may_move_national_needle"])
        self.assertTrue(report["mock_data_not_live"])

    def test_dtd_html_and_oversized_bodies_rejected(self):
        for document in (
            b'<html><body>Gateway unavailable</body></html>',
            b'<!DOCTYPE ElectionReport [<!ENTITY secret SYSTEM "file:///etc/passwd">]>'
            b'<ElectionReport>&secret;</ElectionReport>',
            b'<?xml-stylesheet href="http://evil.com/evil.xsl"?><ElectionReport/>',
            b'x'*(MAX_SAMPLE+1),
            b'',
        ):
            with self.assertRaises(ValueError):
                inspect(document)

    def test_truncated_partial_export_is_shape_only(self):
        raw=b'<?xml version="1.0"?><ElectionReport><Election><Contest>'
        output=inspect(raw)
        self.assertEqual(output["root_element"],"ElectionReport")
        self.assertTrue(output["sample_incomplete_or_invalid"])
        self.assertFalse(output["official_votes_ingested"])


if __name__=="__main__":
    unittest.main()
