#!/usr/bin/env python3
"""Regression: verified fraudulent pollsters cannot leak through either source."""
import datetime as dt
import unittest
from poll_source_exclusions import is_excluded_pollster
import update_polls
import update_pollresults_recent
import reconcile_poll_sources
import build_polling_estimates

class PollsterExclusionTests(unittest.TestCase):
    def test_discredited_and_provisional_firms_are_excluded(self):
        for name in ("Wedgewood Polls", "Wedgwood Polls", " WEDGEWOOD-POLLS ",
                     "Median Strategies", "SoCal Strategies"):
            with self.subTest(name=name):
                self.assertTrue(is_excluded_pollster(name))
        for name in ("Marist", "YouGov", "Public Opinion Strategies"):
            self.assertFalse(is_excluded_pollster(name))

    def test_primary_race_feed_removes_bad_studies(self):
        today=dt.datetime.now(dt.timezone.utc).date().isoformat()
        base={"end_date":today,"race_code":"TX-SEN","poll_id":"test-poll",
              "pollster":"Wedgewood Polls","dem":"47","rep":"48",
              "dem_name":"Example Democrat","rep_name":"Example Republican","n":"800"}
        good=dict(base,poll_id="good",pollster="Marist")
        races=update_polls.race_polls([base,good])
        self.assertEqual(len(races),1)
        self.assertEqual([p["pollster"] for p in races[0]["polls"]],["Marist"])

    def test_primary_generic_feed_removes_bad_studies(self):
        today=dt.datetime.now(dt.timezone.utc).date().isoformat()
        base={"end_date":today,"dem":"49","rep":"45","n":"800","lean":""}
        rows=[dict(base,pollster=name) for name in
              ("Wedgewood Polls","Wedgwood Polls","Marist","YouGov")]
        self.assertEqual([p["pollster"] for p in update_polls.generic_ballot(rows)["latest"]],
                         ["Marist","YouGov"])

    def test_supplemental_feed_rejects_excluded_firm(self):
        poll={"cycle":2026,"type":"senate","createdAt":"10/21/26 10:00",
              "endDate":"10/20/26","pollId":"123","pollster":"Wedgewood Polls",
              "state":"TX","questions":[]}
        self.assertEqual(update_pollresults_recent.convert("senate",poll),[])

    def test_model_blocks_legacy_source_rows_as_well(self):
        today=dt.datetime.now(dt.timezone.utc).date()
        base={"field_end":today.isoformat(),"dem":46.0,"rep":49.0,"margin":-3.0,
              "dem_name":"Example Democrat","rep_name":"Example Republican",
              "sample_size":850,"poll_id":"1","pollster":"Wedgewood Polls"}
        good=dict(base,poll_id="2",pollster="Marist",dem=50.0,rep=45.0,margin=5.0)
        estimate=build_polling_estimates.estimate({"polls":[base,good]},today)
        self.assertEqual(estimate["contributing_pollsters"],1)
        self.assertEqual(estimate["pollsters"][0]["name"],"Marist")
        self.assertEqual(estimate["dem_minus_rep"],5.0)

    def test_reconciliation_cannot_resurrect_bad_survey(self):
        today=dt.datetime.now(dt.timezone.utc).date()
        poll={"pollster":"Wedgewood Polls","race_code":"TX-SEN","race_type":"senate",
              "poll_id":"999","source_url":"https://example.org/survey",
              "dem_name":"Example Democrat","rep_name":"Example Republican",
              "field_end":today.isoformat(),"dem":45,"rep":47,"sample_size":600}
        race={"race_code":"TX-SEN","race_type":"senate","state":"TX",
              "latest":{"dem_name":"Example Democrat","rep_name":"Example Republican"},"polls":[]}
        self.assertFalse(reconcile_poll_sources.in_scope(poll,race,today))
        self.assertEqual(reconcile_poll_sources.candidate_observations({"races":[race]},[poll],today),[])

if __name__=="__main__":
    unittest.main()
