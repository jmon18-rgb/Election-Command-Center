#!/usr/bin/env python3
"""Nonpublishing probe: does a real 2026 civicAPI detailed Senate race expose county votes?
The candidate list alone is NOT county reporting. Does not publish/alter any forecast.
"""
import json
from test_civicapi_live_source import source, match

def inspect_payload(detail):
    """Reject false positives: geographic rows must contain votes and county identity."""
    paths = []
    def walk(obj, path="", depth=0):
        if depth>4: return
        if isinstance(obj,dict):
            keyset=set(obj)
            geographic=any(k in keyset for k in ("county_fips","county_id","county_geoid","fips"))
            votes=any(k in keyset for k in ("candidates","candidate_votes","vote_totals"))
            if geographic and votes: paths.append(path or "<root>")
            for k,v in obj.items():
                if isinstance(v,(list,dict)): walk(v,path+"."+k,depth+1)
        elif isinstance(obj,list):
            for v in obj[:3]: walk(v,path+"[]",depth+1)
    walk(detail)
    return {"county_candidate_row_paths":sorted(set(paths)),
            "county_results_verified":False,
            "reason":"Field-name discovery alone is not a certified source contract"}

def main():
    checks=[(("NH","Senate",None),"US Senate"),(("NC","Senate",None),"US Senate")]
    for identity,query in checks:
        state,office,district=identity
        results=source("/race/search",{"country":"US","province":state,
            "startDate":"2026-11-03","endDate":"2026-11-03","query":query,"limit":20})
        matches=[x for x in results.get("races",[]) if match(identity,x)]
        if len(matches)!=1:
            print(json.dumps({"state":state,"status":"NO_EXACT_UNAMBIGUOUS_RACE","matches":len(matches)}))
            continue
        detail=source("/race/"+str(matches[0]["id"]),{"light":""})
        finding=inspect_payload(detail)
        print(json.dumps({"state":state,"race_id":matches[0]["id"],
                          "status":"COUNTY_SCHEMA_UNVERIFIED","finding":finding}))

if __name__=="__main__":main()
