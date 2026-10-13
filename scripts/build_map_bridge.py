#!/usr/bin/env python3
"""Census-backed 2024→2026 House district geography bridge.

Only identical boundaries can carry a 2024 House result forward as comparable
HISTORICAL CONTEXT. This never computes 2026 votes, forecast margins or odds.
The Census Bureau confirms nine states have new district maps for 2026.
Missouri's proposed map was stayed and 2024 lines remain in effect.
"""
import datetime as dt
import json
from pathlib import Path
from build_seat_universe import HOUSE_COUNTS

ROOT=Path(__file__).resolve().parents[1]
UNIVERSE=ROOT/"data/seat_universe.json"
HISTORY=ROOT/"data/house_history_2024_staging.json"
OUTPUT=ROOT/"data/house_geography_bridge.json"
CENSUS="https://www.census.gov/programs-surveys/decennial-census/about/rdo/congressional-districts.html"
NCSL="https://www.ncsl.org/redistricting-and-census/changing-the-maps-tracking-mid-decade-redistricting"
# Official Census Bureau 120th Congressional District status (checked Oct 13).
CHANGED={"AL","CA","FL","LA","NC","OH","TN","TX","UT"}
MISSOURI="MO"

def build(universe,history):
    expected={f"{s}-{i:02d}" for s,n in HOUSE_COUNTS.items() for i in range(1,n+1)}
    voting=universe.get("house",{}).get("seats",[])
    historical=history.get("records",[])
    keys=[r.get("race_code") for r in voting]
    hist_keys=[r.get("2024_race_code") for r in historical]
    assert len(voting)==len(set(keys))==435 and set(keys)==expected,"Incomplete 2026 voting seat inventory"
    assert len(historical)==len(set(hist_keys))==435 and set(hist_keys)==expected,"Incomplete 2024 House history"
    assert history.get("status")=="2024_history_staged_not_2026_priors","Unverified history input"
    assert not any(row.get("eligible_as_2026_prior") for row in historical),"Unexpected historical prior flag"
    byhist={x["2024_race_code"]:x for x in historical}
    unchanged=set(HOUSE_COUNTS)-CHANGED
    assert len(unchanged)==41 and MISSOURI in unchanged
    rows=[]
    for voting_seat in voting:
        key=voting_seat["race_code"]
        state=voting_seat["state"]
        observed=byhist[key]
        redrawn=state in CHANGED
        party_data_complete=not observed["missing_major_party_votes"] and observed["recorded_two_party_vote_total"]>0
        same_geography=not redrawn
        comparable=same_geography and party_data_complete
        rows.append({
          "race_code_2026":key,
          "state":state,
          "congressional_geography_reference":"120th_Congress_2026",
          "source_2024_race_code":key,
          "map_relation_2024_to_2026":"changed_requires_reaggregation" if redrawn else "boundaries_unchanged_per_2026_census",
          "geography_comparable_2024":same_geography,
          "has_complete_recorded_major_party_votes_2024":party_data_complete,
          "historical_comparison_available":comparable,
          # No historical-vote shares in changed-map seats: joining by same
          # district number would silently imply geographic comparability.
          "recorded_dem_votes_2024":observed["recorded_dem_votes"] if comparable else None,
          "recorded_rep_votes_2024":observed["recorded_rep_votes"] if comparable else None,
          "historical_2024_dem_share_two_party":observed["recorded_dem_share_two_party"] if comparable else None,
          "year_2026_forecast_prior":None,
          "predicted_2026_margin":None,
          "win_probability":None,
          "historical_use":"context_only_not_a_forecast" if comparable else
              ("blocked_pending_new_line_reaggregation" if redrawn else "missing_recorded_major_party_votes"),
          "source_census":CENSUS
        })
    states={}
    for state in sorted(HOUSE_COUNTS):
        redrawn=state in CHANGED
        records=[x for x in rows if x["state"]==state]
        states[state]={
          "district_count":HOUSE_COUNTS[state],
          "2024_to_2026_boundary_status":"changed" if redrawn else "unchanged",
          "census_2026_source":CENSUS,
          "comparison_2024_status":"requires_precinct_or_block_reaggregation" if redrawn else "same_boundaries",
          "historical_two_party_comparable_districts":sum(x["historical_comparison_available"] for x in records),
          "special_note":"Missouri's September 2026 legal developments reverted the 2026 map to the 2024 plan; updated Census block equivalency files reflect this." if state=="MO" else (
            "Texas 2026 redistricting plan C2333, distinct from previous C2193; use 2026 district-boundary results." if state=="TX" else None
          )
        }
    same=sum(x["geography_comparable_2024"] for x in rows)
    eligible=sum(x["historical_comparison_available"] for x in rows)
    blocked=sum(x["map_relation_2024_to_2026"]=="changed_requires_reaggregation" for x in rows)
    missing_party=sum(x["geography_comparable_2024"] and not x["has_complete_recorded_major_party_votes_2024"] for x in rows)
    return {
      "generated_at":dt.datetime.now(dt.timezone.utc).isoformat(),
      "schema_version":"1.0",
      "status":"historical_geography_bridge_context_only",
      "is_forecast":False,
      "source_version":"Census Bureau 120th Congressional District changes page, verified Oct 13 2026",
      "source_urls":{"census_120th":CENSUS,"ncsl_tracker":NCSL,
        "missouri_block_equivalency_status":CENSUS,
        "texas_2026_plan":"https://redistricting.capitol.texas.gov/"},
      "source_house_history":history.get("source_original"),
      "summary":{"voting_house_districts":435,
        "states_same_boundaries":41,"states_redrawn":9,
        "same_boundary_districts":same,"redrawn_districts":blocked,
        "comparable_2024_recorded_two_party_districts":eligible,
        "unchanged_boundary_districts_missing_major_party_votes":missing_party,
        "ready_for_2026_outcome_forecast":False},
      "changed_states":sorted(CHANGED),
      "unchanged_states":sorted(unchanged),
      "by_state":states,
      "districts":rows,
      "limitations":[
        "Boundary comparability alone does not make 2024 House candidate votes a good 2026 election forecast prior.",
        "Districts in nine changed-map states have NO mapped 2024 raw votes pending geospatial reaggregation.",
        "Even unchanged-district 2024 votes are historical context only; incumbency, candidate lineup, 2024 presidential vote and 2026 environment are not modeled.",
        "The existing MIT raw 2024 dataset includes districts without one major party's recorded candidate votes; those have null historical two-party comparisons.",
        "Source is a timestamped Census interpretation of district boundaries, not a continuously updating legal-status API.",
        "District geometry should be re-verified before Election Day if courts or states change maps."
      ]
    }

