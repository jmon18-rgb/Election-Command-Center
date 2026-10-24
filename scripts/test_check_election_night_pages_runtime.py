#!/usr/bin/env python3
"""Offline tests of actual 506-race Pages files and served-asset contracts."""
import copy
from datetime import timedelta
import json
from pathlib import Path
import unittest

from check_election_night_pages_runtime import audit, git_revision, ROOT, REQUIRED, timestamp


class PagesDeploymentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.index = (ROOT / "index.html").read_bytes()
        cls.pins = json.loads((ROOT / "data/election_night_house_pins.json").read_text())
        cls.coverage = json.loads(
            (ROOT / "data/election_night_source_coverage.json").read_text())
        cls.assets = {name: (ROOT / "scripts" / name).read_bytes()
                      for name in REQUIRED}
        cls.now = timestamp(cls.pins["generated_at"]) + timedelta(minutes=5)

    def verify(self, index=None, pins=None, coverage=None, assets=None, now=None):
        return audit(
            self.index if index is None else index,
            self.pins if pins is None else pins,
            self.coverage if coverage is None else coverage,
            self.assets if assets is None else assets,
            self.pins, self.now if now is None else now)

    def test_real_checked_in_assets_and_identity_inventory(self):
        result = self.verify()
        self.assertEqual(result["status"], "DEPLOYED_PAGES_ENTRYPOINT_VERIFIED")
        self.assertEqual(result["script_versions_checked"], 6)
        self.assertEqual(result["races_in_deployed_source_ledger"], 506)
        self.assertGreater(result["verified_house_id_hints"], 100)
        self.assertFalse(result["votes_or_winner_calls_queried"])
        self.assertFalse(result["real_time_results_guaranteed"])
        self.assertEqual(len(git_revision(b"script")), 12)

    def test_old_index_cannot_pass_merely_because_git_is_green(self):
        old = self.index.replace(
            b"let enHousePinsPromise=null,enHousePinsCheckedAt=-Infinity,enHousePinsCheckOK=false;",
            b"let enHousePinsPromise=null;")
        self.assertNotEqual(old, self.index)
        with self.assertRaisesRegex(ValueError, "open-tab Election Night"):
            self.verify(index=old)

    def test_deployed_old_tab_cannot_omit_election_day_handoff(self):
        stale = self.index.replace(
            b"function enElectionNightAutoHandoff(now=Date.now()){",
            b"function enElectionNightAutoHandoffDISABLED(now=Date.now()){")
        self.assertNotEqual(stale, self.index)
        with self.assertRaisesRegex(ValueError, "open-tab Election Night contract"):
            self.verify(index=stale)

    def test_supplemental_statewide_js_deployment_stays_fingerprinted(self):
        self.assertIn("civicapi_state_batch.js", self.assets)
        bad = self.assets.copy()
        bad["civicapi_state_batch.js"] += b"\n// outdated supplemental source adapter\n"
        with self.assertRaisesRegex(ValueError, "blob/version mismatch"):
            self.verify(assets=bad)

    def test_stale_manifest_rejected_by_real_browser_after_48_hours(self):
        with self.assertRaisesRegex(ValueError, "expire in the real browser"):
            self.verify(now=self.now+timedelta(hours=49))

    def test_needle_missing_local_poll_close_guard_cannot_be_approved(self):
        needle=self.assets["election_night_nowcast.js"]
        self.assertIn(b"pollsClosedFor(item,actual.asOf,now)", needle)
        self.assertIn(b"pollsClosedFor(item,new Date(now).toISOString(),now)",needle)
        bad=self.assets.copy()
        bad["election_night_nowcast.js"]=needle.replace(
            b"pollsClosedFor(item,actual.asOf,now)",
            b"true")
        with self.assertRaisesRegex(ValueError, "local poll-close protections"):
            self.verify(assets=bad)
        bad2=self.assets.copy()
        bad2["election_night_nowcast.js"]=needle.replace(
            b"pollsClosedFor(item,new Date(now).toISOString(),now)",
            b"true")
        with self.assertRaisesRegex(ValueError, "local poll-close protections"):
            self.verify(assets=bad2)

    def test_modified_deployed_js_rejected_despite_valid_html(self):
        bad = self.assets.copy()
        bad["election_night_transport.js"] += b"\n// wrong deployed build\n"
        with self.assertRaisesRegex(ValueError, "blob/version mismatch"):
            self.verify(assets=bad)

    def test_missing_or_swapped_source_identities_do_not_pass(self):
        wrong = copy.deepcopy(self.pins)
        if wrong["races"]:
            wrong["races"][0]["race_id"] += 9999
        else:
            wrong["status"] = "UNKNOWN"
        with self.assertRaises(ValueError):
            self.verify(pins=wrong)

    def test_incomplete_506_contest_inventory_cannot_pass(self):
        wrong = copy.deepcopy(self.coverage)
        wrong["races"].pop()
        with self.assertRaisesRegex(ValueError, "506 unique contests"):
            self.verify(coverage=wrong)

    def test_no_election_night_winner_call_in_manifest(self):
        self.assertEqual(self.pins["status"],
                         "VERIFIED_HOUSE_IDENTITIES_NOT_LIVE_RESULTS")
        self.assertTrue(all("votes" not in r and "called" not in r
                            for r in self.pins["races"]))


if __name__ == "__main__":
    unittest.main()
