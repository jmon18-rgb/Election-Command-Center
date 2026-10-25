#!/usr/bin/env python3
"""Offline adversarial exercises; real wall-clock work runs only after merge."""
import unittest

from monitor_election_night_upstream_soak import (measure, validate_primary, OFFICES,
                                                 approved_primary_contests)


def valid(office):
    return {"api":1,"year":2026,"office":office,"source":"state",
        "live":False,"stale":False,"counting":False,"final":False,
        "counts":{"races":0},"races":{}}


class FakeClock:
    t=0
    def now(self):
        return self.t
    def sleep(self, seconds):
        if seconds < 0:
            raise AssertionError("Negative sleep")
        self.t += seconds


class HealthSoakTests(unittest.TestCase):
    def run_sim(self, *, source_fail=None, site_fail=None):
        counts={office:0 for office in OFFICES}
        site_attempts=[0]
        def fetch(year, office):
            self.assertEqual(year,2026)
            n=counts[office]
            counts[office]+=1
            if source_fail and source_fail(office,n):
                raise TimeoutError("Simulated provider outage")
            return valid(office)
        def website():
            attempt=site_attempts[0]
            site_attempts[0]+=1
            if site_fail and site_fail(attempt):
                raise ConnectionError("Public Pages down")
            return True
        c=FakeClock()
        result=measure(fetch,website,c.now,c.sleep,duration=120,interval=60)
        return result,counts,site_attempts[0]

    def test_actual_clock_pacing_and_pre_election_empty_feed(self):
        r,counts,site=self.run_sim()
        self.assertEqual(r["completed_checkpoints"],3)
        self.assertEqual(r["actual_elapsed_seconds"],120)
        self.assertEqual(counts,dict.fromkeys(OFFICES,3))
        self.assertEqual(site,2)
        self.assertTrue(r["status"].startswith("PASS_"))
        self.assertFalse(r["verified_2026_vote_coverage"])
        self.assertFalse(r["professional_race_calls_verified"])
        self.assertFalse(r["full_browser_endurance_test"])
        self.assertEqual(r["primary_offices"]["Senate"]["success"],3)

    def test_isolated_outage_does_not_stop_other_offices_and_recovers(self):
        r,counts,_=self.run_sim(source_fail=lambda office,i: office=="House" and i==1)
        self.assertTrue(r["status"].startswith("PASS_"))
        self.assertEqual(r["primary_offices"]["House"]["recoveries"],1)
        self.assertEqual(r["primary_offices"]["House"]["max_consecutive_failures"],1)
        self.assertEqual(r["primary_offices"]["Senate"]["success"],3)
        self.assertEqual(r["primary_offices"]["Governor"]["success"],3)
        self.assertEqual(counts["House"],3)

    def test_three_consecutive_outages_fail_the_operator_gate(self):
        r,_,_=self.run_sim(source_fail=lambda office,i: office=="Senate")
        self.assertTrue(r["status"].startswith("FAIL_"))
        self.assertEqual(r["primary_offices"]["Senate"]["max_consecutive_failures"],3)
        self.assertEqual(r["primary_offices"]["House"]["success"],3)

    def test_site_failure_never_looks_like_full_health(self):
        r,_,_=self.run_sim(site_fail=lambda i:i==1)
        self.assertTrue(r["status"].startswith("FAIL_"))
        self.assertEqual(r["public_site"]["success"],1)
        self.assertEqual(r["public_site"]["failure"],1)

    def test_malformed_or_cross_office_source_is_not_reporting(self):
        self.assertEqual(validate_primary(valid("Senate"),"Senate")["race_entries"],0)
        base=valid("Senate")
        for changed in (
            {**base,"year":2024},
            {**base,"office":"House"},
            {**base,"live":"true"},
            {**base,"counts":{"races":1}},
            {**base,"races":{"MA":{"total":10,"called":True,"winner":"D"}}},
            {**base,"races":{"MA":{"total":-1,"called":False,"winner":""}}},
            {**base,"races":{"MA":{"total":10,"called":False,"winner":"D"}}},
        ):
            with self.assertRaises(ValueError):
                validate_primary(changed,"Senate")

    def test_primary_scope_uses_exact_2026_506_contest_roster(self):
        allowed = approved_primary_contests()
        self.assertEqual(set(allowed), set(OFFICES))
        self.assertIn("TX-01", allowed["House"])
        self.assertIn("VT-00", allowed["House"],
                      "At-large primary state uses -00, not made-up -01")
        self.assertIn("NC", allowed["Senate"])
        self.assertIn("TX", allowed["Governor"])
        for office, invalid in (
            ("House", "NH-01"),        # Not one of Open America's 22 states.
            ("House", "TX-99"),        # Supported state, nonexistent district.
            ("House", "TX-00"),        # Large state cannot be at-large.
            ("House", "VT-01"),        # At-large uses exactly VT-00.
            ("Senate", "MA"),          # Outside verified primary scope.
            ("Senate", "AZ"),          # In 22-state scope, no 2026 Senate race.
            ("Governor", "NC"),        # In primary scope, not a 2026 Gov seat.
            ("Governor", "NH"),        # Governor race exists, source not scoped.
        ):
            self.assertNotIn(invalid, allowed[office])
        self.assertEqual(sum(len(v) for v in allowed.values()),
                         216 + 15 + 15)

    def test_invalid_race_keys_never_count_as_valid_transport_or_votes(self):
        import datetime as dt
        now=dt.datetime(2026,11,4,3,tzinfo=dt.timezone.utc)
        positive={"total":120,"called":False,"winner":"",
                  "cands":[{"n":"A","p":"D","v":70},
                           {"n":"B","p":"R","v":50}]}
        zero={"total":0,"called":False,"winner":"","cands":[]}
        for office, key in (
            ("House","NH-01"),("House","TX-99"),("House","TX-00"),
            ("House","VT-01"),("Senate","MA"),("Senate","AZ"),
            ("Governor","NC"),("Governor","NH"),
        ):
            for candidate in (positive,zero):
                with self.subTest(office=office,key=key,positive=candidate is positive):
                    doc={**valid(office),
                         "as_of":"2026-11-04T02:50:00Z",
                         "live":True,"counting":True,
                         "counts":{"races":1},
                         "races":{key:candidate}}
                    with self.assertRaisesRegex(ValueError,"identity"):
                        validate_primary(doc,office,now)
        # Legitimate sources still pass, including a zero-return entry.
        valid_row={**valid("House"),"as_of":"2026-11-04T02:50:00Z",
                   "live":True,"counting":True,"counts":{"races":1},
                   "races":{"TX-01":positive}}
        self.assertEqual(validate_primary(valid_row,"House",now)["reporting_contests"],1)
        valid_row["races"]={"TX-01":zero}
        self.assertFalse(validate_primary(valid_row,"House",now)["provider_reporting"])
        # A positive result without the precise state source label is not
        # verified primary-office provenance; empty standby remains allowed.
        for missing in ({}, {"source":None}, {"source":""}, {"source":"civicAPI"}):
            altered=dict(valid_row)
            altered.update(missing)
            if not missing:
                altered.pop("source")
            altered["races"]={"TX-01":positive}
            with self.assertRaisesRegex(ValueError,"state source identity"):
                validate_primary(altered,"House",now)
        empty=valid("House")
        empty.pop("source")
        self.assertFalse(validate_primary(empty,"House",now)["provider_reporting"])

    def test_explicit_test_or_inactive_envelopes_never_pass_monitor(self):
        # Empty and positive-count responses must both be excluded from a
        # clean production-source audit when provider marks them non-live.
        base=valid("Senate")
        for override in ({"is_test":True}, {"test":True}, {"mock":True},
                         {"is_mock":True}, {"active":False}):
            with self.subTest(flag=override):
                with self.assertRaisesRegex(ValueError, "mock, test or inactive"):
                    validate_primary({**base, **override}, "Senate")
        # Flags explicitly false (or absent) do not interfere with
        # a normally healthy pre-election zero-return source.
        self.assertEqual(validate_primary({
            **base, "is_test":False, "mock":False, "active":True
        }, "Senate")["race_entries"], 0)

    def test_positive_election_votes_require_candidate_integrity_and_state_clock(self):
        import datetime as dt
        now=dt.datetime(2026,11,4,3,0,tzinfo=dt.timezone.utc)
        row={"total":120,"called":False,"winner":"",
             "cands":[{"n":"Dem","p":"D","v":70},
                      {"n":"Rep","p":"R","v":50}]}
        doc={**valid("Senate"),"live":True,"counting":True,
             "as_of":"2026-11-04T02:50:00Z",
             "counts":{"races":1},"races":{"NC":row}}
        self.assertEqual(validate_primary(doc,"Senate",now)["reporting_contests"],1)
        bad_docs=[
          {**doc,"as_of":None},  # No publish time for positive votes.
          {**doc,"as_of":"2026-11-04T00:29:59Z"}, # NC polls still open.
          {**doc,"as_of":"2026-11-04T03:25:00Z"}, # Provider clock ahead.
          {**doc,"as_of":"2026-11-03T23:45:00Z"}, # Still pre-close NC.
          {**doc,"live":False,"counting":False}, # Source says not live.
          {**doc,"stale":True,"live":False,"counting":False},
          {**doc,"races":{"NC":{**row,"cands":[]}}},
          {**doc,"races":{"NC":{**row,"cands":[
            {"n":"Dem","p":"D","v":0},
            {"n":"Rep","p":"R","v":0}]}}},
          {**doc,"races":{"NC":{**row,"cands":[
            {"n":"Duplicate","p":"D","v":70},
            {"n":"duplicate","p":"R","v":50}]}}},
          {**doc,"races":{"NC":{**row,"cands":[
            {"n":"Dem","p":"D","v":110},
            {"n":"Rep","p":"R","v":50}]}}},
          {**doc,"races":{"ZZ":row}},
          {**doc,"races":{"NC":{**row,"called":True}}},
          {**doc,"year":2024},
        ]
        for candidate in bad_docs:
            with self.subTest(reason=candidate):
                with self.assertRaises(ValueError):
                    validate_primary(candidate,"Senate",now)
        stale={**doc,"as_of":"2026-11-04T02:50:00Z"}
        with self.assertRaisesRegex(ValueError,"Stale"):
            validate_primary(stale,"Senate",
              dt.datetime(2026,11,4,6,0,tzinfo=dt.timezone.utc))
        # A completed official-derived PRIMARY source is still useful after
        # live counting ends. A two-D Washington top-two contest is real
        # candidate-count data, NOT a Dem-vs-Republican modeled race.
        final={**valid("House"),"as_of":"2026-11-04T05:00:00Z",
               "live":False,"final":True,
               "counts":{"races":1},"races":{"WA-01":{
                 "total":100,"called":False,"winner":"",
                 "cands":[{"n":"First Dem","p":"D","v":55},
                          {"n":"Second Dem","p":"D","v":45}]}}}
        self.assertEqual(validate_primary(final,"House",
             dt.datetime(2026,11,4,5,20,tzinfo=dt.timezone.utc)
            )["reporting_contests"],1)
        # A pre-election empty source is a legitimate transport response,
        # never evidence that zero ballots have been cast.
        self.assertFalse(validate_primary(valid("House"),"House")["provider_reporting"])

    def test_provider_request_bounds_and_timestamps(self):
        c=FakeClock()
        def fetch(year,office):
            return valid(office)
        for duration,interval in ((59,60),(1801,60),(720,15),(720,301)):
            with self.assertRaises(ValueError):
                measure(fetch,lambda:True,c.now,c.sleep,
                        duration=duration,interval=interval)


if __name__=="__main__":
    unittest.main()
