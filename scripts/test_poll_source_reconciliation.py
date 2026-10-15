#!/usr/bin/env python3
"""Offline regression: PollResults feed -> live primary model -> refreshed odds."""
import copy
import datetime as dt
import sys
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parent))
import reconcile_poll_sources as recon
import build_polling_estimates as model
import validate_fresh_poll_sources as validator

TODAY=dt.date(2026,10,14)
AT="2026-10-14T23:35:51Z"
ID="9849d173-7f1b-41ff-9ed9-b3e55032e195"


def oldpoll(identifier, pollster, day, dem, rep):
    return {
        "poll_id":identifier,"field_end":day,"pollster":pollster,"dem":dem,
        "rep":rep,"margin":round(dem-rep,2),"sample_size":650,
        "partisan_lean":"","dem_name":"Peggy Flanagan",
        "rep_name":"Michele Tafoya","first_seen_at":None,"release_date":None,
    }


def primary():
    races=[{
        "race_code":"MN-SEN","race_type":"senate","state":"MN","district":"SEN",
        "polls":[oldpoll("previous-surveyusa","SurveyUSA","2026-09-14",42,42),
                 oldpoll("mason-oct07","Mason-Dixon","2026-10-07",47,43)],
        "source_url":"https://example.org/primary-source.csv",
    }]
    races[0]["latest"]=races[0]["polls"][1].copy()
    races[0]["latest_field_end"]="2026-10-07"
    races[0]["recent_poll_count"]=2
    return {"races":races,"updated_at":AT}


def newer(**kwargs):
    entry={
        "race_code":"MN-SEN","race_type":"senate","state":"MN",
        "poll_id":ID,"question_id":"mn-lv-718",
        "pollster":"SurveyUSA","dem_name":"Peggy Flanagan",
        "rep_name":"Michele Tafoya",
        "dem":45,"rep":42,"margin":3.0,
        "field_end":"2026-10-12","field_start":"2026-10-09",
        "posted_date":"2026-10-14",
        "source_url":"https://example.org/published-2026-mn-survey.pdf",
        "sample_population":"lv","sample_size":718,"partisan_lean":""
    }
    entry.update(kwargs)
    return entry


