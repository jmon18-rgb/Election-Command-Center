#!/usr/bin/env python3
"""Validate 2024 historical data staging never fabricates 2026 priors."""
import csv
import io
import unittest
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent))
import stage_house_history_2024 as history
from build_seat_universe import HOUSE_COUNTS

def input_csv():
    file=io.StringIO()
    writer=csv.DictWriter(file,fieldnames=["year","state_po","district","stage","special","party","candidatevotes","candidate","office","mode","fusion_ticket","writein"])
    writer.writeheader()
    for state,n in HOUSE_COUNTS.items():
        for district in range(1,n+1):
            for party,votes in (("DEMOCRAT",250),("REPUBLICAN",260)):
                writer.writerow({"year":"2024","state_po":state,"district":district,"stage":"GEN",
                                 "special":"FALSE","party":party,"candidatevotes":votes,"candidate":party+' Candidate',"office":"US HOUSE","mode":"TOTAL","fusion_ticket":"FALSE","writein":"FALSE"})
    writer.writerow({"year":"2024","state_po":"DC","district":"1","stage":"GEN",
                     "special":"FALSE","party":"DEMOCRAT","candidatevotes":12345,"candidate":"DC Delegate","office":"US HOUSE","mode":"TOTAL"})
    writer.writerow({"year":"2022","state_po":"TX","district":"1","stage":"GEN",
                     "special":"FALSE","party":"DEMOCRAT","candidatevotes":9999,"candidate":"Other-year Candidate","office":"US HOUSE","mode":"TOTAL"})
    writer.writerow({"year":"2024","state_po":"TX","district":"1","stage":"PRI",
                     "special":"FALSE","party":"DEMOCRAT","candidatevotes":9999})
    return file.getvalue()

class HouseHistoryTests(unittest.TestCase):
    def test_full_2024_raw_history_staging(self):
        doc=history.stage(input_csv())
        self.assertEqual(doc["2024_district_rows"],435)
        self.assertFalse(any(x["2024_race_code"].startswith("DC-") for x in doc["records"]))
        self.assertEqual(doc["status"],"2024_history_staged_not_2026_priors")
        self.assertTrue(all(x["eligible_as_2026_prior"] is False for x in doc["records"]))
        by={r["2024_race_code"]:r for r in doc["records"]}
        self.assertEqual(by["TX-01"]["recorded_dem_votes"],250)
        self.assertEqual(by["TX-01"]["recorded_rep_votes"],260)
    def test_2022_historical_rows_have_distinct_year_keys_and_no_priors(self):
        # Build a complete 2022 input from a 2024 fixture, preserving its
        # intentionally included stray rows from the other year.
        content=input_csv().replace("2024,", "2022,")
        doc=history.stage(content,year=2022)
        self.assertEqual(doc["2022_district_rows"],435)
        self.assertEqual(doc["status"],"2022_history_staged_not_2026_priors")
        self.assertTrue(all(r["election_year"]==2022 and
            r["eligible_as_2026_prior"] is False and
            "2022_race_code" in r and "2024_race_code" not in r for r in doc["records"]))
    def test_uncontested_is_recorded_not_imputed(self):
        raw=input_csv().replace("DEMOCRAT,250","INDEPENDENT,250",1)
        doc=history.stage(raw)
        self.assertGreaterEqual(doc["districts_missing_major_party_votes"],1)
    def test_unexpected_schema_is_rejected(self):
        with self.assertRaises(ValueError):history.stage("year,state,district\n2024,TX,1\n")
    def test_at_large_mapping(self):
        self.assertEqual(history.clean_district("AL"),1)
        self.assertEqual(history.clean_district("00"),1)
        self.assertIsNone(history.clean_district("not a district"))
    def test_exact_aliases_not_party_substrings(self):
        for party in ['DFL','DEMOCRATIC-FARMER-LABOR','DEMOCRATIC-NONPARTISAN LEAGUE']:
            self.assertEqual(history.party_group(party),'dem')
        self.assertEqual(history.party_group('REPUBLICAN, LIBERTARIAN'),'rep')
        for party in ['INDEPENDENT','PROGRESSIVE, INDEPENDENT','DEMOCRATIC SOCIALIST','REPUBLICAN ALTERNATIVE']:
            self.assertEqual(history.party_group(party),'other')
    def test_candidate_specific_publisher_marked_fusion_only(self):
        rows=list(csv.DictReader(io.StringIO(input_csv())))
        # Synthetic NY lines: same-name endorsement, different WFP candidate,
        # and unmarked/anonymous/ambiguous affiliations cannot be merged.
        template=next(r for r in rows if r['state_po']=='NY' and r['district']=='17' and r['party']=='REPUBLICAN')
        extras=[('REPUBLICAN Candidate','CONSERVATIVE','TRUE','FALSE',17),
                ('Other Candidate','WORKING FAMILIES','TRUE','FALSE',8),
                ('DEMOCRAT Candidate','WORKING FAMILIES','FALSE','FALSE',9),
                ('WRITE-IN','CONSERVATIVE','TRUE','TRUE',4)]
        for name,party,fusion,writein,votes in extras:
            rows.append({**template,'candidate':name,'party':party,'fusion_ticket':fusion,'writein':writein,'candidatevotes':votes})
        buf=io.StringIO();w=csv.DictWriter(buf,fieldnames=rows[0]);w.writeheader();w.writerows(rows)
        result=next(r for r in history.stage(buf.getvalue())['records'] if r['2024_race_code']=='NY-17')
        self.assertEqual((result['recorded_dem_votes'],result['recorded_rep_votes'],result['recorded_other_votes']),(250,277,21))
        self.assertEqual(result['fusion_vote_rows_attributed'],1)
        self.assertEqual(result['fusion_votes_attributed'],17)
        self.assertEqual(sum(result[k] for k in ['recorded_dem_votes','recorded_rep_votes','recorded_other_votes']),548)
    def test_fractional_counts_not_truncated(self):
        self.assertIsNone(history.count('1.9'))
        self.assertEqual(history.count('0'),0)
    def test_fusion_never_crosses_district_or_ambiguous_major_identity(self):
        for ambiguous in (False,True):
            rows=list(csv.DictReader(io.StringIO(input_csv())))
            target=next(r for r in rows if r['state_po']=='NY' and r['district']=='17' and r['party']=='REPUBLICAN')
            extra={**target,'party':'CONSERVATIVE','fusion_ticket':'TRUE','candidatevotes':17}
            if ambiguous:
                rows.append({**target,'party':'DEMOCRAT','candidatevotes':5})
            else:target['candidate']='Different Republican'
            rows.append(extra)
            buf=io.StringIO();w=csv.DictWriter(buf,fieldnames=rows[0]);w.writeheader();w.writerows(rows)
            result=next(r for r in history.stage(buf.getvalue())['records'] if r['2024_race_code']=='NY-17')
            self.assertEqual(result['fusion_votes_attributed'],0)
            self.assertEqual(result['recorded_other_votes'],17)
    def test_wrong_office_or_counting_mode_fails(self):
        for field,value in [('office','PRESIDENT'),('mode','ABSENTEE')]:
            rows=list(csv.DictReader(io.StringIO(input_csv())));rows[0][field]=value
            buf=io.StringIO();w=csv.DictWriter(buf,fieldnames=rows[0]);w.writeheader();w.writerows(rows)
            with self.assertRaises(ValueError):history.stage(buf.getvalue())

if __name__=="__main__":
    unittest.main()
