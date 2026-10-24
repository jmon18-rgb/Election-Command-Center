#!/usr/bin/env python3
import copy
import json
import unittest
from prepare_ohio_nist_manual_review import collect
from test_build_approved_ohio_nist_results import xml,NS
from build_approved_ohio_nist_results import approve

class SourceOnlyOhioReviewProposal(unittest.TestCase):
    def test_source_identity_inventory_never_activates_mock_votes(self):
        # Deliberately include huge synthetic vote values which must never
        # appear in proposal metadata or operator logs.
        raw=xml(dem=12345678,rep=87654321)
        proposed=collect(raw)
        self.assertEqual(proposed["schema"],"ohio-nist-metadata-review-draft-v1")
        self.assertEqual(len(proposed["counties_and_other_reporting_units"]),88)
        self.assertEqual(len(proposed["source_party_objects"]),2)
        self.assertEqual(len(proposed["reviewable_senate_house_governor_contests"]),1)
        self.assertEqual(proposed["reviewable_senate_house_governor_contests"][0]["source_contest_id"],
                         "cSen")
        self.assertEqual(proposed["reviewable_senate_house_governor_contests"][0]["candidate_ids"],
                         ["candidateD","candidateR"])
        self.assertEqual(proposed["reviewable_senate_house_governor_contests"][0]["candidates"][0]["source_ballot_name"],
                         "Fixture Blue")
        self.assertFalse(proposed["disabled_approval_template"]["enabled"])
        self.assertFalse(proposed["disabled_approval_template"]["real_results_publication_reviewed"])
        self.assertIsNone(proposed["disabled_approval_template"]["source_reviewed_at"])
        self.assertFalse(proposed["numeric_vote_counts_extracted"])
        self.assertFalse(proposed["candidate_votes_published"])
        self.assertFalse(proposed["may_move_national_needle"])
        serialized=json.dumps(proposed)
        self.assertNotIn("12345678",serialized)
        self.assertNotIn("87654321",serialized)
        self.assertNotIn('"Count":',serialized)
        with self.assertRaises(ValueError):
            approve(proposed["disabled_approval_template"],__import__('datetime').datetime(
                2026,11,4,1,tzinfo=__import__('datetime').timezone.utc))

    def test_wrong_election_dtd_missing_or_duplicate_ids_rejected(self):
        fixtures=[
            xml(date="2024-11-05"),
            b"<!DOCTYPE Ohio [<!ENTITY x SYSTEM 'file:///etc/hosts'>]><test/>",
            xml().replace(b'<GpUnit ObjectId="g1"',b'<GpUnit ObjectId="g0"'),
            xml().replace(b'<Party ObjectId="pR"',b'<Party ObjectId="pD"'),
            xml().replace(b'<Candidate ObjectId="candidateR"',b'<Candidate ObjectId="candidateD"'),
            xml().replace(b'http://grouper.ieee.org',b'http://untrusted.example.com'),
            b"",
        ]
        for source in fixtures:
            with self.assertRaises(ValueError):
                collect(source)
    def test_unapproved_result_has_no_votes_even_if_source_has_statewide_rollups(self):
        doc=collect(xml(extra=True))
        self.assertFalse(doc["real_election_results_verified"])
        self.assertFalse(doc["may_move_national_needle"])
        self.assertEqual(doc["disabled_approval_template"]["county_gpunit_to_fips"],{})
        self.assertEqual(doc["disabled_approval_template"]["approved_contests"],[])
        self.assertTrue(all(r["reviewed_fips"] is None
                            for r in doc["counties_and_other_reporting_units"]))

if __name__=="__main__":unittest.main()
