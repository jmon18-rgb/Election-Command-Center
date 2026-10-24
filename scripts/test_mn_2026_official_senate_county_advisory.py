#!/usr/bin/env python3
"""Mock quarantine and contract tests; fixtures are SYNTHETIC, never votes."""
import datetime as dt
import unittest
from mn_2026_official_senate_county_advisory import parse_candidate_only, SOURCE, INDEX

NOW = dt.datetime(2026,11,4,3,tzinfo=dt.timezone.utc)
DISCOVERY = {
 "status":"EXPORT_LINKS_NOT_APPROVED_FOR_INGESTION",
 "index":INDEX,"test_marker_seen":False,
 "matched_links":{"U.S. Senator by County":SOURCE}
}
REVIEW = {
 "reviewed":True,
 "production_not_test_independently_verified":True,
 "source_timestamp_independently_verified":True,
 "rights_and_attribution_reviewed":True,
 "county_fips_join_reviewed":True,
 "source_url":SOURCE,"election":"2026-11-03",
 "race_key":"MN-SEN","source_office_code":"0102",
 "source_reported_at":"2026-11-04T02:40:00Z",
 # THIS FIPS mapping is test-only invented to exercise the parser.
 "verified_county_id_to_fips":{"03":"27001","08":"27003"}
}
def row(county,number,name,party,votes,total=1000,precincts=10,reporting=5):
 pct=f"{votes/total*100:.2f}" if total else "0.00"
 return ";".join(["MN",county,"","0102","U.S. Senator","",number,
         name,"","",party,str(reporting),str(precincts),str(votes),pct,str(total)])
GOOD="\n".join([row("03","0403","Example Democrat","DFL",600),
                row("03","0304","Example Republican","R",400),
                row("08","0403","Example Democrat","DFL",600),
                row("08","0304","Example Republican","R",400)])

