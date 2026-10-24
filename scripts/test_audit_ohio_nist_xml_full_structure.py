import io
import unittest
from audit_ohio_nist_xml_full_structure import inspect_stream, MAX_BYTES


class OhioMockStructureStream(unittest.TestCase):
    def test_complete_export_exposes_only_tags_and_attribute_names(self):
        doc=(b'<?xml version="1.0"?><ElectionReport xmlns="urn:mock" Date="2026-11-03">'
             b'<ElectionCollection><Election Id="SECRET-OHIO">'
             b'<ContestCollection><Contest Office="Senate">'
             b'<Candidate Name="SHOULD NOT LEAK">SECRET CANDIDATE'
             b'<VoteCount>123456789</VoteCount></Candidate>'
             b'</Contest></ContestCollection></Election>'
             b'</ElectionCollection></ElectionReport>')
        r=inspect_stream(io.BytesIO(doc))
        self.assertTrue(r["xml_complete_within_budget"])
        self.assertIn("ElectionReport/ElectionCollection/Election/ContestCollection/Contest",
            [x["path"] for x in r["element_paths"]])
        s=str(r)
        self.assertNotIn("SECRET CANDIDATE",s)
        self.assertNotIn("123456789",s)
        self.assertNotIn("SHOULD NOT LEAK",s)
        self.assertNotIn("SECRET-OHIO",s)
        self.assertIn("Name",s)
        self.assertFalse(r["candidate_totals_ingested"])
        self.assertFalse(r["may_move_national_needle"])

    def test_budget_limit_never_promotes_partial_election_to_live(self):
        data=b'<ElectionReport><Election><Contest /></Election></ElectionReport>'
        r=inspect_stream(io.BytesIO(data),max_bytes=28)
        self.assertFalse(r["xml_complete_within_budget"])
        self.assertTrue(r["reached_byte_budget"])
        self.assertFalse(r["candidate_totals_ingested"])

    def test_hostile_xml_and_invalid_root_rejected(self):
        for payload in (
            b'<html><div>Something else</div></html>',
            b'<!DOCTYPE ElectionReport [<!ENTITY x SYSTEM "file:///etc/passwd">]>'
            b'<ElectionReport>&x;</ElectionReport>',
            b'<ElectionReport><Unclosed>',
            b'<ElectionReport><x></ElectionReport>',
        ):
            with self.assertRaises((ValueError,Exception)) as cm:
                inspect_stream(io.BytesIO(payload))
            self.assertTrue(bool(cm.exception))

    def test_empty_stream_rejected(self):
        with self.assertRaises(ValueError):
            inspect_stream(io.BytesIO(b''))


if __name__=="__main__":
    unittest.main()
