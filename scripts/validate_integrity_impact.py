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
    if incident.get("verification_status")=="unverified_report":
        assert all(v is None for v in values),f"Unverified report has published impact count: {ident}"
print("Validated",len(ids),"sourced integrity incidents; no unsupported numerical impacts")
