#!/usr/bin/env python3
"""Geography-safe 2022→2024→2026 House historic two-election comparison.

No forecasting here. Only districts with Census-confirmed unchanged maps in
BOTH transitions and actual recorded D/R totals in BOTH historical elections
can get a two-election historical swing. District numbers alone are not proof.
"""
import datetime as dt
import json
from pathlib import Path
from build_seat_universe import HOUSE_COUNTS
from build_map_bridge import CHANGED as CHANGED_2026, CENSUS as CENSUS_120

ROOT=Path(__file__).resolve().parents[1]
CHANGED_2024={"AL","GA","LA","NY","NC"}
CENSUS_119="https://www.census.gov/programs-surveys/decennial-census/about/rdo/congressional-districts.119th_Congress.html"
OUTPUT=ROOT/"data/house_two_cycle_context.json"

def build(bridge,historic22):
    raw=historic22.get("records") or []
    by22={x["2022_race_code"]:x for x in raw}
    b=bridge.get("districts") or []
    expected={f"{s}-{i:02d}" for s,n in HOUSE_COUNTS.items() for i in range(1,n+1)}
    assert len(by22)==len(raw)==435 and set(by22)==expected,"2022 historical data must be complete and unique"
    assert len(b)==435 and {r["race_code_2026"] for r in b}==expected,"Census 2026 bridge missing seats"
    assert historic22.get("status")=="2022_history_staged_not_2026_priors"
    assert bridge.get("is_forecast") is False
    assert all(not x.get("eligible_as_2026_prior") for x in raw)
    unchanged=set(HOUSE_COUNTS)-CHANGED_2024-CHANGED_2026
    assert len(CHANGED_2024)==5 and len(CHANGED_2026)==9 and len(unchanged)==39
    rows=[]
    for r in b:
        key=r["race_code_2026"];state=r["state"]
        old=by22[key]
        same=state in unchanged
        complete22=not old["missing_major_party_votes"] and old["recorded_two_party_vote_total"]>0
        complete24=r["historical_comparison_available"]
        ready=same and complete22 and complete24
        share22=old["recorded_dem_share_two_party"] if ready else None
        share24=r["historical_2024_dem_share_two_party"] if ready else None
        rows.append({
            "race_code_2026":key,"state":state,
            "boundaries_2022_to_2024":"changed" if state in CHANGED_2024 else "unchanged",
            "boundaries_2024_to_2026":r["map_relation_2024_to_2026"],
            "geography_comparable_across_all_three_elections":same,
            "has_recorded_both_major_parties_2022":complete22,
            "has_recorded_both_major_parties_2024":complete24,
            "can_compare_historic_two_party_votes":ready,
            "recorded_dem_share_2022_two_party":share22,
            "recorded_dem_share_2024_two_party":share24,
            "observed_dem_share_change_2022_to_2024_points":round(100*(share24-share22),2) if ready else None,
            "forecast_2026_margin":None,"forecast_2026_win_probability":None,
            "interpretation":"descriptive_two_elections_different_turnout_and_candidates" if ready else
                "BLOCKED_geography_changed" if not same else "BLOCKED_uncontested_or_missing_major_party",
            "census_2024_boundary_source":CENSUS_119,
            "census_2026_boundary_source":CENSUS_120
        })
    same=sum(x["geography_comparable_across_all_three_elections"] for x in rows)
    usable=sum(x["can_compare_historic_two_party_votes"] for x in rows)
    return {
      "generated_at":dt.datetime.now(dt.timezone.utc).isoformat(),
      "status":"two_cycle_historical_comparison_only",
      "is_forecast":False,
      "sources":{"census_2024":CENSUS_119,"census_2026":CENSUS_120,
        "2022_house_history":historic22.get("source_original"),
        "2024_house_history":bridge.get("source_house_history")},
      "coverage":{"total_voting_house_seats":435,"states_same_boundaries_2022_2024_2026":39,
                  "states_changed_between_2022_and_2024":5,
                  "states_changed_between_2024_and_2026":9,
                  "districts_same_boundaries_all_three":same,
                  "districts_with_two_historical_major_party_shares":usable,
                  "districts_blocked_geography_or_ballot":435-usable},
      "changed_states_2024":sorted(CHANGED_2024),
      "changed_states_2026":sorted(CHANGED_2026),
      "rows":rows,
      "warnings":[
        "2022 and 2024 House elections differed in national environment, turnout and candidates; raw share changes are NOT 2026 predictions.",
        "A party missing from either source's recorded candidates makes two-party historical comparisons unavailable, not zero.",
        "2024 and 2026 geographic boundary changes are Census state-level determinations; unchanged states alone permit a direct district-number join.",
        "Even geography-safe historical swings are descriptive inputs, not tested fundamentals or trained House forecast priors."
      ]
    }

def validate(doc):
    rows=doc["rows"];coverage=doc["coverage"]
    assert len(rows)==len({r["race_code_2026"] for r in rows})==435
    assert coverage["districts_same_boundaries_all_three"]+sum(not r["geography_comparable_across_all_three_elections"] for r in rows)==435
    assert coverage["districts_with_two_historical_major_party_shares"]==sum(r["can_compare_historic_two_party_votes"] for r in rows)
    assert coverage["states_same_boundaries_2022_2024_2026"]==39
    assert not doc["is_forecast"]
    for r in rows:
        assert r["forecast_2026_margin"] is None and r["forecast_2026_win_probability"] is None
        if r["can_compare_historic_two_party_votes"]:
            assert r["geography_comparable_across_all_three_elections"]
            assert r["recorded_dem_share_2022_two_party"] is not None
            assert r["recorded_dem_share_2024_two_party"] is not None
        else:
            assert r["recorded_dem_share_2022_two_party"] is None
            assert r["recorded_dem_share_2024_two_party"] is None
            assert r["observed_dem_share_change_2022_to_2024_points"] is None

if __name__=="__main__":
    bridge=json.loads((ROOT/"data/house_geography_bridge.json").read_text(encoding="utf-8"))
    historic=json.loads((ROOT/"data/house_history_2022_staging.json").read_text(encoding="utf-8"))
    doc=build(bridge,historic);validate(doc)
    OUTPUT.write_text(json.dumps(doc,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    c=doc["coverage"]
    print("Three-cycle geographic guard: {} boundary-compatible, {} raw D/R historical pairs, {} blocked. No 2026 forecasts.".format(
      c["districts_same_boundaries_all_three"],c["districts_with_two_historical_major_party_shares"],c["districts_blocked_geography_or_ballot"]))