class PollToModelTests(unittest.TestCase):
    def test_new_minnesota_poll_changes_real_aggregate_and_survives_refresh(self):
        p=primary()
        old=model.estimate(p["races"][0],TODAY)
        self.assertEqual(old["latest_poll_end"],"2026-10-07")
        first=recon.merge(p,[newer()],TODAY,observed_at=AT)
        self.assertEqual(first["new_to_model"],1)
        self.assertEqual(first["added_by_race"],{"MN-SEN":1})
        updated=model.estimate(p["races"][0],TODAY)
        self.assertEqual(updated["latest_poll_end"],"2026-10-12")
        survey=next(x for x in updated["pollsters"] if x["name"]=="SurveyUSA")
        self.assertEqual(survey["field_end"],"2026-10-12")
        self.assertEqual(survey["poll_id"],ID)
        self.assertNotEqual(old["dem_minus_rep"],updated["dem_minus_rep"],
                            "New live data must actually recompute the poll average")
        self.assertEqual(p["races"][0]["latest"]["poll_id"],ID)
        self.assertIsNone(p["races"][0]["latest"]["release_date"],
                          "A source INGESTION DATE is NOT a public release date")
        self.assertEqual(p["races"][0]["latest"]["first_seen_at"],AT)
        # Simulate the next 4h ElectIndex ingestion still omitting this study.
        lagging=primary()
        persisted=recon.carry_forward(p,lagging,TODAY)
        self.assertEqual(persisted["new_to_model"],1)
        self.assertEqual(lagging["races"][0]["latest"]["poll_id"],ID)
        self.assertEqual(lagging["races"][0]["latest"]["first_seen_at"],AT)
        # Next time the primary provider catches up, poll ID is not repeated.
        caught_up=primary()
        caught_up["races"][0]["polls"].insert(0,copy.deepcopy(p["races"][0]["latest"]))
        caught_up["races"][0]["latest"]=caught_up["races"][0]["polls"][0]
        self.assertEqual(recon.carry_forward(p,caught_up,TODAY)["new_to_model"],0)
        self.assertEqual(len([x for x in caught_up["races"][0]["polls"]
            if x["poll_id"]==ID]),1)

    def test_same_source_id_alternatives_do_not_double_count(self):
        p=primary()
        lv=newer()
        rv=newer(question_id="mn-rv",sample_population="rv",
                  sample_size=1200,dem=48,rep=41)
        r=recon.merge(p,[rv,lv],TODAY)
        self.assertEqual(r["new_to_model"],1)
        self.assertEqual(p["races"][0]["latest"]["sample_population"],"lv")
        self.assertEqual(p["races"][0]["latest"]["dem"],45)
        self.assertEqual(recon.merge(p,[lv,rv],TODAY)["new_to_model"],0)
        self.assertEqual(len(p["races"][0]["polls"]),3)

    def test_existing_primary_registered_voters_switches_to_likely_once(self):
        # The first importer carries RV under the SAME poll ID as the LV
        # question in the supplemental feed. Do not ignore LV or count two polls.
        p=primary()
        original=p["races"][0]["polls"][-1]
        before=model.estimate(p["races"][0],TODAY)["dem_minus_rep"]
        rv=newer(poll_id="mason-oct07",pollster="Mason-Dixon",
                 field_end="2026-10-07",question_id="rv-question",
                 sample_population="rv",dem=47,rep=43)
        lv=newer(poll_id="mason-oct07",pollster="Mason-Dixon",
                 field_end="2026-10-07",question_id="lv-question",
                 sample_population="lv",dem=45,rep=44)
        self.assertEqual(original["dem"],rv["dem"])
        report=recon.merge(p,[rv,lv],TODAY,observed_at=AT)
        self.assertEqual(report["new_to_model"],0)
        self.assertEqual(report["lv_upgrades"],1)
        selected=next(x for x in p["races"][0]["polls"]
                      if x["poll_id"]=="mason-oct07")
        self.assertEqual(selected["sample_population"],"lv")
        self.assertEqual(selected["question_id"],"lv-question")
        self.assertEqual((selected["dem"],selected["rep"]),(45,44))
        self.assertEqual(len(p["races"][0]["polls"]),2)
        after=model.estimate(p["races"][0],TODAY)
        self.assertNotEqual(before,after["dem_minus_rep"])
        self.assertEqual(after["contributing_pollsters"],2)
        self.assertEqual(recon.merge(p,[lv,rv],TODAY)["lv_upgrades"],0)

        # The ElectIndex refresh may keep serving RV after an LV update.
        # The verified LV question must not disappear on the next refresh.
        lagging=primary()
        self.assertEqual(recon.carry_forward(p,lagging,TODAY)["lv_upgrades"],1)
        carried=next(x for x in lagging["races"][0]["polls"]
                     if x["poll_id"]=="mason-oct07")
        self.assertEqual((carried["dem"],carried["rep"]),(45,44))
        self.assertEqual(model.estimate(lagging["races"][0],TODAY)["dem_minus_rep"],
                         after["dem_minus_rep"])

    def test_unanchored_lv_cannot_overwrite_unrelated_primary_question(self):
        p=primary()
        only_lv=newer(poll_id="mason-oct07",pollster="Mason-Dixon",
                      field_end="2026-10-07",dem=66,rep=20,
                      sample_population="lv")
        self.assertEqual(recon.merge(p,[only_lv],TODAY)["lv_upgrades"],0)
        self.assertEqual(p["races"][0]["polls"][-1]["dem"],47)

    def test_rv_only_keeps_existing_primary_and_known_rv_can_be_upgraded(self):
        p=primary()
        rv=newer(poll_id="mason-oct07",pollster="Mason-Dixon",
                 field_end="2026-10-07",dem=47,rep=43,
                 sample_population="rv")
        self.assertEqual(recon.merge(p,[rv],TODAY)["lv_upgrades"],0)
        self.assertEqual(p["races"][0]["polls"][-1]["sample_population"],"rv")
        lv=newer(poll_id="mason-oct07",pollster="Mason-Dixon",
                 field_end="2026-10-07",dem=45,rep=44,
                 sample_population="lv")
        self.assertEqual(recon.merge(p,[lv],TODAY)["lv_upgrades"],1)

    def test_conflicting_lv_variants_cannot_cherry_pick(self):
        p=primary()
        rv=newer(poll_id="mason-oct07",pollster="Mason-Dixon",
                 field_end="2026-10-07",sample_population="rv",dem=47,rep=43)
        lv=newer(poll_id="mason-oct07",pollster="Mason-Dixon",
                 field_end="2026-10-07",sample_population="lv",dem=45,rep=44,
                 sample_size=718,question_id="lv-one")
        clash={**lv,"question_id":"lv-two","dem":49,"rep":42}
        self.assertEqual(recon.merge(p,[rv,lv,clash],TODAY)["lv_upgrades"],0)
        self.assertEqual(p["races"][0]["polls"][-1]["dem"],47)

    def test_equal_priority_conflicting_answers_are_quarantined(self):
        p=primary()
        left=newer(question_id="one",dem=45,rep=42)
        right=newer(question_id="two",dem=47,rep=41)
        self.assertEqual(recon.merge(p,[left,right],TODAY)["new_to_model"],0)

    def test_wrong_matchup_stale_missing_source_and_future_rejected(self):
        for item in [
            newer(dem_name="Someone Else"),
            newer(rep_name="Someone Else"),
            newer(race_code="MN-GOV"),
            newer(source_url=None),
            newer(field_end="2026-05-01"),
            newer(field_end="2026-10-20"),
            newer(dem=102),
            newer(sample_size=None),
            newer(sample_population="lv",dem=10,rep=9),
        ]:
            p=primary()
            self.assertEqual(recon.merge(p,[item],TODAY)["new_to_model"],0)

    def test_original_primary_study_enriched_not_overridden(self):
        p=primary()
        source=newer(poll_id="mason-oct07",pollster="Mason-Dixon",
                     field_end="2026-10-07",dem=47,rep=43)
        r=recon.merge(p,[source],TODAY)
        self.assertEqual(r["new_to_model"],0)
        self.assertEqual(r["enriched_existing"],1)
        self.assertEqual(len(p["races"][0]["polls"]),2)
        self.assertIn("source_poll_url",p["races"][0]["polls"][0])

    def test_preexisting_primary_collision_does_not_replace_share(self):
        p=primary()
        fake=newer(poll_id="mason-oct07",dem=69,rep=10)
        self.assertEqual(recon.merge(p,[fake],TODAY)["new_to_model"],0)
        self.assertEqual(p["races"][0]["polls"][0]["dem"],47)

    def test_validator_detects_missing_model_poll(self):
        p=primary()
        # Validation helper must detect when new-polls shows this source ID
        # but the model source omits it.
        self.assertEqual(len(recon.candidate_observations(p,[newer()],TODAY)),1)
        recon.merge(p,[newer()],TODAY,observed_at=AT)
        self.assertEqual(recon.candidate_observations(p,[newer()],TODAY),[])

    def test_untracked_senate_house_and_governor_contests_are_created(self):
        for code, office in [("NH-SEN", "senate"),
                             ("MA-03", "house"),
                             ("NH-GOV", "governor")]:
            p = primary()
            poll = newer(race_code=code, race_type=office, state=code[:2],
                         dem_name="Candidate Alice", rep_name="Candidate Bob",
                         poll_id="new-"+code, dem=47, rep=42, margin=5)
            # These races are absent from the primary ElectIndex fixture.
            self.assertNotIn(code, {r["race_code"] for r in p["races"]})
            missing = recon.candidate_observations(p, [poll], TODAY)
            self.assertEqual(len(missing), 1, code)
            report = recon.merge(p, [poll], TODAY, observed_at=AT)
            self.assertEqual(report["created_races"], [code])
            self.assertEqual(report["new_to_model"], 1)
            row = next(r for r in p["races"] if r["race_code"] == code)
            self.assertEqual(row["latest"]["poll_id"], "new-"+code)
            self.assertEqual(row["model_race_source"], "pollresults_bootstrap")
            estimate = model.estimate(row, TODAY)
            self.assertEqual(estimate["status"], "single_poll")
            self.assertAlmostEqual(estimate["dem_minus_rep"], 5)
            # Next primary refresh may still omit the whole race. No regression:
            lagging = primary()
            carried = recon.carry_forward(p, lagging, TODAY)
            self.assertEqual(carried["created_races"], [code])
            self.assertEqual(carried["new_to_model"], 1)
            self.assertEqual(next(r for r in lagging["races"] if
                r["race_code"] == code)["latest"]["poll_id"], "new-"+code)

    def test_unknown_race_rejects_invalid_seat_and_conflicting_matchups(self):
        p = primary()
        wrong = newer(race_code="MA-99", race_type="house",
                      dem_name="Candidate Alice", rep_name="Candidate Bob")
        self.assertEqual(recon.merge(p, [wrong], TODAY)["created_races"], [])
        self.assertFalse(recon.candidate_observations(p, [wrong], TODAY))
        first = newer(race_code="MA-03", race_type="house",
                      dem_name="Candidate Alice", rep_name="Candidate Bob")
        competing = newer(race_code="MA-03", race_type="house",
                          dem_name="Candidate Carol", rep_name="Candidate Dan",
                          poll_id="second", question_id="different")
        self.assertEqual(recon.merge(p, [first, competing], TODAY)["created_races"], [])
        self.assertNotIn("MA-03", {r["race_code"] for r in p["races"]})

    def test_bootstrapped_race_deduplicates_lv_rv_and_provider_catch_up(self):
        p = primary()
        poll = newer(race_code="NH-SEN", race_type="senate", state="NH",
                     dem_name="Candidate Alice", rep_name="Candidate Bob")
        rv = dict(poll, question_id="rv", sample_population="rv",
                  dem=46, rep=43, margin=3)
        report = recon.merge(p, [rv, poll], TODAY)
        self.assertEqual(report["created_races"], ["NH-SEN"])
        self.assertEqual(report["new_to_model"], 1)
        item = next(r for r in p["races"] if r["race_code"] == "NH-SEN")
        self.assertEqual(item["polls"][0]["sample_population"], "lv")
        # The primary now catches up. Same poll ID cannot be double counted.
        caught_up = primary()
        caught_up["races"].append(copy.deepcopy(item))
        self.assertEqual(recon.carry_forward(p, caught_up, TODAY)["new_to_model"], 0)
        self.assertEqual(len(next(r for r in caught_up["races"]
            if r["race_code"] == "NH-SEN")["polls"]), 1)

    def test_later_out_of_window_secondary_is_pruned(self):
        p=primary()
        recon.merge(p,[newer()],TODAY)
        lagging=primary()
        self.assertEqual(recon.carry_forward(p,lagging,dt.date(2026,12,24))["new_to_model"],0)


if __name__=="__main__":
    unittest.main()
