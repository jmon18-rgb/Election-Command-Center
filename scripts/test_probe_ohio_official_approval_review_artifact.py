#!/usr/bin/env python3
import datetime as dt
import json
import unittest
from probe_ohio_official_approval_review_artifact import probe
from test_build_approved_ohio_nist_results import xml

class ElectionNightMetadataReview(unittest.TestCase):
    def test_official_source_metadata_can_be_reviewed_without_any_vote_totals(self):
        data=xml(dem=24681357,rep=13579246,extra=True)
        out=probe(lambda:data,dt.datetime(2026,11,3,19,tzinfo=dt.timezone.utc))
        encoded=json.dumps(out)
        self.assertEqual(out["status"],
          "SOURCE_IDENTITY_PROPOSAL_FROM_POTENTIALLY_MOCK_XML_NOT_APPROVED")
        self.assertEqual(len(out["counties_and_other_reporting_units"]),88)
        self.assertEqual(out["original_xml_stored"],False)
        self.assertEqual(out["operator_review_required"],True)
        self.assertFalse(out["numeric_vote_counts_extracted"])
        self.assertFalse(out["candidate_votes_published"])
        self.assertFalse(out["real_election_results_verified"])
        self.assertFalse(out["may_move_national_needle"])
        self.assertFalse(out["disabled_approval_template"]["enabled"])
        self.assertNotIn("24681357",encoded)
        self.assertNotIn("13579246",encoded)
        self.assertNotIn("999999",encoded)
    def test_invalid_xml_or_source_error_produces_no_review(self):
        for getter in (lambda:b"<html>mock votes</html>",lambda: (_ for _ in ()).throw(OSError("503"))):
            with self.assertRaises((ValueError,OSError)):
                probe(getter,dt.datetime.now(dt.timezone.utc))
    def test_naive_time_rejected(self):
        with self.assertRaises(ValueError):
            probe(lambda:xml(),dt.datetime(2026,11,3,19))
if __name__=="__main__":unittest.main()
