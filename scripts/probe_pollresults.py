#!/usr/bin/env python3
"""Inspect a second public, attributed polling feed before merging anything."""
import datetime as dt
import json
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BASE="https://api.pollresults.org/v1.0/politics/results"
result={"status":"staging_not_live","source":"https://pollresults.org/",
        "fetched_at":dt.datetime.now(dt.timezone.utc).isoformat(),
        "office_samples":{}}
for office in ("senate","house","governor"):
    url=f"{BASE}/{office}?limit=3"
    req=urllib.request.Request(url,headers={"User-Agent":"ElectionResearchDesk/0.1 (noncommercial; source comparison)",
                                            "Accept":"application/json"})
    with urllib.request.urlopen(req,timeout=35) as response:
        data=json.loads(response.read(400_000).decode("utf-8"))
    observations=data.get("results",[])
    result["office_samples"][office]={"total":data.get("total"),
                                     "cursor_present":bool(data.get("cursor")),
                                     "object_keys":list(observations[0]) if observations else [],
                                     "first_two":observations[:2]}
    print(office,"total",data.get("total"),"sample keys",
          result["office_samples"][office]["object_keys"])
out=ROOT/"data/pollresults_source_probe.json"
out.write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n",encoding="utf-8")
