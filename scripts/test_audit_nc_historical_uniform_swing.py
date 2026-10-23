import unittest
from pathlib import Path
from audit_nc_historical_uniform_swing import audit

ROOT=Path(__file__).resolve().parents[1]
PAST=(ROOT/"data/nc_2022_senate_county_verified.csv").read_text()
PRES=(ROOT/"data/nc_2024_presidential_county_verified.csv").read_text()

class UniformCountySwingErrorAudit(unittest.TestCase):
    def test_real_published_historical_sources_expose_nonzero_geographic_dispersion(self):
        a=audit(PAST,PRES)
        self.assertEqual(a["matched_counties"],100)
        self.assertAlmostEqual(a["statewide_margin_difference_points"],0.0386,places=3)
        self.assertAlmostEqual(a["county_uniform_shift_weighted_mae_points"],2.0201,places=3)
        self.assertGreater(a["county_uniform_shift_weighted_rmse_points"],2.5)
        self.assertGreater(a["county_absolute_residual_p95_points"],5)
        self.assertFalse(a["same_office_comparison"])
        self.assertFalse(a["historical_sampling_order_observed"])
        self.assertFalse(a["represents_2026_county_reporting_bias"])
        self.assertFalse(a["valid_2026_ballots_remaining_denominator"])
        self.assertFalse(a["valid_2026_probability_error_calibration"])
        self.assertFalse(a["may_move_national_needle"])

    def test_rejects_fabricated_county_votes_even_when_state_totals_match(self):
        # Moves one Democratic ballot from one real county to another.
        a=PAST.replace("37001,25866,32866","37001,25865,32866")
        a=a.replace("37003,3031,11833","37003,3032,11833")
        # Sum is deliberately unchanged, so ONLY per-county original ZIP
        # check (independent workflow) can rule out such a redistribution.
        # This offline descriptive test can flag format/total errors, not
        # pretend it has independently downloaded the NCSBE original.
        self.assertEqual(audit(a,PRES)["matched_counties"],100)
        for tampered in [
            PAST.replace("2024bf67243ef173","ffffffffffffffff"),
            PAST.replace("37001,25866,32866","36001,25866,32866"),
            PRES.replace("37001,40624,47937","37001,40624,47938"),
            PAST.replace("group 1378","group 999"),
        ]:
            with self.assertRaises(ValueError):
                audit(tampered,PRES)

if __name__=="__main__":
    unittest.main()