class Minnesota2026CandidateOnlyAdapterTests(unittest.TestCase):
 def test_positive_requires_all_source_approval_guards(self):
  out=parse_candidate_only(GOOD,DISCOVERY,REVIEW,NOW)
  self.assertTrue(out["ready"])
  self.assertEqual(out["status"],"EXPLICITLY_REVIEWED_2026_COUNTY_CANDIDATE_ONLY")
  self.assertEqual(out["counties_seen"],2)
  self.assertEqual(out["candidate_votes"],2000)
  self.assertEqual([c["county_fips"] for c in out["counties"]],["27001","27003"])
  self.assertEqual(out["counties"][0]["candidates"][0]["party"],"D")
  self.assertIsNone(out["percent_reporting"])
  self.assertIsNone(out["ballots_remaining"])
  self.assertIsNone(out["professional_calls"])
  self.assertFalse(out["statewide_coverage_verified"])
  self.assertFalse(out["may_update_model"])
  self.assertFalse(out["may_move_national_needle"])

 def denied(self,text=GOOD,discovery=DISCOVERY,review=REVIEW,now=NOW,reason=None):
  ans=parse_candidate_only(text,discovery,review,now)
  self.assertFalse(ans["ready"],ans)
  self.assertEqual(ans["status"],reason)
  self.assertIsNone(ans["candidate_votes"])
  self.assertEqual(ans["counties"],[])
  self.assertFalse(ans["verified_live_2026_source"])
  self.assertFalse(ans["may_update_model"])
  self.assertFalse(ans["may_move_national_needle"])

 def test_mock_export_and_unverified_source_never_touch_candidates(self):
  for status in ("MOCK_EXPORT_LINKS_QUARANTINED",
                 "EXPORT_LINKS_PRE_CLOSE_ONLY",
                 "EXPORT_INDEX_UNAVAILABLE_NOT_ASSESSED",
                 "WRONG_2026_EXPORT_INDEX",
                 "EXPORT_LINKS_NOT_APPROVED_FOR_INGESTION"):
   d={**DISCOVERY,"status":status,"test_marker_seen":status=="MOCK_EXPORT_LINKS_QUARANTINED"}
   if status=="EXPORT_LINKS_NOT_APPROVED_FOR_INGESTION":
    d["test_marker_seen"]=True
   self.denied(discovery=d,reason="OFFICIAL_SOURCE_STILL_TEST_OR_UNVERIFIED")
  self.denied(discovery={**DISCOVERY,"matched_links":{}},
              reason="OFFICIAL_SOURCE_STILL_TEST_OR_UNVERIFIED")

 def test_independent_approval_source_rights_and_review_required(self):
  for key in ("reviewed","production_not_test_independently_verified",
              "source_timestamp_independently_verified",
              "rights_and_attribution_reviewed","county_fips_join_reviewed"):
   self.denied(review={**REVIEW,key:False},
               reason="INDEPENDENT_PRODUCTION_SOURCE_APPROVAL_MISSING")
  self.denied(review={**REVIEW,"source_url":SOURCE.replace("20261103","20241105")},
              reason="INDEPENDENT_PRODUCTION_SOURCE_APPROVAL_MISSING")

 def test_stale_preclose_and_future_provider_timestamp(self):
  for stamp in ("2026-11-04T01:59:59Z","2026-11-04T00:00:00Z",
                "2026-11-03T19:00:00Z",
                "2026-11-04T03:25:00Z",
                "2026-11-04T02:00:00","2024-11-06T02:00:00Z"):
   self.denied(review={**REVIEW,"source_reported_at":stamp},
               reason="VERIFIED_SOURCE_TIME_MISSING_PRE_CLOSE_OR_STALE")
  self.denied(now=dt.datetime(2026,11,4,1,59,tzinfo=dt.timezone.utc),
              reason="VERIFIED_SOURCE_TIME_MISSING_PRE_CLOSE_OR_STALE")

 def test_fips_source_ids_not_wishful_county_fips(self):
  self.denied(review={**REVIEW,"verified_county_id_to_fips":{}},
              reason="VERIFIED_MINNESOTA_COUNTY_FIPS_MAPPING_MISSING")
  self.denied(review={**REVIEW,"verified_county_id_to_fips":{"03":"37001","08":"37003"}},
              reason="VERIFIED_MINNESOTA_COUNTY_FIPS_MAPPING_INVALID")
  self.denied(review={**REVIEW,"verified_county_id_to_fips":{"03":"27001","08":"27001"}},
              reason="VERIFIED_MINNESOTA_COUNTY_FIPS_MAPPING_INVALID")
  self.denied(review={**REVIEW,"verified_county_id_to_fips":{"03":"27001"}},
              reason="MISMATCHED_MINNESOTA_CONTEST_CANDIDATE_OR_COUNTY")

 def test_candidate_office_arithmetic_and_layout(self):
  self.denied(text=GOOD.replace("0102","0109"),
              reason="MISMATCHED_MINNESOTA_CONTEST_CANDIDATE_OR_COUNTY")
  self.denied(text=GOOD.replace("MN;03;","VA;03;"),
              reason="MISMATCHED_MINNESOTA_CONTEST_CANDIDATE_OR_COUNTY")
  self.denied(text=GOOD.replace("U.S. Senator","Governor"),
              reason="MISMATCHED_MINNESOTA_CONTEST_CANDIDATE_OR_COUNTY")
  self.denied(text=GOOD.replace(";5;10;600;",";11;10;600;"),
              reason="INCONSISTENT_OFFICIAL_COUNT_OR_PRECINCT_ARITHMETIC")
  self.denied(text=GOOD.replace(";60.00;1000",";65.00;1000"),
              reason="SOURCE_CANDIDATE_PERCENTAGE_CONTRADICTION")
  self.denied(text=GOOD.replace(";600;60.00;1000",";1100;60.00;1000"),
              reason="INCONSISTENT_OFFICIAL_COUNT_OR_PRECINCT_ARITHMETIC")
  self.denied(text=GOOD+"\n"+"MN;03;wrong",
              reason="WRONG_OFFICIAL_16_FIELD_CANDIDATE_LAYOUT")
  self.denied(text="\n".join(GOOD.splitlines()[:3]),
              reason="CANDIDATE_TOTAL_NOT_RECONCILED_WITH_COUNTY")
  self.denied(text=GOOD.replace(";0403;",";0304;"),
              reason="DUPLICATE_COUNTY_CANDIDATE_IDENTITY")
  self.denied(text=GOOD.replace(";0304;Example Republican;",";0304;Example Democrat;"),
              reason="DUPLICATE_COUNTY_CANDIDATE_IDENTITY")

 def test_unbounded_file_cannot_be_accepted(self):
  self.denied(text=GOOD+("X"*500_000),
              reason="UNBOUNDED_OR_NON_TEXT_CANDIDATE_SOURCE")

if __name__=="__main__":
 unittest.main()
