#!/usr/bin/env python3
"""Regression: same pollster/date/candidates can produce two different polls."""
import unittest
from poll_source_identity import matches_source_poll


class IdentityTests(unittest.TestCase):
    def setUp(self):
        self.race={"dem_candidate":"Candidate A","rep_candidate":"Candidate B"}
        self.pick={"name":"Example Surveys","field_end":"2026-10-12","poll_id":"id-A"}
        self.poll={"pollster":"Example Surveys","field_end":"2026-10-12",
         "poll_id":"id-A","dem_name":"Candidate A","rep_name":"Candidate B",
         "dem":52.0,"rep":43.0}

    def test_exact_id_is_required_for_named_races(self):
        self.assertTrue(matches_source_poll(self.poll,self.pick,self.race,False))
        alternate={**self.poll,"poll_id":"id-B","dem":48.0,"rep":47.0}
        self.assertFalse(matches_source_poll(alternate,self.pick,self.race,False))
        self.assertEqual(len([p for p in [alternate,self.poll]
          if matches_source_poll(p,self.pick,self.race,False)]),1)

    def test_candidate_mismatch_rejected(self):
        self.assertFalse(matches_source_poll({**self.poll,"dem_name":"Other"},
          self.pick,self.race,False))

    def test_missing_poll_id_fails_closed_for_races(self):
        self.assertFalse(matches_source_poll(self.poll,
          {**self.pick,"poll_id":None},self.race,False))

    def test_generic_ballot_without_ids_uses_original_matching_rule(self):
        self.assertTrue(matches_source_poll(
          {"pollster":"Example Surveys","field_end":"2026-10-12"},
          {"name":"Example Surveys","field_end":"2026-10-12"},self.race,True))


if __name__=="__main__":
    unittest.main()
