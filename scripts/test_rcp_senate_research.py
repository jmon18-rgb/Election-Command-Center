#!/usr/bin/env python3
"""Research-only source tests for actual RCP year-file layout."""
import csv,io,sys,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import research_rcp_senate_backtest as r
from test_historical_senate_poll_backtest import outcomes

FIELDS=["pollster","start_date","end_date","sample_size","sample_type","rep","dem","other","year","state","overlapping_special_election"]
LOCATIONS={2020:("arizona","2020/10/16","2020/10/20"),
           2022:("pennsylvania","2022/10/16","2022/10/22"),
           2024:("wisconsin","2024/10/16","2024/10/20")}
def sample(year,dirty=False):
    buf=io.StringIO();w=csv.DictWriter(buf,fieldnames=FIELDS);w.writeheader()
    state,start,end=LOCATIONS[year]
    for firm,dem,rep in [("Firm 1",48,46),("Firm 2",45,48),("Firm 1",49,46)]:
        w.writerow(dict(pollster=firm,start_date=start,end_date=end,sample_type="LV",
                        sample_size=800,dem=dem,rep=rep,year=year,state=state))
    if dirty:
        w.writerow(dict(pollster="Inverted",start_date=end,end_date=start,
                        dem=99,rep=1,year=year,state=state))
        w.writerow(dict(pollster="Future",start_date=f"{year}/11/01",end_date=f"{year}/11/04",
                        dem=99,rep=1,year=year,state=state))
    return buf.getvalue()
def files(dirty=False):return {y:sample(y,dirty) for y in r.YEARS}

class ArchiveTests(unittest.TestCase):
    def test_three_cycles_and_no_odds(self):
        out=r.build(files(),outcomes(),{"2020":"a","2022":"b","2024":"c"})
        self.assertEqual(out["races_evaluated"],3)
        self.assertFalse(out["is_forecast"])
        self.assertFalse(out["can_calibrate_2026_win_probabilities"])
        self.assertFalse(out["poll_source_first_publication_dates_available"])
        self.assertEqual([out["by_year"][str(y)]["eligible_races"] for y in r.YEARS],[1,1,1])
        self.assertEqual([x["pollster_count"] for x in out["records"]],[2,2,2])
        self.assertTrue(all(x["cutoff_is_fieldwork_only"] for x in out["records"]))
    def test_inverted_and_future_are_excluded(self):
        a=r.build(files(),outcomes())
        b=r.build(files(True),outcomes())
        self.assertEqual(a["records"],b["records"])
        self.assertEqual(b["poll_observation_coverage"]["invalid_or_inverted_dates"]["2020"],1)
    def test_special_election_collision_excluded(self):
        actual=outcomes()
        special=actual["contest_records"][0].copy()
        special["historical_race_id"]="2020-AZ-SEN-special"
        actual["contest_records"].append(special)
        report=r.build(files(),actual)
        self.assertEqual(report["races_evaluated"],2)
        self.assertNotIn("AZ",[x["state"] for x in report["records"]])
    def test_changed_source_schema_and_missing_year_rejected(self):
        with self.assertRaisesRegex(ValueError,"Missing retrospective"):
            r.parse({2020:sample(2020)})
        f=files();f[2024]="x,y\n1,2\n"
        with self.assertRaisesRegex(ValueError,"changed expected"):
            r.parse(f)
    def test_missing_democrat_never_inferred(self):
        actual=outcomes();actual["contest_records"][1]["recorded_dem_votes"]=0
        actual["contest_records"][1]["missing_major_party_vote"]=True
        self.assertEqual(r.build(files(),actual)["races_evaluated"],2)
    def test_year_month_day_source_format(self):
        self.assertEqual(r.baseline.date_value("2024/10/30"),r.dt.date(2024,10,30))

if __name__=="__main__":unittest.main()
