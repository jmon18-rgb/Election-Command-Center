#!/usr/bin/env python3
"""Create an auditable 2026 congressional seat inventory, NOT a seat forecast.

All 435 voting House seat slots are present even when no survey exists.
The 2026 Senate ballot has 33 regular Class II seats plus FL/OH specials;
65 holdovers are excluded from the ballot but not from a future control model.
District ID != verified 2026 map, historical vote, or winning candidate.
"""
import argparse
import datetime as dt
import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HOUSE_COUNTS = {
    "AL":7,"AK":1,"AZ":9,"AR":4,"CA":52,"CO":8,"CT":5,"DE":1,"FL":28,
    "GA":14,"HI":2,"ID":2,"IL":17,"IN":9,"IA":4,"KS":4,"KY":6,"LA":6,
    "ME":2,"MD":8,"MA":9,"MI":13,"MN":8,"MS":4,"MO":8,"MT":2,"NE":3,
    "NV":4,"NH":2,"NJ":12,"NM":3,"NY":26,"NC":14,"ND":1,"OH":15,"OK":5,
    "OR":6,"PA":17,"RI":2,"SC":7,"SD":1,"TN":9,"TX":38,"UT":4,"VT":1,
    "VA":11,"WA":10,"WV":2,"WI":8,"WY":1,
}
CLASS_II = {
    "AL","AK","AR","CO","DE","GA","ID","IL","IA","KS","KY",
    "LA","ME","MA","MI","MN","MS","MT","NE","NH","NJ","NM",
    "NC","OK","OR","RI","SC","SD","TN","TX","VA","WV","WY"
}
SPECIALS = {"FL","OH"}
SOURCE = {
    "house_apportionment":"https://www.census.gov/data/tables/time-series/dec/apportionment-data-text.html",
    "senate_class_ii":"https://www.senate.gov/senators/Class_II.htm",
    "senate_current_party_lineup":"https://www.dailypress.senate.gov/on-the-floor/senate-facts/",
    "senate_specials_reference":"https://senatordb.com/elections/2026",
}
assert len(HOUSE_COUNTS)==50 and sum(HOUSE_COUNTS.values())==435
assert len(CLASS_II)==33 and len(SPECIALS)==2 and not (CLASS_II & SPECIALS)
assert CLASS_II | SPECIALS <= HOUSE_COUNTS.keys()

def latest_rows(model,kind):
    return model.get({"house":"house","senate":"senate_all"}[kind],[]) or []

def usable(row):
    return (row.get("status") in {"multi_poll","single_poll"}
            and isinstance(row.get("dem_minus_rep"),(int,float))
            and not isinstance(row.get("dem_minus_rep"),bool))

