import datetime as dt
import json
from pathlib import Path
import unittest

from national_results_coverage_pulse import pulse, EXPECTED

ROOT=Path(__file__).resolve().parents[1]
NOW=dt.datetime(2026,11,4,1,0,tzinfo=dt.timezone.utc)

def office_document(office,at="2026-11-04T00:55:00Z",races=None):
    races={} if races is None else races
    return {
        "api":1,"year":2026,"office":office,"source":"state",
        "as_of":at,"live":True,"stale":False,"counting":True,"final":False,
        "counts":{"races":len(races)},"races":races,
    }

class NationalCoveragePulse(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ledger=json.loads((ROOT/"data/election_night_source_coverage.json").read_text())

    def test_no_primary_sources_never_means_zero_ballots(self):
        doc=pulse(self.ledger,{},NOW)
        self.assertEqual(doc["schema"],"election-night-506-coverage-pulse-v1")
        self.assertEqual(doc["expected"],{"house":435,"senate":35,"governor":36})
        self.assertEqual(doc["offices"]["House"]["status_counts"]["PRIMARY_PROVIDER_UNAVAILABLE"],216)
        self.assertEqual(doc["offices"]["Senate"]["status_counts"]["PRIMARY_PROVIDER_UNAVAILABLE"],15)
        self.assertEqual(doc["offices"]["Governor"]["status_counts"]["PRIMARY_PROVIDER_UNAVAILABLE"],15)
        self.assertEqual(len(doc["senate"]),35)
        self.assertFalse(doc["independent_official_counts_verified"])
        self.assertFalse(doc["may_update_election_forecast"])

    def test_one_reporting_race_does_not_imply_national_coverage(self):
        primary={"Senate":office_document("Senate",races={
            "GA":{"total":105,"called":False,"cands":[
                {"n":"A","p":"D","v":50},{"n":"B","p":"R","v":55}]}
        })}
        doc=pulse(self.ledger,primary,NOW)
        self.assertEqual(doc["offices"]["Senate"]["status_counts"][
            "PRIMARY_OBSERVED_CANDIDATE_COUNTS_UNCALLED"],1)
        self.assertEqual(doc["offices"]["Senate"]["status_counts"][
            "PRIMARY_RACE_ABSENT_NOT_ZERO"],14)
        by_race={r["race"]:r["status"] for r in doc["senate"]}
        self.assertEqual(by_race["Senate|GA"],"PRIMARY_OBSERVED_CANDIDATE_COUNTS_UNCALLED")
        self.assertEqual(by_race["Senate|MA"],"NO_2026_MACHINE_SOURCE_IDENTITY")
        self.assertEqual(by_race["Senate|ME"],"SECONDARY_PIN_ONLY_NOT_QUERIED")

    def test_source_timing_stale_and_zero_are_separate_states(self):
        source={"GA":{"total":50,"called":False}}
        doc=pulse(self.ledger,{"Senate":office_document(
            "Senate","2026-11-03T21:00:00Z",source)},NOW)
        assert doc["offices"]["Senate"]["status_counts"][
            "PRIMARY_NO_RELIABLE_2026_UPDATE_TIME"]==1
        stale=pulse(self.ledger,{"Senate":office_document(
            "Senate","2026-11-03T23:01:00Z",source)},
            dt.datetime(2026,11,4,5,tzinfo=dt.timezone.utc))
        assert stale["offices"]["Senate"]["status_counts"]["PRIMARY_REPORTED_BUT_STALE"]==1
        source["GA"]["total"]=0
        zero=pulse(self.ledger,{"Senate":office_document(
            "Senate","2026-11-04T00:55:00Z",source)},NOW)
        assert zero["offices"]["Senate"]["status_counts"][
            "PRIMARY_ZERO_REPORTED_NOT_ZERO_VOTES_CAST"]==1

    def test_identity_duplicate_call_and_future_data_fail(self):
        bad=json.loads(json.dumps(self.ledger))
        bad["races"][0]["id"]=bad["races"][1]["id"]
        with self.assertRaises(ValueError):
            pulse(bad,{},NOW)
        with self.assertRaises(ValueError):
            pulse(self.ledger,{"Senate":office_document("Senate",races={
                "GA":{"total":1,"called":True}})},NOW)
        with self.assertRaises(ValueError):
            pulse(self.ledger,{"Senate":office_document(
                "Senate","2026-11-05T02:00:00Z",{"GA":{"total":1,"called":False}})},NOW)

if __name__=="__main__":
    unittest.main()
