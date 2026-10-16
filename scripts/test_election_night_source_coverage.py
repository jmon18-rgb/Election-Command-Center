#!/usr/bin/env python3
"""No-network contract tests for the published source-identity ledger."""
import json
from pathlib import Path
import unittest
from datetime import datetime, timezone, timedelta

from build_election_night_source_coverage import (
    ROOT, build, observed_house, pinned_sources, timestamp,
)


class CoverageLedgerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.universe = json.loads((ROOT / "data/seat_universe.json").read_text())
        cls.reconciler = (ROOT / "scripts/election_night_reconciliation.js").read_text()
        cls.batch = (ROOT / "scripts/civicapi_state_batch.js").read_text()
        cls.nh_sen = (ROOT / "scripts/civicapi_nh_adapter.js").read_text()
        cls.nh_gov = (ROOT / "scripts/civicapi_nh_governor_adapter.js").read_text()
        cls.now = datetime(2026, 10, 16, 16, tzinfo=timezone.utc)

    def ledger(self, **kwargs):
        return build(self.universe, self.reconciler, self.batch, self.nh_sen,
                     self.nh_gov, now=self.now, **kwargs)

    @staticmethod
    def rows(ledger):
        return {r["id"]: r for r in ledger["races"]}

    def test_exact_506_inventory_and_expected_state_scopes(self):
        report = self.ledger()
        rows = self.rows(report)
        self.assertEqual(len(rows), 506)
        self.assertEqual(report["summary"]["house"]["total"], 435)
        self.assertEqual(report["summary"]["senate"]["total"], 35)
        self.assertEqual(report["summary"]["governor"]["total"], 36)
        self.assertEqual([report["summary"][o]["primary_scope"]
                          for o in ("house", "senate", "governor")], [216, 15, 15])
        self.assertEqual([report["summary"][o]["unresolved_source_gaps"]
                          for o in ("house", "senate", "governor")], [219, 2, 2])
        self.assertEqual(rows["House|AK-00"]["source_identity_status"],
                         "NO_CURATED_PROVIDER_ID")
        self.assertNotIn("House|AK-01", rows)
        self.assertEqual(rows["House|VT-00"]["provider_scope"],
                         "Open America 22-state scope")
        self.assertIn("Senate|FL-special", rows)
        self.assertIn("Senate|OH-special", rows)
        self.assertNotIn("Senate|OH", rows)
        self.assertNotIn("Governor|NJ", rows)
        self.assertIn("Governor|NH", rows)

    def test_curated_and_scoped_sources_not_live_claims(self):
        rows = self.rows(self.ledger())
        self.assertEqual(rows["Senate|AK"]["pinned_civicapi_id"], 86916)
        self.assertEqual(rows["Governor|AK"]["pinned_civicapi_id"], 148898)
        self.assertEqual(rows["Senate|OH-special"]["pinned_civicapi_id"], 87527)
        self.assertEqual(rows["Senate|NH"]["source_identity_status"],
                         "SCOPED_ADAPTER_NO_PINNED_ID")
        self.assertEqual(rows["Governor|NH"]["source_identity_status"],
                         "SCOPED_ADAPTER_NO_PINNED_ID")
        self.assertEqual(rows["Senate|MS"]["gap_status"], "UNRESOLVED_SOURCE_GAP")
        self.assertEqual(rows["Governor|HI"]["gap_status"], "UNRESOLVED_SOURCE_GAP")
        self.assertEqual(rows["Governor|OK"]["gap_status"], "UNRESOLVED_SOURCE_GAP")
        self.assertEqual(self.ledger()["summary"]["senate"]["pinned_secondary"], 17)
        self.assertEqual(self.ledger()["summary"]["governor"]["pinned_secondary"], 18)
        for row in rows.values():
            self.assertFalse(row["live_votes_verified_by_audit"])
            self.assertFalse(row["professional_winner_call_verified_by_audit"])

    def probe(self, status="INDEXED_EXACT_RACE", key="AK-00", race_id=12510):
        row = {"district": key, "status": status}
        if status == "INDEXED_EXACT_RACE":
            row["race_id"] = race_id
        return {"status": "ROTATING_HOUSE_SOURCE_DISCOVERY_NOT_NATIONAL_AVAILABILITY",
                "window_utc": "2026-10-16T16:00:00+00:00",
                "planned_districts": 1, "results": [row]}

    def test_indexed_house_probe_is_recent_identity_not_results(self):
        first = self.ledger(probe=self.probe())
        ak = self.rows(first)["House|AK-00"]
        self.assertEqual(ak["recent_probe_status"], "INDEXED_EXACT_RACE")
        self.assertEqual(ak["gap_status"], "RECENT_EXACT_PROBE_NOT_LIVE_VERIFIED")
        self.assertEqual(ak["last_probe"]["race_id"], 12510)
        self.assertFalse(ak["live_votes_verified_by_audit"])
        self.assertEqual(first["summary"]["house"]["unresolved_source_gaps"], 218)
        stale = build(self.universe, self.reconciler, self.batch, self.nh_sen,
                      self.nh_gov, previous=first,
                      now=self.now + timedelta(hours=26))
        self.assertEqual(self.rows(stale)["House|AK-00"]["gap_status"],
                         "UNRESOLVED_SOURCE_GAP")
        self.assertEqual(self.rows(stale)["House|AK-00"]["last_probe"]["race_id"], 12510)

    def test_newer_failure_does_not_promote_prior_indexing_as_current(self):
        old = self.ledger(probe=self.probe())
        failed = self.probe("TEMPORARY_UPSTREAM_FAILURE")
        failed["window_utc"] = "2026-10-16T17:00:00+00:00"
        recent = build(self.universe, self.reconciler, self.batch, self.nh_sen,
                       self.nh_gov, previous=old, probe=failed,
                       now=self.now + timedelta(hours=2),
                       checks={"primary": "success", "secondary": "failure",
                               "house_probe": "failure"})
        ak = self.rows(recent)["House|AK-00"]
        self.assertEqual(ak["recent_probe_status"], "TEMPORARY_UPSTREAM_FAILURE")
        self.assertEqual(ak["gap_status"], "UNRESOLVED_SOURCE_GAP")
        self.assertEqual(recent["preflight_checks"]["house_probe"], "failure")
        self.assertFalse(ak["live_votes_verified_by_audit"])

    def test_unprobed_district_not_mislabeled_unindexed(self):
        missing = self.rows(self.ledger())["House|NY-17"]
        self.assertEqual(missing["recent_probe_status"], "NEVER_CHECKED")
        self.assertEqual(missing["gap_status"], "UNRESOLVED_SOURCE_GAP")
        noindex = self.rows(self.ledger(probe=self.probe("NOT_INDEXED", "NY-17")))["House|NY-17"]
        self.assertEqual(noindex["recent_probe_status"], "NOT_INDEXED")
        self.assertIsNone(noindex["last_probe"]["race_id"])

    def test_bad_probes_and_identity_are_rejected(self):
        for invalid in (
            self.probe(key="NH-99"),
            self.probe(key="TX-01"),
            self.probe(race_id=0),
            self.probe(status="NOT_INDEXED", race_id=44),
        ):
            if invalid["results"][0]["status"] == "NOT_INDEXED":
                invalid["results"][0]["race_id"] = 44
            with self.assertRaises(ValueError):
                self.ledger(probe=invalid)
        dup = self.probe()
        dup["results"].append(dict(dup["results"][0]))
        dup["planned_districts"] = 2
        with self.assertRaises(ValueError):
            self.ledger(probe=dup)

    def test_invalid_previous_snapshot_is_rejected(self):
        prior = self.ledger()
        prior["races"] = prior["races"][:-1]
        with self.assertRaises(ValueError):
            self.ledger(previous=prior)

    def test_all_preflight_checks_have_explicit_outcomes(self):
        with self.assertRaises(ValueError):
            self.ledger(checks={"primary": "success"})
        with self.assertRaises(ValueError):
            self.ledger(checks={"primary": "healthy", "secondary": "success",
                                "house_probe": "success"})

    def test_parsers_fail_closed_if_registry_missing(self):
        with self.assertRaises(ValueError):
            self.ledger(batch_js="const RACES=Object.freeze({});")
        with self.assertRaises(ValueError):
            self.ledger(reconciliation_js="missing governor inventory")
        with self.assertRaises(ValueError):
            self.ledger(nh_senate_js="missing scoped adapter")


if __name__ == "__main__":
    unittest.main()
