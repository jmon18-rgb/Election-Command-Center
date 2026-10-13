#!/usr/bin/env python3
"""Regression checks for the complete seat inventory; no predicted results."""
import unittest
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
import build_seat_universe as seats

class SeatUniverseTests(unittest.TestCase):
    def setUp(self):
        self.model={"generated_at":"2026-10-13T16:00:00Z","house":[],"senate_all":[]}

    def test_complete_inventory_and_holdovers(self):
        out=seats.build(self.model,"2026-10-13T16:00:00Z")
        seats.validate(out)
        self.assertEqual((len(out["house"]["seats"]),len(out["senate"]["contested_seats"])),(435,35))
        self.assertEqual(out["senate"]["holdover_total"],65)
        self.assertEqual(out["senate"]["contested_regular"],33)
        self.assertEqual(out["senate"]["contested_special"],2)
        self.assertEqual(sum(out["senate"]["holdover_caucus_reference"][k] for k in
           ("democratic_party","independent_caucusing_with_democrats","republican_party")),65)

    def test_state_apportionment_is_exact(self):
        out=seats.build(self.model)
        self.assertEqual(len(set(x["race_code"] for x in out["house"]["seats"])),435)
        self.assertIn("AK-01",{x["race_code"] for x in out["house"]["seats"]})
        self.assertIn("TX-38",{x["race_code"] for x in out["house"]["seats"]})
        self.assertNotIn("TX-39",{x["race_code"] for x in out["house"]["seats"]})
        self.assertNotIn("DC-01",{x["race_code"] for x in out["house"]["seats"]})

    def test_no_unjustified_seat_projection(self):
        m=dict(self.model,house=[{"race_code":"TX-35","status":"multi_poll","dem_minus_rep":3.2,"contributing_pollsters":5}],
               senate_all=[{"race_code":"OH-SEN","status":"single_poll","dem_minus_rep":-2.0,"contributing_pollsters":1}])
        out=seats.build(m)
        self.assertEqual(out["house"]["polled_with_qualifying_average"],1)
        self.assertEqual(out["senate"]["polled_with_qualifying_average"],1)
        self.assertFalse(out["forecast_readiness"]["ready"])
        for obj in out["house"]["seats"]+out["senate"]["contested_seats"]:
            self.assertIsNone(obj["outcome_probability"])
            self.assertIsNone(obj["election_day_margin_estimate"])

    def test_unknown_or_out_of_universe_poll_blocks_publishing(self):
        m=dict(self.model,house=[{"race_code":"ZZ-99","status":"single_poll","dem_minus_rep":4.3}],
               senate_all=[{"race_code":"CA-SEN","status":"single_poll","dem_minus_rep":-2}])
        out=seats.build(m)
        with self.assertRaises(ValueError):seats.validate(out)

    def test_special_and_regular_senate_elections_distinct(self):
        out=seats.build(self.model)
        by={x["race_code"]:x for x in out["senate"]["contested_seats"]}
        self.assertEqual(by["OH-SEN"]["election_kind"],"special")
        self.assertEqual(by["FL-SEN"]["seat_class"],"III")
        self.assertEqual(by["TX-SEN"]["seat_class"],"II")
        self.assertNotIn("CA-SEN",by)

if __name__=="__main__":
    unittest.main()
