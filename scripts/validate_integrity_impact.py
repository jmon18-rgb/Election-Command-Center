#!/usr/bin/env python3
"""Validate evidence and units before publishing voter-impact figures."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
path=ROOT/"data"/"integrity_impact.json"
data=json.loads(path.read_text(encoding="utf-8"))
allowed={"voters","ballots","registrations","records"}
statuses=set(data["methodology"]["verification_statuses"])
ids=set()
for incident in data["incidents"]:
    ident=incident["id"]
    assert ident not in ids, f"Duplicate incident: {ident}"
    ids.add(ident)
    assert incident["verification_status"] in statuses, ident
    assert incident.get("sources"), f"Missing sources: {ident}"
    assert all(x.get("url","").startswith("https://") for x in incident["sources"]),ident
    assert incident["units"] in allowed,ident
    values=[incident.get(k) for k in ("potentially_affected","confirmed_affected","remedied","unresolved")]
    assert all(v is None or (type(v) is int and v>=0) for v in values),ident
    if any(v is not None for v in values):
        assert incident.get("impact_assessment")!="not_quantified",ident
        assert incident.get("count_source_notes"),f"Numeric count lacks provenance: {ident}"
        assert incident.get("count_as_of"),f"Numeric count lacks date: {ident}"
    if incident.get("scope_label"):
        assert incident.get("scope_note"), f"Scope needs unit clarification: {ident}"
    if incident.get("process_status"):
        assert incident.get("last_updated"), f"Status requires review date: {ident}"
    scenario=incident.get("adverse_scenario")
    assert isinstance(scenario,dict),f"Missing worst-case scenario definition: {ident}"
    assert scenario.get("definition"),f"Unnamed risk outcome: {ident}"
    worst=scenario.get("worst_case_unique_eligible_voters")
    prob=scenario.get("probability_of_scenario")
    bounds=scenario.get("probability_interval")
    assert worst is None or (type(worst) is int and worst>=0),f"Invalid eligible-voter bound: {ident}"
    assert prob is None or (type(prob) in (float,int) and 0<=prob<=1),f"Invalid scenario probability: {ident}"
    if bounds is not None:
        assert isinstance(bounds,list) and len(bounds)==2 and all(type(v) in (float,int) and 0<=v<=1 for v in bounds) and bounds[0]<=bounds[1],f"Invalid probability range: {ident}"
        assert prob is not None and bounds[0]<=prob<=bounds[1],f"Probability outside range: {ident}"
    if worst is not None:
        assert scenario.get("worst_case_source") and scenario.get("worst_case_source")!="Not established; requires voter-level deduplication, affected voters and counterfactual access data.",f"Worst-case voter number missing provenance: {ident}"
    if prob is not None:
        assert scenario.get("probability_basis") and not scenario["probability_basis"].startswith("Not estimated"),f"Numerical probability lacks estimable basis: {ident}"
    assert scenario.get("probability_threshold_unique_voters")==100, f"Scenario probability must specify the >=100 voter threshold: {ident}"
    assert scenario.get("probability_method"),f"Missing probability model identifier: {ident}"
    if prob is not None:
        assert isinstance(scenario.get("probability_as_of"),str) and scenario["probability_as_of"], f"Missing review date for probability: {ident}"
        assert bounds is not None,f"Working subjective probabilities require a range: {ident}"
        assert scenario.get("probability_empirically_calibrated") is False, f"Do not describe subjective odds as calibrated: {ident}"
    proxy=scenario.get("exposure_proxy")
    assert isinstance(proxy,dict), f"Exposure proxy required, even if unknown: {ident}"
    assert proxy.get("unit") and proxy.get("notes"), f"Exposure proxy must identify units and interpretation: {ident}"
    pv=proxy.get("value")
    assert pv is None or (type(pv) is int and pv>=0), f"Exposure proxy numeric value must be a nonnegative integer: {ident}"
    if incident.get("verification_status")=="unverified_report":
        assert all(v is None for v in values),f"Unverified report has published impact count: {ident}"
print("Validated",len(ids),"sourced integrity incidents; no unsupported numerical impacts")
