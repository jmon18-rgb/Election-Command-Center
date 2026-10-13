#!/usr/bin/env python3
import datetime as dt
import sys, unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import update_scenario_forecast as sc

TEMPLATE="""<html><body><h1>2026 Election Forecast Overview</h1>
<p>Last updated Oct 13, 1:52 PM</p>
<section>House Control Democrats 77%Probability</section>
<section>Senate Control Democrats 56%Probability</section>
<h3>DEM Senate and DEM House</h3><p>54.0%</p>
<h3>DEM Senate and GOP House</h3><p>2.0%</p>
<h3>GOP Senate and DEM House</h3><p>22.0%</p>
<h3>GOP Senate and GOP House</h3><p>21.0%</p>
</body></html>"""
NOW=dt.datetime(2026,10,13,17,30,tzinfo=dt.timezone.utc)
class Tests(unittest.TestCase):
    def setUp(self):self.fixture=TEMPLATE+"<!--"+"source filler "*100+"-->"
    def test_actual_joint_outcome_rounding(self):
        p=sc.parse(self.fixture,NOW)
        o=sc.make(p,NOW)
        sc.validate(o)
        self.assertEqual(p["joint"],{"both_dem":54.,"senate_only":2.,"house_only":22.,"both_rep":21.})
        self.assertEqual(o["display_outcomes"]["shrug"]["pct"],24.)
        self.assertEqual(o["display_outcomes"]["blue_both"]["pct"],54.)
        self.assertIsNone(o["display_outcomes"]["blue_tsunami"]["pct"])
        self.assertEqual(o["rounding_total_pct"],99.)
        self.assertEqual(o["house_dem_control_pct"],77.)
        self.assertEqual(o["senate_dem_control_pct"],56.)
    def test_order_and_spacing_around_markup(self):
        html=self.fixture.replace("<h3>DEM Senate and DEM House</h3><p>54.0%</p>",
          "<h3>DEM Senate and DEM House</h3><p><strong>54.0%</strong></p>")
        self.assertEqual(sc.parse(html,NOW)["joint"]["both_dem"],54.)
    def test_missing_category_cannot_be_filled_by_independence(self):
        with self.assertRaises(ValueError):
            sc.parse(self.fixture.replace("GOP Senate and GOP House","irrelevant"),NOW)
    def test_nonsense_probabilities_rejected(self):
        with self.assertRaises(ValueError):
            sc.parse(self.fixture.replace("54.0%","98.0%"),NOW)
    def test_no_synthetic_ts_count(self):
        doc=sc.make(sc.parse(self.fixture,NOW),NOW)
        self.assertNotIn("probability",doc["display_outcomes"]["blue_tsunami"])
        self.assertIn("unavailable",doc["display_outcomes"]["blue_tsunami"]["reason"].lower())
if __name__=="__main__":unittest.main()