def validate(doc):
    x=doc["districts"]
    assert len(x)==len({r["race_code_2026"] for r in x})==435
    assert len(doc["by_state"])==50 and len(doc["changed_states"])==9
    assert doc["summary"]["states_same_boundaries"]==41
    assert doc["summary"]["same_boundary_districts"]+doc["summary"]["redrawn_districts"]==435
    assert doc["summary"]["comparable_2024_recorded_two_party_districts"] <=doc["summary"]["same_boundary_districts"]
    assert sum(r["historical_comparison_available"] for r in x)==doc["summary"]["comparable_2024_recorded_two_party_districts"]
    assert not doc["summary"]["ready_for_2026_outcome_forecast"]
    for r in x:
        assert r["win_probability"] is None and r["predicted_2026_margin"] is None
        assert r["year_2026_forecast_prior"] is None
        if r["state"] in CHANGED:
            assert r["map_relation_2024_to_2026"]=="changed_requires_reaggregation"
            assert r["historical_2024_dem_share_two_party"] is None
            assert r["recorded_dem_votes_2024"] is None
            assert not r["historical_comparison_available"]
        if r["historical_comparison_available"]:
            assert r["map_relation_2024_to_2026"]=="boundaries_unchanged_per_2026_census"
            assert r["recorded_dem_votes_2024"] is not None
            assert r["recorded_rep_votes_2024"] is not None
            assert 0<=r["historical_2024_dem_share_two_party"]<=1

def main():
    seats=json.loads(UNIVERSE.read_text(encoding="utf-8"))
    historic=json.loads(HISTORY.read_text(encoding="utf-8"))
    doc=build(seats,historic)
    validate(doc)
    OUTPUT.write_text(json.dumps(doc,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    n=doc["summary"]
    print(f"Census map bridge: {n['same_boundary_districts']} boundary-aligned slots; "+
          f"{n['redrawn_districts']} require reaggregation; "+
          f"{n['comparable_2024_recorded_two_party_districts']} descriptive 2024 2-party comparisons. NO forecasts.")

if __name__=="__main__":
    main()
