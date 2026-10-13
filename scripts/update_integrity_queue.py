#!/usr/bin/env python3
"""Queue election-integrity news leads for human source verification.

Never converts a headline, number, or search result into a verified incident.
Keeps curated incident records unchanged; preserves review decisions.
"""
import datetime as dt
import hashlib
import json
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
BRIEF=ROOT/"data"/"briefing.json"
QUEUE=ROOT/"data"/"integrity_review_queue.json"
STATES={"Maine":"ME","New Hampshire":"NH","North Carolina":"NC","Michigan":"MI",
"Georgia":"GA","Ohio":"OH","Alaska":"AK","Iowa":"IA","Texas":"TX","Nebraska":"NE",
"Kansas":"KS","Minnesota":"MN","Massachusetts":"MA","Pennsylvania":"PA",
"Wisconsin":"WI","Arizona":"AZ","Nevada":"NV"}
TOPICS={"registration":"registration|voter roll|voter list|purge|eligib|citizenship|save database",
"ballot_access":"ballot|polling place|voting access|early voting|absentee",
"litigation":"lawsuit|litigation|court|injunction|judge|appeal",
"security":"threat|bomb|cyber|ice|intimidat|interferen"}
def read(path,default):
    try:return json.loads(path.read_text(encoding="utf-8"))
    except (OSError,ValueError):return default
def main():
    briefing=read(BRIEF,{})
    prior=read(QUEUE,{"items":[]})
    old={x["id"]:x for x in prior.get("items",[])}
    now=dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00","Z")
    discovered=0
    for article in briefing.get("security",[]):
        url=article.get("url","")
        title=article.get("title","")
        if not url.startswith("https://") or not title:continue
        ident=hashlib.sha256((url+"|"+title.lower()).encode()).hexdigest()[:20]
        if ident in old:continue
        low=title.lower()
        states=[abbr for name,abbr in STATES.items() if re.search(r"\b"+re.escape(name.lower())+r"\b",low)]
        topics=[topic for topic,pattern in TOPICS.items() if re.search(pattern,low)]
        # Preserve numbers only as quoted leads; they are NOT verified voter impacts.
        numeric_mentions=re.findall(r"\b\d[\d,]*(?:\.\d+)?\s*(?:million|thousand|voters|ballots|registrations|records)?\b",title,re.I)[:5]
        old[ident]={"id":ident,"title":title,"url":url,"publisher":article.get("source"),
            "published_at":article.get("published_at"),"detected_at":now,
            "state_hints":states,"topic_hints":topics,"headline_numbers_unverified":numeric_mentions,
            "review_status":"needs_primary_source","primary_sources":[],
            "impact_counts_verified":False,"promoted_to_incident_id":None}
        discovered+=1
    items=sorted(old.values(),key=lambda x:x.get("published_at") or "",reverse=True)[:250]
    out={"updated_at":now,"status":"leads_only_not_verified_incidents",
        "policy":"Do not promote or copy any numeric claim into integrity_impact.json without independently checking the primary source, affected units, scope and overlap.",
        "new_leads":discovered,"items":items}
    QUEUE.write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    print("Review queue:",len(items),"leads,",discovered,"new")
if __name__=="__main__":main()
