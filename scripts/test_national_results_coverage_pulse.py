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
        source={"GA":{"total":50,"called":False,"cands":[
            {"n":"Candidate D","p":"D","v":25},
            {"n":"Candidate R","p":"R","v":25}]}}
        doc=pulse(self.ledger,{"Senate":office_document(
            "Senate","2026-11-03T21:00:00Z",source)},NOW)
        assert doc["offices"]["Senate"]["status_counts"][
            "PRIMARY_SOURCE_BEFORE_STATE_POLL_CLOSE"]==1
        stale=pulse(self.ledger,{"Senate":office_document(
            "Senate","2026-11-04T00:01:00Z",source)},
            dt.datetime(2026,11,4,5,tzinfo=dt.timezone.utc))
        assert stale["offices"]["Senate"]["status_counts"]["PRIMARY_REPORTED_BUT_STALE"]==1
        source["GA"]["total"]=0
        source["GA"]["cands"]=[]
        zero=pulse(self.ledger,{"Senate":office_document(
            "Senate","2026-11-04T00:55:00Z",source)},NOW)
        assert zero["offices"]["Senate"]["status_counts"][
            "PRIMARY_ZERO_REPORTED_NOT_ZERO_VOTES_CAST"]==1

    def test_per_state_poll_close_both_source_and_receipt_times(self):
        ballots={
            "GA-01":{"total":40,"called":False,"cands":[
                {"n":"D Georgia","p":"D","v":25},{"n":"R Georgia","p":"R","v":15}]},
            "TX-01":{"total":30,"called":False,"cands":[
                {"n":"D Texas","p":"D","v":13},{"n":"R Texas","p":"R","v":17}]},
            "AZ-01":{"total":20,"called":False,"cands":[
                {"n":"D Arizona","p":"D","v":11},{"n":"R Arizona","p":"R","v":9}]}}
        h=office_document("House","2026-11-04T01:02:00Z",ballots)
        result=pulse(self.ledger,{"House":h},
                     dt.datetime(2026,11,4,1,10,tzinfo=dt.timezone.utc))
        self.assertEqual(result["offices"]["House"]["status_counts"][
            "PRIMARY_OBSERVED_CANDIDATE_COUNTS_UNCALLED"],2)
        self.assertEqual(result["offices"]["House"]["status_counts"][
            "PRIMARY_SOURCE_BEFORE_STATE_POLL_CLOSE"],1,
            "Arizona mock cannot appear while its local polls remain open")
        # A source stamped BEFORE local closure is still invalid hours later.
        earlier=office_document("House","2026-11-04T00:59:59Z",{"TX-01":ballots["TX-01"]})
        result=pulse(self.ledger,{"House":earlier},
                     dt.datetime(2026,11,4,3,tzinfo=dt.timezone.utc))
        self.assertEqual(result["offices"]["House"]["status_counts"][
            "PRIMARY_SOURCE_BEFORE_STATE_POLL_CLOSE"],1)

    def test_candidate_arithmetic_must_be_real_before_coverage_credit(self):
        good={"total":45,"called":False,"cands":[
            {"n":"D","p":"D","v":23},{"n":"R","p":"R","v":22}]}
        for bad in [
            {**good,"cands":[]},
            {**good,"cands":[{"n":"D","p":"D","v":35},{"n":"R","p":"R","v":20}]},
            {**good,"cands":[good["cands"][0],good["cands"][0]]},
            {**good,"cands":[{"n":"D","p":"D","v":True}]},
            {**good,"cands":[{"n":"D","p":"D","v":-1}]},
            {**good,"cands":[{"n":"D","p":"D","v":"45"}]},
            {**good,"cands":None},
        ]:
            result=pulse(self.ledger,{"Senate":office_document(
                "Senate","2026-11-04T01:05:00Z",{"GA":bad})},
                dt.datetime(2026,11,4,1,10,tzinfo=dt.timezone.utc))
            self.assertEqual(result["offices"]["Senate"]["status_counts"][
                "PRIMARY_INVALID_CANDIDATE_ARITHMETIC"],1)
            self.assertNotIn("PRIMARY_OBSERVED_CANDIDATE_COUNTS_UNCALLED",
                             result["offices"]["Senate"]["status_counts"])
        good_result=pulse(self.ledger,{"Senate":office_document(
            "Senate","2026-11-04T01:05:00Z",{"GA":good})},
            dt.datetime(2026,11,4,1,10,tzinfo=dt.timezone.utc))
        self.assertEqual(good_result["offices"]["Senate"]["status_counts"][
            "PRIMARY_OBSERVED_CANDIDATE_COUNTS_UNCALLED"],1)

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
