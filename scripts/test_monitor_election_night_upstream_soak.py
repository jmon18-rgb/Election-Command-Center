#!/usr/bin/env python3
"""Offline adversarial exercises; real wall-clock work runs only after merge."""
import unittest

from monitor_election_night_upstream_soak import measure, validate_primary, OFFICES


def valid(office):
    return {"api":1,"year":2026,"office":office,
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
