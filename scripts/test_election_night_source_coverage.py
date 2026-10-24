#!/usr/bin/env python3
"""No-network contract tests for the published source-identity ledger."""
import json
from pathlib import Path
import unittest
from datetime import datetime, timezone, timedelta

from build_election_night_source_coverage import (
    ROOT, build, observed_house, pinned_sources, timestamp, house_pins,
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
        inputs = dict(universe=self.universe, reconciliation_js=self.reconciler,
                      batch_js=self.batch, nh_senate_js=self.nh_sen,
                      nh_governor_js=self.nh_gov, now=self.now)
        inputs.update(kwargs)
        return build(**inputs)

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
                          for o in ("house", "senate", "governor")], [219, 1, 0])
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

    def test_every_senate_race_source_identity_never_implies_live_votes(self):
        """All 35 exact seats must retain honest readiness labels."""
        report = self.ledger()
        senate = [r for r in report["races"] if r["office"] == "Senate"]
        self.assertEqual(len(senate), 35)
        self.assertEqual(len({r["key"] for r in senate}), 35)
        expected = {
            "PRIMARY_PROVIDER_STATE_SCOPE": 15,
            "PINNED_PREVIOUSLY_VERIFIED_ID": 18,
            "SCOPED_ADAPTER_NO_PINNED_ID": 1,
            "NO_CURATED_PROVIDER_ID": 1,
        }
        counts = {status: sum(r["source_identity_status"] == status for r in senate)
                  for status in expected}
        self.assertEqual(counts, expected)
        self.assertEqual({r["key"] for r in senate
                          if r["source_identity_status"] == "NO_CURATED_PROVIDER_ID"},
                         {"MA"})
        self.assertEqual([r["key"] for r in senate
                          if r["source_identity_status"] == "SCOPED_ADAPTER_NO_PINNED_ID"],
                         ["NH"])
        for row in senate:
            self.assertFalse(row["live_votes_verified_by_audit"], row["id"])
            self.assertFalse(row["professional_winner_call_verified_by_audit"], row["id"])
            self.assertNotEqual(row["gap_status"], "LIVE_RESULTS_VERIFIED", row["id"])
            if row["source_identity_status"] == "PINNED_PREVIOUSLY_VERIFIED_ID":
                self.assertIsInstance(row["pinned_civicapi_id"], int)
                self.assertGreater(row["pinned_civicapi_id"], 0)
            else:
                self.assertIsNone(row["pinned_civicapi_id"])

    def test_important_house_races_preserve_exact_source_status(self):
        """Silver-watch-relevant races cannot inherit state-level live claims."""
        report = self.ledger()
        rows = self.rows(report)
        primary = ("PA-07", "VA-02", "NC-01")
        supplemental = ("ME-02", "NE-02", "NY-17", "WI-03", "CA-13")
        pins = {r["district"]: r["race_id"] for r in house_pins(
            json.loads((ROOT / "data/election_night_source_coverage.json").read_text())
        )["races"]}
        for code in primary:
            row = rows["House|" + code]
            self.assertEqual(row["source_identity_status"], "PRIMARY_PROVIDER_STATE_SCOPE")
            self.assertIsNone(row["pinned_civicapi_id"])
            self.assertFalse(row["live_votes_verified_by_audit"])
            self.assertNotIn(code, pins)
        for code in supplemental:
            row = rows["House|" + code]
            self.assertEqual(row["provider_scope"], "outside primary")
            self.assertFalse(row["live_votes_verified_by_audit"])
            self.assertIn(code, pins, "High-information House pin missing: " + code)
            self.assertIsInstance(pins[code], int)
            self.assertGreater(pins[code], 0)
        self.assertEqual(len(pins), len(set(pins.values())),
                         "One provider race ID must not map to multiple districts")

    def test_seven_unpinned_house_gaps_remain_unverified(self):
        """Unknown results sources must not inherit neighboring district pins."""
        saved = json.loads((ROOT / "data/election_night_source_coverage.json").read_text())
        rows = self.rows(saved)
        pinned = {r["district"] for r in house_pins(saved)["races"]}
        unresolved = {"AK-00", "DE-00", "ND-00", "NH-01",
                      "NH-02", "SD-00", "WY-00"}
        outside = [r for r in saved["races"] if r["office"] == "House"
                   and r["provider_scope"] == "outside primary"]
        unpinned = {r["key"] for r in outside} - pinned
        self.assertEqual(unpinned, unresolved)
        self.assertEqual(len(outside), 219)
        for code in unresolved:
            row = rows["House|" + code]
            self.assertEqual(row["source_identity_status"], "NO_CURATED_PROVIDER_ID")
            self.assertEqual(row["gap_status"], "UNRESOLVED_SOURCE_GAP")
            self.assertEqual(row["last_probe"]["status"], "NOT_INDEXED")
            self.assertFalse(row["live_votes_verified_by_audit"])
            self.assertIsNone(row["pinned_civicapi_id"])

    def test_curated_and_scoped_sources_not_live_claims(self):
        rows = self.rows(self.ledger())
        self.assertEqual(rows["Senate|AK"]["pinned_civicapi_id"], 86916)
        self.assertEqual(rows["Governor|AK"]["pinned_civicapi_id"], 148898)
        self.assertEqual(rows["Senate|OH-special"]["pinned_civicapi_id"], 87527)
        self.assertEqual(rows["Senate|NH"]["source_identity_status"],
                         "SCOPED_ADAPTER_NO_PINNED_ID")
        self.assertEqual(rows["Governor|NH"]["source_identity_status"],
                         "SCOPED_ADAPTER_NO_PINNED_ID")
        self.assertEqual(rows["Senate|AK"]["preflight_scope"], "supplemental_contract")
        self.assertEqual(rows["Senate|AK"]["latest_preflight_outcome"], "not_checked")
        self.assertEqual(rows["House|TX-01"]["preflight_scope"], "primary_contract")
        self.assertEqual(rows["Senate|MS"]["pinned_civicapi_id"], 81004)
        self.assertEqual(rows["Senate|MA"]["gap_status"], "UNRESOLVED_SOURCE_GAP")
        for code in ("Senate|MS", "Governor|HI", "Governor|OK"):
            self.assertEqual(rows[code]["gap_status"], "PINNED_ID_NOT_LIVE_VERIFIED")
            self.assertFalse(rows[code]["live_votes_verified_by_audit"])
            self.assertFalse(rows[code]["professional_winner_call_verified_by_audit"])
        self.assertEqual(rows["Governor|HI"]["pinned_civicapi_id"], 87100)
        self.assertEqual(rows["Governor|OK"]["pinned_civicapi_id"], 87582)
        self.assertEqual(self.ledger()["summary"]["senate"]["pinned_secondary"], 18)
        self.assertEqual(self.ledger()["summary"]["governor"]["pinned_secondary"], 20)
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
                         "RECENT_EXACT_PROBE_NOT_LIVE_VERIFIED")
        self.assertEqual(self.rows(stale)["House|AK-00"]["recent_probe_status"],
                         "NOT_RECENTLY_CHECKED")
        self.assertEqual(self.rows(stale)["House|AK-00"]["last_probe"]["race_id"], 12510)
        expired = build(self.universe, self.reconciler, self.batch,
                        self.nh_sen, self.nh_gov, previous=stale,
                        now=self.now + timedelta(days=11))
        self.assertEqual(self.rows(expired)["House|AK-00"]["gap_status"],
                         "UNRESOLVED_SOURCE_GAP")
        self.assertEqual(expired["summary"]["house"]["unresolved_breakdown"][
                         "expired_exact_identity"], 1)

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

    def test_source_backlog_reconciles_unchecked_vs_unavailable(self):
        empty = self.ledger()["summary"]["house"]
        self.assertEqual(empty["unresolved_breakdown"]["never_checked"], 219)
        self.assertEqual(sum(empty["unresolved_breakdown"].values()),
                         empty["unresolved_source_gaps"])
        self.assertEqual(empty["verified_usable_id_hints"], 0)
        notindexed = self.ledger(probe=self.probe("NOT_INDEXED"))["summary"]["house"]
        self.assertEqual(notindexed["unresolved_breakdown"]["checked_not_indexed"], 1)
        self.assertEqual(notindexed["unresolved_breakdown"]["never_checked"], 218)
        indexed = self.ledger(probe=self.probe())["summary"]["house"]
        self.assertEqual(indexed["verified_usable_id_hints"], 1)
        self.assertEqual(indexed["unresolved_source_gaps"], 218)
        self.assertEqual(sum(indexed["unresolved_breakdown"].values()), 218)

    def test_skipped_probe_does_not_erase_prior_exact_id(self):
        before = self.ledger(probe=self.probe())
        stopped = self.probe("NOT_CHECKED_UPSTREAM_PAUSED")
        stopped["window_utc"] = "2026-10-16T17:00:00+00:00"
        after = build(self.universe, self.reconciler, self.batch,
                      self.nh_sen, self.nh_gov, previous=before,
                      probe=stopped, now=self.now + timedelta(hours=2))
        row = self.rows(after)["House|AK-00"]
        self.assertEqual(row["last_probe"]["status"], "INDEXED_EXACT_RACE")
        self.assertEqual(row["last_probe"]["race_id"], 12510)
        self.assertTrue(row["verified_identity_hint_usable"])
        self.assertEqual(house_pins(after)["races"][0]["race_id"], 12510)
        new_unobserved = self.ledger(probe=self.probe(
            "NOT_CHECKED_UPSTREAM_PAUSED"))["summary"]["house"]
        self.assertEqual(new_unobserved["unresolved_breakdown"][
                         "skipped_due_to_upstream_pause"], 1)
        self.assertEqual(new_unobserved["unresolved_breakdown"]["never_checked"], 218)

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

    def test_checked_in_ledger_is_full_and_nonreporting(self):
        initial = json.loads((ROOT / "data/election_night_source_coverage.json").read_text())
        self.assertEqual(initial["status"], "SOURCE_IDENTITY_AUDIT_NOT_LIVE_RESULTS_COVERAGE")
        self.assertEqual(len(initial["races"]), 506)
        self.assertEqual(len({r["id"] for r in initial["races"]}), 506)
        expected = self.ledger()
        self.assertEqual(set(self.rows(initial)), set(self.rows(expected)),
                         "The auditable census cannot change with source activity")
        for office in ("house", "senate", "governor"):
            for key in ("total", "primary_scope", "pinned_secondary", "scoped_secondary"):
                self.assertEqual(initial["summary"][office][key],
                                 expected["summary"][office][key])
        from build_election_night_source_coverage import timestamp
        rebuilt = self.ledger(previous=initial,
                              now=timestamp(initial["generated_at"]))["summary"]
        for office, row in initial["summary"].items():
            for key, value in row.items():
                self.assertEqual(rebuilt[office][key], value,
                                 "Committed source evidence must remain reproducible")
        self.assertTrue(all(not r["live_votes_verified_by_audit"] for r in initial["races"]))

    def test_house_manifest_only_contains_recent_exact_outside_primary_ids(self):
        report = self.ledger(probe=self.probe())
        pins = house_pins(report)
        self.assertEqual(pins["status"], "VERIFIED_HOUSE_IDENTITIES_NOT_LIVE_RESULTS")
        self.assertEqual([r["district"] for r in pins["races"]], ["AK-00"])
        self.assertEqual(pins["races"][0]["race_id"], 12510)
        self.assertEqual(house_pins(self.ledger())["races"], [])
        self.assertEqual(house_pins(
            self.ledger(probe=self.probe("NOT_INDEXED")))["races"], [])
        overdue = build(self.universe, self.reconciler, self.batch,
                        self.nh_sen, self.nh_gov, previous=report,
                        now=self.now + timedelta(days=12))
        self.assertEqual(house_pins(overdue)["races"], [],
                         "A stale provider identity must fall back to exact search")

    def test_repository_manifest_matches_initial_persistent_ledger(self):
        ledger = json.loads((ROOT / "data/election_night_source_coverage.json").read_text())
        saved = json.loads((ROOT / "data/election_night_house_pins.json").read_text())
        self.assertEqual(saved, house_pins(ledger))
        self.assertLessEqual(len(saved["races"]), 219)
        self.assertEqual(len(saved["races"]), len({r["district"] for r in saved["races"]}))
        self.assertTrue(all(r["district"] != "NH-01" for r in saved["races"]))

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
