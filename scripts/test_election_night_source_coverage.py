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
        original_gaps = {"AK-00", "DE-00", "ND-00", "NH-01",
                         "NH-02", "SD-00", "WY-00"}
        outside = [r for r in saved["races"] if r["office"] == "House"
                   and r["provider_scope"] == "outside primary"]
        unpinned = {r["key"] for r in outside} - pinned
        self.assertEqual(len(outside), 219)
        # Generated source identities can legitimately gain or lose current
        # verification. An INVALID_DETAIL recheck (AL-07 on Oct 25) must
        # appear as a NEW unresolved gap, not break CI or be called verified.
        for code in unpinned:
            row = rows["House|" + code]
            self.assertEqual(row["source_identity_status"], "NO_CURATED_PROVIDER_ID")
            self.assertFalse(row["live_votes_verified_by_audit"])
            self.assertFalse(row["professional_winner_call_verified_by_audit"])
            self.assertIsNone(row["pinned_civicapi_id"])
            self.assertIn(row["gap_status"], {
                "UNRESOLVED_SOURCE_GAP", "RECENT_EXACT_PROBE_NOT_LIVE_VERIFIED"})
            if code in original_gaps and row["last_probe"]["status"] == "NOT_INDEXED":
                self.assertEqual(row["gap_status"], "UNRESOLVED_SOURCE_GAP")
        self.assertEqual(
            {r["key"] for r in outside
             if r["gap_status"] == "UNRESOLVED_SOURCE_GAP"},
            {r["key"] for r in outside if r["key"] in unpinned
             and r["gap_status"] == "UNRESOLVED_SOURCE_GAP"},
            "A manual/newsroom fallback never counts as a machine identity")

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

    def statewide(self, at="2026-10-16T16:00:00+00:00"):
        return {
            "schema": "advisory-2026-four-statewide-gaps-v1",
            "checked_at": at, "provider": "civicAPI",
            "source_origin": "https://civicapi.org/api/v2",
            "identity_only_not_voting_results": True,
            "may_publish_live_votes": False,
            "may_update_model_or_source_pins": False,
            "checked": 4, "exact_matches": 3,
            "records": [
                {"race": "Senate|MA", "status": "NOT_INDEXED", "race_id": None},
                {"race": "Senate|MS", "status": "INDEXED_EXACT_RACE_IDENTITY_ONLY",
                 "race_id": 81004, "candidate_count": 3},
                {"race": "Governor|HI", "status": "INDEXED_EXACT_RACE_IDENTITY_ONLY",
                 "race_id": 87100, "candidate_count": 2},
                {"race": "Governor|OK", "status": "INDEXED_EXACT_RACE_IDENTITY_ONLY",
                 "race_id": 87582, "candidate_count": 2},
            ],
        }

    def test_statewide_advisory_persists_without_promoting_ma_senate(self):
        observed = self.ledger(statewide_probe=self.statewide())
        rows = self.rows(observed)
        self.assertEqual(rows["Senate|MA"]["statewide_probe_advisory"]["status"], "NOT_INDEXED")
        self.assertEqual(rows["Senate|MS"]["statewide_probe_advisory"]["race_id"], 81004)
        self.assertEqual(rows["Governor|HI"]["statewide_probe_advisory"]["candidate_count"], 2)
        self.assertEqual(rows["Senate|MA"]["source_identity_status"], "NO_CURATED_PROVIDER_ID")
        self.assertEqual(rows["Senate|MA"]["gap_status"], "UNRESOLVED_SOURCE_GAP")
        self.assertIsNone(rows["Senate|MA"]["pinned_civicapi_id"])
        self.assertEqual(observed["summary"]["senate"]["unresolved_source_gaps"], 1)
        self.assertFalse(any(r["live_votes_verified_by_audit"] for r in rows.values()))
        self.assertFalse(any(r["professional_winner_call_verified_by_audit"] for r in rows.values()))
        next_run = self.ledger(previous=observed, now=self.now + timedelta(hours=1))
        self.assertEqual(self.rows(next_run)["Senate|MA"]["statewide_probe_advisory"],
                         rows["Senate|MA"]["statewide_probe_advisory"])
        updated = self.statewide("2026-10-16T18:00:00+00:00")
        updated["records"][0] = {
            "race": "Senate|MA", "status": "INDEXED_EXACT_RACE_IDENTITY_ONLY",
            "race_id": 99014, "candidate_count": 2,
        }
        updated["exact_matches"] = 4
        new = self.ledger(previous=observed, statewide_probe=updated,
                          now=self.now + timedelta(hours=3))
        ma = self.rows(new)["Senate|MA"]
        self.assertEqual(ma["statewide_probe_advisory"]["race_id"], 99014)
        self.assertEqual(ma["gap_status"], "UNRESOLVED_SOURCE_GAP",
                         "Advisory ID must NEVER be promoted into live results")
        self.assertIsNone(ma["pinned_civicapi_id"])
        older = self.ledger(previous=new, statewide_probe=self.statewide(),
                            now=self.now + timedelta(hours=4))
        self.assertEqual(self.rows(older)["Senate|MA"]["statewide_probe_advisory"]["race_id"],
                         99014, "Late asynchronous probes cannot overwrite newer evidence")

    def test_bad_or_forged_statewide_advisory_fails_closed(self):
        import copy
        seed = self.statewide()
        wrong = []
        for change in (
            lambda x: x.update(provider="Other"),
            lambda x: x.update(may_publish_live_votes=True),
            lambda x: x.update(may_update_model_or_source_pins=True),
            lambda x: x.update(checked=3),
            lambda x: x.update(exact_matches=4),
            lambda x: x.update(checked_at="2026-12-01T00:00:00Z"),
            lambda x: x["records"].append(dict(x["records"][0])),
            lambda x: x["records"][0].update(race="Senate|NY"),
            lambda x: x["records"][0].update(race_id=77001),
            lambda x: x["records"][1].update(candidate_count=1),
            lambda x: x["records"][1].update(race_id=True),
        ):
            altered = copy.deepcopy(seed)
            change(altered)
            wrong.append(altered)
        for evidence in wrong:
            with self.subTest(evidence=evidence):
                with self.assertRaises(ValueError):
                    self.ledger(statewide_probe=evidence)
        # A temporary failure must be honestly distinguished from no index.
        failure = self.statewide()
        failure["records"][0]["status"] = "PROVIDER_UNAVAILABLE"
        observed = self.ledger(statewide_probe=failure)
        self.assertEqual(self.rows(observed)["Senate|MA"]["statewide_probe_advisory"]["status"],
                         "PROVIDER_UNAVAILABLE")
        self.assertEqual(observed["summary"]["senate"]["unresolved_source_gaps"], 1)

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

    def test_invalid_detail_reason_survives_without_approving_identity_or_votes(self):
        packet=self.probe("INVALID_DETAIL",key="CA-20")
        packet["results"][0]["reason"]="PRE_POLL_CLOSE_POSITIVE_VOTES"
        report=self.ledger(probe=packet)
        row=self.rows(report)["House|CA-20"]
        self.assertEqual(row["last_probe"]["reason"],"PRE_POLL_CLOSE_POSITIVE_VOTES")
        self.assertIsNone(row["last_probe"]["race_id"])
        self.assertEqual(row["gap_status"],"UNRESOLVED_SOURCE_GAP")
        self.assertFalse(row["verified_identity_hint_usable"])
        self.assertFalse(row["live_votes_verified_by_audit"])
        self.assertFalse(row["professional_winner_call_verified_by_audit"])
        for unknown in ("untrusted arbitrary provider text", {"votes":123}, ["bad"]):
            packet["results"][0]["reason"]=unknown
            self.assertIsNone(self.rows(self.ledger(probe=packet))["House|CA-20"]
                              ["last_probe"]["reason"],"Only bounded diagnostic codes are retained")

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
        before, after = self.rows(initial), self.rows(expected)
        self.assertEqual(set(before), set(after),
                         "The auditable census cannot change with source activity")
        # A source-ID PR changes the adapter BEFORE the hourly bot republishes
        # its 506-race snapshot. Permit only these three independently
        # reviewed add-only pins during that brief old-manifest transition.
        reviewed = {
            "Senate|MS": 81004,
            "Governor|HI": 87100,
            "Governor|OK": 87582,
        }
        transitioned = {"senate": 0, "governor": 0, "house": 0}
        for key, previous in before.items():
            current = after[key]
            if key in reviewed:
                self.assertEqual(current["source_identity_status"],
                                 "PINNED_PREVIOUSLY_VERIFIED_ID")
                self.assertEqual(current["pinned_civicapi_id"], reviewed[key])
                self.assertIn(previous["source_identity_status"],
                              ("NO_CURATED_PROVIDER_ID",
                               "PINNED_PREVIOUSLY_VERIFIED_ID"))
                if previous["source_identity_status"] == "NO_CURATED_PROVIDER_ID":
                    self.assertEqual(previous["gap_status"], "UNRESOLVED_SOURCE_GAP")
                    transitioned["senate" if key.startswith("Senate") else "governor"] += 1
            else:
                self.assertEqual(current["source_identity_status"],
                                 previous["source_identity_status"],
                                 "Only three independently reviewed source pins may change")
            self.assertFalse(previous["live_votes_verified_by_audit"])
            self.assertFalse(current["live_votes_verified_by_audit"])
        for office in ("house", "senate", "governor"):
            for key in ("total", "primary_scope", "scoped_secondary"):
                self.assertEqual(initial["summary"][office][key],
                                 expected["summary"][office][key])
            self.assertEqual(initial["summary"][office]["pinned_secondary"]+
                             transitioned[office],
                             expected["summary"][office]["pinned_secondary"])
        # The saved House ledger includes 212 actually probed identities.
        # A zero-probe synthetic rebuild intentionally omits that history
        # (219 unresolved), so compare the persistent-history rebuild instead.
        rebuilt = self.ledger(previous=initial,
                              now=timestamp(initial["generated_at"]))["summary"]
        for office in ("house", "senate", "governor"):
            self.assertEqual(initial["summary"][office]["unresolved_source_gaps"]-
                             transitioned[office],
                             rebuilt[office]["unresolved_source_gaps"])
        for office, row in initial["summary"].items():
            for key, value in row.items():
                if key == "pinned_secondary":
                    self.assertEqual(rebuilt[office][key], value + transitioned[office])
                elif key == "unresolved_source_gaps":
                    self.assertEqual(rebuilt[office][key], value - transitioned[office])
                else:
                    self.assertEqual(rebuilt[office][key], value,
                                     "Other saved evidence must remain reproducible")
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
