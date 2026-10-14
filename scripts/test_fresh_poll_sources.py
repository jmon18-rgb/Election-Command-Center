#!/usr/bin/env python3
"""Synthetic regression tests: release process must tolerate new names and polls."""
import copy
import datetime as dt
import unittest

import validate_fresh_poll_sources as v


class FreshPollSourcesTests(unittest.TestCase):
    def setUp(self):
        self.now=dt.datetime(2026,10,14,21,0,tzinfo=dt.timezone.utc)
        at=(self.now-dt.timedelta(minutes=5)).isoformat().replace("+00:00","Z")
        self.at=at
        races=[]
        for n in range(45):
            code=f"TX-{n+1:02d}"
            # Purposely invented pollsters, candidates and share distributions:
            # CI never relies on the exact live names.
            races.append({"race_code":code,"race_type":"house",
             "polls":[{"poll_id":f"id-{n}","field_end":"2026-10-13",
             "pollster":f"Contemporary Source {n}",
             "dem_name":f"Candidate D {n}","rep_name":f"Candidate R {n}",
             "dem":47.0,"rep":45.0}]})
        self.primary={"updated_at":at,"health":{
         "last_attempt_at":at,"successful_sections":["races","generic_ballot"],
         "status":"ok","errors":[]},"races":races,
         "generic_ballot":{"latest":[{"pollster":"A"},{"pollster":"B"}]}}
        self.secondary={"updated_at":at,
         "observations":[{"poll_id":f"r{i}"} for i in range(20)]}
        self.estimates={"source_snapshot":at,"generated_at":at,
         "senate_all":[]}

    def verify(self,**changes):
        return v.verify(changes.get("primary",self.primary),
                        changes.get("secondary",self.secondary),
                        changes.get("estimates",self.estimates),now=self.now)

    def test_new_names_and_dates_do_not_break_refresh(self):
        out=self.verify()
        self.assertEqual(out["race_count"],45)
        self.assertEqual(out["supplemental_status"],"current")
        self.assertEqual(out["poll_count"],45)

    def test_reject_old_snapshot(self):
        p=copy.deepcopy(self.primary)
        p["updated_at"]="2026-10-13T08:00:00Z"
        with self.assertRaisesRegex(ValueError,"not current"):
            self.verify(primary=p)

    def test_reject_partial_failed_provider(self):
        p=copy.deepcopy(self.primary)
        p["health"]["status"]="partial"
        p["health"]["errors"]=["generic: timed out"]
        with self.assertRaisesRegex(ValueError,"incomplete"):
            self.verify(primary=p)

    def test_reject_old_estimates_after_good_new_poll_source(self):
        x=copy.deepcopy(self.estimates)
        x["source_snapshot"]="2026-10-13T08:00:00Z"
        with self.assertRaisesRegex(ValueError,"OLD poll snapshot"):
            self.verify(estimates=x)

    def test_duplicate_observation_rejected(self):
        p=copy.deepcopy(self.primary)
        p["races"][0]["polls"].append(copy.deepcopy(p["races"][0]["polls"][0]))
        with self.assertRaisesRegex(ValueError,"Duplicate exact poll"):
            self.verify(primary=p)

    def test_stale_supplement_warns_but_keeps_primary(self):
        q=copy.deepcopy(self.secondary)
        q["updated_at"]="2026-10-12T08:00:00Z"
        out=self.verify(secondary=q)
        self.assertEqual(out["supplemental_status"],"stale_warning")


if __name__=="__main__":
    unittest.main()
