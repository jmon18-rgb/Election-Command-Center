#!/usr/bin/env python3
"""No-network exact source selection, arithmetic and poll-close regressions."""
import unittest
from datetime import datetime, timezone, timedelta

from verify_new_statewide_civicapi_pins_2026 import EXPECTED, audit
from probe_missing_statewide_sources_2026 import CLOSE_UTC


def make_row(state, office, rid, name):
    return {"id": rid, "country": "US", "province": state,
            "district": None, "municipality": None,
            "election_date": "2026-11-03T05:00:00.000Z",
            "election_name": name, "type": "US Senate" if office == "Senate" else "Governor",
            "election_type": "General" if office == "Senate" else "Statewide"}


class NewPinsTests(unittest.TestCase):
    def setUp(self):
        self.search_test_data = False
        self.rows = {st: make_row(st, office, rid, name)
                     for st, office, _, rid, name in EXPECTED}
        self.detail = {st: {**row, "election_type": row["type"],
                           "percent_reporting": 0, "last_updated": None,
                           "candidates": [
                              {"name": "Candidate D", "party": "Democratic",
                               "votes": 0, "percent": 0, "winner": False},
                              {"name": "Candidate R", "party": "Republican",
                               "votes": 0, "percent": 0, "winner": False},
                           ]} for st, row in self.rows.items()}
        for d in self.detail.values():
            d.pop("id")  # Source API may omit its redundant URL path ID.

    def fetch(self, path, params):
        if path == "/race/search":
            state = params["province"]
            self.assertEqual(params["startDate"], "2026-11-03")
            self.assertEqual(params["endDate"], "2026-11-03")
            return {"races": [self.rows[state]], "count": 1, "test_data": self.search_test_data}
        wanted = int(path.split("/")[-1])
        state = next(st for st, row in self.rows.items() if row["id"] == wanted)
        return self.detail[state]

    def test_three_exact_source_identities_are_not_vote_certification(self):
        result = audit(self.fetch, datetime(2026, 10, 24, tzinfo=timezone.utc))
        self.assertEqual(result["races_checked"], 3)
        self.assertFalse(result["actual_live_vote_coverage_guaranteed"])
        self.assertEqual({r["race"] for r in result["races"]},
                         {"Senate|MS", "Governor|HI", "Governor|OK"})
        self.assertTrue(all(r["exact_2026_identity"] and
                            r["adapter_shape_compatible"] and
                            not r["positive_vote_feed_verified"] and
                            not r["may_update_forecast"] for r in result["races"]))

    def test_mismatched_name_or_id_or_candidate_shape_fails_closed(self):
        now = datetime(2026, 10, 24, tzinfo=timezone.utc)
        for change in (
            lambda: self.rows["MS"].update(id=999),
            lambda: self.rows["MS"].update(election_name="Mississippi House"),
            lambda: self.detail["OK"]["candidates"][0].update(percent=101),
            lambda: self.detail["HI"].update(percent_reporting=None),
            lambda: self.detail["HI"].update(id=999),
        ):
            self.setUp()
            change()
            with self.assertRaises(ValueError):
                audit(self.fetch, now)

    def test_preclose_votes_are_not_evidence_of_live_result_coverage(self):
        now = datetime(2026, 10, 24, tzinfo=timezone.utc)
        for state in self.rows:
            self.setUp()
            c = self.detail[state]["candidates"]
            c[0].update(votes=600, percent=60)
            c[1].update(votes=400, percent=40)
            self.detail[state]["last_updated"] = (CLOSE_UTC[state] -
                timedelta(minutes=1)).isoformat()
            with self.assertRaises(ValueError):
                audit(self.fetch, now)

    def test_postclose_valid_counted_source_shape_is_not_a_call(self):
        self.setUp()
        for state in self.rows:
            d = self.detail[state]
            d["percent_reporting"] = 30
            d["last_updated"] = (CLOSE_UTC[state] + timedelta(minutes=20)).isoformat()
            d["candidates"][0].update(votes=550, percent=55)
            d["candidates"][1].update(votes=450, percent=45)
        now = datetime(2026, 11, 4, 7, 0, tzinfo=timezone.utc)
        result = audit(self.fetch, now)
        self.assertTrue(all(r["positive_vote_feed_verified"] for r in result["races"]))
        self.assertFalse(result["actual_live_vote_coverage_guaranteed"])
        for state in self.rows:
            self.assertLess(CLOSE_UTC[state], now)

    def test_actual_provider_test_flag_is_excluded_before_and_after_close(self):
        for now in [datetime(2026, 10, 25, tzinfo=timezone.utc), datetime(2026, 11, 4, 7, tzinfo=timezone.utc)]:
            self.setUp()
            for detail in self.detail.values():
                detail['test_data'] = True
                detail['candidates'][0].update(votes=900, percent=90, winner=True)
                detail['candidates'][1].update(votes=100, percent=10)
            report = audit(self.fetch, now)
            self.assertEqual(report['test_data_sources_excluded'], 3)
            for row in report['races']:
                self.assertEqual(row['source_status'], 'TEST_DATA_EXCLUDED_NOT_LIVE')
                self.assertEqual(row['accepted_live_votes'], 0)
                self.assertFalse(row['adapter_shape_compatible'])
                self.assertFalse(row['positive_vote_feed_verified'])
                self.assertFalse(row['may_update_forecast'])
            self.detail['MS']['province'] = 'HI'
            with self.assertRaises(ValueError):
                audit(self.fetch, now)

    def test_search_envelope_test_flag_cannot_approve_healthy_looking_details(self):
        self.search_test_data = True
        report = audit(self.fetch, datetime(2026, 11, 4, 7, tzinfo=timezone.utc))
        self.assertEqual(report['test_data_sources_excluded'], 3)
        self.assertTrue(all(not row['positive_vote_feed_verified'] and not row['adapter_shape_compatible']
                            for row in report['races']))


if __name__ == "__main__":
    unittest.main()