def build(model,as_of=None):
    as_of=as_of or dt.datetime.now(dt.timezone.utc).isoformat()
    house_expected={f"{state}-{i:02d}" for state,n in HOUSE_COUNTS.items()
                    for i in range(1,n+1)}
    senate_expected={f"{state}-SEN" for state in CLASS_II | SPECIALS}
    house_model={r["race_code"]:r for r in latest_rows(model,"house") if r.get("race_code")}
    senate_model={r["race_code"]:r for r in latest_rows(model,"senate") if r.get("race_code")}
    poll_extras={
       "house":sorted(set(house_model)-house_expected),
       "senate":sorted(set(senate_model)-senate_expected)
    }
    house=[]
    for state,n in sorted(HOUSE_COUNTS.items()):
        for number in range(1,n+1):
            code=f"{state}-{number:02d}"
            observation=house_model.get(code,{})
            house.append({
              "race_code":code,"state":state,"district":number,
              "district_key_type":"apportionment_slot_not_verified_2026_geometry",
              "poll_status":observation.get("status","not_in_source"),
              "has_usable_poll_average":usable(observation),
              "pollster_count":observation.get("contributing_pollsters",0) if usable(observation) else 0,
              "latest_poll_field_end":observation.get("latest_poll_end") if usable(observation) else None,
              "fundamentals_status":"not_loaded",
              "map_2026_status":"not_verified",
              "incumbent_party":None,
              "election_day_margin_estimate":None,
              "outcome_probability":None
            })
    senate=[]
    for state in sorted(CLASS_II|SPECIALS):
        code=f"{state}-SEN"
        observation=senate_model.get(code,{})
        senate.append({
          "race_code":code,"state":state,
          "seat_class":"III" if state in SPECIALS else "II",
          "election_kind":"special" if state in SPECIALS else "regular",
          "poll_status":observation.get("status","not_in_source"),
          "has_usable_poll_average":usable(observation),
          "pollster_count":observation.get("contributing_pollsters",0) if usable(observation) else 0,
          "latest_poll_field_end":observation.get("latest_poll_end") if usable(observation) else None,
          "fundamentals_status":"not_loaded",
          "candidate_ballot_status":"not_verified",
          "incumbent_party":None,
          "election_day_margin_estimate":None,
          "outcome_probability":None
        })
    house_polled=sum(s["has_usable_poll_average"] for s in house)
    senate_polled=sum(s["has_usable_poll_average"] for s in senate)
    missing_h=[s["race_code"] for s in house if not s["has_usable_poll_average"]]
    missing_s=[s["race_code"] for s in senate if not s["has_usable_poll_average"]]
    unresolved_2026_district_maps=435
    ready=False
    blockers=[
      f"{len(missing_h)} House district(s) lack a qualifying named-matchup polling mean; require validated fundamentals priors.",
      f"{len(missing_s)} 2026 Senate contest(s) lack a qualifying named-matchup polling mean; require validated fundamentals priors.",
      "All 2026 district map versions and district-level 2024 presidential/House result baselines must be verified.",
      "Candidate/party/incumbency fields are not loaded for all 470 contests.",
      "65 holdover Senate seats need current caucus verification and tracking of changes/vacancies.",
      "No leave-election-year-out calibration of election-day error, national/regional correlation or joint 470-contest scenarios.",
      "A timestamped external competitive-race slate is required for the Blue Tsunami near-sweep test."
    ]
    return {
      "generated_at":as_of,
      "schema_version":"1.0",
      "status":"complete_slot_inventory_incomplete_forecast_inputs",
      "polling_source_snapshot":model.get("generated_at"),
      "is_election_forecast":False,
      "can_model_chamber_control":ready,
      "sources":SOURCE,
      "house":{"total_voting_seats":435,"by_state":HOUSE_COUNTS,
               "polled_with_qualifying_average":house_polled,
               "without_qualifying_average":len(missing_h),
               "district_map_status":"unverified_for_2026_redistricting",
               "unrecognized_poll_codes":poll_extras["house"],
               "seats":house},
      "senate":{"total_seats":100,"contested_regular":33,"contested_special":2,
                "contested_total":35,"holdover_total":65,
                "holdover_caucus_reference":{"as_of":"2026-07-14",
                 "democratic_party":32,"independent_caucusing_with_democrats":2,
                 "republican_party":31,
                 "note":"Reference starting composition only: not a verified Nov election-night party count or forecast."},
                "polled_with_qualifying_average":senate_polled,
                "without_qualifying_average":len(missing_s),
                "unrecognized_poll_codes":poll_extras["senate"],
                "contested_seats":senate},
      "data_gaps":{"house_without_polls":missing_h,"senate_without_polls":missing_s,
                   "house_out_of_universe_poll_codes":poll_extras["house"],
                   "senate_out_of_universe_poll_codes":poll_extras["senate"]},
      "forecast_readiness":{"ready":ready,"blockers":blockers,
         "note":"Poll coverage is not seat outcome coverage. Do not assign predicted winners, chamber-control odds or scenario percentages."},
      "caveats":[
        "The House slots reflect 2020 Census seat apportionment; they do not establish which district map is in effect in November 2026.",
        "The Senate contest list uses the 33 regular Class II states plus verified FL/OH 2026 specials; check for any newly scheduled specials.",
        "Holdover caucus counts are a dated July 2026 reference, not a dynamic feed.",
        "Some elections include third-party/independent candidates; an observed two-candidate poll margin is not a result or victory probability."
      ]
    }

def validate(doc):
    h=doc["house"]["seats"]
    s=doc["senate"]["contested_seats"]
    assert len(h)==len({x["race_code"] for x in h})==435
    assert len(s)==len({x["race_code"] for x in s})==35
    assert doc["senate"]["holdover_total"]+len(s)==100
    assert sum(doc["house"]["by_state"].values())==435
    assert all(x["outcome_probability"] is None and
               x["election_day_margin_estimate"] is None for x in h+s)
    assert doc["house"]["polled_with_qualifying_average"]+doc["house"]["without_qualifying_average"]==435
    assert doc["senate"]["polled_with_qualifying_average"]+doc["senate"]["without_qualifying_average"]==35
    assert not doc["is_election_forecast"] and not doc["can_model_chamber_control"]
    if doc["house"]["unrecognized_poll_codes"] or doc["senate"]["unrecognized_poll_codes"]:
        raise ValueError("Unexpected 2026 polling race codes outside official apportionment/election universe: "+
            str(doc["house"]["unrecognized_poll_codes"])+", "+str(doc["senate"]["unrecognized_poll_codes"]))

if __name__=="__main__":
    parser=argparse.ArgumentParser()
    parser.add_argument("--model",type=Path,default=ROOT/"data/polling_estimates.json")
    parser.add_argument("--output",type=Path,default=ROOT/"data/seat_universe.json")
    args=parser.parse_args()
    model=json.loads(args.model.read_text(encoding="utf-8"))
    doc=build(model)
    validate(doc)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(doc,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    print("Seat inventory: House {}/435 polled; Senate {}/35 polled; 65 holdovers not on the ballot; forecast gated."
          .format(doc["house"]["polled_with_qualifying_average"],doc["senate"]["polled_with_qualifying_average"]))
