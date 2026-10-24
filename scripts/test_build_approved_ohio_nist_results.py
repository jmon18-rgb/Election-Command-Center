import copy
import datetime as dt
import json
from pathlib import Path
import unittest

from build_approved_ohio_nist_results import approve, parse, LIVE_START, NS, ROOT_ALTERNATIVE

HERE=Path(__file__).resolve().parents[1]
UNAPPROVED=json.loads((HERE/"data/ohio_nist_source_approval_2026.json").read_text())
WHEN=dt.datetime(2026,11,4,1,0,tzinfo=dt.timezone.utc)
GEN="2026-11-04T00:50:00Z"
COUNTIES={f"g{i}":f"39{2*i+1:03d}" for i in range(88)}


def approval():
    return {
       "schema":"ohio-nist-2026-live-approval-v1",
       "enabled":True,
       "real_results_publication_reviewed":True,
       "source_url":ROOT_ALTERNATIVE,
       "source_reviewed_at":"2026-11-04T00:48:00Z",
       "expected_report_status":"Unofficial",
       "approved_county_unit_type":"County",
       "approved_total_votes_type":"Total",
       "county_gpunit_to_fips":COUNTIES,
       "party_object_id_to_party":{"pD":"DEM","pR":"REP"},
       "approved_contests":[{
         "race_key":"OH-SEN-special",
         "source_contest_id":"cSen",
         "source_office_id":"oSen",
         "source_contest_name":"US Senate Special",
         "candidate_ids":["candidateD","candidateR"]
       }],
    }


def xml(date="2026-11-03",generated=GEN,dem=120,rep=140,extra=False):
    units=''.join(
      f'<GpUnit ObjectId="{k}" Type="County"/>'
      for k in COUNTIES)
    parties='<Party ObjectId="pD"/><Party ObjectId="pR"/>'
    candidates=('''<Candidate ObjectId="candidateD"><PartyId>pD</PartyId>
             <BallotName><LanguageString>Fixture Blue</LanguageString></BallotName></Candidate>
             <Candidate ObjectId="candidateR"><PartyId>pR</PartyId>
             <BallotName><LanguageString>Fixture Red</LanguageString></BallotName></Candidate>''')
    def choice(ident,votes):
      return (f'<BallotSelection><CandidateId>{ident}</CandidateId>'
              f'<VoteCountsCollection><VoteCounts Type="Total" Count="{votes}">'
              f'<GpUnitId>g0</GpUnitId></VoteCounts>'
              +(('<VoteCounts Type="Total" Count="999999"><GpUnitId>'
                  'statewide-duplicate</GpUnitId></VoteCounts>') if extra else '')+
              '</VoteCountsCollection></BallotSelection>')
    return (f'<?xml version="1.0"?><ElectionReport xmlns="{NS}" '
            f'GeneratedDate="{generated}" Status="Unofficial">'
            f'<GpUnitCollection>{units}</GpUnitCollection>'
            f'<PartyCollection>{parties}</PartyCollection>'
            f'<Election Date="{date}"><CandidateCollection>{candidates}</CandidateCollection>'
            f'<ContestCollection><Contest ObjectId="cSen" Name="US Senate Special">'
            f'<OfficeId>oSen</OfficeId>{choice("candidateD",dem)}'
            f'{choice("candidateR",rep)}</Contest></ContestCollection></Election>'
            f'</ElectionReport>').encode()


class OhioApprovedNistCandidateBridge(unittest.TestCase):
    def test_no_2026_live_data_until_explicit_post_poll_source_review(self):
        with self.assertRaisesRegex(ValueError,"MOCK/test vote gate"):
            approve(UNAPPROVED,WHEN)
        for c in [
            {**approval(),"enabled":False},
            {**approval(),"real_results_publication_reviewed":False},
            {**approval(),"source_url":"https://unverified.example/report.xml"},
        ]:
            with self.assertRaises(ValueError):
                parse(xml(),c,WHEN)
        with self.assertRaises(ValueError):
            parse(xml(),approval(),LIVE_START-dt.timedelta(seconds=1))
        with self.assertRaises(ValueError):
            parse(xml(),{**approval(),"source_reviewed_at":"2026-11-03T12:00:00Z"},WHEN)

    def test_synthetic_approved_senate_counties_not_national_needle(self):
        result=parse(xml(extra=True),approval(),WHEN)
        self.assertEqual(result["election_date"],"2026-11-03")
        self.assertEqual(len(result["races"]),1)
        row=result["races"][0]
        self.assertEqual(row["race_key"],"OH-SEN-special")
        self.assertEqual(row["office"],"Senate")
        self.assertEqual(row["reported_county_count"],1)
        self.assertEqual(row["counties"][0]["county_fips"],"39001")
        self.assertEqual(row["counties"][0]["candidates"],[
           {"name":"Fixture Blue","party":"DEM","votes":120},
           {"name":"Fixture Red","party":"REP","votes":140}])
        self.assertEqual(result["source"]["url"],ROOT_ALTERNATIVE)
        self.assertIsNone(result["ballots_remaining"])
        self.assertIsNone(result["reporting_fraction"])
        self.assertFalse(result["may_move_national_needle"])
        self.assertFalse(result["independently_certified_winner_calls"])

    def test_unreviewed_geography_party_contest_and_vote_fields_rejected(self):
        base=approval()
        cases=[
            {**base,"county_gpunit_to_fips":{}},
            {**base,"county_gpunit_to_fips":{**COUNTIES,"g0":"39003"}},
            {**base,"approved_total_votes_type":None},
            {**base,"party_object_id_to_party":{"pD":"DEM"}},
            {**base,"approved_contests":[{**base["approved_contests"][0],"source_contest_id":"other"}]},
            {**base,"approved_contests":[{**base["approved_contests"][0],"candidate_ids":["candidateD","wrong"]}]},
        ]
        for cfg in cases:
            with self.assertRaises(ValueError):
                parse(xml(),cfg,WHEN)

    def test_stale_mock_spoofed_election_unapproved_envelope_rejected(self):
        for data in [
            xml(date="2024-11-05"),
            xml(generated="2026-11-03T12:00:00Z"),
            xml(generated="2026-11-05T06:00:00Z"),
            xml(dem=-5),
            xml().replace(b'Unofficial',b'Test',1),
            b'<!DOCTYPE ElectionReport><ElectionReport></ElectionReport>',
            b'<html><body>Mock election</body></html>',
        ]:
            with self.assertRaises(ValueError):
                parse(data,approval(),WHEN)


if __name__=="__main__":
    unittest.main()
