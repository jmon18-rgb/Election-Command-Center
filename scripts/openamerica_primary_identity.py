#!/usr/bin/env python3
"""Finite provider-wire identity translation; never a vote/source validator.

The owned exact 2026 Senate endpoint labels the independently identified
Florida special contest FL. Preserve the complete source document and all
record values, translating only that key before existing strict validators.
"""
from copy import deepcopy

PRIMARY_2026_SENATE_URL="https://openamerica.io/elections/results.json?year=2026&office=Senate"
FLORIDA_2026_CANDIDATES=frozenset((
    ("Neil J. Gillespie","I"),
    ("Ashley Moody","R"),
    ("Angie Nixon","D"),
))

def normalize_primary_source(doc,request_url):
    """Return an untrusted key-normalized copy only for the exact owned case.

    Non-target contexts are unchanged. A target wire key with an unknown
    roster fails closed; strict raw validators retain their original cases.
    No timestamp, candidate, count or call repair occurs here. Both keys are
    always ambiguous in the applicable context.
    """
    if (request_url!=PRIMARY_2026_SENATE_URL or not isinstance(doc,dict) or
            type(doc.get("api")) not in (int,float) or doc["api"]!=1 or
            type(doc.get("year")) not in (int,float) or doc["year"]!=2026 or
            doc.get("office")!="Senate" or doc.get("source")!="state" or
            not isinstance(doc.get("races"),dict) or "FL" not in doc["races"]):
        return doc
    if "FL-special" in doc["races"]:
        raise ValueError("Ambiguous 2026 Florida Senate wire and canonical keys")
    row=doc["races"]["FL"]
    candidates=row.get("cands") if isinstance(row,dict) else None
    if not isinstance(candidates,list) or len(candidates)!=3:
        raise ValueError("Unverified 2026 Florida Senate candidate identity roster")
    pairs=set()
    for candidate in candidates:
        if (not isinstance(candidate,dict) or
                not isinstance(candidate.get("n"),str) or
                not isinstance(candidate.get("p"),str)):
            raise ValueError("Unverified 2026 Florida Senate candidate identity roster")
        pair=(candidate["n"],candidate["p"])
        if pair not in FLORIDA_2026_CANDIDATES or pair in pairs:
            raise ValueError("Unverified 2026 Florida Senate candidate identity roster")
        pairs.add(pair)
    if pairs!=FLORIDA_2026_CANDIDATES:
        raise ValueError("Unverified 2026 Florida Senate candidate identity roster")
    normalized=deepcopy(doc)
    normalized["races"]={
        "FL-special" if key=="FL" else key:record
        for key,record in normalized["races"].items()
    }
    return normalized
