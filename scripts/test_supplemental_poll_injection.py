#!/usr/bin/env python3
"""Regression: Minnesota SurveyUSA poll indexed after primary must reach odds.

Tests provenance, exact duplicates, same-survey questions, candidate matchup,
secondary freshness and persistence through the next primary refresh. All
surveys and dates below are synthetic fixtures except the illustrative 45/42.
"""
import copy
import datetime as dt
import unittest
from unittest.mock import patch

import merge_supplemental_polls as merge
import update_polls
import build_polling_estimates as estimates

NOW=dt.datetime(2026,10,14,23,40,tzinfo=dt.timezone.utc)


def existing(pid,firm,end,dem,rep):
    return {"poll_id":pid,"field_end":end,"pollster":firm,
            "dem_name":"Peggy Flanagan","rep_name":"Michele Tafoya",
            "dem":dem,"rep":rep,"margin":round(dem-rep,2),
            "sample_size":800,"partisan_lean":""}


def make_primary():
    polls=[existing("old-mason","Mason-Dixon Polling & Research, Inc.","2026-10-07",47,43),
           existing("old-survey","SurveyUSA","2026-09-14",42,42),
           existing("old-gqr","GQR","2026-10-04",50,42)]
    return {"updated_at":NOW.isoformat(),
            "races":[{"race_code":"MN-SEN","race_type":"senate",
                      "state":"MN","district":"SEN",
                      "latest_field_end":"2026-10-07",
                      "latest":polls[0],"polls":polls,
                      "recent_poll_count":len(polls),
                      "source_url":"https://example.com/primary.csv"}]}


def fresh(pid="new-surveyusa",population="lv",d=45,r=42,question="q1"):
    return {"race_code":"MN-SEN","race_type":"senate",
            "state":"MN","poll_id":pid,"question_id":question,
            "pollster":"SurveyUSA","dem_name":"Peggy Flanagan",
            "rep_name":"Michele Tafoya","dem":d,"rep":r,
            "margin":d-r,"field_end":"2026-10-12","field_start":"2026-10-09",
            "posted_date":"2026-10-14",
            "posted_source_datetime":"2026-10-14T18:52:00",
            "source_url":"https://kstp.com/example-new-survey",
            "sample_population":population,"sample_size":718,
            "partisan_lean":"","source":"PollResults.org / NYT CC BY 4.0"}


def make_supplement(items):
    return {"updated_at":NOW.isoformat(),"observations":items}


class SupplementalPollTests(unittest.TestCase):
    def test_minnesota_new_poll_propagates_to_active_polling_model(self):
        primary=make_primary()
        baseline=estimates.estimate(primary["races"][0],NOW.date())
        new=fresh()
        secondary=make_supplement([
            # One poll ID can have multiple question populations; LV wins.
            fresh(population="rv",d=44,r=43,question="q-rv"),
            new,
            # The same existing poll ID may show in both independent sources.
            {**new,"poll_id":"old-mason","field_end":"2026-10-07",
             "question_id":"q-mason","dem":47,"rep":43},
            # Different matchup cannot pollute the Senate candidate model.
            {**new,"poll_id":"bad-matchup","question_id":"q-other",
             "rep_name":"Someone Else"},
        ])
        result,stats=merge.merge(primary,secondary,NOW)
        self.assertEqual(stats["status"],"merged")
        self.assertEqual(stats["accepted"],1)
        self.assertEqual(stats["already_in_primary"],1)
        self.assertEqual(stats["duplicate_questions"],1)
        self.assertEqual(stats["rejected_matchup"],1)
        mn=result["races"][0]
        self.assertEqual(mn["latest_field_end"],"2026-10-12")
        self.assertEqual(mn["polls"][0]["poll_id"],"new-surveyusa")
        self.assertEqual(mn["polls"][0]["sample_population"],"lv")
        self.assertIsNone(mn["polls"][0]["release_date"])
        self.assertEqual(mn["polls"][0]["source_provider"],"PollResults.org")
        updated=estimates.estimate(mn,NOW.date())
        self.assertEqual(updated["latest_poll_end"],"2026-10-12")
        picked=[p for p in updated["pollsters"] if p["name"]=="SurveyUSA"]
        self.assertEqual(len(picked),1)
        self.assertEqual(picked[0]["poll_id"],"new-surveyusa")
        self.assertNotEqual(updated["dem_minus_rep"],baseline["dem_minus_rep"])
        self.assertEqual(updated["contributing_pollsters"],baseline["contributing_pollsters"])
        # Rerun same source: never double-count.
        again,check=merge.merge(result,secondary,NOW)
        self.assertEqual(check["accepted"],0)
        self.assertEqual(len(again["races"][0]["polls"]),4)

    def test_secondary_poll_survives_next_primary_vendor_refresh(self):
        result,_=merge.merge(make_primary(),make_supplement([fresh()]),NOW)
        old=result["races"]
        next_primary=make_primary()["races"]
        with patch.object(update_polls,"TODAY",NOW.date()):
            carried=update_polls.carry_forward_verified_supplemental(old,next_primary)
        self.assertEqual(carried,1)
        self.assertEqual(next_primary[0]["latest"]["poll_id"],"new-surveyusa")
        with patch.object(update_polls,"TODAY",NOW.date()):
            self.assertEqual(update_polls.carry_forward_verified_supplemental(
                next_primary,next_primary),0)
        # As soon as the primary vendor catches up with the same poll ID,
        # the saved secondary row must be superseded, not counted twice.
        primary_caught_up=make_primary()["races"]
        primary_caught_up[0]["polls"].append(existing(
            "new-surveyusa","SurveyUSA","2026-10-12",45,42))
        with patch.object(update_polls,"TODAY",NOW.date()):
            self.assertEqual(update_polls.carry_forward_verified_supplemental(
                old,primary_caught_up),0)
        self.assertEqual(sum(p["poll_id"]=="new-surveyusa"
                             for p in primary_caught_up[0]["polls"]),1)

    def test_reject_stale_source_and_unsafe_poll_without_any_mutation(self):
        before=make_primary()
        stale=make_supplement([fresh()])
        stale["updated_at"]="2026-10-12T00:00:00Z"
        after,stats=merge.merge(before,stale,NOW)
        self.assertEqual(stats["status"],"stale_or_unavailable")
        self.assertEqual(after["races"],before["races"])
        bad=[{**fresh(),"field_end":"2026-10-15"},
             {**fresh(),"dem_name":"Generic Democrat"},
             {**fresh(),"sample_size":10},
             {**fresh(),"source_url":"javascript:bad"},
             {**fresh(),"race_code":"GA-SEN","state":"GA"}]
        after,stats=merge.merge(before,make_supplement(bad),NOW)
        self.assertEqual(stats["accepted"],0)
        self.assertEqual(stats["untracked_race"],1)
        self.assertEqual(stats["rejected_invalid"],4)
        self.assertEqual(after["races"],before["races"])

    def test_prefer_likely_voters_without_picking_based_on_party_margin(self):
        one=fresh(pid="single-poll",population="lv",d=44,r=44,question="q-lv")
        two=fresh(pid="single-poll",population="rv",d=50,r=40,question="q-rv")
        after,stats=merge.merge(make_primary(),make_supplement([two,one]),NOW)
        self.assertEqual(stats["accepted"],1)
        self.assertEqual(after["races"][0]["polls"][0]["dem"],44)
        self.assertEqual(after["races"][0]["polls"][0]["rep"],44)
        self.assertEqual(stats["duplicate_questions"],1)


if __name__=="__main__":
    unittest.main()
